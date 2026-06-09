import { IonCol, IonGrid, IonIcon, IonRow } from "@ionic/react";
import { checkmarkCircle } from "ionicons/icons";
import { formatDateTime } from "../../lib/format";
import type { Album } from "../../types";

export type AlbumDetailBodyPhoto = {
	id: string;
	src: string;
	createdAt: number;
	memo: string | undefined;
};

type AlbumDetailBodyProps = {
	loading: boolean;
	album: Album | null;
	error: string | null;
	photoUrls: AlbumDetailBodyPhoto[];
	selectionMode: boolean;
	selectedPhotoIds: string[];
	onBackToAlbums: () => void;
	onSelectPhoto: (photoId: string) => void;
	onOpenPhoto: (photoId: string) => void;
};

export const AlbumDetailBody = ({
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