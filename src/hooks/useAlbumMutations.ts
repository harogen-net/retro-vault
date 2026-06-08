import { useCallback } from 'react'
import { JPEG_QUALITY, MAX_IMAGE_EDGE, THUMBNAIL_MAX_EDGE } from '../config/constants'
import {
    addImageToPhoto,
    addPhotoToAlbum,
    createAlbum,
    deleteAlbumWithPhotos,
    deletePhotosFromAlbum,
    movePhotosToAlbum,
    renameAlbumTitle,
    updatePhotoMemo,
} from '../lib/db'
import { resizeImageToJpeg } from '../lib/image'

export const useAlbumMutations = () => {
  const createAlbumWithInitialPhoto = useCallback(async (title: string, file: File) => {
    const album = await createAlbum(title)
    const [prepared, thumbnail] = await Promise.all([
      resizeImageToJpeg(file, MAX_IMAGE_EDGE, JPEG_QUALITY),
      resizeImageToJpeg(file, THUMBNAIL_MAX_EDGE, JPEG_QUALITY),
    ])
    await addPhotoToAlbum(album.id, prepared, thumbnail.blob)
    return album
  }, [])

  const addPhotoFromFile = useCallback(async (albumId: string, file: File) => {
    const [prepared, thumbnail] = await Promise.all([
      resizeImageToJpeg(file, MAX_IMAGE_EDGE, JPEG_QUALITY),
      resizeImageToJpeg(file, THUMBNAIL_MAX_EDGE, JPEG_QUALITY),
    ])

    return addPhotoToAlbum(albumId, prepared, thumbnail.blob)
  }, [])

  const addImageToPhotoFromFile = useCallback(async (photoId: string, file: File) => {
    const [prepared, thumbnail] = await Promise.all([
      resizeImageToJpeg(file, MAX_IMAGE_EDGE, JPEG_QUALITY),
      resizeImageToJpeg(file, THUMBNAIL_MAX_EDGE, JPEG_QUALITY),
    ])

    return addImageToPhoto(photoId, prepared, thumbnail.blob)
  }, [])

  const renameAlbum = useCallback((albumId: string, title: string) => {
    return renameAlbumTitle(albumId, title)
  }, [])

  const deleteAlbum = useCallback((albumId: string) => {
    return deleteAlbumWithPhotos(albumId)
  }, [])

  const deletePhotos = useCallback((albumId: string, photoIds: string[]) => {
    return deletePhotosFromAlbum(albumId, photoIds)
  }, [])

  const movePhotos = useCallback(
    (sourceAlbumId: string, targetAlbumId: string, photoIds: string[]) => {
      return movePhotosToAlbum(sourceAlbumId, targetAlbumId, photoIds)
    },
    [],
  )

  const savePhotoMemo = useCallback((photoId: string, memo: string) => {
    return updatePhotoMemo(photoId, memo)
  }, [])

  return {
    createAlbumWithInitialPhoto,
    addPhotoFromFile,
    addImageToPhotoFromFile,
    renameAlbum,
    deleteAlbum,
    deletePhotos,
    movePhotos,
    savePhotoMemo,
  }
}