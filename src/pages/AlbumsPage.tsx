import {
	IonContent,
	IonHeader,
	IonPage,
	IonTitle,
	IonToolbar,
} from "@ionic/react";
import { useAlbumsPageController } from "../hooks/useAlbumsPageController";
import { AlbumsCreateFab } from "./albums/AlbumsCreateFab";
import { AlbumsPageBody } from "./albums/AlbumsPageBody";

export const AlbumsPage = () => {
	const {
		albumCountLabel,
		albums,
		loading,
		error,
		busy,
		fileInputRef,
		onFabClick,
		onOpenAlbum,
		onCaptureNewAlbum,
	} = useAlbumsPageController();

	return (
		<IonPage>
			<IonHeader translucent>
				<IonToolbar>
					<IonTitle>Retro Vault</IonTitle>
				</IonToolbar>
			</IonHeader>

			<IonContent fullscreen>
				<AlbumsPageBody
					albumCountLabel={albumCountLabel}
					albums={albums}
					loading={loading}
					error={error}
					onOpenAlbum={onOpenAlbum}
				/>

				<AlbumsCreateFab busy={busy} onClick={onFabClick} />
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

		</IonPage>
	);
};
