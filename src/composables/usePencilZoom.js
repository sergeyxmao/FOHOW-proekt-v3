/**
 * Composable для управления зумом и панорамированием в PencilOverlay
 */

import { ref, computed, watch } from 'vue'

const MAX_ZOOM = 4
const ZOOM_STEP = 0.1

/**
 * @typedef {Object} UsePencilZoomOptions
 * @property {import('vue').Ref<boolean>} isReady - Готов ли canvas
 */

/**
 * Composable для управления зумом и панорамированием
 * @param {UsePencilZoomOptions} options
 */
export function usePencilZoom(options = {}) {
  const { isReady } = options

  // === Refs и состояния ===
  const zoomScale = ref(1)
  const minZoomScale = ref(1)
  const panOffset = ref({ x: 0, y: 0 })
  const isPanning = ref(false)
  const panPointerId = ref(null)
  const panStartPoint = ref(null)
  const panInitialOffset = ref({ x: 0, y: 0 })
  
  // Состояние для pinch-zoom
  const activePointers = new Map()
  const isPinching = ref(false)
  let pinchState = null

  // === Computed ===
  const isZoomedIn = computed(() => {
    const minZoom = minZoomScale.value || 1
    return (zoomScale.value || 1) > minZoom + 0.0001
  })

  // === Watcher для сброса pan при выходе из зума ===
  watch(isZoomedIn, (zoomed) => {
    if (!zoomed) {
      resetPan()
    }
  })

  // === Вспомогательные функции ===

  /**
   * Ограничение значения зума
   * @param {number} value - Значение для ограничения
   * @returns {number}
   */
  const clampZoom = (value) => {
    const MIN_ZOOM = minZoomScale.value || 1
    return Math.min(Math.max(value, MIN_ZOOM), MAX_ZOOM)
  }

  /**
   * Сброс состояния панорамирования
   */
  const resetPan = () => {
    panOffset.value = { x: 0, y: 0 }
    isPanning.value = false
    panPointerId.value = null
    panStartPoint.value = null
    panInitialOffset.value = { x: 0, y: 0 }
    // Сбрасываем pinch при сбросе панорамирования
    activePointers.clear()
    isPinching.value = false
    pinchState = null
  }

  /**
   * Обработка колеса мыши для зума
   * @param {WheelEvent} event - Событие колеса
   */
  const handleBoardWheel = (event) => {
    if (isReady && !isReady.value) {
      return
    }

    event.preventDefault()
    const currentScale = zoomScale.value || 1

    const zoomIn = event.deltaY < 0
    const factor = zoomIn ? 1 + ZOOM_STEP : 1 / (1 + ZOOM_STEP)
    const updatedScale = clampZoom(currentScale * factor)
    if (Math.abs(updatedScale - currentScale) < 0.0001) {
      return
    }

    const boardElement = event.currentTarget
    if (!boardElement || typeof boardElement.getBoundingClientRect !== 'function') {
      zoomScale.value = Number.parseFloat(updatedScale.toFixed(4))
      return
    }

    const rect = boardElement.getBoundingClientRect()
    const pointerOffsetX = event.clientX - rect.left
    const pointerOffsetY = event.clientY - rect.top

    const localX = pointerOffsetX / currentScale
    const localY = pointerOffsetY / currentScale
    const currentPan = panOffset.value || { x: 0, y: 0 }
    const scaleDifference = currentScale - updatedScale

    panOffset.value = {
      x: currentPan.x + scaleDifference * localX,
      y: currentPan.y + scaleDifference * localY
    }

    zoomScale.value = Number.parseFloat(updatedScale.toFixed(4))
  }

  // === Logic for Pinch Zoom ===
  
  const updatePinchState = (boardElement) => {
    if (activePointers.size < 2) {
      pinchState = null
      isPinching.value = false
      return
    }

    const pointers = Array.from(activePointers.values())
    // Берем первые два поинтера
    const p1 = pointers[0]
    const p2 = pointers[1]

    const dx = p1.x - p2.x
    const dy = p1.y - p2.y
    const distance = Math.hypot(dx, dy)

    if (distance === 0) return

    const rect = boardElement.getBoundingClientRect()
    // Центр между пальцами в координатах viewport
    const centerClientX = (p1.x + p2.x) / 2
    const centerClientY = (p1.y + p2.y) / 2
    
    const currentScale = zoomScale.value || 1
    const currentPan = panOffset.value || { x: 0, y: 0 }

    // Вычисляем "базовую" позицию элемента (где он был бы без transform: translate)
    // rect.left = baseOriginX + currentPan.x
    const baseOriginX = rect.left - currentPan.x
    const baseOriginY = rect.top - currentPan.y

    // Точка в контенте, которая находится под центром щипка
    // contentX = (centerClientX - rect.left) / currentScale
    const contentCenterX = (centerClientX - rect.left) / currentScale
    const contentCenterY = (centerClientY - rect.top) / currentScale

    pinchState = {
      initialDistance: distance,
      initialScale: currentScale,
      contentCenterX,
      contentCenterY,
      baseOriginX,
      baseOriginY
    }
    isPinching.value = true
  }

  const handlePinchMove = () => {
    if (!pinchState || activePointers.size < 2) return

    const pointers = Array.from(activePointers.values())
    const p1 = pointers[0]
    const p2 = pointers[1]

    const dx = p1.x - p2.x
    const dy = p1.y - p2.y
    const distance = Math.hypot(dx, dy)

    if (distance === 0) return

    const centerClientX = (p1.x + p2.x) / 2
    const centerClientY = (p1.y + p2.y) / 2

    // Вычисляем новый масштаб
    const distanceRatio = distance / pinchState.initialDistance
    const newScale = clampZoom(pinchState.initialScale * distanceRatio)

    // Вычисляем новый pan, чтобы contentCenter остался под пальцами
    // centerClientX = baseOriginX + newPanX + contentCenterX * newScale
    // => newPanX = centerClientX - baseOriginX - contentCenterX * newScale
    const newPanX = centerClientX - pinchState.baseOriginX - pinchState.contentCenterX * newScale
    const newPanY = centerClientY - pinchState.baseOriginY - pinchState.contentCenterY * newScale

    zoomScale.value = newScale
    panOffset.value = { x: newPanX, y: newPanY }
  }


  /**
   * Универсальный обработчик PointerDown (вызывать из компонента)
   */
  const handlePointerDown = (event) => {
    if (event.pointerType !== 'touch') {
      // Для мыши используем старую логику (только если вызов идет для pan tool)
      // Но здесь мы просто регистрируем поинтер для pinch
      return
    }
    
    activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY })

    if (activePointers.size === 2) {
      // Начинаем pinch
      updatePinchState(event.currentTarget)
    }
  }

  /**
   * Универсальный обработчик PointerMove
   */
  const handlePointerMove = (event) => {
    if (event.pointerType !== 'touch') return

    if (activePointers.has(event.pointerId)) {
      activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
    }

    if (isPinching.value && activePointers.size >= 2) {
      event.preventDefault() // Предотвращаем скролл/зум браузера
      handlePinchMove()
    }
  }

  /**
   * Универсальный обработчик PointerUp/Cancel
   */
  const handlePointerUp = (event) => {
    if (event.pointerType !== 'touch') return

    activePointers.delete(event.pointerId)
    
    if (activePointers.size < 2) {
      isPinching.value = false
      pinchState = null
    } else {
      // Если осталось 2+ пальца, пересчитываем состояние (на всякий случай)
      updatePinchState(event.currentTarget)
    }
  }

  // === Старая логика панорамирования (для одного пальца/мыши) ===
  /**
   * Начало панорамирования
   * @param {PointerEvent} event - Событие указателя
   */
  const beginPan = (event) => {
    if (!isZoomedIn.value) {
      return
    }

    const boardElement = event.currentTarget
    if (boardElement && typeof boardElement.setPointerCapture === 'function') {
      boardElement.setPointerCapture(event.pointerId)
    }

    isPanning.value = true
    panPointerId.value = event.pointerId
    panStartPoint.value = { x: event.clientX, y: event.clientY }
    const currentPan = panOffset.value || { x: 0, y: 0 }
    panInitialOffset.value = { ...currentPan }
    
    // Регистрируем поинтер также для pinch (если это touch)
    if (event.pointerType === 'touch') {
       handlePointerDown(event)
    }
  }

  /**
   * Обновление панорамирования
   * @param {PointerEvent} event - Событие указателя
   */
  const updatePan = (event) => {
    // Обновляем состояние поинтеров для pinch
    if (event.pointerType === 'touch') {
       handlePointerMove(event)
    }
    
    if (isPinching.value) return // Если щипок, то обычный pan не делаем

    if (!isPanning.value || panPointerId.value !== event.pointerId || !panStartPoint.value) {
      return
    }

    const deltaX = event.clientX - panStartPoint.value.x
    const deltaY = event.clientY - panStartPoint.value.y
    const initial = panInitialOffset.value || { x: 0, y: 0 }

    panOffset.value = {
      x: initial.x + deltaX,
      y: initial.y + deltaY
    }
  }

  /**
   * Завершение панорамирования
   * @param {PointerEvent} event - Событие указателя
   */
  const finishPan = (event) => {
    // Обновляем состояние поинтеров для pinch
    if (event.pointerType === 'touch') {
       handlePointerUp(event)
    }
    
    if (panPointerId.value !== event.pointerId) {
      return
    }

    const boardElement = event.currentTarget
    if (boardElement && typeof boardElement.releasePointerCapture === 'function') {
      boardElement.releasePointerCapture(event.pointerId)
    }

    isPanning.value = false
    panPointerId.value = null
    panStartPoint.value = null
    panInitialOffset.value = { x: 0, y: 0 }
  }

  /**
   * Сброс зума и панорамирования
   */
  const resetZoom = () => {
    zoomScale.value = 1
    minZoomScale.value = 1
    resetPan()
  }

  // === Возвращаемые значения ===
  return {
    // Refs
    zoomScale,
    minZoomScale,
    panOffset,
    isPanning,
    panPointerId,
    isPinching, // Экспортируем состояние pinch

    // Computed
    isZoomedIn,

    // Методы
    clampZoom,
    handleBoardWheel,
    beginPan,
    updatePan,
    finishPan,
    handlePointerDown, // Экспортируем обработчики для использования в других местах
    handlePointerMove,
    handlePointerUp,
    resetPan,
    resetZoom
  }
}
