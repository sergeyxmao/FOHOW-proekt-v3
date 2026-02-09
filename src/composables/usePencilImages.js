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

  // Pinch-zoom для изображений
  const activeImagePointers = new Map()
  const isImagePinching = ref(false)
  let imagePinchState = null

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

      // Если updater - функция, вызываем её; если объект - мерджим с существующим изображением
      const updated = typeof updater === 'function' ? updater(image) : { ...image, ...updater }
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
   * Инициализация состояния pinch для изображения
   * @param {Object} imageObj - Объект изображения
   */
  const updateImagePinchState = (imageObj) => {
    if (activeImagePointers.size < 2) {
      imagePinchState = null
      isImagePinching.value = false
      return
    }

    const pointers = Array.from(activeImagePointers.values())
    const p1 = pointers[0]
    const p2 = pointers[1]

    const dx = p1.x - p2.x
    const dy = p1.y - p2.y
    const distance = Math.hypot(dx, dy)

    if (distance === 0) return

    imagePinchState = {
      initialDistance: distance,
      initialWidth: imageObj.width,
      initialHeight: imageObj.height,
      initialX: imageObj.x,
      initialY: imageObj.y
    }
    isImagePinching.value = true
  }

  /**
   * Обработка pinch-движения для изображения
   */
  const handleImagePinchMove = () => {
    if (!imagePinchState || activeImagePointers.size < 2 || !activeImageId.value) return

    const pointers = Array.from(activeImagePointers.values())
    const p1 = pointers[0]
    const p2 = pointers[1]

    const dx = p1.x - p2.x
    const dy = p1.y - p2.y
    const distance = Math.hypot(dx, dy)

    if (distance === 0) return

    // Вычисляем масштаб относительно начального расстояния
    const scale = distance / imagePinchState.initialDistance
    const displayScale = canvasScale.value || 1

    // Масштабируем изображение (в координатах canvas)
    const newWidth = Math.max(TEMP_IMAGE_MIN_SIZE, imagePinchState.initialWidth * scale)
    const newHeight = Math.max(TEMP_IMAGE_MIN_SIZE, imagePinchState.initialHeight * scale)

    // Центрируем масштабирование относительно центра изображения
    const widthDiff = newWidth - imagePinchState.initialWidth
    const heightDiff = newHeight - imagePinchState.initialHeight
    const newX = imagePinchState.initialX - widthDiff / 2
    const newY = imagePinchState.initialY - heightDiff / 2

    updatePlacedImageRect(activeImageId.value, {
      width: newWidth,
      height: newHeight,
      x: newX,
      y: newY
    })
  }

  /**
   * Начало трансформации изображения (перемещение или масштабирование)
   * @param {string} imageId - ID изображения
   * @param {string} type - Тип трансформации ('move' или 'resize')
   * @param {string|null} handle - Handle для resize (например, 'top-left')
   * @param {PointerEvent} event - Событие указателя
   */
  const beginImageTransform = (imageId, type, handle, event) => {
    // Для touch-событий регистрируем pointer для потенциального pinch
    if (event.pointerType === 'touch') {
      activeImagePointers.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY
      })

      // Если это второй палец — включаем pinch
      if (activeImagePointers.size === 2 && type === 'move') {
        const target = placedImages.value.find((image) => image.id === imageId)
        if (!target) return

        activeImageId.value = imageId
        updateImagePinchState(target)
        event.preventDefault()
        return
      }
    }

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
    // Обновляем координаты для pinch
    if (event.pointerType === 'touch' && activeImagePointers.has(event.pointerId)) {
      activeImagePointers.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY
      })

      // Если pinch активен — обрабатываем масштабирование
      if (isImagePinching.value && activeImagePointers.size === 2) {
        handleImagePinchMove()
        event.preventDefault()
        return
      }
    }

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
    // Удаляем pointer из pinch-трекинга
    if (event.pointerType === 'touch' && activeImagePointers.has(event.pointerId)) {
      activeImagePointers.delete(event.pointerId)

      // Если остался один палец или меньше — сбрасываем pinch
      if (activeImagePointers.size < 2) {
        isImagePinching.value = false
        imagePinchState = null
      }
    }

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
    activeImagePointers.clear()
    isImagePinching.value = false
    imagePinchState = null
  }

  // === Возвращаемые значения ===
  return {
    // Refs
    placedImages,
    activeImageId,
    imageTransformState,
    isImagePinching,

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
