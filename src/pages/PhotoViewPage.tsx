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
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAppModal } from '../components/appModalContext'
import { getAlbum, getPhotoById, updatePhotoMemo } from '../lib/db'
import type { Album, Photo } from '../types'

export const PhotoViewPage = () => {
  const { albumId, photoId } = useParams<{ albumId: string; photoId: string }>()
  const router = useIonRouter()
  const invalidParams = !albumId || !photoId

  const [album, setAlbum] = useState<Album | null>(null)
  const [photo, setPhoto] = useState<Photo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const modal = useAppModal()

  useEffect(() => {
    let cancelled = false

    if (invalidParams) {
      return () => {
        cancelled = true
      }
    }

    void Promise.all([getAlbum(albumId), getPhotoById(photoId)])
      .then(([albumData, photoData]) => {
        if (cancelled) {
          return
        }

        if (!albumData || !photoData || photoData.albumId !== albumId) {
          setError('画像が見つかりません。')
          setAlbum(null)
          setPhoto(null)
          return
        }

        setError(null)
        setAlbum(albumData)
        setPhoto(photoData)
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : '画像の取得に失敗しました。')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [albumId, photoId, invalidParams])

  const photoUrl = useMemo(() => {
    if (!photo) {
      return null
    }

    return URL.createObjectURL(photo.blob)
  }, [photo])

  useEffect(() => {
    return () => {
      if (photoUrl) {
        URL.revokeObjectURL(photoUrl)
      }
    }
  }, [photoUrl])

  const backToAlbum = () => {
    if (router.canGoBack()) {
      router.goBack()
      return
    }

    if (albumId) {
      router.push(`/albums/${albumId}`, 'root')
      return
    }

    router.push('/', 'root')
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
      const updated = await updatePhotoMemo(photo.id, value)
      setPhoto(updated)
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
