import { useIonRouter, useIonViewWillEnter } from "@ionic/react";
import { useCallback, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useAppModal } from "../components/appModalContext";
import { listAlbums } from "../lib/db";
import type { Album } from "../types";
import { useAlbumMutations } from "./useAlbumMutations";

type CaptureSession = {
	files: File[];
};

const defaultAlbumTitle = (): string => {
	const d = new Date();
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	const hh = String(d.getHours()).padStart(2, "0");
	const mm = String(d.getMinutes()).padStart(2, "0");
	return `アルバム ${y}${m}${day}-${hh}${mm}`;
};

export const useAlbumsPageController = () => {
	const [albums, setAlbums] = useState<Album[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const fileInputRef = useRef<HTMLInputElement | null>(null);
	const captureSessionRef = useRef<CaptureSession | null>(null);
	const router = useIonRouter();
	const modal = useAppModal();
	const { createAlbumWithPhotos } = useAlbumMutations();

	const albumCountLabel = useMemo(() => {
		if (albums.length === 0) {
			return "アルバムはまだありません";
		}

		return `${albums.length}件のアルバム`;
	}, [albums.length]);

	const loadAlbums = useCallback(async (showLoading: boolean) => {
		if (showLoading) {
			setLoading(true);
		}

		try {
			const data = await listAlbums();
			setAlbums(data);
			setError(null);
		} catch (e) {
			setError(e instanceof Error ? e.message : "アルバム一覧の取得に失敗しました。");
		} finally {
			if (showLoading) {
				setLoading(false);
			}
		}
	}, []);

	useIonViewWillEnter(() => {
		void loadAlbums(true);
	});

	const resetCaptureSession = useCallback(() => {
		captureSessionRef.current = null;
	}, []);

	const finalizeCaptureSession = useCallback(async () => {
		const session = captureSessionRef.current;
		if (!session || session.files.length === 0) {
			resetCaptureSession();
			return;
		}

		const suggestedName = defaultAlbumTitle();
		const enteredName = await modal.prompt({
			title: "新規アルバム",
			message: "アルバム名を入力してください。",
			defaultValue: "",
			placeholder: suggestedName,
			confirmText: "作成",
			cancelText: "キャンセル",
		});

		if (enteredName === null) {
			resetCaptureSession();
			return;
		}

		const albumName = enteredName === "" ? suggestedName : enteredName;

		try {
			setBusy(true);
			setError(null);

			const album = await createAlbumWithPhotos(albumName, session.files);
			if (!album.id) {
				throw new Error("アルバムIDの生成に失敗しました。");
			}

			await loadAlbums(false);
			resetCaptureSession();
			router.push(`/albums/${encodeURIComponent(album.id)}`, "forward", "push");
		} catch (e) {
			setError(e instanceof Error ? e.message : "アルバム作成に失敗しました。");
			resetCaptureSession();
		} finally {
			setBusy(false);
		}
	}, [createAlbumWithPhotos, loadAlbums, modal, resetCaptureSession, router]);

	const onFabClick = useCallback(() => {
		captureSessionRef.current = { files: [] };
		fileInputRef.current?.click();
	}, []);

	const onOpenAlbum = useCallback(
		(id: string) => {
			router.push(`/albums/${encodeURIComponent(id)}`, "forward", "push");
		},
		[router]
	);

	const onCaptureNewAlbum = useCallback(
		async (event: ChangeEvent<HTMLInputElement>) => {
			const files = Array.from(event.target.files ?? []);
			event.target.value = "";

			const session = captureSessionRef.current;
			if (!session) {
				return;
			}

			if (files.length === 0 && session.files.length === 0) {
				resetCaptureSession();
				return;
			}

			if (files.length > 0) {
				session.files.push(...files);
			}

			if (files.length > 1 || files.length === 0) {
				await finalizeCaptureSession();
				return;
			}

			const shouldCreate = await modal.confirm({
				title: "アルバム作成",
				message: `${session.files.length}枚を撮影しました。この内容で作成しますか？`,
				confirmText: "作成する",
				cancelText: "続けて撮影",
				onCancel: () => {
					fileInputRef.current?.click();
				},
			});

			if (!shouldCreate) {
				return;
			}

			await finalizeCaptureSession();
		},
		[finalizeCaptureSession, modal, resetCaptureSession]
	);

	return {
		albumCountLabel,
		albums,
		loading,
		error,
		busy,
		fileInputRef,
		onFabClick,
		onOpenAlbum,
		onCaptureNewAlbum,
	};
};
