/**
 * Composable для управления Avatar-соединениями и их анимациями
 * Включает логику соединений между аватарами, контрольные точки Безье,
 * контекстное меню аватаров и модальное окно ввода номера
 */

import { ref, computed, watch } from 'vue'
import { useBezierCurves } from './useBezierCurves'

/**
 * Конвертация hex-цвета в RGB строку
 * @param {string} color - Hex цвет (#RRGGBB или #RGB)
 * @returns {string|null} RGB строка в формате "R, G, B" или null
 */
export function toRgbString(color) {
  if (typeof color !== 'string') return null
  const hex = color.replace('#', '')
  if (![3, 6].includes(hex.length)) return null
  const normalized = hex.length === 3
    ? hex.split('').map(ch => ch + ch).join('')
    : hex

  const int = Number.parseInt(normalized, 16)
  if (!Number.isFinite(int)) return null

  const r = (int >> 16) & 255
  const g = (int >> 8) & 255
  const b = int & 255

  return `${r}, ${g}, ${b}`
}

/**
 * @typedef {Object} UseAvatarConnectionsOptions
 * @property {import('vue').Ref<Array>} cards - Ref на массив карточек/аватаров
 * @property {import('vue').Ref<Array>} avatarConnections - Ref на массив avatar-соединений
 * @property {Object} connectionsStore - Pinia store для соединений
 * @property {Object} cardsStore - Pinia store для карточек
 * @property {Object} viewSettingsStore - Pinia store для настроек вида
 * @property {Function} screenToCanvas - Функция конвертации координат экрана в canvas
 * @property {import('vue').Ref<{x: number, y: number}>} mousePosition - Ref на позицию мыши
 * @property {import('vue').Ref<number>} previewLineWidth - Ref на ширину preview линии
 */

/**
 * Composable для управления Avatar-соединениями
 * @param {UseAvatarConnectionsOptions} options
 */
