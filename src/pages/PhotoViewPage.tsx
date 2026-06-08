import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  useIonRouter,
} from "@ionic/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useAppModal } from "../components/appModalContext";
import { useAlbumMutations } from "../hooks/useAlbumMutations";
import { usePhoto } from "../hooks/usePhoto";

export const PhotoViewPage = () => {
	const { albumId, photoId } = useParams<{ albumId: string; photoId: string }>();
	const router = useIonRouter();
	const [busy, setBusy] = useState(false);
	const [currentIndex, setCurrentIndex] = useState(0);
	const [displayImages, setDisplayImages] = useState<Array<{ id: string; src: string }>>([]);
	const fileInputRef = useRef<HTMLInputElement | null>(null);
	const carouselRef = useRef<HTMLDivElement | null>(null);
	const modal = useAppModal();
	const { savePhotoMemo, addImageToPhotoFromFile } = useAlbumMutations();
	const {
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

	useEffect(() => {
		if (!carouselRef.current) {
			return;
		}

		if (displayImages.length === 0) {
			setCurrentIndex(0);
			return;
		}

		setCurrentIndex((current) => Math.min(current, displayImages.length - 1));
		carouselRef.current.scrollTo({ left: 0, top: 0 });
	}, [displayImages.length]);

	const onCarouselScroll = () => {
		const element = carouselRef.current;
		if (!element) {
			return;
		}

		const width = Math.max(element.clientWidth, 1);
		const nextIndex = Math.round(element.scrollLeft / width);
		if (nextIndex !== currentIndex) {
			setCurrentIndex(nextIndex);
		}
	};

	const hasPhoto = !loading && !!photo && displayImages.length > 0;
	const errorMessage = invalidParams ? "画像IDが不正です。" : (error ?? "画像が見つかりません。");

	return (
		<IonPage className="photo-view-page">
			{hasPhoto && (
				<IonHeader translucent>
					<IonToolbar className="photo-toolbar">
						<IonButtons slot="start">
							<IonButton fill="clear" onClick={backToAlbum}>
								戻る
							</IonButton>
						</IonButtons>
						<IonTitle>{album?.title ?? "Photo"}</IonTitle>
						<IonButtons slot="end">
							<IonButton fill="clear" onClick={onAddImageClick} disabled={busy}>
								追加
							</IonButton>
							<IonButton fill="clear" onClick={() => void onEditMemo()} disabled={busy}>
								メモ
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
						<div className="photo-carousel" ref={carouselRef} onScroll={onCarouselScroll}>
							{displayImages.map((image, index) => (
								<article
									className="photo-slide"
									key={image.id}
									aria-hidden={index !== currentIndex}>
									<img
										src={image.src}
										alt="撮影画像の拡大表示"
										className="photo-fullscreen"
										loading="eager"
										onError={() => setError("画像の表示に失敗しました。")}
									/>
								</article>
							))}
						</div>
						{displayImages.length > 1 && (
							<div className="photo-carousel-indicator" aria-live="polite">
								{currentIndex + 1} / {displayImages.length}
							</div>
						)}
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

			<input
				ref={fileInputRef}
				hidden
				className="visually-hidden"
				type="file"
				accept="image/*"
				capture="environment"
				onChange={onAddImage}
			/>
		</IonPage>
	);
};
