import { IonFab, IonFabButton, IonIcon, IonText } from "@ionic/react";
import { add } from "ionicons/icons";

type AlbumsCreateFabProps = {
	busy: boolean;
	onClick: () => void;
};

export const AlbumsCreateFab = ({ busy, onClick }: AlbumsCreateFabProps) => {
	return (
		<IonFab slot="fixed" vertical="bottom" horizontal="end">
			<IonFabButton onClick={onClick} disabled={busy} aria-label="撮影して新規アルバムを作成">
				{busy ? <IonText>...</IonText> : <IonIcon icon={add} />}
			</IonFabButton>
		</IonFab>
	);
};