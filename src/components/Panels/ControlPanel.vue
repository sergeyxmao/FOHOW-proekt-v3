<script setup>
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { storeToRefs } from 'pinia'
import { useCardsStore } from '../../stores/cards.js'
import { useHistoryStore } from '../../stores/history.js'
import { useCanvasStore } from '../../stores/canvas.js'
import { useConnectionsStore } from '../../stores/connections.js'
import { useProjectStore, formatProjectFileName } from '../../stores/project.js'
import { useViewportStore } from '../../stores/viewport.js'
import { useNotesStore } from '../../stores/notes.js'
  
const props = defineProps({
  isModernTheme: {
    type: Boolean,
    default: false
  },
  isCollapsed: {
    type: Boolean,
    default: false    
  }
})

const emit = defineEmits(['toggle-theme', 'toggle-collapse', 'fit-to-content', 'activate-pencil'])
const cardsStore = useCardsStore()
const historyStore = useHistoryStore()
const canvasStore = useCanvasStore()
const connectionsStore = useConnectionsStore()
const projectStore = useProjectStore()
const viewportStore = useViewportStore()
const notesStore = useNotesStore()
  
const {
  backgroundColor,
  isSelectionMode,
  isHierarchicalDragMode,
  guidesEnabled,
  gridStep,
  isGridBackgroundVisible
} = storeToRefs(canvasStore)
const { normalizedProjectName } = storeToRefs(projectStore)
const { zoomPercentage } = storeToRefs(viewportStore)
const { dropdownOpen, cardsWithEntries } = storeToRefs(notesStore)

const notesButtonRef = ref(null)
const notesDropdownRef = ref(null)
const hasNoteEntries = computed(() => notesStore.hasEntries)  

const zoomDisplay = computed(() => `${zoomPercentage.value}%`)

// Обработчики для кнопок левой панели
const handleUndo = () => {
  historyStore.undo()
}

const handleRedo = () => {
  historyStore.redo()
}

const handleSaveProject = () => {
  // Сохранение проекта в JSON
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
      isGridBackgroundVisible: isGridBackgroundVisible.value    }
  }
  const dataStr = JSON.stringify(projectData, null, 2)
  const dataBlob = new Blob([dataStr], {type: 'application/json'})
  const url = URL.createObjectURL(dataBlob)
  const link = document.createElement('a')
  link.href = url
  const baseFileName = formatProjectFileName(normalizedProjectName.value || projectStore.projectName)
  link.download = `${baseFileName}.json`
  link.click()
  URL.revokeObjectURL(url)
}

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

const buildViewOnlyScript = ({ x, y, scale }) => `\n<script>\ndocument.addEventListener('DOMContentLoaded', () => {\n  const root = document.getElementById('canvas');\n  if (!root) return;\n  const content = root.querySelector('.canvas-content') || root.firstElementChild;\n  if (!content) return;\n  let tx = ${Number.isFinite(x) ? x : 0};\n  let ty = ${Number.isFinite(y) ? y : 0};\n  let s = ${Number.isFinite(scale) ? scale : 1};\n  const clamp = (value) => Math.max(0.05, Math.min(5, value));\n  const update = () => {\n    content.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + s + ')';\n  };\n  let pan = false;\n  let panId = null;\n  let lastX = 0;\n  let lastY = 0;\n  const pointers = new Map();\n  let pinch = null;\n  const tryPinch = () => {\n    if (pinch) return;\n    const touches = Array.from(pointers.entries()).filter(([, info]) => info.type === 'touch');\n    if (touches.length < 2) return;\n    const [first, second] = touches;\n    const distance = Math.hypot(second[1].x - first[1].x, second[1].y - first[1].y);\n    if (!distance) return;\n    pinch = {\n      id1: first[0],\n      id2: second[0],\n      distance,\n      scale: s,\n      midX: (first[1].x + second[1].x) / 2,\n      midY: (first[1].y + second[1].y) / 2\n    };\n    if (pan && panId != null && root.releasePointerCapture) {\n      try { root.releasePointerCapture(panId); } catch (_) {}\n    }\n    pan = false;\n    panId = null;\n  };\n  const handlePinch = () => {\n    if (!pinch) return;\n    const first = pointers.get(pinch.id1);\n    const second = pointers.get(pinch.id2);\n    if (!first || !second) return;\n    const midX = (first.x + second.x) / 2;\n    const midY = (first.y + second.y) / 2;\n    tx += midX - pinch.midX;\n    ty += midY - pinch.midY;\n    const distance = Math.hypot(second.x - first.x, second.y - first.y);\n    if (distance) {\n      const nextScale = clamp(pinch.scale * distance / pinch.distance);\n      const ratio = nextScale / s;\n      tx = midX - (midX - tx) * ratio;\n      ty = midY - (midY - ty) * ratio;\n      s = nextScale;\n    }\n    pinch.midX = midX;\n    pinch.midY = midY;\n    update();\n  };\n  const endPinch = (pointerId) => {\n    if (pinch && (pointerId === pinch.id1 || pointerId === pinch.id2)) {\n      pinch = null;\n    }\n  };\n  const stopPan = (pointerId) => {\n    if (pan && pointerId === panId) {\n      pan = false;\n      panId = null;\n      if (root.releasePointerCapture) {\n        try { root.releasePointerCapture(pointerId); } catch (_) {}\n      }\n      document.body.style.cursor = 'default';\n    }\n  };\n  root.addEventListener('pointerdown', (event) => {\n    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, type: event.pointerType });\n    if (event.pointerType === 'touch') {\n      tryPinch();\n      if (!pinch && !pan) {\n        pan = true;\n        panId = event.pointerId;\n        lastX = event.clientX;\n        lastY = event.clientY;\n        if (root.setPointerCapture) {\n          try { root.setPointerCapture(event.pointerId); } catch (_) {}\n        }\n        document.body.style.cursor = 'move';\n      }\n      return;\n    }\n    if (event.button === 1) {\n      event.preventDefault();\n      pan = true;\n      panId = event.pointerId;\n      lastX = event.clientX;\n      lastY = event.clientY;\n      if (root.setPointerCapture) {\n        try { root.setPointerCapture(event.pointerId); } catch (_) {}\n      }\n      document.body.style.cursor = 'move';\n    }\n  });\n  root.addEventListener('pointermove', (event) => {\n    const info = pointers.get(event.pointerId);\n    if (info) {\n      info.x = event.clientX;\n      info.y = event.clientY;\n    }\n    if (pinch && (event.pointerId === pinch.id1 || event.pointerId === pinch.id2)) {\n      handlePinch();\n      return;\n    }\n    if (pan && event.pointerId === panId) {\n      event.preventDefault();\n      tx += event.clientX - lastX;\n      ty += event.clientY - lastY;\n      lastX = event.clientX;\n      lastY = event.clientY;\n      update();\n    }\n  });\n  const clearPointer = (event) => {\n    pointers.delete(event.pointerId);\n    endPinch(event.pointerId);\n    stopPan(event.pointerId);\n  };\n  root.addEventListener('pointerup', clearPointer);\n  root.addEventListener('pointercancel', clearPointer);\n  root.addEventListener('wheel', (event) => {\n    event.preventDefault();\n    const rect = root.getBoundingClientRect();\n    const mouseX = event.clientX - rect.left;\n    const mouseY = event.clientY - rect.top;\n    const nextScale = clamp(s - 0.001 * event.deltaY);\n    const ratio = nextScale / s;\n    tx = mouseX - (mouseX - tx) * ratio;\n    ty = mouseY - (mouseY - ty) * ratio;\n    s = nextScale;\n    update();\n  }, { passive: false });\n  update();\n});\n<\/script>\n`

