import { storeToRefs } from 'pinia'
import { useCardsStore } from '../stores/cards.js'
import { useConnectionsStore } from '../stores/connections.js'
import { useProjectStore, formatProjectFileName } from '../stores/project.js'
import { useCanvasStore } from '../stores/canvas.js'
import { parseActivePV } from '../utils/activePv.js'
import { calcStagesAndCycles } from '../utils/calculationEngine.js'
import { buildCardCssVariables } from '../utils/constants.js'

const imageDataUriCache = new Map()

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

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

const MARKER_OFFSET = 12
const EXTRA_PADDING_TOP = 60
const EXTRA_PADDING_SIDE = 50
const PV_RIGHT_VALUE = 330
const MIN_LEFT_PV = 30
const MAX_LEFT_PV = 330

const toFiniteNumber = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const normalizePvValue = (rawValue, fallback) => {
  const base = typeof rawValue === 'string' ? rawValue : ''
  const match = base.match(/^(\s*)(\d{1,3})/)

  if (!match) {
    return fallback
  }

  const [, , digits] = match
  const parsed = Number(digits)
  if (!Number.isFinite(parsed)) {
    return fallback
  }

  return Math.max(0, Math.min(999, parsed))
}

const buildCardMetrics = (card) => {
  const pvPair = parseActivePV(card.activePvLocal ?? card.activePv)
  const manualPvPair = parseActivePV(card.activePvManual ?? card.activePvLocal ?? card.activePv)
  const rightValue = normalizePvValue(pvPair?.right, PV_RIGHT_VALUE)
  const leftValue = normalizePvValue(pvPair?.left, PV_RIGHT_VALUE)
  const manualAdjustmentsSource = card.activePvAdjustment ?? card.activePvManual ?? card.activePvLocal ?? card.activePv
  const manualAdjustments = parseActivePV(manualAdjustmentsSource)
  const manualLeftValue = normalizePvValue(manualAdjustments?.left, leftValue)
  const manualRightValue = normalizePvValue(manualAdjustments?.right, rightValue)

  const { cycles, stages } = calcStagesAndCycles({
    pv: card.pv,
    balanceLeft: manualLeftValue,
    balanceRight: manualRightValue
  })

  return {
    cycles,
    stages,
    pvValue: toFiniteNumber(card.pv) || 0,
    balanceLeft: manualLeftValue,
    balanceRight: manualRightValue
  }
}

