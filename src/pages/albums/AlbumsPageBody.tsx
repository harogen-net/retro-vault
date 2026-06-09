import { IonItem, IonLabel, IonList, IonNote } from "@ionic/react";
import { formatDateTime } from "../../lib/format";
import type { Album } from "../../types";

type AlbumsPageBodyProps = {
	albumCountLabel: string;
	albums: Album[];
	loading: boolean;
	error: string | null;
	onOpenAlbum: (albumId: string) => void;
};

export const AlbumsPageBody = ({
	albumCountLabel,
	albums,
	loading,
	error,
	onOpenAlbum,
}: AlbumsPageBodyProps) => {
	return (
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
								onOpenAlbum(album.id);
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
	);
};