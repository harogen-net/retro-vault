import { useCallback, useEffect, useState } from "react";
import { getAlbum, getPhotoById, listImagesByPhoto } from "../lib/db";
import type { Album, Photo, PhotoImage } from "../types";

export const usePhoto = (albumId?: string, photoId?: string) => {
	const invalidParams = !albumId || !photoId;

	const [album, setAlbum] = useState<Album | null>(null);
	const [photo, setPhoto] = useState<Photo | null>(null);
	const [images, setImages] = useState<PhotoImage[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [reloadSeq, setReloadSeq] = useState(0);
	const [photoUrl, setPhotoUrl] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;

		if (invalidParams) {
			setLoading(false);
			setError("画像IDが不正です。");
			setAlbum(null);
			setPhoto(null);
			setImages([]);
			return () => {
				cancelled = true;
			};
		}

		setLoading(true);

		void Promise.all([getAlbum(albumId), getPhotoById(photoId), listImagesByPhoto(photoId)])
			.then(([albumData, photoData, photoImages]) => {
				if (cancelled) {
					return;
				}

				if (!albumData || !photoData || photoData.albumId !== albumId) {
					setError("画像が見つかりません。");
					setAlbum(null);
					setPhoto(null);
					setImages([]);
					return;
				}

				setError(null);
				setAlbum(albumData);
				setPhoto(photoData);
				setImages(photoImages);
			})
			.catch((e: unknown) => {
				if (!cancelled) {
					setError(e instanceof Error ? e.message : "画像の取得に失敗しました。");
				}
			})
			.finally(() => {
				if (!cancelled) {
					setLoading(false);
				}
			});

		return () => {
			cancelled = true;
		};
	}, [albumId, photoId, invalidParams, reloadSeq]);

	useEffect(() => {
		if (!photo?.blob) {
			setPhotoUrl(null);
			return;
		}

		const sourceBlob = photo.blob;
		const safeBlob = sourceBlob.type
			? sourceBlob
			: new Blob([sourceBlob], { type: photo.mimeType || "image/jpeg" });
		let cancelled = false;
		const reader = new FileReader();

		reader.onload = () => {
			if (cancelled) {
				return;
			}

			if (typeof reader.result === "string") {
				setPhotoUrl(reader.result);
			} else {
				setPhotoUrl(null);
			}
		};

		reader.onerror = () => {
			if (!cancelled) {
				setPhotoUrl(null);
			}
		};

		reader.readAsDataURL(safeBlob);

		return () => {
			cancelled = true;
			reader.abort();
		};
	}, [photo]);

	const applyPhotoUpdate = useCallback((updated: Photo) => {
		setPhoto(updated);
	}, []);

	const reload = useCallback(() => {
		setReloadSeq((current) => current + 1);
	}, []);

	return {
		album,
		photo,
		images,
		loading,
		error,
		photoUrl,
		invalidParams,
		setError,
		applyPhotoUpdate,
		reload,
	};
};
