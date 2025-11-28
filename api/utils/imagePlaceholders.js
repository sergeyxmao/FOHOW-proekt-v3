const DEFAULT_BLURHASH = null

async function fetchPreviewDataUrl(previewUrl) {
  if (!previewUrl) return null

  try {
    const response = await fetch(previewUrl)
    if (!response.ok) {
      console.warn(`⚠️ Не удалось скачать превью ${previewUrl}: ${response.status}`)
      return null
    }

    const contentType = response.headers.get('content-type') || 'image/webp'
    const buffer = Buffer.from(await response.arrayBuffer())
    return `data:${contentType};base64,${buffer.toString('base64')}`
  } catch (error) {
    console.warn(`⚠️ Ошибка загрузки превью ${previewUrl}:`, error.message)
    return null
  }
}

async function generateImagePlaceholders({ buffer, mimeType, previewUrl }) {
  let preview_placeholder = await fetchPreviewDataUrl(previewUrl)

  if (!preview_placeholder && buffer) {
    const fallbackMime = mimeType || 'image/webp'
    preview_placeholder = `data:${fallbackMime};base64,${buffer.toString('base64')}`
  }

  return {
    preview_placeholder,
    blurhash: DEFAULT_BLURHASH
  }
}

export { generateImagePlaceholders }
