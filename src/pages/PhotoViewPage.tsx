import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  useIonRouter,
} from '@ionic/react'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAppModal } from '../components/appModalContext'
import { useAlbumMutations } from '../hooks/useAlbumMutations'
import { usePhoto } from '../hooks/usePhoto'

export const PhotoViewPage = () => {
  const { albumId, photoId } = useParams<{ albumId: string; photoId: string }>()
  const router = useIonRouter()
  const [busy, setBusy] = useState(false)
  const modal = useAppModal()
  const { savePhotoMemo } = useAlbumMutations()
  const { album, photo, loading, error, photoUrl, invalidParams, setError, applyPhotoUpdate } =
    usePhoto(albumId, photoId)

  const backToAlbum = () => {
    if (router.canGoBack()) {
      router.goBack()
      return
    }

    if (albumId) {
      router.push(`/albums/${albumId}`, 'root', 'replace')
      return
    }

    router.push('/', 'root', 'replace')
  }

  const onEditMemo = async () => {
    if (!photo) {
      return
    }

    const value = await modal.prompt({
      title: 'メモ',
      defaultValue: photo.memo ?? '',
      placeholder: 'メモを入力...',
      confirmText: '保存',
      cancelText: 'キャンセル',
    })

    if (value === null) {
      return
    }

    try {
      setBusy(true)
      const updated = await savePhotoMemo(photo.id, value)
      applyPhotoUpdate(updated)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'メモの保存に失敗しました。')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    if (invalidParams) {
      return (
        <IonPage>
          <IonContent className="ion-padding">
            <p className="error-banner">画像IDが不正です。</p>
            <button type="button" className="back-link back-button" onClick={backToAlbum}>
              アルバムへ戻る
            </button>
          </IonContent>
        </IonPage>
      )
    }

    return (
      <IonPage>
        <IonContent className="ion-padding">
          <p className="state-text">読み込み中...</p>
        </IonContent>
      </IonPage>
    )
  }

  if (!photo || !photoUrl) {
    return (
      <IonPage>
        <IonContent className="ion-padding">
          <p className="error-banner">{error ?? '画像が見つかりません。'}</p>
          <button type="button" className="back-link back-button" onClick={backToAlbum}>
            アルバムへ戻る
          </button>
        </IonContent>
      </IonPage>
    )
  }

  return (
    <IonPage className="photo-view-page">
      <IonHeader translucent>
        <IonToolbar className="photo-toolbar">
          <IonButtons slot="start">
            <IonButton fill="clear" onClick={backToAlbum}>
              戻る
            </IonButton>
          </IonButtons>
          <IonTitle>{album?.title ?? 'Photo'}</IonTitle>
          <IonButtons slot="end">
            <IonButton fill="clear" onClick={() => void onEditMemo()} disabled={busy}>
              メモ
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen scrollY={false} className="photo-content">
        <section className="photo-stage">
          <img
            src={photoUrl}
            alt="撮影画像の拡大表示"
            className="photo-fullscreen"
            decoding="async"
          />
          {photo?.memo && (
            <div className="photo-memo">
              <p className="photo-memo-text">{photo.memo}</p>
            </div>
          )}
          {error && <p className="error-banner photo-error">{error}</p>}
        </section>
      </IonContent>
    </IonPage>
  )
}
