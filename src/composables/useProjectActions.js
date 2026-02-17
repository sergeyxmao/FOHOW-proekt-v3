import { storeToRefs } from 'pinia'
import html2canvas from 'html2canvas'
import { useCardsStore } from '../stores/cards.js'
import { useConnectionsStore } from '../stores/connections.js'
import { useProjectStore, formatProjectFileName } from '../stores/project.js'
import { useBoardStore } from '../stores/board.js'
import { useCanvasStore } from '../stores/canvas.js'
import { useStickersStore } from '../stores/stickers.js'
import { useImagesStore } from '../stores/images.js'
import { useAnchorsStore } from '../stores/anchors.js'
import { buildConnectionGeometry } from '../utils/canvasGeometry.js'

const imageDataUriCache = new Map()

// Функция для добавления pHYs чанка в PNG для указания DPI
const addPngDpiMetadata = async (blob, dpi) => {
  try {
    const arrayBuffer = await blob.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)

    // Проверяем, что это PNG файл
    const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10]
    for (let i = 0; i < 8; i++) {
      if (bytes[i] !== pngSignature[i]) {
        console.warn('Файл не является валидным PNG')
        return blob
      }
    }

    // Конвертируем DPI в пиксели на метр (PPM)
    // 1 дюйм = 0.0254 метра
    const pixelsPerMeter = Math.round(dpi / 0.0254)

    // Создаем pHYs чанк
    const createPhysChunk = () => {
      const data = new Uint8Array(9)
      const view = new DataView(data.buffer)

      // Пиксели на метр по X (4 байта, big-endian)
      view.setUint32(0, pixelsPerMeter, false)
      // Пиксели на метр по Y (4 байта, big-endian)
      view.setUint32(4, pixelsPerMeter, false)
      // Единица измерения: 1 = метр (1 байт)
      view.setUint8(8, 1)

      return data
    }

    // Вычисляем CRC32
    const crc32 = (data) => {
      let crc = -1
      for (let i = 0; i < data.length; i++) {
        const byte = data[i]
        crc = crc ^ byte
        for (let j = 0; j < 8; j++) {
          if (crc & 1) {
            crc = (crc >>> 1) ^ 0xedb88320
          } else {
            crc = crc >>> 1
          }
        }
      }
      return (crc ^ -1) >>> 0
    }

    const physData = createPhysChunk()
    const physType = new TextEncoder().encode('pHYs')

    // Создаем полный pHYs чанк
    const physChunkLength = physData.length
    const physChunk = new Uint8Array(4 + 4 + physChunkLength + 4)
    const physView = new DataView(physChunk.buffer)

    // Длина данных (4 байта)
    physView.setUint32(0, physChunkLength, false)
    // Тип чанка (4 байта)
    physChunk.set(physType, 4)
    // Данные
    physChunk.set(physData, 8)
    // CRC (4 байта)
    const crcData = new Uint8Array(4 + physChunkLength)
    crcData.set(physType, 0)
    crcData.set(physData, 4)
    const crcValue = crc32(crcData)
    physView.setUint32(8 + physChunkLength, crcValue, false)

    // Находим позицию первого IDAT чанка
    let position = 8 // Пропускаем сигнатуру PNG
    let idatPosition = -1

    while (position < bytes.length) {
      const chunkLength = new DataView(bytes.buffer, position, 4).getUint32(0, false)
      const chunkType = String.fromCharCode(...bytes.slice(position + 4, position + 8))

      if (chunkType === 'IDAT') {
        idatPosition = position
        break
      }

      // Проверяем, есть ли уже pHYs чанк
      if (chunkType === 'pHYs') {
        // Создаем новый массив без старого pHYs чанка
        const beforePhys = bytes.slice(0, position)
        const afterPhys = bytes.slice(position + 4 + 4 + chunkLength + 4)
        const withoutPhys = new Uint8Array(beforePhys.length + afterPhys.length)
        withoutPhys.set(beforePhys)
        withoutPhys.set(afterPhys, beforePhys.length)
        return addPngDpiMetadata(new Blob([withoutPhys], { type: 'image/png' }), dpi)
      }

      position += 4 + 4 + chunkLength + 4
    }

    if (idatPosition === -1) {
      console.warn('IDAT чанк не найден')
      return blob
    }

    // Вставляем pHYs чанк перед IDAT
    const before = bytes.slice(0, idatPosition)
    const after = bytes.slice(idatPosition)
    const result = new Uint8Array(before.length + physChunk.length + after.length)
    result.set(before)
    result.set(physChunk, before.length)
    result.set(after, before.length + physChunk.length)

    return new Blob([result], { type: 'image/png' })
  } catch (error) {
    console.error('Ошибка при добавлении DPI метаданных:', error)
    return blob
  }
}

const normalizeAssetUrl = (src) => {
  try {
    return new URL(src, window.location.href).href
  } catch (_) {
    return src
  }
}

const arrayBufferToBase64 = (buffer) => {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return window.btoa(binary)
}

const imageToDataUri = async (src, imgElement = null) => {
  if (!src) return ''

  // Если уже data URI - возвращаем как есть
  if (src.startsWith('data:')) return src

  const normalized = normalizeAssetUrl(src)
  if (imageDataUriCache.has(normalized)) {
    return imageDataUriCache.get(normalized)
  }

  // Вспомогательная функция для конвертации img в data URI через canvas
  const imgToCanvas = (img) => {
    try {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth || img.width || 100
      canvas.height = img.naturalHeight || img.height || 100
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0)
      return canvas.toDataURL('image/png')
    } catch (e) {
      console.warn('Canvas tainted:', e)
      return null
    }
  }

  try {
    // СПОСОБ 1: Если передан img элемент и он уже загружен (same-origin), используем его
    if (imgElement && imgElement.complete && imgElement.naturalWidth > 0) {
      const dataUri = imgToCanvas(imgElement)
      if (dataUri) {
        imageDataUriCache.set(normalized, dataUri)
        return dataUri
      }
    }

    // СПОСОБ 2: Создаём новый Image с crossOrigin для загрузки
    const loadedDataUri = await new Promise((resolve) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'

      img.onload = () => {
        const dataUri = imgToCanvas(img)
        resolve(dataUri)
      }

      img.onerror = () => {
        console.warn('Не удалось загрузить изображение с crossOrigin:', normalized)
        resolve(null)
      }

      // Таймаут на случай зависания
      setTimeout(() => resolve(null), 10000)

      img.src = normalized
    })

    if (loadedDataUri) {
      imageDataUriCache.set(normalized, loadedDataUri)
      return loadedDataUri
    }

    // СПОСОБ 3: Fallback через fetch (для локальных файлов и серверов с CORS)
    try {
      const response = await fetch(normalized, {
        mode: 'cors',
        credentials: 'same-origin'
      })
      if (response.ok) {
        const buffer = await response.arrayBuffer()
        const mime = response.headers.get('Content-Type') || 'image/png'
        const base64 = arrayBufferToBase64(buffer)
        const dataUri = `data:${mime};base64,${base64}`
        imageDataUriCache.set(normalized, dataUri)
        return dataUri
      }
    } catch (fetchError) {
      console.warn('Fetch failed:', fetchError)
    }

    // СПОСОБ 4: Последняя попытка - используем оригинальный imgElement без crossOrigin
    if (imgElement && imgElement.complete && imgElement.naturalWidth > 0) {
      // Пытаемся нарисовать как есть (может работать для same-origin)
      const dataUri = imgToCanvas(imgElement)
      if (dataUri) {
        imageDataUriCache.set(normalized, dataUri)
        return dataUri
      }
    }

    console.warn('Все способы конвертации изображения не удались:', src)
    return src

  } catch (error) {
    console.warn('Ошибка конвертации изображения:', src, error)
    return src
  }
}

const inlineImages = async (root) => {
  const images = Array.from(root.querySelectorAll('img'))

  // Сначала ждём загрузки ВСЕХ изображений
  await Promise.all(
    images.map(img => {
      // Если изображение уже загружено - ок
      if (img.complete) return Promise.resolve()

      // Иначе ждём события load
      return new Promise((resolve) => {
        const handleLoad = () => {
          img.removeEventListener('load', handleLoad)
          img.removeEventListener('error', handleLoad)
          resolve()
        }
        img.addEventListener('load', handleLoad)
        img.addEventListener('error', handleLoad)

        // Таймаут на случай зависания
        setTimeout(handleLoad, 5000)
      })
    })
  )

  // Теперь конвертируем все изображения в data URI
  await Promise.all(
    images.map(async (img) => {
      const src = img.getAttribute('src')

      // Пропускаем пустые src
      if (!src) return

      // Если уже data URI - пропускаем
      if (src.startsWith('data:')) return

      try {
        // Конвертируем в data URI, передаём сам элемент для более быстрой обработки
        const dataUri = await imageToDataUri(src, img)
        if (dataUri && dataUri !== src) {
          img.setAttribute('src', dataUri)
        }
      } catch (error) {
        console.warn(`✗ Не удалось конвертировать изображение: ${src}`, error)
      }
    })
  )
}

const parseTransform = (transform) => {
  if (!transform || transform === 'none') {
    return { x: 0, y: 0, scale: 1 }
  }

  const match = transform.match(/matrix\(([^)]+)\)/)
  if (!match) {
    return { x: 0, y: 0, scale: 1 }
  }

  const values = match[1].split(',').map(v => parseFloat(v.trim()))
  if (values.length < 6 || values.some(value => Number.isNaN(value))) {
    return { x: 0, y: 0, scale: 1 }
  }

  const [a, b,, , e, f] = values
  const scale = Math.sqrt(a * a + b * b) || 1
  return { x: e || 0, y: f || 0, scale }
}

