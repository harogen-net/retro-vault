import {
	IonActionSheet,
	IonButton,
	IonButtons,
	IonCol,
	IonContent,
	IonFab,
	IonFabButton,
	IonGrid,
	IonHeader,
	IonIcon,
	IonItem,
	IonList,
	IonPage,
	IonPopover,
	IonRow,
	IonTitle,
	IonToolbar,
	useIonRouter,
	useIonViewWillEnter,
} from "@ionic/react";
import { add, checkboxOutline, checkmarkCircle, chevronBack, ellipsisHorizontal } from "ionicons/icons";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useAppModal } from "../components/appModalContext";
import { useAlbumMutations } from "../hooks/useAlbumMutations";
import { exportAlbumToZip, getAlbum, listAlbums, listPhotosByAlbum } from "../lib/db";
import { formatDateTime } from "../lib/format";
import type { Album, Photo } from "../types";

type AlbumDetailBodyProps = {
	loading: boolean;
	album: Album | null;
	error: string | null;
	photoUrls: Array<{ id: string; src: string; createdAt: number; memo: string | undefined }>;
	selectionMode: boolean;
	selectedPhotoIds: string[];
	onBackToAlbums: () => void;
	onSelectPhoto: (photoId: string) => void;
	onOpenPhoto: (photoId: string) => void;
};

type AlbumDetailOverlayProps = {
	hasAlbum: boolean;
	busy: boolean;
	selectionMode: boolean;
	menuTriggerId: string;
	moveSheetOpen: boolean;
	albumOptions: Album[];
	onAddPhotoClick: () => void;
	onRenameAlbum: () => Promise<void>;
	onShowAlbumInfo: () => Promise<void>;
	onExportAlbum: () => Promise<void>;
	onDeleteAlbum: () => Promise<void>;
	onMoveSelected: (targetAlbumId: string) => Promise<void>;
	onDismissMoveSheet: () => void;
};

type AlbumDetailFooterProps = {
	hasAlbum: boolean;
	selectionMode: boolean;
	busy: boolean;
	selectedPhotoIds: string[];
	onOpenMoveSheet: () => Promise<void>;
	onDeleteSelected: () => Promise<void>;
	onToggleSelectionMode: () => void;
};

const AlbumDetailBody = ({
	loading,
	album,
	error,
	photoUrls,
	selectionMode,
	selectedPhotoIds,
	onBackToAlbums,
	onSelectPhoto,
	onOpenPhoto,
}: AlbumDetailBodyProps) => {
	if (loading) {
		return (
			<section className="screen ion-padding">
				<p className="state-text">読み込み中...</p>
			</section>
		);
	}

	if (!album) {
		return (
			<section className="screen ion-padding">
				<p className="error-banner">{error ?? "アルバムが見つかりません。"}</p>
				<button type="button" className="back-link back-button" onClick={onBackToAlbums}>
					一覧へ戻る
				</button>
			</section>
		);
	}

	return (
		<section className={`screen ion-padding ${selectionMode ? "screen-selection-mode" : ""}`}>
			{error && <p className="error-banner">{error}</p>}

			{photoUrls.length === 0 ? (
				<p className="state-text">まだ画像がありません。上のボタンから追加できます。</p>
			) : (
				<IonGrid className="tiles" aria-label="撮影画像一覧">
					<IonRow>
						{photoUrls.map((photo) => (
							<IonCol key={photo.id} size="6" sizeMd="4" sizeLg="3">
								<button
									type="button"
									className={`tile-button ${selectedPhotoIds.includes(photo.id) ? "is-selected" : ""}`}
									onClick={() => {
										if (selectionMode) {
											onSelectPhoto(photo.id);
											return;
										}

										onOpenPhoto(photo.id);
									}}>
									<article className="tile">
										<img src={photo.src} alt="撮影画像" loading="lazy" decoding="async" />
										<p>{formatDateTime(photo.createdAt)}</p>
										{photo.memo && <p className="tile-memo">{photo.memo}</p>}
										{selectionMode && (
											<span className="tile-checkmark" aria-hidden="true">
												<IonIcon icon={checkmarkCircle} />
											</span>
										)}
									</article>
								</button>
							</IonCol>
						))}
					</IonRow>
				</IonGrid>
			)}
		</section>
	);
};

