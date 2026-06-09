import { IonButton } from "@ionic/react";

type AlbumDetailFooterProps = {
	hasAlbum: boolean;
	selectionMode: boolean;
	busy: boolean;
	selectedPhotoIds: string[];
	onOpenMoveSheet: () => Promise<void>;
	onDeleteSelected: () => Promise<void>;
	onToggleSelectionMode: () => void;
};

export const AlbumDetailFooter = ({
	hasAlbum,
	selectionMode,
	busy,
	selectedPhotoIds,
	onOpenMoveSheet,
	onDeleteSelected,
	onToggleSelectionMode,
}: AlbumDetailFooterProps) => {
	if (!hasAlbum || !selectionMode) {
		return null;
	}

	return (
		<div className="selection-mode-bar" role="region" aria-label="選択モード操作">
			<div className="selection-actions">
				<span>{selectedPhotoIds.length}件選択中</span>
				<div className="selection-actions-buttons">
					<IonButton
						fill="clear"
						onClick={() => void onOpenMoveSheet()}
						disabled={busy || selectedPhotoIds.length === 0}>
						移動
					</IonButton>
					<IonButton
						fill="clear"
						color="danger"
						onClick={() => void onDeleteSelected()}
						disabled={busy || selectedPhotoIds.length === 0}>
						削除
					</IonButton>
					<IonButton fill="clear" onClick={onToggleSelectionMode} disabled={busy}>
						完了
					</IonButton>
				</div>
			</div>
		</div>
	);
};