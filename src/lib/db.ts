import { DB_NAME, DB_VERSION } from "../config/constants";
import type { Album, Photo, PhotoImage, PreparedPhoto } from "../types";

const ALBUM_STORE = "albums";
const PHOTO_STORE = "photos";
const PHOTO_IMAGE_STORE = "photo_images";

type StoredPhoto = {
	id: string;
	albumId: string;
	createdAt: number;
	updatedAt: number;
	imageCount: number;
	coverImageId?: string;
	memo?: string;
};

type LegacyPhoto = {
	id: string;
	albumId: string;
	createdAt: number;
	width?: number;
	height?: number;
	sizeBytes?: number;
	mimeType?: string;
	blob?: Blob;
	thumbnailBlob?: Blob;
	memo?: string;
};

let dbPromise: Promise<IDBDatabase> | undefined;

const toPromise = <T>(request: IDBRequest<T>): Promise<T> => {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
	});
};

const completeTx = (tx: IDBTransaction): Promise<void> => {
	return new Promise((resolve, reject) => {
		tx.oncomplete = () => resolve();
		tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
		tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
	});
};

const newId = (): string => {
	if ("randomUUID" in crypto) {
		return crypto.randomUUID();
	}

	return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const hydratePhoto = async (
	storedPhoto: StoredPhoto,
	imageStore: IDBObjectStore,
	imageByPhotoCreatedAtIndex: IDBIndex
): Promise<Photo> => {
	let coverImage: PhotoImage | undefined;

	if (storedPhoto.coverImageId) {
		coverImage = (await toPromise(imageStore.get(storedPhoto.coverImageId))) as
			| PhotoImage
			| undefined;
	}

	if (!coverImage) {
		const range = IDBKeyRange.bound([storedPhoto.id, 0], [storedPhoto.id, Number.MAX_SAFE_INTEGER]);
		const images = (await toPromise(imageByPhotoCreatedAtIndex.getAll(range))) as PhotoImage[];
		coverImage = images.sort((a, b) => b.createdAt - a.createdAt)[0];
	}

	if (!coverImage) {
		throw new Error("画像が見つかりません。");
	}

	return {
		id: storedPhoto.id,
		albumId: storedPhoto.albumId,
		createdAt: storedPhoto.createdAt,
		updatedAt: storedPhoto.updatedAt,
		imageCount: Math.max(1, storedPhoto.imageCount || 1),
		width: coverImage.width,
		height: coverImage.height,
		sizeBytes: coverImage.sizeBytes,
		mimeType: coverImage.mimeType,
		blob: coverImage.blob,
		thumbnailBlob: coverImage.thumbnailBlob,
		memo: storedPhoto.memo,
	};
};

const getDb = (): Promise<IDBDatabase> => {
	if (dbPromise) {
		return dbPromise;
	}

	dbPromise = new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);

		request.onupgradeneeded = (event) => {
			const db = request.result;
			const tx = request.transaction;
			if (!tx) {
				return;
			}

			let albumStore: IDBObjectStore;
			if (!db.objectStoreNames.contains(ALBUM_STORE)) {
				albumStore = db.createObjectStore(ALBUM_STORE, { keyPath: "id" });
			} else {
				albumStore = tx.objectStore(ALBUM_STORE);
			}
			if (!albumStore.indexNames.contains("by_updatedAt")) {
				albumStore.createIndex("by_updatedAt", "updatedAt");
			}

			let photoStore: IDBObjectStore;
			if (!db.objectStoreNames.contains(PHOTO_STORE)) {
				photoStore = db.createObjectStore(PHOTO_STORE, { keyPath: "id" });
			} else {
				photoStore = tx.objectStore(PHOTO_STORE);
			}
			if (!photoStore.indexNames.contains("by_album_createdAt")) {
				photoStore.createIndex("by_album_createdAt", ["albumId", "createdAt"]);
			}

			let imageStore: IDBObjectStore;
			if (!db.objectStoreNames.contains(PHOTO_IMAGE_STORE)) {
				imageStore = db.createObjectStore(PHOTO_IMAGE_STORE, { keyPath: "id" });
			} else {
				imageStore = tx.objectStore(PHOTO_IMAGE_STORE);
			}
			if (!imageStore.indexNames.contains("by_photo_createdAt")) {
				imageStore.createIndex("by_photo_createdAt", ["photoId", "createdAt"]);
			}
			if (!imageStore.indexNames.contains("by_photo")) {
				imageStore.createIndex("by_photo", "photoId");
			}

			if (event.oldVersion < 2) {
				const cursorRequest = photoStore.openCursor();
				cursorRequest.onsuccess = () => {
					const cursor = cursorRequest.result;
					if (!cursor) {
						return;
					}

					const value = cursor.value as LegacyPhoto | StoredPhoto;
					const legacyBlob = (value as LegacyPhoto).blob;

					if (!legacyBlob) {
						cursor.continue();
						return;
					}

					const legacy = value as LegacyPhoto;
					const now = legacy.createdAt || Date.now();
					const imageId = newId();

					const storedPhoto: StoredPhoto = {
						id: legacy.id,
						albumId: legacy.albumId,
						createdAt: now,
						updatedAt: now,
						imageCount: 1,
						coverImageId: imageId,
						memo: legacy.memo,
					};

					const image: PhotoImage = {
						id: imageId,
						photoId: legacy.id,
						createdAt: now,
						width: legacy.width ?? 0,
						height: legacy.height ?? 0,
						sizeBytes: legacy.sizeBytes ?? legacyBlob.size,
						mimeType: legacy.mimeType ?? legacyBlob.type ?? "image/jpeg",
						blob: legacyBlob,
						thumbnailBlob: legacy.thumbnailBlob,
					};

					cursor.update(storedPhoto);
					imageStore.add(image);
					cursor.continue();
				};
			}
		};

		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed"));
	});

	return dbPromise;
};

