/**
 * Composable для управления историей рисования (undo/redo) в PencilOverlay
 * Поддерживает сохранение снимков canvas, откат и повтор действий
 */

import { ref, computed, nextTick } from 'vue'

const MAX_HISTORY_LENGTH = 50

/**
 * @typedef {Object} UsePencilHistoryOptions
 * @property {import('vue').Ref} drawingCanvasRef - Ref на DOM элемент canvas
 * @property {import('vue').Ref} canvasContext - Ref на 2D контекст canvas
 * @property {import('vue').Ref<number>} canvasWidth - Ширина canvas
 * @property {import('vue').Ref<number>} canvasHeight - Высота canvas
 * @property {Function} [onBeforeApply] - Callback перед применением снимка (например, для отмены выделения)
 */

/**
 * Composable для управления историей рисования
 * @param {UsePencilHistoryOptions} options
 */
export function usePencilHistory(options) {
  const {
    drawingCanvasRef,
    canvasContext,
    canvasWidth,
    canvasHeight,
    onBeforeApply
  } = options

  // === Refs и состояния ===
  const historyEntries = ref([])
  const historyIndex = ref(-1)
  const isApplyingHistory = ref(false)

  // Mutable state
  let historySaveHandle = null
  let pendingCanvasCapture = false

  // === Computed ===
  const canUndo = computed(() => historyIndex.value > 0)
  const canRedo = computed(() => historyIndex.value >= 0 && historyIndex.value < historyEntries.value.length - 1)

  // === Вспомогательные функции ===

  /**
   * Захват текущего состояния canvas как dataURL
   * @returns {string|null} Data URL изображения или null
   */
  const captureCanvasData = () => {
    const canvas = drawingCanvasRef.value
    if (!canvas) {
      return null
    }
    return canvas.toDataURL('image/png')
  }

  /**
   * Создание снимка состояния
   * @param {boolean} captureCanvasExplicitly - Принудительно захватить canvas
   * @returns {Object} Объект снимка
   */
  const buildSnapshot = (captureCanvasExplicitly = false) => {
    let canvasData
    if (captureCanvasExplicitly) {
      canvasData = captureCanvasData()
    } else if (historyIndex.value >= 0 && historyIndex.value < historyEntries.value.length) {
      canvasData = historyEntries.value[historyIndex.value].canvas
    } else {
      canvasData = captureCanvasData()
    }

    return {
      canvas: canvasData
    }
  }

  /**
   * Добавление записи в историю
   * @param {Object} entry - Запись истории
   */
  const pushHistoryEntry = (entry) => {
    historyEntries.value = historyEntries.value.slice(0, historyIndex.value + 1)
    historyEntries.value.push(entry)

    if (historyEntries.value.length > MAX_HISTORY_LENGTH) {
      historyEntries.value.shift()
    }

    historyIndex.value = historyEntries.value.length - 1
  }

  /**
   * Планирование сохранения в историю (с дебаунсом)
   * @param {boolean} captureCanvasExplicitly - Принудительно захватить canvas
   */
  const scheduleHistorySave = (captureCanvasExplicitly = false) => {
    if (isApplyingHistory.value) {
      return
    }

    pendingCanvasCapture = pendingCanvasCapture || captureCanvasExplicitly

    if (historySaveHandle) {
      clearTimeout(historySaveHandle)
      historySaveHandle = null
    }

    if (typeof window === 'undefined') {
      const snapshot = buildSnapshot(pendingCanvasCapture)
      pushHistoryEntry(snapshot)
      pendingCanvasCapture = false
      return
    }

    historySaveHandle = window.setTimeout(() => {
      const snapshot = buildSnapshot(pendingCanvasCapture)
      pushHistoryEntry(snapshot)
      historySaveHandle = null
      pendingCanvasCapture = false
    }, 0)
  }

  /**
   * Принудительное сохранение отложенной записи
   */
  const flushPendingHistorySave = () => {
    if (!historySaveHandle) {
      return
    }

    clearTimeout(historySaveHandle)
    historySaveHandle = null

    if (isApplyingHistory.value) {
      return
    }

    const snapshot = buildSnapshot(pendingCanvasCapture)
    pushHistoryEntry(snapshot)
    pendingCanvasCapture = false
  }

  /**
   * Отрисовка canvas из dataURL снимка
   * @param {string|null} dataUrl - Data URL изображения
   * @returns {Promise<void>}
   */
  const drawCanvasFromSnapshot = (dataUrl) => new Promise((resolve) => {
    const canvas = drawingCanvasRef.value
    const context = canvasContext.value

    if (!canvas || !context) {
      resolve()
      return
    }

    context.save()
    context.setTransform(1, 0, 0, 1, 0, 0)
    context.globalCompositeOperation = 'source-over'
    context.globalAlpha = 1
    context.clearRect(0, 0, canvas.width, canvas.height)

    if (!dataUrl) {
      context.restore()
      resolve()
      return
    }

    const image = new Image()
    image.onload = () => {
      context.drawImage(image, 0, 0)
      context.restore()
      resolve()
    }
    image.onerror = () => {
      context.restore()
      resolve()
    }
    image.src = dataUrl
  })

  /**
   * Применение снимка истории
   * @param {Object} snapshot - Снимок для применения
   * @returns {Promise<void>}
   */
  const applySnapshot = async (snapshot) => {
    if (!snapshot) {
      return
    }

    isApplyingHistory.value = true

    // Вызываем callback перед применением (например, для отмены выделения)
    if (onBeforeApply) {
      onBeforeApply()
    }

    await nextTick()
    await drawCanvasFromSnapshot(snapshot.canvas)

    isApplyingHistory.value = false
  }

  /**
   * Сброс истории и создание начальной записи
   */
  const resetHistory = () => {
    historyEntries.value = []
    historyIndex.value = -1
    pendingCanvasCapture = false
    const snapshot = buildSnapshot(true)
    pushHistoryEntry(snapshot)
  }

  /**
   * Отмена последнего действия
   */
  const undo = () => {
    flushPendingHistorySave()
    if (historyIndex.value <= 0) {
      return
    }

    historyIndex.value -= 1
    const snapshot = historyEntries.value[historyIndex.value]
    applySnapshot(snapshot)
  }

  /**
   * Повтор отменённого действия
   */
  const redo = () => {
    flushPendingHistorySave()
    if (historyIndex.value < 0 || historyIndex.value >= historyEntries.value.length - 1) {
      return
    }

    historyIndex.value += 1
    const snapshot = historyEntries.value[historyIndex.value]
    applySnapshot(snapshot)
  }

  // === Возвращаемые значения ===
  return {
    // Refs
    historyEntries,
    historyIndex,
    isApplyingHistory,

    // Computed
    canUndo,
    canRedo,

    // Методы
    captureCanvasData,
    scheduleHistorySave,
    flushPendingHistorySave,
    resetHistory,
    undo,
    redo
  }
}
