import {
  IonButton,
  IonButtons,
  IonContent,
  IonFab,
  IonFabButton,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonPage,
  IonPopover,
  IonText,
  IonTitle,
  IonToolbar,
  useIonRouter,
  useIonViewWillEnter,
} from "@ionic/react";
import { add, ellipsisHorizontal } from "ionicons/icons";
import { useCallback, useMemo, useRef, useState } from "react";
import { useAppModal } from "../components/appModalContext";
import { useAlbumMutations } from "../hooks/useAlbumMutations";
import { APP_DEPLOY_ID, APP_REVISION, APP_VERSION } from "../lib/appVersion";
import { listAlbums } from "../lib/db";
import { formatDateTime } from "../lib/format";
import type { Album } from "../types";

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

export const AlbumsPage = () => {
	const [albums, setAlbums] = useState<Album[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const fileInputRef = useRef<HTMLInputElement | null>(null);
	const captureSessionRef = useRef<CaptureSession | null>(null);
	const router = useIonRouter();
	const modal = useAppModal();
	const { createAlbumWithPhotos } = useAlbumMutations();
	const menuTriggerId = "albums-menu-trigger";

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

	const resetCaptureSession = () => {
		captureSessionRef.current = null;
	};

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
	}, [createAlbumWithPhotos, loadAlbums, router]);

	const onFabClick = () => {
		captureSessionRef.current = {
			files: [],
		};
		fileInputRef.current?.click();
	};

	const onShowVersionInfo = useCallback(async () => {
		await modal.alert({
			title: "バージョン情報",
			message: `version: ${APP_VERSION}\ndeploy: ${APP_DEPLOY_ID}\nhash: ${APP_REVISION}`,
			confirmText: "閉じる",
		});
	}, [modal]);

	const onReloadApp = useCallback(async () => {
		const shouldReload = await modal.confirm({
			title: "アプリのリロード",
			message: "最新状態を取得するためにアプリを再読み込みします。実行しますか？",
			confirmText: "リロード",
			cancelText: "キャンセル",
		});

		if (!shouldReload) {
			return;
		}

		try {
			if ("serviceWorker" in navigator) {
				const registrations = await navigator.serviceWorker.getRegistrations();
				await Promise.all(
					registrations.map(async (registration) => {
						try {
							await registration.update();
							registration.waiting?.postMessage({ type: "SKIP_WAITING" });
							await registration.unregister();
						} catch {
							// Ignore update failures and continue with reload.
						}
					})
				);
			}

			if ("caches" in window) {
				const cacheKeys = await caches.keys();
				await Promise.all(cacheKeys.map((cacheKey) => caches.delete(cacheKey)));
			}

			const reloadUrl = new URL(window.location.href);
			reloadUrl.searchParams.set("app_reload", String(Date.now()));
			window.location.assign(reloadUrl.toString());
		} catch {
			window.location.reload();
		}
	}, [modal]);

	const onCaptureNewAlbum = async (event: React.ChangeEvent<HTMLInputElement>) => {
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
	};

	return (
		<IonPage>
			<IonHeader translucent>
				<IonToolbar>
					<IonButtons slot="start">
						<IonButton id={menuTriggerId} fill="clear" aria-label="メニュー">
							<IonIcon slot="icon-only" icon={ellipsisHorizontal} />
						</IonButton>
					</IonButtons>
					<IonTitle>Retro Vault</IonTitle>
				</IonToolbar>
			</IonHeader>

			<IonContent fullscreen>
				<section className="screen ion-padding-top ion-padding-horizontal">
					<p className="page-subtitle">{albumCountLabel}</p>

					{error && <p className="error-banner">{error}</p>}

					{loading ? (
						<p className="state-text">読み込み中...</p>
					) : albums.length === 0 ? (
						<p className="state-text">右下のボタンから撮影してアルバムを作成できます。</p>
					) : (
						<IonList inset className="album-list" aria-label="アルバム一覧">
							{albums.map((album) => (
								<IonItem
									key={album.id}
									button
									detail
									onClick={() => {
										router.push(
											`/albums/${encodeURIComponent(album.id)}`,
											"forward",
											"push"
										);
									}}>
									<IonLabel className="album-row">
										<h2 className="album-title">{album.title}</h2>
										<p className="album-meta">更新: {formatDateTime(album.updatedAt)}</p>
									</IonLabel>
									<IonNote slot="end">{album.photoCount}枚</IonNote>
								</IonItem>
							))}
						</IonList>
					)}
				</section>

				<IonFab slot="fixed" vertical="bottom" horizontal="end">
					<IonFabButton
						onClick={onFabClick}
						disabled={busy}
						aria-label="撮影して新規アルバムを作成">
						{busy ? <IonText>...</IonText> : <IonIcon icon={add} />}
					</IonFabButton>
				</IonFab>
			</IonContent>

			<input
				ref={fileInputRef}
				hidden
				className="visually-hidden"
				type="file"
				multiple
				accept="image/*"
				onChange={onCaptureNewAlbum}
			/>

			<IonPopover trigger={menuTriggerId} dismissOnSelect className="album-menu-popover">
				<IonList className="album-menu-list" lines="none">
					<IonItem
						button
						detail={false}
						onClick={() => {
							void onShowVersionInfo();
						}}>
						バージョン情報
					</IonItem>
					<IonItem
						button
						detail={false}
						onClick={() => {
							void onReloadApp();
						}}>
						アプリのリロード
					</IonItem>
				</IonList>
			</IonPopover>
		</IonPage>
	);
};
