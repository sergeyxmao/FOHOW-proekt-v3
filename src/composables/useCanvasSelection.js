/**
 * Composable для управления выделением объектов на холсте
 * Включает логику прямоугольного выделения карточек, стикеров и изображений
 */

import { ref } from 'vue'

/**
 * Создание начального состояния выделения
 */
const createSelectionBaseState = () => ({
  cardIds: new Set(),
  stickerIds: new Set(),
  imageIds: new Set()
})

/**
 * @typedef {Object} UseCanvasSelectionOptions
 * @property {Object} cardsStore - Pinia store для карточек
 * @property {Object} stickersStore - Pinia store для стикеров
 * @property {Object} imagesStore - Pinia store для изображений
 * @property {import('vue').Ref} canvasContainerRef - Ref на контейнер canvas
 * @property {import('vue').Ref} selectedCardId - Ref на выбранную карточку
 * @property {Function} stopAvatarSelectionAnimation - Функция остановки анимации выделения аватаров
 * @property {Function} onSelectionStart - Callback при начале выделения (для сброса connections)
 */

/**
 * Composable для управления выделением объектов
 * @param {UseCanvasSelectionOptions} options
 */
export function useCanvasSelection(options) {
  const {
    cardsStore,
    stickersStore,
    imagesStore,
    canvasContainerRef,
    selectedCardId,
    stopAvatarSelectionAnimation,
    onSelectionStart
  } = options

  // === Refs и состояния ===

  const isSelecting = ref(false)
  const selectionRect = ref(null)
  const selectionCursorPosition = ref(null)

  // Mutable state
  let selectionStartPoint = null
  let selectionBaseSelection = createSelectionBaseState()
  let suppressNextStageClick = false

  // === Основные функции ===

  /**
   * Очистка всех выделений объектов
   * @param {Object} options
   * @param {boolean} options.preserveCardSelection - Сохранить выделение карточек
   */
  const clearObjectSelections = ({ preserveCardSelection = false } = {}) => {
    if (!preserveCardSelection) {
      cardsStore.deselectAllCards()
      selectedCardId.value = null
    }
    stickersStore.deselectAllStickers()
    imagesStore.deselectAllImages()
    if (stopAvatarSelectionAnimation) {
      stopAvatarSelectionAnimation()
    }
  }

  /**
   * Удаление слушателей событий выделения
   */
  const removeSelectionListeners = () => {
    window.removeEventListener('pointermove', handleSelectionPointerMove)
    window.removeEventListener('pointerup', handleSelectionPointerUp)
    window.removeEventListener('pointercancel', handleSelectionPointerCancel)
  }

  /**
   * Применение выделения на основе прямоугольника
   * @param {Object} rect - Прямоугольник выделения
   */
  const applySelectionFromRect = (rect) => {
    const nextSelectionCardIds = new Set()
    const nextSelectionStickerIds = new Set()
    const nextSelectionImageIds = new Set()

    // Сохраняем существующее выделение, если оно ещё актуально
    selectionBaseSelection.cardIds.forEach((id) => {
      if (cardsStore.cards.some(card => card.id === id)) {
        nextSelectionCardIds.add(id)
      }
    })
    selectionBaseSelection.stickerIds.forEach((id) => {
      if (stickersStore.stickers.some(sticker => sticker.id === id)) {
        nextSelectionStickerIds.add(id)
      }
    })
    selectionBaseSelection.imageIds.forEach((id) => {
      if (imagesStore.images.some(image => image.id === id)) {
        nextSelectionImageIds.add(id)
      }
    })

    if (canvasContainerRef.value) {
      // Проверяем карточки
      const cardElements = canvasContainerRef.value.querySelectorAll('.card')
      cardElements.forEach((element) => {
        const cardId = element.dataset.cardId
        if (!cardId) {
          return
        }

        const cardRect = element.getBoundingClientRect()
        const intersects =
          cardRect.left < rect.right &&
          cardRect.right > rect.left &&
          cardRect.top < rect.bottom &&
          cardRect.bottom > rect.top

        if (intersects) {
          nextSelectionCardIds.add(cardId)
        }
      })

      // Проверяем аватары
      const avatarElements = canvasContainerRef.value.querySelectorAll('.avatar-object')
      avatarElements.forEach((element) => {
        const avatarId = element.dataset.avatarId
        if (!avatarId) {
          return
        }

        const avatarRect = element.getBoundingClientRect()
        const intersects =
          avatarRect.left < rect.right &&
          avatarRect.right > rect.left &&
          avatarRect.top < rect.bottom &&
          avatarRect.bottom > rect.top

        if (intersects) {
          nextSelectionCardIds.add(avatarId)
        }
      })

      // Проверяем стикеры
      const stickerElements = canvasContainerRef.value.querySelectorAll('.sticker')
      stickerElements.forEach((element) => {
        const stickerId = element.dataset.stickerId
        if (!stickerId) {
          return
        }

        const stickerRect = element.getBoundingClientRect()
        const intersects =
          stickerRect.left < rect.right &&
          stickerRect.right > rect.left &&
          stickerRect.top < rect.bottom &&
          stickerRect.bottom > rect.top

        if (intersects) {
          nextSelectionStickerIds.add(Number(stickerId))
        }
      })

      // Проверяем изображения
      const imageElements = canvasContainerRef.value.querySelectorAll('.canvas-image')
      imageElements.forEach((element) => {
        const imageId = element.dataset.imageId
        if (!imageId) {
          return
        }

        const imageRect = element.getBoundingClientRect()
        const intersects =
          imageRect.left < rect.right &&
          imageRect.right > rect.left &&
          imageRect.top < rect.bottom &&
          imageRect.bottom > rect.top

        if (intersects) {
          nextSelectionImageIds.add(imageId)
        }
      })
    }

    // Применяем выделение для карточек
    cardsStore.deselectAllCards()
    const orderedCardIds = Array.from(nextSelectionCardIds)
    orderedCardIds.forEach((id) => {
      cardsStore.selectCard(id)
    })

    // Применяем выделение для стикеров
    stickersStore.deselectAllStickers()
    const orderedStickerIds = Array.from(nextSelectionStickerIds)
    orderedStickerIds.forEach((id) => {
      stickersStore.selectSticker(id)
    })

    // Применяем выделение для изображений
    imagesStore.deselectAllImages()
    const orderedImageIds = Array.from(nextSelectionImageIds)
    orderedImageIds.forEach((id) => {
      imagesStore.selectImage(id)
    })

    selectedCardId.value = orderedCardIds.length > 0 ? orderedCardIds[orderedCardIds.length - 1] : null
  }

  /**
   * Обновление прямоугольника выделения на основе события
   * @param {PointerEvent} event
   */
  const updateSelectionRectFromEvent = (event) => {
    if (!selectionStartPoint) {
      return
    }

    const currentX = event.clientX
    const currentY = event.clientY

    const left = Math.min(selectionStartPoint.x, currentX)
    const top = Math.min(selectionStartPoint.y, currentY)
    const width = Math.abs(currentX - selectionStartPoint.x)
    const height = Math.abs(currentY - selectionStartPoint.y)

    const rect = {
      left,
      top,
      width,
      height,
      right: left + width,
      bottom: top + height
    }

    selectionRect.value = rect
    selectionCursorPosition.value = { x: event.clientX, y: event.clientY }

    applySelectionFromRect(rect)
  }

  /**
   * Завершение выделения
   */
  const finishSelection = () => {
    removeSelectionListeners()
    isSelecting.value = false
    selectionRect.value = null
    selectionStartPoint = null
    selectionBaseSelection = createSelectionBaseState()
    selectionCursorPosition.value = null

    setTimeout(() => {
      suppressNextStageClick = false
    }, 50)
  }

  /**
   * Обработчик движения указателя при выделении
   */
  const handleSelectionPointerMove = (event) => {
    if (!isSelecting.value) {
      return
    }

    event.preventDefault()
    updateSelectionRectFromEvent(event)
  }

  /**
   * Обработчик отпускания указателя при выделении
   */
  const handleSelectionPointerUp = (event) => {
    if (isSelecting.value) {
      updateSelectionRectFromEvent(event)
    }
    finishSelection()
  }

  /**
   * Обработчик отмены указателя при выделении
   */
  const handleSelectionPointerCancel = (event) => {
    if (isSelecting.value) {
      updateSelectionRectFromEvent(event)
    }
    finishSelection()
  }

  /**
   * Начало выделения
   * @param {PointerEvent} event
   */
  const startSelection = (event) => {
    if (event.button !== 0) {
      return
    }
    if (stickersStore.isPlacementMode && stickersStore.placementTarget === 'board') {
      return
    }
    event.preventDefault()
    suppressNextStageClick = true
    isSelecting.value = true
    selectionStartPoint = { x: event.clientX, y: event.clientY }
    selectionCursorPosition.value = { ...selectionStartPoint }

    // Сохраняем базовое выделение (включая карточки и стикеры)
    if (event.ctrlKey || event.metaKey) {
      selectionBaseSelection = {
        cardIds: new Set(cardsStore.selectedCardIds),
        stickerIds: new Set(stickersStore.selectedStickerIds),
        imageIds: new Set(imagesStore.selectedImageIds)
      }
    } else {
      selectionBaseSelection = createSelectionBaseState()
      clearObjectSelections()
    }

    selectedCardId.value = null

    // Вызываем callback для сброса состояния connections
    if (onSelectionStart) {
      onSelectionStart()
    }

    selectionRect.value = {
      left: selectionStartPoint.x,
      top: selectionStartPoint.y,
      width: 0,
      height: 0,
      right: selectionStartPoint.x,
      bottom: selectionStartPoint.y
    }

    window.addEventListener('pointermove', handleSelectionPointerMove, { passive: false })
    window.addEventListener('pointerup', handleSelectionPointerUp)
    window.addEventListener('pointercancel', handleSelectionPointerCancel)
  }

  /**
   * Геттер для suppressNextStageClick
   */
  const getSuppressNextStageClick = () => suppressNextStageClick

  /**
   * Сеттер для suppressNextStageClick
   */
  const setSuppressNextStageClick = (value) => {
    suppressNextStageClick = value
  }

  // === Возвращаемые значения ===
  return {
    // Refs
    isSelecting,
    selectionRect,
    selectionCursorPosition,

    // Функции
    clearObjectSelections,
    startSelection,
    finishSelection,
    removeSelectionListeners,

    // Геттеры/сеттеры для mutable state
    getSuppressNextStageClick,
    setSuppressNextStageClick
  }
}