export const listAlbums = async (): Promise<Album[]> => {
	const db = await getDb();
	const tx = db.transaction(ALBUM_STORE, "readonly");
	const store = tx.objectStore(ALBUM_STORE);
	const result = (await toPromise(store.getAll())) as Album[];
	await completeTx(tx);

	return result.sort((a, b) => b.updatedAt - a.updatedAt);
};

export const getAlbum = async (albumId: string): Promise<Album | undefined> => {
	const db = await getDb();
	const tx = db.transaction(ALBUM_STORE, "readonly");
	const store = tx.objectStore(ALBUM_STORE);
	const album = (await toPromise(store.get(albumId))) as Album | undefined;
	await completeTx(tx);

	return album;
};

export const createAlbum = async (title: string): Promise<Album> => {
	const now = Date.now();
	const album: Album = {
		id: newId(),
		title,
		createdAt: now,
		updatedAt: now,
		photoCount: 0,
	};

	const db = await getDb();
	const tx = db.transaction(ALBUM_STORE, "readwrite");
	tx.objectStore(ALBUM_STORE).add(album);
	await completeTx(tx);

	return album;
};

export const renameAlbumTitle = async (albumId: string, title: string): Promise<Album> => {
	const db = await getDb();
	const tx = db.transaction(ALBUM_STORE, "readwrite");
	const store = tx.objectStore(ALBUM_STORE);

	const album = (await toPromise(store.get(albumId))) as Album | undefined;
	if (!album) {
		tx.abort();
		throw new Error("アルバムが見つかりません。");
	}

	const updatedAlbum: Album = {
		...album,
		title,
		updatedAt: Date.now(),
	};

	store.put(updatedAlbum);
	await completeTx(tx);
	return updatedAlbum;
};

export const listPhotosByAlbum = async (albumId: string): Promise<Photo[]> => {
	const db = await getDb();
	const tx = db.transaction([PHOTO_STORE, PHOTO_IMAGE_STORE], "readonly");
	const photoStore = tx.objectStore(PHOTO_STORE);
	const imageStore = tx.objectStore(PHOTO_IMAGE_STORE);
	const photoIndex = photoStore.index("by_album_createdAt");
	const imageByPhotoCreatedAtIndex = imageStore.index("by_photo_createdAt");
	const range = IDBKeyRange.bound([albumId, 0], [albumId, Number.MAX_SAFE_INTEGER]);

	const storedPhotos = (await toPromise(photoIndex.getAll(range))) as StoredPhoto[];
	const photos = await Promise.all(
		storedPhotos.map((stored) => hydratePhoto(stored, imageStore, imageByPhotoCreatedAtIndex))
	);

	await completeTx(tx);
	return photos.sort((a, b) => b.createdAt - a.createdAt);
};

export const getPhotoById = async (photoId: string): Promise<Photo | undefined> => {
	const db = await getDb();
	const tx = db.transaction([PHOTO_STORE, PHOTO_IMAGE_STORE], "readonly");
	const photoStore = tx.objectStore(PHOTO_STORE);
	const imageStore = tx.objectStore(PHOTO_IMAGE_STORE);
	const imageByPhotoCreatedAtIndex = imageStore.index("by_photo_createdAt");

	const storedPhoto = (await toPromise(photoStore.get(photoId))) as StoredPhoto | undefined;
	if (!storedPhoto) {
		await completeTx(tx);
		return undefined;
	}

	const photo = await hydratePhoto(storedPhoto, imageStore, imageByPhotoCreatedAtIndex);
	await completeTx(tx);
	return photo;
};

