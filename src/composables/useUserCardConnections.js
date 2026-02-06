/**
 * Composable для управления UserCard-соединениями и их анимациями
 * Включает логику соединений между карточками партнёров (UserCard), контрольные точки Безье,
 * контекстное меню карточек и модальное окно ввода номера
 *
 * ВАЖНО: Терминология
 * - UserCard (карточка пользователя) — геометрический объект на холсте с данными партнёра
 * - avatarUrl — картинка профиля пользователя внутри карточки (НЕ путать с UserCard)
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
 * @typedef {Object} UseUserCardConnectionsOptions
 * @property {import('vue').Ref<Array>} cards - Ref на массив карточек
 * @property {import('vue').Ref<Array>} userCardConnections - Ref на массив user-card-соединений
 * @property {Object} connectionsStore - Pinia store для соединений
 * @property {Object} cardsStore - Pinia store для карточек
 * @property {Object} viewSettingsStore - Pinia store для настроек вида
 * @property {Function} screenToCanvas - Функция конвертации координат экрана в canvas
 * @property {import('vue').Ref<{x: number, y: number}>} mousePosition - Ref на позицию мыши
 * @property {import('vue').Ref<number>} previewLineWidth - Ref на ширину preview линии
 */

/**
 * Composable для управления UserCard-соединениями (карточки партнёров на холсте)
 * @param {UseUserCardConnectionsOptions} options
 */
