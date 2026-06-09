import {
	IonButton,
	IonButtons,
	IonContent,
	IonHeader,
	IonIcon,
	IonPage,
	IonTitle,
	IonToolbar,
} from "@ionic/react";
import { checkboxOutline, chevronBack, ellipsisHorizontal } from "ionicons/icons";
import { useParams } from "react-router-dom";
import { useAlbumDetailPageController } from "../hooks/useAlbumDetailPageController";
import { AlbumDetailBody } from "./albumDetail/AlbumDetailBody";
import { AlbumDetailFooter } from "./albumDetail/AlbumDetailFooter";
import { AlbumDetailOverlay } from "./albumDetail/AlbumDetailOverlay";

export const AlbumDetailPage = () => {
  const { albumId } = useParams<{ albumId: string }>();
  const {
    album,
    loading,
    busy,
    error,
    selectionMode,
    selectedPhotoIds,
    albumOptions,
    moveSheetOpen,
    photoUrls,
    fileInputRef,
    menuTriggerId,
    backToAlbums,
    onAddPhotoClick,
    onExportAlbum,
    onRenameAlbum,
    onAddPhoto,
    onToggleSelectionMode,
    onSelectPhoto,
    onDeleteSelected,
    onOpenMoveSheet,
    onMoveSelected,
    onDeleteAlbum,
    onShowAlbumInfo,
    onOpenPhoto,
    onDismissMoveSheet,
  } = useAlbumDetailPageController(albumId);
  const hasAlbum = !!album;

  return (
    <IonPage>
      {hasAlbum && (
        <IonHeader translucent>
          <IonToolbar>
            <IonButtons slot="start">
              <IonButton fill="clear" onClick={backToAlbums} aria-label="戻る">
                <IonIcon slot="icon-only" icon={chevronBack} />
              </IonButton>
            </IonButtons>
            <IonTitle>{`${album.title}(${album.photoCount})`}</IonTitle>
            <IonButtons slot="end">
              <IonButton
                fill="clear"
                onClick={onToggleSelectionMode}
                disabled={busy}
                aria-label={selectionMode ? "選択モード終了" : "選択モード開始"}>
                <IonIcon slot="icon-only" icon={checkboxOutline} />
              </IonButton>
              <IonButton id={menuTriggerId} fill="clear" disabled={busy}>
                <IonIcon slot="icon-only" icon={ellipsisHorizontal} />
              </IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
      )}

      <IonContent fullscreen>
        <AlbumDetailBody
          loading={loading}
          album={album}
          error={error}
          photoUrls={photoUrls}
          selectionMode={selectionMode}
          selectedPhotoIds={selectedPhotoIds}
          onBackToAlbums={backToAlbums}
          onSelectPhoto={onSelectPhoto}
          onOpenPhoto={onOpenPhoto}
        />

        <AlbumDetailOverlay
          hasAlbum={hasAlbum}
          busy={busy}
          selectionMode={selectionMode}
          menuTriggerId={menuTriggerId}
          moveSheetOpen={moveSheetOpen}
          albumOptions={albumOptions}
          onAddPhotoClick={onAddPhotoClick}
          onRenameAlbum={onRenameAlbum}
          onShowAlbumInfo={onShowAlbumInfo}
          onExportAlbum={onExportAlbum}
          onDeleteAlbum={onDeleteAlbum}
          onMoveSelected={onMoveSelected}
          onDismissMoveSheet={onDismissMoveSheet}
        />
      </IonContent>

      <AlbumDetailFooter
        hasAlbum={hasAlbum}
        selectionMode={selectionMode}
        busy={busy}
        selectedPhotoIds={selectedPhotoIds}
        onOpenMoveSheet={onOpenMoveSheet}
        onDeleteSelected={onDeleteSelected}
        onToggleSelectionMode={onToggleSelectionMode}
      />

      <input
        ref={fileInputRef}
        hidden
        className="visually-hidden"
        type="file"
        accept="image/*"
        onChange={onAddPhoto}
      />
    </IonPage>
  );
};
