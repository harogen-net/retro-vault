import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { JPEG_QUALITY, MAX_IMAGE_EDGE } from '../config/constants'
import { addPhotoToAlbum, getAlbum, listPhotosByAlbum } from '../lib/db'
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
          <Link to="/" className="back-link">
            一覧へ戻る
          </Link>
        </main>
      )
    }

    return (
      <main className="screen">
        <p className="state-text">読み込み中...</p>
      </main>
    )
  }

  if (!album) {
    return (
      <main className="screen">
        <p className="error-banner">{error ?? 'アルバムが見つかりません。'}</p>
        <Link to="/" className="back-link">
          一覧へ戻る
        </Link>
      </main>
    )
  }

  return (
    <main className="screen">
      <header className="detail-header">
        <div>
          <Link to="/" className="back-link">
            一覧へ戻る
          </Link>
          <h1>{album.title}</h1>
          <p className="meta-line">作成: {formatDateTime(album.createdAt)}</p>
          <p className="meta-line">更新: {formatDateTime(album.updatedAt)}</p>
          <p className="meta-line">画像: {album.photoCount}枚</p>
        </div>
        <button type="button" className="add-button" onClick={onAddPhotoClick} disabled={busy}>
          {busy ? '追加中...' : '画像を追加'}
        </button>
      </header>

      {error && <p className="error-banner">{error}</p>}

      {photoUrls.length === 0 ? (
        <p className="state-text">まだ画像がありません。上のボタンから追加できます。</p>
      ) : (
        <section className="tiles" aria-label="撮影画像一覧">
          {photoUrls.map((photo) => (
            <article key={photo.id} className="tile">
              <img src={photo.src} alt="撮影画像" loading="lazy" />
              <p>{formatDateTime(photo.createdAt)}</p>
            </article>
          ))}
        </section>
      )}

      <input
        ref={fileInputRef}
        className="visually-hidden"
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onAddPhoto}
      />
    </main>
  )
}
