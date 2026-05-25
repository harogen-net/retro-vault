import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
} from '@ionic/react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getAlbum, getPhotoById } from '../lib/db'
import type { Album, Photo } from '../types'

export const PhotoViewPage = () => {
  const { albumId, photoId } = useParams<{ albumId: string; photoId: string }>()
  const navigate = useNavigate()
  const invalidParams = !albumId || !photoId

  const [album, setAlbum] = useState<Album | null>(null)
  const [photo, setPhoto] = useState<Photo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
    if (albumId) {
      navigate(`/albums/${albumId}`)
      return
    }

    navigate('/')
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
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen className="photo-content">
        <section className="photo-stage">
          <img src={photoUrl} alt="撮影画像の拡大表示" className="photo-fullscreen" />
        </section>
      </IonContent>
    </IonPage>
  )
}
