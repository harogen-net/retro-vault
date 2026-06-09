import { IonButton, IonContent } from "@ionic/react";
import type { MouseEvent, RefObject, SyntheticEvent, TouchEvent } from "react";

export type PhotoViewDisplayImage = {
	id: string;
	src: string;
};

type PhotoViewStageProps = {
	loading: boolean;
	hasPhoto: boolean;
	error: string | null;
	errorMessage: string;
	photoMemo: string | null | undefined;
	displayImages: PhotoViewDisplayImage[];
	currentIndex: number;
	zoomScale: number;
	pan: { x: number; y: number };
	minZoom: number;
	maxZoom: number;
	carouselRef: RefObject<HTMLDivElement | null>;
	onBackToAlbum: () => void;
	onCarouselScroll: () => void;
	onZoomOut: () => void;
	onZoomReset: () => void;
	onZoomIn: () => void;
	onImageDoubleClick: (event: MouseEvent<HTMLImageElement>) => void;
	onImageLoad: (imageId: string, event: SyntheticEvent<HTMLImageElement>) => void;
	onImageTouchStart: (event: TouchEvent<HTMLImageElement>) => void;
	onImageTouchMove: (event: TouchEvent<HTMLImageElement>) => void;
	onImageTouchEnd: (event: TouchEvent<HTMLImageElement>) => void;
	onImageError: () => void;
};

export const PhotoViewStage = ({
	loading,
	hasPhoto,
	error,
	errorMessage,
	photoMemo,
	displayImages,
	currentIndex,
	zoomScale,
	pan,
	minZoom,
	maxZoom,
	carouselRef,
	onBackToAlbum,
	onCarouselScroll,
	onZoomOut,
	onZoomReset,
	onZoomIn,
	onImageDoubleClick,
	onImageLoad,
	onImageTouchStart,
	onImageTouchMove,
	onImageTouchEnd,
	onImageError,
}: PhotoViewStageProps) => {
	return (
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
						style={{ overflowX: zoomScale > minZoom ? "hidden" : "auto" }}>
						{displayImages.map((image, index) => {
							const isCurrent = index === currentIndex;
							const slideZoom = isCurrent ? zoomScale : minZoom;

							return (
								<article
									className="photo-slide"
									key={image.id}
									aria-hidden={!isCurrent}
									style={{
										visibility: zoomScale > minZoom && !isCurrent ? "hidden" : "visible",
									}}>
									<img
										src={image.src}
										alt="撮影画像の拡大表示"
										className="photo-fullscreen"
										style={{
											transform: isCurrent
												? `translate(${pan.x}px, ${pan.y}px) scale(${slideZoom})`
												: `scale(${slideZoom})`,
											touchAction: isCurrent && zoomScale > minZoom ? "none" : "pan-x pan-y",
										}}
										loading="eager"
										onDoubleClick={isCurrent ? onImageDoubleClick : undefined}
										onLoad={(event) => onImageLoad(image.id, event)}
										onTouchStart={isCurrent ? onImageTouchStart : undefined}
										onTouchMove={isCurrent ? onImageTouchMove : undefined}
										onTouchEnd={isCurrent ? onImageTouchEnd : undefined}
										onTouchCancel={isCurrent ? onImageTouchEnd : undefined}
										onError={onImageError}
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

					<div className="photo-zoom-controls" aria-label="画像ズーム操作">
						<IonButton fill="clear" size="small" onClick={onZoomOut} disabled={zoomScale <= minZoom}>
							-
						</IonButton>
						<IonButton fill="clear" size="small" onClick={onZoomReset} disabled={zoomScale === minZoom}>
							{Math.round(zoomScale * 100)}%
						</IonButton>
						<IonButton fill="clear" size="small" onClick={onZoomIn} disabled={zoomScale >= maxZoom}>
							+
						</IonButton>
					</div>
					{photoMemo && (
						<div className="photo-memo">
							<p className="photo-memo-text">{photoMemo}</p>
						</div>
					)}
					{error && <p className="error-banner photo-error">{error}</p>}
				</section>
			) : (
				<>
					<p className="error-banner">{errorMessage}</p>
					<button type="button" className="back-link back-button" onClick={onBackToAlbum}>
						アルバムへ戻る
					</button>
				</>
			)}
		</IonContent>
	);
};