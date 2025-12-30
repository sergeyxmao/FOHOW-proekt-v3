/**
 * Composable для управления временными изображениями в PencilOverlay
 * Поддерживает размещение, перемещение, масштабирование и финализацию изображений
 */

import { ref, computed } from 'vue'
import { buildPlacedImage, movePlacedImage, resizePlacedImage } from '../utils/placedImages.js'

export const TEMP_IMAGE_MIN_SIZE = 24

/**
 * @typedef {Object} UsePencilImagesOptions
 * @property {import('vue').Ref} canvasContext - Ref на 2D контекст canvas
 * @property {import('vue').Ref<number>} canvasWidth - Ширина canvas
 * @property {import('vue').Ref<number>} canvasHeight - Высота canvas
 * @property {import('vue').Ref<number>} canvasScale - Масштаб canvas
 * @property {Function} getCanvasPoint - Функция преобразования координат события в координаты canvas
 * @property {Function} scheduleHistorySave - Функция сохранения в историю
 */

/**
 * Composable для управления изображениями
 * @param {UsePencilImagesOptions} options
 */
export function usePencilImages(options) {
  const {
    canvasContext,
    canvasWidth,
    canvasHeight,
    canvasScale,
    getCanvasPoint,
    scheduleHistorySave
  } = options

  // === Refs и состояния ===
  const placedImages = ref([])
  const activeImageId = ref(null)
  const imageTransformState = ref(null)

  // === Computed ===
  const activePlacedImage = computed(() =>
    placedImages.value.find((image) => image.id === activeImageId.value) || null
  )

  // === Вспомогательные функции ===

  /**
   * Загрузка изображения как Image элемента
   * @param {string} src - URL изображения
   * @returns {Promise<HTMLImageElement>}
   */
  const ensureImageElement = (src) => new Promise((resolve, reject) => {
    const element = new Image()
    element.crossOrigin = 'anonymous'
    element.onload = () => resolve(element)
    element.onerror = (error) => reject(error)
    element.src = src
  })

  /**
   * Обновление прямоугольника размещённого изображения
   * @param {string} imageId - ID изображения
   * @param {Function|Object} updater - Функция или объект обновления
   */
  const updatePlacedImageRect = (imageId, updater) => {
    placedImages.value = placedImages.value.map((image) => {
      if (image.id !== imageId) {
        return image
      }

      const updated = typeof updater === 'function' ? updater(image) : updater
      return updated || image
    })
  }

  /**
   * Получение стиля для отображения размещённого изображения
   * @param {Object} image - Объект изображения
   * @returns {Object} CSS стили
   */
  const getPlacedImageStyle = (image) => {
    const displayScale = canvasScale.value || 1

    return {
      width: `${image.width / displayScale}px`,
      height: `${image.height / displayScale}px`,
      transform: `translate(${image.x / displayScale}px, ${image.y / displayScale}px) rotate(${image.rotation}deg)`,
      transformOrigin: 'top left'
    }
  }

  /**
   * Отрисовка размещённого изображения на canvas
   * @param {Object} image - Объект изображения
   * @returns {Promise<void>}
   */
  const drawPlacedImageOnCanvas = async (image) => {
    const context = canvasContext.value
    if (!context || !image) {
      return
    }

    try {
      const element = await ensureImageElement(image.src)
      context.save()
      context.translate(image.x + image.width / 2, image.y + image.height / 2)
      context.rotate((image.rotation * Math.PI) / 180)
      context.drawImage(element, -image.width / 2, -image.height / 2, image.width, image.height)
      context.restore()
      if (scheduleHistorySave) {
        scheduleHistorySave(true)
      }
    } catch (error) {
      console.error('Не удалось отрисовать временное изображение на холст', error)
    }
  }

  /**
   * Финализация размещения активного изображения (отрисовка на canvas)
   * @returns {Promise<void>}
   */
  const finalizeActiveImagePlacement = async () => {
    if (!activePlacedImage.value) {
      return
    }

    const imageId = activePlacedImage.value.id
    const imageToDraw = { ...activePlacedImage.value }
    await drawPlacedImageOnCanvas(imageToDraw)
    placedImages.value = placedImages.value.filter((image) => image.id !== imageId)
    if (activeImageId.value === imageId) {
      activeImageId.value = null
    }
  }

  /**
   * Отмена размещения активного изображения
   */
  const cancelActiveImagePlacement = () => {
    if (!activePlacedImage.value) {
      return
    }

    const imageId = activePlacedImage.value.id
    placedImages.value = placedImages.value.filter((image) => image.id !== imageId)
    if (activeImageId.value === imageId) {
      activeImageId.value = null
    }
  }

  /**
   * Начало трансформации изображения (перемещение или масштабирование)
   * @param {string} imageId - ID изображения
   * @param {string} type - Тип трансформации ('move' или 'resize')
   * @param {string|null} handle - Handle для resize (например, 'top-left')
   * @param {PointerEvent} event - Событие указателя
   */
  const beginImageTransform = (imageId, type, handle, event) => {
    const point = getCanvasPoint(event)
    if (!point) return

    const target = placedImages.value.find((image) => image.id === imageId)
    if (!target) return

    activeImageId.value = imageId
    imageTransformState.value = {
      pointerId: event.pointerId,
      type,
      handle,
      startPoint: point,
      startRect: { ...target },
      captureTarget: event.currentTarget || null,
      changed: false
    }

    if (imageTransformState.value.captureTarget && imageTransformState.value.captureTarget.setPointerCapture) {
      imageTransformState.value.captureTarget.setPointerCapture(event.pointerId)
    }
  }

  /**
   * Применение трансформации изображения
   * @param {PointerEvent} event - Событие указателя
   */
  const applyImageTransform = (event) => {
    if (!imageTransformState.value || imageTransformState.value.pointerId !== event.pointerId) {
      return
    }

    const point = getCanvasPoint(event)
    if (!point) return

    const dx = point.x - imageTransformState.value.startPoint.x
    const dy = point.y - imageTransformState.value.startPoint.y
    const { type, handle, startRect } = imageTransformState.value

    if (type === 'move') {
      const next = movePlacedImage(startRect, dx, dy, canvasWidth.value, canvasHeight.value)
      updatePlacedImageRect(activeImageId.value, next)
    } else if (type === 'resize') {
      const next = resizePlacedImage(
        startRect,
        handle,
        dx,
        dy,
        canvasWidth.value,
        canvasHeight.value,
        TEMP_IMAGE_MIN_SIZE
      )
      updatePlacedImageRect(activeImageId.value, next)
    }

    imageTransformState.value.changed = true
  }

  /**
   * Завершение трансформации изображения
   * @param {PointerEvent} event - Событие указателя
   */
  const finishImageTransform = (event) => {
    if (!imageTransformState.value || imageTransformState.value.pointerId !== event.pointerId) {
      return
    }

    if (imageTransformState.value.captureTarget?.releasePointerCapture) {
      imageTransformState.value.captureTarget.releasePointerCapture(event.pointerId)
    }

    imageTransformState.value = null
  }

  /**
   * Добавление изображения через drag-and-drop
   * @param {string} imageUrl - URL изображения
   * @param {Object} imageData - Данные изображения {imageId, width, height}
   * @param {Object} point - Точка размещения в координатах canvas
   * @returns {Promise<void>}
   */
  const addDroppedImage = async (imageUrl, imageData, point) => {
    try {
      const imageElement = await ensureImageElement(imageUrl)
      const originalWidth = imageData.width || imageElement.width || 200
      const originalHeight = imageData.height || imageElement.height || 150
      const draftId = imageData.imageId || (crypto?.randomUUID ? crypto.randomUUID() : `temp-${Date.now()}`)
      const draft = buildPlacedImage({
        id: draftId,
        src: imageUrl,
        originalWidth,
        originalHeight,
        point,
        canvasWidth: canvasWidth.value,
        canvasHeight: canvasHeight.value
      })

      placedImages.value = [...placedImages.value, draft]
      activeImageId.value = draft.id
    } catch (error) {
      console.error('Не удалось загрузить изображение для режима рисования', error)
    }
  }

  /**
   * Сброс состояния изображений
   */
  const resetImages = () => {
    placedImages.value = []
    activeImageId.value = null
    imageTransformState.value = null
  }

  // === Возвращаемые значения ===
  return {
    // Refs
    placedImages,
    activeImageId,
    imageTransformState,

    // Computed
    activePlacedImage,

    // Константы
    TEMP_IMAGE_MIN_SIZE,

    // Методы
    ensureImageElement,
    updatePlacedImageRect,
    getPlacedImageStyle,
    drawPlacedImageOnCanvas,
    finalizeActiveImagePlacement,
    cancelActiveImagePlacement,
    beginImageTransform,
    applyImageTransform,
    finishImageTransform,
    addDroppedImage,
    resetImages
  }
}