const buildViewOnlyScript = ({ x, y, scale }) => `\n<script>\ndocument.addEventListener('DOMContentLoaded', () => {\n  const root = document.getElementById('canvas')\n  if (!root) return\n  const canvas = root.querySelector('.canvas-content')\n  if (!canvas) return\n  \n  let currentX = ${x}\n  let currentY = ${y}\n  let currentScale = ${scale}\n  \n  const MIN_SCALE = 0.01\n  const MAX_SCALE = 5\n  \n  const updateTransform = () => {\n    canvas.style.transform = 'matrix(' + currentScale + ', 0, 0, ' + currentScale + ', ' + currentX + ', ' + currentY + ')'\n    const zoomBtn = document.getElementById('zoom-btn')\n    if (zoomBtn) {\n      const zoomValue = zoomBtn.querySelector('.zoom-value')\n      if (zoomValue) {\n        zoomValue.textContent = Math.round(currentScale * 100) + '%'\n      }\n    }\n  }\n  \n  updateTransform()\n  \n  // Mouse/Touch pan state\n  let isDragging = false\n  let startX = 0\n  let startY = 0\n  \n  // Touch pinch-zoom state\n  const activeTouches = new Map()\n  let isPinching = false\n  let pinchState = null\n  \n  // Mouse events (desktop)\n  canvas.addEventListener('mousedown', (event) => {\n    if (event.button !== 0) return\n    isDragging = true\n    startX = event.clientX - currentX\n    startY = event.clientY - currentY\n    canvas.style.cursor = 'grabbing'\n  })\n  \n  window.addEventListener('mousemove', (event) => {\n    if (!isDragging) return\n    currentX = event.clientX - startX\n    currentY = event.clientY - startY\n    updateTransform()\n  })\n  \n  window.addEventListener('mouseup', () => {\n    if (!isDragging) return\n    isDragging = false\n    canvas.style.cursor = 'grab'\n  })\n  \n  window.addEventListener('wheel', (event) => {\n    event.preventDefault()\n    \n    const delta = -event.deltaY * 0.0005\n    const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, currentScale + delta))\n    \n    const rect = canvas.getBoundingClientRect()\n    const mouseX = event.clientX - rect.left\n    const mouseY = event.clientY - rect.top\n    \n    const scaleRatio = newScale / currentScale\n    \n    currentX = mouseX - (mouseX - currentX) * scaleRatio\n    currentY = mouseY - (mouseY - currentY) * scaleRatio\n    currentScale = newScale\n    \n    updateTransform()\n  }, { passive: false })\n  \n  // Touch events (mobile)\n  canvas.addEventListener('touchstart', (event) => {\n    event.preventDefault()\n    \n    Array.from(event.changedTouches).forEach(touch => {\n      activeTouches.set(touch.identifier, {\n        x: touch.clientX,\n        y: touch.clientY\n      })\n    })\n    \n    if (activeTouches.size === 1) {\n      // Single finger - start panning\n      const touch = Array.from(activeTouches.values())[0]\n      isDragging = true\n      startX = touch.x - currentX\n      startY = touch.y - currentY\n      isPinching = false\n    } else if (activeTouches.size === 2) {\n      // Two fingers - start pinch-zoom\n      const touches = Array.from(activeTouches.values())\n      const t1 = touches[0]\n      const t2 = touches[1]\n      const distance = Math.hypot(t1.x - t2.x, t1.y - t2.y)\n      \n      // Сохраняем центр между пальцами ОТНОСИТЕЛЬНО canvas\n      const rect = canvas.getBoundingClientRect()\n      const centerX = (t1.x + t2.x) / 2 - rect.left\n      const centerY = (t1.y + t2.y) / 2 - rect.top\n      \n      pinchState = {\n        initialDistance: distance,\n        initialScale: currentScale,\n        initialX: currentX,\n        initialY: currentY,\n        centerX: centerX,\n        centerY: centerY\n      }\n      isPinching = true\n      isDragging = false\n    }\n  }, { passive: false })\n  \n  canvas.addEventListener('touchmove', (event) => {\n    event.preventDefault()\n    \n    Array.from(event.changedTouches).forEach(touch => {\n      if (activeTouches.has(touch.identifier)) {\n        activeTouches.set(touch.identifier, {\n          x: touch.clientX,\n          y: touch.clientY\n        })\n      }\n    })\n    \n    if (isPinching && activeTouches.size === 2 && pinchState) {\n      // Pinch-zoom gesture\n      const touches = Array.from(activeTouches.values())\n      const t1 = touches[0]\n      const t2 = touches[1]\n      const currentDistance = Math.hypot(t1.x - t2.x, t1.y - t2.y)\n      \n      const scaleRatio = currentDistance / pinchState.initialDistance\n      const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, pinchState.initialScale * scaleRatio))\n      \n      // Масштабируем относительно сохранённого центра между пальцами\n      const actualScaleRatio = newScale / pinchState.initialScale\n      currentX = pinchState.centerX - (pinchState.centerX - pinchState.initialX) * actualScaleRatio\n      currentY = pinchState.centerY - (pinchState.centerY - pinchState.initialY) * actualScaleRatio\n      currentScale = newScale\n      \n      updateTransform()\n    } else if (isDragging && activeTouches.size === 1) {\n      // Single finger panning\n      const touch = Array.from(activeTouches.values())[0]\n      currentX = touch.x - startX\n      currentY = touch.y - startY\n      updateTransform()\n    }\n  }, { passive: false })\n  \n  const handleTouchEnd = (event) => {\n    event.preventDefault()\n    \n    Array.from(event.changedTouches).forEach(touch => {\n      activeTouches.delete(touch.identifier)\n    })\n    \n    if (activeTouches.size < 2) {\n      isPinching = false\n      pinchState = null\n    }\n    \n    if (activeTouches.size === 0) {\n      isDragging = false\n    } else if (activeTouches.size === 1) {\n      // Restart panning with remaining finger\n      const touch = Array.from(activeTouches.values())[0]\n      isDragging = true\n      startX = touch.x - currentX\n      startY = touch.y - currentY\n    }\n  }\n  \n  canvas.addEventListener('touchend', handleTouchEnd, { passive: false })\n  canvas.addEventListener('touchcancel', handleTouchEnd, { passive: false })\n  \n  const fitToContent = () => {\n    const cards = canvas.querySelectorAll('.card')\n    if (!cards || cards.length === 0) return\n    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity\n    cards.forEach(card => {\n      // Получаем координаты напрямую из CSS стилей, без учёта transform\n      const style = card.style\n      const left = parseFloat(style.left) || 0\n      const top = parseFloat(style.top) || 0\n      const width = parseFloat(style.width) || card.offsetWidth\n      const height = parseFloat(style.height) || card.offsetHeight\n      minX = Math.min(minX, left)\n      minY = Math.min(minY, top)\n      maxX = Math.max(maxX, left + width)\n      maxY = Math.max(maxY, top + height)\n    })\n    const contentWidth = maxX - minX\n    const contentHeight = maxY - minY\n    const rootRect = root.getBoundingClientRect()\n    const padding = 100\n    const scaleX = (rootRect.width - padding * 2) / contentWidth\n    const scaleY = (rootRect.height - padding * 2) / contentHeight\n    const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, Math.min(scaleX, scaleY)))\n    // Вычисляем центр контента в оригинальных координатах\n    const centerX = (minX + maxX) / 2\n    const centerY = (minY + maxY) / 2\n    // Позиционируем так, чтобы центр контента был в центре экрана\n    currentX = rootRect.width / 2 - centerX * newScale\n    currentY = rootRect.height / 2 - centerY * newScale\n    currentScale = newScale\n    updateTransform()\n  }\n  \n  const zoomBtn = document.getElementById('zoom-btn')\n  if (zoomBtn) {\n    zoomBtn.addEventListener('click', fitToContent)\n  }\n  \n  canvas.style.cursor = 'grab'\n})\n</script>\n`

const getExportHtmlCss = () => `
  html,body{margin:0;height:100%;font-family:'Inter',system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#111827;background:#f3f4f6;}
  #canvas{position:relative;width:100%;height:100%;overflow:hidden;font-family:'Inter',system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;}
  #canvas .canvas-container{position:absolute;inset:0;overflow:visible;touch-action:none;}
  #canvas .zoom-button{position:absolute;left:20px;top:20px;z-index:5000;display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:14px 18px;border-radius:22px;background:rgba(255,255,255,0.92);color:#111827;font-weight:700;font-size:16px;line-height:1;letter-spacing:0.2px;text-decoration:none;box-shadow:0 12px 28px rgba(15,23,42,0.16);border:1px solid rgba(15,23,42,0.14);pointer-events:auto;user-select:none;transition:transform .2s ease,box-shadow .2s ease,filter .2s ease;cursor:pointer;}
  #canvas .zoom-button:hover{transform:none;filter:brightness(1.02);box-shadow:0 18px 32px rgba(15,23,42,0.22);}
  #canvas .zoom-button:active{transform:none;filter:brightness(0.98);box-shadow:0 8px 18px rgba(15,23,42,0.22);}
  #canvas .zoom-button .zoom-value{font-variant-numeric:tabular-nums;}
  #canvas .marketing-watermark{position:absolute;left:20px;bottom:20px;z-index:5000;display:inline-flex;align-items:center;gap:12px;padding:12px 16px;border-radius:18px;background:rgba(255,255,255,0.9);color:#0f172a;box-shadow:0 14px 28px rgba(15,23,42,0.18);font-weight:600;text-decoration:none;transition:transform 0.2s ease, box-shadow 0.2s ease;}
  #canvas .marketing-watermark:hover{transform:translateY(-1px);box-shadow:0 18px 36px rgba(15,23,42,0.2);}
  #canvas .marketing-watermark:active{transform:translateY(0);box-shadow:0 8px 18px rgba(15,23,42,0.22);}
  #canvas .canvas-content{position:absolute;top:0;left:0;width:100%;height:100%;transform-origin:0 0;}
  #canvas .svg-layer{position:absolute;inset:0;pointer-events:none;overflow:visible;}
  #canvas .line-group{pointer-events:none;}
  #canvas .line{fill:none;stroke:currentColor;stroke-linecap:round;stroke-linejoin:round;filter:drop-shadow(0 0 5px rgba(15,23,42,0.12));}
  #canvas .line.line--balance-highlight{stroke-dasharray:16;animation:lineBalanceFlow 2s ease-in-out infinite;}
  #canvas .line.line--pv-highlight{stroke-dasharray:14;animation:linePvFlow 2s ease-in-out infinite;}
  @keyframes lineBalanceFlow{0%{stroke-dashoffset:-24;}50%{stroke:#d93025;}100%{stroke-dashoffset:24;}}
  @keyframes linePvFlow{0%{stroke-dashoffset:-18;}50%{stroke:#0f62fe;}100%{stroke-dashoffset:18;}}
  #canvas .cards-container{position:absolute;inset:0;pointer-events:none;}
  #canvas .card{position:absolute;display:flex;flex-direction:column;align-items:stretch;box-sizing:border-box;border-radius:26px;overflow:visible;background:rgba(255,255,255,0.92);box-shadow:0 18px 48px rgba(15,23,42,0.18);border:1px solid rgba(15,23,42,0.08);}
  #canvas .card-title{display:flex;align-items:center;justify-content:center;width:100%;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:18px 12px;font-size:18px;font-weight:700;letter-spacing:0.01em;color:#0f172a;}
  #canvas .card-body{padding:20px 20px 60px;display:flex;flex-direction:column;align-items:center;gap:12px;text-align:center;color:#111827;font-size:16px;}
  #canvas .card-row{display:flex;align-items:center;justify-content:center;gap:10px;text-align:center;flex-wrap:nowrap;white-space:nowrap;width:100%;}
  #canvas .label{color:#6b7280;font-weight:700;font-size:24px;text-align:center;max-width:100%;word-break:break-word;overflow-wrap:anywhere;}
  #canvas .value{color:#111827;font-weight:700;font-size:28px;outline:none;padding:3px 6px;border-radius:6px;line-height:1.5;}
  #canvas .pv-row .value{font-size:28px;font-weight:700;}
  #canvas .pv-separator{font-size:28px;font-weight:700;}
  #canvas .pv-value-container{display:flex;align-items:center;gap:2px;white-space:nowrap;flex-wrap:nowrap;}
  #canvas .pv-row{flex-wrap:nowrap;}
  #canvas .coin-icon{width:32px;height:32px;flex-shrink:0;}
  #canvas .slf-badge,#canvas .fendou-badge,#canvas .rank-badge{position:absolute;display:none;pointer-events:none;user-select:none;}
  #canvas .slf-badge.visible{display:block;top:15px;left:15px;font-size:36px;font-weight:900;color:#ffc700;text-shadow:1px 2px 6px rgba(15,23,42,0.35);}
  #canvas .fendou-badge.visible{display:block;top:-25px;left:50%;transform:translateX(-50%);font-size:56px;font-weight:900;color:#ef4444;text-shadow:1px 2px 6px rgba(15,23,42,0.35);}
  #canvas .rank-badge.visible{display:block;top:-15px;right:15px;width:80px;height:auto;transform:rotate(15deg);}
  #canvas .card-body-html{margin-top:8px;text-align:left;width:100%;font-size:14px;line-height:1.45;color:#111827;}
  #canvas .card--large .card-body,#canvas .card--gold .card-body{justify-content:center;align-items:center;padding-left:20px;}
  #canvas .card--large .card-row,#canvas .card--gold .card-row{font-size:18px;line-height:1.6;justify-content:center;text-align:center;}
  #canvas .card--large .card-row .label,#canvas .card--gold .card-row .label{font-size:29px;}
  #canvas .card--large .card-row .value,#canvas .card--gold .card-row .value{font-size:31px;font-weight:700;}
  #canvas .card--large .pv-value-left,#canvas .card--large .pv-value-right,#canvas .card--large .pv-separator,#canvas .card--gold .pv-value-left,#canvas .card--gold .pv-value-right,#canvas .card--gold .pv-separator{font-size:31px;font-weight:700;}
  #canvas .card--large .card-title,#canvas .card--gold .card-title{font-size:32px;font-weight:900;}
  #canvas [data-side]{display:none;}
`

