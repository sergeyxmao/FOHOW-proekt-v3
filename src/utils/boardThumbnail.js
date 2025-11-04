import html2canvas from 'html2canvas'

const CANVAS_SELECTOR = '.canvas-container'

export async function makeBoardThumbnail(canvasElement) {
  const element = canvasElement instanceof HTMLElement
    ? canvasElement
    : document.querySelector(CANVAS_SELECTOR)

  if (!element) {
    return null
  }
  const container = element.closest('.canvas-container') || element

  try {
    if (container instanceof HTMLElement) {
      // Временно скрываем служебные элементы, чтобы получить чистое превью доски
      container.classList.add('canvas-container--capturing')
      await new Promise(resolve => requestAnimationFrame(() => resolve()))
    }
    
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
  } finally {
    if (container instanceof HTMLElement) {
      container.classList.remove('canvas-container--capturing')
    }    
  }
}

export default makeBoardThumbnail