export const listImagesByPhoto = async (photoId: string): Promise<PhotoImage[]> => {
	const db = await getDb();
	const tx = db.transaction(PHOTO_IMAGE_STORE, "readonly");
	const imageStore = tx.objectStore(PHOTO_IMAGE_STORE);
	const imageByPhotoCreatedAtIndex = imageStore.index("by_photo_createdAt");
	const range = IDBKeyRange.bound([photoId, 0], [photoId, Number.MAX_SAFE_INTEGER]);

	// Safari で getAll + Blob 参照が壊れることがあるため、primaryKey を列挙して 1 件ずつ get する
	const primaryKeys = await new Promise<IDBValidKey[]>((resolve, reject) => {
		const keys: IDBValidKey[] = [];
		const request = imageByPhotoCreatedAtIndex.openKeyCursor(range, "prev");

		request.onsuccess = () => {
			const cursor = request.result;
			if (!cursor) {
				resolve(keys);
				return;
			}

			keys.push(cursor.primaryKey);
			cursor.continue();
		};

		request.onerror = () => {
			reject(request.error ?? new Error("画像キーの取得に失敗しました。"));
		};
	});

	const images: PhotoImage[] = [];
	for (const key of primaryKeys) {
		const image = (await toPromise(imageStore.get(key))) as PhotoImage | undefined;
		if (!image) {
			continue;
		}

		images.push(image);
	}

	await completeTx(tx);
	return images;
};

export const addPhotoToAlbum = async (
	albumId: string,
	preparedPhoto: PreparedPhoto,
	thumbnailBlob?: Blob
): Promise<Photo> => {
	const db = await getDb();
	const tx = db.transaction([ALBUM_STORE, PHOTO_STORE, PHOTO_IMAGE_STORE], "readwrite");
	const albumStore = tx.objectStore(ALBUM_STORE);
	const photoStore = tx.objectStore(PHOTO_STORE);
	const imageStore = tx.objectStore(PHOTO_IMAGE_STORE);

	const album = (await toPromise(albumStore.get(albumId))) as Album | undefined;
	if (!album) {
		tx.abort();
		throw new Error("アルバムが見つかりません。");
	}

	const now = Date.now();
	const photoId = newId();
	const imageId = newId();

	const storedPhoto: StoredPhoto = {
		id: photoId,
		albumId,
		createdAt: now,
		updatedAt: now,
		imageCount: 1,
		coverImageId: imageId,
	};

	const image: PhotoImage = {
		id: imageId,
		photoId,
		createdAt: now,
		width: preparedPhoto.width,
		height: preparedPhoto.height,
		sizeBytes: preparedPhoto.sizeBytes,
		mimeType: preparedPhoto.mimeType,
		blob: preparedPhoto.blob,
		thumbnailBlob,
	};

	photoStore.add(storedPhoto);
	imageStore.add(image);
	albumStore.put({
		...album,
		photoCount: album.photoCount + 1,
		updatedAt: now,
	});

	await completeTx(tx);

	return {
		id: photoId,
		albumId,
		createdAt: now,
		updatedAt: now,
		imageCount: 1,
		width: image.width,
		height: image.height,
		sizeBytes: image.sizeBytes,
		mimeType: image.mimeType,
		blob: image.blob,
		thumbnailBlob: image.thumbnailBlob,
	};
};

