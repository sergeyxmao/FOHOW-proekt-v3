/**
 * Composable для управления перетаскиванием объектов на холсте
 * Включает логику перетаскивания карточек, стикеров и изображений
 */

import { ref } from 'vue'
import { useThrottleFn } from '@vueuse/core'

/**
 * @typedef {Object} UseCanvasDragOptions
 * @property {Object} cardsStore - Pinia store для карточек
 * @property {Object} stickersStore - Pinia store для стикеров
 * @property {Object} imagesStore - Pinia store для изображений
 * @property {Object} connectionsStore - Pinia store для соединений
 * @property {Object} historyStore - Pinia store для истории
 * @property {Function} screenToCanvas - Функция конвертации координат экрана в canvas
 * @property {Function} findCardById - Функция поиска карточки по ID
 * @property {Function} collectAvatarConnectionSnapshots - Функция сбора снимков avatar-соединений
 * @property {Function} syncNoteWindowWithCard - Функция синхронизации окна заметок с карточкой
 * @property {Function} updateStageSize - Функция обновления размера сцены
 * @property {Function} computeGuideSnap - Функция вычисления привязки к направляющим
 * @property {Function} resetActiveGuides - Функция сброса активных направляющих
 * @property {import('vue').Ref} activeGuides - Ref на активные направляющие
 * @property {import('vue').Ref} isSelecting - Ref на состояние выделения
 * @property {import('vue').Ref} isHierarchicalDragMode - Ref на режим иерархического перетаскивания
 * @property {Function} snapDelta - Функция привязки дельты к сетке
 */

/**
 * Composable для управления перетаскиванием
 * @param {UseCanvasDragOptions} options
 */
