/**
 * Composable для изменения размера изображений на холсте
 * Поддерживает изменение размера с 8 направлений с сохранением/без сохранения пропорций
 */

import { ref, computed } from 'vue'
import { useThrottleFn } from '@vueuse/core'

/**
 * @typedef {Object} UseImageResizeOptions
 * @property {Object} imagesStore - Pinia store для изображений
 * @property {Object} historyStore - Pinia store для истории
 * @property {Function} screenToCanvas - Функция конвертации координат экрана в canvas
 */

/**
 * Composable для управления изменением размера изображений
 * @param {UseImageResizeOptions} options
 */
export function useImageResize(options) {
  const {
    imagesStore,
    historyStore,
    screenToCanvas
  } = options

  // === Refs и состояния ===

  const resizeState = ref(null) // { imageId, initialWidth, initialHeight, aspectRatio, keepAspectRatio, interactionType, startX, startY, startPointer }

  // Mutable state для pointer capture (shared with drag)
  let activeDragPointerId = null
  let dragPointerCaptureElement = null

  // === Computed ===

  const isResizing = computed(() => resizeState.value !== null)

  // === Основные функции ===

  /**
   * Внутренний обработчик изменения размера изображения
   */
  const handleImageResizeInternal = (event) => {
    if (!resizeState.value) {
      return
    }

    const canvasPos = screenToCanvas(event.clientX, event.clientY)
    const deltaX = canvasPos.x - resizeState.value.startPointer.x
    const deltaY = canvasPos.y - resizeState.value.startPointer.y

    const image = imagesStore.images.find(img => img.id === resizeState.value.imageId)
    if (!image) {
      return
    }

    let newWidth, newHeight, newX, newY
    const resizeType = resizeState.value.interactionType
    const initialWidth = resizeState.value.initialWidth
    const initialHeight = resizeState.value.initialHeight
    const aspectRatio = resizeState.value.aspectRatio
    const keepAspectRatio = resizeState.value.keepAspectRatio
    const startX = resizeState.value.startX
    const startY = resizeState.value.startY

    switch (resizeType) {
      case 'resize-se': // юго-восток, правый нижний угол
        newWidth = initialWidth + deltaX
        newHeight = initialHeight + deltaY

        if (keepAspectRatio) {
          const scale = Math.max(newWidth / initialWidth, newHeight / initialHeight)
          newWidth = initialWidth * scale
          newHeight = initialHeight * scale
        }

        newWidth = Math.max(20, newWidth)
        newHeight = Math.max(20, newHeight)

        imagesStore.updateImage(image.id, {
          width: newWidth,
          height: newHeight
        })
        break

      case 'resize-nw': // северо-запад, левый верхний угол
        newWidth = initialWidth - deltaX
        newHeight = initialHeight - deltaY

        if (keepAspectRatio) {
          const scale = Math.max(newWidth / initialWidth, newHeight / initialHeight)
          newWidth = initialWidth * scale
          newHeight = initialHeight * scale
        }

        newWidth = Math.max(20, newWidth)
        newHeight = Math.max(20, newHeight)

        newX = startX + (initialWidth - newWidth)
        newY = startY + (initialHeight - newHeight)

        imagesStore.updateImage(image.id, {
          width: newWidth,
          height: newHeight,
          x: newX,
          y: newY
        })
        break

      case 'resize-ne': // северо-восток, правый верхний угол
        newWidth = initialWidth + deltaX
        newHeight = initialHeight - deltaY

        if (keepAspectRatio) {
          const scale = Math.max(newWidth / initialWidth, newHeight / initialHeight)
          newWidth = initialWidth * scale
          newHeight = initialHeight * scale
        }

        newWidth = Math.max(20, newWidth)
        newHeight = Math.max(20, newHeight)

        newY = startY + (initialHeight - newHeight)

        imagesStore.updateImage(image.id, {
          width: newWidth,
          height: newHeight,
          y: newY
        })
        break

      case 'resize-sw': // юго-запад, левый нижний угол
        newWidth = initialWidth - deltaX
        newHeight = initialHeight + deltaY

        if (keepAspectRatio) {
          const scale = Math.max(newWidth / initialWidth, newHeight / initialHeight)
          newWidth = initialWidth * scale
          newHeight = initialHeight * scale
        }

        newWidth = Math.max(20, newWidth)
        newHeight = Math.max(20, newHeight)

        newX = startX + (initialWidth - newWidth)

        imagesStore.updateImage(image.id, {
          width: newWidth,
          height: newHeight,
          x: newX
        })
        break

      case 'resize-n': // север, верхняя сторона
        newHeight = initialHeight - deltaY
        newWidth = initialWidth

        if (keepAspectRatio) {
          newWidth = newHeight * aspectRatio
        }

        newWidth = Math.max(20, newWidth)
        newHeight = Math.max(20, newHeight)

        newY = startY + (initialHeight - newHeight)
        newX = startX + (initialWidth - newWidth) / 2

        imagesStore.updateImage(image.id, {
          width: newWidth,
          height: newHeight,
          x: newX,
          y: newY
        })
        break

      case 'resize-s': // юг, нижняя сторона
        newHeight = initialHeight + deltaY
        newWidth = initialWidth

        if (keepAspectRatio) {
          newWidth = newHeight * aspectRatio
        }

        newWidth = Math.max(20, newWidth)
        newHeight = Math.max(20, newHeight)

        newX = startX + (initialWidth - newWidth) / 2

        imagesStore.updateImage(image.id, {
          width: newWidth,
          height: newHeight,
          x: newX
        })
        break

      case 'resize-e': // восток, правая сторона
        newWidth = initialWidth + deltaX
        newHeight = initialHeight

        if (keepAspectRatio) {
          newHeight = newWidth / aspectRatio
        }

        newWidth = Math.max(20, newWidth)
        newHeight = Math.max(20, newHeight)

        newY = startY + (initialHeight - newHeight) / 2

        imagesStore.updateImage(image.id, {
          width: newWidth,
          height: newHeight,
          y: newY
        })
        break

      case 'resize-w': // запад, левая сторона
        newWidth = initialWidth - deltaX
        newHeight = initialHeight

        if (keepAspectRatio) {
          newHeight = newWidth / aspectRatio
        }

        newWidth = Math.max(20, newWidth)
        newHeight = Math.max(20, newHeight)

        newX = startX + (initialWidth - newWidth)
        newY = startY + (initialHeight - newHeight) / 2

        imagesStore.updateImage(image.id, {
          width: newWidth,
          height: newHeight,
          x: newX,
          y: newY
        })
        break
    }

    event.preventDefault()
  }

  // Throttle handleImageResize для оптимизации производительности
  const handleImageResize = useThrottleFn(handleImageResizeInternal, 16, true, false)

  /**
   * Завершение изменения размера изображения
   */
  const endImageResize = (event) => {
    if (
      event &&
      activeDragPointerId !== null &&
      event.pointerId !== undefined &&
      event.pointerId !== activeDragPointerId
    ) {
      return
    }

    if (resizeState.value) {
      const image = imagesStore.images.find(img => img.id === resizeState.value.imageId)
      if (image && historyStore) {
        // Сохраняем в историю финальное состояние
        historyStore.setActionMetadata('update', `Изменен размер изображения "${image.name}"`)
        historyStore.saveState()
      }
    }

    resizeState.value = null

    if (activeDragPointerId !== null) {
      dragPointerCaptureElement?.releasePointerCapture?.(activeDragPointerId)
    }
    activeDragPointerId = null
    dragPointerCaptureElement = null
    window.removeEventListener('pointermove', handleImageResize)
    window.removeEventListener('pointerup', endImageResize)
    window.removeEventListener('pointercancel', endImageResize)
    window.removeEventListener('mousemove', handleImageResize)
    window.removeEventListener('mouseup', endImageResize)
  }

  /**
   * Начало изменения размера изображения
   * @param {Object} params - Параметры
   * @param {Event} params.event - Событие мыши/pointer
   * @param {string} params.imageId - ID изображения
   * @param {string} params.interactionType - Тип взаимодействия (resize-se, resize-nw, etc.)
   * @returns {boolean} - true если resize начат успешно
   */
  const startImageResize = ({ event, imageId, interactionType }) => {
    if (event.button !== 0) {
      return false
    }

    const image = imagesStore.images.find(img => img.id === imageId)
    if (!image || image.isLocked) {
      return false
    }

    if (!interactionType || !interactionType.startsWith('resize-')) {
      return false
    }

    const canvasPos = screenToCanvas(event.clientX, event.clientY)

    resizeState.value = {
      imageId: image.id,
      initialWidth: image.width,
      initialHeight: image.height,
      aspectRatio: image.width / image.height,
      keepAspectRatio: !event.shiftKey, // Shift отключает сохранение пропорций
      interactionType: interactionType,
      startX: image.x,
      startY: image.y,
      startPointer: canvasPos
    }

    const isPointerEvent = typeof PointerEvent !== 'undefined' && event instanceof PointerEvent

    if (isPointerEvent) {
      activeDragPointerId = event.pointerId
      dragPointerCaptureElement = event.target
      dragPointerCaptureElement?.setPointerCapture?.(activeDragPointerId)
      window.addEventListener('pointermove', handleImageResize, { passive: false })
      window.addEventListener('pointerup', endImageResize)
      window.addEventListener('pointercancel', endImageResize)
    } else {
      window.addEventListener('mousemove', handleImageResize)
      window.addEventListener('mouseup', endImageResize)
    }
    event.preventDefault()

    return true
  }

  /**
   * Обработка нажатия Shift для переключения сохранения пропорций
   * @param {boolean} shiftPressed - Нажат ли Shift
   */
  const handleShiftKey = (shiftPressed) => {
    if (resizeState.value) {
      resizeState.value.keepAspectRatio = !shiftPressed
    }
  }

  // === Возвращаемые значения ===
  return {
    // Refs
    resizeState,

    // Computed
    isResizing,

    // Функции
    startImageResize,
    handleImageResize,
    handleImageResizeInternal,
    endImageResize,
    handleShiftKey,

    // Геттеры для mutable state
    getActiveDragPointerId: () => activeDragPointerId,
    getDragPointerCaptureElement: () => dragPointerCaptureElement,

    // Сеттеры для mutable state
    setActiveDragPointerId: (value) => { activeDragPointerId = value },
    setDragPointerCaptureElement: (value) => { dragPointerCaptureElement = value }
  }
}
