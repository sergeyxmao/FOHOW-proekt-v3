import { ref, onMounted, onUnmounted } from 'vue'

export function usePanZoom(canvasElement) {
  const scale = ref(1)
  const translateX = ref(0)
  const translateY = ref(0)
  
  const MIN_SCALE = 0.05  // Минимальное уменьшение - 5%
  const MAX_SCALE = 5     // Максимальное увеличение - 500%
  
  let isPanning = false
  let startX = 0
  let startY = 0
  
const updateTransform = () => {
  if (!containerRef.value) return
  const canvasContent = containerRef.value.querySelector('.canvas-content')
  if (canvasContent) {
    canvasContent.style.transform = 
      `translate(${translateX.value}px, ${translateY.value}px) scale(${scale.value})`
  }
}
  
  const handleWheel = (event) => {
    if (!canvasElement.value) return
    
    // Игнорируем если wheel над панелями
    if (event.target.closest('.ui-panel-left') || event.target.closest('.ui-panel-right')) {
      return
    }
    
    event.preventDefault()
    
    const delta = -event.deltaY * 0.001
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
    // Панорамирование по средней кнопке мыши
    if (event.button === 1) {
      event.preventDefault()
      isPanning = true
      startX = event.clientX - translateX.value
      startY = event.clientY - translateY.value
      document.body.style.cursor = 'grabbing'
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
      document.body.style.cursor = 'default'
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
  })
  
  return {
    scale,
    translateX,
    translateY
  }
}
