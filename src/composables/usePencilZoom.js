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
  }

  /**
   * Обновление панорамирования
   * @param {PointerEvent} event - Событие указателя
   */
  const updatePan = (event) => {
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

    // Computed
    isZoomedIn,

    // Методы
    clampZoom,
    handleBoardWheel,
    beginPan,
    updatePan,
    finishPan,
    resetPan,
    resetZoom
  }
}
