/**
 * Composable для фокусировки на объектах canvas
 */
export function useCanvasFocus(options) {
  const {
    cardsStore,
    stickersStore,
    boardStore,
    anchors,
    connections,
    zoomScale,
    canvasContainerRef,
    setZoomTransform,
    findCardById
  } = options

  // === Методы фокусировки ===

  /**
   * Фокусировка на карточке по ID
   */
  const focusCardOnCanvas = (cardId) => {
    const card = findCardById(cardId)
    if (!card || !canvasContainerRef.value) {
      return
    }
    const scale = zoomScale.value || 1
    const containerRect = canvasContainerRef.value.getBoundingClientRect()
    const cardCenterX = card.x + (card.width || 0) / 2
    const cardCenterY = card.y + (card.height || 0) / 2
    const targetTranslateX = containerRect.width / 2 - cardCenterX * scale
    const targetTranslateY = containerRect.height / 2 - cardCenterY * scale

    setZoomTransform({
      scale,
      translateX: targetTranslateX,
      translateY: targetTranslateY
    })

    cardsStore.deselectAllCards()
    cardsStore.selectCard(cardId)
  }

  /**
   * Фокусировка на стикере по ID
   */
  const focusStickerOnCanvas = (stickerId) => {
    const sticker = stickersStore.stickers.find(s => s.id === stickerId)
    if (!sticker || !canvasContainerRef.value) {
      console.warn(`Стикер с ID ${stickerId} не найден для фокусировки.`)
      return
    }

    // 1. Получаем текущие параметры холста
    // Устанавливаем масштаб на 100% при переходе к стикеру
    const scale = 1.0
    const containerRect = canvasContainerRef.value.getBoundingClientRect()

    // 2. Вычисляем целевые координаты для центрирования стикера
    // Размеры стикера примерно 200x150, берем центр
    const stickerCenterX = sticker.pos_x + 100
    const stickerCenterY = sticker.pos_y + 75
    const targetTranslateX = containerRect.width / 2 - stickerCenterX * scale
    const targetTranslateY = containerRect.height / 2 - stickerCenterY * scale

    // 3. Плавно перемещаем холст
    setZoomTransform({
      scale,
      translateX: targetTranslateX,
      translateY: targetTranslateY
    })

    // 4. Снимаем выделение со всего остального
    stickersStore.deselectAllStickers()
    cardsStore.deselectAllCards()

    // 5. Выделяем нужный стикер и запускаем анимацию
    // Небольшая задержка, чтобы пользователь увидел перемещение холста
    setTimeout(() => {
      // Выделяем стикер
      stickersStore.selectSticker(stickerId)

      // Находим DOM-элемент стикера и добавляем класс для анимации
      const stickerElement = document.querySelector(`[data-sticker-id="${stickerId}"]`)
      if (stickerElement) {
        stickerElement.classList.add('sticker--focused')

        // Убираем класс после завершения анимации (длительность 2000ms)
        setTimeout(() => {
          stickerElement.classList.remove('sticker--focused')
        }, 2000)
      }
    }, 150) // Задержка в 150мс
  }

  /**
   * Фокусировка на якоре (anchor) по ID
   */
  const focusAnchorOnCanvas = (anchorId) => {
    const anchor = anchors.value.find(item => item.id === anchorId)
    if (!anchor || !canvasContainerRef.value) {
      return
    }
    const anchorX = Number.isFinite(anchor.pos_x) ? anchor.pos_x : anchor.x
    const anchorY = Number.isFinite(anchor.pos_y) ? anchor.pos_y : anchor.y

    // Устанавливаем масштаб на 100% при переходе к точке
    const scale = 1.0
    const containerRect = canvasContainerRef.value.getBoundingClientRect()
    const targetTranslateX = containerRect.width / 2 - anchorX * scale
    const targetTranslateY = containerRect.height / 2 - anchorY * scale
    setZoomTransform({
      scale,
      translateX: targetTranslateX,
      translateY: targetTranslateY
    })

    boardStore.startAnchorAnimation(anchorId)
    boardStore.selectAnchor(anchorId)
  }

  // === Вспомогательные функции ===

  /**
   * Получение всех потомков ветки от заданной карточки
   */
  const getBranchDescendants = (startCardId, branchFilter) => {
    const visited = new Set([startCardId])
    const descendants = new Set()
    const queue = [startCardId]
    let isInitialCard = true

    while (queue.length > 0) {
      const currentId = queue.shift()

      for (const connection of connections.value) {
        const fromCard = findCardById(connection.from)
        const toCard = findCardById(connection.to)

        if (!fromCard || !toCard) {
          continue
        }

        const fromTop = fromCard.y
        const toTop = toCard.y

        let parentId = connection.from
        let childId = connection.to
        let parentSide = connection.fromSide

        if (fromTop > toTop) {
          parentId = connection.to
          childId = connection.from
          parentSide = connection.toSide
        } else if (fromTop === toTop) {
          // Если карточки расположены на одной горизонтали, оставляем ориентацию соединения без изменений
          parentId = connection.from
          childId = connection.to
          parentSide = connection.fromSide
        }

        if (parentId !== currentId) {
          continue
        }

        const normalizedParentSide = parentSide || 'bottom'

        if (isInitialCard) {
          if (branchFilter === 'all') {
            if (!['left', 'right', 'bottom'].includes(normalizedParentSide)) {
              continue
            }
          } else if (branchFilter && normalizedParentSide !== branchFilter) {
            continue
          }
        }

        if (!visited.has(childId)) {
          visited.add(childId)
          descendants.add(childId)
          queue.push(childId)
        }
      }

      isInitialCard = false
    }

    return descendants
  }

  return {
    // Методы фокусировки
    focusCardOnCanvas,
    focusStickerOnCanvas,
    focusAnchorOnCanvas,

    // Вспомогательные методы
    getBranchDescendants
  }
}
