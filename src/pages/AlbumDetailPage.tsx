import {
	IonButton,
	IonButtons,
	IonCol,
	IonContent,
	IonFab,
	IonFabButton,
	IonGrid,
	IonHeader,
	IonIcon,
	IonItem,
	IonList,
	IonPage,
	IonPopover,
	IonRow,
	IonText,
	IonTitle,
	IonToolbar,
	useIonRouter,
} from '@ionic/react'
import { add, ellipsisHorizontal } from 'ionicons/icons'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { JPEG_QUALITY, MAX_IMAGE_EDGE } from '../config/constants'
import { addPhotoToAlbum, getAlbum, listPhotosByAlbum, renameAlbumTitle } from '../lib/db'
import { formatDateTime } from '../lib/format'
import { resizeImageToJpeg } from '../lib/image'
import type { Album, Photo } from '../types'

export const AlbumDetailPage = () => {
  const { albumId } = useParams<{ albumId: string }>()
  const [album, setAlbum] = useState<Album | null>(null)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const router = useIonRouter()
  const menuTriggerId = 'album-detail-menu-trigger'

  useEffect(() => {
    let cancelled = false

    if (!albumId) {
      return () => {
        cancelled = true
      }
    }

    void Promise.all([getAlbum(albumId), listPhotosByAlbum(albumId)])
      .then(([albumData, photoData]) => {
        if (cancelled) {
          return
        }

        if (!albumData) {
          setError('アルバムが見つかりません。')
          setAlbum(null)
          setPhotos([])
          return
        }

        setError(null)
        setAlbum(albumData)
        setPhotos(photoData)
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'アルバム詳細の取得に失敗しました。')
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
  }, [albumId])

  const photoUrls = useMemo(() => {
    return photos.map((photo) => ({
      id: photo.id,
      src: URL.createObjectURL(photo.blob),
      createdAt: photo.createdAt,
    }))
  }, [photos])

  useEffect(() => {
    return () => {
      for (const p of photoUrls) {
        URL.revokeObjectURL(p.src)
      }
    }
  }, [photoUrls])

  const onAddPhotoClick = () => {
    fileInputRef.current?.click()
  }

  const onRenameAlbum = async () => {
    if (!album) {
      return
    }

    const title = window.prompt('アルバム名を入力してください', album.title)?.trim()
    if (!title || title === album.title) {
      return
    }

    try {
      setBusy(true)
      setError(null)
      const updatedAlbum = await renameAlbumTitle(album.id, title)
      setAlbum(updatedAlbum)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'アルバム名の変更に失敗しました。')
    } finally {
      setBusy(false)
    }
  }

  const onAddPhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const [file] = event.target.files ?? []
    event.target.value = ''

    if (!file || !albumId) {
      return
    }

    try {
      setBusy(true)
      setError(null)
      const prepared = await resizeImageToJpeg(file, MAX_IMAGE_EDGE, JPEG_QUALITY)
      await addPhotoToAlbum(albumId, prepared)
      const [albumData, photoData] = await Promise.all([
        getAlbum(albumId),
        listPhotosByAlbum(albumId),
      ])

      if (!albumData) {
        setError('アルバムが見つかりません。')
        setAlbum(null)
        setPhotos([])
        return
      }

      setAlbum(albumData)
      setPhotos(photoData)
    } catch (e) {
      setError(e instanceof Error ? e.message : '画像追加に失敗しました。')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    if (!albumId) {
      return (
        <main className="screen">
          <p className="error-banner">アルバムIDが不正です。</p>
          <button type="button" className="back-link back-button" onClick={() => router.push('/', 'back')}>
            一覧へ戻る
          </button>
        </main>
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

  if (!album) {
    return (
      <IonPage>
        <IonContent className="ion-padding">
          <p className="error-banner">{error ?? 'アルバムが見つかりません。'}</p>
          <button type="button" className="back-link back-button" onClick={() => router.push('/', 'back')}>
            一覧へ戻る
          </button>
        </IonContent>
      </IonPage>
    )
  }

  return (
    <IonPage>
      <IonHeader translucent>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton fill="clear" onClick={() => router.push('/', 'back')}>
              一覧
            </IonButton>
          </IonButtons>
          <IonTitle>{album.title}</IonTitle>
          <IonButtons slot="end">
            <IonButton id={menuTriggerId} fill="clear" disabled={busy}>
              <IonIcon slot="icon-only" icon={ellipsisHorizontal} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen>
        <section className="screen ion-padding">
          <section className="detail-meta" aria-label="アルバムメタ情報">
            <IonText className="meta-line">作成: {formatDateTime(album.createdAt)}</IonText>
            <IonText className="meta-line">更新: {formatDateTime(album.updatedAt)}</IonText>
            <IonText className="meta-line">画像: {album.photoCount}枚</IonText>
          </section>

          {error && <p className="error-banner">{error}</p>}

          {photoUrls.length === 0 ? (
            <p className="state-text">まだ画像がありません。上のボタンから追加できます。</p>
          ) : (
            <IonGrid className="tiles" aria-label="撮影画像一覧">
              <IonRow>
                {photoUrls.map((photo) => (
                  <IonCol key={photo.id} size="6" sizeMd="4" sizeLg="3">
                    <button
                      type="button"
                      className="tile-button"
                      onClick={() => router.push(`/albums/${album.id}/photos/${photo.id}`, 'forward')}
                    >
                      <article className="tile">
                        <img src={photo.src} alt="撮影画像" loading="lazy" decoding="async" />
                        <p>{formatDateTime(photo.createdAt)}</p>
                      </article>
                    </button>
                  </IonCol>
                ))}
              </IonRow>
            </IonGrid>
          )}
        </section>

        <IonFab slot="fixed" vertical="bottom" horizontal="end">
          <IonFabButton onClick={onAddPhotoClick} disabled={busy} aria-label="画像を追加">
            {busy ? '...' : <IonIcon icon={add} />}
          </IonFabButton>
        </IonFab>

        <IonPopover
          trigger={menuTriggerId}
          triggerAction="click"
          side="bottom"
          alignment="end"
          showBackdrop={false}
          dismissOnSelect
          className="album-menu-popover"
        >
          <IonList className="album-menu-list">
            <IonItem button onClick={() => void onRenameAlbum()}>
              アルバム名変更
            </IonItem>
          </IonList>
        </IonPopover>
      </IonContent>

      <input
        ref={fileInputRef}
        hidden
        className="visually-hidden"
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onAddPhoto}
      />
    </IonPage>
  )
}
