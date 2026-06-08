import { useCallback, useEffect, useMemo, useState } from 'react'
import { getAlbum, getPhotoById } from '../lib/db'
import type { Album, Photo } from '../types'

export const usePhoto = (albumId?: string, photoId?: string) => {
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

  const applyPhotoUpdate = useCallback((updated: Photo) => {
    setPhoto(updated)
  }, [])

  return {
    album,
    photo,
    loading,
    error,
    photoUrl,
    invalidParams,
    setError,
    applyPhotoUpdate,
  }
}