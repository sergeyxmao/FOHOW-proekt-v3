import { ref, onMounted, onUnmounted } from 'vue'

export function usePanZoom(canvasElement) {
  const scale = ref(1)
  const translateX = ref(0)
  const translateY = ref(0)
  
  const MIN_SCALE = 0.01  // Минимальное уменьшение - 1%
  const MAX_SCALE = 5     // Максимальное увеличение - 500%

  const PAN_CURSOR_CLASS = 'canvas-container--panning'
  
  let isPanning = false
  let startX = 0
  let startY = 0
  let previousCursor = ''

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
    if (!canvasElement.value) return
    const canvasContent = canvasElement.value.querySelector('.canvas-content')
    if (canvasContent) {
      canvasContent.style.transform =
        `translate(${translateX.value}px, ${translateY.value}px) scale(${scale.value})`
    }
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
  
  const handlePointerDown = (event) => {
    if (!canvasElement.value) return    
    // Панорамирование по средней кнопке мыши
    if (event.button === 1) {
      if (!canvasElement.value.contains(event.target)) {
        return
      }      
      event.preventDefault()
      isPanning = true
      startX = event.clientX - translateX.value
      startY = event.clientY - translateY.value

      canvasElement.value.classList.add(PAN_CURSOR_CLASS)
      setBodyCursor('grabbing')
    }
  }
  
  const handlePointerMove = (event) => {
    if (!isPanning) return
    
    event.preventDefault()
    translateX.value = event.clientX - startX
    translateY.value = event.clientY - startY
    updateTransform()
  }
  
  const handlePointerUp = () => {
    if (isPanning) {
      isPanning = false
      if (canvasElement.value) {
        canvasElement.value.classList.remove(PAN_CURSOR_CLASS)
      }
      setBodyCursor()    }
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
    maxScale: MAX_SCALE  }
}