const getExportSvgCss = () => `
  ${getExportHtmlCss()}
  #canvas{overflow:visible;}
  #canvas .canvas-container{overflow:visible;}
  #canvas .canvas-content{overflow:visible;}
  #canvas .cards-container{overflow:visible;}
  #canvas .svg-layer{overflow:visible !important;}
  #canvas .line-group{pointer-events:none !important;}
  #canvas .line{pointer-events:none !important;}
  #canvas .note-window{position:absolute;background:#fff;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.15);min-width:200px;min-height:200px;display:flex;flex-direction:column;overflow:hidden;border:1px solid rgba(15,23,42,0.12);transform-origin:top left;}
  #canvas .note-window::after{content:'';position:absolute;inset:0;pointer-events:none;border-radius:inherit;box-shadow:inset 0 0 0 1px rgba(15,23,42,0.04);}
  #canvas .note-header{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:linear-gradient(135deg,rgba(244,67,54,0.12),rgba(255,255,255,0.9));gap:12px;user-select:none;cursor:default;}
  #canvas .note-header__close{border:none;background:rgba(15,23,42,0.08);color:#0f172a;width:28px;height:28px;border-radius:8px;font-size:18px;display:grid;place-items:center;}
  #canvas .note-header__colors{display:flex;align-items:center;gap:10px;margin-left:auto;}
  #canvas .clr-dot{width:18px;height:18px;border-radius:50%;border:2px solid rgba(15,23,42,0.32);box-shadow:0 1px 3px rgba(0,0,0,0.2);}
  #canvas .clr-dot.active{box-shadow:0 0 0 2px rgba(15,23,42,0.22),inset 0 0 0 2px #fff;border-color:rgba(15,23,42,0.65);}
  #canvas .note-calendar{padding:12px 16px 8px;display:flex;flex-direction:column;gap:10px;}
  #canvas .note-calendar__nav{display:flex;align-items:center;justify-content:space-between;gap:12px;}
  #canvas .note-calendar__title{font-weight:600;text-transform:capitalize;color:#0f172a;}
  #canvas .note-calendar__nav-btn{border:none;background:rgba(15,23,42,0.08);color:#0f172a;width:28px;height:28px;border-radius:8px;}
  #canvas .note-calendar__grid{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;}
  #canvas .note-calendar__grid--header{font-size:12px;font-weight:600;color:#475569;text-transform:uppercase;}
  #canvas .note-calendar__weekday{display:grid;place-items:center;}
  #canvas .note-calendar__cell{border:none;background:rgba(241,245,249,0.9);color:#0f172a;height:28px;border-radius:6px;font-size:13px;display:grid;place-items:center;position:relative;}
  #canvas .note-calendar__cell.selected{outline:2px solid var(--note-accent);background:rgba(59,130,246,0.08);}
  #canvas .note-calendar__cell.has-entry{color:#fff;box-shadow:inset 0 0 0 2px rgba(0,0,0,0.08);}
  #canvas .note-calendar__cell.out{opacity:0.4;}
  #canvas .note-editor{padding:0 16px 16px;flex:1;display:flex;}
  #canvas .note-textarea{resize:none;width:100%;flex:1;border:1px solid rgba(15,23,42,0.12);border-radius:10px;padding:10px 12px;font-size:14px;line-height:1.4;font-family:inherit;color:#0f172a;background:rgba(248,250,252,0.85);min-height:calc(1.4em * 3 + 20px);}
  #canvas .note-resize-handle{position:absolute;right:4px;bottom:2px;width:28px;height:28px;border-radius:50%;border:none;background:rgba(15,23,42,0.08);color:#0f172a;display:grid;place-items:center;font-size:18px;}
`

