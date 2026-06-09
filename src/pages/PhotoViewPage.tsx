import {
	IonPage,
	useIonRouter,
} from "@ionic/react";
import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type MouseEvent,
	type SyntheticEvent,
	type TouchEvent,
} from "react";
import { useParams } from "react-router-dom";
import { useAppModal } from "../components/appModalContext";
import { useAlbumMutations } from "../hooks/useAlbumMutations";
import { useBlobDataUrlList } from "../hooks/useBlobDataUrlList";
import { usePhoto } from "../hooks/usePhoto";
import type { PhotoImage } from "../types";
import { PhotoViewHeader } from "./photoView/PhotoViewHeader";
import { PhotoViewOverlay } from "./photoView/PhotoViewOverlay";
import { PhotoViewStage, type PhotoViewDisplayImage } from "./photoView/PhotoViewStage";

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
	const [zoomAnimated, setZoomAnimated] = useState(false);
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

	const imageDisplayImages = useBlobDataUrlList<PhotoImage, PhotoViewDisplayImage>({
		items: images,
		getBlob: useCallback((image) => image.blob, []),
		getMimeType: useCallback((image) => image.mimeType, []),
		mapResult: useCallback((image, src: string) => ({ id: image.id, src }), []),
	});

	const displayImages = useMemo<PhotoViewDisplayImage[]>(() => {
		if (images.length > 0) {
			return imageDisplayImages;
		}

		return photoUrl ? [{ id: photo?.id ?? "fallback-photo", src: photoUrl }] : [];
	}, [imageDisplayImages, images.length, photo?.id, photoUrl]);

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

	const getCurrentImageMetrics = useCallback(() => {
		if (!carouselRef.current || displayImages.length === 0) {
			return null;
		}

		const containerWidth = carouselRef.current.clientWidth;
		const containerHeight = carouselRef.current.clientHeight;
		const current = displayImages[currentIndex];
		if (!current) {
			return null;
		}

		const natural = imageNaturalSizeRef.current[current.id];
		if (!natural || natural.width <= 0 || natural.height <= 0) {
			return null;
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

		return { baseWidth, baseHeight, containerWidth, containerHeight };
	}, [currentIndex, displayImages]);

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

	const getZoomPanForPoint = useCallback(
		(point: { x: number; y: number }, nextScale: number) => {
			if (nextScale <= MIN_ZOOM) {
				return { x: 0, y: 0 };
			}

			const metrics = getCurrentImageMetrics();
			if (!metrics) {
				return clampPan(pan, nextScale);
			}

			const { baseWidth, baseHeight, containerWidth, containerHeight } = metrics;
			const offsetX = Math.max(
				-baseWidth / 2,
				Math.min(baseWidth / 2, point.x - containerWidth / 2)
			);
			const offsetY = Math.max(
				-baseHeight / 2,
				Math.min(baseHeight / 2, point.y - containerHeight / 2)
			);
			const safeCurrentScale = Math.max(zoomScale, MIN_ZOOM);
			const nextPan = {
				x: offsetX - ((offsetX - pan.x) / safeCurrentScale) * nextScale,
				y: offsetY - ((offsetY - pan.y) / safeCurrentScale) * nextScale,
			};

			return clampPan(nextPan, nextScale);
		},
		[clampPan, getCurrentImageMetrics, MIN_ZOOM, pan, zoomScale]
	);

	const touchDistance = (touches: TouchEvent<HTMLImageElement>["touches"]) => {
		if (touches.length < 2) {
			return 0;
		}

		const dx = touches[0].clientX - touches[1].clientX;
		const dy = touches[0].clientY - touches[1].clientY;
		return Math.hypot(dx, dy);
	};

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

	// Keep the current slide and zoom state in sync when the backing image list changes.
	/* eslint-disable react-hooks/set-state-in-effect */
	useEffect(() => {
		if (!carouselRef.current) {
			return;
		}

		if (displayImages.length === 0) {
			setCurrentIndex(0);
			setZoomScale(MIN_ZOOM);
			setPan({ x: 0, y: 0 });
			setZoomAnimated(false);
			return;
		}

		setCurrentIndex((current) => Math.min(current, displayImages.length - 1));
		setZoomScale(MIN_ZOOM);
		setPan({ x: 0, y: 0 });
		setZoomAnimated(false);
		carouselRef.current.scrollTo({ left: 0, top: 0 });
	}, [displayImages.length, MIN_ZOOM]);
	/* eslint-enable react-hooks/set-state-in-effect */

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
			setZoomAnimated(false);
		}
	};

	const onZoomIn = () => {
		setZoomAnimated(true);
		setZoomScale((current) => {
			const next = clampZoom(current + ZOOM_STEP);
			setPan((prev) => (next <= MIN_ZOOM ? { x: 0, y: 0 } : clampPan(prev, next)));
			return next;
		});
	};

	const onZoomOut = () => {
		setZoomAnimated(true);
		setZoomScale((current) => {
			const next = clampZoom(current - ZOOM_STEP);
			setPan((prev) => (next <= MIN_ZOOM ? { x: 0, y: 0 } : clampPan(prev, next)));
			return next;
		});
	};

	const onZoomReset = () => {
		setZoomAnimated(true);
		setZoomScale(MIN_ZOOM);
		setPan({ x: 0, y: 0 });
	};

	const onZoomToggle = (point?: { x: number; y: number }) => {
		setZoomAnimated(true);
		setZoomScale((current) => {
			if (current > MIN_ZOOM) {
				setPan({ x: 0, y: 0 });
				return MIN_ZOOM;
			}

			const next = clampZoom(DOUBLE_TAP_ZOOM);
			setPan(point ? getZoomPanForPoint(point, next) : clampPan(pan, next));
			return next;
		});
	};

	const onImageTouchStart = (event: TouchEvent<HTMLImageElement>) => {
		setZoomAnimated(false);
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
		if (
			!pinchRef.current.active &&
			event.changedTouches.length === 1 &&
			event.touches.length === 0
		) {
			const touch = event.changedTouches[0];
			const elapsed = now - lastTapRef.current.time;
			const dx = touch.clientX - lastTapRef.current.x;
			const dy = touch.clientY - lastTapRef.current.y;
			const near = dx * dx + dy * dy < 36 * 36;

			if (elapsed > 0 && elapsed <= DOUBLE_TAP_MS && near) {
				const rect = event.currentTarget.getBoundingClientRect();
				onZoomToggle({
					x: touch.clientX - rect.left,
					y: touch.clientY - rect.top,
				});
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

	const onImageDoubleClick = (event: MouseEvent<HTMLImageElement>) => {
		const rect = event.currentTarget.getBoundingClientRect();
		onZoomToggle({
			x: event.clientX - rect.left,
			y: event.clientY - rect.top,
		});
	};

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
			<PhotoViewHeader
				hasPhoto={hasPhoto}
				busy={busy}
				menuTriggerId={menuTriggerId}
				onBackToAlbum={backToAlbum}
			/>

			<PhotoViewStage
				loading={loading}
				hasPhoto={hasPhoto}
				error={error}
				errorMessage={errorMessage}
				photoMemo={photo?.memo}
				displayImages={displayImages}
				currentIndex={currentIndex}
				zoomScale={zoomScale}
				pan={pan}
				zoomAnimated={zoomAnimated}
				minZoom={MIN_ZOOM}
				maxZoom={MAX_ZOOM}
				carouselRef={carouselRef}
				onBackToAlbum={backToAlbum}
				onCarouselScroll={onCarouselScroll}
				onZoomOut={onZoomOut}
				onZoomReset={onZoomReset}
				onZoomIn={onZoomIn}
				onImageDoubleClick={onImageDoubleClick}
				onImageLoad={onImageLoad}
				onImageTouchStart={onImageTouchStart}
				onImageTouchMove={onImageTouchMove}
				onImageTouchEnd={onImageTouchEnd}
				onImageError={() => setError("画像の表示に失敗しました。")}
			/>

			<PhotoViewOverlay
				hasPhoto={hasPhoto}
				busy={busy}
				menuTriggerId={menuTriggerId}
				canDeleteCurrentImage={displayImages.length > 0}
				onEditMemo={onEditMemo}
				onAddImageClick={onAddImageClick}
				onDeleteCurrentImage={onDeleteCurrentImage}
			/>
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