const getExportHtmlCss = () => `
  html,body{margin:0;height:100%;font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#111827;background:#f8fafc;}
  #canvas{position:relative;width:100%;height:100%;overflow:hidden;}
  #canvas .canvas-container{position:absolute;inset:0;overflow:visible;touch-action:none;}
  #canvas .marketing-watermark{position:absolute;left:20px;bottom:20px;z-index:5000;display:inline-flex;align-items:center;justify-content:center;padding:8px 16px;border-radius:999px;background:rgba(255,255,255,0.95);color:#0f62fe;font-weight:600;font-size:15px;line-height:1;letter-spacing:0.2px;text-decoration:none;box-shadow:0 12px 30px rgba(15,23,42,0.18);border:1px solid rgba(15,23,42,0.12);pointer-events:auto;user-select:none;transition:transform .2s ease,box-shadow .2s ease;}
  #canvas .marketing-watermark:hover{transform:translateY(-1px);box-shadow:0 18px 36px rgba(15,23,42,0.2);}
  #canvas .marketing-watermark:active{transform:translateY(0);box-shadow:0 8px 18px rgba(15,23,42,0.22);}  
  #canvas .canvas-content{position:absolute;top:0;left:0;width:100%;height:100%;transform-origin:0 0;}
  #canvas .svg-layer{position:absolute;inset:0;pointer-events:none;overflow:visible;}
  #canvas .line-group{pointer-events:none;}
  #canvas .line{fill:none;stroke:currentColor;stroke-linecap:round;stroke-linejoin:round;filter:drop-shadow(0 0 5px rgba(0,0,0,.15));}
  #canvas .line.line--balance-highlight{stroke-dasharray:16;animation:lineBalanceFlow 2s ease-in-out infinite;}
  #canvas .line.line--pv-highlight{stroke-dasharray:14;animation:linePvFlow 2s ease-in-out infinite;}
  @keyframes lineBalanceFlow{0%{stroke-dashoffset:-24;}50%{stroke:#d93025;}100%{stroke-dashoffset:24;}}
  @keyframes linePvFlow{0%{stroke-dashoffset:-18;}50%{stroke:#0f62fe;}100%{stroke-dashoffset:18;}}
  #canvas .cards-container{position:absolute;inset:0;pointer-events:none;}
  #canvas .card{position:absolute;display:flex;flex-direction:column;align-items:stretch;box-sizing:border-box;border-radius:16px;box-shadow:10px 12px 24px rgba(15,35,95,.16),-6px -6px 18px rgba(255,255,255,.85);overflow:visible;background:var(--card-fill,#ffffff);color:#111827;transition:none;border:var(--card-border,2px solid #000);}
  #canvas .card-header{position:relative;height:52px;border-radius:16px 16px 0 0;display:flex;align-items:center;justify-content:center;text-align:center;padding:10px 44px;font-weight:700;font-size:20px;letter-spacing:0.3px;color:#fff;box-sizing:border-box;}
  #canvas .card-title{display:flex;align-items:center;justify-content:center;width:100%;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:700;font-size:20px;line-height:1;letter-spacing:0.3px;}
  #canvas .card-body{padding:16px;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:12px;text-align:center;border-radius:0 0 16px 16px;background:var(--card-body-gradient,var(--surface,#ffffff));flex:1 1 auto;width:100%;}
  #canvas .card-row{display:flex;align-items:center;justify-content:center;gap:10px;text-align:center;line-height:1.25;}
  #canvas .label{color:#6b7280;font-weight:500;font-size:14px;}
  #canvas .value{color:#111827;font-weight:600;font-size:15px;}
  #canvas .pv-row .value{font-size:18px;font-weight:600;}
  #canvas .coin-icon{width:32px;height:32px;flex-shrink:0;}
  #canvas .slf-badge,#canvas .fendou-badge,#canvas .rank-badge{position:absolute;display:none;pointer-events:none;user-select:none;}
  #canvas .slf-badge.visible{display:block;top:15px;left:15px;font-size:36px;font-weight:900;color:#ffc700;text-shadow:1px 1px 2px rgba(0,0,0,.5);}
  #canvas .fendou-badge.visible{display:block;top:-25px;left:50%;transform:translateX(-50%);font-size:56px;font-weight:900;color:#ff2d55;text-shadow:0 2px 6px rgba(0,0,0,.25);}
  #canvas .rank-badge.visible{display:block;top:-15px;right:15px;width:80px;height:auto;transform:rotate(15deg);}
  #canvas .card-body-html{margin-top:8px;text-align:left;width:100%;}
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

const getConnectionPath = (fromCard, toCard, fromSide, toSide) => {
  const getCoords = (card, side) => {
    const width = Number(card.width) || 380
    const height = Number(card.height) || 280
    switch (side) {
      case 'top':
        return { x: card.x + width / 2, y: card.y }
      case 'bottom':
        return { x: card.x + width / 2, y: card.y + height }
      case 'left':
        return { x: card.x, y: card.y + height / 2 }
      case 'right':
        return { x: card.x + width, y: card.y + height / 2 }
      default:
        return { x: card.x + width / 2, y: card.y + height / 2 }
    }
  }

  const normalizeSide = (side) => {
    const value = String(side || '').toLowerCase()
    if (['top', 'bottom', 'left', 'right'].includes(value)) return value
    return 'right'
  }

  const startSide = normalizeSide(fromSide)
  const endSide = normalizeSide(toSide)

  const startAnchor = getCoords(fromCard, startSide)
  const endAnchor = getCoords(toCard, endSide)

  const offsetPoint = (point, side) => {
    const result = { ...point }
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
    '.selection-box'
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
      width: Number(card.width) || 380,
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
      const borderColor = card.stroke || '#000000'
      const cardFill = card.fill || '#ffffff'
      const bodyGradient = card.bodyGradient || cardFill

      const cardInlineStyles = [
        `width:${card.width}px`,
        `height:${card.height}px`,
        `background:${escapeHtml(cardFill)}`,
        `border:${strokeWidth}px solid ${escapeHtml(borderColor)}`,
        `--card-fill:${escapeHtml(cardFill)}`,
        `--card-body-gradient:${escapeHtml(bodyGradient)}`,
        `--card-border:${strokeWidth}px solid ${escapeHtml(borderColor)}`
      ].join(';')      

      const rows = [
        { label: 'Баланс:', value: card.balance || '0 / 0' },
        { label: 'Актив-заказы PV:', value: card.activePv || '0 / 0' },
        { label: 'Цикл:', value: card.cycle || '0' }
      ]

      const rowsHtml = rows.map(row => `
        <div class="card-row">
          <span class="label">${escapeHtml(row.label)}</span>
          <span class="value">${escapeHtml(row.value)}</span>
        </div>`).join('')

      const bodyExtra = card.bodyHTML ? `<div class="card-body-html">${card.bodyHTML}</div>` : ''

      const badgeHtml = [
        card.showSlfBadge ? '<div class="slf-badge visible">SLF</div>' : '',
        card.showFendouBadge ? '<div class="fendou-badge visible">奋斗</div>' : '',
        card.rankBadge && rankSrc ? `<img class="rank-badge visible" src="${rankSrc}" alt="Ранговый значок" />` : ''
      ].join('')

      return `
        <div class="card" style="${cardInlineStyles};">
          <div class="card-header" style="background:${escapeHtml(headerBg)};">
            <div class="card-title">${escapeHtml(card.text)}</div>
          </div>
          <div class="card-body">
            <div class="card-row pv-row">
              <svg class="coin-icon" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                <circle cx="50" cy="50" r="45" fill="${escapeHtml(card.coinFill || '#ffd700')}" stroke="#DAA520" stroke-width="5" />
              </svg>
              <span class="value">${escapeHtml(card.pv || '330/330pv')}</span>
            </div>
            ${rowsHtml}
            ${bodyExtra}
          </div>
          ${badgeHtml}
        </div>`
    }))

    const cardObjects = cardHtmlList.map((html, index) => {
      const card = cards[index]
      const totalWidth = card.width + EXTRA_PADDING_SIDE * 2
      const totalHeight = card.height + EXTRA_PADDING_TOP
      const foreignX = card.x - minX + PADDING - EXTRA_PADDING_SIDE
      const foreignY = card.y - minY + PADDING - EXTRA_PADDING_TOP

      return `<foreignObject x="${foreignX}" y="${foreignY}" width="${totalWidth}" height="${totalHeight}">
        <div xmlns="http://www.w3.org/1999/xhtml" style="position:relative;top:${EXTRA_PADDING_TOP}px;left:${EXTRA_PADDING_SIDE}px;">
          ${html}
        </div>
      </foreignObject>`
    }).join('\n')

    const connectionMap = new Map(cards.map(card => [card.id, card]))

    const lineObjects = connectionsStore.connections.map((connection) => {
      const fromCard = connectionMap.get(connection.from)
      const toCard = connectionMap.get(connection.to)
      if (!fromCard || !toCard) return ''

      const pathD = getConnectionPath(
        {
          ...fromCard,
          x: fromCard.x - minX + PADDING,
          y: fromCard.y - minY + PADDING
        },
        {
          ...toCard,
          x: toCard.x - minX + PADDING,
          y: toCard.y - minY + PADDING
        },
        connection.fromSide,
        connection.toSide
      )

      if (!pathD) return ''

      const color = connection.color || connectionsStore.defaultLineColor || '#0f62fe'
      const width = connection.thickness || connectionsStore.defaultLineThickness || 5

      const classes = ['line']
      if (connection.highlightType === 'balance') {
        classes.push('line--balance-highlight')
      } else if (connection.highlightType === 'pv') {
        classes.push('line--pv-highlight')
      }

      return `<path d="${pathD}" class="${classes.join(' ')}" stroke="${color}" stroke-width="${width}" fill="none" marker-start="url(#marker-dot)" marker-end="url(#marker-dot)" />`
    }).filter(Boolean).join('\n')

    const panScript = `<script><![CDATA[(function(){const svg=document.documentElement;const content=document.getElementById&&document.getElementById('svg-pan-content');if(!svg||!content||!svg.addEventListener)return;let isPanning=false,panId=null,lastX=0,lastY=0,offsetX=0,offsetY=0;const update=()=>content.setAttribute('transform','translate('+offsetX+' '+offsetY+')');const endPan=(e)=>{if(!isPanning||e.pointerId!==panId)return;isPanning=false;panId=null;svg.style.cursor='grab';if(svg.releasePointerCapture){try{svg.releasePointerCapture(e.pointerId);}catch(err){}}};svg.addEventListener('pointerdown',function(e){if(e.button!==1)return;e.preventDefault();isPanning=true;panId=e.pointerId;lastX=e.clientX;lastY=e.clientY;svg.style.cursor='grabbing';if(svg.setPointerCapture){try{svg.setPointerCapture(e.pointerId);}catch(err){}}});svg.addEventListener('pointermove',function(e){if(!isPanning||e.pointerId!==panId)return;e.preventDefault();offsetX+=e.clientX-lastX;offsetY+=e.clientY-lastY;lastX=e.clientX;lastY=e.clientY;update();});svg.addEventListener('pointerup',endPan);svg.addEventListener('pointercancel',endPan);svg.addEventListener('wheel',function(e){if(isPanning)e.preventDefault();},{passive:false});svg.style.cursor='grab';update();})();]]><\/script>`

    const svgStyle = `
      <style>
        .card { position: relative; display: flex; flex-direction: column; align-items: stretch; box-sizing: border-box; border-radius: 16px; overflow: visible; box-shadow: 10px 12px 24px rgba(15,35,95,0.16), -6px -6px 18px rgba(255,255,255,0.85); background: var(--card-fill,#ffffff); color: #111827; border: var(--card-border,2px solid #000000); }
        .card-header { position: relative; height: 52px; border-radius: 16px 16px 0 0; display: flex; align-items: center; justify-content: center; padding: 10px 44px; color: #fff; font-weight: 700; font-size: 20px; line-height: 1; letter-spacing: 0.3px; box-sizing: border-box; text-align: center; }
        .card-title { display: flex; align-items: center; justify-content: center; width: 100%; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 700; font-size: 20px; line-height: 1; letter-spacing: 0.3px; }
        .card-body { padding: 16px; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; gap: 12px; text-align: center; color: #111827; border-radius: 0 0 16px 16px; background: var(--card-body-gradient,var(--surface,#ffffff)); flex: 1 1 auto; width: 100%; }
        .card-row { display: flex; align-items: center; justify-content: center; gap: 10px; line-height: 1.25; text-align: center; }
        .label { color: #6b7280; font-weight: 500; font-size: 14px; }
        .value { color: #111827; font-weight: 600; font-size: 15px; }
        .pv-row .value { font-size: 18px; font-weight: 600; }
        .coin-icon { width: 32px; height: 32px; }
        .slf-badge, .fendou-badge, .rank-badge { position: absolute; display: none; pointer-events: none; user-select: none; }
        .slf-badge.visible { display: block; top: 15px; left: 15px; font-size: 36px; font-weight: 900; color: #ffc700; text-shadow: 1px 1px 2px rgba(0,0,0,0.5); }
        .fendou-badge.visible { display: block; top: -25px; left: 50%; transform: translateX(-50%); font-size: 56px; font-weight: 900; color: #ff2d55; text-shadow: 0 2px 6px rgba(0,0,0,0.25); }
        .rank-badge.visible { display: block; top: -15px; right: 15px; width: 80px; height: auto; transform: rotate(15deg); }
        .card-body-html { margin-top: 8px; text-align: left; width: 100%; }
        .line { fill: none; stroke-linecap: round; stroke-linejoin: round; }
        .line--balance-highlight { stroke-dasharray: 16; }
        .line--pv-highlight { stroke-dasharray: 14; }
      <\/style>
    `

    const background = backgroundColor.value || '#ffffff'
    const totalWidth = contentWidth + PADDING * 2
    const totalHeight = contentHeight + PADDING * 2
    const viewBoxWidth = totalWidth + VIEWPORT_PADDING * 2
    const viewBoxHeight = totalHeight + VIEWPORT_PADDING * 2
    const LABEL_MARGIN = 24
    const LABEL_WIDTH = 220
    const LABEL_HEIGHT = 42
    const labelX = -VIEWPORT_PADDING + LABEL_MARGIN
    const labelY = totalHeight + VIEWPORT_PADDING - LABEL_MARGIN - LABEL_HEIGHT
    const marketingWatermark = `
      <g class="marketing-watermark" transform="translate(${labelX} ${labelY})">
        <a xlink:href="https://t.me/MarketingFohow" target="_blank" rel="noopener noreferrer" style="cursor:pointer;text-decoration:none;">
          <rect width="${LABEL_WIDTH}" height="${LABEL_HEIGHT}" rx="21" ry="21" fill="rgba(255,255,255,0.95)" stroke="rgba(15,23,42,0.12)" stroke-width="1.2" />
          <text x="${LABEL_WIDTH / 2}" y="${LABEL_HEIGHT / 2}" fill="#0f62fe" font-family="Inter,system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif" font-size="18" font-weight="600" dominant-baseline="middle" text-anchor="middle">@MarketingFohow</text>
        </a>
      </g>; 
    const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="${-VIEWPORT_PADDING} ${-VIEWPORT_PADDING} ${viewBoxWidth} ${viewBoxHeight}" width="${viewBoxWidth}" height="${viewBoxHeight}" style="background:${background};">  <defs>
    ${svgStyle}
    <marker id="marker-dot" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" fill="currentColor">
      <circle cx="5" cy="5" r="4" />
    </marker>
  </defs>
  <g id="svg-pan-content">
    <g style="color:#000000;">
      ${lineObjects}
    </g>
    ${cardObjects}
  </g>
  ${marketingWatermark}  
  ${panScript}
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
  // Печать / Экспорт в PDF
  window.print()
}

const handleLoadProject = () => {
  // Загрузка проекта из JSON
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
const handleFitToContent = () => {
  emit('fit-to-content')
}
onMounted(() => {
  document.addEventListener('pointerdown', handleOutsidePointer)
  window.addEventListener('keydown', handleNotesKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleOutsidePointer)
  window.removeEventListener('keydown', handleNotesKeydown)
})

const handleNotesList = () => {
  notesStore.toggleDropdown()
}

const handleNoteItemClick = (cardId) => {
  notesStore.requestOpen(cardId, { focus: true })
}
const handleNoteEntryClick = (cardId, date) => {
  notesStore.requestOpen(cardId, { focus: true, date })
}

const handleNoteEntryDelete = (cardId, date) => {
  cardsStore.removeCardNoteEntry(cardId, date)
}

const handleCardNotesDelete = (cardId) => {
  cardsStore.clearCardNotes(cardId)
}

const handleOutsidePointer = (event) => {
  if (!notesStore.dropdownOpen) {
    return
  }
  const target = event.target
  if (notesButtonRef.value?.contains(target) || notesDropdownRef.value?.contains(target)) {
    return
  }
  notesStore.closeDropdown()
}

const handleNotesKeydown = (event) => {
  if (event.key === 'Escape') {
    notesStore.closeDropdown()
  }
}

const handleSelectionMode = () => {
  canvasStore.toggleSelectionMode()

}

const handleHierarchicalDragMode = () => {
  canvasStore.toggleHierarchicalDragMode()

}

const handleToggleGuides = () => {
  canvasStore.toggleGuides()

}
</script>

<template>
  <div
    :class="[
      'left-panel-controls',
      {
        'left-panel-controls--modern': props.isModernTheme,
        'left-panel-controls--collapsed': props.isCollapsed
      }
    ]"
  >
    <template v-if="props.isCollapsed">
      <div class="left-panel-controls__collapsed">
        <button
          class="ui-btn theme-toggle"
          type="button"
          :title="props.isModernTheme ? 'Вернуть светлое меню' : 'Включить тёмное меню'"
          @click="emit('toggle-theme')"
        >
          <span class="theme-toggle__icon" aria-hidden="true"></span>
        </button>
        <div class="left-panel-controls__history">
          <button
            class="ui-btn"
            id="undo-btn"
            title="Отменить (Ctrl+Z)"
            @click="handleUndo"
            :disabled="!historyStore.canUndo"
          >
            ↶
          </button>
          <button
            class="ui-btn"
            id="redo-btn"
            title="Повторить (Ctrl+Shift+Z)"
            @click="handleRedo"
            :disabled="!historyStore.canRedo"
          >
            ↷
          </button>
        </div>
        <div class="left-panel-controls__notes left-panel-controls__notes--collapsed">
          <button
            ref="notesButtonRef"
            class="ui-btn"
            :class="{ active: dropdownOpen }"
            type="button"
            title="Список заметок"
            :disabled="!hasNoteEntries"
            @pointerdown.stop
            @click="handleNotesList"
          >
            🗒️
          </button>
          <transition name="notes-dropdown-fade">
            <div
              v-if="dropdownOpen"
              ref="notesDropdownRef"
              class="notes-dropdown"
            >
              <div
                v-for="item in cardsWithEntries"
                :key="item.id"
                class="notes-dropdown__group"
              >
                <div class="notes-dropdown__card-row">
                  <button
                    type="button"
                    class="notes-dropdown__card-button"
                    @pointerdown.stop
                    @click.stop="handleNoteItemClick(item.id)"
                  >
                    📝 {{ item.title }}
                  </button>
                  <button
                    type="button"
                    class="notes-dropdown__icon-btn notes-dropdown__icon-btn--danger"
                    title="Удалить все заметки"
                    @pointerdown.stop
                    @click.stop="handleCardNotesDelete(item.id)"
                  >
                    🗑️
                  </button>
                </div>
                <div class="notes-dropdown__entries">
                  <div
                    v-for="entry in item.entries"
                    :key="entry.date"
                    class="notes-dropdown__entry"
                  >
                    <button
                      type="button"
                      class="notes-dropdown__entry-button"
                      @pointerdown.stop
                      @click.stop="handleNoteEntryClick(item.id, entry.date)"
                    >
                      <span
                        class="notes-dropdown__entry-color"
                        :style="{ backgroundColor: entry.color }"
                      ></span>
                      <span class="notes-dropdown__entry-label">{{ entry.label }}</span>
                    </button>
                    <button
                      type="button"
                      class="notes-dropdown__icon-btn"
                      title="Удалить заметку"
                      @pointerdown.stop
                      @click.stop="handleNoteEntryDelete(item.id, entry.date)"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </transition>
        </div>        
        <button
          class="ui-btn left-panel-controls__pencil"
          type="button"
          title="Режим карандаша"
          @pointerdown.stop
          @click.stop="emit('activate-pencil')"
        >
          <span aria-hidden="true">✏️</span>
        </button>
      </div>
    </template>
    <template v-else>
      <div class="left-panel-controls__grid">
        <button
          class="ui-btn theme-toggle left-panel-controls__grid-item--full"
          type="button"
          :title="props.isModernTheme ? 'Вернуть светлое меню' : 'Включить тёмное меню'"
          @click="emit('toggle-theme')"
        >
          <span class="theme-toggle__icon" aria-hidden="true"></span>
        </button>
        <button
          class="ui-btn"
          id="undo-btn"
          title="Отменить (Ctrl+Z)"
          @click="handleUndo"
          :disabled="!historyStore.canUndo"
        >
          ↶
        </button>
        <button
          class="ui-btn"
          id="redo-btn"
          title="Повторить (Ctrl+Shift+Z)"
          @click="handleRedo"
          :disabled="!historyStore.canRedo"
        >
          ↷
        </button>
        <button class="ui-btn" title="Сохранить проект (JSON)" @click="handleSaveProject">💾</button>
        <button class="ui-btn" title="Экспорт в HTML (просмотр)" @click="handleExportHTML">📄</button>
        <button class="ui-btn" title="Экспорт в SVG (вектор)" @click="handleExportSVG">🖋️</button>
        <button class="ui-btn" title="Печать / Экспорт в PDF" @click="handlePrint">🖨️</button>
        <button class="ui-btn" title="Загрузить проект из JSON" @click="handleLoadProject">📂</button>
        <div class="left-panel-controls__notes">
          <button
            ref="notesButtonRef"
            class="ui-btn"
            type="button"
            title="Список заметок"
            :class="{ active: dropdownOpen }"
            :disabled="!hasNoteEntries"
            @pointerdown.stop
            @click="handleNotesList"
          >
            🗒️
          </button>
          <transition name="notes-dropdown-fade">
            <div
              v-if="dropdownOpen"
              ref="notesDropdownRef"
              class="notes-dropdown"
            >
              <div
                v-for="item in cardsWithEntries"
                :key="item.id"
                class="notes-dropdown__group"
              >
                <div class="notes-dropdown__card-row">
                  <button
                    type="button"
                    class="notes-dropdown__card-button"
                    @pointerdown.stop
                    @click.stop="handleNoteItemClick(item.id)"
                  >
                    📝 {{ item.title }}
                  </button>
                  <button
                    type="button"
                    class="notes-dropdown__icon-btn notes-dropdown__icon-btn--danger"
                    title="Удалить все заметки"
                    @pointerdown.stop
                    @click.stop="handleCardNotesDelete(item.id)"
                  >
                    🗑️
                  </button>
                </div>
                <div class="notes-dropdown__entries">
                  <div
                    v-for="entry in item.entries"
                    :key="entry.date"
                    class="notes-dropdown__entry"
                  >
                    <button
                      type="button"
                      class="notes-dropdown__entry-button"
                      @pointerdown.stop
                      @click.stop="handleNoteEntryClick(item.id, entry.date)"
                    >
                      <span
                        class="notes-dropdown__entry-color"
                        :style="{ backgroundColor: entry.color }"
                      ></span>
                      <span class="notes-dropdown__entry-label">{{ entry.label }}</span>
                    </button>
                    <button
                      type="button"
                      class="notes-dropdown__icon-btn"
                      title="Удалить заметку"
                      @pointerdown.stop
                      @click.stop="handleNoteEntryDelete(item.id, entry.date)"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </transition>
        </div>
        <button
          class="ui-btn"
          :class="{ active: isSelectionMode }"
          :aria-pressed="isSelectionMode"
          title="Режим выделения (Esc)"
          @click="handleSelectionMode"
        >
          ⬚
        </button>
        <button
          class="ui-btn"
          :class="{ active: isHierarchicalDragMode }"
          :aria-pressed="isHierarchicalDragMode"
          title="Режим иерархии"
          @click="handleHierarchicalDragMode"
        >
          🌳
        </button>
        <button
          class="ui-btn"
          :class="{ active: guidesEnabled }"
          :aria-pressed="guidesEnabled"
          title="Показать/скрыть направляющие"
          @click="handleToggleGuides"
        >
          📐
        </button>
        <button
          class="ui-btn left-panel-controls__pencil"
          type="button"
          title="Режим карандаша"
          @pointerdown.stop
          @click.stop="emit('activate-pencil')"
        >
          <span aria-hidden="true">✏️</span>
        </button>
      </div>
    </template>
     <div class="left-panel-controls__zoom">
      <button
        class="left-panel-controls__zoom-button"
        type="button"
        title="Автоподгонка масштаба"
        @click="handleFitToContent"
      >
        Масштаб: <span class="left-panel-controls__zoom-value">{{ zoomDisplay }}</span>
      </button>
    </div>   
    <input type="file" accept=".json,application/json" style="display:none">
  </div>
</template>

<style scoped>
.left-panel-controls {
  --left-panel-btn-size: 72px;
  --left-panel-btn-radius: 22px;
  --left-panel-btn-font: 30px;
  --left-panel-btn-bg: rgba(255, 255, 255, 0.92);
  --left-panel-btn-border: rgba(15, 23, 42, 0.14);
  --left-panel-btn-color: #111827;
  --left-panel-btn-shadow: 0 12px 28px rgba(15, 23, 42, 0.16);
  --left-panel-section-gap: 18px;

  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--left-panel-section-gap);
  width: 100%;
  max-height: none;
  overflow: visible;
  box-sizing: border-box;
}
.left-panel-controls--modern {
  --left-panel-btn-bg: rgba(28, 38, 58, 0.9);
  --left-panel-btn-border: rgba(96, 164, 255, 0.35);
  --left-panel-btn-color: #e5f3ff;
  --left-panel-btn-shadow: 0 18px 34px rgba(6, 11, 21, 0.45);
}

.left-panel-controls--collapsed {
  --left-panel-section-gap: 14px;
  gap: var(--left-panel-section-gap);
  padding-right: 0;
}
.left-panel-controls__collapsed {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: calc(var(--left-panel-section-gap) * 0.85);
  width: 100%;
  flex-wrap: nowrap;
}

.left-panel-controls__collapsed .ui-btn {
  width: var(--left-panel-btn-size);  
}

.left-panel-controls__history {
  display: flex;
  align-items: center; 
  justify-content: center;
  gap: calc(var(--left-panel-section-gap) * 0.6);
}

.left-panel-controls__history .ui-btn {
  width: var(--left-panel-btn-size);
}

.left-panel-controls__grid {
  display: grid;
  grid-template-columns: repeat(2, var(--left-panel-btn-size));
  justify-content: center;
  justify-items: center;
  column-gap: calc(var(--left-panel-section-gap) * 0.75);
  row-gap: calc(var(--left-panel-section-gap) * 0.75);
  width: 100%;
}

.left-panel-controls__grid .ui-btn {
  width: var(--left-panel-btn-size);
}
.left-panel-controls__grid-item--full {
  grid-column: 1 / -1;
}
.left-panel-controls__notes {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--left-panel-btn-size);
}

.left-panel-controls__notes--collapsed {
  width: var(--left-panel-btn-size);
}

.left-panel-controls__notes .ui-btn {
  width: var(--left-panel-btn-size);
}

.notes-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  right: auto;
  min-width: 220px;
  background: var(--left-panel-btn-bg);
  border: 1px solid var(--left-panel-btn-border);
  border-radius: 18px;
  box-shadow: 0 20px 34px rgba(15, 23, 42, 0.28);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  z-index: 30;
}
.notes-dropdown__group {
  display: flex;
  flex-direction: column;
  gap: 10px;
}  

.notes-dropdown__group + .notes-dropdown__group {
  border-top: 1px solid rgba(15, 23, 42, 0.12);
  padding-top: 12px;
  margin-top: 4px;
}

.notes-dropdown__card-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.notes-dropdown__card-button {  border: none;
  background: rgba(15, 23, 42, 0.06);
  color: var(--left-panel-btn-color);
  border-radius: 12px;
  padding: 10px 12px;
  font-size: 15px;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  transition: transform 0.18s ease, background 0.18s ease;
  flex: 1 1 auto;  
}

.notes-dropdown__card-button:hover {
  background: rgba(59, 130, 246, 0.18);
  transform: translateX(4px);
}
.notes-dropdown__entries {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.notes-dropdown__entry {
  display: flex;
  align-items: center;
  gap: 6px;
}

.notes-dropdown__entry-button {
  border: none;
  background: rgba(15, 23, 42, 0.06);
  color: var(--left-panel-btn-color);
  border-radius: 10px;
  padding: 6px 10px;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  transition: transform 0.18s ease, background 0.18s ease;
}

.notes-dropdown__entry-button:hover {
  background: rgba(59, 130, 246, 0.18);
  transform: translateX(4px);
}

.notes-dropdown__entry-color {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.2);
}

.notes-dropdown__entry-label {
  font-weight: 600;
  line-height: 1;
}

.notes-dropdown__icon-btn {
  border: none;
  background: transparent;
  color: var(--left-panel-btn-color);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px;
  border-radius: 8px;
  font-size: 16px;
  line-height: 1;
  transition: background 0.18s ease, transform 0.18s ease, color 0.18s ease;
}

.notes-dropdown__icon-btn:hover {
  background: rgba(15, 23, 42, 0.12);
  transform: translateY(-1px);
}

.notes-dropdown__icon-btn--danger {
  color: #dc2626;
}

.notes-dropdown__icon-btn--danger:hover {
  background: rgba(248, 113, 113, 0.18);
  color: #b91c1c;
}

.notes-dropdown-fade-enter-active,
.notes-dropdown-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.notes-dropdown-fade-enter-from,
.notes-dropdown-fade-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}  
.left-panel-controls__zoom {
  width: 100%;
  margin-top: auto;
  padding-top: calc(var(--left-panel-section-gap) * 0.4);
}
.left-panel-controls__zoom-button {
  width: 100%;
  padding: 14px 18px;
  border-radius: var(--left-panel-btn-radius);
  border: 1px solid var(--left-panel-btn-border);
  background: var(--left-panel-btn-bg);
  color: var(--left-panel-btn-color);
  font-size: calc(var(--left-panel-btn-font) * 0.55);
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  box-shadow: var(--left-panel-btn-shadow);
}
.left-panel-controls__zoom-button:hover {
  transform: translateY(-2px);
  filter: brightness(1.02);
}
.left-panel-controls__zoom-button:active {
  transform: translateY(1px);
  filter: brightness(0.98);
}
.left-panel-controls__zoom-value {
  font-variant-numeric: tabular-nums;
}  
.left-panel-controls .ui-btn {
  width: var(--left-panel-btn-size);
  height: var(--left-panel-btn-size);
  border-radius: var(--left-panel-btn-radius);
  border: 1px solid var(--left-panel-btn-border);
  background: var(--left-panel-btn-bg);
  color: var(--left-panel-btn-color);
  font-size: var(--left-panel-btn-font);
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: transform .2s ease, box-shadow .2s ease, background .2s ease, border-color .2s ease;
  box-shadow: var(--left-panel-btn-shadow);
}

.left-panel-controls .ui-btn:hover:not(:disabled) {
  transform: translateY(-4px);
  box-shadow: 0 18px 32px rgba(15, 23, 42, 0.22);
}

.left-panel-controls .ui-btn.active {
  border-color: rgba(15, 98, 254, 0.85);
  box-shadow: 0 22px 36px rgba(15, 98, 254, 0.28);
}
  
.left-panel-controls--modern .ui-btn:hover:not(:disabled) {
  background: rgba(44, 58, 82, 0.95);
  box-shadow: 0 32px 52px rgba(8, 12, 22, 0.58);
}

.left-panel-controls .ui-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.theme-toggle {
  position: relative;
  border: none;
  background: var(--left-panel-btn-bg);
  box-shadow: inset 0 2px 0 rgba(255,255,255,0.25), 0 18px 30px rgba(15, 23, 42, 0.16);
}

.left-panel-controls--modern .theme-toggle {
  background: var(--left-panel-btn-bg);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.18), 0 32px 50px rgba(6, 11, 21, 0.48);
}

.theme-toggle__icon {
  display: block;
  width: calc(var(--left-panel-btn-size) / 2.8);
  height: calc(var(--left-panel-btn-size) / 2.8);
  border-radius: 50%;
  margin: 0 auto;
  background: radial-gradient(circle at 30% 30%, #59d0ff 0%, #11cbff 45%, rgba(17,203,255,0.2) 70%, transparent 100%);
}

.left-panel-controls:not(.left-panel-controls--modern) .theme-toggle__icon {
  background: radial-gradient(circle at 30% 30%, #0f62fe 0%, rgba(15,98,254,0.55) 60%, transparent 100%);
}

.left-panel-controls--modern .ui-btn.active {
  border-color: rgba(89, 208, 255, 0.65);
  box-shadow: 0 30px 48px rgba(17, 203, 255, 0.32);
}
  
.left-panel-controls__pencil {
  position: relative;
  overflow: hidden;
  width: var(--left-panel-btn-size);
  font-size: calc(var(--left-panel-btn-font) * 0.75);
  border: none;
  box-shadow: none;
  background: transparent;
  transform: none;
}

.left-panel-controls__pencil span {
  position: relative;
  z-index: 1;
}

.left-panel-controls__pencil:hover {
  transform: none;
}

.left-panel-controls__pencil::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: var(--left-panel-btn-radius);
  background: var(--left-panel-btn-bg);
  border: 1px solid var(--left-panel-btn-border);
  box-shadow: var(--left-panel-btn-shadow);
  pointer-events: none;
  transition: transform .2s ease, box-shadow .2s ease;
}

.left-panel-controls__pencil:hover::before {
  transform: translateY(-4px);
  box-shadow: 0 18px 32px rgba(15, 23, 42, 0.22);
}

.left-panel-controls--modern .left-panel-controls__pencil::before {
  box-shadow: 0 18px 34px rgba(6, 11, 21, 0.45);
}

.left-panel-controls--modern .left-panel-controls__pencil:hover::before {
  box-shadow: 0 32px 52px rgba(8, 12, 22, 0.58);  
}
.left-panel-controls--collapsed .left-panel-controls__pencil {
  width: var(--left-panel-btn-size);
}

.left-panel-controls--modern .left-panel-controls__pencil {
  box-shadow: 0 18px 34px rgba(6, 11, 21, 0.52);
}
.left-panel-controls--modern.left-panel-controls--collapsed .left-panel-controls__pencil {
  width: calc(var(--left-panel-btn-size) * 0.6);
}

.left-panel-controls--collapsed .ui-btn {
  box-shadow: 0 10px 18px rgba(15, 23, 42, 0.18);
}

.left-panel-controls--collapsed .theme-toggle {
  box-shadow: inset 0 2px 0 rgba(255,255,255,0.18), 0 18px 30px rgba(15, 23, 42, 0.18);
}
</style>