export function useCanvasDrag(options) {
  const {
    cardsStore,
    stickersStore,
    imagesStore,
    connectionsStore,
    historyStore,
    screenToCanvas,
    findCardById,
    collectAvatarConnectionSnapshots,
    syncNoteWindowWithCard,
    updateStageSize,
    computeGuideSnap,
    resetActiveGuides,
    activeGuides,
    isSelecting,
    isHierarchicalDragMode,
    snapDelta
  } = options

  // === Refs и состояния ===

  const dragState = ref(null)
  const suppressNextCardClick = ref(false)

  // Mutable state для pointer capture
  let activeDragPointerId = null
  let dragPointerCaptureElement = null

  // === Вспомогательные функции ===

  /**
   * Сбор целей для перетаскивания от карточки
   */
  const collectDragTargets = (cardId, event) => {
    const isCtrlPressed = event.ctrlKey || event.metaKey
    const selectedCardIds = cardsStore.selectedCardIds || []
    const selectedStickerIds = stickersStore.selectedStickerIds || []
    const selectedImageIds = imagesStore.selectedImageIds || []

    // Режим иерархического перетаскивания
    if (isHierarchicalDragMode?.value) {
      const subtreeIds = cardsStore.getSubtreeCardIds?.(cardId) || [cardId]
      return {
        cardIds: subtreeIds,
        stickerIds: [],
        imageIds: []
      }
    }

    // Если карточка уже выделена - перетаскиваем все выделенные объекты
    if (selectedCardIds.includes(cardId)) {
      return {
        cardIds: selectedCardIds,
        stickerIds: selectedStickerIds,
        imageIds: selectedImageIds.filter(id => {
          const img = imagesStore.images.find(i => i.id === id)
          return img && !img.isLocked
        })
      }
    }

    // Ctrl не нажат - выделяем только эту карточку
    if (!isCtrlPressed) {
      return {
        cardIds: [cardId],
        stickerIds: [],
        imageIds: []
      }
    }

    // Ctrl нажат - добавляем к выделению
    const newCardIds = selectedCardIds.includes(cardId)
      ? selectedCardIds
      : [...selectedCardIds, cardId]

    return {
      cardIds: newCardIds,
      stickerIds: selectedStickerIds,
      imageIds: selectedImageIds.filter(id => {
        const img = imagesStore.images.find(i => i.id === id)
        return img && !img.isLocked
      })
    }
  }

  /**
   * Сбор целей для перетаскивания от стикера
   */
  const collectStickerDragTargets = (stickerId, event) => {
    const isCtrlPressed = event.ctrlKey || event.metaKey
    const selectedCardIds = cardsStore.selectedCardIds || []
    const selectedStickerIds = stickersStore.selectedStickerIds || []
    const selectedImageIds = imagesStore.selectedImageIds || []

    // Если стикер уже выделен - перетаскиваем все выделенные объекты
    if (selectedStickerIds.includes(stickerId)) {
      return {
        cardIds: selectedCardIds,
        stickerIds: selectedStickerIds,
        imageIds: selectedImageIds.filter(id => {
          const img = imagesStore.images.find(i => i.id === id)
          return img && !img.isLocked
        })
      }
    }

    // Ctrl не нажат - выделяем только этот стикер
    if (!isCtrlPressed) {
      return {
        cardIds: [],
        stickerIds: [stickerId],
        imageIds: []
      }
    }

    // Ctrl нажат - добавляем к выделению
    const newStickerIds = selectedStickerIds.includes(stickerId)
      ? selectedStickerIds
      : [...selectedStickerIds, stickerId]

    return {
      cardIds: selectedCardIds,
      stickerIds: newStickerIds,
      imageIds: selectedImageIds.filter(id => {
        const img = imagesStore.images.find(i => i.id === id)
        return img && !img.isLocked
      })
    }
  }

  /**
   * Сбор целей для перетаскивания от изображения
   */
  const collectImageDragTargets = (imageId, event) => {
    const isCtrlPressed = event.ctrlKey || event.metaKey
    const selectedCardIds = cardsStore.selectedCardIds || []
    const selectedStickerIds = stickersStore.selectedStickerIds || []
    const selectedImageIds = imagesStore.selectedImageIds || []

    // Если изображение уже выделено - перетаскиваем все выделенные объекты
    if (selectedImageIds.includes(imageId)) {
      return {
        cardIds: selectedCardIds,
        stickerIds: selectedStickerIds,
        imageIds: selectedImageIds.filter(id => {
          const img = imagesStore.images.find(i => i.id === id)
          return img && !img.isLocked
        })
      }
    }

    // Ctrl не нажат - выделяем только это изображение
    if (!isCtrlPressed) {
      return {
        cardIds: [],
        stickerIds: [],
        imageIds: [imageId]
      }
    }

    // Ctrl нажат - добавляем к выделению
    const newImageIds = selectedImageIds.includes(imageId)
      ? selectedImageIds
      : [...selectedImageIds, imageId]

    return {
      cardIds: selectedCardIds,
      stickerIds: selectedStickerIds,
      imageIds: newImageIds.filter(id => {
        const img = imagesStore.images.find(i => i.id === id)
        return img && !img.isLocked
      })
    }
  }

  // === Основные функции перетаскивания ===

  /**
   * Внутренний обработчик перетаскивания
   */
  const handleDragInternal = (event) => {
    if (!dragState.value || (!dragState.value.cards.length && !dragState.value.stickers.length && !dragState.value.images?.length)) {
      return
    }

    if (
      activeDragPointerId !== null &&
      event.pointerId !== undefined &&
      event.pointerId !== activeDragPointerId
    ) {
      return
    }

    if (event.cancelable) {
      event.preventDefault()
    }

    const canvasPos = screenToCanvas(event.clientX, event.clientY)
    const rawDx = canvasPos.x - dragState.value.startPointer.x
    const rawDy = canvasPos.y - dragState.value.startPointer.y
    let dx = snapDelta ? snapDelta(rawDx) : rawDx
    let dy = snapDelta ? snapDelta(rawDy) : rawDy

    const shiftPressed = Boolean(event.shiftKey)
    let axisLock = dragState.value.axisLock

    if (!shiftPressed) {
      axisLock = null
    } else if (!axisLock) {
      const absDx = Math.abs(rawDx)
      const absDy = Math.abs(rawDy)

      if (absDx > absDy) {
        axisLock = 'horizontal'
      } else if (absDy > absDx) {
        axisLock = 'vertical'
      }
    }

    if (axisLock === 'horizontal') {
      dy = 0
    } else if (axisLock === 'vertical') {
      dx = 0
    }

    dragState.value.axisLock = axisLock

    let guideAdjustX = 0
    let guideAdjustY = 0

    if (dragState.value.primaryCardId && dragState.value.primaryCardStart && computeGuideSnap) {
      const proposedX = dragState.value.primaryCardStart.x + dx
      const proposedY = dragState.value.primaryCardStart.y + dy
      const guideResult = computeGuideSnap(dragState.value.primaryCardId, proposedX, proposedY)

      if (guideResult) {
        guideAdjustX = axisLock === 'vertical' ? 0 : guideResult.adjustX
        guideAdjustY = axisLock === 'horizontal' ? 0 : guideResult.adjustY
        if (activeGuides) {
          activeGuides.value = guideResult.guides
        }
      } else if (resetActiveGuides) {
        resetActiveGuides()
      }
    }

    const finalDx = dx + guideAdjustX
    const finalDy = dy + guideAdjustY

    // Обновляем позиции карточек
    dragState.value.cards.forEach(item => {
      cardsStore.updateCardPosition(
        item.id,
        item.startX + finalDx,
        item.startY + finalDy,
        { saveToHistory: false }
      )
      const movingCard = findCardById(item.id)
      if (movingCard?.note?.visible && syncNoteWindowWithCard) {
        syncNoteWindowWithCard(item.id)
      }
    })

    // Обновляем позиции стикеров
    dragState.value.stickers.forEach(item => {
      const sticker = stickersStore.stickers.find(s => s.id === item.id)
      if (sticker) {
        sticker.pos_x = Math.round(item.startX + finalDx)
        sticker.pos_y = Math.round(item.startY + finalDy)
      }
    })

    // Обновляем позиции изображений
    if (dragState.value.images && dragState.value.images.length > 0) {
      dragState.value.images.forEach(item => {
        imagesStore.updateImagePosition(
          item.id,
          item.startX + finalDx,
          item.startY + finalDy,
          { saveToHistory: false }
        )
      })
    }

    // Обновляем позиции avatar-соединений
    if (Array.isArray(dragState.value.avatarConnectionSnapshots) && dragState.value.avatarConnectionSnapshots.length > 0) {
      dragState.value.avatarConnectionSnapshots.forEach(snapshot => {
        const connection = connectionsStore.avatarConnections.find(c => c.id === snapshot.id)

        if (!connection) {
          return
        }

        const newControlPoints = snapshot.controlPoints.map(point => ({
          x: point.x + finalDx,
          y: point.y + finalDy
        }))

        connectionsStore.updateAvatarConnection(connection.id, { controlPoints: newControlPoints }, { saveToHistory: false })
      })
    }

    if (updateStageSize) {
      updateStageSize()
    }

    if (dx !== 0 || dy !== 0) {
      dragState.value.hasMoved = true
    }
  }

  // Throttle handleDrag с задержкой 16ms (60 FPS)
  const handleDrag = useThrottleFn(handleDragInternal, 16, true, false)

  /**
   * Завершение перетаскивания
   */
  const endDrag = async (event) => {
    if (
      event &&
      activeDragPointerId !== null &&
      event.pointerId !== undefined &&
      event.pointerId !== activeDragPointerId
    ) {
      return
    }

    if (dragState.value && dragState.value.hasMoved) {
      const movedCardIds = dragState.value.cards.map(item => item.id)
      const movedStickerIds = dragState.value.stickers.map(item => item.id)
      const movedImageIds = dragState.value.images?.map(item => item.id) || []
      const totalCount = movedCardIds.length + movedStickerIds.length + movedImageIds.length

      let description = ''
      if (totalCount === 1) {
        if (movedCardIds.length === 1) {
          const card = findCardById(movedCardIds[0])
          description = card ? `Перемещена карточка "${card.text}"` : 'Перемещена карточка'
        } else if (movedStickerIds.length === 1) {
          description = 'Перемещен стикер'
        } else if (movedImageIds.length === 1) {
          const image = imagesStore.images.find(img => img.id === movedImageIds[0])
          description = image ? `Перемещено изображение "${image.name}"` : 'Перемещено изображение'
        }
      } else {
        const parts = []
        if (movedCardIds.length > 0) {
          parts.push(`${movedCardIds.length} карточек`)
        }
        if (movedStickerIds.length > 0) {
          parts.push(`${movedStickerIds.length} стикеров`)
        }
        if (movedImageIds.length > 0) {
          parts.push(`${movedImageIds.length} изображений`)
        }
        description = `Перемещено ${parts.join(' и ')}`
      }

      if (historyStore) {
        historyStore.setActionMetadata('update', description)
        movedCardIds.forEach(id => {
          if (syncNoteWindowWithCard) {
            syncNoteWindowWithCard(id)
          }
        })
        historyStore.saveState()
      }

      // Сохраняем позиции стикеров на сервере
      for (const item of dragState.value.stickers) {
        const sticker = stickersStore.stickers.find(s => s.id === item.id)
        if (sticker) {
          try {
            await stickersStore.updateSticker(sticker.id, {
              pos_x: sticker.pos_x,
              pos_y: sticker.pos_y
            })
          } catch (error) {
            console.error('Ошибка сохранения позиции стикера:', error)
          }
        }
      }

      suppressNextCardClick.value = true
      setTimeout(() => {
        suppressNextCardClick.value = false
      }, 0)
    }

    dragState.value = null
    if (resetActiveGuides) {
      resetActiveGuides()
    }

    if (activeDragPointerId !== null) {
      dragPointerCaptureElement?.releasePointerCapture?.(activeDragPointerId)
    }
    activeDragPointerId = null
    dragPointerCaptureElement = null
    window.removeEventListener('pointermove', handleDrag)
    window.removeEventListener('pointerup', endDrag)
    window.removeEventListener('pointercancel', endDrag)
    window.removeEventListener('mousemove', handleDrag)
    window.removeEventListener('mouseup', endDrag)
  }

  /**
   * Начало перетаскивания карточки
   */
  const startDrag = (event, cardId) => {
    if (event.button !== 0) {
      return
    }

    if (isSelecting?.value) {
      return
    }

    const interactiveTarget = event.target.closest('button, input, textarea, select, [contenteditable="true"], a[href]')
    if (interactiveTarget) {
      return
    }

    const dragTargets = collectDragTargets(cardId, event)
    const dragCardIds = dragTargets.cardIds || []
    const dragStickerIds = dragTargets.stickerIds || []
    const dragImageIds = dragTargets.imageIds || []

    if (dragCardIds.length === 0 && dragStickerIds.length === 0 && dragImageIds.length === 0) {
      return
    }

    const canvasPos = screenToCanvas(event.clientX, event.clientY)

    // Собираем карточки
    const cardsToDrag = dragCardIds
      .map(id => {
        const card = findCardById(id)
        if (!card) return null
        return {
          id: card.id,
          type: 'card',
          startX: card.x,
          startY: card.y
        }
      })
      .filter(Boolean)

    // Собираем стикеры
    const stickersToDrag = dragStickerIds
      .map(id => {
        const sticker = stickersStore.stickers.find(s => s.id === id)
        if (!sticker) return null
        return {
          id: sticker.id,
          type: 'sticker',
          startX: sticker.pos_x,
          startY: sticker.pos_y
        }
      })
      .filter(Boolean)

    // Собираем изображения
    const imagesToDrag = dragImageIds
      .map(id => {
        const image = imagesStore.images.find(img => img.id === id)
        if (!image || image.isLocked) {
          return null
        }
        return {
          id: image.id,
          type: 'image',
          startX: image.x,
          startY: image.y
        }
      })
      .filter(Boolean)

    const itemsToDrag = [...cardsToDrag, ...stickersToDrag, ...imagesToDrag]

    if (itemsToDrag.length === 0) {
      return
    }

    const movingIds = new Set(itemsToDrag.map(item => item.id))
    const primaryEntry = itemsToDrag.find(item => item.id === cardId) || itemsToDrag[0] || null
    const avatarConnectionSnapshots = collectAvatarConnectionSnapshots ? collectAvatarConnectionSnapshots(movingIds) : []

    dragState.value = {
      cards: cardsToDrag,
      stickers: stickersToDrag,
      images: imagesToDrag,
      items: itemsToDrag,
      startPointer: canvasPos,
      hasMoved: false,
      movingIds,
      primaryCardId: primaryEntry ? primaryEntry.id : null,
      primaryCardStart: primaryEntry ? { x: primaryEntry.startX, y: primaryEntry.startY } : null,
      axisLock: null,
      avatarConnectionSnapshots
    }

    if (resetActiveGuides) {
      resetActiveGuides()
    }

    const isPointerEvent = typeof PointerEvent !== 'undefined' && event instanceof PointerEvent

    if (isPointerEvent) {
      activeDragPointerId = event.pointerId
      dragPointerCaptureElement = event.target
      dragPointerCaptureElement?.setPointerCapture?.(activeDragPointerId)
      window.addEventListener('pointermove', handleDrag, { passive: false })
      window.addEventListener('pointerup', endDrag)
      window.addEventListener('pointercancel', endDrag)
    } else {
      window.addEventListener('mousemove', handleDrag)
      window.addEventListener('mouseup', endDrag)
    }
    event.preventDefault()
  }

  /**
   * Начало перетаскивания стикера
   */
  const startStickerDrag = (event, stickerId) => {
    if (event.button !== 0) {
      return
    }

    if (isSelecting?.value) {
      return
    }

    const dragTargets = collectStickerDragTargets(stickerId, event)
    const dragCardIds = dragTargets.cardIds || []
    const dragStickerIds = dragTargets.stickerIds || []
    const dragImageIds = dragTargets.imageIds || []

    if (dragCardIds.length === 0 && dragStickerIds.length === 0 && dragImageIds.length === 0) {
      return
    }

    const canvasPos = screenToCanvas(event.clientX, event.clientY)

    // Собираем стикеры
    const stickersToDrag = dragStickerIds
      .map(id => {
        const sticker = stickersStore.stickers.find(s => s.id === id)
        if (!sticker) return null
        return {
          id: sticker.id,
          type: 'sticker',
          startX: sticker.pos_x,
          startY: sticker.pos_y
        }
      })
      .filter(Boolean)

    // Собираем карточки
    const cardsToDrag = dragCardIds
      .map(id => {
        const card = findCardById(id)
        if (!card) return null
        return {
          id: card.id,
          type: 'card',
          startX: card.x,
          startY: card.y
        }
      })
      .filter(Boolean)

    // Собираем изображения
    const imagesToDrag = dragImageIds
      .map(id => {
        const image = imagesStore.images.find(img => img.id === id)
        if (!image || image.isLocked) {
          return null
        }
        return {
          id: image.id,
          type: 'image',
          startX: image.x,
          startY: image.y
        }
      })
      .filter(Boolean)

    const itemsToDrag = [...stickersToDrag, ...cardsToDrag, ...imagesToDrag]
    if (itemsToDrag.length === 0) {
      return
    }

    const movingIds = new Set(itemsToDrag.map(item => item.id))
    const primaryEntry = itemsToDrag.find(item => item.id === stickerId) || itemsToDrag[0] || null
    const avatarConnectionSnapshots = collectAvatarConnectionSnapshots ? collectAvatarConnectionSnapshots(movingIds) : []

    dragState.value = {
      cards: cardsToDrag,
      stickers: stickersToDrag,
      images: imagesToDrag,
      items: itemsToDrag,
      startPointer: canvasPos,
      hasMoved: false,
      movingIds,
      primaryCardId: primaryEntry ? primaryEntry.id : null,
      primaryCardStart: primaryEntry ? { x: primaryEntry.startX, y: primaryEntry.startY } : null,
      axisLock: null,
      avatarConnectionSnapshots
    }

    if (resetActiveGuides) {
      resetActiveGuides()
    }

    const isPointerEvent = typeof PointerEvent !== 'undefined' && event instanceof PointerEvent

    if (isPointerEvent) {
      activeDragPointerId = event.pointerId
      dragPointerCaptureElement = event.target
      dragPointerCaptureElement?.setPointerCapture?.(activeDragPointerId)
      window.addEventListener('pointermove', handleDrag, { passive: false })
      window.addEventListener('pointerup', endDrag)
      window.addEventListener('pointercancel', endDrag)
    } else {
      window.addEventListener('mousemove', handleDrag)
      window.addEventListener('mouseup', endDrag)
    }
    event.preventDefault()
  }

  // === Возвращаемые значения ===
  return {
    // Refs
    dragState,
    suppressNextCardClick,

    // Функции сбора целей
    collectDragTargets,
    collectStickerDragTargets,
    collectImageDragTargets,

    // Функции перетаскивания
    startDrag,
    startStickerDrag,
    handleDrag,
    handleDragInternal,
    endDrag,

    // Геттеры для mutable state
    getActiveDragPointerId: () => activeDragPointerId,
    getDragPointerCaptureElement: () => dragPointerCaptureElement,

    // Сеттеры для mutable state
    setActiveDragPointerId: (value) => { activeDragPointerId = value },
    setDragPointerCaptureElement: (value) => { dragPointerCaptureElement = value }
  }
}
