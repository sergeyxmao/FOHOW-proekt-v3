/**
 * Composable для управления соединениями между карточками
 * Включает логику рисования и редактирования линий соединений
 */

import { ref, computed } from 'vue'
import {
  buildOrthogonalConnectionPath,
  getCardConnectorPoint,
  resolveConnectionSides
} from '../utils/canvasGeometry'

// Константы для "магнитного" соединения
const DESKTOP_SNAP_MARGIN = 30 // Отступ для захвата карточки на ПК (px)
const MOBILE_SNAP_MARGIN = 50  // Увеличенный отступ для мобильных (px)

/**
 * Проверяет, находится ли точка внутри прямоугольника карточки (с учётом отступа)
 * @param {Object} card - Объект карточки {x, y, width, height}
 * @param {number} pointX - X координата точки
 * @param {number} pointY - Y координата точки
 * @param {number} margin - Дополнительный отступ для "магнитного" захвата
 * @returns {boolean}
 */
function isPointInCardBounds(card, pointX, pointY, margin = 0) {
  if (!card) return false

  const x = Number(card.x) || 0
  const y = Number(card.y) || 0
  const width = Number(card.width) || 0
  const height = Number(card.height) || 0

  return (
    pointX >= x - margin &&
    pointX <= x + width + margin &&
    pointY >= y - margin &&
    pointY <= y + height + margin
  )
}

/**
 * Определяет ближайшую сторону карточки относительно точки
 * @param {Object} card - Объект карточки {x, y, width, height}
 * @param {number} pointX - X координата точки
 * @param {number} pointY - Y координата точки
 * @returns {string} - 'top' | 'right' | 'bottom' | 'left'
 */
function getClosestCardSide(card, pointX, pointY) {
  if (!card) return 'right'

  const x = Number(card.x) || 0
  const y = Number(card.y) || 0
  const width = Number(card.width) || 0
  const height = Number(card.height) || 0

  const centerX = x + width / 2
  const centerY = y + height / 2

  // Вычисляем расстояние до каждой стороны
  const distToTop = Math.abs(pointY - y)
  const distToBottom = Math.abs(pointY - (y + height))
  const distToLeft = Math.abs(pointX - x)
  const distToRight = Math.abs(pointX - (x + width))

  // Определяем, ближе ли точка к вертикальным или горизонтальным сторонам
  const minVertical = Math.min(distToTop, distToBottom)
  const minHorizontal = Math.min(distToLeft, distToRight)

  if (minVertical < minHorizontal) {
    // Точка ближе к верхней или нижней стороне
    return distToTop < distToBottom ? 'top' : 'bottom'
  } else {
    // Точка ближе к левой или правой стороне
    return distToLeft < distToRight ? 'left' : 'right'
  }
}

/**
 * @typedef {Object} UseCanvasConnectionsOptions
 * @property {Object} connectionsStore - Pinia store для соединений
 * @property {Object} cardsStore - Pinia store для карточек
 * @property {import('vue').Ref} cards - Ref на массив карточек
 * @property {import('vue').Ref} mousePosition - Ref на позицию мыши
 * @property {Function} emit - Функция emit для отправки событий
 */

/**
 * Composable для управления соединениями
 * @param {UseCanvasConnectionsOptions} options
 */
