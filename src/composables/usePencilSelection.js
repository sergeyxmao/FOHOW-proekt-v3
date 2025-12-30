/**
 * Composable для управления выделением области на canvas в PencilOverlay
 * Поддерживает создание прямоугольного выделения и перемещение выделенной области
 */

import { ref } from 'vue'

/**
 * @typedef {Object} UsePencilSelectionOptions
 * @property {import('vue').Ref} canvasContext - Ref на 2D контекст canvas
 * @property {import('vue').Ref<number>} canvasWidth - Ширина canvas
 * @property {import('vue').Ref<number>} canvasHeight - Высота canvas
 * @property {Function} scheduleHistorySave - Функция сохранения в историю
 */

/**
 * Composable для управления выделением
 * @param {UsePencilSelectionOptions} options
 */
export function usePencilSelection(options) {
  const {
    canvasContext,
    canvasWidth,
    canvasHeight,
    scheduleHistorySave
  } = options

  // === Refs и состояния ===
  const selectionRect = ref(null)
  const isCreatingSelection = ref(false)
  const isMovingSelection = ref(false)
  const selectionPointerId = ref(null)
  const selectionStartPoint = ref(null)
  const activeSelection = ref(null)
  const selectionMoveStartPoint = ref(null)
  const selectionInitialRect = ref(null)
  const selectionMoveState = ref(null)
  const selectionHasChanges = ref(false)

  // === Вспомогательные функции ===

  /**
   * Ограничение значения в диапазоне
   * @param {number} value
   * @param {number} min
   * @param {number} max
   * @returns {number}
   */
  const clampValue = (value, min, max) => Math.min(Math.max(value, min), max)

  /**
   * Нормализация прямоугольника выделения (обработка отрицательных размеров)
   * @param {Object} start - Начальная точка
   * @param {Object} current - Текущая точка
   * @returns {Object|null} Нормализованный прямоугольник
   */
  const normalizeSelectionRect = (start, current) => {
    if (!start || !current) {
      return null
    }

    const clampedStart = {
      x: clampValue(start.x, 0, canvasWidth.value),
      y: clampValue(start.y, 0, canvasHeight.value)
    }

    const clampedCurrent = {
      x: clampValue(current.x, 0, canvasWidth.value),
      y: clampValue(current.y, 0, canvasHeight.value)
    }

    const left = Math.min(clampedStart.x, clampedCurrent.x)
    const top = Math.min(clampedStart.y, clampedCurrent.y)
    const right = Math.max(clampedStart.x, clampedCurrent.x)
    const bottom = Math.max(clampedStart.y, clampedCurrent.y)

    return {
      x: Math.round(left),
      y: Math.round(top),
      width: Math.round(right - left),
      height: Math.round(bottom - top)
    }
  }

  /**
   * Проверка, находится ли точка внутри прямоугольника
   * @param {Object} point - Точка {x, y}
   * @param {Object} rect - Прямоугольник {x, y, width, height}
   * @returns {boolean}
   */
  const isPointInsideRect = (point, rect) => {
    if (!rect) {
      return false
    }

    const withinX = point.x >= rect.x && point.x <= rect.x + rect.width
    const withinY = point.y >= rect.y && point.y <= rect.y + rect.height
    return withinX && withinY
  }

  /**
   * Сброс состояния взаимодействия с выделением
   */
  const resetSelectionInteraction = () => {
    isCreatingSelection.value = false
    isMovingSelection.value = false
    selectionPointerId.value = null
    selectionStartPoint.value = null
    selectionMoveStartPoint.value = null
    selectionInitialRect.value = null
    selectionMoveState.value = null
    selectionHasChanges.value = false
  }

  /**
   * Отмена выделения и восстановление исходного состояния
   */
  const cancelSelection = () => {
    if (isMovingSelection.value && activeSelection.value && selectionMoveState.value && selectionInitialRect.value) {
      const context = canvasContext.value
      if (context && selectionMoveState.value.baseImageData) {
        context.putImageData(selectionMoveState.value.baseImageData, 0, 0)
        context.putImageData(
          activeSelection.value.imageData,
          selectionInitialRect.value.x,
          selectionInitialRect.value.y
        )
      }

      if (activeSelection.value) {
        activeSelection.value.rect = { ...selectionInitialRect.value }
      }
    }

    resetSelectionInteraction()
    activeSelection.value = null
    selectionRect.value = null
  }

  /**
   * Захват снимка выделенной области
   * @param {Object} rect - Прямоугольник области
   * @returns {Object|null} Снимок с imageData
   */
  const captureSelectionSnapshot = (rect) => {
    const context = canvasContext.value
    if (!context || !rect || rect.width <= 1 || rect.height <= 1) {
      return null
    }

    try {
      const imageData = context.getImageData(rect.x, rect.y, rect.width, rect.height)

      return {
        rect: { ...rect },
        imageData
      }
    } catch (error) {
      console.error('Не удалось получить данные выделенной области', error)
      return null
    }
  }

  /**
   * Начало создания выделения
   * @param {Object} point - Начальная точка
   * @param {number} pointerId - ID указателя
   */
  const beginSelectionCreation = (point, pointerId) => {
    isCreatingSelection.value = true
    selectionPointerId.value = pointerId
    selectionStartPoint.value = point
    selectionRect.value = {
      x: point.x,
      y: point.y,
      width: 0,
      height: 0
    }
  }

  /**
   * Обновление рамки выделения при создании
   * @param {Object} point - Текущая точка
   */
  const updateSelectionCreation = (point) => {
    if (!isCreatingSelection.value || !selectionStartPoint.value) {
      return
    }

    const rect = normalizeSelectionRect(selectionStartPoint.value, point)
    selectionRect.value = rect
  }

  /**
   * Завершение создания выделения
   */
  const finalizeSelectionCreation = () => {
    if (!isCreatingSelection.value) {
      return
    }

    const rect = selectionRect.value
    resetSelectionInteraction()

    if (!rect || rect.width < 2 || rect.height < 2) {
      selectionRect.value = null
      activeSelection.value = null
      return
    }

    const snapshot = captureSelectionSnapshot(rect)
    if (!snapshot) {
      selectionRect.value = null
      activeSelection.value = null
      return
    }

    activeSelection.value = snapshot
    selectionRect.value = { ...snapshot.rect }
  }

  /**
   * Начало перемещения выделенной области
   * @param {Object} point - Начальная точка
   * @param {number} pointerId - ID указателя
   */
  const beginSelectionMove = (point, pointerId) => {
    if (!activeSelection.value) {
      return
    }

    const context = canvasContext.value
    if (!context) {
      return
    }

    isMovingSelection.value = true
    selectionPointerId.value = pointerId
    selectionMoveStartPoint.value = point
    selectionInitialRect.value = { ...activeSelection.value.rect }

    context.save()
    context.setTransform(1, 0, 0, 1, 0, 0)
    context.globalCompositeOperation = 'source-over'
    context.globalAlpha = 1
    context.clearRect(
      activeSelection.value.rect.x,
      activeSelection.value.rect.y,
      activeSelection.value.rect.width,
      activeSelection.value.rect.height
    )

    const baseImageData = context.getImageData(0, 0, canvasWidth.value, canvasHeight.value)
    context.putImageData(
      activeSelection.value.imageData,
      activeSelection.value.rect.x,
      activeSelection.value.rect.y
    )
    context.restore()

    selectionMoveState.value = {
      baseImageData
    }
    selectionHasChanges.value = false
  }

  /**
   * Обновление позиции выделенной области при перемещении
   * @param {Object} point - Текущая точка
   */
  const updateSelectionMove = (point) => {
    if (!isMovingSelection.value || !selectionMoveStartPoint.value || !selectionInitialRect.value) {
      return
    }

    const dx = point.x - selectionMoveStartPoint.value.x
    const dy = point.y - selectionMoveStartPoint.value.y

    const maxX = Math.max(0, canvasWidth.value - selectionInitialRect.value.width)
    const maxY = Math.max(0, canvasHeight.value - selectionInitialRect.value.height)

    const targetX = clampValue(selectionInitialRect.value.x + dx, 0, maxX)
    const targetY = clampValue(selectionInitialRect.value.y + dy, 0, maxY)

    const appliedDx = Math.round(targetX - selectionInitialRect.value.x)
    const appliedDy = Math.round(targetY - selectionInitialRect.value.y)

    const rect = {
      x: selectionInitialRect.value.x + appliedDx,
      y: selectionInitialRect.value.y + appliedDy,
      width: selectionInitialRect.value.width,
      height: selectionInitialRect.value.height
    }

    selectionRect.value = rect

    const context = canvasContext.value
    if (context && selectionMoveState.value?.baseImageData) {
      context.putImageData(selectionMoveState.value.baseImageData, 0, 0)
      context.putImageData(activeSelection.value.imageData, rect.x, rect.y)
    }

    if (appliedDx !== 0 || appliedDy !== 0) {
      selectionHasChanges.value = true
    }
  }

  /**
   * Завершение перемещения выделенной области
   */
  const finishSelectionMove = () => {
    if (!isMovingSelection.value) {
      return
    }

    const rect = selectionRect.value ? { ...selectionRect.value } : null
    const context = canvasContext.value

    if (context && rect && selectionMoveState.value?.baseImageData) {
      context.putImageData(selectionMoveState.value.baseImageData, 0, 0)
      context.putImageData(activeSelection.value.imageData, rect.x, rect.y)

      try {
        activeSelection.value.imageData = context.getImageData(rect.x, rect.y, rect.width, rect.height)
      } catch (error) {
        console.error('Не удалось обновить данные выделенной области после перемещения', error)
      }
    }

    if (activeSelection.value && rect) {
      activeSelection.value.rect = rect
    }

    const hasChanges = selectionHasChanges.value
    resetSelectionInteraction()

    if (rect) {
      selectionRect.value = { ...rect }
    }

    if (hasChanges && scheduleHistorySave) {
      scheduleHistorySave(true)
    }
  }

  // === Возвращаемые значения ===
  return {
    // Refs
    selectionRect,
    isCreatingSelection,
    isMovingSelection,
    selectionPointerId,
    activeSelection,

    // Методы
    isPointInsideRect,
    resetSelectionInteraction,
    cancelSelection,
    beginSelectionCreation,
    updateSelectionCreation,
    finalizeSelectionCreation,
    beginSelectionMove,
    updateSelectionMove,
    finishSelectionMove
  }
}
