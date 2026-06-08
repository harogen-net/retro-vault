import { useCallback, useEffect, useMemo, useState } from "react";
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

	const photoUrl = useMemo(() => {
		if (!photo) {
			return null;
		}

		return URL.createObjectURL(photo.blob);
	}, [photo]);

	useEffect(() => {
		return () => {
			if (photoUrl) {
				URL.revokeObjectURL(photoUrl);
			}
		};
	}, [photoUrl]);

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
