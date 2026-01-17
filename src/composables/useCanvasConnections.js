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
    console.log('Начало рисования линии:', connectionStart.value)
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

    console.log('Создано соединение:', connectionStart.value.cardId, '->', cardId)
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

    console.log('Deleting connections:', selectedConnectionIds.value)

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
    clearConnectionSelection
  }
}
