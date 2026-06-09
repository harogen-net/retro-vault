import { IonButton, IonButtons, IonHeader, IonIcon, IonToolbar } from "@ionic/react";
import { chevronBack, ellipsisHorizontal } from "ionicons/icons";

type PhotoViewHeaderProps = {
	hasPhoto: boolean;
	busy: boolean;
	menuTriggerId: string;
	onBackToAlbum: () => void;
};

export const PhotoViewHeader = ({
	hasPhoto,
	busy,
	menuTriggerId,
	onBackToAlbum,
}: PhotoViewHeaderProps) => {
	if (!hasPhoto) {
		return null;
	}

	return (
		<IonHeader translucent>
			<IonToolbar className="photo-toolbar">
				<IonButtons slot="start">
					<IonButton fill="clear" onClick={onBackToAlbum} aria-label="戻る">
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
	);
};