export const addImageToPhoto = async (
	photoId: string,
	preparedPhoto: PreparedPhoto,
	thumbnailBlob?: Blob
): Promise<Photo> => {
	const db = await getDb();
	const tx = db.transaction([PHOTO_STORE, PHOTO_IMAGE_STORE], "readwrite");
	const photoStore = tx.objectStore(PHOTO_STORE);
	const imageStore = tx.objectStore(PHOTO_IMAGE_STORE);

	const storedPhoto = (await toPromise(photoStore.get(photoId))) as StoredPhoto | undefined;
	if (!storedPhoto) {
		tx.abort();
		throw new Error("写真が見つかりません。");
	}

	const now = Date.now();
	const imageId = newId();
	const image: PhotoImage = {
		id: imageId,
		photoId,
		createdAt: now,
		width: preparedPhoto.width,
		height: preparedPhoto.height,
		sizeBytes: preparedPhoto.sizeBytes,
		mimeType: preparedPhoto.mimeType,
		blob: preparedPhoto.blob,
		thumbnailBlob,
	};

	const updatedPhoto: StoredPhoto = {
		...storedPhoto,
		updatedAt: now,
		imageCount: Math.max(1, storedPhoto.imageCount || 1) + 1,
		coverImageId: imageId,
	};

	imageStore.add(image);
	photoStore.put(updatedPhoto);
	await completeTx(tx);

	return {
		id: updatedPhoto.id,
		albumId: updatedPhoto.albumId,
		createdAt: updatedPhoto.createdAt,
		updatedAt: updatedPhoto.updatedAt,
		imageCount: updatedPhoto.imageCount,
		width: image.width,
		height: image.height,
		sizeBytes: image.sizeBytes,
		mimeType: image.mimeType,
		blob: image.blob,
		thumbnailBlob: image.thumbnailBlob,
		memo: updatedPhoto.memo,
	};
};

export const deleteImageFromPhoto = async (
	photoId: string,
	imageId: string
): Promise<Photo> => {
	const db = await getDb();
	const tx = db.transaction([PHOTO_STORE, PHOTO_IMAGE_STORE], "readwrite");
	const photoStore = tx.objectStore(PHOTO_STORE);
	const imageStore = tx.objectStore(PHOTO_IMAGE_STORE);
	const imageByPhotoIndex = imageStore.index("by_photo");
	const imageByPhotoCreatedAtIndex = imageStore.index("by_photo_createdAt");

	const storedPhoto = (await toPromise(photoStore.get(photoId))) as StoredPhoto | undefined;
	if (!storedPhoto) {
		tx.abort();
		throw new Error("写真が見つかりません。");
	}

	const targetImage = (await toPromise(imageStore.get(imageId))) as PhotoImage | undefined;
	if (!targetImage || targetImage.photoId !== photoId) {
		tx.abort();
		throw new Error("削除対象の画像が見つかりません。");
	}

	const imageKeys = (await toPromise(imageByPhotoIndex.getAllKeys(photoId))) as IDBValidKey[];
	if (imageKeys.length <= 1) {
		tx.abort();
		throw new Error("最後の1枚は削除できません。");
	}

	imageStore.delete(imageId);

	const range = IDBKeyRange.bound([photoId, 0], [photoId, Number.MAX_SAFE_INTEGER]);
	const latestRemainingImage = await new Promise<PhotoImage | undefined>((resolve, reject) => {
		const request = imageByPhotoCreatedAtIndex.openCursor(range, "prev");

		request.onsuccess = () => {
			const cursor = request.result;
			if (!cursor) {
				resolve(undefined);
				return;
			}

			const image = cursor.value as PhotoImage;
			if (image.id === imageId) {
				cursor.continue();
				return;
			}

			resolve(image);
		};

		request.onerror = () => {
			reject(request.error ?? new Error("画像情報の取得に失敗しました。"));
		};
	});

	if (!latestRemainingImage) {
		tx.abort();
		throw new Error("削除後の画像情報が取得できませんでした。");
	}

	const updatedPhoto: StoredPhoto = {
		...storedPhoto,
		updatedAt: Date.now(),
		imageCount: Math.max(1, imageKeys.length - 1),
		coverImageId: latestRemainingImage.id,
	};

	photoStore.put(updatedPhoto);
	const hydrated = await hydratePhoto(updatedPhoto, imageStore, imageByPhotoCreatedAtIndex);
	await completeTx(tx);
	return hydrated;
};

export const updatePhotoMemo = async (photoId: string, memo: string): Promise<Photo> => {
	const db = await getDb();
	const tx = db.transaction([PHOTO_STORE, PHOTO_IMAGE_STORE], "readwrite");
	const photoStore = tx.objectStore(PHOTO_STORE);
	const imageStore = tx.objectStore(PHOTO_IMAGE_STORE);
	const imageByPhotoCreatedAtIndex = imageStore.index("by_photo_createdAt");

	const storedPhoto = (await toPromise(photoStore.get(photoId))) as StoredPhoto | undefined;
	if (!storedPhoto) {
		tx.abort();
		throw new Error("画像が見つかりません。");
	}

	const updatedPhoto: StoredPhoto = {
		...storedPhoto,
		memo: memo.trim() || undefined,
	};

	photoStore.put(updatedPhoto);
	const hydrated = await hydratePhoto(updatedPhoto, imageStore, imageByPhotoCreatedAtIndex);
	await completeTx(tx);
	return hydrated;
};

