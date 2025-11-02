import { ref, onMounted, onUnmounted } from 'vue'

export function usePanZoom(canvasElement) {
  const scale = ref(1)
  const translateX = ref(0)
  const translateY = ref(0)
  
  const MIN_SCALE = 0.01  // Минимальное уменьшение - 1%
  const MAX_SCALE = 5     // Максимальное увеличение - 500%

  const PAN_CURSOR_CLASS = 'canvas-container--panning'
    const PAN_EXCLUDE_SELECTOR = [
    '.card',
    '.note-window',
    '.card-controls',
    '.card-header',
    '.card-body',
    '.line-group',
    '.line',
    '.line-hitbox',
    '.ui-panel-left',
    '.ui-panel-right',
    '.mobile-toolbar',
    '.mobile-header',
    '[data-prevent-pan]'
  ].join(', ')

  let isPanning = false
  let startX = 0
  let startY = 0
  let previousCursor = ''
  const activeTouchPointers = new Map()
  let pinchState = null
  let panPointerId = null
  let panPointerType = null 
  let transformFrame = null
  const canStartTouchPan = (event) => {
    if (!canvasElement.value) {
      return false
    }

    const target = event?.target
    if (!target || typeof target.closest !== 'function') {
      return false
    }

    if (!canvasElement.value.contains(target)) {
      return false
    }

    if (PAN_EXCLUDE_SELECTOR && target.closest(PAN_EXCLUDE_SELECTOR)) {
      return false
    }

    return true
  }

  const startPan = (event) => {
    if (!canvasElement.value) {
      return
    }

    isPanning = true
    panPointerId = event.pointerId
    panPointerType = event.pointerType
    startX = event.clientX - translateX.value
    startY = event.clientY - translateY.value

    canvasElement.value.classList.add(PAN_CURSOR_CLASS)
    if (event.pointerType !== 'touch') {
      setBodyCursor('grabbing')
    }
  }

  const stopPanning = () => {
    if (!isPanning) {
      return
    }

    const wasTouch = panPointerType === 'touch'

    isPanning = false
    panPointerId = null
    panPointerType = null

    if (canvasElement.value) {
      canvasElement.value.classList.remove(PAN_CURSOR_CLASS)
    }

    if (!wasTouch) {
      setBodyCursor()
    }
  }
  const applyTransformStyles = () => {
    if (!canvasElement.value) {
      return
    }

    const canvasContent = canvasElement.value.querySelector('.canvas-content')
    if (canvasContent) {
      canvasContent.style.transform = `translate(${translateX.value}px, ${translateY.value}px) scale(${scale.value})`
    }
  }

  const setBodyCursor = (value) => {
    if (!document?.body) {
      return
    }

    if (value) {
      if (!previousCursor) {
        previousCursor = document.body.style.cursor || ''
      }
      document.body.style.cursor = value
      return
    }

    document.body.style.cursor = previousCursor || ''
    previousCursor = ''
  }
  
  const updateTransform = () => {
    if (transformFrame !== null) {
      return
    }

    transformFrame = requestAnimationFrame(() => {
      transformFrame = null
      applyTransformStyles()
    })    
  }
  
  const clampScale = (value) => {
    if (!Number.isFinite(value)) {
      return scale.value
    }
    return Math.max(MIN_SCALE, Math.min(MAX_SCALE, value))
  }

  const setScale = (value) => {
    scale.value = clampScale(value)
    updateTransform()
  }

  const setTranslation = (x, y) => {
    if (Number.isFinite(x)) {
      translateX.value = x
    }
    if (Number.isFinite(y)) {
      translateY.value = y
    }
    updateTransform()
  }

  const setTransform = ({ scale: nextScale, translateX: nextTranslateX, translateY: nextTranslateY } = {}) => {
    if (Number.isFinite(nextScale)) {
      scale.value = clampScale(nextScale)
    }
    if (Number.isFinite(nextTranslateX)) {
      translateX.value = nextTranslateX
    }
    if (Number.isFinite(nextTranslateY)) {
      translateY.value = nextTranslateY
    }
    updateTransform()
  }

  const resetTransform = () => {
    scale.value = 1
    translateX.value = 0
    translateY.value = 0
    updateTransform()
  }
  const handleWheel = (event) => {
    if (!canvasElement.value) return


    if (event.ctrlKey) {
      return
    }
    
    // Игнорируем если wheel над панелями или в области заметки
    if (
      event.target.closest('.ui-panel-left') ||
      event.target.closest('.ui-panel-right') ||
      event.target.closest('.note-window')
    ) {
      return
    }
    
    event.preventDefault()
    
    const delta = -event.deltaY * 0.0005
    const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale.value + delta))
    
    // Зум относительно позиции мыши
    const rect = canvasElement.value.getBoundingClientRect()
    const mouseX = event.clientX - rect.left
    const mouseY = event.clientY - rect.top
    
    const scaleRatio = newScale / scale.value
    
    translateX.value = mouseX - (mouseX - translateX.value) * scaleRatio
    translateY.value = mouseY - (mouseY - translateY.value) * scaleRatio
    scale.value = newScale
    
    updateTransform()
  }
  const updatePinchState = () => {
    if (!canvasElement.value || activeTouchPointers.size !== 2) {
      pinchState = null
      return
    }

    const pointers = Array.from(activeTouchPointers.values())
    const [first, second] = pointers
    const dx = first.x - second.x
    const dy = first.y - second.y
    const distance = Math.hypot(dx, dy)

    if (distance === 0) {
      pinchState = null
      return
    }

    const rect = canvasElement.value.getBoundingClientRect()
    const centerClientX = (first.x + second.x) / 2
    const centerClientY = (first.y + second.y) / 2
    const centerX = centerClientX - rect.left
    const centerY = centerClientY - rect.top

    const currentScale = scale.value
    const contentCenterX = (centerX - translateX.value) / currentScale
    const contentCenterY = (centerY - translateY.value) / currentScale

    pinchState = {
      initialDistance: distance,
      initialScale: currentScale,
      initialTranslateX: translateX.value,
      initialTranslateY: translateY.value,
      contentCenterX,
      contentCenterY,
      centerStartX: centerX,
      centerStartY: centerY
    }
  }

  const applyPinchTransform = () => {
    if (!canvasElement.value || !pinchState || activeTouchPointers.size !== 2) {
      return
    }

    const pointers = Array.from(activeTouchPointers.values())
    const [first, second] = pointers
    const dx = first.x - second.x
    const dy = first.y - second.y
    const distance = Math.hypot(dx, dy)

    if (distance === 0 || !Number.isFinite(distance)) {
      return
    }

    const distanceRatio = distance / pinchState.initialDistance
    const nextScale = clampScale(pinchState.initialScale * distanceRatio)

    const rect = canvasElement.value.getBoundingClientRect()
    const centerClientX = (first.x + second.x) / 2
    const centerClientY = (first.y + second.y) / 2
    const centerX = centerClientX - rect.left
    const centerY = centerClientY - rect.top

    const nextTranslateX = centerX - pinchState.contentCenterX * nextScale
    const nextTranslateY = centerY - pinchState.contentCenterY * nextScale

    scale.value = nextScale
    translateX.value = nextTranslateX
    translateY.value = nextTranslateY

    pinchState = {
      ...pinchState,
      initialDistance: distance,
      initialScale: nextScale,
      initialTranslateX: nextTranslateX,
      initialTranslateY: nextTranslateY,
      centerStartX: centerX,
      centerStartY: centerY,
      contentCenterX: (centerX - nextTranslateX) / nextScale,
      contentCenterY: (centerY - nextTranslateY) / nextScale
    }
    updateTransform()
  }  
  const handlePointerDown = (event) => {
    if (!canvasElement.value) return

    if (event.pointerType === 'touch') {
      if (!canvasElement.value.contains(event.target)) {
        return
      }
      activeTouchPointers.set(event.pointerId, { x: event.clientX, y: event.clientY })

      if (activeTouchPointers.size === 1) {
        if (canStartTouchPan(event)) {
          event.preventDefault()
          startPan(event)
        }
        return
      }

      if (isPanning && panPointerType === 'touch') {
        stopPanning()
      }
  
      updatePinchState()
      event.preventDefault()    
      return
    }
    // Панорамирование по средней кнопке мыши
    if (event.button === 1) {
      if (!canvasElement.value.contains(event.target)) {
        return
      }      
      event.preventDefault()
      startPan(event)
    }
  }
  
  const handlePointerMove = (event) => {
    if (event.pointerType === 'touch') {
      if (!activeTouchPointers.has(event.pointerId)) {
        return
      }
      activeTouchPointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
      if (activeTouchPointers.size >= 2) {
        event.preventDefault()
        if (!pinchState) {
          updatePinchState()
        }
        applyPinchTransform()
        return
      }

      if (isPanning && panPointerType === 'touch' && panPointerId === event.pointerId) {
        event.preventDefault()
        translateX.value = event.clientX - startX
        translateY.value = event.clientY - startY
        updateTransform()        
      }
      return
    }
    if (!isPanning || panPointerId !== event.pointerId) return

    event.preventDefault()
    translateX.value = event.clientX - startX
    translateY.value = event.clientY - startY
    updateTransform()
  }
  
  const handlePointerUp = (event) => {
    if (event.pointerType === 'touch') {
      activeTouchPointers.delete(event.pointerId)
      if (isPanning && panPointerType === 'touch' && panPointerId === event.pointerId) {
        stopPanning()
      }      
      if (activeTouchPointers.size < 2) {
        pinchState = null
      } else {
        updatePinchState()
      }
      return
    }

    if (isPanning && panPointerId === event.pointerId) {
      stopPanning()
    }
  }
  
  onMounted(() => {
    if (!canvasElement.value) return
    
    window.addEventListener('wheel', handleWheel, { passive: false })
    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)
    
    updateTransform()
  })
  
  onUnmounted(() => {
    window.removeEventListener('wheel', handleWheel)
    window.removeEventListener('pointerdown', handlePointerDown)
    window.removeEventListener('pointermove', handlePointerMove)
    window.removeEventListener('pointerup', handlePointerUp)
    window.removeEventListener('pointercancel', handlePointerUp)
    setBodyCursor()
    if (canvasElement.value) {
      canvasElement.value.classList.remove(PAN_CURSOR_CLASS)
    }
    if (transformFrame !== null) {
      cancelAnimationFrame(transformFrame)
      transformFrame = null
    }
  })
  
  return {
    scale,
    translateX,
    translateY,
    clampScale,
    setScale,
    setTranslation,
    setTransform,
    resetTransform,
    minScale: MIN_SCALE,
    maxScale: MAX_SCALE
  }
}
