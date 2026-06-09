import { IonActionSheet, IonFab, IonFabButton, IonIcon, IonItem, IonList, IonPopover } from "@ionic/react";
import { add } from "ionicons/icons";
import type { Album } from "../../types";

type AlbumDetailOverlayProps = {
	hasAlbum: boolean;
	busy: boolean;
	selectionMode: boolean;
	menuTriggerId: string;
	moveSheetOpen: boolean;
	albumOptions: Album[];
	onAddPhotoClick: () => void;
	onRenameAlbum: () => Promise<void>;
	onShowAlbumInfo: () => Promise<void>;
	onExportAlbum: () => Promise<void>;
	onDeleteAlbum: () => Promise<void>;
	onMoveSelected: (targetAlbumId: string) => Promise<void>;
	onDismissMoveSheet: () => void;
};

export const AlbumDetailOverlay = ({
	hasAlbum,
	busy,
	selectionMode,
	menuTriggerId,
	moveSheetOpen,
	albumOptions,
	onAddPhotoClick,
	onRenameAlbum,
	onShowAlbumInfo,
	onExportAlbum,
	onDeleteAlbum,
	onMoveSelected,
	onDismissMoveSheet,
}: AlbumDetailOverlayProps) => {
	if (!hasAlbum) {
		return null;
	}

	return (
		<>
			{!selectionMode && (
				<IonFab slot="fixed" vertical="bottom" horizontal="end">
					<IonFabButton onClick={onAddPhotoClick} disabled={busy} aria-label="画像を追加">
						{busy ? "..." : <IonIcon icon={add} />}
					</IonFabButton>
				</IonFab>
			)}

			<IonPopover
				trigger={menuTriggerId}
				triggerAction="click"
				side="bottom"
				alignment="end"
				showBackdrop={false}
				dismissOnSelect
				className="album-menu-popover">
				<IonList className="album-menu-list">
					<IonItem button onClick={() => void onShowAlbumInfo()}>
						詳細情報
					</IonItem>
					<IonItem button onClick={() => void onRenameAlbum()}>
						アルバム名変更
					</IonItem>
					<IonItem button onClick={() => void onExportAlbum()}>
						エクスポート
					</IonItem>
					<IonItem button lines="none" onClick={() => void onDeleteAlbum()}>
						アルバム削除
					</IonItem>
				</IonList>
			</IonPopover>

			<IonActionSheet
				isOpen={moveSheetOpen}
				onDidDismiss={onDismissMoveSheet}
				header="移動先アルバムを選択"
				buttons={[
					...albumOptions.map((option) => ({
						text: option.title,
						handler: () => {
							void onMoveSelected(option.id);
						},
					})),
					{
						text: "キャンセル",
						role: "cancel" as const,
					},
				]}
			/>
		</>
	);
};