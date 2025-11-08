import { storeToRefs } from 'pinia'
import html2canvas from 'html2canvas'
import { useCardsStore } from '../stores/cards.js'
import { useConnectionsStore } from '../stores/connections.js'
import { useProjectStore, formatProjectFileName } from '../stores/project.js'
import { useCanvasStore } from '../stores/canvas.js'

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
    isSelectionMode,
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
        isSelectionMode: isSelectionMode.value,
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

  const handleExportHTML = async () => {
    const canvasRoot = document.getElementById('canvas')
    if (!canvasRoot) {
      console.warn('Элемент #canvas не найден, экспорт невозможен')
      return
    }

    const canvasContent = canvasRoot.querySelector('.canvas-content')
    if (!canvasContent) {
      alert('Не удалось найти содержимое холста для экспорта.')
      return
    }

    if (cardsStore.cards.length === 0 && connectionsStore.connections.length === 0) {
      alert('На доске нет элементов для экспорта.')
      return
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

    const blob = new Blob([htmlContent], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `scheme-${Date.now()}.html`
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleExportSVG = async () => {
    try {
      const canvasRoot = document.getElementById('canvas')
      if (!canvasRoot) {
        alert('Не удалось найти холст для экспорта.')
        return
      }
      const canvasContainer = canvasRoot.querySelector('.canvas-container')
      const canvasContent = canvasContainer?.querySelector('.canvas-content')
      if (!canvasContainer || !canvasContent) {
        alert('Не удалось найти содержимое холста для экспорта.')
        return
      }

      const cards = Array.from(canvasContainer.querySelectorAll('.card'))
      const svgLayer = canvasContainer.querySelector('.svg-layer')
      const noteWindows = Array.from(document.querySelectorAll('.note-window'))

      // Получаем все видимые линии (не hitbox)
      const connectionLines = svgLayer
        ? Array.from(svgLayer.querySelectorAll('.line-group')).map(group => {
            const pathElement = group.querySelector('.line:not(.line-hitbox)')
            return pathElement
          }).filter(Boolean)
        : []

      const svgGraphics = svgLayer
        ? Array.from(svgLayer.querySelectorAll('path, line, polyline, polygon, rect, circle, ellipse')).filter(
          element => !element.classList.contains('line-hitbox') && !element.classList.contains('line--preview')
        )
        : []

      if (cards.length === 0 && noteWindows.length === 0 && svgGraphics.length === 0) {
        alert('На доске нет элементов для экспорта.')
        return
      }

      const transformValues = parseTransform(window.getComputedStyle(canvasContent).transform)
      const safeScale = transformValues.scale || 1

      const bounds = {
        minX: Infinity,
        minY: Infinity,
        maxX: -Infinity,
        maxY: -Infinity
      }

      const includeBounds = (left, top, right, bottom) => {
        if ([left, top, right, bottom].some(value => !Number.isFinite(value))) {
          return
        }
        bounds.minX = Math.min(bounds.minX, left)
        bounds.minY = Math.min(bounds.minY, top)
        bounds.maxX = Math.max(bounds.maxX, right)
        bounds.maxY = Math.max(bounds.maxY, bottom)
      }

      // Включаем границы карточек на основе их CSS координат (не getBoundingClientRect)
      cards.forEach((card) => {
        const left = Number.parseFloat(card.style.left) || 0
        const top = Number.parseFloat(card.style.top) || 0
        const width = Number.parseFloat(card.style.width) || card.offsetWidth || 0
        const explicitHeight = Number.parseFloat(card.style.height)
        const minHeight = Number.parseFloat(card.style.minHeight)
        const height = Number.isFinite(explicitHeight)
          ? explicitHeight
          : Number.isFinite(minHeight)
            ? minHeight
            : card.offsetHeight || 0
        includeBounds(left, top, left + width, top + height)
      })

      // Включаем границы соединительных линий
      svgGraphics.forEach((element) => {
        if (!(element instanceof SVGGraphicsElement)) {
          return
        }
        try {
          const bbox = element.getBBox()
          if (bbox && (bbox.width > 0 || bbox.height > 0)) {
            includeBounds(bbox.x, bbox.y, bbox.x + bbox.width, bbox.y + bbox.height)
          }
        } catch (e) {
          // Игнорируем ошибки getBBox для невалидных элементов
        }
      })

      const noteMetrics = noteWindows.map((note) => {
        const styleLeft = Number.parseFloat(note.style.left)
        const styleTop = Number.parseFloat(note.style.top)
        const styleWidth = Number.parseFloat(note.style.width)
        const styleHeight = Number.parseFloat(note.style.height)

        // Используем прямые координаты из стилей, если они заданы
        const boardLeft = Number.isFinite(styleLeft) ? styleLeft : 0
        const boardTop = Number.isFinite(styleTop) ? styleTop : 0
        const baseWidth = Number.isFinite(styleWidth) ? styleWidth : 200
        const baseHeight = Number.isFinite(styleHeight) ? styleHeight : 200

        includeBounds(boardLeft, boardTop, boardLeft + baseWidth, boardTop + baseHeight)

        return {
          original: note,
          boardLeft,
          boardTop,
          width: baseWidth,
          height: baseHeight
        }
      })

      if (!Number.isFinite(bounds.minX) || !Number.isFinite(bounds.minY) || !Number.isFinite(bounds.maxX) || !Number.isFinite(bounds.maxY)) {
        alert('Не удалось определить границы для экспорта SVG.')
        return
      }

      const PADDING = 24
      const contentWidth = Math.max(0, bounds.maxX - bounds.minX)
      const contentHeight = Math.max(0, bounds.maxY - bounds.minY)
      const exportWidth = Math.max(1, Math.ceil(contentWidth + PADDING * 2))
      const exportHeight = Math.max(1, Math.ceil(contentHeight + PADDING * 2))
      const offsetX = PADDING - bounds.minX
      const offsetY = PADDING - bounds.minY
      const normalizedContentWidth = Math.max(1, Math.ceil(contentWidth))
      const normalizedContentHeight = Math.max(1, Math.ceil(contentHeight))

      const containerClone = canvasContainer.cloneNode(true)
      const contentClone = containerClone.querySelector('.canvas-content')
      if (!contentClone) {
        alert('Не удалось подготовить содержимое для экспорта.')
        return
      }

      const selectorsToRemove = [
        '.selection-box',
        '.guides-overlay',
        '.guide-line',
        '.line-hitbox',
        '.card-active-controls',
        '.card-controls',
        '.active-pv-btn',
        '.card-note-btn',
        '.card-close-btn',
        '.connection-point',
        '[data-role="active-pv-buttons"]'
      ]

      containerClone.querySelectorAll(selectorsToRemove.join(', ')).forEach((element) => {
        element.remove()
      })

      containerClone.classList.remove(
        'canvas-container--panning',
        'canvas-container--selection-mode',
        'canvas-container--capturing'
      )
      containerClone.style.position = 'absolute'
      containerClone.style.left = '0'
      containerClone.style.top = '0'
      containerClone.style.width = `${exportWidth}px`
      containerClone.style.height = `${exportHeight}px`
      containerClone.style.overflow = 'visible'

      contentClone.style.transform = 'matrix(1, 0, 0, 1, 0, 0)'
      contentClone.style.left = `${offsetX}px`
      contentClone.style.top = `${offsetY}px`
      contentClone.style.width = `${normalizedContentWidth}px`
      contentClone.style.height = `${normalizedContentHeight}px`

      containerClone.querySelectorAll('.card').forEach((cardEl) => {
        cardEl.classList.remove('selected', 'connecting', 'editing')
        cardEl.style.cursor = 'default'
      })

      containerClone.querySelectorAll('[contenteditable]').forEach((element) => {
        element.setAttribute('contenteditable', 'false')
        element.style.pointerEvents = 'none'
        element.style.userSelect = 'text'
      })

      const cardsContainerClone = containerClone.querySelector('.cards-container')
      if (cardsContainerClone) {
        cardsContainerClone.style.width = `${normalizedContentWidth}px`
        cardsContainerClone.style.height = `${normalizedContentHeight}px`
        cardsContainerClone.style.pointerEvents = 'none'
      }

      const svgLayerClone = containerClone.querySelector('.svg-layer')
      if (svgLayerClone) {
        svgLayerClone.setAttribute('width', String(normalizedContentWidth))
        svgLayerClone.setAttribute('height', String(normalizedContentHeight))
        svgLayerClone.setAttribute('viewBox', `0 0 ${normalizedContentWidth} ${normalizedContentHeight}`)
        svgLayerClone.style.width = `${normalizedContentWidth}px`
        svgLayerClone.style.height = `${normalizedContentHeight}px`
        svgLayerClone.style.pointerEvents = 'none'
        svgLayerClone.style.overflow = 'visible'

        // Убедимся, что все линии видимы и правильно стилизованы для экспорта
        const lineGroups = svgLayerClone.querySelectorAll('.line-group')
        lineGroups.forEach(group => {
          const visibleLine = group.querySelector('.line:not(.line-hitbox)')
          if (visibleLine) {
            // Удаляем классы анимации и выделения для экспорта
            visibleLine.classList.remove('selected', 'line--balance-highlight', 'line--pv-highlight', 'line--balance-flash')
          }
        })
      }

      const noteClones = noteMetrics.map(({ original, boardLeft, boardTop, width, height }) => {
        const noteClone = original.cloneNode(true)
        const originalTextareas = original.querySelectorAll('textarea')
        const clonedTextareas = noteClone.querySelectorAll('textarea')
        clonedTextareas.forEach((textarea, index) => {
          const source = originalTextareas[index]
          if (source) {
            textarea.value = source.value
            textarea.textContent = source.value
          }
          textarea.setAttribute('readonly', 'true')
          textarea.setAttribute('aria-readonly', 'true')
        })

        noteClone.style.position = 'absolute'
        noteClone.style.left = `${boardLeft + offsetX}px`
        noteClone.style.top = `${boardTop + offsetY}px`
        noteClone.style.transform = 'scale(1)'
        noteClone.style.transformOrigin = 'top left'
        noteClone.style.pointerEvents = 'none'
        return noteClone
      })

      noteClones.forEach((noteClone) => {
        containerClone.appendChild(noteClone)
      })

      const exportRoot = document.createElement('div')
      exportRoot.id = 'canvas'
      exportRoot.style.position = 'relative'
      exportRoot.style.width = `${exportWidth}px`
      exportRoot.style.height = `${exportHeight}px`
      exportRoot.style.overflow = 'visible'
      exportRoot.style.background = backgroundColor.value || '#ffffff'
      exportRoot.appendChild(containerClone)

      await inlineImages(exportRoot)

      const cssText = getExportSvgCss()
      const background = backgroundColor.value || '#ffffff'

      const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${exportWidth}" height="${exportHeight}" viewBox="0 0 ${exportWidth} ${exportHeight}">
  <foreignObject x="0" y="0" width="${exportWidth}" height="${exportHeight}">
    <body xmlns="http://www.w3.org/1999/xhtml" style="margin:0;height:100%;overflow:hidden;background:${background};">
      <style>${cssText}</style>
      ${exportRoot.outerHTML}
    </body>
  </foreignObject>
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

      // Apply export options
      const tempStyles = []

      // Option "Скрыть содержимое"
      if (exportSettings?.hideContent) {
        // Hide all text elements on the cards
        const textElements = canvasContainer.querySelectorAll('.card-title, .card-body, .label, .value, .card-row, .card-body-html')
        textElements.forEach(el => {
          tempStyles.push({ element: el, property: 'visibility', originalValue: el.style.visibility })
          el.style.visibility = 'hidden'
        })
      }

      // Hide control buttons
      const controlButtons = canvasContainer.querySelectorAll('.card-close-btn, .card-note-btn, .active-pv-btn, [data-role="active-pv-buttons"]')
      controlButtons.forEach(el => {
        tempStyles.push({ element: el, property: 'display', originalValue: el.style.display })
        el.style.display = 'none'
      })

      // Option "Ч/Б (контур)"
      if (exportSettings?.blackAndWhite) {
        // Set white background for cards and a black border
        const cards = canvasContainer.querySelectorAll('.card')
        cards.forEach(card => {
          tempStyles.push({ element: card, property: 'background', originalValue: card.style.background })
          tempStyles.push({ element: card, property: 'box-shadow', originalValue: card.style.boxShadow })
          tempStyles.push({ element: card, property: 'border', originalValue: card.style.border })
          card.style.background = '#ffffff'
          card.style.boxShadow = 'none'
          card.style.border = '2px solid #000000'
        })

        // Set a white background for card headers with a black separating line
        const cardHeaders = canvasContainer.querySelectorAll('.card-header, .card-title')
        cardHeaders.forEach(header => {
          tempStyles.push({ element: header, property: 'background', originalValue: header.style.background })
          tempStyles.push({ element: header, property: 'border-bottom', originalValue: header.style.borderBottom })
          tempStyles.push({ element: header, property: 'color', originalValue: header.style.color })
          header.style.background = '#ffffff'
          header.style.borderBottom = '2px solid #000000'
          header.style.color = '#000000'
        })

        // Hide colored elements (icons, badges)
        const coloredElements = canvasContainer.querySelectorAll('.coin-icon, .slf-badge, .fendou-badge, .rank-badge')
        coloredElements.forEach(el => {
          tempStyles.push({ element: el, property: 'visibility', originalValue: el.style.visibility })
          el.style.visibility = 'hidden'
        })

        // Make all connection lines black
        const lines = canvasContainer.querySelectorAll('.line')
        lines.forEach(line => {
          tempStyles.push({ element: line, property: 'stroke', originalValue: line.style.stroke })
          line.style.stroke = '#000000'
        })
      }

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
        // Calculate the dimensions in pixels based on format and DPI
        let pageWidthMm = exportSettings.width
        let pageHeightMm = exportSettings.height

        // Apply orientation
        if (exportSettings.orientation === 'landscape') {
          [pageWidthMm, pageHeightMm] = [pageHeightMm, pageWidthMm]
        }

        // Convert millimeters to pixels: pixels = (mm / 25.4) * DPI
        finalWidth = Math.round((pageWidthMm / 25.4) * exportSettings.dpi)
        finalHeight = Math.round((pageHeightMm / 25.4) * exportSettings.dpi)

        // Calculate the scale for html2canvas based on DPI
        // The base resolution is 96 DPI
        scale = exportSettings.dpi / 96
      } else {
        // Original size
        finalWidth = contentWidth
        finalHeight = contentHeight
        scale = 2 // Increase the resolution for better quality
      }

      // Capture the content image
      const contentCanvas = await html2canvas(canvasContainer, {
        backgroundColor: exportSettings?.blackAndWhite ? '#ffffff' : (backgroundColor.value || '#ffffff'),
        logging: false,
        useCORS: true,
        scale: scale,
        width: contentWidth,
        height: contentHeight,
        windowWidth: contentWidth,
        windowHeight: contentHeight
      })

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
        // Create the final canvas with the specified dimensions
        finalCanvas = document.createElement('canvas')
        finalCanvas.width = finalWidth
        finalCanvas.height = finalHeight

        const ctx = finalCanvas.getContext('2d')

        // Fill the background
        ctx.fillStyle = exportSettings?.blackAndWhite ? '#ffffff' : (backgroundColor.value || '#ffffff')
        ctx.fillRect(0, 0, finalWidth, finalHeight)

        // Calculate the scale to fit the content within the final size
        const scaleX = finalWidth / contentCanvas.width
        const scaleY = finalHeight / contentCanvas.height
        const fitScale = Math.min(scaleX, scaleY)

        // Calculate the dimensions of the scaled content
        const scaledWidth = contentCanvas.width * fitScale
        const scaledHeight = contentCanvas.height * fitScale

        // Center the image
        const offsetX = (finalWidth - scaledWidth) / 2
        const offsetY = (finalHeight - scaledHeight) / 2

        // Draw the scaled and centered image
        ctx.drawImage(
          contentCanvas,
          0, 0, contentCanvas.width, contentCanvas.height,
          offsetX, offsetY, scaledWidth, scaledHeight
        )
      } else {
        // Use the original canvas
        finalCanvas = contentCanvas
      }

      // Convert to a blob and download
      finalCanvas.toBlob(async (blob) => {
        if (!blob) {
          alert('Не удалось создать изображение.')
          return
        }

        // Add DPI metadata to the PNG file
        let finalBlob = blob
        if (exportSettings?.dpi) {
          finalBlob = await addPngDpiMetadata(blob, exportSettings.dpi)
        }

        const url = URL.createObjectURL(finalBlob)
        const link = document.createElement('a')

        // Form the file name: project name + date and time
        const now = new Date()
        const dateStr = now.getFullYear() + '-' +
          String(now.getMonth() + 1).padStart(2, '0') + '-' +
          String(now.getDate()).padStart(2, '0')
        const timeStr = String(now.getHours()).padStart(2, '0') + '-' +
          String(now.getMinutes()).padStart(2, '0') + '-' +
          String(now.getSeconds()).padStart(2, '0')

        const baseFileName = formatProjectFileName(normalizedProjectName.value || projectStore.projectName, 'scheme')

        // Add format information to the file name if not the original size
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

  return {
    handleSaveProject,
    handleExportHTML,
    handleExportSVG,
    handleExportPNG,
    handlePrint,
    handleLoadProject
  }
}