const getConnectionPath = (connection, cardsById) => {
  const startCard = cardsById.get(connection.startCardId)
  const endCard = cardsById.get(connection.endCardId)

  if (!startCard || !endCard) {
    return ''
  }

  const getAnchorPoint = (card, side) => {
    const anchorKey = `anchor${side.charAt(0).toUpperCase()}${side.slice(1)}`
    return card?.[anchorKey] || null
  }

  const startSide = connection.startSide || 'right'
  const endSide = connection.endSide || 'left'

  const startAnchor = getAnchorPoint(startCard, startSide)
  const endAnchor = getAnchorPoint(endCard, endSide)

  if (!startAnchor || !endAnchor) {
    return ''
  }

  const offsetPoint = (point, side) => {
    if (!point) return null
    const result = { x: point.x, y: point.y }
    switch (side) {
      case 'top':
        result.y -= MARKER_OFFSET
        break
      case 'bottom':
        result.y += MARKER_OFFSET
        break
      case 'left':
        result.x -= MARKER_OFFSET
        break
      case 'right':
        result.x += MARKER_OFFSET
        break
      default:
        break
    }
    return result
  }

  const startPoint = offsetPoint(startAnchor, startSide)
  const endPoint = offsetPoint(endAnchor, endSide)

  const midPoint = (startSide === 'left' || startSide === 'right')
    ? { x: endPoint.x, y: startPoint.y }
    : { x: startPoint.x, y: endPoint.y }

  const points = [startAnchor, startPoint, midPoint, endPoint, endAnchor]
    .filter(Boolean)
    .filter((point, index, array) => {
      if (index === 0) return true
      const prev = array[index - 1]
      return !(prev && prev.x === point.x && prev.y === point.y)
    })

  if (!points.length) {
    return ''
  }

  const [first, ...rest] = points
  const commands = [`M ${first.x} ${first.y}`]
  rest.forEach((point) => {
    commands.push(`L ${point.x} ${point.y}`)
  })
  return commands.join(' ')
}

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
    if (cardsStore.cards.length === 0) {
      alert('На доске нет элементов для экспорта.')
      return
    }

    try {
      const PADDING = 100
      const VIEWPORT_PADDING = 400

      const cards = cardsStore.cards.map(card => ({
        ...card,
        width: Number(card.width) || 418,
        height: Number(card.height) || 280,
        x: Number(card.x) || 0,
        y: Number(card.y) || 0
      }))

      let minX = Infinity
      let minY = Infinity
      let maxX = -Infinity
      let maxY = -Infinity

      cards.forEach((card) => {
        minX = Math.min(minX, card.x)
        minY = Math.min(minY, card.y)
        maxX = Math.max(maxX, card.x + card.width)
        maxY = Math.max(maxY, card.y + card.height)
      })

      const contentWidth = maxX - minX
      const contentHeight = maxY - minY

      const cardHtmlList = await Promise.all(cards.map(async (card) => {
        const headerBg = card.headerBg || '#5D8BF4'
        const rankSrc = card.rankBadge ? await imageToDataUri(`/rank-${card.rankBadge}.png`) : ''
        const strokeWidth = Number.isFinite(card.strokeWidth) ? card.strokeWidth : 2
        const metrics = buildCardMetrics(card)
        const cssVariables = buildCardCssVariables(card)

        const cardStyles = [
          `left:${card.x - minX + PADDING}px`,
          `top:${card.y - minY + PADDING}px`,
          `width:${card.width}px`,
          `height:${card.height}px`
        ]

        const cssVariableStrings = Object.entries(cssVariables).map(([name, value]) => `${name}:${escapeHtml(value)}`)

        const shellBackground = card.shellBg || 'rgba(255,255,255,0.92)'
        const borderColor = card.borderColor || 'rgba(15,23,42,0.08)'

        return `
          <div class="card" style="${cardStyles.join(';')};${cssVariableStrings.join(';')}">
            <div class="card-shell" style="background:${escapeHtml(shellBackground)};border:${strokeWidth}px solid ${escapeHtml(borderColor)};">
              <div class="card-header" style="background:${escapeHtml(headerBg)};">
                <div class="card-title">${escapeHtml(card.text)}</div>
                ${rankSrc ? `<img class="rank-badge visible" src="${rankSrc}" alt="" />` : ''}
              </div>
              <div class="card-body">
                <div class="card-row">
                  <span class="label">Личные PV</span>
                  <span class="value">${escapeHtml(metrics.pvValue)}</span>
                </div>
                <div class="card-row pv-row">
                  <span class="label">Баланс слева</span>
                  <span class="value">${escapeHtml(metrics.balanceLeft)}</span>
                </div>
                <div class="card-row pv-row">
                  <span class="label">Баланс справа</span>
                  <span class="value">${escapeHtml(metrics.balanceRight)}</span>
                </div>
                <div class="card-row">
                  <span class="label">Стадий</span>
                  <span class="value">${escapeHtml(metrics.stages)}</span>
                </div>
                <div class="card-row">
                  <span class="label">Циклов</span>
                  <span class="value">${escapeHtml(metrics.cycles)}</span>
                </div>
              </div>
            </div>
          </div>
        `
      }))

      const cardsById = new Map(cards.map(card => [card.id, card]))
      const connectionPaths = connectionsStore.connections.map((connection) => ({
        path: getConnectionPath(connection, cardsById),
        color: connection.color || connectionsStore.defaultLineColor,
        thickness: connection.thickness || connectionsStore.defaultLineThickness
      }))

      const width = contentWidth + PADDING * 2
      const height = contentHeight + PADDING * 2

      const svgCssStyles = `
        html,body{margin:0;height:100%;font-family:'Inter',system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#111827;background:#f3f4f6;}
        #canvas{position:relative;width:100%;height:100%;overflow:hidden;font-family:'Inter',system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;}
        .zoom-button{position:absolute;left:20px;top:20px;z-index:5000;display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:14px 18px;border-radius:22px;background:rgba(255,255,255,0.92);color:#111827;font-weight:700;font-size:16px;line-height:1;letter-spacing:0.2px;text-decoration:none;box-shadow:0 12px 28px rgba(15,23,42,0.16);border:1px solid rgba(15,23,42,0.14);pointer-events:auto;user-select:none;transition:transform .2s ease,box-shadow .2s ease,filter .2s ease;cursor:pointer;}
        .zoom-button:hover{transform:translateY(-2px);filter:brightness(1.02);box-shadow:0 18px 32px rgba(15,23,42,0.22);}
        .zoom-button:active{transform:translateY(1px);filter:brightness(0.98);box-shadow:0 8px 18px rgba(15,23,42,0.22);}
        .zoom-button .zoom-value{font-variant-numeric:tabular-nums;}
        .canvas-content{position:absolute;left:0;top:0;width:100%;height:100%;transform-origin:0 0;cursor:grab;}
        .card{position:absolute;display:flex;flex-direction:column;align-items:stretch;box-sizing:border-box;pointer-events:auto;}
        .card-shell{border-radius:26px;overflow:hidden;box-shadow:0 18px 48px rgba(15,23,42,0.18);display:flex;flex-direction:column;height:100%;}
        .card-header{display:flex;align-items:center;justify-content:center;padding:18px 12px;position:relative;}
        .card-title{font-size:18px;font-weight:700;letter-spacing:0.01em;color:#fff;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:100%;}
        .rank-badge.visible{position:absolute;top:-15px;right:15px;width:80px;height:auto;transform:rotate(15deg);}
        .card-body{padding:20px 20px 60px;display:flex;flex-direction:column;align-items:center;gap:12px;text-align:center;color:#111827;font-size:16px;}
        .card-row{display:flex;align-items:center;justify-content:center;gap:10px;text-align:center;flex-wrap:wrap;width:100%;}
        .label{color:#6b7280;font-weight:500;font-size:14px;text-align:center;max-width:100%;word-break:break-word;overflow-wrap:anywhere;}
        .value{color:#111827;font-weight:600;font-size:15px;outline:none;padding:3px 6px;border-radius:6px;line-height:1.5;}
        .pv-row .value{font-size:18px;font-weight:600;}
        .svg-layer{position:absolute;inset:0;pointer-events:none;overflow:visible;}
      `

      const svgInteractiveScript = `
        document.addEventListener('DOMContentLoaded', function() {
          var canvas = document.querySelector('.canvas-content');
          if (!canvas) return;

          var currentX = 0;
          var currentY = 0;
          var currentScale = 1;

          var MIN_SCALE = 0.01;
          var MAX_SCALE = 5;

          function updateTransform() {
            canvas.style.transform = 'matrix(' + currentScale + ', 0, 0, ' + currentScale + ', ' + currentX + ', ' + currentY + ')';
            var zoomBtn = document.getElementById('zoom-btn');
            if (zoomBtn) {
              var zoomValue = zoomBtn.querySelector('.zoom-value');
              if (zoomValue) {
                zoomValue.textContent = Math.round(currentScale * 100) + '%';
              }
            }
          }

          updateTransform();

          var isDragging = false;
          var startX = 0;
          var startY = 0;

          canvas.addEventListener('mousedown', function(event) {
            if (event.button !== 0) return;
            isDragging = true;
            startX = event.clientX - currentX;
            startY = event.clientY - currentY;
            canvas.style.cursor = 'grabbing';
          });

          window.addEventListener('mousemove', function(event) {
            if (!isDragging) return;
            currentX = event.clientX - startX;
            currentY = event.clientY - startY;
            updateTransform();
          });

          window.addEventListener('mouseup', function() {
            if (!isDragging) return;
            isDragging = false;
            canvas.style.cursor = 'grab';
          });

          window.addEventListener('wheel', function(event) {
            event.preventDefault();

            var delta = -event.deltaY * 0.0005;
            var newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, currentScale + delta));

            var rect = canvas.getBoundingClientRect();
            var mouseX = event.clientX - rect.left;
            var mouseY = event.clientY - rect.top;

            var scaleRatio = newScale / currentScale;

            currentX = mouseX - (mouseX - currentX) * scaleRatio;
            currentY = mouseY - (mouseY - currentY) * scaleRatio;
            currentScale = newScale;

            updateTransform();
          }, { passive: false });

          function fitToContent() {
            var cards = canvas.querySelectorAll('.card');
            if (!cards || cards.length === 0) return;

            var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            cards.forEach(function(card) {
              var style = card.style;
              var left = parseFloat(style.left) || 0;
              var top = parseFloat(style.top) || 0;
              var width = parseFloat(style.width) || card.offsetWidth;
              var height = parseFloat(style.height) || card.offsetHeight;
              minX = Math.min(minX, left);
              minY = Math.min(minY, top);
              maxX = Math.max(maxX, left + width);
              maxY = Math.max(maxY, top + height);
            });

            var contentWidth = maxX - minX;
            var contentHeight = maxY - minY;
            var rootRect = document.getElementById('canvas').getBoundingClientRect();
            var padding = 100;
            var scaleX = (rootRect.width - padding * 2) / contentWidth;
            var scaleY = (rootRect.height - padding * 2) / contentHeight;
            var newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, Math.min(scaleX, scaleY)));

            var centerX = (minX + maxX) / 2;
            var centerY = (minY + maxY) / 2;

            currentX = rootRect.width / 2 - centerX * newScale;
            currentY = rootRect.height / 2 - centerY * newScale;
            currentScale = newScale;
            updateTransform();
          }

          var zoomBtn = document.getElementById('zoom-btn');
          if (zoomBtn) {
            zoomBtn.addEventListener('click', fitToContent);
          }
        });
      `

      const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 ${width} ${height}" xmlns:xlink="http://www.w3.org/1999/xlink">
  <foreignObject x="0" y="0" width="100%" height="100%">
    <body xmlns="http://www.w3.org/1999/xhtml" style="margin:0;height:100vh;overflow:hidden;background:${backgroundColor.value || '#f3f4f6'};">
      <style>
        ${svgCssStyles}
      </style>
      <div id="canvas" style="position:relative;width:100vw;height:100vh;overflow:hidden;background:${backgroundColor.value || '#ffffff'};">
        <button id="zoom-btn" class="zoom-button" title="Автоподгонка масштаба">
          Масштаб: <span class="zoom-value">100%</span>
        </button>
        <div class="canvas-content">
          ${cardHtmlList.join('')}
          <svg class="svg-layer" xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
            ${connectionPaths.filter(item => item.path).map((item) => `
              <path d="${item.path}" stroke="${item.color}" stroke-width="${item.thickness}" fill="none" stroke-linecap="round" stroke-linejoin="round" />
            `).join('')}
          </svg>
        </div>
      </div>
      <script>
        ${svgInteractiveScript}
      </script>
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

  return {
    handleSaveProject,
    handleExportHTML,
    handleExportSVG,
    handlePrint,
    handleLoadProject
  }
}