export function useAvatarConnections(options) {
  const {
    cards,
    avatarConnections,
    connectionsStore,
    cardsStore,
    viewSettingsStore,
    screenToCanvas,
    mousePosition,
    previewLineWidth
  } = options

  // === Инициализация useBezierCurves ===
  const {
    buildBezierPath,
    getAvatarConnectionPoint,
    calculateMidpoint,
    findClosestPointOnBezier
  } = useBezierCurves()

  // === Refs и состояния ===

  // Начальная точка для рисования нового соединения
  const avatarConnectionStart = ref(null) // { avatarId, pointIndex, pointAngle }

  // Выделенные avatar-соединения
  const selectedAvatarConnectionIds = ref([])

  // Контекстное меню для аватара
  const avatarContextMenu = ref(null) // { avatarId }
  const avatarContextMenuPosition = ref({ x: 0, y: 0 })

  // Модальное окно для ввода компьютерного номера
  const avatarNumberModalVisible = ref(false)
  const avatarNumberModalAvatarId = ref(null)
  const avatarNumberModalCurrentId = ref('')

  // Анимация выделения аватаров и их линий
  const animatedAvatarIds = ref(new Set())
  const animatedAvatarConnectionIds = ref(new Set())
  const avatarAnimationTimers = ref([])
  const avatarAnimationRootId = ref(null)

  // Перетаскивание контрольных точек
  const draggingControlPoint = ref(null) // { connectionId, pointIndex }

  // === Computed ===

  const avatarAnimationDuration = computed(() => {
    return viewSettingsStore?.animationDurationMs || 2000
  })

  const avatarAnimationColor = computed(() => {
    return viewSettingsStore?.animationColor || '#5D8BF4'
  })

  const avatarAnimationColorRgb = computed(() => {
    return toRgbString(avatarAnimationColor.value) || '93, 139, 244'
  })

  const isAvatarAnimationEnabled = computed(() => {
    return viewSettingsStore?.isAnimationEnabled !== false
  })

  // Пути для avatar-соединений с кривыми Безье
  const avatarConnectionPaths = computed(() => {
    if (!avatarConnections?.value) return []

    return avatarConnections.value
      .map(connection => {
        const fromAvatar = cards.value.find(card => card.id === connection.from && card.type === 'avatar')
        const toAvatar = cards.value.find(card => card.id === connection.to && card.type === 'avatar')

        if (!fromAvatar || !toAvatar) return null

        // Получить координаты точек соединения
        const fromPoint = getAvatarConnectionPoint(fromAvatar, connection.fromPointIndex)
        const toPoint = getAvatarConnectionPoint(toAvatar, connection.toPointIndex)

        // Построить массив точек для кривой Безье
        const points = [fromPoint, ...connection.controlPoints, toPoint]
        const handlePoints = connection.controlPoints.map(point => {
          const closest = findClosestPointOnBezier(points, point.x, point.y, 200)
          if (!closest) {
            return point
          }
          return { x: closest.x, y: closest.y }
        })

        // Построить SVG path
        const d = buildBezierPath(points)

        if (!d) return null

        const defaultLineThickness = connectionsStore?.defaultLineThickness || 2

        return {
          id: connection.id,
          type: 'avatar-connection',
          d,
          points, // Сохраняем точки для отображения контрольных точек
          handlePoints,
          color: connection.color || connectionsStore?.defaultLineColor || '#5D8BF4',
          strokeWidth: connection.thickness || defaultLineThickness,
          highlightType: connection.highlightType || null,
          animationDuration: connection.animationDuration ?? connectionsStore?.defaultAnimationDuration ?? 2000
        }
      })
      .filter(Boolean)
  })

  // Preview линия для avatar-соединений
  const avatarPreviewLinePath = computed(() => {
    if (!avatarConnectionStart.value) return null

    const fromAvatar = cards.value.find(
      card => card.id === avatarConnectionStart.value.avatarId && card.type === 'avatar'
    )
    if (!fromAvatar) return null

    const startPoint = getAvatarConnectionPoint(fromAvatar, avatarConnectionStart.value.pointIndex)
    const endPoint = mousePosition?.value || { x: 0, y: 0 }

    const d = `M ${startPoint.x} ${startPoint.y} L ${endPoint.x} ${endPoint.y}`

    return {
      d,
      color: '#5D8BF4',
      strokeWidth: previewLineWidth?.value || 2,
      strokeDasharray: '5,5'
    }
  })

  // === Вспомогательные функции ===

  const addAnimatedItem = (setRef, id) => {
    const next = new Set(setRef.value)
    next.add(id)
    setRef.value = next
  }

  const removeAnimatedItem = (setRef, id) => {
    const next = new Set(setRef.value)
    next.delete(id)
    setRef.value = next
  }

  // === Функции анимации ===

  /**
   * Остановка анимации выделения аватаров
   */
  const stopAvatarSelectionAnimation = () => {
    avatarAnimationTimers.value.forEach(timerId => window.clearTimeout(timerId))
    avatarAnimationTimers.value = []
    animatedAvatarIds.value = new Set()
    animatedAvatarConnectionIds.value = new Set()
    avatarAnimationRootId.value = null
  }

  /**
   * Поиск следующего аватара вверх по иерархии
   * @param {string} avatarId - ID текущего аватара
   * @param {Set} visited - Посещенные аватары
   */
  const findNextAvatarUp = (avatarId, visited = new Set()) => {
    const currentAvatar = cards.value.find(card => card.id === avatarId && card.type === 'avatar')
    if (!currentAvatar) return null

    const candidates = avatarConnections.value.filter(connection => {
      const isFromCurrent = connection.from === avatarId
      const isToCurrent = connection.to === avatarId

      if (!isFromCurrent && !isToCurrent) return false

      const currentPointIndex = isFromCurrent ? connection.fromPointIndex : connection.toPointIndex
      const otherPointIndex = isFromCurrent ? connection.toPointIndex : connection.fromPointIndex

      return currentPointIndex === 1 && otherPointIndex !== undefined && otherPointIndex !== 1
    })

    const scored = candidates
      .map(connection => {
        const nextAvatarId = connection.from === avatarId ? connection.to : connection.from
        const nextAvatar = cards.value.find(card => card.id === nextAvatarId && card.type === 'avatar')

        if (!nextAvatar || visited.has(nextAvatarId)) {
          return null
        }
        return { connection, nextAvatar }
      })
      .filter(Boolean)

    if (!scored.length) {
      return null
    }

    const { connection, nextAvatar } = scored[0]

    return {
      connectionId: connection.id,
      nextAvatarId: nextAvatar.id
    }
  }

  /**
   * Построение последовательности анимации аватаров
   * @param {string} startAvatarId - ID начального аватара
   */
  const buildAvatarAnimationSequence = (startAvatarId) => {
    const sequence = []
    const visited = new Set([startAvatarId])
    let currentId = startAvatarId

    sequence.push({ type: 'avatar', id: startAvatarId })

    while (true) {
      const next = findNextAvatarUp(currentId, visited)
      if (!next) break

      sequence.push({ type: 'connection', id: next.connectionId })
      sequence.push({ type: 'avatar', id: next.nextAvatarId })
      visited.add(next.nextAvatarId)
      currentId = next.nextAvatarId
    }

    return sequence
  }

  /**
   * Запуск анимации выделения аватара
   * @param {string} avatarId - ID аватара
   */
  const startAvatarSelectionAnimation = (avatarId) => {
    const avatar = cards.value.find(card => card.id === avatarId && card.type === 'avatar')
    if (!avatar) {
      stopAvatarSelectionAnimation()
      return
    }

    stopAvatarSelectionAnimation()
    avatarAnimationRootId.value = avatarId

    const sequence = buildAvatarAnimationSequence(avatarId)
    const nextAvatarIds = new Set()
    const nextConnectionIds = new Set()

    sequence.forEach(item => {
      if (item.type === 'avatar') {
        nextAvatarIds.add(item.id)
      } else if (item.type === 'connection') {
        nextConnectionIds.add(item.id)
      }
    })

    animatedAvatarIds.value = nextAvatarIds
    animatedAvatarConnectionIds.value = nextConnectionIds

    const duration = avatarAnimationDuration.value

    const timerId = window.setTimeout(() => {
      if (avatarAnimationRootId.value !== avatarId) return
      stopAvatarSelectionAnimation()
    }, duration)

    avatarAnimationTimers.value.push(timerId)
  }

  // === Сбор снимков для перетаскивания ===

  /**
   * Сбор снимков avatar-соединений для групповых перемещений
   * @param {Set} movingIds - Set ID перемещаемых объектов
   */
  const collectAvatarConnectionSnapshots = (movingIds) => {
    if (!movingIds || movingIds.size === 0) {
      return []
    }

    return avatarConnections.value
      .filter(connection =>
        movingIds.has(connection.from)
        && movingIds.has(connection.to)
        && Array.isArray(connection.controlPoints)
        && connection.controlPoints.length > 0
      )
      .map(connection => ({
        id: connection.id,
        controlPoints: connection.controlPoints.map(point => ({ ...point }))
      }))
  }

  // === Обработчики событий ===

  /**
   * Обработчик клика на avatar-соединение
   */
  const handleAvatarLineClick = (event, connectionId) => {
    event.stopPropagation()

    const isCtrlPressed = event.ctrlKey || event.metaKey

    if (isCtrlPressed) {
      const index = selectedAvatarConnectionIds.value.indexOf(connectionId)
      if (index > -1) {
        selectedAvatarConnectionIds.value.splice(index, 1)
      } else {
        selectedAvatarConnectionIds.value.push(connectionId)
      }
    } else {
      if (selectedAvatarConnectionIds.value.length === 1 && selectedAvatarConnectionIds.value[0] === connectionId) {
        selectedAvatarConnectionIds.value = []
      } else {
        selectedAvatarConnectionIds.value = [connectionId]
      }
    }

    // Сброс выделения карточек и других элементов
    if (cardsStore) {
      cardsStore.deselectAllCards()
    }
    avatarConnectionStart.value = null
  }

  /**
   * Обработчик клика на точку соединения аватара
   */
  const handleAvatarConnectionPointClick = (data) => {
    const { avatarId, pointIndex, pointAngle, event } = data

    // Если уже начато рисование линии от другого аватара
    if (avatarConnectionStart.value && avatarConnectionStart.value.avatarId !== avatarId) {
      // Проверка: нельзя соединить аватар с лицензией
      const fromAvatar = cards.value.find(c => c.id === avatarConnectionStart.value.avatarId)
      const toCard = cards.value.find(c => c.id === avatarId)

      if (fromAvatar && toCard) {
        if (fromAvatar.type === 'avatar' && toCard.type !== 'avatar') {
          // Нельзя соединить аватар с лицензией
          console.warn('Нельзя соединить аватар с лицензией')
          avatarConnectionStart.value = null
          return
        }

        // Создать соединение
        const fromPoint = getAvatarConnectionPoint(fromAvatar, avatarConnectionStart.value.pointIndex)
        const toPoint = getAvatarConnectionPoint(toCard, pointIndex)
        const midpoint = calculateMidpoint(fromPoint, toPoint)

        connectionsStore.addAvatarConnection(
          avatarConnectionStart.value.avatarId,
          avatarId,
          {
            fromPointIndex: avatarConnectionStart.value.pointIndex,
            toPointIndex: pointIndex,
            controlPoints: [midpoint],
            color: viewSettingsStore.lineColor,
            thickness: viewSettingsStore.lineThickness,
            highlightType: null
          }
        )
      }

      avatarConnectionStart.value = null
    } else {
      // Начать рисование линии от этого аватара
      avatarConnectionStart.value = {
        avatarId,
        pointIndex,
        pointAngle
      }
    }
  }

  /**
   * Обработчик двойного клика на avatar-линии (добавление точки изгиба)
   */
  const handleAvatarLineDoubleClick = (event, connectionId) => {
    event.stopPropagation()

    const connection = avatarConnections.value.find(c => c.id === connectionId)
    if (!connection) return
    if (Array.isArray(connection.controlPoints) && connection.controlPoints.length >= 3) {
      return
    }

    // Найти ближайшую точку на кривой
    const fromAvatar = cards.value.find(card => card.id === connection.from && card.type === 'avatar')
    const toAvatar = cards.value.find(card => card.id === connection.to && card.type === 'avatar')

    if (!fromAvatar || !toAvatar) return

    const fromPoint = getAvatarConnectionPoint(fromAvatar, connection.fromPointIndex)
    const toPoint = getAvatarConnectionPoint(toAvatar, connection.toPointIndex)
    const points = [fromPoint, ...connection.controlPoints, toPoint]

    const canvasCoords = screenToCanvas(event.clientX, event.clientY)
    const { x, y } = canvasCoords

    const closest = findClosestPointOnBezier(points, x, y)

    if (closest && closest.index > 0) {
      // Добавить контрольную точку в позицию closest.index
      const newControlPoints = [...connection.controlPoints]
      newControlPoints.splice(closest.index - 1, 0, { x: closest.x, y: closest.y })
      if (newControlPoints.length > 3) {
        newControlPoints.length = 3
      }
      connectionsStore.updateAvatarConnection(connectionId, {
        controlPoints: newControlPoints
      })
    }
  }

  /**
   * Обработчик двойного клика на контрольной точке (удаление)
   */
  const handleControlPointDoubleClick = (event, connectionId, pointIndex) => {
    event.stopPropagation()

    const connection = avatarConnections.value.find(c => c.id === connectionId)
    if (!connection) return

    const newControlPoints = connection.controlPoints.filter((_, i) => i !== pointIndex)

    connectionsStore.updateAvatarConnection(connectionId, {
      controlPoints: newControlPoints
    })
  }

  /**
   * Обработчик начала перетаскивания контрольной точки
   */
  const handleControlPointDragStart = (event, connectionId, pointIndex) => {
    event.stopPropagation()

    draggingControlPoint.value = {
      connectionId,
      pointIndex
    }

    window.addEventListener('pointermove', handleControlPointDrag, { passive: false })
    window.addEventListener('pointerup', handleControlPointDragEnd)
    window.addEventListener('pointercancel', handleControlPointDragEnd)
  }

  /**
   * Обработчик перетаскивания контрольной точки
   */
  const handleControlPointDrag = (event) => {
    if (!draggingControlPoint.value) return

    const connection = avatarConnections.value.find(c => c.id === draggingControlPoint.value.connectionId)
    if (!connection) return

    event.preventDefault()

    const { x, y } = screenToCanvas(event.clientX, event.clientY)

    const newControlPoints = [...connection.controlPoints]
    newControlPoints[draggingControlPoint.value.pointIndex] = { x, y }

    connectionsStore.updateAvatarConnection(draggingControlPoint.value.connectionId, {
      controlPoints: newControlPoints
    })
  }

  /**
   * Обработчик завершения перетаскивания контрольной точки
   */
  const handleControlPointDragEnd = () => {
    draggingControlPoint.value = null
    window.removeEventListener('pointermove', handleControlPointDrag)
    window.removeEventListener('pointerup', handleControlPointDragEnd)
    window.removeEventListener('pointercancel', handleControlPointDragEnd)
  }

  // === Контекстное меню аватара ===

  /**
   * Обработчик правого клика мыши на аватаре для открытия контекстного меню
   */
  const handleAvatarContextMenu = (event, avatarId) => {
    event.preventDefault()
    event.stopPropagation()

    // Закрываем другие контекстные меню
    closeAvatarContextMenu()

    // Открываем контекстное меню для аватара
    const avatar = cardsStore?.cards?.find(c => c.id === avatarId)
    if (avatar && avatar.type === 'avatar') {
      avatarContextMenu.value = { avatarId }
      avatarContextMenuPosition.value = {
        x: event.clientX,
        y: event.clientY
      }
    }
  }

  /**
   * Закрытие контекстного меню аватара
   */
  const closeAvatarContextMenu = () => {
    avatarContextMenu.value = null
  }

  // === Модальное окно ввода номера ===

  /**
   * Обработчик двойного клика на аватаре
   */
  const handleAvatarDoubleClick = (event, avatarId) => {
    event.stopPropagation()

    const avatar = cardsStore?.cards?.find(c => c.id === avatarId && c.type === 'avatar')
    if (!avatar) return

    avatarNumberModalAvatarId.value = avatarId
    avatarNumberModalCurrentId.value = avatar.personalId || ''
    avatarNumberModalVisible.value = true
  }

  /**
   * Обработчик применения данных из модального окна
   */
  const handleAvatarNumberApply = ({ avatarId, userData }) => {
    if (userData === null) {
      // Сброс данных аватара
      if (cardsStore?.updateAvatarUserData) {
        cardsStore.updateAvatarUserData(avatarId, null)
      }
    } else {
      // Применение данных пользователя
      if (cardsStore?.updateAvatarUserData) {
        cardsStore.updateAvatarUserData(avatarId, userData)
      }
    }
  }

  /**
   * Закрытие модального окна
   */
  const closeAvatarNumberModal = () => {
    avatarNumberModalVisible.value = false
    avatarNumberModalAvatarId.value = null
    avatarNumberModalCurrentId.value = ''
  }

  // === Удаление выбранных соединений ===

  /**
   * Удаление выбранных avatar-соединений
   */
  const deleteSelectedAvatarConnections = () => {
    if (selectedAvatarConnectionIds.value.length === 0) return

    console.log('Deleting avatar connections:', selectedAvatarConnectionIds.value)

    selectedAvatarConnectionIds.value.forEach(connectionId => {
      connectionsStore.removeAvatarConnection(connectionId)
    })

    selectedAvatarConnectionIds.value = []
    console.log('Avatar connections deleted')
  }

  /**
   * Сброс соединительной линии при рисовании
   */
  const cancelAvatarDrawing = () => {
    avatarConnectionStart.value = null
  }

  // === Watch для отключения анимации ===
  watch(() => isAvatarAnimationEnabled.value, (enabled) => {
    if (!enabled) {
      stopAvatarSelectionAnimation()
    }
  })

  // === Возвращаемые значения ===
  return {
    // Refs
    avatarConnectionStart,
    selectedAvatarConnectionIds,
    avatarContextMenu,
    avatarContextMenuPosition,
    avatarNumberModalVisible,
    avatarNumberModalAvatarId,
    avatarNumberModalCurrentId,
    animatedAvatarIds,
    animatedAvatarConnectionIds,
    avatarAnimationTimers,
    avatarAnimationRootId,
    draggingControlPoint,

    // Computed
    avatarAnimationDuration,
    avatarAnimationColor,
    avatarAnimationColorRgb,
    isAvatarAnimationEnabled,
    avatarConnectionPaths,
    avatarPreviewLinePath,

    // Функции анимации
    stopAvatarSelectionAnimation,
    startAvatarSelectionAnimation,
    buildAvatarAnimationSequence,
    findNextAvatarUp,

    // Сбор снимков
    collectAvatarConnectionSnapshots,

    // Обработчики событий линий
    handleAvatarLineClick,
    handleAvatarConnectionPointClick,
    handleAvatarLineDoubleClick,

    // Обработчики контрольных точек
    handleControlPointDoubleClick,
    handleControlPointDragStart,
    handleControlPointDrag,
    handleControlPointDragEnd,

    // Контекстное меню
    handleAvatarContextMenu,
    closeAvatarContextMenu,

    // Модальное окно номера
    handleAvatarDoubleClick,
    handleAvatarNumberApply,
    closeAvatarNumberModal,

    // Удаление и отмена
    deleteSelectedAvatarConnections,
    cancelAvatarDrawing,

    // Утилиты
    toRgbString,
    getAvatarConnectionPoint
  }
}
