import { DB_NAME, DB_VERSION } from '../config/constants'
import type { Album, Photo, PreparedPhoto } from '../types'

const ALBUM_STORE = 'albums'
const PHOTO_STORE = 'photos'

let dbPromise: Promise<IDBDatabase> | undefined

const toPromise = <T>(request: IDBRequest<T>): Promise<T> => {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  })
}

const completeTx = (tx: IDBTransaction): Promise<void> => {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'))
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'))
  })
}

const getDb = (): Promise<IDBDatabase> => {
  if (dbPromise) {
    return dbPromise
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result

      if (!db.objectStoreNames.contains(ALBUM_STORE)) {
        const albumStore = db.createObjectStore(ALBUM_STORE, { keyPath: 'id' })
        albumStore.createIndex('by_updatedAt', 'updatedAt')
      }

      if (!db.objectStoreNames.contains(PHOTO_STORE)) {
        const photoStore = db.createObjectStore(PHOTO_STORE, { keyPath: 'id' })
        photoStore.createIndex('by_album_createdAt', ['albumId', 'createdAt'])
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'))
  })

  return dbPromise
}

const newId = (): string => {
  if ('randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export const listAlbums = async (): Promise<Album[]> => {
  const db = await getDb()
  const tx = db.transaction(ALBUM_STORE, 'readonly')
  const store = tx.objectStore(ALBUM_STORE)
  const result = await toPromise(store.getAll())
  await completeTx(tx)

  return result.sort((a, b) => b.updatedAt - a.updatedAt)
}

export const getAlbum = async (albumId: string): Promise<Album | undefined> => {
  const db = await getDb()
  const tx = db.transaction(ALBUM_STORE, 'readonly')
  const store = tx.objectStore(ALBUM_STORE)
  const album = await toPromise(store.get(albumId))
  await completeTx(tx)

  return album
}

export const createAlbum = async (title: string): Promise<Album> => {
  const now = Date.now()
  const album: Album = {
    id: newId(),
    title,
    createdAt: now,
    updatedAt: now,
    photoCount: 0,
  }

  const db = await getDb()
  const tx = db.transaction(ALBUM_STORE, 'readwrite')
  tx.objectStore(ALBUM_STORE).add(album)
  await completeTx(tx)

  return album
}

export const renameAlbumTitle = async (albumId: string, title: string): Promise<Album> => {
  const db = await getDb()
  const tx = db.transaction(ALBUM_STORE, 'readwrite')
  const store = tx.objectStore(ALBUM_STORE)

  const album = (await toPromise(store.get(albumId))) as Album | undefined
  if (!album) {
    tx.abort()
    throw new Error('アルバムが見つかりません。')
  }

  const updatedAlbum: Album = {
    ...album,
    title,
    updatedAt: Date.now(),
  }

  store.put(updatedAlbum)
  await completeTx(tx)
  return updatedAlbum
}

export const deleteAlbumWithPhotos = async (albumId: string): Promise<void> => {
  const db = await getDb()
  const tx = db.transaction([ALBUM_STORE, PHOTO_STORE], 'readwrite')
  const albumStore = tx.objectStore(ALBUM_STORE)
  const photoStore = tx.objectStore(PHOTO_STORE)
  const photoIndex = photoStore.index('by_album_createdAt')

  const album = (await toPromise(albumStore.get(albumId))) as Album | undefined
  if (!album) {
    tx.abort()
    throw new Error('アルバムが見つかりません。')
  }

  const range = IDBKeyRange.bound([albumId, 0], [albumId, Number.MAX_SAFE_INTEGER])
  const photos = (await toPromise(photoIndex.getAll(range))) as Photo[]

  for (const photo of photos) {
    photoStore.delete(photo.id)
  }

  albumStore.delete(albumId)
  await completeTx(tx)
}

export const listPhotosByAlbum = async (albumId: string): Promise<Photo[]> => {
  const db = await getDb()
  const tx = db.transaction(PHOTO_STORE, 'readonly')
  const store = tx.objectStore(PHOTO_STORE)
  const index = store.index('by_album_createdAt')
  const range = IDBKeyRange.bound([albumId, 0], [albumId, Number.MAX_SAFE_INTEGER])
  const photos = await toPromise(index.getAll(range))
  await completeTx(tx)

  return photos.sort((a, b) => b.createdAt - a.createdAt)
}

export const getPhotoById = async (photoId: string): Promise<Photo | undefined> => {
  const db = await getDb()
  const tx = db.transaction(PHOTO_STORE, 'readonly')
  const store = tx.objectStore(PHOTO_STORE)
  const photo = await toPromise(store.get(photoId))
  await completeTx(tx)

  return photo
}

export const addPhotoToAlbum = async (
  albumId: string,
  preparedPhoto: PreparedPhoto,
): Promise<Photo> => {
  const db = await getDb()
  const tx = db.transaction([ALBUM_STORE, PHOTO_STORE], 'readwrite')
  const albumStore = tx.objectStore(ALBUM_STORE)
  const photoStore = tx.objectStore(PHOTO_STORE)

  const album = (await toPromise(albumStore.get(albumId))) as Album | undefined
  if (!album) {
    tx.abort()
    throw new Error('アルバムが見つかりません。')
  }

  const now = Date.now()
  const photo: Photo = {
    id: newId(),
    albumId,
    createdAt: now,
    width: preparedPhoto.width,
    height: preparedPhoto.height,
    sizeBytes: preparedPhoto.sizeBytes,
    mimeType: preparedPhoto.mimeType,
    blob: preparedPhoto.blob,
  }

  photoStore.add(photo)
  albumStore.put({
    ...album,
    photoCount: album.photoCount + 1,
    updatedAt: now,
  })

  await completeTx(tx)
  return photo
}

export const deletePhotosFromAlbum = async (
  albumId: string,
  photoIds: string[],
): Promise<number> => {
  if (photoIds.length === 0) {
    return 0
  }

  const db = await getDb()
  const tx = db.transaction([ALBUM_STORE, PHOTO_STORE], 'readwrite')
  const albumStore = tx.objectStore(ALBUM_STORE)
  const photoStore = tx.objectStore(PHOTO_STORE)

  const album = (await toPromise(albumStore.get(albumId))) as Album | undefined
  if (!album) {
    tx.abort()
    throw new Error('アルバムが見つかりません。')
  }

  let deletedCount = 0
  for (const photoId of photoIds) {
    const photo = (await toPromise(photoStore.get(photoId))) as Photo | undefined
    if (!photo || photo.albumId !== albumId) {
      continue
    }

    photoStore.delete(photoId)
    deletedCount += 1
  }

  albumStore.put({
    ...album,
    photoCount: Math.max(0, album.photoCount - deletedCount),
    updatedAt: Date.now(),
  })

  await completeTx(tx)
  return deletedCount
}

export const movePhotosToAlbum = async (
  sourceAlbumId: string,
  targetAlbumId: string,
  photoIds: string[],
): Promise<number> => {
  if (photoIds.length === 0 || sourceAlbumId === targetAlbumId) {
    return 0
  }

  const db = await getDb()
  const tx = db.transaction([ALBUM_STORE, PHOTO_STORE], 'readwrite')
  const albumStore = tx.objectStore(ALBUM_STORE)
  const photoStore = tx.objectStore(PHOTO_STORE)

  const sourceAlbum = (await toPromise(albumStore.get(sourceAlbumId))) as Album | undefined
  const targetAlbum = (await toPromise(albumStore.get(targetAlbumId))) as Album | undefined
  if (!sourceAlbum || !targetAlbum) {
    tx.abort()
    throw new Error('移動先アルバムが見つかりません。')
  }

  let movedCount = 0
  for (const photoId of photoIds) {
    const photo = (await toPromise(photoStore.get(photoId))) as Photo | undefined
    if (!photo || photo.albumId !== sourceAlbumId) {
      continue
    }

    photoStore.put({
      ...photo,
      albumId: targetAlbumId,
    })
    movedCount += 1
  }

  const now = Date.now()
  albumStore.put({
    ...sourceAlbum,
    photoCount: Math.max(0, sourceAlbum.photoCount - movedCount),
    updatedAt: now,
  })
  albumStore.put({
    ...targetAlbum,
    photoCount: targetAlbum.photoCount + movedCount,
    updatedAt: now,
  })

  await completeTx(tx)
  return movedCount
}