export const deleteAlbumWithPhotos = async (albumId: string): Promise<void> => {
	const db = await getDb();
	const tx = db.transaction([ALBUM_STORE, PHOTO_STORE, PHOTO_IMAGE_STORE], "readwrite");
	const albumStore = tx.objectStore(ALBUM_STORE);
	const photoStore = tx.objectStore(PHOTO_STORE);
	const imageStore = tx.objectStore(PHOTO_IMAGE_STORE);
	const photoIndex = photoStore.index("by_album_createdAt");
	const imageByPhotoIndex = imageStore.index("by_photo");

	const album = (await toPromise(albumStore.get(albumId))) as Album | undefined;
	if (!album) {
		tx.abort();
		throw new Error("アルバムが見つかりません。");
	}

	const range = IDBKeyRange.bound([albumId, 0], [albumId, Number.MAX_SAFE_INTEGER]);
	const photos = (await toPromise(photoIndex.getAll(range))) as StoredPhoto[];

	for (const photo of photos) {
		const imageKeys = (await toPromise(imageByPhotoIndex.getAllKeys(photo.id))) as IDBValidKey[];
		for (const imageKey of imageKeys) {
			imageStore.delete(imageKey);
		}
		photoStore.delete(photo.id);
	}

	albumStore.delete(albumId);
	await completeTx(tx);
};

export const deletePhotosFromAlbum = async (
	albumId: string,
	photoIds: string[]
): Promise<number> => {
	if (photoIds.length === 0) {
		return 0;
	}

	const db = await getDb();
	const tx = db.transaction([ALBUM_STORE, PHOTO_STORE, PHOTO_IMAGE_STORE], "readwrite");
	const albumStore = tx.objectStore(ALBUM_STORE);
	const photoStore = tx.objectStore(PHOTO_STORE);
	const imageStore = tx.objectStore(PHOTO_IMAGE_STORE);
	const imageByPhotoIndex = imageStore.index("by_photo");

	const album = (await toPromise(albumStore.get(albumId))) as Album | undefined;
	if (!album) {
		tx.abort();
		throw new Error("アルバムが見つかりません。");
	}

	let deletedCount = 0;
	for (const photoId of photoIds) {
		const photo = (await toPromise(photoStore.get(photoId))) as StoredPhoto | undefined;
		if (!photo || photo.albumId !== albumId) {
			continue;
		}

		const imageKeys = (await toPromise(imageByPhotoIndex.getAllKeys(photo.id))) as IDBValidKey[];
		for (const imageKey of imageKeys) {
			imageStore.delete(imageKey);
		}

		photoStore.delete(photoId);
		deletedCount += 1;
	}

	albumStore.put({
		...album,
		photoCount: Math.max(0, album.photoCount - deletedCount),
		updatedAt: Date.now(),
	});

	await completeTx(tx);
	return deletedCount;
};

export const movePhotosToAlbum = async (
	sourceAlbumId: string,
	targetAlbumId: string,
	photoIds: string[]
): Promise<number> => {
	if (photoIds.length === 0 || sourceAlbumId === targetAlbumId) {
		return 0;
	}

	const db = await getDb();
	const tx = db.transaction([ALBUM_STORE, PHOTO_STORE], "readwrite");
	const albumStore = tx.objectStore(ALBUM_STORE);
	const photoStore = tx.objectStore(PHOTO_STORE);

	const sourceAlbum = (await toPromise(albumStore.get(sourceAlbumId))) as Album | undefined;
	const targetAlbum = (await toPromise(albumStore.get(targetAlbumId))) as Album | undefined;
	if (!sourceAlbum || !targetAlbum) {
		tx.abort();
		throw new Error("移動先アルバムが見つかりません。");
	}

	let movedCount = 0;
	for (const photoId of photoIds) {
		const photo = (await toPromise(photoStore.get(photoId))) as StoredPhoto | undefined;
		if (!photo || photo.albumId !== sourceAlbumId) {
			continue;
		}

		photoStore.put({
			...photo,
			albumId: targetAlbumId,
		});
		movedCount += 1;
	}

	const now = Date.now();
	albumStore.put({
		...sourceAlbum,
		photoCount: Math.max(0, sourceAlbum.photoCount - movedCount),
		updatedAt: now,
	});
	albumStore.put({
		...targetAlbum,
		photoCount: targetAlbum.photoCount + movedCount,
		updatedAt: now,
	});

	await completeTx(tx);
	return movedCount;
};
