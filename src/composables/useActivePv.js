import { nextTick } from 'vue'
import {
  propagateActivePvUp,
  applyActivePvDelta,
  applyActivePvClear
} from '../utils/activePv'

/**
 * Composable для управления Active PV логикой и анимациями баланса
 */
export function useActivePv(options) {
  const {
    cardsStore,
    connectionsStore,
    viewSettingsStore,
    historyStore,
    connections,
    getCardElement,
    getConnectionElement,
    canvasContainerRef
  } = options

  // === Константы ===
  const ACTIVE_PV_FLASH_MS = 650

  // === State ===
  // Хранилище активных таймеров анимации
  const activeAnimationTimers = new Map() // cardId -> { cardTimer, lineTimers: [] }

  // === Методы ===

  /**
   * Обновление data-атрибутов для Active PV элементов
   */
  const updateActivePvDatasets = (payload = {}) => {
    nextTick(() => {
      Object.entries(payload).forEach(([cardId, values]) => {
        const cardElement = getCardElement(cardId)
        if (!cardElement) {
          return
        }
        const hidden = cardElement.querySelector('.active-pv-hidden')
        if (!hidden) {
          return
        }

        const units = values.units || { left: 0, right: 0 }
        const manual = values.manual || { left: 0, right: 0 }
        const remainder = values.remainder || { left: 0, right: 0 }

        hidden.dataset.locall = String(units.left ?? 0)
        hidden.dataset.localr = String(units.right ?? 0)
        hidden.dataset.btnl = String(manual.left ?? 0)
        hidden.dataset.btnr = String(manual.right ?? 0)
        hidden.dataset.remainderl = String(remainder.left ?? 0)
        hidden.dataset.remainderr = String(remainder.right ?? 0)
      })
    })
  }

  /**
   * Функция отмены всех активных анимаций
   */
  const cancelAllActiveAnimations = () => {
    console.log('🛑 Отмена всех активных анимаций, количество:', activeAnimationTimers.size)

    activeAnimationTimers.forEach((timers, cardId) => {
      // Отменяем таймер карточки
      if (timers.cardTimer) {
        clearTimeout(timers.cardTimer)
        // Убираем класс анимации с карточки
        const cardElement = getCardElement(cardId)
        if (cardElement) {
          cardElement.classList.remove('card--balance-propagation')
        }
      }

      // Отменяем таймеры линий
      if (Array.isArray(timers.lineTimers)) {
        timers.lineTimers.forEach(({ timer, lineElement }) => {
          clearTimeout(timer)
          // Убираем класс анимации с линии
          if (lineElement) {
            lineElement.classList.remove('line--balance-propagation')
          }
        })
      }
    })

    activeAnimationTimers.clear()
    // Отменяем анимацию чисел на всех карточках

    const root = canvasContainerRef.value || document

    const animatingValues = root.querySelectorAll('.value--animating')

    console.log('🔢 Отмена анимации чисел, найдено элементов:', animatingValues.length)

    animatingValues.forEach(element => {
      element.classList.remove('value--animating')
    })

    console.log('✅ Все анимации отменены (линии и числа)')
  }

  /**
   * Подсветка изменения Active PV
   */
  const highlightActivePvChange = (cardId) => {
    if (!cardId) {
      return
    }
    const cardElement = getCardElement(cardId)
    if (cardElement) {
      cardElement.classList.add('card--balance-highlight')
      window.setTimeout(() => {
        cardElement.classList.remove('card--balance-highlight')
      }, ACTIVE_PV_FLASH_MS)
    }

    const relatedConnections = connections.value.filter(connection => connection.from === cardId || connection.to === cardId)
    relatedConnections.forEach(connection => {
      const lineElement = getConnectionElement(connection.id)
      if (!lineElement) {
        return
      }
      lineElement.classList.add('line--balance-flash')
      window.setTimeout(() => {
        lineElement.classList.remove('line--balance-flash')
      }, ACTIVE_PV_FLASH_MS)
    })
  }

  /**
   * Анимация распространения баланса вверх по структуре
   */
  const animateBalancePropagation = (changedCardId, changedSide = null) => {
    if (!changedCardId) {
      return
    }

    // Получаем длительность анимации из настроек
    const animationDuration = viewSettingsStore.animationDurationMs || 2000

    console.log('🎨 Запуск анимации баланса для карточки:', changedCardId, 'длительность:', animationDuration)

    // Инициализируем хранилище таймеров для этой карточки
    const timers = {
      cardTimer: null,
      lineTimers: []
    }

    // Показываем желтый индикатор на измененной карточке через CSS-класс
    const cardElement = getCardElement(changedCardId)
    if (cardElement) {
      console.log('✅ Карточка найдена, добавляем класс card--balance-propagation')
      cardElement.classList.add('card--balance-propagation')
      const cardTimer = window.setTimeout(() => {
        cardElement.classList.remove('card--balance-propagation')
      }, animationDuration)
      timers.cardTimer = cardTimer
    } else {
      console.warn('❌ Карточка не найдена:', changedCardId)
    }

    // Находим путь вверх по структуре
    const meta = cardsStore.calculationMeta || {}
    const parentOf = meta.parentOf || {}

    console.log('📊 Метаданные parentOf:', parentOf)

    const pathUp = []
    let currentId = changedCardId

    // Строим путь от текущей карточки до корня
    while (parentOf[currentId]) {
      const relation = parentOf[currentId]
      const parentId = relation.parentId
      const side = relation.side

      console.log(`🔗 Связь найдена: ${currentId} -> ${parentId} (сторона: ${side})`)
      if (!parentId) break

      // Находим линию между текущей карточкой и родителем
      const connection = connections.value.find(conn =>
        (conn.from === currentId && conn.to === parentId) ||
        (conn.from === parentId && conn.to === currentId)
      )

      if (connection) {
        console.log(`✅ Соединение найдено: ${connection.id}`)
        pathUp.push({ connectionId: connection.id, side })
      } else {
        console.warn(`❌ Соединение НЕ найдено между ${currentId} и ${parentId}`)
      }
      currentId = parentId
    }

    console.log('📍 Путь вверх построен, найдено линий:', pathUp.length)

    // Применяем анимацию к линиям вверх по структуре
    pathUp.forEach(({ connectionId }, index) => {
      const lineElement = getConnectionElement(connectionId)
      console.log(`Линия ${index + 1}/${pathUp.length}:`, connectionId, '→ элемент найден:', !!lineElement)

      if (!lineElement) return
      lineElement.classList.add('line--balance-propagation')
      console.log('✅ Класс line--balance-propagation добавлен к линии:', connectionId)
      const lineTimer = window.setTimeout(() => {
        lineElement.classList.remove('line--balance-propagation')
      }, animationDuration)
      timers.lineTimers.push({ timer: lineTimer, lineElement })
    })

    // Сохраняем таймеры в глобальном хранилище
    activeAnimationTimers.set(changedCardId, timers)
  }

  /**
   * Применение распространения Active PV
   */
  const applyActivePvPropagation = (highlightCardId = null, propagationOptions = {}) => {
    if (!Array.isArray(cardsStore.cards) || cardsStore.cards.length === 0) {
      return
    }

    const propagation = propagateActivePvUp(cardsStore.cards, cardsStore.calculationMeta || {})
    const datasetPayload = {}
    const cardsWithBalanceChanges = [] // Карточки с изменениями баланса для анимации

    Object.entries(propagation).forEach(([cardId, data]) => {
      const card = cardsStore.cards.find(item => item.id === cardId)
      if (!card) {
        return
      }

      const manualLeft = Math.max(0, Number(data?.manual?.left ?? 0))
      const manualRight = Math.max(0, Number(data?.manual?.right ?? 0))
      const manualTotal = manualLeft + manualRight

      const remainderLeft = Math.max(0, Number(data?.remainder?.left ?? 0))
      const remainderRight = Math.max(0, Number(data?.remainder?.right ?? 0))
      const localBalanceLeft = Math.max(0, Number(data?.localBalance?.left ?? 0))
      const localBalanceRight = Math.max(0, Number(data?.localBalance?.right ?? 0))

      const unitsLeft = Math.max(0, Number(data?.units?.left ?? 0))
      const unitsRight = Math.max(0, Number(data?.units?.right ?? 0))
      const unitsTotal = unitsLeft + unitsRight
      const balanceLeft = Math.max(0, Number(data?.balance?.left ?? remainderLeft))
      const balanceRight = Math.max(0, Number(data?.balance?.right ?? remainderRight))
      const packs = Math.max(0, Number(data?.activePacks ?? 0))
      const cycles = Math.max(0, Number(data?.cycles ?? 0))

      const formattedRemainder = `${remainderLeft} / ${remainderRight}`

      const updates = {}

      if (!card.activePvManual
        || card.activePvManual.left !== manualLeft
        || card.activePvManual.right !== manualRight
        || card.activePvManual.total !== manualTotal) {
        updates.activePvManual = { left: manualLeft, right: manualRight, total: manualTotal }
      }

      if (!card.activePvLocal
        || card.activePvLocal.left !== manualLeft
        || card.activePvLocal.right !== manualRight
        || card.activePvLocal.total !== manualTotal) {
        updates.activePvLocal = { left: manualLeft, right: manualRight, total: manualTotal }
      }

      if (!card.activePvAggregated
        || card.activePvAggregated.left !== unitsLeft
        || card.activePvAggregated.right !== unitsRight
        || card.activePvAggregated.total !== unitsTotal
        || card.activePvAggregated.remainderLeft !== remainderLeft
        || card.activePvAggregated.remainderRight !== remainderRight) {
        updates.activePvAggregated = {
          left: unitsLeft,
          right: unitsRight,
          total: unitsTotal,
          remainderLeft,
          remainderRight
        }
      }
      if (!card.activePvLocalBalance
        || card.activePvLocalBalance.left !== localBalanceLeft
        || card.activePvLocalBalance.right !== localBalanceRight
        || card.activePvLocalBalance.total !== localBalanceLeft + localBalanceRight) {
        updates.activePvLocalBalance = {
          left: localBalanceLeft,
          right: localBalanceRight,
          total: localBalanceLeft + localBalanceRight
        }
      }

      if (card.activePv !== formattedRemainder) {
        updates.activePv = formattedRemainder
      }
      if (!card.activePvBalance
        || card.activePvBalance.left !== balanceLeft
        || card.activePvBalance.right !== balanceRight) {
        updates.activePvBalance = { left: balanceLeft, right: balanceRight }

        console.log(`💰 Изменение баланса для карточки ${cardId}:`, {
          oldLeft: card.activePvBalance?.left ?? 0,
          newLeft: balanceLeft,
          oldRight: card.activePvBalance?.right ?? 0,
          newRight: balanceRight,
          triggerAnimation: propagationOptions.triggerAnimation
        })

        // Запоминаем карточки с изменениями баланса для анимации
        if (propagationOptions.triggerAnimation) {
          const changedSide = balanceLeft !== (card.activePvBalance?.left ?? 0) ? 'left' :
                             balanceRight !== (card.activePvBalance?.right ?? 0) ? 'right' : null

          console.log(`  ➡️ Добавляем в массив анимации: cardId=${cardId}, side=${changedSide}`)
          cardsWithBalanceChanges.push({ cardId, side: changedSide })
        }
      }

      if (!Number.isFinite(card.activePvPacks) || card.activePvPacks !== packs) {
        updates.activePvPacks = packs
      }

      if (!Number.isFinite(card.activePvCycles) || card.activePvCycles !== cycles) {
        updates.activePvCycles = cycles
      }
      if (Object.keys(updates).length > 0) {
        cardsStore.updateCard(cardId, updates, { saveToHistory: false })
      }

      datasetPayload[cardId] = {
        manual: { left: manualLeft, right: manualRight },
        units: { left: unitsLeft, right: unitsRight },
        remainder: { left: remainderLeft, right: remainderRight }
      }
    })

    updateActivePvDatasets(datasetPayload)

    if (propagationOptions.saveHistory) {
      const actionDescription = propagationOptions.historyDescription || 'Изменены бонусы Active-PV'
      historyStore.setActionMetadata('update', actionDescription)
      historyStore.saveState()
    }

    if (highlightCardId) {
      highlightActivePvChange(highlightCardId)
    }

    console.log('🔍 Проверка запуска анимации:')
    console.log('  - propagationOptions.triggerAnimation:', propagationOptions.triggerAnimation)
    console.log('  - cardsWithBalanceChanges.length:', cardsWithBalanceChanges.length)
    console.log('  - cardsWithBalanceChanges:', cardsWithBalanceChanges)

    // Запускаем анимацию для карточек с изменениями баланса при автоматических расчетах
    if (propagationOptions.triggerAnimation && cardsWithBalanceChanges.length > 0) {
      console.log('✅ Запускаем анимацию для', cardsWithBalanceChanges.length, 'карточек')
      cardsWithBalanceChanges.forEach(({ cardId, side }) => {
        animateBalancePropagation(cardId, side)
      })
    } else {
      console.warn('❌ Анимация НЕ запускается. Причина:')
      if (!propagationOptions.triggerAnimation) console.warn('   - triggerAnimation = false')
      if (cardsWithBalanceChanges.length === 0) console.warn('   - нет карточек с изменениями баланса')
    }
  }

  /**
   * Обработчик клика по кнопкам Active PV
   */
  const handleActivePvButtonClick = (event) => {
    const button = event.target.closest('.active-pv-btn')
    if (!button) {
      return
    }

    const cardElement = button.closest('[data-card-id]')
    if (!cardElement) {
      return
    }

    event.preventDefault()
    event.stopPropagation()

    const cardId = cardElement.dataset.cardId
    const card = cardsStore.cards.find(item => item.id === cardId)

    if (!cardId || !card) {
      return
    }
    const meta = cardsStore.calculationMeta || {}
    let result

    const action = button.dataset.action || 'delta'
    let shouldAnimate = false // Флаг для определения, нужна ли анимация

    if (action === 'clear-all') {
      result = applyActivePvClear({ cards: cardsStore.cards, meta, cardId })
      shouldAnimate = false // Не анимируем при очистке (корзина)
    } else {
      const direction = button.dataset.dir === 'right' ? 'right' : 'left'
      let step = Number(button.dataset.step)

      if (!Number.isFinite(step) || step === 0) {
        return
      }

      if (step < 0) {
        const hiddenElement = cardElement.querySelector('.active-pv-hidden')
        const remainderKey = direction === 'right' ? 'remainderr' : 'remainderl'
        const parsedRemainder = Number(hiddenElement?.dataset?.[remainderKey])
        const remainder = Number.isFinite(parsedRemainder) ? parsedRemainder : 0

        if (-step > remainder) {
          step = -remainder
        }

        if (step === 0) {
          return
        }
        shouldAnimate = false // Не анимируем при уменьшении (-1, -10)
      } else {
        shouldAnimate = true // Анимируем только при увеличении (+1, +10)
      }

      result = applyActivePvDelta({
        cards: cardsStore.cards,
        meta,
        cardId,
        side: direction,
        delta: step
      })
    }

    const updates = result?.updates || {}
    const changedIds = result?.changedIds || []

    const updateEntries = Object.entries(updates)

    console.log('📦 Результат applyActivePvDelta:', {
      updatesCount: updateEntries.length,
      changedIds,
      cardId,
      shouldAnimate
    })

    if (updateEntries.length === 0) {
      return
    }

    updateEntries.forEach(([id, payload]) => {
      cardsStore.updateCard(id, payload, { saveToHistory: false })
    })

    const description = card?.text
      ? `Active-PV обновлены для "${card.text}"`
      : 'Изменены бонусы Active-PV'

    // Запускаем анимацию ТОЛЬКО если значения увеличились (shouldAnimate === true)
    if (shouldAnimate && changedIds.length > 0) {
      console.log('🎯 Запуск анимации для changedIds:', changedIds)
      // Отменяем все предыдущие анимации перед запуском новых
      cancelAllActiveAnimations()

      changedIds.forEach(id => {
        animateBalancePropagation(id)
      })
    } else {
      console.log('❌ Анимация НЕ запускается (уменьшение или очистка)')
    }

    applyActivePvPropagation(cardId, { saveHistory: true, historyDescription: description, triggerAnimation: false })
  }

  return {
    // Константы
    ACTIVE_PV_FLASH_MS,

    // State
    activeAnimationTimers,

    // Методы
    updateActivePvDatasets,
    cancelAllActiveAnimations,
    highlightActivePvChange,
    animateBalancePropagation,
    applyActivePvPropagation,
    handleActivePvButtonClick
  }
}
