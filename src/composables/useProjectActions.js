import { storeToRefs } from 'pinia'
import html2canvas from 'html2canvas'
import { useCardsStore } from '../stores/cards.js'
import { useConnectionsStore } from '../stores/connections.js'
import { useProjectStore, formatProjectFileName } from '../stores/project.js'
import { useCanvasStore } from '../stores/canvas.js'
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
        console.log('pHYs чанк уже существует, заменяем его')
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

const imageToDataUri = async (src) => {
  if (!src) return ''
  const normalized = normalizeAssetUrl(src)
  if (imageDataUriCache.has(normalized)) {
    return imageDataUriCache.get(normalized)
  }

  try {
    const response = await fetch(normalized)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const buffer = await response.arrayBuffer()
    const mime = response.headers.get('Content-Type') || 'image/png'
    const base64 = arrayBufferToBase64(buffer)
    const dataUri = `data:${mime};base64,${base64}`
    imageDataUriCache.set(normalized, dataUri)
    return dataUri
  } catch (error) {
    console.warn('Не удалось получить данные изображения для экспорта:', src, error)
    return src
  }
}

const inlineImages = async (root) => {
  const images = Array.from(root.querySelectorAll('img'))
  await Promise.all(
    images.map(async (img) => {
      const src = img.getAttribute('src')
      if (!src || src.startsWith('data:') || /^(https?:)?\/\//i.test(src)) return
      const dataUri = await imageToDataUri(src)
      img.setAttribute('src', dataUri)
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

const buildViewOnlyScript = ({ x, y, scale }) => `\n<script>\ndocument.addEventListener('DOMContentLoaded', () => {\n  const root = document.getElementById('canvas')\n  if (!root) return\n  const canvas = root.querySelector('.canvas-content')\n  if (!canvas) return\n  \n  let currentX = ${x}\n  let currentY = ${y}\n  let currentScale = ${scale}\n  \n  const MIN_SCALE = 0.01\n  const MAX_SCALE = 5\n  \n  const updateTransform = () => {\n    canvas.style.transform = 'matrix(' + currentScale + ', 0, 0, ' + currentScale + ', ' + currentX + ', ' + currentY + ')'\n    const zoomBtn = document.getElementById('zoom-btn')\n    if (zoomBtn) {\n      const zoomValue = zoomBtn.querySelector('.zoom-value')\n      if (zoomValue) {\n        zoomValue.textContent = Math.round(currentScale * 100) + '%'\n      }\n    }\n  }\n  \n  updateTransform()\n  \n  let isDragging = false\n  let startX = 0\n  let startY = 0\n  \n  canvas.addEventListener('mousedown', (event) => {\n    if (event.button !== 0) return\n    isDragging = true\n    startX = event.clientX - currentX\n    startY = event.clientY - currentY\n    canvas.style.cursor = 'grabbing'\n  })\n  \n  window.addEventListener('mousemove', (event) => {\n    if (!isDragging) return\n    currentX = event.clientX - startX\n    currentY = event.clientY - startY\n    updateTransform()\n  })\n  \n  window.addEventListener('mouseup', () => {\n    if (!isDragging) return\n    isDragging = false\n    canvas.style.cursor = 'grab'\n  })\n  \n  window.addEventListener('wheel', (event) => {\n    event.preventDefault()\n    \n    const delta = -event.deltaY * 0.0005\n    const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, currentScale + delta))\n    \n    const rect = canvas.getBoundingClientRect()\n    const mouseX = event.clientX - rect.left\n    const mouseY = event.clientY - rect.top\n    \n    const scaleRatio = newScale / currentScale\n    \n    currentX = mouseX - (mouseX - currentX) * scaleRatio\n    currentY = mouseY - (mouseY - currentY) * scaleRatio\n    currentScale = newScale\n    \n    updateTransform()\n  }, { passive: false })\n  \n  const fitToContent = () => {\n    const cards = canvas.querySelectorAll('.card')\n    if (!cards || cards.length === 0) return\n    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity\n    cards.forEach(card => {\n      // Получаем координаты напрямую из CSS стилей, без учёта transform\n      const style = card.style\n      const left = parseFloat(style.left) || 0\n      const top = parseFloat(style.top) || 0\n      const width = parseFloat(style.width) || card.offsetWidth\n      const height = parseFloat(style.height) || card.offsetHeight\n      minX = Math.min(minX, left)\n      minY = Math.min(minY, top)\n      maxX = Math.max(maxX, left + width)\n      maxY = Math.max(maxY, top + height)\n    })\n    const contentWidth = maxX - minX\n    const contentHeight = maxY - minY\n    const rootRect = root.getBoundingClientRect()\n    const padding = 100\n    const scaleX = (rootRect.width - padding * 2) / contentWidth\n    const scaleY = (rootRect.height - padding * 2) / contentHeight\n    const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, Math.min(scaleX, scaleY)))\n    // Вычисляем центр контента в оригинальных координатах\n    const centerX = (minX + maxX) / 2\n    const centerY = (minY + maxY) / 2\n    // Позиционируем так, чтобы центр контента был в центре экрана\n    currentX = rootRect.width / 2 - centerX * newScale\n    currentY = rootRect.height / 2 - centerY * newScale\n    currentScale = newScale\n    updateTransform()\n  }\n  \n  const zoomBtn = document.getElementById('zoom-btn')\n  if (zoomBtn) {\n    zoomBtn.addEventListener('click', fitToContent)\n  }\n  \n  canvas.style.cursor = 'grab'\n})\n</script>\n`

const getExportHtmlCss = () => `
  html,body{margin:0;height:100%;font-family:'Inter',system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#111827;background:#f3f4f6;}
  #canvas{position:relative;width:100%;height:100%;overflow:hidden;font-family:'Inter',system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;}
  #canvas .canvas-container{position:absolute;inset:0;overflow:visible;touch-action:none;}
  #canvas .zoom-button{position:absolute;left:20px;top:20px;z-index:5000;display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:14px 18px;border-radius:22px;background:rgba(255,255,255,0.92);color:#111827;font-weight:700;font-size:16px;line-height:1;letter-spacing:0.2px;text-decoration:none;box-shadow:0 12px 28px rgba(15,23,42,0.16);border:1px solid rgba(15,23,42,0.14);pointer-events:auto;user-select:none;transition:transform .2s ease,box-shadow .2s ease,filter .2s ease;cursor:pointer;}
  #canvas .zoom-button:hover{transform:translateY(-2px);filter:brightness(1.02);box-shadow:0 18px 32px rgba(15,23,42,0.22);}
  #canvas .zoom-button:active{transform:translateY(1px);filter:brightness(0.98);box-shadow:0 8px 18px rgba(15,23,42,0.22);}
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
  #canvas .card{position:absolute;display:flex;flex-direction:column;align-items:stretch;box-sizing:border-box;border-radius:26px;overflow:hidden;background:rgba(255,255,255,0.92);box-shadow:0 18px 48px rgba(15,23,42,0.18);border:1px solid rgba(15,23,42,0.08);}
  #canvas .card-title{display:flex;align-items:center;justify-content:center;width:100%;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:18px 12px;font-size:18px;font-weight:700;letter-spacing:0.01em;color:#0f172a;}
  #canvas .card-body{padding:20px 20px 60px;display:flex;flex-direction:column;align-items:center;gap:12px;text-align:center;color:#111827;font-size:16px;}
  #canvas .card-row{display:flex;align-items:center;justify-content:center;gap:10px;text-align:center;flex-wrap:wrap;width:100%;}
  #canvas .label{color:#6b7280;font-weight:500;font-size:14px;text-align:center;max-width:100%;word-break:break-word;overflow-wrap:anywhere;}
  #canvas .value{color:#111827;font-weight:600;font-size:15px;outline:none;padding:3px 6px;border-radius:6px;line-height:1.5;}
  #canvas .pv-row .value{font-size:18px;font-weight:600;}
  #canvas .coin-icon{width:32px;height:32px;flex-shrink:0;}
  #canvas .slf-badge,#canvas .fendou-badge,#canvas .rank-badge{position:absolute;display:none;pointer-events:none;user-select:none;}
  #canvas .slf-badge.visible{display:block;top:15px;left:15px;font-size:36px;font-weight:900;color:#ffc700;text-shadow:1px 2px 6px rgba(15,23,42,0.35);}
  #canvas .fendou-badge.visible{display:block;top:-25px;left:50%;transform:translateX(-50%);font-size:56px;font-weight:900;color:#ef4444;text-shadow:1px 2px 6px rgba(15,23,42,0.35);}
  #canvas .rank-badge.visible{display:block;top:-15px;right:15px;width:80px;height:auto;transform:rotate(15deg);}
  #canvas .card-body-html{margin-top:8px;text-align:left;width:100%;font-size:14px;line-height:1.45;color:#111827;}
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
  const canvasStore = useCanvasStore()

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
    link.download = `scheme-${Date.now()}.html`
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

      const fileName = `project-${Date.now()}.html`
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
        console.log('Пользователь отменил шеринг')
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

  const handlePrint = () => {
    window.print()
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

    // Add a class to hide UI elements
    canvasContainer.classList.add('canvas-container--capturing')

    // **НОВОЕ: Создаём временный canvas для SVG-линий**
    const svgLayer = canvasContainer.querySelector('.svg-layer')
    const svgCanvas = await renderSVGToCanvas(svgLayer)

    // Apply export options
    const tempStyles = []

    // ... (остальные опции экспорта остаются без изменений)

    // Save the original transform
    const originalTransform = canvasContent.style.transform
    
    // Reset the transform to capture at a 1:1 scale
    canvasContent.style.transform = 'matrix(1, 0, 0, 1, 0, 0)'

    // Calculate the boundaries of all cards
    const cards = cardsStore.cards
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    cards.forEach(card => {
      const left = card.x || 0
      const top = card.y || 0
      const width = card.width || 0
      const height = card.height || 0
      minX = Math.min(minX, left)
      minY = Math.min(minY, top)
      maxX = Math.max(maxX, left + width)
      maxY = Math.max(maxY, top + height)
    })

    // Add padding
    const PADDING = 50
    minX -= PADDING
    minY -= PADDING
    maxX += PADDING
    maxY += PADDING

    const contentWidth = maxX - minX
    const contentHeight = maxY - minY

    // Set the position of canvas-content to capture the desired area
    const originalLeft = canvasContent.style.left
    const originalTop = canvasContent.style.top
    canvasContent.style.left = `${-minX}px`
    canvasContent.style.top = `${-minY}px`

    // Determine the export parameters
    let finalWidth, finalHeight, scale

    if (exportSettings && exportSettings.format !== 'original') {
      let pageWidthMm = exportSettings.width
      let pageHeightMm = exportSettings.height

      // Apply orientation
      if (exportSettings.orientation === 'landscape') {
        [pageWidthMm, pageHeightMm] = [pageHeightMm, pageWidthMm]
      }

      // Convert millimeters to pixels
      finalWidth = Math.round((pageWidthMm / 25.4) * exportSettings.dpi)
      finalHeight = Math.round((pageHeightMm / 25.4) * exportSettings.dpi)

      scale = 1
    } else {
      // Original size
      finalWidth = contentWidth
      finalHeight = contentHeight
      scale = 2
    }

    // **КРИТИЧНО: Временно скрываем SVG-слой перед захватом**
    if (svgLayer) {
      svgLayer.style.display = 'none'
    }

    // Capture the content image
    const contentCanvas = await html2canvas(canvasContainer, {
      backgroundColor: exportSettings?.blackAndWhite ? '#ffffff' : (backgroundColor.value || '#ffffff'),
      logging: false,
      useCORS: true,
      scale: scale,
      width: Math.round(contentWidth * scale),
      height: Math.round(contentHeight * scale),
      windowWidth: Math.round(contentWidth * scale),
      windowHeight: Math.round(contentHeight * scale)
    })

    // **ВОССТАНАВЛИВАЕМ SVG-слой**
    if (svgLayer) {
      svgLayer.style.display = ''
    }

    // Restore original values
    canvasContent.style.transform = originalTransform
    canvasContent.style.left = originalLeft
    canvasContent.style.top = originalTop
    canvasContainer.classList.remove('canvas-container--capturing')

    // Restore temporary styles
    tempStyles.forEach(({ element, property, originalValue }) => {
      if (originalValue) {
        element.style[property] = originalValue
      } else {
        element.style[property] = ''
      }
    })

    let finalCanvas

    if (exportSettings && exportSettings.format !== 'original') {
      // Create the final canvas
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

      // **НАКЛАДЫВАЕМ SVG-линии**
      if (svgCanvas) {
        ctx.drawImage(
          svgCanvas,
          0, 0, svgCanvas.width, svgCanvas.height,
          offsetX, offsetY, scaledWidth, scaledHeight
        )
      }
    } else {
      finalCanvas = contentCanvas
      
      // **НАКЛАДЫВАЕМ SVG-линии для оригинального размера**
      if (svgCanvas) {
        const ctx = finalCanvas.getContext('2d')
        ctx.drawImage(svgCanvas, 0, 0)
      }
    }

    // Convert to blob and download
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
      const dateStr = now.getFullYear() + '-' +
        String(now.getMonth() + 1).padStart(2, '0') + '-' +
        String(now.getDate()).padStart(2, '0')
      const timeStr = String(now.getHours()).padStart(2, '0') + '-' +
        String(now.getMinutes()).padStart(2, '0') + '-' +
        String(now.getSeconds()).padStart(2, '0')

      const baseFileName = formatProjectFileName(normalizedProjectName.value || projectStore.projectName, 'scheme')

      let formatSuffix = ''
      if (exportSettings && exportSettings.format !== 'original') {
        formatSuffix = `_${exportSettings.format.toUpperCase()}_${exportSettings.orientation === 'portrait' ? 'P' : 'L'}_${exportSettings.dpi}dpi`
      }

      link.download = `${baseFileName}${formatSuffix}_${dateStr}_${timeStr}.png`
      link.href = url
      link.click()
      URL.revokeObjectURL(url)
    }, 'image/png')
  } catch (error) {
    console.error('Ошибка при экспорте в PNG:', error)
    alert('Экспорт в PNG завершился ошибкой. Подробности в консоли.')
  }
}

// **НОВАЯ вспомогательная функция для рендеринга SVG в Canvas**
const renderSVGToCanvas = async (svgElement) => {
  if (!svgElement) return null

  try {
    const svgData = new XMLSerializer().serializeToString(svgElement)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    
    const width = parseFloat(svgElement.getAttribute('width')) || svgElement.clientWidth
    const height = parseFloat(svgElement.getAttribute('height')) || svgElement.clientHeight
    
    canvas.width = width
    canvas.height = height

    const img = new Image()
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(svgBlob)

    await new Promise((resolve, reject) => {
      img.onload = () => {
        ctx.drawImage(img, 0, 0, width, height)
        URL.revokeObjectURL(url)
        resolve()
      }
      img.onerror = reject
      img.src = url
    })

    return canvas
  } catch (error) {
    console.error('Ошибка рендеринга SVG в Canvas:', error)
    return null
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