const AlbumDetailOverlay = ({
	hasAlbum,
	busy,
	selectionMode,
	menuTriggerId,
	moveSheetOpen,
	albumOptions,
	onAddPhotoClick,
	onRenameAlbum,
	onShowAlbumInfo,
	onExportAlbum,
	onDeleteAlbum,
	onMoveSelected,
	onDismissMoveSheet,
}: AlbumDetailOverlayProps) => {
	if (!hasAlbum) {
		return null;
	}

	return (
		<>
			{!selectionMode && (
				<IonFab slot="fixed" vertical="bottom" horizontal="end">
					<IonFabButton onClick={onAddPhotoClick} disabled={busy} aria-label="画像を追加">
						{busy ? "..." : <IonIcon icon={add} />}
					</IonFabButton>
				</IonFab>
			)}

			<IonPopover
				trigger={menuTriggerId}
				triggerAction="click"
				side="bottom"
				alignment="end"
				showBackdrop={false}
				dismissOnSelect
				className="album-menu-popover">
				<IonList className="album-menu-list">
					<IonItem button onClick={() => void onShowAlbumInfo()}>
						詳細情報
					</IonItem>
					<IonItem button onClick={() => void onRenameAlbum()}>
						アルバム名変更
					</IonItem>
					<IonItem button onClick={() => void onExportAlbum()}>
						エクスポート
					</IonItem>
					<IonItem button lines="none" onClick={() => void onDeleteAlbum()}>
						アルバム削除
					</IonItem>
				</IonList>
			</IonPopover>

			<IonActionSheet
				isOpen={moveSheetOpen}
				onDidDismiss={onDismissMoveSheet}
				header="移動先アルバムを選択"
				buttons={[
					...albumOptions.map((option) => ({
						text: option.title,
						handler: () => {
							void onMoveSelected(option.id);
						},
					})),
					{
						text: "キャンセル",
						role: "cancel" as const,
					},
				]}
			/>
		</>
	);
};

const AlbumDetailFooter = ({
	hasAlbum,
	selectionMode,
	busy,
	selectedPhotoIds,
	onOpenMoveSheet,
	onDeleteSelected,
	onToggleSelectionMode,
}: AlbumDetailFooterProps) => {
	if (!hasAlbum || !selectionMode) {
		return null;
	}

	return (
		<div className="selection-mode-bar" role="region" aria-label="選択モード操作">
			<div className="selection-actions">
				<span>{selectedPhotoIds.length}件選択中</span>
				<div className="selection-actions-buttons">
					<IonButton
						fill="clear"
						onClick={() => void onOpenMoveSheet()}
						disabled={busy || selectedPhotoIds.length === 0}>
						移動
					</IonButton>
					<IonButton
						fill="clear"
						color="danger"
						onClick={() => void onDeleteSelected()}
						disabled={busy || selectedPhotoIds.length === 0}>
						削除
					</IonButton>
					<IonButton fill="clear" onClick={onToggleSelectionMode} disabled={busy}>
						完了
					</IonButton>
				</div>
			</div>
		</div>
	);
};