export function useUserCardConnections(options) {
  const {
    cards,
    userCardConnections,
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
    getUserCardConnectionPoint,
    calculateMidpoint,
    findClosestPointOnBezier
  } = useBezierCurves()

  // === Refs и состояния ===

  // Начальная точка для рисования нового соединения
  const userCardConnectionStart = ref(null) // { userCardId, pointIndex, pointAngle }

  // Выделенные user-card-соединения
  const selectedUserCardConnectionIds = ref([])

  // Контекстное меню для аватара
  const userCardContextMenu = ref(null) // { userCardId }
  const userCardContextMenuPosition = ref({ x: 0, y: 0 })

  // Модальное окно для ввода компьютерного номера
  const userCardNumberModalVisible = ref(false)
  const userCardNumberModalUserCardId = ref(null)
  const userCardNumberModalCurrentId = ref('')

  // Анимация выделения аватаров и их линий
  const animatedUserCardIds = ref(new Set())
  const animatedUserCardConnectionIds = ref(new Set())
  const userCardAnimationTimers = ref([])
  const userCardAnimationRootId = ref(null)

  // Перетаскивание контрольных точек
  const draggingControlPoint = ref(null) // { connectionId, pointIndex }

  // === Computed ===

  const userCardAnimationDuration = computed(() => {
    return viewSettingsStore?.animationDurationMs || 2000
  })

  const userCardAnimationColor = computed(() => {
    return viewSettingsStore?.animationColor || '#5D8BF4'
  })

  const userCardAnimationColorRgb = computed(() => {
    return toRgbString(userCardAnimationColor.value) || '93, 139, 244'
  })

  const isUserCardAnimationEnabled = computed(() => {
    return viewSettingsStore?.isAnimationEnabled !== false
  })

  // Пути для user-card-соединений с кривыми Безье
  const userCardConnectionPaths = computed(() => {
    if (!userCardConnections?.value) return []

    return userCardConnections.value
      .map(connection => {
        const fromUserCard = cards.value.find(card => card.id === connection.from && card.type === 'user_card')
        const toUserCard = cards.value.find(card => card.id === connection.to && card.type === 'user_card')

        if (!fromUserCard || !toUserCard) return null

        // Получить координаты точек соединения
        const fromPoint = getUserCardConnectionPoint(fromUserCard, connection.fromPointIndex)
        const toPoint = getUserCardConnectionPoint(toUserCard, connection.toPointIndex)

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
          type: 'user-card-connection',
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

  // Preview линия для user-card-соединений
  const userCardPreviewLinePath = computed(() => {
    if (!userCardConnectionStart.value) return null

    const fromUserCard = cards.value.find(
      card => card.id === userCardConnectionStart.value.userCardId && card.type === 'user_card'
    )
    if (!fromUserCard) return null

    const startPoint = getUserCardConnectionPoint(fromUserCard, userCardConnectionStart.value.pointIndex)
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
  const stopUserCardSelectionAnimation = () => {
    userCardAnimationTimers.value.forEach(timerId => window.clearTimeout(timerId))
    userCardAnimationTimers.value = []
    animatedUserCardIds.value = new Set()
    animatedUserCardConnectionIds.value = new Set()
    userCardAnimationRootId.value = null
  }

  /**
   * Поиск следующего аватара вверх по иерархии
   * @param {string} userCardId - ID текущего аватара
   * @param {Set} visited - Посещенные аватары
   */
  const findNextUserCardUp = (userCardId, visited = new Set()) => {
    // Поддержка user_card и license для анимации вверх по цепочке
    const currentUserCard = cards.value.find(card => card.id === userCardId && (card.type === 'user_card' || card.type === 'license'))
    if (!currentUserCard) return null

    const candidates = userCardConnections.value.filter(connection => {
      const isFromCurrent = connection.from === userCardId
      const isToCurrent = connection.to === userCardId

      if (!isFromCurrent && !isToCurrent) return false

      const currentPointIndex = isFromCurrent ? connection.fromPointIndex : connection.toPointIndex
      const otherPointIndex = isFromCurrent ? connection.toPointIndex : connection.fromPointIndex

      // ИСПРАВЛЕНО: Ищем соединения К точке 1 (родительская карточка сверху),
      // а не ОТ точки 1 (что означало бы движение вниз).
      // Это позволяет находить родителей независимо от того, от какой точки идёт соединение (боковой, нижней и т.д.)
      return otherPointIndex === 1 && currentPointIndex !== 1
    })

    const scored = candidates
      .map(connection => {
        const nextUserCardId = connection.from === userCardId ? connection.to : connection.from
        // Поддержка user_card и license для анимации вверх по цепочке
        const nextUserCard = cards.value.find(card => card.id === nextUserCardId && (card.type === 'user_card' || card.type === 'license'))

        if (!nextUserCard || visited.has(nextUserCardId)) {
          return null
        }
        return { connection, nextUserCard }
      })
      .filter(Boolean)

    if (!scored.length) {
      return null
    }

    const { connection, nextUserCard } = scored[0]

    return {
      connectionId: connection.id,
      nextUserCardId: nextUserCard.id
    }
  }

  /**
   * Построение последовательности анимации карточек вверх по цепочке
   * ИСПРАВЛЕНО: Использует cardsStore.calculationMeta.parentOf (как animateBalancePropagation)
   * вместо userCardConnections, которые пусты для small/license карточек
   * @param {string} startCardId - ID начальной карточки (любого типа: user_card, license, small)
   * @returns {Array<{type: 'user_card'|'connection', id: string}>} Последовательность для анимации
   */
  const buildUserCardAnimationSequence = (startCardId) => {
    const sequence = []
    const visited = new Set()

    // Получаем метаданные parentOf из cardsStore (как в animateBalancePropagation)
    const meta = cardsStore?.calculationMeta || {}
    const parentOf = meta.parentOf || {}

    let currentId = startCardId

    // Строим путь от текущей карточки до корня
    while (currentId && !visited.has(currentId)) {
      visited.add(currentId)

      const currentCard = cards.value.find(c => c.id === currentId)

      if (!currentCard) {
        break
      }

      // Добавляем карточку в последовательность
      sequence.push({ type: 'user_card', id: currentId })

      // Ищем родительскую связь через calculationMeta.parentOf
      const relation = parentOf[currentId]

      if (!relation || !relation.parentId) {
        break
      }

      const parentId = relation.parentId

      // Находим соединение между текущей карточкой и родителем через connectionsStore
      const connection = connectionsStore?.connections?.find(conn =>
        (conn.from === currentId && conn.to === parentId) ||
        (conn.from === parentId && conn.to === currentId)
      )

      if (connection) {
        sequence.push({ type: 'connection', id: connection.id })
      } else {
        console.warn(`    ⚠️ Соединение НЕ найдено между ${currentId} и ${parentId}`)
      }

      // Переходим к родительской карточке
      currentId = parentId
    }

    return sequence
  }

/**
 * Поиск DOM-элемента карточки или стикера (PV changed)
 * Копирует логику из useActivePv для совместимости
 * @param {string} cardId - ID карточки
 * @returns {HTMLElement|null} DOM-элемент или null
 */
const getCardElement = (cardId) => {
  // Ищем стикеры (small/license)
  const stickerEl = document.getElementById(`sticker-${cardId}`);
  if (stickerEl) return stickerEl;

  // Ищем обычные карточки (user_card)
  // Пробуем все возможные варианты селекторов
  return document.querySelector(`[data-card-id="${cardId}"]`) ||
         document.getElementById(`card-${cardId}`) ||
         document.getElementById(cardId);
}

/**
 * Запуск анимации выделения аватара
 * @param {string} userCardId - ID аватара
 */
const startUserCardSelectionAnimation = (userCardId) => {
  // Проверяем настройки анимации (PV changed)
  if (viewSettingsStore && !viewSettingsStore.isAnimationEnabled) {
    return;
  }

  // Проверяем существование карточки
  const userCard = cards.value.find(card => card.id === userCardId)

  if (!userCard) {
    return
  }

  // 1. Строим последовательность анимации
  const sequence = buildUserCardAnimationSequence(userCardId)

  if (!sequence || sequence.length === 0) {
    console.warn('⚠️ Пустая последовательность анимации');
    return;
  }

  // 2. Анимируем каждый элемент напрямую через DOM (как в useActivePv)
  sequence.forEach(item => {
    if (item.type === 'user_card') {
      const el = getCardElement(item.id);
      if (el) {
        // Устанавливаем цвет анимации (PV changed)
        const animationColor = viewSettingsStore?.animationColor || '#ef4444';
        const rgb = toRgbString(animationColor);
        if (rgb) {
          el.style.setProperty('--user-card-animation-color', animationColor);
          el.style.setProperty('--user-card-animation-color-rgb', rgb);
        }

        // Добавляем ТОТ ЖЕ класс, что и при +10
        el.classList.add('card--balance-propagation');
        // И наш новый класс для стикеров (на всякий случай)
        el.classList.add('is-animated');

        // Автоматическое удаление классов через 2 секунды
        setTimeout(() => {
          el.classList.remove('card--balance-propagation');
          el.classList.remove('is-animated');
        }, 2000);
      } else {
        console.warn(`❌ Элемент карточки ${item.id} не найден в DOM`);
      }
    }
    else if (item.type === 'connection') {
      const lineEl = document.getElementById(item.id);
      if (lineEl) {
        // Устанавливаем цвет анимации для линии (PV changed)
        const animationColor = viewSettingsStore?.animationColor || '#ef4444';
        const rgb = toRgbString(animationColor);
        if (rgb) {
          // Применяем к контейнеру линии
          lineEl.style.setProperty('--user-card-animation-color-rgb', rgb);
          // Применяем ко всем path элементам внутри линии
          const paths = lineEl.querySelectorAll('path');
          paths.forEach(p => p.style.setProperty('--user-card-animation-color-rgb', rgb));
        }

        lineEl.classList.add('line--balance-propagation');

        // Автоматическое удаление класса через 2 секунды
        setTimeout(() => {
          lineEl.classList.remove('line--balance-propagation');
        }, 2000);
      } else {
        console.warn(`❌ Элемент линии ${item.id} не найден в DOM`);
      }
    }
  });
}


  // === Сбор снимков для перетаскивания ===

  /**
   * Сбор снимков user-card-соединений для групповых перемещений
   * @param {Set} movingIds - Set ID перемещаемых объектов
   */
  const collectUserCardConnectionSnapshots = (movingIds) => {
    if (!movingIds || movingIds.size === 0) {
      return []
    }

    return userCardConnections.value
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
   * Обработчик клика на user-card-соединение
   */
  const handleUserCardLineClick = (event, connectionId) => {
    event.stopPropagation()

    const isCtrlPressed = event.ctrlKey || event.metaKey

    if (isCtrlPressed) {
      const index = selectedUserCardConnectionIds.value.indexOf(connectionId)
      if (index > -1) {
        selectedUserCardConnectionIds.value.splice(index, 1)
      } else {
        selectedUserCardConnectionIds.value.push(connectionId)
      }
    } else {
      if (selectedUserCardConnectionIds.value.length === 1 && selectedUserCardConnectionIds.value[0] === connectionId) {
        selectedUserCardConnectionIds.value = []
      } else {
        selectedUserCardConnectionIds.value = [connectionId]
      }
    }

    // Сброс выделения карточек и других элементов
    if (cardsStore) {
      cardsStore.deselectAllCards()
    }
    userCardConnectionStart.value = null
  }

  /**
   * Обработчик клика на точку соединения аватара
   */
  const handleUserCardConnectionPointClick = (data) => {
    const { userCardId, pointIndex, pointAngle, event } = data

    // Если уже начато рисование линии от другого аватара
    if (userCardConnectionStart.value && userCardConnectionStart.value.userCardId !== userCardId) {
      // Проверка: нельзя соединить аватар с лицензией
      const fromUserCard = cards.value.find(c => c.id === userCardConnectionStart.value.userCardId)
      const toCard = cards.value.find(c => c.id === userCardId)

      if (fromUserCard && toCard) {
        if (fromUserCard.type === 'user_card' && toCard.type !== 'user_card') {
          // Нельзя соединить аватар с лицензией
          console.warn('Нельзя соединить аватар с лицензией')
          userCardConnectionStart.value = null
          return
        }

        // Создать соединение
        const fromPoint = getUserCardConnectionPoint(fromUserCard, userCardConnectionStart.value.pointIndex)
        const toPoint = getUserCardConnectionPoint(toCard, pointIndex)
        const midpoint = calculateMidpoint(fromPoint, toPoint)

        connectionsStore.addUserCardConnection(
          userCardConnectionStart.value.userCardId,
          userCardId,
          {
            fromPointIndex: userCardConnectionStart.value.pointIndex,
            toPointIndex: pointIndex,
            controlPoints: [midpoint],
            color: viewSettingsStore.lineColor,
            thickness: viewSettingsStore.lineThickness,
            highlightType: null
          }
        )
      }

      userCardConnectionStart.value = null
    } else {
      // Начать рисование линии от этого аватара
      userCardConnectionStart.value = {
        userCardId,
        pointIndex,
        pointAngle
      }
    }
  }

  /**
   * Обработчик двойного клика на user-card-линии (добавление точки изгиба)
   */
  const handleUserCardLineDoubleClick = (event, connectionId) => {
    event.stopPropagation()

    const connection = userCardConnections.value.find(c => c.id === connectionId)
    if (!connection) return
    if (Array.isArray(connection.controlPoints) && connection.controlPoints.length >= 3) {
      return
    }

    // Найти ближайшую точку на кривой
    const fromUserCard = cards.value.find(card => card.id === connection.from && card.type === 'user_card')
    const toUserCard = cards.value.find(card => card.id === connection.to && card.type === 'user_card')

    if (!fromUserCard || !toUserCard) return

    const fromPoint = getUserCardConnectionPoint(fromUserCard, connection.fromPointIndex)
    const toPoint = getUserCardConnectionPoint(toUserCard, connection.toPointIndex)
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
      connectionsStore.updateUserCardConnection(connectionId, {
        controlPoints: newControlPoints
      })
    }
  }

  /**
   * Обработчик двойного клика на контрольной точке (удаление)
   */
  const handleControlPointDoubleClick = (event, connectionId, pointIndex) => {
    event.stopPropagation()

    const connection = userCardConnections.value.find(c => c.id === connectionId)
    if (!connection) return

    const newControlPoints = connection.controlPoints.filter((_, i) => i !== pointIndex)

    connectionsStore.updateUserCardConnection(connectionId, {
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

    const connection = userCardConnections.value.find(c => c.id === draggingControlPoint.value.connectionId)
    if (!connection) return

    event.preventDefault()

    const { x, y } = screenToCanvas(event.clientX, event.clientY)

    const newControlPoints = [...connection.controlPoints]
    newControlPoints[draggingControlPoint.value.pointIndex] = { x, y }

    connectionsStore.updateUserCardConnection(draggingControlPoint.value.connectionId, {
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
  const handleUserCardContextMenu = (event, userCardId) => {
    event.preventDefault()
    event.stopPropagation()

    // Закрываем другие контекстные меню
    closeUserCardContextMenu()

    // Открываем контекстное меню для аватара
    const foundUserCard = cardsStore?.cards?.find(c => c.id === userCardId)
    if (foundUserCard && foundUserCard.type === 'user_card') {
      userCardContextMenu.value = { userCardId }
      userCardContextMenuPosition.value = {
        x: event.clientX,
        y: event.clientY
      }
    }
  }

  /**
   * Закрытие контекстного меню аватара
   */
  const closeUserCardContextMenu = () => {
    userCardContextMenu.value = null
  }

  // === Модальное окно ввода номера ===

  /**
   * Обработчик двойного клика на аватаре
   */
  const handleUserCardDoubleClick = (event, userCardId) => {
    event.stopPropagation()

    const foundUserCard = cardsStore?.cards?.find(c => c.id === userCardId && c.type === 'user_card')
    if (!foundUserCard) return

    userCardNumberModalUserCardId.value = userCardId
    userCardNumberModalCurrentId.value = foundUserCard.personalId || ''
    userCardNumberModalVisible.value = true
  }

  /**
   * Обработчик применения данных из модального окна
   */
  const handleUserCardNumberApply = ({ userCardId, userData }) => {
    if (userData === null) {
      // Сброс данных аватара
      if (cardsStore?.updateUserCardData) {
        cardsStore.updateUserCardData(userCardId, null)
      }
    } else {
      // Применение данных пользователя
      if (cardsStore?.updateUserCardData) {
        cardsStore.updateUserCardData(userCardId, userData)
      }
    }
  }

  /**
   * Закрытие модального окна
   */
  const closeUserCardNumberModal = () => {
    userCardNumberModalVisible.value = false
    userCardNumberModalUserCardId.value = null
    userCardNumberModalCurrentId.value = ''
  }

  // === Удаление выбранных соединений ===

  /**
   * Удаление выбранных user-card-соединений
   */
  const deleteSelectedUserCardConnections = () => {
    if (selectedUserCardConnectionIds.value.length === 0) return

    selectedUserCardConnectionIds.value.forEach(connectionId => {
      connectionsStore.removeUserCardConnection(connectionId)
    })

    selectedUserCardConnectionIds.value = []
  }

  /**
   * Сброс соединительной линии при рисовании
   */
  const cancelUserCardDrawing = () => {
    userCardConnectionStart.value = null
  }

  // === Watch для отключения анимации ===
  watch(() => isUserCardAnimationEnabled.value, (enabled) => {
    if (!enabled) {
      stopUserCardSelectionAnimation()
    }
  })

  // === Возвращаемые значения ===
  return {
    // Refs
    userCardConnectionStart,
    selectedUserCardConnectionIds,
    userCardContextMenu,
    userCardContextMenuPosition,
    userCardNumberModalVisible,
    userCardNumberModalUserCardId,
    userCardNumberModalCurrentId,
    animatedUserCardIds,
    animatedUserCardConnectionIds,
    userCardAnimationTimers,
    userCardAnimationRootId,
    draggingControlPoint,

    // Computed
    userCardAnimationDuration,
    userCardAnimationColor,
    userCardAnimationColorRgb,
    isUserCardAnimationEnabled,
    userCardConnectionPaths,
    userCardPreviewLinePath,

    // Функции анимации
    stopUserCardSelectionAnimation,
    startUserCardSelectionAnimation,
    buildUserCardAnimationSequence,
    findNextUserCardUp,

    // Сбор снимков
    collectUserCardConnectionSnapshots,

    // Обработчики событий линий
    handleUserCardLineClick,
    handleUserCardConnectionPointClick,
    handleUserCardLineDoubleClick,

    // Обработчики контрольных точек
    handleControlPointDoubleClick,
    handleControlPointDragStart,
    handleControlPointDrag,
    handleControlPointDragEnd,

    // Контекстное меню
    handleUserCardContextMenu,
    closeUserCardContextMenu,

    // Модальное окно номера
    handleUserCardDoubleClick,
    handleUserCardNumberApply,
    closeUserCardNumberModal,

    // Удаление и отмена
    deleteSelectedUserCardConnections,
    cancelUserCardDrawing,

    // Утилиты
    toRgbString,
    getUserCardConnectionPoint
  }
}
