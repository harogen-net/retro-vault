import { useIonRouter, useIonViewWillEnter } from "@ionic/react";
import { useCallback, useRef, useState, type ChangeEvent } from "react";
import { useAppModal } from "../components/appModalContext";
import { exportAlbumToZip, getAlbum, listAlbums, listPhotosByAlbum } from "../lib/db";
import { formatDateTime } from "../lib/format";
import type { Album, Photo } from "../types";
import { useAlbumMutations } from "./useAlbumMutations";
import { useBlobDataUrlList } from "./useBlobDataUrlList";

export const useAlbumDetailPageController = (albumId?: string) => {
	const [album, setAlbum] = useState<Album | null>(null);
	const [photos, setPhotos] = useState<Photo[]>([]);
	const [loading, setLoading] = useState(true);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [selectionMode, setSelectionMode] = useState(false);
	const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([]);
	const [albumOptions, setAlbumOptions] = useState<Album[]>([]);
	const [moveSheetOpen, setMoveSheetOpen] = useState(false);
	const fileInputRef = useRef<HTMLInputElement | null>(null);
	const router = useIonRouter();
	const modal = useAppModal();
	const menuTriggerId = "album-detail-menu-trigger";
	const { addPhotoFromFile, deleteAlbum, deletePhotos, movePhotos, renameAlbum } =
		useAlbumMutations();

	const photoUrls = useBlobDataUrlList({
		items: photos,
		getBlob: useCallback((photo: Photo) => photo.thumbnailBlob, []),
		getMimeType: useCallback((photo: Photo) => photo.mimeType, []),
		mapResult: useCallback(
			(photo: Photo, src: string) => ({
				id: photo.id,
				src,
				createdAt: photo.createdAt,
				memo: photo.memo,
			}),
			[]
		),
	});

	const backToAlbums = useCallback(() => {
		if (router.canGoBack()) {
			router.goBack();
			return;
		}

		router.push("/", "root", "replace");
	}, [router]);

	const fetchAlbumData = useCallback(async (id: string) => {
		const [albumData, photoData] = await Promise.all([getAlbum(id), listPhotosByAlbum(id)]);

		if (!albumData) {
			throw new Error("アルバムが見つかりません。");
		}

		return { albumData, photoData };
	}, []);

	const loadAlbum = useCallback(
		async (id: string, showLoading: boolean) => {
			if (showLoading) {
				setLoading(true);
			}

			try {
				const { albumData, photoData } = await fetchAlbumData(id);
				setAlbum(albumData);
				setPhotos(photoData);
				setError(null);
			} catch (e) {
				setAlbum(null);
				setPhotos([]);
				setError(e instanceof Error ? e.message : "アルバム詳細の取得に失敗しました。");
			} finally {
				if (showLoading) {
					setLoading(false);
				}
			}
		},
		[fetchAlbumData]
	);

	useIonViewWillEnter(() => {
		if (!albumId) {
			setAlbum(null);
			setPhotos([]);
			setError("アルバムIDが不正です。");
			setLoading(false);
			return;
		}

		void loadAlbum(albumId, true);
	});

	const onAddPhotoClick = useCallback(() => {
		fileInputRef.current?.click();
	}, []);

	const onExportAlbum = useCallback(async () => {
		if (!album) {
			return;
		}

		try {
			setBusy(true);
			setError(null);
			const zipBlob = await exportAlbumToZip(album.id);
			const downloadName = `${album.title.replace(/[\\/:*?"<>|]/g, "_") || "album"}.retro-vault.v1.zip`;
			const url = URL.createObjectURL(zipBlob);
			const link = document.createElement("a");
			link.href = url;
			link.download = downloadName;
			document.body.append(link);
			link.click();
			link.remove();
			URL.revokeObjectURL(url);
		} catch (e) {
			setError(e instanceof Error ? e.message : "エクスポートに失敗しました。");
		} finally {
			setBusy(false);
		}
	}, [album]);

	const onRenameAlbum = useCallback(async () => {
		if (!album) {
			return;
		}

		const title = (
			await modal.prompt({
				title: "アルバム名変更",
				message: "新しいアルバム名を入力してください。",
				defaultValue: album.title,
				placeholder: "アルバム名",
				confirmText: "変更",
				cancelText: "キャンセル",
			})
		)?.trim();
		if (!title || title === album.title) {
			return;
		}

		try {
			setBusy(true);
			setError(null);
			const updatedAlbum = await renameAlbum(album.id, title);
			setAlbum(updatedAlbum);
		} catch (e) {
			setError(e instanceof Error ? e.message : "アルバム名の変更に失敗しました。");
		} finally {
			setBusy(false);
		}
	}, [album, modal, renameAlbum]);

	const onAddPhoto = useCallback(
		async (event: ChangeEvent<HTMLInputElement>) => {
			const [file] = event.target.files ?? [];
			event.target.value = "";

			if (!file || !albumId) {
				return;
			}

			try {
				setBusy(true);
				setError(null);
				await addPhotoFromFile(albumId, file);
				await loadAlbum(albumId, false);
			} catch (e) {
				setError(e instanceof Error ? e.message : "画像追加に失敗しました。");
			} finally {
				setBusy(false);
			}
		},
		[addPhotoFromFile, albumId, loadAlbum]
	);

	const onToggleSelectionMode = useCallback(() => {
		setSelectionMode((current) => {
			if (current) {
				setSelectedPhotoIds([]);
			}

			return !current;
		});
	}, []);

	const onSelectPhoto = useCallback((photoId: string) => {
		setSelectedPhotoIds((current) => {
			if (current.includes(photoId)) {
				return current.filter((id) => id !== photoId);
			}

			return [...current, photoId];
		});
	}, []);

	const onDeleteSelected = useCallback(async () => {
		if (!album || selectedPhotoIds.length === 0) {
			return;
		}

		const ok = await modal.confirm({
			title: "画像を削除",
			message: `選択中の${selectedPhotoIds.length}件を削除しますか？`,
			confirmText: "削除",
			cancelText: "キャンセル",
		});
		if (!ok) {
			return;
		}

		try {
			setBusy(true);
			setError(null);
			await deletePhotos(album.id, selectedPhotoIds);
			await loadAlbum(album.id, false);
			setSelectedPhotoIds([]);
			setSelectionMode(false);
		} catch (e) {
			setError(e instanceof Error ? e.message : "画像削除に失敗しました。");
		} finally {
			setBusy(false);
		}
	}, [album, deletePhotos, loadAlbum, modal, selectedPhotoIds]);

	const onOpenMoveSheet = useCallback(async () => {
		if (!album || selectedPhotoIds.length === 0) {
			return;
		}

		try {
			const allAlbums = await listAlbums();
			const candidates = allAlbums.filter((item) => item.id !== album.id);
			if (candidates.length === 0) {
				setError("移動先のアルバムがありません。");
				return;
			}

			setAlbumOptions(candidates);
			setMoveSheetOpen(true);
		} catch (e) {
			setError(e instanceof Error ? e.message : "移動先アルバムの取得に失敗しました。");
		}
	}, [album, selectedPhotoIds.length]);

	const onMoveSelected = useCallback(
		async (targetAlbumId: string) => {
			if (!album || selectedPhotoIds.length === 0) {
				return;
			}

			try {
				setBusy(true);
				setError(null);
				await movePhotos(album.id, targetAlbumId, selectedPhotoIds);
				await loadAlbum(album.id, false);
				setSelectedPhotoIds([]);
				setSelectionMode(false);
			} catch (e) {
				setError(e instanceof Error ? e.message : "画像移動に失敗しました。");
			} finally {
				setBusy(false);
			}
		},
		[album, loadAlbum, movePhotos, selectedPhotoIds]
	);

	const onDeleteAlbum = useCallback(async () => {
		if (!album) {
			return;
		}

		const ok = await modal.confirm({
			title: "アルバム削除",
			message: `「${album.title}」を削除します。紐づく画像もすべて削除されます。`,
			confirmText: "削除",
			cancelText: "キャンセル",
		});
		if (!ok) {
			return;
		}

		try {
			setBusy(true);
			setError(null);
			await deleteAlbum(album.id);
			backToAlbums();
		} catch (e) {
			setError(e instanceof Error ? e.message : "アルバム削除に失敗しました。");
		} finally {
			setBusy(false);
		}
	}, [album, backToAlbums, deleteAlbum, modal]);

	const onShowAlbumInfo = useCallback(async () => {
		if (!album) {
			return;
		}

		await modal.alert({
			title: "アルバム詳細情報",
			message: `作成: ${formatDateTime(album.createdAt)}\n更新: ${formatDateTime(album.updatedAt)}\n記録数: ${album.photoCount}`,
			confirmText: "閉じる",
		});
	}, [album, modal]);

	const onOpenPhoto = useCallback(
		(photoId: string) => {
			if (!album) {
				return;
			}

			router.push(
				`/albums/${encodeURIComponent(album.id)}/photos/${encodeURIComponent(photoId)}`,
				"forward",
				"push"
			);
		},
		[album, router]
	);

	return {
		album,
		loading,
		busy,
		error,
		selectionMode,
		selectedPhotoIds,
		albumOptions,
		moveSheetOpen,
		photoUrls,
		fileInputRef,
		menuTriggerId,
		backToAlbums,
		onAddPhotoClick,
		onExportAlbum,
		onRenameAlbum,
		onAddPhoto,
		onToggleSelectionMode,
		onSelectPhoto,
		onDeleteSelected,
		onOpenMoveSheet,
		onMoveSelected,
		onDeleteAlbum,
		onShowAlbumInfo,
		onOpenPhoto,
		onDismissMoveSheet: () => setMoveSheetOpen(false),
	};
};
