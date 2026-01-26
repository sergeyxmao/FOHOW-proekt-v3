/**
 * Composable для управления инструментами рисования в PencilOverlay
 * Поддерживает кисть, маркер и ластик
 */

import { ref, computed } from 'vue'

// Константы размеров инструментов
export const ERASER_MIN_SIZE = 4
export const ERASER_MAX_SIZE = 80
export const MARKER_MIN_SIZE = 30
export const MARKER_MAX_SIZE = 100

/**
 * @typedef {Object} UsePencilDrawingOptions
 * @property {import('vue').Ref} canvasContext - Ref на 2D контекст canvas
 * @property {import('vue').Ref<number>} canvasScale - Масштаб canvas
 * @property {Function} scheduleHistorySave - Функция сохранения в историю
 */

/**
 * Composable для управления рисованием
 * @param {UsePencilDrawingOptions} options
 */
export function usePencilDrawing(options) {
  const {
    canvasContext,
    canvasScale,
    scheduleHistorySave: initialScheduleHistorySave
  } = options

  // Храним scheduleHistorySave как ref для возможности обновления после инициализации
  // (решает проблему циклической зависимости между composables)
  const scheduleHistorySaveRef = ref(initialScheduleHistorySave)

  // === Refs и состояния ===
  const currentTool = ref('brush')
  const brushColor = ref('#ff4757')
  const brushSize = ref(4)
  const markerSize = ref(60)
  const markerOpacity = ref(0.01)
  const eraserSize = ref(24)
  const isDrawing = ref(false)
  const hasStrokeChanges = ref(false)
  const lastPoint = ref(null)
  const activePointerId = ref(null)
  const pointerPosition = ref(null)

  // === Computed ===
  const markerOpacityPercent = computed(() => Math.round(markerOpacity.value * 100))
  const isDrawingToolActive = computed(() => ['brush', 'marker', 'eraser'].includes(currentTool.value))
  const isSelectionToolActive = computed(() => currentTool.value === 'selection')
  const showEraserPreview = computed(() => currentTool.value === 'eraser' && Boolean(pointerPosition.value))

  // === Вспомогательные функции ===

  /**
   * Конвертация HEX цвета в RGBA
   * @param {string} hex - HEX цвет
   * @param {number} alpha - Прозрачность (0-1)
   * @returns {string} RGBA строка
   */
  const hexToRgba = (hex, alpha) => {
    if (typeof hex !== 'string') {
      return `rgba(0, 0, 0, ${alpha})`
    }

    let normalized = hex.trim()
    if (normalized[0] === '#') {
      normalized = normalized.slice(1)
    }

    if (normalized.length === 3) {
      normalized = normalized.split('').map((char) => char + char).join('')
    }

    const int = Number.parseInt(normalized, 16)
    if (Number.isNaN(int)) {
      return `rgba(0, 0, 0, ${alpha})`
    }

    const r = (int >> 16) & 255
    const g = (int >> 8) & 255
    const b = int & 255
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }

  /**
   * Начало штриха
   * @param {Object} point - Точка начала {x, y}
   */
  const startStroke = (point) => {
    if (!canvasContext.value) return

    const context = canvasContext.value
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.globalAlpha = 1

    // Масштабируем размеры инструментов с учетом высокого разрешения canvas
    const displayScale = canvasScale.value || 1

    if (currentTool.value === 'eraser') {
      context.globalCompositeOperation = 'destination-out'
      context.strokeStyle = 'rgba(0, 0, 0, 1)'
      context.lineWidth = eraserSize.value * displayScale
    } else {
      context.globalCompositeOperation = 'source-over'
      if (currentTool.value === 'marker') {
        context.strokeStyle = hexToRgba(brushColor.value, markerOpacity.value)
        context.lineWidth = markerSize.value * displayScale
      } else {
        context.strokeStyle = brushColor.value
        context.lineWidth = brushSize.value * displayScale
      }
    }

    context.beginPath()
    context.moveTo(point.x, point.y)
    lastPoint.value = point
    isDrawing.value = true
    hasStrokeChanges.value = false
  }

  /**
   * Продолжение штриха
   * @param {Object} point - Текущая точка {x, y}
   */
  const continueStroke = (point) => {
    if (!canvasContext.value || !isDrawing.value || !lastPoint.value) return

    canvasContext.value.lineTo(point.x, point.y)
    canvasContext.value.stroke()
    lastPoint.value = point
    hasStrokeChanges.value = true
  }

  /**
   * Завершение штриха
   */
  const finishStroke = () => {
    if (!canvasContext.value || !isDrawing.value) return

    canvasContext.value.closePath()
    canvasContext.value.globalAlpha = 1
    canvasContext.value.globalCompositeOperation = 'source-over'
    isDrawing.value = false
    lastPoint.value = null
    activePointerId.value = null

    if (hasStrokeChanges.value && scheduleHistorySaveRef.value) {
      scheduleHistorySaveRef.value(true)
    }
  }

  /**
   * Установка функции сохранения в историю
   * Используется для разрешения циклической зависимости между composables
   * @param {Function} fn - Функция scheduleHistorySave из usePencilHistory
   */
  const setScheduleHistorySave = (fn) => {
    scheduleHistorySaveRef.value = fn
  }

  /**
   * Обновление позиции превью указателя
   * @param {Object} point - Точка {x, y}
   */
  const updatePointerPreview = (point) => {
    if (currentTool.value === 'eraser') {
      pointerPosition.value = { ...point }
    } else {
      pointerPosition.value = null
    }
  }

  /**
   * Сброс превью указателя
   */
  const clearPointerPreview = () => {
    pointerPosition.value = null
  }

  // === Возвращаемые значения ===
  return {
    // Refs
    currentTool,
    brushColor,
    brushSize,
    markerSize,
    markerOpacity,
    eraserSize,
    isDrawing,
    activePointerId,
    pointerPosition,

    // Computed
    markerOpacityPercent,
    isDrawingToolActive,
    isSelectionToolActive,
    showEraserPreview,

    // Константы
    ERASER_MIN_SIZE,
    ERASER_MAX_SIZE,
    MARKER_MIN_SIZE,
    MARKER_MAX_SIZE,

    // Методы
    hexToRgba,
    startStroke,
    continueStroke,
    finishStroke,
    updatePointerPreview,
    clearPointerPreview,
    setScheduleHistorySave
  }
}
