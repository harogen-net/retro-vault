export interface Album {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  photoCount: number
}

export interface Photo {
  id: string
  albumId: string
  createdAt: number
  width: number
  height: number
  sizeBytes: number
  mimeType: string
  blob: Blob
  memo?: string
}

export interface PreparedPhoto {
  width: number
  height: number
  sizeBytes: number
  mimeType: string
  blob: Blob
}
