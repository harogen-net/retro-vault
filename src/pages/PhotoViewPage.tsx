import {
  IonButton,
  IonButtons,
  IonContent,
  IonFab,
  IonFabButton,
  IonHeader,
  IonIcon,
  IonItem,
  IonList,
  IonPage,
  IonPopover,
  IonToolbar,
  useIonRouter
} from "@ionic/react";
import { chevronBack, createOutline, ellipsisHorizontal } from "ionicons/icons";
import { useCallback, useEffect, useRef, useState, type SyntheticEvent, type TouchEvent } from "react";
import { useParams } from "react-router-dom";
import { useAppModal } from "../components/appModalContext";
import { useAlbumMutations } from "../hooks/useAlbumMutations";
import { usePhoto } from "../hooks/usePhoto";

export const PhotoViewPage = () => {
	const MIN_ZOOM = 1;
	const MAX_ZOOM = 4;
	const ZOOM_STEP = 0.5;
	const DOUBLE_TAP_ZOOM = 2;
	const DOUBLE_TAP_MS = 280;

	const { albumId, photoId } = useParams<{ albumId: string; photoId: string }>();
	const router = useIonRouter();
	const [busy, setBusy] = useState(false);
	const [currentIndex, setCurrentIndex] = useState(0);
	const [zoomScale, setZoomScale] = useState(MIN_ZOOM);
	const [pan, setPan] = useState({ x: 0, y: 0 });
	const [displayImages, setDisplayImages] = useState<Array<{ id: string; src: string }>>([]);
	const fileInputRef = useRef<HTMLInputElement | null>(null);
	const carouselRef = useRef<HTMLDivElement | null>(null);
	const pinchRef = useRef<{ active: boolean; startDistance: number; startScale: number }>({
		active: false,
		startDistance: 0,
		startScale: MIN_ZOOM,
	});
	const panRef = useRef<{
		active: boolean;
		startX: number;
		startY: number;
		startPanX: number;
		startPanY: number;
	}>({
		active: false,
		startX: 0,
		startY: 0,
		startPanX: 0,
		startPanY: 0,
	});
	const lastTapRef = useRef<{ time: number; x: number; y: number }>({
		time: 0,
		x: 0,
		y: 0,
	});
	const imageNaturalSizeRef = useRef<Record<string, { width: number; height: number }>>({});
	const menuTriggerId = "photo-view-menu-trigger";
	const modal = useAppModal();
	const { savePhotoMemo, addImageToPhotoFromFile, deletePhotoImage } = useAlbumMutations();
	const {
		photo,
		images,
		loading,
		error,
		photoUrl,
		invalidParams,
		setError,
		applyPhotoUpdate,
		reload,
	} = usePhoto(albumId, photoId);

	const toSafeBlob = (blob: Blob, mimeType?: string) => {
		if (blob.type) {
			return blob;
		}

		return new Blob([blob], { type: mimeType || "image/jpeg" });
	};

	const toDataUrl = useCallback((blob: Blob, mimeType?: string) => {
		return new Promise<string>((resolve, reject) => {
			const safeBlob = toSafeBlob(blob, mimeType);
			const reader = new FileReader();

			reader.onload = () => {
				if (typeof reader.result === "string") {
					resolve(reader.result);
					return;
				}

				reject(new Error("画像変換に失敗しました。"));
			};

			reader.onerror = () => {
				reject(reader.error ?? new Error("画像変換に失敗しました。"));
			};
			reader.readAsDataURL(safeBlob);
		});
	}, []);

	const clampZoom = useCallback(
		(value: number) => {
			return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Number(value.toFixed(2))));
		},
		[MAX_ZOOM, MIN_ZOOM]
	);

	const getPanBounds = useCallback(
		(scale: number) => {
			if (scale <= MIN_ZOOM || !carouselRef.current || displayImages.length === 0) {
				return { maxX: 0, maxY: 0 };
			}

			const containerWidth = carouselRef.current.clientWidth;
			const containerHeight = carouselRef.current.clientHeight;
			const current = displayImages[currentIndex];
			if (!current) {
				return { maxX: 0, maxY: 0 };
			}

			const natural = imageNaturalSizeRef.current[current.id];
			if (!natural || natural.width <= 0 || natural.height <= 0) {
				return { maxX: 0, maxY: 0 };
			}

			const imageRatio = natural.width / natural.height;
			const containerRatio = containerWidth / Math.max(containerHeight, 1);

			let baseWidth = containerWidth;
			let baseHeight = containerHeight;
			if (imageRatio > containerRatio) {
				baseHeight = containerWidth / imageRatio;
			} else {
				baseWidth = containerHeight * imageRatio;
			}

			const scaledWidth = baseWidth * scale;
			const scaledHeight = baseHeight * scale;
			return {
				maxX: Math.max(0, (scaledWidth - baseWidth) / 2),
				maxY: Math.max(0, (scaledHeight - baseHeight) / 2),
			};
		},
		[currentIndex, displayImages, MIN_ZOOM]
	);

	const clampPan = useCallback(
		(nextPan: { x: number; y: number }, scale: number) => {
			const bounds = getPanBounds(scale);
			return {
				x: Math.max(-bounds.maxX, Math.min(bounds.maxX, nextPan.x)),
				y: Math.max(-bounds.maxY, Math.min(bounds.maxY, nextPan.y)),
			};
		},
		[getPanBounds]
	);

	const touchDistance = (touches: TouchEvent<HTMLImageElement>["touches"]) => {
		if (touches.length < 2) {
			return 0;
		}

		const dx = touches[0].clientX - touches[1].clientX;
		const dy = touches[0].clientY - touches[1].clientY;
		return Math.hypot(dx, dy);
	};

	useEffect(() => {
		let cancelled = false;

		const loadDisplayImages = async () => {
			if (images.length === 0) {
				if (!cancelled) {
					const fallback = photoUrl ? [{ id: photo?.id ?? "fallback-photo", src: photoUrl }] : [];
					setDisplayImages(fallback);
				}
				return;
			}

			const next: Array<{ id: string; src: string }> = [];
			for (const image of images) {
				if (!image.blob) {
					continue;
				}

				try {
					const src = await toDataUrl(image.blob, image.mimeType);
					next.push({ id: image.id, src });
				} catch {
					// Skip broken image while rendering others.
				}
			}

			if (!cancelled) {
				setDisplayImages(next);
			}
		};

		void loadDisplayImages();

		return () => {
			cancelled = true;
		};
	}, [images, photo?.id, photoUrl, toDataUrl]);

	const backToAlbum = () => {
		if (router.canGoBack()) {
			router.goBack();
			return;
		}

		if (albumId) {
			router.push(`/albums/${albumId}`, "root", "replace");
			return;
		}

		router.push("/", "root", "replace");
	};

	const onEditMemo = async () => {
		if (!photo) {
			return;
		}

		const value = await modal.prompt({
			title: "メモ",
			defaultValue: photo.memo ?? "",
			placeholder: "メモを入力...",
			confirmText: "保存",
			cancelText: "キャンセル",
		});

		if (value === null) {
			return;
		}

		try {
			setBusy(true);
			const updated = await savePhotoMemo(photo.id, value);
			applyPhotoUpdate(updated);
		} catch (e) {
			setError(e instanceof Error ? e.message : "メモの保存に失敗しました。");
		} finally {
			setBusy(false);
		}
	};

	const onAddImageClick = () => {
		fileInputRef.current?.click();
	};

	const onAddImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
		const [file] = event.target.files ?? [];
		event.target.value = "";

		if (!file || !photo) {
			return;
		}

		try {
			setBusy(true);
			await addImageToPhotoFromFile(photo.id, file);
			setCurrentIndex(0);
			reload();
		} catch (e) {
			setError(e instanceof Error ? e.message : "画像の追加に失敗しました。");
		} finally {
			setBusy(false);
		}
	};

	const onDeleteCurrentImage = async () => {
		if (!photo || displayImages.length === 0) {
			return;
		}

		const target = displayImages[Math.min(currentIndex, displayImages.length - 1)];
		if (!target) {
			return;
		}

		const ok = await modal.confirm({
			title: "画像を削除",
			message: "表示中の画像を削除しますか？",
			confirmText: "削除",
			cancelText: "キャンセル",
		});
		if (!ok) {
			return;
		}

		try {
			setBusy(true);
			setError(null);
			const updated = await deletePhotoImage(photo.id, target.id);
			applyPhotoUpdate(updated);
			setCurrentIndex((current) => Math.max(0, Math.min(current, displayImages.length - 2)));
			reload();
		} catch (e) {
			setError(e instanceof Error ? e.message : "画像の削除に失敗しました。");
		} finally {
			setBusy(false);
		}
	};

	useEffect(() => {
		if (!carouselRef.current) {
			return;
		}

		if (displayImages.length === 0) {
			setCurrentIndex(0);
			setZoomScale(MIN_ZOOM);
			setPan({ x: 0, y: 0 });
			return;
		}

		setCurrentIndex((current) => Math.min(current, displayImages.length - 1));
		setZoomScale(MIN_ZOOM);
		setPan({ x: 0, y: 0 });
		carouselRef.current.scrollTo({ left: 0, top: 0 });
	}, [displayImages.length, MIN_ZOOM]);

	const onCarouselScroll = () => {
		if (pinchRef.current.active) {
			return;
		}

		const element = carouselRef.current;
		if (!element) {
			return;
		}

		const width = Math.max(element.clientWidth, 1);
		const nextIndex = Math.round(element.scrollLeft / width);
		if (nextIndex !== currentIndex) {
			setCurrentIndex(nextIndex);
			setZoomScale(MIN_ZOOM);
			setPan({ x: 0, y: 0 });
		}
	};

	const onZoomIn = () => {
		setZoomScale((current) => {
			const next = clampZoom(current + ZOOM_STEP);
			setPan((prev) => (next <= MIN_ZOOM ? { x: 0, y: 0 } : clampPan(prev, next)));
			return next;
		});
	};

	const onZoomOut = () => {
		setZoomScale((current) => {
			const next = clampZoom(current - ZOOM_STEP);
			setPan((prev) => (next <= MIN_ZOOM ? { x: 0, y: 0 } : clampPan(prev, next)));
			return next;
		});
	};

	const onZoomReset = () => {
		setZoomScale(MIN_ZOOM);
		setPan({ x: 0, y: 0 });
	};

	const onZoomToggle = () => {
		setZoomScale((current) => {
			if (current > MIN_ZOOM) {
				setPan({ x: 0, y: 0 });
				return MIN_ZOOM;
			}

			const next = clampZoom(DOUBLE_TAP_ZOOM);
			setPan((prev) => clampPan(prev, next));
			return next;
		});
	};

	const onImageTouchStart = (event: TouchEvent<HTMLImageElement>) => {
		if (event.touches.length >= 2) {
			const distance = touchDistance(event.touches);
			if (distance <= 0) {
				return;
			}

			pinchRef.current = {
				active: true,
				startDistance: distance,
				startScale: zoomScale,
			};
			panRef.current.active = false;
			return;
		}

		if (event.touches.length === 1 && zoomScale > MIN_ZOOM) {
			panRef.current = {
				active: true,
				startX: event.touches[0].clientX,
				startY: event.touches[0].clientY,
				startPanX: pan.x,
				startPanY: pan.y,
			};
		}
	};

	const onImageTouchMove = (event: TouchEvent<HTMLImageElement>) => {
		if (pinchRef.current.active && event.touches.length >= 2) {
			const nextDistance = touchDistance(event.touches);
			if (nextDistance <= 0 || pinchRef.current.startDistance <= 0) {
				return;
			}

			event.preventDefault();
			const ratio = nextDistance / pinchRef.current.startDistance;
			const nextScale = clampZoom(pinchRef.current.startScale * ratio);
			setZoomScale(nextScale);
			setPan((prev) => (nextScale <= MIN_ZOOM ? { x: 0, y: 0 } : clampPan(prev, nextScale)));
			return;
		}

		if (panRef.current.active && event.touches.length === 1 && zoomScale > MIN_ZOOM) {
			event.preventDefault();
			const deltaX = event.touches[0].clientX - panRef.current.startX;
			const deltaY = event.touches[0].clientY - panRef.current.startY;
			setPan(
				clampPan(
					{
						x: panRef.current.startPanX + deltaX,
						y: panRef.current.startPanY + deltaY,
					},
					zoomScale
				)
			);
		}
	};

	const onImageTouchEnd = (event: TouchEvent<HTMLImageElement>) => {
		const now = Date.now();
		if (!pinchRef.current.active && event.changedTouches.length === 1 && event.touches.length === 0) {
			const touch = event.changedTouches[0];
			const elapsed = now - lastTapRef.current.time;
			const dx = touch.clientX - lastTapRef.current.x;
			const dy = touch.clientY - lastTapRef.current.y;
			const near = dx * dx + dy * dy < 36 * 36;

			if (elapsed > 0 && elapsed <= DOUBLE_TAP_MS && near) {
				onZoomToggle();
				lastTapRef.current.time = 0;
			} else {
				lastTapRef.current = {
					time: now,
					x: touch.clientX,
					y: touch.clientY,
				};
			}
		}

		if (event.touches.length < 2) {
			pinchRef.current.active = false;
		}

		if (event.touches.length === 0) {
			panRef.current.active = false;
		}
	};

	const onImageDoubleClick = () => {
		onZoomToggle();
	};

	const currentImageId = displayImages[currentIndex]?.id;

	const onImageLoad = (imageId: string, event: SyntheticEvent<HTMLImageElement>) => {
		imageNaturalSizeRef.current[imageId] = {
			width: event.currentTarget.naturalWidth,
			height: event.currentTarget.naturalHeight,
		};
		setPan((prev) => clampPan(prev, zoomScale));
	};

	const hasPhoto = !loading && !!photo && displayImages.length > 0;
	const errorMessage = invalidParams ? "画像IDが不正です。" : (error ?? "画像が見つかりません。");

	return (
		<IonPage className="photo-view-page">
			{hasPhoto && (
				<IonHeader translucent>
					<IonToolbar className="photo-toolbar">
						<IonButtons slot="start">
							<IonButton fill="clear" onClick={backToAlbum} aria-label="戻る">
								<IonIcon slot="icon-only" icon={chevronBack} />
							</IonButton>
						</IonButtons>
						<IonButtons slot="end">
							<IonButton id={menuTriggerId} fill="clear" disabled={busy} aria-label="メニュー">
								<IonIcon slot="icon-only" icon={ellipsisHorizontal} />
							</IonButton>
						</IonButtons>
					</IonToolbar>
				</IonHeader>
			)}

			<IonContent
				fullscreen={hasPhoto}
				scrollY={!hasPhoto}
				className={hasPhoto ? "photo-content" : "ion-padding"}>
				{loading ? (
					<p className="state-text">読み込み中...</p>
				) : hasPhoto ? (
					<section className="photo-stage">
						<div
							className="photo-carousel"
							ref={carouselRef}
							onScroll={onCarouselScroll}
							style={{ overflowX: zoomScale > MIN_ZOOM ? "hidden" : "auto" }}>
							{displayImages.map((image, index) => {
								const isCurrent = index === currentIndex;
								const slideZoom = isCurrent ? zoomScale : MIN_ZOOM;

								return (
									<article
										className="photo-slide"
										key={image.id}
										aria-hidden={!isCurrent}
										style={{ visibility: zoomScale > MIN_ZOOM && !isCurrent ? "hidden" : "visible" }}>
										<img
											src={image.src}
											alt="撮影画像の拡大表示"
											className="photo-fullscreen"
											style={{
												transform: isCurrent
													? `translate(${pan.x}px, ${pan.y}px) scale(${slideZoom})`
													: `scale(${slideZoom})`,
												touchAction: isCurrent && zoomScale > MIN_ZOOM ? "none" : "pan-x pan-y",
											}}
											loading="eager"
											onDoubleClick={isCurrent ? onImageDoubleClick : undefined}
											onLoad={(event) => onImageLoad(image.id, event)}
											onTouchStart={isCurrent ? onImageTouchStart : undefined}
											onTouchMove={isCurrent ? onImageTouchMove : undefined}
											onTouchEnd={isCurrent ? onImageTouchEnd : undefined}
											onTouchCancel={isCurrent ? onImageTouchEnd : undefined}
											onError={() => setError("画像の表示に失敗しました。")}
										/>
									</article>
								);
							})}
						</div>
						{displayImages.length > 1 && (
							<div className="photo-carousel-indicator" aria-live="polite">
								{currentIndex + 1} / {displayImages.length}
							</div>
						)}
						{currentImageId && zoomScale > MIN_ZOOM && (
							<div className="photo-pan-hint" aria-hidden="true">
								ドラッグで移動 / ダブルタップで戻す
							</div>
						)}
						<div className="photo-zoom-controls" aria-label="画像ズーム操作">
							<IonButton fill="clear" size="small" onClick={onZoomOut} disabled={zoomScale <= MIN_ZOOM}>
								-
							</IonButton>
							<IonButton fill="clear" size="small" onClick={onZoomReset} disabled={zoomScale === MIN_ZOOM}>
								{Math.round(zoomScale * 100)}%
							</IonButton>
							<IonButton fill="clear" size="small" onClick={onZoomIn} disabled={zoomScale >= MAX_ZOOM}>
								+
							</IonButton>
						</div>
						{photo.memo && (
							<div className="photo-memo">
								<p className="photo-memo-text">{photo.memo}</p>
							</div>
						)}
						{error && <p className="error-banner photo-error">{error}</p>}
					</section>
				) : (
					<>
						<p className="error-banner">{errorMessage}</p>
						<button type="button" className="back-link back-button" onClick={backToAlbum}>
							アルバムへ戻る
						</button>
					</>
				)}
			</IonContent>

			{hasPhoto && (
			<>
				<IonFab slot="fixed" vertical="bottom" horizontal="end">
					<IonFabButton onClick={() => void onEditMemo()} disabled={busy} aria-label="メモを編集">
						<IonIcon icon={createOutline} />
					</IonFabButton>
				</IonFab>

				<IonPopover
					trigger={menuTriggerId}
					triggerAction="click"
					side="bottom"
					alignment="end"
					showBackdrop={false}
					dismissOnSelect
					className="album-menu-popover">
					<IonList className="album-menu-list">
						<IonItem button onClick={onAddImageClick}>
							画像を追加
						</IonItem>
						<IonItem
							button
							lines="none"
							className="menu-item-danger"
							disabled={busy || displayImages.length === 0}
							onClick={() => {
								void onDeleteCurrentImage();
							}}>
							現在の画像を削除
						</IonItem>
					</IonList>
				</IonPopover>
			</>
		)}
			<input
				ref={fileInputRef}
				hidden
				className="visually-hidden"
				type="file"
				accept="image/*"
				onChange={onAddImage}
			/>
		</IonPage>
	);
};