export function useProjectActions() {
  const cardsStore = useCardsStore()
  const connectionsStore = useConnectionsStore()
  const projectStore = useProjectStore()
  const boardStore = useBoardStore()
  const canvasStore = useCanvasStore()
  const stickersStore = useStickersStore()
  const imagesStore = useImagesStore()
  const anchorsStore = useAnchorsStore()

  const {
    backgroundColor,
    isHierarchicalDragMode,
    guidesEnabled,
    gridStep,
    isGridBackgroundVisible
  } = storeToRefs(canvasStore)
  const { normalizedProjectName } = storeToRefs(projectStore)

  const handleSaveProject = () => {
    const projectData = {
      version: '1.0',
      timestamp: Date.now(),
      cards: cardsStore.getCardsForExport(),
      connections: JSON.parse(JSON.stringify(connectionsStore.connections)),
      connectionDefaults: {
        color: connectionsStore.defaultLineColor,
        thickness: connectionsStore.defaultLineThickness,
        highlightType: connectionsStore.defaultHighlightType,
        animationDuration: connectionsStore.defaultAnimationDuration
      },
      canvas: {
        backgroundColor: backgroundColor.value,
        isHierarchicalDragMode: isHierarchicalDragMode.value,
        guidesEnabled: guidesEnabled.value,
        gridStep: gridStep.value,
        isGridBackgroundVisible: isGridBackgroundVisible.value
      }
    }
    const dataStr = JSON.stringify(projectData, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    const baseFileName = formatProjectFileName(normalizedProjectName.value || projectStore.projectName)
    link.download = `${baseFileName}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  // Генерация HTML-контента как blob (для экспорта и шеринга)
  const generateHTMLBlob = async () => {
    const canvasRoot = document.getElementById('canvas')
    if (!canvasRoot) {
      console.warn('Элемент #canvas не найден, экспорт невозможен')
      return null
    }

    const canvasContent = canvasRoot.querySelector('.canvas-content')
    if (!canvasContent) {
      alert('Не удалось найти содержимое холста для экспорта.')
      return null
    }

    if (cardsStore.cards.length === 0 && connectionsStore.connections.length === 0) {
      alert('На доске нет элементов для экспорта.')
      return null
    }

    const clone = canvasRoot.cloneNode(true)

    const selectorsToRemove = [
      '.card-close-btn',
      '.connection-point',
      '.line-hitbox',
      '.selection-box',
      '.card-active-controls',
      '.card-controls',
      '.active-pv-btn',
      '.card-note-btn',
      '[data-role="active-pv-buttons"]'
    ]

    clone.querySelectorAll(selectorsToRemove.join(', ')).forEach((element) => {
      element.remove()
    })

    clone.querySelectorAll('.card').forEach((cardEl) => {
      cardEl.classList.remove('selected', 'connecting', 'editing')
      cardEl.style.cursor = 'default'
    })

    clone.querySelectorAll('[contenteditable]').forEach((element) => {
      element.setAttribute('contenteditable', 'false')
      element.style.pointerEvents = 'none'
      element.style.userSelect = 'text'
    })

    await inlineImages(clone)

    const zoomButton = document.createElement('button')
    zoomButton.id = 'zoom-btn'
    zoomButton.className = 'zoom-button'
    zoomButton.title = 'Автоподгонка масштаба'
    zoomButton.innerHTML = 'Масштаб: <span class="zoom-value">100%</span>'
    clone.appendChild(zoomButton)

    // Добавляем watermark (если его нет в DOM из-за мобильного режима)
    if (!clone.querySelector('.marketing-watermark')) {
      const watermark = document.createElement('a')
      watermark.className = 'marketing-watermark'
      watermark.href = 'https://t.me/MarketingFohow'
      watermark.target = '_blank'
      watermark.rel = 'noopener noreferrer'
      watermark.setAttribute('aria-label', 'Открыть Telegram-канал MarketingFohow')
      watermark.textContent = '@MarketingFohow'
      clone.appendChild(watermark)
    }

    const originalTransform = window.getComputedStyle(canvasContent).transform
    const transformValues = parseTransform(originalTransform)
    const viewOnlyScript = buildViewOnlyScript(transformValues)

    const cssText = getExportHtmlCss()
    const bodyBackground = backgroundColor.value || window.getComputedStyle(document.body).backgroundColor || '#ffffff'

    const htmlContent = `<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"><title>Просмотр схемы</title><style>${cssText}<\/style></head><body style="background:${bodyBackground};">${clone.outerHTML}${viewOnlyScript}</body></html>`

    return new Blob([htmlContent], { type: 'text/html' })
  }

  // Старая функция экспорта (сохранить как)
  const handleExportHTML = async () => {
    const blob = await generateHTMLBlob()
    if (!blob) return

    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    const now = new Date()
    const dateStr = String(now.getDate()).padStart(2, '0') + '.' +
      String(now.getMonth() + 1).padStart(2, '0') + '.' +
      now.getFullYear()
    const baseName = formatProjectFileName(boardStore.currentBoardName || normalizedProjectName.value || projectStore.projectName, 'scheme')
    link.download = `${baseName}_${dateStr}.html`
    link.click()
    URL.revokeObjectURL(url)
  }

  // Новая функция: Сохранить как
  const handleSaveAsHTML = async () => {
    await handleExportHTML()
  }

  // Новая функция: Поделиться проектом через Telegram
  const openTelegramShare = (message) => {
    const encodedMessage = encodeURIComponent(message)
    const telegramAppUrl = `tg://msg_url?text=${encodedMessage}`    
    const telegramShareUrl = `https://t.me/share/url?text=${encodedMessage}`

    const isMobileDevice = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '')

    if (isMobileDevice) {
      const handleVisibilityChange = () => {
        if (document.hidden) {
          clearTimeout(fallbackTimeout)
          document.removeEventListener('visibilitychange', handleVisibilityChange)
        }
      }

      const fallbackTimeout = setTimeout(() => {
        document.removeEventListener('visibilitychange', handleVisibilityChange)
        window.location.href = telegramShareUrl
      }, 700)

      document.addEventListener('visibilitychange', handleVisibilityChange)
      window.location.href = telegramAppUrl
    } else {
      window.open(telegramShareUrl, '_blank')
    }
  }

  const handleShareProject = async () => {
    try {
      const blob = await generateHTMLBlob()
      if (!blob) return

      const now = new Date()
      const dateStr = String(now.getDate()).padStart(2, '0') + '.' +
        String(now.getMonth() + 1).padStart(2, '0') + '.' +
        now.getFullYear()
      const baseName = formatProjectFileName(boardStore.currentBoardName || normalizedProjectName.value || projectStore.projectName, 'project')
      const fileName = `${baseName}_${dateStr}.html`
      const projectFile = new File([blob], fileName, { type: 'text/html' })

      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        const shareData = {
          files: [projectFile],
          title: 'Проект FOHOW',
          text: 'Сохраненный проект в формате HTML'
        }
        const canShareFiles =
          typeof navigator.canShare !== 'function' || navigator.canShare({ files: [projectFile] })

        if (canShareFiles) {
          await navigator.share(shareData)
          return
        }
      }      
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      const shareMessage = `Файл проекта «${fileName}» сохранен на вашем устройстве. Отправьте его в Telegram.`
      openTelegramShare(shareMessage)
    } catch (error) {
      if (error.name === 'AbortError') {
        // User cancelled sharing
      } else {
        console.error('Ошибка при шеринге:', error)
        alert('Не удалось поделиться проектом. Попробуйте скачать файл вручную.')
      }
    }
  }

  const handleExportSVG = async () => {
    try {
      const canvasRoot = document.getElementById('canvas')
      if (!canvasRoot) {
        alert('Не удалось найти холст для экспорта.')
        return
      }

      const cardsList = Array.isArray(cardsStore.cards) ? cardsStore.cards : []
      const connectionsList = Array.isArray(connectionsStore.connections)
        ? connectionsStore.connections
        : []

      if (cardsList.length === 0 && connectionsList.length === 0) {
        alert('На доске нет элементов для экспорта.')
        return
      }

      const cardMap = new Map(cardsList.map(card => [card.id, card]))

      let minX = Infinity
      let minY = Infinity
      let maxX = -Infinity
      let maxY = -Infinity

      cardsList.forEach(card => {
        if (!card) return
        const left = Number.isFinite(card.x) ? card.x : 0
        const top = Number.isFinite(card.y) ? card.y : 0
        const width = Number.isFinite(card.width) ? card.width : 0
        const height = Number.isFinite(card.height) ? card.height : 0

        minX = Math.min(minX, left)
        minY = Math.min(minY, top)
        maxX = Math.max(maxX, left + width)
        maxY = Math.max(maxY, top + height)
      })

      const defaultLineColor = connectionsStore.defaultLineColor || '#4c79ff'
      const defaultLineThickness = connectionsStore.defaultLineThickness || 5
      const connectionGeometries = []

      connectionsList.forEach(connection => {
        const fromCard = cardMap.get(connection.from)
        const toCard = cardMap.get(connection.to)
        if (!fromCard || !toCard) {
          return
        }

        const geometry = buildConnectionGeometry(connection, fromCard, toCard)
        if (!geometry || !geometry.d || !geometry.points.length) {
          return
        }

        const strokeWidth = Number.isFinite(connection.thickness)
          ? connection.thickness
          : defaultLineThickness
        const markerRadius = Math.max(strokeWidth, 8) / 2

        geometry.points.forEach(point => {
          minX = Math.min(minX, point.x - markerRadius)
          minY = Math.min(minY, point.y - markerRadius)
          maxX = Math.max(maxX, point.x + markerRadius)
          maxY = Math.max(maxY, point.y + markerRadius)
        })

        connectionGeometries.push({
          id: connection.id,
          d: geometry.d,
          color: typeof connection.color === 'string' && connection.color.trim()
            ? connection.color
            : defaultLineColor,
          strokeWidth,
          highlightType: connection.highlightType || null
        })
      })

      if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
        alert('Не удалось вычислить границы контента для экспорта.')
        return
      }

      const padding = 80
      const contentWidth = Math.max(1, maxX - minX)
      const contentHeight = Math.max(1, maxY - minY)
      const totalWidth = contentWidth + padding * 2
      const totalHeight = contentHeight + padding * 2
      const translateX = padding - minX
      const translateY = padding - minY

      const selectorsToRemove = [
        '.card-close-btn',
        '.connection-point',
        '.line-hitbox',
        '.selection-box',
        '.card-active-controls',
        '.card-controls',
        '.active-pv-btn',
        '.card-note-btn',
        '[data-role="active-pv-buttons"]'
      ]
      
      const exportCanvas = document.createElement('div')
      exportCanvas.id = 'canvas'
      exportCanvas.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml')
      exportCanvas.style.position = 'relative'
      exportCanvas.style.width = `${totalWidth}px`
      exportCanvas.style.height = `${totalHeight}px`
      exportCanvas.style.overflow = 'visible'

      const canvasContainer = document.createElement('div')
      canvasContainer.className = 'canvas-container'
      canvasContainer.style.position = 'absolute'
      canvasContainer.style.inset = '0'
      canvasContainer.style.overflow = 'visible'

      const canvasContent = document.createElement('div')
      canvasContent.className = 'canvas-content'
      canvasContent.style.position = 'absolute'
      canvasContent.style.left = '0'
      canvasContent.style.top = '0'
      canvasContent.style.width = `${totalWidth}px`
      canvasContent.style.height = `${totalHeight}px`
      canvasContent.style.transform = 'none'
      canvasContent.style.transformOrigin = '0 0'

      const cardsContainer = document.createElement('div')
      cardsContainer.className = 'cards-container'
      cardsContainer.style.width = `${totalWidth}px`
      cardsContainer.style.height = `${totalHeight}px`
      cardsContainer.style.position = 'relative'
      cardsContainer.style.pointerEvents = 'none'

      cardsList.forEach(card => {
        const original = canvasRoot.querySelector(`[data-card-id="${card.id}"]`)
        if (!original) {
          return
        }

        const cardClone = original.cloneNode(true)
        cardClone.classList.remove('selected', 'connecting', 'editing')
        cardClone.style.cursor = 'default'
        cardClone.style.pointerEvents = 'none'

        selectorsToRemove.forEach(selector => {
          cardClone.querySelectorAll(selector).forEach(el => el.remove())
        })

        cardClone.querySelectorAll('[contenteditable]').forEach(element => {
          element.setAttribute('contenteditable', 'false')
          element.style.pointerEvents = 'none'
          element.style.userSelect = 'text'
        })

        cardClone.querySelectorAll('button').forEach(button => {
          button.setAttribute('disabled', 'disabled')
          button.style.pointerEvents = 'none'
        })

        cardClone.querySelectorAll('input, textarea').forEach(input => {
          input.setAttribute('readonly', 'true')
          input.style.pointerEvents = 'none'
        })

        cardsContainer.appendChild(cardClone)
      })

      canvasContent.appendChild(cardsContainer)
      canvasContainer.appendChild(canvasContent)
      exportCanvas.appendChild(canvasContainer)

      await inlineImages(exportCanvas)
      const cssText = getExportSvgCss()
      const background = backgroundColor.value || '#ffffff'

      const connectionPathsSvg = connectionGeometries.map(connection => {
        const dashArray = connection.highlightType === 'balance'
          ? '16 16'
          : connection.highlightType === 'pv'
            ? '14 14'
            : null

        return `      <path d="${connection.d}" fill="none" stroke="${connection.color}" stroke-width="${connection.strokeWidth}"
        stroke-linecap="round" stroke-linejoin="round" marker-start="url(#marker-dot)" marker-end="url(#marker-dot)" filter="url(#line-shadow)"${dashArray ? ` stroke-dasharray="${dashArray}"` : ''}/>`
      }).join('\n')

      const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${totalHeight}" viewBox="0 0 ${totalWidth} ${totalHeight}" version="1.1">
  <defs>
    <style>${cssText}</style>
    <filter id="line-shadow" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB">
      <feDropShadow dx="0" dy="0" stdDeviation="2.5" flood-color="#0f172a" flood-opacity="0.12"/>
    </filter>
    <filter id="card-shadow" x="-15%" y="-15%" width="130%" height="130%" color-interpolation-filters="sRGB">
      <feDropShadow dx="0" dy="18" stdDeviation="12" flood-color="#0f172a" flood-opacity="0.18"/>
    </filter>
    <marker id="marker-dot" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto" fill="currentColor">
      <circle cx="5" cy="5" r="4"/>
    </marker>    
  </defs>
  <rect x="0" y="0" width="${totalWidth}" height="${totalHeight}" fill="${background}"/>
  <g transform="translate(${translateX} ${translateY})">
    <g class="connections-layer">
${connectionPathsSvg}
    </g>
    <foreignObject x="0" y="0" width="${totalWidth}" height="${totalHeight}" filter="url(#card-shadow)">
      ${exportCanvas.outerHTML}
    </foreignObject>
  </g>
</svg>`

      const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `scheme-${Date.now()}.svg`
      link.click()
      URL.revokeObjectURL(url)

    } catch (error) {
      console.error('Ошибка при экспорте в SVG:', error)
      alert('Экспорт в SVG завершился ошибкой. Подробности в консоли.')
    }
  }

  const handlePrint = async () => {
    try {
      const canvasContainer = document.querySelector('.canvas-container')
      const canvasContent = canvasContainer?.querySelector('.canvas-content')

      if (!canvasContainer || !canvasContent) {
        alert('Не удалось найти холст для печати.')
        return
      }

      // 1. Скрываем все UI элементы
      const tempStyles = []

      // Скрываем все панели и меню
      const uiElements = document.querySelectorAll('.control-panel, .project-menu, .project-menu-wrapper, .side-panel, .top-bar, .zoom-controls, .export-panel-container')
      uiElements.forEach(el => {
        if (el) {
          tempStyles.push({ element: el, property: 'display', originalValue: el.style.display })
          el.style.display = 'none'
        }
      })

      // Скрываем кнопки на карточках
      const cardButtons = canvasContainer.querySelectorAll('.card-close-btn, .card-note-btn, .active-pv-btn, [data-role="active-pv-buttons"], .connection-point')
      cardButtons.forEach(el => {
        tempStyles.push({ element: el, property: 'display', originalValue: el.style.display })
        el.style.display = 'none'
      })

      // Скрываем другие интерактивные элементы
      const interactiveElements = canvasContainer.querySelectorAll('.selection-box, .line-hitbox, .control-point, .resize-handle, .rotation-handle')
      interactiveElements.forEach(el => {
        tempStyles.push({ element: el, property: 'display', originalValue: el.style.display })
        el.style.display = 'none'
      })

      // 2. Добавляем класс для capture
      canvasContainer.classList.add('canvas-container--capturing')

      // 2.5. КРИТИЧНО: Конвертируем все изображения в data URI ДО печати
      const originalImageSources = new Map()
      const allImages = canvasContainer.querySelectorAll('img')
      allImages.forEach((img) => {
        originalImageSources.set(img, img.getAttribute('src'))
      })
      await inlineImages(canvasContainer)

      // 3. ИСПРАВЛЕНИЕ: Подготавливаем SVG-слой для корректного рендеринга при печати
      const svgLayer = canvasContent.querySelector('.svg-layer')
      const originalSvgWidth = svgLayer?.getAttribute('width')
      const originalSvgHeight = svgLayer?.getAttribute('height')
      const originalSvgStyleWidth = svgLayer?.style.width
      const originalSvgStyleHeight = svgLayer?.style.height

      // Получаем размеры видимой области
      const containerRect = canvasContainer.getBoundingClientRect()
      const viewportWidth = containerRect.width
      const viewportHeight = containerRect.height

      // Временно устанавливаем размеры SVG равными видимой области
      if (svgLayer) {
        svgLayer.setAttribute('width', viewportWidth)
        svgLayer.setAttribute('height', viewportHeight)
        svgLayer.style.width = `${viewportWidth}px`
        svgLayer.style.height = `${viewportHeight}px`
        svgLayer.style.overflow = 'visible'
      }

      // Ждём применения стилей
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))

      // 4. ИСПРАВЛЕНИЕ: Создаём изображение с foreignObjectRendering для SVG
      const canvas = await html2canvas(canvasContainer, {
        backgroundColor: backgroundColor.value || '#ffffff',
        logging: false,
        useCORS: true,
        scale: 2, // Удвоенное разрешение для качества
        width: viewportWidth,
        height: viewportHeight,
        windowWidth: viewportWidth,
        windowHeight: viewportHeight,
        x: 0,
        y: 0,
        scrollX: 0,
        scrollY: 0,
        // КРИТИЧНО: Включаем foreignObject для корректного рендеринга SVG
        foreignObjectRendering: true,
        // КРИТИЧНО: Колбэк для исправления SVG в клоне
        onclone: (clonedDoc, clonedElement) => {
          const clonedSvg = clonedElement.querySelector('.svg-layer')
          if (clonedSvg) {
            clonedSvg.setAttribute('width', viewportWidth)
            clonedSvg.setAttribute('height', viewportHeight)
            clonedSvg.style.width = `${viewportWidth}px`
            clonedSvg.style.height = `${viewportHeight}px`
            clonedSvg.style.overflow = 'visible'
          }

          // Убедимся, что карточки видимы
          const cards = clonedElement.querySelectorAll('.card')
          cards.forEach(card => {
            card.style.visibility = 'visible'
            card.style.opacity = '1'
          })
        }
      })

      // 5. ИСПРАВЛЕНИЕ: Восстанавливаем оригинальные размеры SVG
      if (svgLayer) {
        if (originalSvgWidth) svgLayer.setAttribute('width', originalSvgWidth)
        if (originalSvgHeight) svgLayer.setAttribute('height', originalSvgHeight)
        svgLayer.style.width = originalSvgStyleWidth || ''
        svgLayer.style.height = originalSvgStyleHeight || ''
      }

      // 6. Восстанавливаем UI
      canvasContainer.classList.remove('canvas-container--capturing')

      tempStyles.forEach(({ element, property, originalValue }) => {
        if (originalValue) {
          element.style[property] = originalValue
        } else {
          element.style[property] = ''
        }
      })

      // 6.5. Восстанавливаем оригинальные src изображений
      if (originalImageSources && originalImageSources.size > 0) {
        originalImageSources.forEach((originalSrc, img) => {
          if (originalSrc && img.getAttribute('src') !== originalSrc) {
            img.setAttribute('src', originalSrc)
          }
        })
      }

      // 7. Конвертируем canvas в image и открываем окно печати
      const dataUrl = canvas.toDataURL('image/png')

      // Создаём новое окно для печати
      const printWindow = window.open('', '_blank', 'width=800,height=600')

      if (!printWindow) {
        alert('Не удалось открыть окно печати. Проверьте, разрешены ли всплывающие окна.')
        return
      }

      // Формируем HTML для печати
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Печать схемы</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            html, body {
              width: 100%;
              height: 100%;
              overflow: hidden;
            }
            img {
              display: block;
              width: 100%;
              height: 100%;
              object-fit: contain;
              page-break-inside: avoid;
            }
            @media print {
              html, body {
                width: 100%;
                height: 100%;
              }
              img {
                max-width: 100%;
                max-height: 100vh;
                object-fit: contain;
                page-break-inside: avoid;
              }
              @page {
                size: landscape;
                margin: 0.5cm;
              }
            }
          </style>
        </head>
        <body>
          <img src="${dataUrl}" alt="Схема" />
          <script>
            window.onload = function() {
              // Даём время на загрузку изображения
              setTimeout(function() {
                window.print();
                // Закрываем окно после печати (опционально)
                // Закомментируйте следующую строку, если хотите оставить окно открытым
                setTimeout(function() {
                  window.close();
                }, 100);
              }, 500);
            };
          </script>
        </body>
        </html>
      `)

      printWindow.document.close()

    } catch (error) {
      console.error('Ошибка при печати:', error)
      alert('Печать завершилась ошибкой. Подробности в консоли.')
    }
  }

  const handleLoadProject = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,application/json'
    input.onchange = (e) => {
      const file = e.target.files[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = (event) => {
        try {
          const projectData = JSON.parse(event.target.result)
          if (projectData.cards) {
            cardsStore.loadCards(projectData.cards)
          }
          if (projectData.connections) {
            connectionsStore.loadConnections(projectData.connections)
          }
          if (projectData.connectionDefaults) {
            const defaults = projectData.connectionDefaults
            const color = typeof defaults.color === 'string'
              ? defaults.color
              : connectionsStore.defaultLineColor
            const thickness = typeof defaults.thickness === 'number' && !Number.isNaN(defaults.thickness)
              ? defaults.thickness
              : connectionsStore.defaultLineThickness
            const animationDuration = typeof defaults.animationDuration === 'number' && !Number.isNaN(defaults.animationDuration)
              ? defaults.animationDuration
              : connectionsStore.defaultAnimationDuration

            connectionsStore.setDefaultConnectionParameters(color, thickness, animationDuration)

            if (Object.prototype.hasOwnProperty.call(defaults, 'highlightType')) {
              connectionsStore.defaultHighlightType = defaults.highlightType
            }
          }
          if (projectData.canvas && typeof canvasStore.applyState === 'function') {
            canvasStore.applyState(projectData.canvas)
          }
          const baseName = file.name.replace(/\.[^/.]+$/, '')
          projectStore.applyLoadedFileName(baseName)
        } catch (error) {
          console.error('Ошибка при загрузке проекта:', error)
        }
      }
      reader.readAsText(file)
    }
    input.click()
  }

