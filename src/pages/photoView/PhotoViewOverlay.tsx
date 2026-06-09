import { IonFab, IonFabButton, IonIcon, IonItem, IonList, IonPopover } from "@ionic/react";
import { createOutline } from "ionicons/icons";

type PhotoViewOverlayProps = {
	hasPhoto: boolean;
	busy: boolean;
	menuTriggerId: string;
	canDeleteCurrentImage: boolean;
	onEditMemo: () => Promise<void>;
	onAddImageClick: () => void;
	onDeleteCurrentImage: () => Promise<void>;
};

export const PhotoViewOverlay = ({
	hasPhoto,
	busy,
	menuTriggerId,
	canDeleteCurrentImage,
	onEditMemo,
	onAddImageClick,
	onDeleteCurrentImage,
}: PhotoViewOverlayProps) => {
	if (!hasPhoto) {
		return null;
	}

	return (
		<>
			<IonFab slot="fixed" vertical="bottom" horizontal="end">
				<IonFabButton
					className="photo-memo-fab"
					onClick={() => void onEditMemo()}
					disabled={busy}
					aria-label="メモを編集">
					<span className="photo-memo-fab-content" aria-hidden="true">
						<IonIcon icon={createOutline} />
						<span className="photo-memo-fab-label">メモ</span>
					</span>
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
						disabled={busy || !canDeleteCurrentImage}
						onClick={() => {
							void onDeleteCurrentImage();
						}}>
						現在の画像を削除
					</IonItem>
				</IonList>
			</IonPopover>
		</>
	);
};