import {
	IonActionSheet,
	IonButton,
	IonButtons,
	IonCol,
	IonContent,
	IonFab,
	IonFabButton,
	IonFooter,
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
import { add, checkmarkCircle, ellipsisHorizontal } from 'ionicons/icons'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAppModal } from '../components/appModalContext'
import { JPEG_QUALITY, MAX_IMAGE_EDGE } from '../config/constants'
import {
	addPhotoToAlbum,
	deleteAlbumWithPhotos,
	deletePhotosFromAlbum,
	getAlbum,
	listAlbums,
	listPhotosByAlbum,
	movePhotosToAlbum,
	renameAlbumTitle,
} from '../lib/db'
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
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([])
  const [albumOptions, setAlbumOptions] = useState<Album[]>([])
  const [moveSheetOpen, setMoveSheetOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const router = useIonRouter()
  const menuTriggerId = 'album-detail-menu-trigger'
  const modal = useAppModal()

  const fetchAlbumData = async (id: string) => {
    const [albumData, photoData] = await Promise.all([getAlbum(id), listPhotosByAlbum(id)])

    if (!albumData) {
      throw new Error('アルバムが見つかりません。')
    }

    return {
      albumData,
      photoData,
    }
  }

  useEffect(() => {
    let cancelled = false

    if (!albumId) {
      return () => {
        cancelled = true
      }
    }

    void fetchAlbumData(albumId)
      .then(({ albumData, photoData }) => {
        if (cancelled) {
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

    const title = (await modal.prompt({
      title: 'アルバム名変更',
      message: '新しいアルバム名を入力してください。',
      defaultValue: album.title,
      placeholder: 'アルバム名',
      confirmText: '変更',
      cancelText: 'キャンセル',
    }))?.trim()
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
      const { albumData, photoData } = await fetchAlbumData(albumId)
      setAlbum(albumData)
      setPhotos(photoData)
    } catch (e) {
      setError(e instanceof Error ? e.message : '画像追加に失敗しました。')
    } finally {
      setBusy(false)
    }
  }

  const toggleSelectionMode = () => {
    setSelectionMode((current) => {
      if (current) {
        setSelectedPhotoIds([])
      }

      return !current
    })
  }

  const toggleSelectPhoto = (photoId: string) => {
    setSelectedPhotoIds((current) => {
      if (current.includes(photoId)) {
        return current.filter((id) => id !== photoId)
      }

      return [...current, photoId]
    })
  }

  const onDeleteSelected = async () => {
    if (!album || selectedPhotoIds.length === 0) {
      return
    }

    const ok = await modal.confirm({
      title: '画像を削除',
      message: `選択中の${selectedPhotoIds.length}件を削除しますか？`,
      confirmText: '削除',
      cancelText: 'キャンセル',
    })
    if (!ok) {
      return
    }

    try {
      setBusy(true)
      setError(null)
      await deletePhotosFromAlbum(album.id, selectedPhotoIds)
      const { albumData, photoData } = await fetchAlbumData(album.id)
      setAlbum(albumData)
      setPhotos(photoData)
      setSelectedPhotoIds([])
      setSelectionMode(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : '画像削除に失敗しました。')
    } finally {
      setBusy(false)
    }
  }

  const onOpenMoveSheet = async () => {
    if (!album || selectedPhotoIds.length === 0) {
      return
    }

    try {
      const allAlbums = await listAlbums()
      const candidates = allAlbums.filter((item) => item.id !== album.id)
      if (candidates.length === 0) {
        setError('移動先のアルバムがありません。')
        return
      }

      setAlbumOptions(candidates)
      setMoveSheetOpen(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : '移動先アルバムの取得に失敗しました。')
    }
  }

  const onMoveSelected = async (targetAlbumId: string) => {
    if (!album || selectedPhotoIds.length === 0) {
      return
    }

    try {
      setBusy(true)
      setError(null)
      await movePhotosToAlbum(album.id, targetAlbumId, selectedPhotoIds)
      const { albumData, photoData } = await fetchAlbumData(album.id)
      setAlbum(albumData)
      setPhotos(photoData)
      setSelectedPhotoIds([])
      setSelectionMode(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : '画像移動に失敗しました。')
    } finally {
      setBusy(false)
    }
  }

  const onDeleteAlbum = async () => {
    if (!album) {
      return
    }

    const ok = await modal.confirm({
      title: 'アルバム削除',
      message: `「${album.title}」を削除します。紐づく画像もすべて削除されます。`,
      confirmText: '削除',
      cancelText: 'キャンセル',
    })
    if (!ok) {
      return
    }

    try {
      setBusy(true)
      setError(null)
      await deleteAlbumWithPhotos(album.id)
      router.push('/', 'back')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'アルバム削除に失敗しました。')
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
                      className={`tile-button ${selectedPhotoIds.includes(photo.id) ? 'is-selected' : ''}`}
                      onClick={() => {
                        if (selectionMode) {
                          toggleSelectPhoto(photo.id)
                          return
                        }

                        router.push(`/albums/${album.id}/photos/${photo.id}`, 'forward')
                      }}
                    >
                      <article className="tile">
                        <img src={photo.src} alt="撮影画像" loading="lazy" decoding="async" />
                        <p>{formatDateTime(photo.createdAt)}</p>
                        {selectionMode && (
                          <span className="tile-checkmark" aria-hidden="true">
                            <IonIcon icon={checkmarkCircle} />
                          </span>
                        )}
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
            <IonItem button onClick={toggleSelectionMode}>
              {selectionMode ? '選択モード終了' : '選択モード開始'}
            </IonItem>
            <IonItem button onClick={() => void onDeleteAlbum()}>
              アルバム削除
            </IonItem>
          </IonList>
        </IonPopover>

        <IonActionSheet
          isOpen={moveSheetOpen}
          onDidDismiss={() => setMoveSheetOpen(false)}
          header="移動先アルバムを選択"
          buttons={[
            ...albumOptions.map((option) => ({
              text: option.title,
              handler: () => {
                void onMoveSelected(option.id)
              },
            })),
            {
              text: 'キャンセル',
              role: 'cancel' as const,
            },
          ]}
        />
      </IonContent>

      {selectionMode && (
        <IonFooter>
          <IonToolbar>
            <div className="selection-actions">
              <span>{selectedPhotoIds.length}件選択中</span>
              <div className="selection-actions-buttons">
                <IonButton fill="clear" onClick={() => void onOpenMoveSheet()} disabled={busy || selectedPhotoIds.length === 0}>
                  移動
                </IonButton>
                <IonButton fill="clear" color="danger" onClick={() => void onDeleteSelected()} disabled={busy || selectedPhotoIds.length === 0}>
                  削除
                </IonButton>
                <IonButton fill="clear" onClick={toggleSelectionMode} disabled={busy}>
                  完了
                </IonButton>
              </div>
            </div>
          </IonToolbar>
        </IonFooter>
      )}

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
