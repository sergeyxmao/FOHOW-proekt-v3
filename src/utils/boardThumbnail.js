import html2canvas from 'html2canvas'

const CANVAS_SELECTOR = '.canvas-container'

export async function makeBoardThumbnail(canvasElement) {
  const element = canvasElement instanceof HTMLElement
    ? canvasElement
    : document.querySelector(CANVAS_SELECTOR)

  if (!element) {
    return null
  }

  try {
    const deviceScale = Math.max(1, window.devicePixelRatio || 1)
    const captureScale = Math.min(deviceScale, 2)

    const canvas = await html2canvas(element, {
      backgroundColor: null,
      logging: false,
      useCORS: true,
      scale: captureScale
    })

    return canvas.toDataURL('image/png')
  } catch (error) {
    console.error('Не удалось создать миниатюру доски:', error)
    return null
  }
}

export default makeBoardThumbnail
