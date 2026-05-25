import {
	IonContent,
	IonFab,
	IonFabButton,
	IonHeader,
	IonIcon,
	IonItem,
	IonLabel,
	IonList,
	IonNote,
	IonPage,
	IonText,
	IonTitle,
	IonToolbar,
} from '@ionic/react'
import { add } from 'ionicons/icons'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useHistory } from 'react-router-dom'
import { JPEG_QUALITY, MAX_IMAGE_EDGE } from '../config/constants'
import { addPhotoToAlbum, createAlbum, listAlbums } from '../lib/db'
import { formatDateTime } from '../lib/format'
import { resizeImageToJpeg } from '../lib/image'
import type { Album } from '../types'

const defaultAlbumTitle = (): string => {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `アルバム ${y}${m}${day}-${hh}${mm}`
}

export const AlbumsPage = () => {
  const [albums, setAlbums] = useState<Album[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const history = useHistory()

  const albumCountLabel = useMemo(() => {
    if (albums.length === 0) {
      return 'アルバムはまだありません'
    }
    return `${albums.length}件のアルバム`
  }, [albums.length])

  useEffect(() => {
    let cancelled = false

    void listAlbums()
      .then((data) => {
        if (!cancelled) {
          setAlbums(data)
          setError(null)
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'アルバム一覧の取得に失敗しました。')
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
  }, [])

  const onFabClick = () => {
    fileInputRef.current?.click()
  }

  const onCaptureNewAlbum = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const [file] = event.target.files ?? []
    event.target.value = ''

    if (!file) {
      return
    }

    const name = window.prompt('アルバム名を入力してください', defaultAlbumTitle())?.trim()
    if (!name) {
      return
    }

    try {
      setBusy(true)
      setError(null)

      const album = await createAlbum(name)
      const prepared = await resizeImageToJpeg(file, MAX_IMAGE_EDGE, JPEG_QUALITY)
      await addPhotoToAlbum(album.id, prepared)

      const data = await listAlbums()
      setAlbums(data)
      history.push(`/albums/${album.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'アルバム作成に失敗しました。')
    } finally {
      setBusy(false)
    }
  }

  return (
    <IonPage>
      <IonHeader translucent>
        <IonToolbar>
          <IonTitle>Albums</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen>
        <section className="screen ion-padding-top ion-padding-horizontal">
          <p className="page-subtitle">{albumCountLabel}</p>

          {error && <p className="error-banner">{error}</p>}

          {loading ? (
            <p className="state-text">読み込み中...</p>
          ) : albums.length === 0 ? (
            <p className="state-text">右下のボタンから撮影してアルバムを作成できます。</p>
          ) : (
            <IonList inset className="album-list" aria-label="アルバム一覧">
              {albums.map((album) => (
                <IonItem
                  key={album.id}
                  button
                  detail
                  onClick={() => {
                    history.push(`/albums/${album.id}`)
                  }}
                >
                  <IonLabel className="album-row">
                    <h2 className="album-title">{album.title}</h2>
                    <p className="album-meta">更新: {formatDateTime(album.updatedAt)}</p>
                  </IonLabel>
                  <IonNote slot="end">{album.photoCount}枚</IonNote>
                </IonItem>
              ))}
            </IonList>
          )}
        </section>

        <IonFab slot="fixed" vertical="bottom" horizontal="end">
          <IonFabButton
            onClick={onFabClick}
            disabled={busy}
            aria-label="撮影して新規アルバムを作成"
          >
            {busy ? <IonText>...</IonText> : <IonIcon icon={add} />}
          </IonFabButton>
        </IonFab>
      </IonContent>

      <input
        ref={fileInputRef}
        hidden
        className="visually-hidden"
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onCaptureNewAlbum}
      />
    </IonPage>
  )
}
