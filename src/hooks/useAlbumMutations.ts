import { useCallback } from "react";
import { JPEG_QUALITY, MAX_IMAGE_EDGE, THUMBNAIL_MAX_EDGE } from "../config/constants";
import {
  addImageToPhoto,
  addPhotoToAlbum,
  createAlbum,
  deleteAlbumWithPhotos,
  deleteImageFromPhoto,
  deletePhotosFromAlbum,
  movePhotosToAlbum,
  renameAlbumTitle,
  updatePhotoMemo,
} from "../lib/db";
import { resizeImageToJpeg } from "../lib/image";

export const useAlbumMutations = () => {
	const prepareAndAddPhoto = useCallback(async (albumId: string, file: File) => {
		const [prepared, thumbnail] = await Promise.all([
			resizeImageToJpeg(file, MAX_IMAGE_EDGE, JPEG_QUALITY),
			resizeImageToJpeg(file, THUMBNAIL_MAX_EDGE, JPEG_QUALITY),
		]);

		return addPhotoToAlbum(albumId, prepared, thumbnail.blob);
	}, []);

	const createAlbumWithPhotos = useCallback(
		async (title: string, files: File[]) => {
			if (files.length === 0) {
				throw new Error("画像が選択されていません。");
			}

			const album = await createAlbum(title);
			const [firstFile, ...restFiles] = files;
			const basePhoto = await prepareAndAddPhoto(album.id, firstFile);

			for (const file of restFiles) {
				const [prepared, thumbnail] = await Promise.all([
					resizeImageToJpeg(file, MAX_IMAGE_EDGE, JPEG_QUALITY),
					resizeImageToJpeg(file, THUMBNAIL_MAX_EDGE, JPEG_QUALITY),
				]);
				await addImageToPhoto(basePhoto.id, prepared, thumbnail.blob);
			}

			return album;
		},
		[prepareAndAddPhoto]
	);

	const createAlbumWithInitialPhoto = useCallback(
		async (title: string, file: File) => {
			return createAlbumWithPhotos(title, [file]);
		},
		[createAlbumWithPhotos]
	);

	const addPhotoFromFile = useCallback(
		async (albumId: string, file: File) => {
			return prepareAndAddPhoto(albumId, file);
		},
		[prepareAndAddPhoto]
	);

	const addImageToPhotoFromFile = useCallback(async (photoId: string, file: File) => {
		const [prepared, thumbnail] = await Promise.all([
			resizeImageToJpeg(file, MAX_IMAGE_EDGE, JPEG_QUALITY),
			resizeImageToJpeg(file, THUMBNAIL_MAX_EDGE, JPEG_QUALITY),
		]);

		return addImageToPhoto(photoId, prepared, thumbnail.blob);
	}, []);

	const renameAlbum = useCallback((albumId: string, title: string) => {
		return renameAlbumTitle(albumId, title);
	}, []);

	const deleteAlbum = useCallback((albumId: string) => {
		return deleteAlbumWithPhotos(albumId);
	}, []);

	const deletePhotos = useCallback((albumId: string, photoIds: string[]) => {
		return deletePhotosFromAlbum(albumId, photoIds);
	}, []);

	const movePhotos = useCallback(
		(sourceAlbumId: string, targetAlbumId: string, photoIds: string[]) => {
			return movePhotosToAlbum(sourceAlbumId, targetAlbumId, photoIds);
		},
		[]
	);

	const savePhotoMemo = useCallback((photoId: string, memo: string) => {
		return updatePhotoMemo(photoId, memo);
	}, []);

	const deletePhotoImage = useCallback((photoId: string, imageId: string) => {
		return deleteImageFromPhoto(photoId, imageId);
	}, []);

	return {
		createAlbumWithPhotos,
		createAlbumWithInitialPhoto,
		addPhotoFromFile,
		addImageToPhotoFromFile,
		deletePhotoImage,
		renameAlbum,
		deleteAlbum,
		deletePhotos,
		movePhotos,
		savePhotoMemo,
	};
};
