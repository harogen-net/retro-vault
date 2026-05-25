import { JPEG_QUALITY, MAX_IMAGE_EDGE } from '../config/constants'
import type { PreparedPhoto } from '../types'

const loadFromImageElement = async (file: Blob): Promise<HTMLImageElement> => {
  const imageUrl = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = imageUrl
    await img.decode()
    return img
  } finally {
    URL.revokeObjectURL(imageUrl)
  }
}

const toBlob = (canvas: HTMLCanvasElement, quality: number): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('画像の変換に失敗しました。'))
          return
        }
        resolve(blob)
      },
      'image/jpeg',
      quality,
    )
  })
}

export const resizeImageToJpeg = async (
  file: Blob,
  maxEdge = MAX_IMAGE_EDGE,
  quality = JPEG_QUALITY,
): Promise<PreparedPhoto> => {
  let width: number
  let height: number
  let drawSource: CanvasImageSource
  let closeBitmap: (() => void) | undefined

  if ('createImageBitmap' in window) {
    const bitmap = await createImageBitmap(file)
    width = bitmap.width
    height = bitmap.height
    drawSource = bitmap
    closeBitmap = () => bitmap.close()
  } else {
    const image = await loadFromImageElement(file)
    width = image.naturalWidth
    height = image.naturalHeight
    drawSource = image
  }

  const longest = Math.max(width, height)
  const scale = longest > maxEdge ? maxEdge / longest : 1
  const targetWidth = Math.max(1, Math.round(width * scale))
  const targetHeight = Math.max(1, Math.round(height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = targetWidth
  canvas.height = targetHeight

  const context = canvas.getContext('2d')
  if (!context) {
    closeBitmap?.()
    throw new Error('Canvasの初期化に失敗しました。')
  }

  context.drawImage(drawSource, 0, 0, targetWidth, targetHeight)
  closeBitmap?.()

  const blob = await toBlob(canvas, quality)

  return {
    width: targetWidth,
    height: targetHeight,
    sizeBytes: blob.size,
    mimeType: blob.type,
    blob,
  }
}