export const AlbumDetailPage = () => {
	const { albumId } = useParams<{ albumId: string }>();
	const [album, setAlbum] = useState<Album | null>(null);
	const [photos, setPhotos] = useState<Photo[]>([]);
	const [loading, setLoading] = useState(true);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [selectionMode, setSelectionMode] = useState(false);
	const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([]);
	const [albumOptions, setAlbumOptions] = useState<Album[]>([]);
	const [moveSheetOpen, setMoveSheetOpen] = useState(false);
	const [photoUrls, setPhotoUrls] = useState<
		Array<{ id: string; src: string; createdAt: number; memo: string | undefined }>
	>([]);
	const fileInputRef = useRef<HTMLInputElement | null>(null);
	const router = useIonRouter();
	const menuTriggerId = "album-detail-menu-trigger";
	const modal = useAppModal();
	const { addPhotoFromFile, deleteAlbum, deletePhotos, movePhotos, renameAlbum } =
		useAlbumMutations();

	const backToAlbums = () => {
		if (router.canGoBack()) {
			router.goBack();
			return;
		}

		router.push("/", "root", "replace");
	};

	const fetchAlbumData = useCallback(async (id: string) => {
		const [albumData, photoData] = await Promise.all([getAlbum(id), listPhotosByAlbum(id)]);

		if (!albumData) {
			throw new Error("アルバムが見つかりません。");
		}

		return {
			albumData,
			photoData,
		};
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

	const blobToDataUrl = useCallback((blob: Blob, mimeType?: string) => {
		return new Promise<string>((resolve, reject) => {
			const safeBlob = blob.type ? blob : new Blob([blob], { type: mimeType || "image/jpeg" });
			const reader = new FileReader();

			reader.onload = () => {
				if (typeof reader.result === "string") {
					resolve(reader.result);
					return;
				}

				reject(new Error("サムネイル変換に失敗しました。"));
			};

			reader.onerror = () => reject(reader.error ?? new Error("サムネイル変換に失敗しました。"));
			reader.readAsDataURL(safeBlob);
		});
	}, []);

	useEffect(() => {
		let cancelled = false;

		const loadPhotoUrls = async () => {
			const next: Array<{ id: string; src: string; createdAt: number; memo: string | undefined }> = [];

			for (const photo of photos) {
				if (!photo.thumbnailBlob) {
					continue;
				}

				try {
					const src = await blobToDataUrl(photo.thumbnailBlob, photo.mimeType);
					next.push({
						id: photo.id,
						src,
						createdAt: photo.createdAt,
						memo: photo.memo,
					});
				} catch {
					// Skip broken image while keeping list rendering.
				}
			}

			if (!cancelled) {
				setPhotoUrls(next);
			}
		};

		void loadPhotoUrls();

		return () => {
			cancelled = true;
		};
	}, [photos, blobToDataUrl]);

	const onAddPhotoClick = () => {
		fileInputRef.current?.click();
	};

	const onExportAlbum = async () => {
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
	};

	const onRenameAlbum = async () => {
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
	};

	const onAddPhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
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
	};

	const toggleSelectionMode = () => {
		setSelectionMode((current) => {
			if (current) {
				setSelectedPhotoIds([]);
			}

			return !current;
		});
	};

	const toggleSelectPhoto = (photoId: string) => {
		setSelectedPhotoIds((current) => {
			if (current.includes(photoId)) {
				return current.filter((id) => id !== photoId);
			}

			return [...current, photoId];
		});
	};

	const onDeleteSelected = async () => {
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
	};

	const onOpenMoveSheet = async () => {
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
	};

	const onMoveSelected = async (targetAlbumId: string) => {
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
	};

	const onDeleteAlbum = async () => {
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
	};

	const onShowAlbumInfo = async () => {
		if (!album) {
			return;
		}

		await modal.alert({
			title: "アルバム詳細情報",
			message: `作成: ${formatDateTime(album.createdAt)}\n更新: ${formatDateTime(album.updatedAt)}\n記録数: ${album.photoCount}`,
			confirmText: "閉じる",
		});
	};

	const hasAlbum = !!album;
	const onOpenPhoto = (photoId: string) => {
		if (!album) {
			return;
		}

		router.push(
			`/albums/${encodeURIComponent(album.id)}/photos/${encodeURIComponent(photoId)}`,
			"forward",
			"push"
		);
	};

	return (
		<IonPage>
			{hasAlbum && (
				<IonHeader translucent>
					<IonToolbar>
						<IonButtons slot="start">
							<IonButton fill="clear" onClick={backToAlbums} aria-label="戻る">
								<IonIcon slot="icon-only" icon={chevronBack} />
							</IonButton>
						</IonButtons>
						<IonTitle>{`${album.title}(${album.photoCount})`}</IonTitle>
						<IonButtons slot="end">
							<IonButton
								fill="clear"
								onClick={toggleSelectionMode}
								disabled={busy}
								aria-label={selectionMode ? "選択モード終了" : "選択モード開始"}>
								<IonIcon slot="icon-only" icon={checkboxOutline} />
							</IonButton>
							<IonButton id={menuTriggerId} fill="clear" disabled={busy}>
								<IonIcon slot="icon-only" icon={ellipsisHorizontal} />
							</IonButton>
						</IonButtons>
					</IonToolbar>
				</IonHeader>
			)}

			<IonContent fullscreen>
				<AlbumDetailBody
					loading={loading}
					album={album}
					error={error}
					photoUrls={photoUrls}
					selectionMode={selectionMode}
					selectedPhotoIds={selectedPhotoIds}
					onBackToAlbums={backToAlbums}
					onSelectPhoto={toggleSelectPhoto}
					onOpenPhoto={onOpenPhoto}
				/>

				<AlbumDetailOverlay
					hasAlbum={hasAlbum}
					busy={busy}
					selectionMode={selectionMode}
					menuTriggerId={menuTriggerId}
					moveSheetOpen={moveSheetOpen}
					albumOptions={albumOptions}
					onAddPhotoClick={onAddPhotoClick}
					onRenameAlbum={onRenameAlbum}
					onShowAlbumInfo={onShowAlbumInfo}
					onExportAlbum={onExportAlbum}
					onDeleteAlbum={onDeleteAlbum}
					onMoveSelected={onMoveSelected}
					onDismissMoveSheet={() => setMoveSheetOpen(false)}
				/>
			</IonContent>

			<AlbumDetailFooter
				hasAlbum={hasAlbum}
				selectionMode={selectionMode}
				busy={busy}
				selectedPhotoIds={selectedPhotoIds}
				onOpenMoveSheet={onOpenMoveSheet}
				onDeleteSelected={onDeleteSelected}
				onToggleSelectionMode={toggleSelectionMode}
			/>

			<input
				ref={fileInputRef}
				hidden
				className="visually-hidden"
				type="file"
				accept="image/*"
				onChange={onAddPhoto}
			/>
		</IonPage>
	);
};