export function useCanvasConnections(options) {
  const {
    connectionsStore,
    cardsStore,
    cards,
    mousePosition,
    emit
  } = options

  // === Refs и состояния ===

  const connectionStart = ref(null)
  const isDrawingLine = ref(false)
  const previewLine = ref(null)

  // Используем selectedConnectionIds из store для глобального доступа
  const selectedConnectionIds = computed({
    get: () => connectionsStore.selectedConnectionIds,
    set: (value) => connectionsStore.setSelectedConnections(value)
  })

  // === Computed ===

  /**
   * Толщина линии предпросмотра
   */
  const previewLineWidth = computed(() => connectionsStore.defaultLineThickness || 2)

  /**
   * Путь линии предпросмотра
   */
  const previewLinePath = computed(() => {
    if (!isDrawingLine.value || !connectionStart.value) return null

    const fromCard = cards.value.find(card => card.id === connectionStart.value.cardId)
    if (!fromCard) return null

    const startPoint = getCardConnectorPoint(fromCard, connectionStart.value.side)
    const { d } = buildOrthogonalConnectionPath(startPoint, mousePosition.value, connectionStart.value.side, null)

    return {
      d,
      color: '#ff9800',
      strokeWidth: previewLineWidth.value,
      strokeDasharray: '5,5'
    }
  })

  // === Основные функции ===

  /**
   * Создание соединения между карточками
   * @param {string} fromCardId - ID карточки источника
   * @param {string} toCardId - ID карточки назначения
   * @param {Object} options - Дополнительные опции
   * @returns {Object|null} Созданное соединение или null
   */
  const createConnectionBetweenCards = (fromCardId, toCardId, connectionOptions = {}) => {
    if (fromCardId === toCardId) return null

    const fromCard = cards.value.find(card => card.id === fromCardId)
    const toCard = cards.value.find(card => card.id === toCardId)

    if (!fromCard || !toCard) return null

    const { fromSide, toSide } = resolveConnectionSides(
      fromCard,
      toCard,
      connectionOptions.fromSide,
      connectionOptions.toSide
    )

    // Определяем, являются ли обе карточки лицензиями (type: 'license')
    const bothAreLicenses = fromCard.type === 'license' && toCard.type === 'license'

    return connectionsStore.addConnection(fromCardId, toCardId, {
      ...connectionOptions,
      fromSide,
      toSide,
      // Для лицензий включаем принудительное создание (пропуск проверки на дубликаты)
      force: bothAreLicenses || connectionOptions.force
    })
  }

  /**
   * Начало рисования линии
   * @param {string} cardId - ID карточки
   * @param {string} side - Сторона карточки (top, bottom, left, right)
   */
  const startDrawingLine = (cardId, side) => {
    selectedConnectionIds.value = []
    connectionStart.value = { cardId, side }
    isDrawingLine.value = true

    const startCard = cards.value.find(card => card.id === cardId)
    if (startCard) {
      const startPoint = getCardConnectorPoint(startCard, side)
      mousePosition.value = { x: startPoint.x, y: startPoint.y }
    }

    if (emit) {
      emit('update-connection-status', 'Рисование линии: кликните на соединительную точку другой карточки')
    }
  }

  /**
   * Завершение рисования линии
   * @param {string} cardId - ID целевой карточки
   * @param {string} side - Сторона целевой карточки
   */
  const endDrawingLine = (cardId, side) => {
    if (!connectionStart.value || connectionStart.value.cardId === cardId) {
      cancelDrawing()
      return
    }

    createConnectionBetweenCards(connectionStart.value.cardId, cardId, {
      fromSide: connectionStart.value.side,
      toSide: side
    })

    cancelDrawing()
  }

  /**
   * Отмена рисования линии
   */
  const cancelDrawing = () => {
    connectionStart.value = null
    isDrawingLine.value = false
    previewLine.value = null
    if (emit) {
      emit('update-connection-status', 'Кликните на соединительную точку для создания линии')
    }
  }

  /**
   * Обработчик клика по линии соединения
   * @param {Event} event - Событие клика
   * @param {string} connectionId - ID соединения
   */
  const handleLineClick = (event, connectionId) => {
    event.stopPropagation()

    const isCtrlPressed = event.ctrlKey || event.metaKey

    if (isCtrlPressed) {
      const index = selectedConnectionIds.value.indexOf(connectionId)
      if (index > -1) {
        selectedConnectionIds.value.splice(index, 1)
      } else {
        selectedConnectionIds.value.push(connectionId)
      }
    } else {
      if (selectedConnectionIds.value.length === 1 && selectedConnectionIds.value[0] === connectionId) {
        selectedConnectionIds.value = []
      } else {
        selectedConnectionIds.value = [connectionId]
      }
    }

    cardsStore.deselectAllCards()
    cancelDrawing()
  }

  /**
   * Удаление выделенных соединений
   */
  const deleteSelectedConnections = () => {
    if (selectedConnectionIds.value.length === 0) return

    selectedConnectionIds.value.forEach(connectionId => {
      connectionsStore.removeConnection(connectionId)
    })

    selectedConnectionIds.value = []
  }

  /**
   * Очистка выделения соединений
   */
  const clearConnectionSelection = () => {
    selectedConnectionIds.value = []
  }

  // === Функции для "магнитного" соединения ===

  /**
   * Находит карточку под указанной точкой с учётом отступа для "магнитного" захвата
   * @param {number} pointX - X координата в системе координат canvas
   * @param {number} pointY - Y координата в системе координат canvas
   * @param {Object} options - Опции поиска
   * @param {boolean} options.isMobile - Использовать увеличенный отступ для мобильных
   * @param {string} options.excludeCardId - ID карточки, которую нужно исключить из поиска
   * @returns {Object|null} Найденная карточка или null
   */
  const findCardAtPoint = (pointX, pointY, options = {}) => {
    const { isMobile = false, excludeCardId = null } = options
    const margin = isMobile ? MOBILE_SNAP_MARGIN : DESKTOP_SNAP_MARGIN

    // Ищем карточку, в границы которой попадает точка (с учётом отступа)
    const foundCard = cards.value.find(card => {
      // Исключаем указанную карточку (например, карточку-источник)
      if (excludeCardId && card.id === excludeCardId) {
        return false
      }
      return isPointInCardBounds(card, pointX, pointY, margin)
    })

    return foundCard || null
  }

  /**
   * Определяет ближайшую сторону карточки относительно точки
   * @param {Object} card - Объект карточки
   * @param {number} pointX - X координата
   * @param {number} pointY - Y координата
   * @returns {string} - 'top' | 'right' | 'bottom' | 'left'
   */
  const getClosestSide = (card, pointX, pointY) => {
    return getClosestCardSide(card, pointX, pointY)
  }

  /**
   * Пытается завершить рисование линии через "магнитное" соединение
   * Вызывается при pointerup, если пользователь не попал точно в connection-point
   * @param {number} pointX - X координата в системе координат canvas
   * @param {number} pointY - Y координата в системе координат canvas
   * @param {boolean} isMobile - Является ли устройство мобильным
   * @returns {boolean} true если соединение было создано, false если отменено
   */
  const tryMagneticConnection = (pointX, pointY, isMobile = false) => {
    if (!isDrawingLine.value || !connectionStart.value) {
      return false
    }

    const sourceCardId = connectionStart.value.cardId

    // Ищем карточку под курсором (исключая карточку-источник)
    const targetCard = findCardAtPoint(pointX, pointY, {
      isMobile,
      excludeCardId: sourceCardId
    })

    if (targetCard) {
      // Определяем ближайшую сторону целевой карточки
      const targetSide = getClosestSide(targetCard, pointX, pointY)

      // Создаём соединение
      endDrawingLine(targetCard.id, targetSide)
      return true
    }

    // Карточка не найдена — отменяем рисование
    cancelDrawing()
    return false
  }

  // === Возвращаемые значения ===
  return {
    // Refs
    connectionStart,
    isDrawingLine,
    previewLine,
    selectedConnectionIds,

    // Computed
    previewLineWidth,
    previewLinePath,

    // Функции
    createConnectionBetweenCards,
    startDrawingLine,
    endDrawingLine,
    cancelDrawing,
    handleLineClick,
    deleteSelectedConnections,
    clearConnectionSelection,

    // Функции для "магнитного" соединения
    findCardAtPoint,
    getClosestSide,
    tryMagneticConnection
  }
}