// Вспомогательная функция для восстановления стилей и скачивания
const restoreAndDownload = async (finalCanvas, exportSettings, tempStyles, canvasContainer, originalImageSources = null, lodClassesToRestore = []) => {
  // Убираем класс capturing
  canvasContainer.classList.remove('canvas-container--capturing')

  // Восстанавливаем LOD-классы
  lodClassesToRestore.forEach(cls => canvasContainer.classList.add(cls))

  // Восстанавливаем временные стили
  tempStyles.forEach(({ element, property, originalValue }) => {
    // Поддержка CSS custom properties (setProperty:--var-name)
    if (property.startsWith('setProperty:')) {
      const varName = property.slice('setProperty:'.length)
      if (originalValue) {
        element.style.setProperty(varName, originalValue)
      } else {
        element.style.removeProperty(varName)
      }
      return
    }
    if (originalValue) {
      element.style[property] = originalValue
    } else {
      element.style[property] = ''
    }
  })

  // ВАЖНО: Восстанавливаем оригинальные src изображений после экспорта
  if (originalImageSources && originalImageSources.size > 0) {
    originalImageSources.forEach((originalSrc, img) => {
      if (originalSrc && img.getAttribute('src') !== originalSrc) {
        img.setAttribute('src', originalSrc)
      }
    })
  }

  // Конвертируем в blob и скачиваем
  finalCanvas.toBlob(async (blob) => {
    if (!blob) {
      alert('Не удалось создать изображение.')
      return
    }

    let finalBlob = blob
    if (exportSettings?.dpi) {
      finalBlob = await addPngDpiMetadata(blob, exportSettings.dpi)
    }

    const url = URL.createObjectURL(finalBlob)
    const link = document.createElement('a')

    const now = new Date()
    const dateStr = String(now.getDate()).padStart(2, '0') + '.' +
      String(now.getMonth() + 1).padStart(2, '0')
    const timeStr = String(now.getHours()).padStart(2, '0') + '.' +
      String(now.getMinutes()).padStart(2, '0')

    // Имя файла = название доски + дд.мм_чч.мин
    const boardName = boardStore.currentBoardName || normalizedProjectName.value || projectStore.projectName || 'board'
    // Убираем символы, недопустимые в именах файлов
    const safeBoardName = boardName.replace(/[<>:"/\\|?*]/g, '_').trim()

    link.download = `${safeBoardName} ${dateStr}_${timeStr}.png`

    link.href = url
    link.click()
    URL.revokeObjectURL(url)
  }, 'image/png')
}

const handleExportPNG = async (exportSettings = null) => {
  try {
    const canvasContainer = document.querySelector('.canvas-container')
    const canvasContent = canvasContainer?.querySelector('.canvas-content')

    if (!canvasContainer || !canvasContent) {
      alert('Не удалось найти содержимое холста для экспорта.')
      return
    }

    if (cardsStore.cards.length === 0 && connectionsStore.connections.length === 0) {
      alert('На доске нет элементов для экспорта.')
      return
    }

    // Добавить класс для скрытия UI элементов
    canvasContainer.classList.add('canvas-container--capturing')

    // Временно отключаем LOD-режим: при экспорте карточки должны рендериться полностью
    const lodClasses = ['canvas-container--lod', 'canvas-container--lod-deep', 'canvas-container--lod-minimal', 'canvas-container--lod-ultra']
    const activeLodClasses = lodClasses.filter(cls => canvasContainer.classList.contains(cls))
    activeLodClasses.forEach(cls => canvasContainer.classList.remove(cls))

    // =====================================================
    // КРИТИЧНО: Конвертируем все изображения в data URI ДО экспорта
    // Это необходимо, т.к. html2canvas не может загрузить изображения
    // с внешних URL из-за CORS ограничений
    // =====================================================

    // Сохраняем оригинальные src для восстановления после экспорта
    const originalImageSources = new Map()
    const allImages = canvasContainer.querySelectorAll('img')
    allImages.forEach((img, index) => {
      originalImageSources.set(img, img.getAttribute('src'))
    })

    // Конвертируем все изображения в data URI
    await inlineImages(canvasContainer)

    // ИСПРАВЛЕНИЕ: Дополнительная обработка изображений в avatar-circle
    // Эти изображения могут иметь проблемы с CORS или object-fit
    const avatarCircleImages = canvasContainer.querySelectorAll('.avatar-circle img')
    for (const img of avatarCircleImages) {
      const src = img.getAttribute('src')
      if (src && !src.startsWith('data:')) {
        console.warn(`PNG Export: Изображение аватара не сконвертировано в data URI: ${src.substring(0, 100)}`)
        // Пытаемся конвертировать ещё раз
        try {
          const dataUri = await imageToDataUri(src, img)
          if (dataUri && dataUri.startsWith('data:')) {
            img.setAttribute('src', dataUri)
          }
        } catch (e) {
          console.error(`PNG Export: Ошибка конвертации изображения аватара:`, e)
        }
      }
    }

    // Временные стили
    const tempStyles = []

    // Опция "Скрыть содержимое"
    if (exportSettings?.hideContent) {
      // ИСПРАВЛЕНИЕ: Скрываем заголовки карточек
      const cardTitles = canvasContainer.querySelectorAll('.card-title')
      cardTitles.forEach(el => {
        tempStyles.push({ element: el, property: 'visibility', originalValue: el.style.visibility })
        el.style.visibility = 'hidden'
      })

      // ИСПРАВЛЕНИЕ: Скрываем HTML-содержимое карточек
      const cardBodyHtml = canvasContainer.querySelectorAll('.card-body-html')
      cardBodyHtml.forEach(el => {
        tempStyles.push({ element: el, property: 'visibility', originalValue: el.style.visibility })
        el.style.visibility = 'hidden'
      })

      // ИСПРАВЛЕНИЕ: Скрываем ТОЛЬКО значения (.value), но НЕ подписи (.label)
      const values = canvasContainer.querySelectorAll('.value')
      values.forEach(el => {
        tempStyles.push({ element: el, property: 'visibility', originalValue: el.style.visibility })
        el.style.visibility = 'hidden'
      })

      // ИСПРАВЛЕНИЕ: Скрываем PV (монетка и значения)
      const pvRows = canvasContainer.querySelectorAll('.pv-row, .coin-icon-wrapper, .pv-value-container')
      pvRows.forEach(el => {
        tempStyles.push({ element: el, property: 'visibility', originalValue: el.style.visibility })
        el.style.visibility = 'hidden'
      })

      // Скрыть аватары в карточках
      const cardAvatars = canvasContainer.querySelectorAll('.card-avatar-container, .card-avatar')
      cardAvatars.forEach(el => {
        tempStyles.push({ element: el, property: 'visibility', originalValue: el.style.visibility })
        el.style.visibility = 'hidden'
      })

      // Скрыть отдельные карточки партнёров (UserCard.vue)
      const avatarObjects = canvasContainer.querySelectorAll('.avatar-object')
      avatarObjects.forEach(el => {
        tempStyles.push({ element: el, property: 'visibility', originalValue: el.style.visibility })
        el.style.visibility = 'hidden'
      })

      // Скрыть изображения на канвасе
      const canvasImages = canvasContainer.querySelectorAll('.canvas-image')
      canvasImages.forEach(el => {
        tempStyles.push({ element: el, property: 'visibility', originalValue: el.style.visibility })
        el.style.visibility = 'hidden'
      })
    }

    // Скрыть кнопки управления
    const controlButtons = canvasContainer.querySelectorAll('.card-close-btn, .card-note-btn, .active-pv-btn, [data-role="active-pv-buttons"]')
    controlButtons.forEach(el => {
      tempStyles.push({ element: el, property: 'display', originalValue: el.style.display })
      el.style.display = 'none'
    })

    // Скрыть аватар-круг (card-avatar-container) при экспорте всегда
    const avatarContainers = canvasContainer.querySelectorAll('.card-avatar-container')
    avatarContainers.forEach(el => {
      tempStyles.push({ element: el, property: 'display', originalValue: el.style.display })
      el.style.display = 'none'
    })

    // ИСПРАВЛЕНИЕ: Убираем фиксированную высоту карточек — при увеличенных шрифтах контент может не поместиться
    const allCards = canvasContainer.querySelectorAll('.card')
    allCards.forEach(el => {
      if (el.style.height) {
        tempStyles.push({ element: el, property: 'minHeight', originalValue: el.style.minHeight })
        tempStyles.push({ element: el, property: 'height', originalValue: el.style.height })
        el.style.minHeight = el.style.height
        el.style.height = 'auto'
      }
      // Убираем overflow: hidden чтобы контент не обрезался
      tempStyles.push({ element: el, property: 'overflow', originalValue: el.style.overflow })
      el.style.overflow = 'visible'
    })

    // ИСПРАВЛЕНИЕ: Для больших/Gold карточек убираем padding-left (аватар скрыт) и центрируем
    const largeCardBodies = canvasContainer.querySelectorAll('.card--large .card-body, .card--gold .card-body')
    largeCardBodies.forEach(el => {
      tempStyles.push({ element: el, property: 'paddingLeft', originalValue: el.style.paddingLeft })
      el.style.paddingLeft = '20px'
    })

    // Центрировать card-body и card-row на ВСЕХ карточках
    const allCardBodies = canvasContainer.querySelectorAll('.card-body')
    allCardBodies.forEach(el => {
      tempStyles.push({ element: el, property: 'alignItems', originalValue: el.style.alignItems })
      tempStyles.push({ element: el, property: 'textAlign', originalValue: el.style.textAlign })
      el.style.alignItems = 'center'
      el.style.textAlign = 'center'
    })
    const allCardRows = canvasContainer.querySelectorAll('.card-row')
    allCardRows.forEach(el => {
      tempStyles.push({ element: el, property: 'justifyContent', originalValue: el.style.justifyContent })
      tempStyles.push({ element: el, property: 'textAlign', originalValue: el.style.textAlign })
      tempStyles.push({ element: el, property: 'flexWrap', originalValue: el.style.flexWrap })
      tempStyles.push({ element: el, property: 'whiteSpace', originalValue: el.style.whiteSpace })
      el.style.justifyContent = 'center'
      el.style.textAlign = 'center'
      el.style.flexWrap = 'nowrap'
      el.style.whiteSpace = 'nowrap'
    })

    // Увеличить текст и сделать жирным при экспорте
    const labels = canvasContainer.querySelectorAll('.label')
    labels.forEach(el => {
      const isLargeCard = el.closest('.card--large') || el.closest('.card--gold')
      tempStyles.push({ element: el, property: 'fontSize', originalValue: el.style.fontSize })
      tempStyles.push({ element: el, property: 'fontWeight', originalValue: el.style.fontWeight })
      tempStyles.push({ element: el, property: 'textAlign', originalValue: el.style.textAlign })
      el.style.fontSize = isLargeCard ? '29px' : '24px'
      el.style.fontWeight = '700'
      el.style.textAlign = 'center'
    })
    const values = canvasContainer.querySelectorAll('.value')
    values.forEach(el => {
      const isLargeCard = el.closest('.card--large') || el.closest('.card--gold')
      tempStyles.push({ element: el, property: 'fontSize', originalValue: el.style.fontSize })
      tempStyles.push({ element: el, property: 'fontWeight', originalValue: el.style.fontWeight })
      el.style.fontSize = isLargeCard ? '31px' : '28px'
      el.style.fontWeight = '700'
    })
    // Увеличить PV-разделитель
    const pvSeparators = canvasContainer.querySelectorAll('.pv-separator')
    pvSeparators.forEach(el => {
      const isLargeCard = el.closest('.card--large') || el.closest('.card--gold')
      tempStyles.push({ element: el, property: 'fontSize', originalValue: el.style.fontSize })
      tempStyles.push({ element: el, property: 'fontWeight', originalValue: el.style.fontWeight })
      el.style.fontSize = isLargeCard ? '31px' : '28px'
      el.style.fontWeight = '700'
    })
    const cardTitlesExport = canvasContainer.querySelectorAll('.card-title')
    cardTitlesExport.forEach(el => {
      const isLargeCard = el.closest('.card--large') || el.closest('.card--gold')
      tempStyles.push({ element: el, property: 'fontSize', originalValue: el.style.fontSize })
      tempStyles.push({ element: el, property: 'fontWeight', originalValue: el.style.fontWeight })
      el.style.fontSize = isLargeCard ? '32px' : '28px'
      el.style.fontWeight = '900'
    })

    // Опция "Ч/Б (контур)"
    if (exportSettings?.blackAndWhite) {
      // Белый фон холста: убираем цвет фона и сетку
      tempStyles.push({ element: canvasContainer, property: 'backgroundColor', originalValue: canvasContainer.style.backgroundColor })
      canvasContainer.style.backgroundColor = '#ffffff'
      const canvasContentEl = canvasContainer.querySelector('.canvas-content')
      if (canvasContentEl) {
        tempStyles.push({ element: canvasContentEl, property: 'setProperty:--grid-opacity', originalValue: canvasContentEl.style.getPropertyValue('--grid-opacity') })
        canvasContentEl.style.setProperty('--grid-opacity', '0')
      }

      // ИСПРАВЛЕНИЕ: Применяем Ч/Б ко ВСЕМ карточкам (включая Gold)
      const cards = canvasContainer.querySelectorAll('.card')
      cards.forEach(card => {
        tempStyles.push({ element: card, property: 'background', originalValue: card.style.background })
        tempStyles.push({ element: card, property: 'backgroundColor', originalValue: card.style.backgroundColor })
        tempStyles.push({ element: card, property: 'backgroundImage', originalValue: card.style.backgroundImage })
        tempStyles.push({ element: card, property: 'boxShadow', originalValue: card.style.boxShadow })
        tempStyles.push({ element: card, property: 'border', originalValue: card.style.border })
        tempStyles.push({ element: card, property: 'filter', originalValue: card.style.filter })
        card.style.background = '#ffffff'
        card.style.backgroundColor = '#ffffff'
        card.style.backgroundImage = 'none'
        card.style.boxShadow = 'none'
        card.style.border = '2px solid #000000'
        // КРИТИЧНО: Применяем grayscale ко ВСЕЙ карточке (включая все её дочерние элементы)
        card.style.filter = 'grayscale(100%)'
      })

      // ИСПРАВЛЕНИЕ: Применяем Ч/Б к телу карточки (для Gold карточек с градиентами)
      const cardBodies = canvasContainer.querySelectorAll('.card-body')
      cardBodies.forEach(body => {
        tempStyles.push({ element: body, property: 'background', originalValue: body.style.background })
        tempStyles.push({ element: body, property: 'backgroundColor', originalValue: body.style.backgroundColor })
        tempStyles.push({ element: body, property: 'backgroundImage', originalValue: body.style.backgroundImage })
        body.style.background = '#ffffff'
        body.style.backgroundColor = '#ffffff'
        body.style.backgroundImage = 'none'
      })

      const cardHeaders = canvasContainer.querySelectorAll('.card-header, .card-title')
      cardHeaders.forEach(header => {
        tempStyles.push({ element: header, property: 'background', originalValue: header.style.background })
        tempStyles.push({ element: header, property: 'backgroundColor', originalValue: header.style.backgroundColor })
        tempStyles.push({ element: header, property: 'backgroundImage', originalValue: header.style.backgroundImage })
        tempStyles.push({ element: header, property: 'borderBottom', originalValue: header.style.borderBottom })
        tempStyles.push({ element: header, property: 'color', originalValue: header.style.color })
        tempStyles.push({ element: header, property: 'boxShadow', originalValue: header.style.boxShadow })
        header.style.background = '#ffffff'
        header.style.backgroundColor = '#ffffff'
        header.style.backgroundImage = 'none'
        header.style.borderBottom = 'none'
        header.style.boxShadow = 'none'
        header.style.color = '#000000'
      })

      const coloredElements = canvasContainer.querySelectorAll('.coin-icon, .slf-badge, .fendou-badge, .rank-badge')
      coloredElements.forEach(el => {
        tempStyles.push({ element: el, property: 'visibility', originalValue: el.style.visibility })
        el.style.visibility = 'hidden'
      })

      // ИСПРАВЛЕНИЕ: Применить grayscale к контейнерам И элементам аватаров в карточках
      const cardAvatarContainers = canvasContainer.querySelectorAll('.card-avatar-container')
      cardAvatarContainers.forEach(el => {
        tempStyles.push({ element: el, property: 'filter', originalValue: el.style.filter })
        el.style.filter = 'grayscale(100%)'
      })

      const cardAvatars = canvasContainer.querySelectorAll('.card-avatar')
      cardAvatars.forEach(el => {
        tempStyles.push({ element: el, property: 'filter', originalValue: el.style.filter })
        el.style.filter = 'grayscale(100%)'
      })

      // Применить черно-белый фильтр к отдельным карточкам партнёров (UserCard.vue)
      const avatarObjects = canvasContainer.querySelectorAll('.avatar-object')
      avatarObjects.forEach(el => {
        tempStyles.push({ element: el, property: 'filter', originalValue: el.style.filter })
        el.style.filter = 'grayscale(100%)'
      })

      const avatarCircles = canvasContainer.querySelectorAll('.avatar-circle')
      avatarCircles.forEach(el => {
        tempStyles.push({ element: el, property: 'filter', originalValue: el.style.filter })
        el.style.filter = 'grayscale(100%)'
      })

      const avatarImages = canvasContainer.querySelectorAll('.avatar-circle img')
      avatarImages.forEach(el => {
        tempStyles.push({ element: el, property: 'filter', originalValue: el.style.filter })
        el.style.filter = 'grayscale(100%)'
      })

      // Применить черно-белый фильтр к изображениям на канвасе
      const canvasImages = canvasContainer.querySelectorAll('.canvas-image img, .canvas-image')
      canvasImages.forEach(el => {
        tempStyles.push({ element: el, property: 'filter', originalValue: el.style.filter })
        el.style.filter = 'grayscale(100%)'
      })
    }

    // Сохраняем оригинальный transform
    const originalTransform = canvasContent.style.transform

    let contentCanvas
    let contentWidth
    let contentHeight

    // =====================================================
    // РЕЖИМ 1: Экспорт только видимой области (ИСПРАВЛЕН)
    // =====================================================
    if (exportSettings?.exportOnlyVisible) {
      // Получаем текущие размеры видимой области контейнера
      const containerRect = canvasContainer.getBoundingClientRect()
      contentWidth = containerRect.width
      contentHeight = containerRect.height

      // ИСПРАВЛЕНИЕ: Подготавливаем SVG-слой для корректного захвата
      const svgLayer = canvasContent.querySelector('.svg-layer')
      const originalSvgWidth = svgLayer?.getAttribute('width')
      const originalSvgHeight = svgLayer?.getAttribute('height')
      const originalSvgStyleWidth = svgLayer?.style.width
      const originalSvgStyleHeight = svgLayer?.style.height

      // Временно устанавливаем размеры SVG равными видимой области
      if (svgLayer) {
        svgLayer.setAttribute('width', contentWidth)
        svgLayer.setAttribute('height', contentHeight)
        svgLayer.style.width = `${contentWidth}px`
        svgLayer.style.height = `${contentHeight}px`
        svgLayer.style.overflow = 'visible'
      }

      // Ждём применения стилей
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))

      // Определяем параметры экспорта
      let finalWidth, finalHeight, scale

      if (exportSettings && exportSettings.format !== 'original') {
        let pageWidthMm = exportSettings.width
        let pageHeightMm = exportSettings.height

        if (exportSettings.orientation === 'landscape') {
          [pageWidthMm, pageHeightMm] = [pageHeightMm, pageWidthMm]
        }

        finalWidth = Math.round((pageWidthMm / 25.4) * exportSettings.dpi)
        finalHeight = Math.round((pageHeightMm / 25.4) * exportSettings.dpi)
        scale = exportSettings.dpi / 96
      } else {
        finalWidth = contentWidth
        finalHeight = contentHeight
        scale = 2
      }

      // ИСПРАВЛЕНИЕ: Используем foreignObjectRendering и onclone для SVG
      contentCanvas = await html2canvas(canvasContainer, {
        backgroundColor: exportSettings?.blackAndWhite ? '#ffffff' : (backgroundColor.value || '#ffffff'),
        logging: false,
        useCORS: true,
        scale: scale,
        width: contentWidth,
        height: contentHeight,
        windowWidth: contentWidth,
        windowHeight: contentHeight,
        x: 0,
        y: 0,
        scrollX: 0,
        scrollY: 0,
        // КРИТИЧНО: Включаем foreignObject для SVG
        foreignObjectRendering: true,
        // КРИТИЧНО: Колбэк для исправления SVG в клоне
        onclone: (clonedDoc, clonedElement) => {
          const clonedSvg = clonedElement.querySelector('.svg-layer')
          if (clonedSvg) {
            clonedSvg.setAttribute('width', contentWidth)
            clonedSvg.setAttribute('height', contentHeight)
            clonedSvg.style.width = `${contentWidth}px`
            clonedSvg.style.height = `${contentHeight}px`
            clonedSvg.style.overflow = 'visible'
          }

          // Убедимся, что карточки видимы
          const cards = clonedElement.querySelectorAll('.card')
          cards.forEach(card => {
            card.style.visibility = 'visible'
            card.style.opacity = '1'
          })

          // ИСПРАВЛЕНИЕ: Убедимся, что все изображения (включая аватары) видимы
          const allImages = clonedElement.querySelectorAll('img')
          allImages.forEach(img => {
            img.style.visibility = 'visible'
            img.style.opacity = '1'
            img.style.display = 'block'

            // Если изображение не загружено, пытаемся использовать fallback
            if (!img.complete || img.naturalWidth === 0) {
              console.warn('Изображение не загружено при клонировании:', img.src)
            }
          })

          // ИСПРАВЛЕНИЕ: Убедимся, что аватары видимы
          const avatars = clonedElement.querySelectorAll('.avatar-object, .avatar-circle, .avatar-shape')
          avatars.forEach(avatar => {
            avatar.style.visibility = 'visible'
            avatar.style.opacity = '1'
          })

          // ИСПРАВЛЕНИЕ: Специальная обработка изображений внутри avatar-circle
          // html2canvas не всегда корректно обрабатывает object-fit: cover с border-radius
          const avatarCircleImages = clonedElement.querySelectorAll('.avatar-circle img')
          avatarCircleImages.forEach(img => {
            img.style.visibility = 'visible'
            img.style.opacity = '1'
            img.style.display = 'block'
            // Убедимся, что изображение заполняет контейнер
            img.style.width = '100%'
            img.style.height = '100%'
            img.style.objectFit = 'cover'
            img.style.objectPosition = 'center'
            // Убедимся, что изображение находится в правильной позиции
            img.style.position = 'absolute'
            img.style.top = '0'
            img.style.left = '0'
          })

          // html2canvas НЕ поддерживает object-fit: cover на img элементах
          // Решение: заменяем img на background-image на родительском контейнере
          const avatarCircles = clonedElement.querySelectorAll('.avatar-circle')
          avatarCircles.forEach(circle => {
            const img = circle.querySelector('img')
            if (img && img.src) {
              // Устанавливаем изображение как background на контейнере
              circle.style.backgroundImage = `url(${img.src})`
              circle.style.backgroundSize = 'cover'
              circle.style.backgroundPosition = 'center'
              circle.style.backgroundRepeat = 'no-repeat'
              // Скрываем оригинальный img, так как используем background
              img.style.visibility = 'hidden'
              img.style.opacity = '0'
            }
          })

          // ИСПРАВЛЕНИЕ: Специальная обработка аватаров в карточках (Card.vue)
          // Аватары в Card.vue используют background-image, нужно убедиться что они видимы
          const cardAvatarContainers = clonedElement.querySelectorAll('.card-avatar-container')
          cardAvatarContainers.forEach(container => {
            container.style.visibility = 'visible'
            container.style.opacity = '1'
          })

          const cardAvatars = clonedElement.querySelectorAll('.card-avatar')
          cardAvatars.forEach(avatar => {
            avatar.style.visibility = 'visible'
            avatar.style.opacity = '1'
            // Если аватар использует background-image, убедимся что стили правильные
            const computedStyle = clonedDoc.defaultView.getComputedStyle(avatar)
            if (computedStyle.backgroundImage && computedStyle.backgroundImage !== 'none') {
              avatar.style.backgroundSize = 'cover'
              avatar.style.backgroundPosition = 'center'
              avatar.style.backgroundRepeat = 'no-repeat'
            }
          })

          // ИСПРАВЛЕНИЕ: Убедимся, что изображения на канвасе видимы
          const canvasImages = clonedElement.querySelectorAll('.canvas-image')
          canvasImages.forEach(img => {
            img.style.visibility = 'visible'
            img.style.opacity = '1'
          })
        }
      })

      // Восстанавливаем оригинальные размеры SVG
      if (svgLayer) {
        if (originalSvgWidth) svgLayer.setAttribute('width', originalSvgWidth)
        if (originalSvgHeight) svgLayer.setAttribute('height', originalSvgHeight)
        svgLayer.style.width = originalSvgStyleWidth || ''
        svgLayer.style.height = originalSvgStyleHeight || ''
      }

      // Финализируем canvas
      let finalCanvas

      if (exportSettings && exportSettings.format !== 'original') {
        finalCanvas = document.createElement('canvas')
        finalCanvas.width = finalWidth
        finalCanvas.height = finalHeight

        const ctx = finalCanvas.getContext('2d')
        ctx.fillStyle = exportSettings?.blackAndWhite ? '#ffffff' : (backgroundColor.value || '#ffffff')
        ctx.fillRect(0, 0, finalWidth, finalHeight)

        const scaleX = finalWidth / contentCanvas.width
        const scaleY = finalHeight / contentCanvas.height
        const fitScale = Math.min(scaleX, scaleY)

        const scaledWidth = contentCanvas.width * fitScale
        const scaledHeight = contentCanvas.height * fitScale

        const offsetX = (finalWidth - scaledWidth) / 2
        const offsetY = (finalHeight - scaledHeight) / 2

        ctx.drawImage(
          contentCanvas,
          0, 0, contentCanvas.width, contentCanvas.height,
          offsetX, offsetY, scaledWidth, scaledHeight
        )
      } else {
        finalCanvas = contentCanvas
      }

      // Восстановить стили и скачать
      await restoreAndDownload(finalCanvas, exportSettings, tempStyles, canvasContainer, originalImageSources, activeLodClasses)

    // =====================================================
    // РЕЖИМ 2: Экспорт всей схемы (ИСПРАВЛЕН)
    // =====================================================
    } else {
      // ИСПРАВЛЕНИЕ: Вычисляем границы ВСЕХ элементов (карточки + изображения + стикеры + якоря)
      const cardsList = Array.isArray(cardsStore.cards) ? cardsStore.cards : []
      const imagesList = Array.isArray(imagesStore.images) ? imagesStore.images : []
      const stickersList = Array.isArray(stickersStore.stickers) ? stickersStore.stickers : []
      const anchorsList = Array.isArray(anchorsStore.anchors) ? anchorsStore.anchors : []

      let minX = Infinity
      let minY = Infinity
      let maxX = -Infinity
      let maxY = -Infinity

      // Учитываем карточки
      cardsList.forEach(card => {
        const cardEl = canvasContainer.querySelector(`[data-card-id="${card.id}"]`)
        if (cardEl) {
          const left = card.x
          const top = card.y
          const width = card.width || cardEl.offsetWidth
          const height = card.height || cardEl.offsetHeight

          minX = Math.min(minX, left)
          minY = Math.min(minY, top)
          maxX = Math.max(maxX, left + width)
          maxY = Math.max(maxY, top + height)
        }
      })

      // ИСПРАВЛЕНИЕ: Учитываем изображения
      imagesList.forEach(img => {
        if (!img) return
        minX = Math.min(minX, img.x)
        minY = Math.min(minY, img.y)
        maxX = Math.max(maxX, img.x + (img.width || 0))
        maxY = Math.max(maxY, img.y + (img.height || 0))
      })

      // ИСПРАВЛЕНИЕ: Учитываем стикеры
      stickersList.forEach(sticker => {
        if (!sticker) return
        const stickerX = sticker.pos_x || 0
        const stickerY = sticker.pos_y || 0
        minX = Math.min(minX, stickerX)
        minY = Math.min(minY, stickerY)
        maxX = Math.max(maxX, stickerX + 200) // примерный размер стикера
        maxY = Math.max(maxY, stickerY + 150)
      })

      // ИСПРАВЛЕНИЕ: Учитываем якорные точки
      anchorsList.forEach(anchor => {
        if (!anchor) return
        const anchorX = Number.isFinite(anchor.pos_x) ? anchor.pos_x : (anchor.x || 0)
        const anchorY = Number.isFinite(anchor.pos_y) ? anchor.pos_y : (anchor.y || 0)
        minX = Math.min(minX, anchorX - 12)
        minY = Math.min(minY, anchorY - 12)
        maxX = Math.max(maxX, anchorX + 12)
        maxY = Math.max(maxY, anchorY + 12)
      })

      // Учитываем соединения с точной геометрией линий
      const connectionsList = Array.isArray(connectionsStore.connections) ? connectionsStore.connections : []
      const cardMap = new Map(cardsList.map(card => [card.id, card]))
      const defaultLineThickness = connectionsStore.defaultLineThickness || 5

      connectionsList.forEach(connection => {
        const fromCard = cardMap.get(connection.from)
        const toCard = cardMap.get(connection.to)
        if (!fromCard || !toCard) return

        const geometry = buildConnectionGeometry(connection, fromCard, toCard)
        if (!geometry || !geometry.points || !geometry.points.length) return

        const strokeWidth = Number.isFinite(connection.thickness)
          ? connection.thickness
          : defaultLineThickness
        const markerRadius = Math.max(strokeWidth, 8) / 2

        geometry.points.forEach(point => {
          if (!point) return
          minX = Math.min(minX, point.x - markerRadius - 10)
          minY = Math.min(minY, point.y - markerRadius - 10)
          maxX = Math.max(maxX, point.x + markerRadius + 10)
          maxY = Math.max(maxY, point.y + markerRadius + 10)
        })
      })

      // Fallback если нет элементов
      if (!Number.isFinite(minX)) {
        minX = 0
        minY = 0
        maxX = 1920
        maxY = 1080
      }

      // Добавляем отступы
      const PADDING = 50
      minX -= PADDING
      minY -= PADDING
      maxX += PADDING
      maxY += PADDING

      contentWidth = maxX - minX
      contentHeight = maxY - minY

      // Сохраняем оригинальные значения позиции и transform
      const originalLeft = canvasContent.style.left
      const originalTop = canvasContent.style.top
      const originalTransformOrigin = canvasContent.style.transformOrigin

      // Сбрасываем transform и позиционируем контент для захвата всей области
      canvasContent.style.transform = 'none'
      canvasContent.style.transformOrigin = '0 0'
      canvasContent.style.left = `${-minX}px`
      canvasContent.style.top = `${-minY}px`

      // Расширяем SVG-слой и canvas-слой
      const svgLayer = canvasContent.querySelector('.svg-layer')
      const imagesCanvas = canvasContent.querySelector('.images-canvas-layer')

      const originalSvgWidth = svgLayer?.getAttribute('width')
      const originalSvgHeight = svgLayer?.getAttribute('height')
      const originalSvgStyleWidth = svgLayer?.style.width
      const originalSvgStyleHeight = svgLayer?.style.height
      const originalSvgViewBox = svgLayer?.getAttribute('viewBox')
      const originalCanvasWidth = imagesCanvas?.width
      const originalCanvasHeight = imagesCanvas?.height
      const originalCanvasStyleWidth = imagesCanvas?.style.width
      const originalCanvasStyleHeight = imagesCanvas?.style.height

      if (svgLayer) {
        svgLayer.setAttribute('width', contentWidth)
        svgLayer.setAttribute('height', contentHeight)
        svgLayer.setAttribute('viewBox', `0 0 ${contentWidth} ${contentHeight}`)
        svgLayer.style.width = `${contentWidth}px`
        svgLayer.style.height = `${contentHeight}px`
        svgLayer.style.overflow = 'visible'
      }

      if (imagesCanvas) {
        imagesCanvas.width = contentWidth
        imagesCanvas.height = contentHeight
        imagesCanvas.style.width = `${contentWidth}px`
        imagesCanvas.style.height = `${contentHeight}px`
      }

      const originalContentWidth = canvasContent.style.width
      const originalContentHeight = canvasContent.style.height
      canvasContent.style.width = `${contentWidth}px`
      canvasContent.style.height = `${contentHeight}px`
      
      // Ждём применения новых размеров перед стартом рендеринга изображений
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))

      // ИСПРАВЛЕНИЕ: Диспатчим событие для рендеринга всех изображений с ожиданием
      const renderPromise = new Promise((resolve) => {
        const handleRenderComplete = () => {
          window.removeEventListener('png-export-images-rendered', handleRenderComplete)
          resolve()
        }
        window.addEventListener('png-export-images-rendered', handleRenderComplete)

        // Таймаут на случай, если событие не придёт
        setTimeout(() => {
          window.removeEventListener('png-export-images-rendered', handleRenderComplete)
          resolve()
        }, 3000)
      })

      const exportEvent = new CustomEvent('png-export-render-all-images', {
        detail: {
          contentWidth,
          contentHeight,
          minX,
          minY,
          maxX,
          maxY
        }
      })
      window.dispatchEvent(exportEvent)

      // Ждём завершения рендеринга ИЛИ таймаута
      await renderPromise

      // Дополнительное ожидание для гарантии отрисовки
      await new Promise(resolve => setTimeout(resolve, 500))

      // ИСПРАВЛЕНИЕ: Ждём двух кадров для завершения перерисовки DOM
      // (аналогично режиму экспорта видимой области)
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))

      // Определяем параметры экспорта
      let finalWidth, finalHeight, scale

      if (exportSettings && exportSettings.format !== 'original') {
        let pageWidthMm = exportSettings.width
        let pageHeightMm = exportSettings.height

        if (exportSettings.orientation === 'landscape') {
          [pageWidthMm, pageHeightMm] = [pageHeightMm, pageWidthMm]
        }

        finalWidth = Math.round((pageWidthMm / 25.4) * exportSettings.dpi)
        finalHeight = Math.round((pageHeightMm / 25.4) * exportSettings.dpi)
        scale = exportSettings.dpi / 96
      } else {
        finalWidth = contentWidth
        finalHeight = contentHeight
        scale = 2
      }

      // Захват с улучшенным onclone
      contentCanvas = await html2canvas(canvasContainer, {
        backgroundColor: exportSettings?.blackAndWhite ? '#ffffff' : (backgroundColor.value || '#ffffff'),
        logging: false,
        useCORS: true,
        allowTaint: false,
        scale: scale,
        width: contentWidth,
        height: contentHeight,
        windowWidth: contentWidth,
        windowHeight: contentHeight,
        x: 0,
        y: 0,
        scrollX: 0,
        scrollY: 0,
        foreignObjectRendering: true,
        onclone: (clonedDoc, clonedElement) => {
          const clonedSvg = clonedElement.querySelector('.svg-layer')
          if (clonedSvg) {
            clonedSvg.setAttribute('width', contentWidth)
            clonedSvg.setAttribute('height', contentHeight)
            clonedSvg.setAttribute('viewBox', `0 0 ${contentWidth} ${contentHeight}`)
            clonedSvg.style.width = `${contentWidth}px`
            clonedSvg.style.height = `${contentHeight}px`
            clonedSvg.style.overflow = 'visible'
          }

          const cards = clonedElement.querySelectorAll('.card')
          cards.forEach(card => {
            card.style.visibility = 'visible'
            card.style.opacity = '1'

            const computedStyle = clonedDoc.defaultView.getComputedStyle(card)
            if (!computedStyle.background || computedStyle.background === 'none' ||
                computedStyle.backgroundColor === 'rgba(0, 0, 0, 0)') {
              card.style.backgroundColor = '#ffffff'
            }
          })

          // ИСПРАВЛЕНИЕ: Обработка всех изображений (включая аватары)
          const images = clonedElement.querySelectorAll('img')
          let loadedCount = 0
          let notLoadedCount = 0
          images.forEach(img => {
            // Показываем ВСЕ изображения, даже если они не загружены
            // html2canvas лучше обрабатывает data URIs
            img.style.visibility = 'visible'
            img.style.opacity = '1'
            img.style.display = 'block'

            if (img.complete && img.naturalWidth > 0) {
              loadedCount++
            } else {
              notLoadedCount++
              console.warn('Изображение не полностью загружено:', img.src?.substring(0, 100))
            }
          })

          // ИСПРАВЛЕНИЕ: Убедимся, что аватары видимы
          const avatars = clonedElement.querySelectorAll('.avatar-object, .avatar-circle, .avatar-shape')
          avatars.forEach(avatar => {
            avatar.style.visibility = 'visible'
            avatar.style.opacity = '1'
          })

          // ИСПРАВЛЕНИЕ: Специальная обработка изображений внутри avatar-circle
          // html2canvas не всегда корректно обрабатывает object-fit: cover с border-radius
          const avatarCircleImages = clonedElement.querySelectorAll('.avatar-circle img')
          avatarCircleImages.forEach(img => {
            img.style.visibility = 'visible'
            img.style.opacity = '1'
            img.style.display = 'block'
            // Убедимся, что изображение заполняет контейнер
            img.style.width = '100%'
            img.style.height = '100%'
            img.style.objectFit = 'cover'
            img.style.objectPosition = 'center'
            // Убедимся, что изображение находится в правильной позиции
            img.style.position = 'absolute'
            img.style.top = '0'
            img.style.left = '0'
          })

          // html2canvas НЕ поддерживает object-fit: cover на img элементах
          // Решение: заменяем img на background-image на родительском контейнере
          const avatarCircles = clonedElement.querySelectorAll('.avatar-circle')
          avatarCircles.forEach(circle => {
            const img = circle.querySelector('img')
            if (img && img.src) {
              // Устанавливаем изображение как background на контейнере
              circle.style.backgroundImage = `url(${img.src})`
              circle.style.backgroundSize = 'cover'
              circle.style.backgroundPosition = 'center'
              circle.style.backgroundRepeat = 'no-repeat'
              // Скрываем оригинальный img, так как используем background
              img.style.visibility = 'hidden'
              img.style.opacity = '0'
            }
          })

          // ИСПРАВЛЕНИЕ: Специальная обработка аватаров в карточках (Card.vue)
          // Аватары в Card.vue используют background-image, нужно убедиться что они видимы
          const cardAvatarContainers = clonedElement.querySelectorAll('.card-avatar-container')
          cardAvatarContainers.forEach(container => {
            container.style.visibility = 'visible'
            container.style.opacity = '1'
          })

          const cardAvatars = clonedElement.querySelectorAll('.card-avatar')
          cardAvatars.forEach(avatar => {
            avatar.style.visibility = 'visible'
            avatar.style.opacity = '1'
            // Если аватар использует background-image, убедимся что стили правильные
            const computedStyle = clonedDoc.defaultView.getComputedStyle(avatar)
            if (computedStyle.backgroundImage && computedStyle.backgroundImage !== 'none') {
              avatar.style.backgroundSize = 'cover'
              avatar.style.backgroundPosition = 'center'
              avatar.style.backgroundRepeat = 'no-repeat'
            }
          })

          // ИСПРАВЛЕНИЕ: Убедимся, что изображения на канвасе видимы
          const canvasImages = clonedElement.querySelectorAll('.canvas-image')
          canvasImages.forEach(img => {
            img.style.visibility = 'visible'
            img.style.opacity = '1'
          })

          // Убедимся, что canvas изображений видим
          const clonedImagesCanvas = clonedElement.querySelector('.images-canvas-layer')
          if (clonedImagesCanvas) {
            clonedImagesCanvas.style.visibility = 'visible'
            clonedImagesCanvas.style.opacity = '1'
          }
        }
      })

      // ИСПРАВЛЕНИЕ: Диспатчим событие завершения экспорта
      const completeEvent = new CustomEvent('png-export-render-complete')
      window.dispatchEvent(completeEvent)

      // Восстанавливаем оригинальные размеры SVG-слоя и canvas-слоя
      if (svgLayer) {
        if (originalSvgWidth) svgLayer.setAttribute('width', originalSvgWidth)
        if (originalSvgHeight) svgLayer.setAttribute('height', originalSvgHeight)
        if (originalSvgViewBox) svgLayer.setAttribute('viewBox', originalSvgViewBox)
        svgLayer.style.width = originalSvgStyleWidth || ''
        svgLayer.style.height = originalSvgStyleHeight || ''
      }

      if (imagesCanvas) {
        imagesCanvas.width = originalCanvasWidth || 0
        imagesCanvas.height = originalCanvasHeight || 0
        imagesCanvas.style.width = originalCanvasStyleWidth || ''
        imagesCanvas.style.height = originalCanvasStyleHeight || ''
      }

      canvasContent.style.width = originalContentWidth
      canvasContent.style.height = originalContentHeight

      // Восстанавливаем оригинальные значения transform и position
      canvasContent.style.transform = originalTransform
      canvasContent.style.transformOrigin = originalTransformOrigin
      canvasContent.style.left = originalLeft
      canvasContent.style.top = originalTop

      // Финализируем canvas
      let finalCanvas

      if (exportSettings && exportSettings.format !== 'original') {
        finalCanvas = document.createElement('canvas')
        finalCanvas.width = finalWidth
        finalCanvas.height = finalHeight

        const ctx = finalCanvas.getContext('2d')
        ctx.fillStyle = exportSettings?.blackAndWhite ? '#ffffff' : (backgroundColor.value || '#ffffff')
        ctx.fillRect(0, 0, finalWidth, finalHeight)

        const scaleX = finalWidth / contentCanvas.width
        const scaleY = finalHeight / contentCanvas.height
        const fitScale = Math.min(scaleX, scaleY)

        const scaledWidth = contentCanvas.width * fitScale
        const scaledHeight = contentCanvas.height * fitScale

        const offsetX = (finalWidth - scaledWidth) / 2
        const offsetY = (finalHeight - scaledHeight) / 2

        ctx.drawImage(
          contentCanvas,
          0, 0, contentCanvas.width, contentCanvas.height,
          offsetX, offsetY, scaledWidth, scaledHeight
        )
      } else {
        finalCanvas = contentCanvas
      }

      // Восстановить стили и скачать
      await restoreAndDownload(finalCanvas, exportSettings, tempStyles, canvasContainer, originalImageSources, activeLodClasses)
    }

  } catch (error) {
    console.error('Ошибка при экспорте в PNG:', error)
    // Восстанавливаем LOD-классы и capturing при ошибке
    if (canvasContainer) {
      canvasContainer.classList.remove('canvas-container--capturing')
      activeLodClasses.forEach(cls => canvasContainer.classList.add(cls))
    }
    alert('Экспорт в PNG завершился ошибкой. Подробности в консоли.')
  }
}

  return {
    handleSaveProject,
    handleExportHTML,
    handleSaveAsHTML,
    handleShareProject,
    handleExportSVG,
    handleExportPNG,
    handlePrint,
    handleLoadProject
  }
}
