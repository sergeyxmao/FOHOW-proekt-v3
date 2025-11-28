import { defineStore } from 'pinia'
import { useConnectionsStore } from './connections'
import { useHistoryStore } from './history'
import { useBoardStore } from './board'
import { useAuthStore } from './auth'
import { useNotesStore } from './notes'
import { getHeaderColorRgb } from '../utils/constants'
import {
  createDefaultNoteState,
  ensureNoteStructure,
  hasAnyEntry,
  normalizeNoteForExport,
  normalizeYMD
} from '../utils/noteUtils'
const COIN_FULL_COLOR = '#ffd700'
const COIN_EMPTY_COLOR = '#3d85c6'
const CANVAS_SAFE_MARGIN = 32
const API_URL = import.meta.env.VITE_API_URL || 'https://interactive.marketingfohow.ru/api'

function parseCanvasTransform(transformValue) {
  if (!transformValue || transformValue === 'none') {
    return { scale: 1, translateX: 0, translateY: 0 }
  }

  if (typeof DOMMatrixReadOnly === 'function') {
    try {
      const matrix = new DOMMatrixReadOnly(transformValue)
      const scaleX = Number.isFinite(matrix.a) ? matrix.a : 1
      const scaleY = Number.isFinite(matrix.d) ? matrix.d : 1
      const translateX = Number.isFinite(matrix.m41) ? matrix.m41 : 0
      const translateY = Number.isFinite(matrix.m42) ? matrix.m42 : 0
      const scale = scaleX || scaleY || 1

      return { scale: scale || 1, translateX, translateY }
    } catch (error) {
      // Игнорируем и пробуем разобрать строку вручную
    }
  }

  const matrixMatch = transformValue.match(/^matrix\(([^)]+)\)$/)
  if (matrixMatch) {
    const parts = matrixMatch[1].split(',').map(part => Number(part.trim()))
    if (parts.length >= 6) {
      const [a, , , d, e, f] = parts
      const scale = a || d || 1
      return {
        scale: scale || 1,
        translateX: Number.isFinite(e) ? e : 0,
        translateY: Number.isFinite(f) ? f : 0
      }
    }
  }

  const translateMatch = transformValue.match(/translate\(\s*([-0-9.]+)px(?:,\s*([-0-9.]+)px)?\s*\)/)
  const scaleMatch = transformValue.match(/scale\(\s*([-0-9.]+)\s*\)/)

  return {
    scale: scaleMatch ? Number(scaleMatch[1]) || 1 : 1,
    translateX: translateMatch ? Number(translateMatch[1]) || 0 : 0,
    translateY: translateMatch ? Number(translateMatch[2]) || 0 : 0
  }
}

function getViewportAnchoredPosition(cardWidth = 0, cardHeight = 0) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return null
  }

  const container = document.querySelector('.canvas-container')
  const content = container?.querySelector('.canvas-content')

  if (!container || !content) {
    return null
  }

  const { height } = container.getBoundingClientRect()
  const transformValue = content.style.transform || window.getComputedStyle(content).transform
  const { scale, translateX, translateY } = parseCanvasTransform(transformValue)

  const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1
  const safeTranslateX = Number.isFinite(translateX) ? translateX : 0
  const safeTranslateY = Number.isFinite(translateY) ? translateY : 0

  const viewportX = CANVAS_SAFE_MARGIN
  const viewportY = height - CANVAS_SAFE_MARGIN

  const canvasX = (viewportX - safeTranslateX) / safeScale
  const canvasY = (viewportY - safeTranslateY) / safeScale - cardHeight

  return {
    x: Math.max(0, Math.round(canvasX)),
    y: Math.max(0, Math.round(canvasY))
  }
}
const DEFAULT_CALCULATION = Object.freeze({
  L: 0,
  R: 0,
  total: 0,
  cycles: 0,
  stage: 0,
  toNext: 0
})

function toFiniteNumber(value) {
  return Number.isFinite(value) ? value : 0
}

function normalizeCalculation(source = {}) {
  return {
    L: toFiniteNumber(source.L),
    R: toFiniteNumber(source.R),
    total: toFiniteNumber(source.total),
    cycles: toFiniteNumber(source.cycles),
    stage: toFiniteNumber(source.stage),
    toNext: toFiniteNumber(source.toNext)
  }
}

function formatBalance(calculation) {
  return `${calculation.L} / ${calculation.R}`
}

function cloneMeta(meta = {}) {
  const childrenEntries = Object.entries(meta.children || {})
  const normalizedChildren = childrenEntries.reduce((acc, [parentId, sides]) => {
    acc[parentId] = {
      left: Array.from(sides?.left ?? []),
      right: Array.from(sides?.right ?? [])
    }
    return acc
  }, {})

  return {
    parentOf: { ...(meta.parentOf || {}) },
    children: normalizedChildren,
    pv: { ...(meta.pv || {}) },
    isFull: { ...(meta.isFull || {}) }
  }
}

function createEmptyMeta() {
  return cloneMeta({})
}

function applyCalculationDefaults(card) {
  const calculation = normalizeCalculation(DEFAULT_CALCULATION)
  card.calculated = calculation
  card.balance = formatBalance(calculation)
  card.total = calculation.total
  card.cycle = String(calculation.cycles)
  card.stage = calculation.stage
  card.toNext = calculation.toNext
  card.coinFill = typeof card.coinFill === 'string' ? card.coinFill : COIN_EMPTY_COLOR
  card.calculatedIsFull = false
}

function updateCardCalculation(card, calculationSource, isFullFlag, options = {}) {
  if (!card) {
    return false
  }

  const calculation = normalizeCalculation(calculationSource)
  const balanceText = formatBalance(calculation)
  const cycleText = String(calculation.cycles)
  const { preserveCoin = false } = options

  const previous = card.calculated || DEFAULT_CALCULATION
  const hasCalculationChanges = ['L', 'R', 'total', 'cycles', 'stage', 'toNext']
    .some(key => previous[key] !== calculation[key])

  if (hasCalculationChanges) {
    card.calculated = calculation
  } else if (!card.calculated) {
    card.calculated = calculation
  }

  let changed = hasCalculationChanges

  if (card.balance !== balanceText) {
    card.balance = balanceText
    changed = true
  }

  if (card.total !== calculation.total) {
    card.total = calculation.total
    changed = true
  }

  if (card.cycle !== cycleText) {
    card.cycle = cycleText
    changed = true
  }

  if (card.stage !== calculation.stage) {
    card.stage = calculation.stage
    changed = true
  }

  if (card.toNext !== calculation.toNext) {
    card.toNext = calculation.toNext
    changed = true
  }

  const desiredCoinFill = isFullFlag ? COIN_FULL_COLOR : COIN_EMPTY_COLOR
  if (!preserveCoin || typeof card.coinFill !== 'string') {
    if (card.coinFill !== desiredCoinFill) {
      card.coinFill = desiredCoinFill
      changed = true
    }
  }

  card.calculatedIsFull = Boolean(isFullFlag)

  return changed
}

const GOLD_BODY_GRADIENT = 'linear-gradient(135deg, #fff6d1 0%, #ffd700 45%, #fff2a8 100%)'

export const useCardsStore = defineStore('cards', {
  state: () => ({
    cards: [],
    selectedCardIds: [],
    calculationMeta: createEmptyMeta(),
    incompatibilityWarning: {
      visible: false,
      type: null
    }
  }),
  
  getters: {
    selectedCards: (state) => {
      return state.cards.filter(card => card.selected)
    },
    
    hasSelectedCards: (state) => {
      return state.selectedCards.length > 0
    },

    cardsWithNotes: (state) => {
      return state.cards.filter(card => hasAnyEntry(card.note))      
    }
  },
  
  actions: {
    applyCalculationResults(payload = {}) {
      const { result = {}, meta = {} } = payload
      const normalizedMeta = cloneMeta(meta)

      this.calculationMeta = normalizedMeta

      this.cards.forEach(card => {
        const calculation = result?.[card.id] ?? DEFAULT_CALCULATION
        const isFull = Boolean(normalizedMeta.isFull?.[card.id])
        updateCardCalculation(card, calculation, isFull)
      })
    },

    resetCalculationResults() {
      this.calculationMeta = createEmptyMeta()
      this.cards.forEach(card => {
        updateCardCalculation(card, DEFAULT_CALCULATION, false)
      })
    },
    
    updateCard(cardId, updates = {}, options = {}) {
      const card = this.cards.find(c => c.id === cardId)
      if (!card) {
        return null
      }

      const normalizedUpdates = { ...updates }
      
      if (Object.prototype.hasOwnProperty.call(normalizedUpdates, 'note')) {
        card.note = ensureNoteStructure(normalizedUpdates.note)
        delete normalizedUpdates.note
      }

      Object.assign(card, normalizedUpdates)

      const { saveToHistory = true, description } = options

      if (saveToHistory) {
        const historyStore = useHistoryStore()
        const actionDescription = description || `Обновлена карточка "${card.text}"`
        historyStore.setActionMetadata('update', actionDescription)
        historyStore.saveState()
      }

      return card
    },
    
    removeCardNoteEntry(cardId, date) {
      const card = this.cards.find(c => c.id === cardId)
      if (!card) {
        return false
      }

      const note = ensureNoteStructure(card.note)
      const normalizedDate = normalizeYMD(date)

      if (!normalizedDate) {
        return false
      }

      const hasEntry = Boolean(note.entries?.[normalizedDate]?.text?.trim())
      const hasColor = Boolean(note.colors?.[normalizedDate])

      if (!hasEntry && !hasColor) {
        return false
      }

      if (note.entries && Object.prototype.hasOwnProperty.call(note.entries, normalizedDate)) {
        delete note.entries[normalizedDate]
      }

      if (note.colors && Object.prototype.hasOwnProperty.call(note.colors, normalizedDate)) {
        delete note.colors[normalizedDate]
      }

      const historyStore = useHistoryStore()
      historyStore.setActionMetadata('update', `Удалена заметка ${normalizedDate} для карточки "${card.text}"`)
      historyStore.saveState()

      return true
    },

    clearCardNotes(cardId) {
      const card = this.cards.find(c => c.id === cardId)
      if (!card) {
        return false
      }

      const note = ensureNoteStructure(card.note)
      const hadEntries = hasAnyEntry(note)
      const hadColors = note.colors && Object.keys(note.colors).length > 0

      if (!hadEntries && !hadColors) {
        return false
      }

      note.entries = {}
      note.colors = {}

      const historyStore = useHistoryStore()
      historyStore.setActionMetadata('update', `Удалены все заметки для карточки "${card.text}"`)
      historyStore.saveState()

      return true
    },
    addCard(options = {}) {
      const { type = 'large', ...rawCardData } = options;
      if (['small', 'large', 'gold'].includes(type)) {
        const hasAvatars = this.cards.some(card => card.type === 'avatar')

        if (hasAvatars) {
          this.showIncompatibilityWarning('license')
          return false
        }
      }      
      const hasCustomX = Object.prototype.hasOwnProperty.call(rawCardData, 'x')
      const hasCustomY = Object.prototype.hasOwnProperty.call(rawCardData, 'y')
      const { x: providedX, y: providedY, ...cardData } = rawCardData

      // Пресеты для разных типов лицензий
      const presets = {
        large: {
          width: 543.4,
          height: 364,
          pv: '30/330pv',
          text: 'RUY68123456789',
          historyText: 'Создана большая лицензия'
        },
        small: {
          width: 418,
          height: 280,
          pv: '30/330pv',
          text: 'Малая лицензия',
          historyText: 'Создана малая лицензия'
           },
        gold: {
          width: 543.4,
          height: 364,
          pv: '30/330pv',
          text: 'RUY68123456789',
          historyText: 'Создана золотая лицензия',
          headerBg: '#d4af37',
          colorIndex: -1,
          bodyGradient: GOLD_BODY_GRADIENT,
          fill: '#fffdf2'
        }
      };

      const preset = presets[type] || presets.large;
            const widthCandidate = Number(cardData.width ?? preset.width ?? 0)
      const heightCandidate = Number(cardData.height ?? preset.height ?? 0)
      const fallbackWidth = Number(preset.width)
      const fallbackHeight = Number(preset.height)
      const widthForPlacement = Number.isFinite(widthCandidate) && widthCandidate > 0
        ? widthCandidate
        : (Number.isFinite(fallbackWidth) && fallbackWidth > 0 ? fallbackWidth : 0)
      const heightForPlacement = Number.isFinite(heightCandidate) && heightCandidate > 0
        ? heightCandidate
        : (Number.isFinite(fallbackHeight) && fallbackHeight > 0 ? fallbackHeight : 0)
      const viewportPosition = getViewportAnchoredPosition(widthForPlacement, heightForPlacement)
      const defaultX = viewportPosition?.x ?? 320
      const defaultY = viewportPosition?.y ?? 160
      const normalizedX = hasCustomX ? providedX : defaultX
      const normalizedY = hasCustomY ? providedY : defaultY

      const newCard = {
        // Базовые свойства
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        // Размещаем новую лицензию в левом нижнем секторе видимой области
        x: normalizedX,
        y: normalizedY,
        fill: '#ffffff',
        stroke: '#000000',
        strokeWidth: 2,
        headerBg: getHeaderColorRgb(0),
        colorIndex: 0,
        selected: false,

        // Свойства из пресета
        ...preset,

        // Новые поля для лицензий (переопределяем из пресета, если нужно)
        balance: '0 / 0',
        activePv: '0 / 0',
        cycle: '0',
        coinFill: COIN_EMPTY_COLOR,
        previousPvLeft: 330,

        // Значки
        showSlfBadge: false,
        showFendouBadge: false,
        rankBadge: null,

        // Дополнительные свойства
        bodyHTML: '',
        bodyGradient: preset.bodyGradient || '',
        type,
        note: createDefaultNoteState(),
        // Переданные вручную свойства (например, x, y) имеют наивысший приоритет
        ...cardData
      };
      applyCalculationDefaults(newCard)
      
      this.cards.push(newCard);
      
      const historyStore = useHistoryStore();
      historyStore.setActionMetadata('create', `${preset.historyText} "${newCard.text}"`);
      historyStore.saveState();
      
      return newCard;
    },

    addAvatar(options = {}) {
         const hasLicenses = this.cards.some(card =>
        ['small', 'large', 'gold'].includes(card.type)
      )

      if (hasLicenses) {
        this.showIncompatibilityWarning('avatar')
        return false
      }   
      const { ...avatarData } = options
      const hasCustomX = Object.prototype.hasOwnProperty.call(avatarData, 'x')
      const hasCustomY = Object.prototype.hasOwnProperty.call(avatarData, 'y')
      const { x: providedX, y: providedY, ...restData } = avatarData

      // Базовый диаметр = ширина малой лицензии
      const baseDiameter = 418
      const size = avatarData.size || 100
      const diameter = (baseDiameter * size) / 100

      // Позиционирование в центре видимой области
      const viewportPosition = getViewportAnchoredPosition(diameter, diameter)
      const defaultX = viewportPosition?.x ?? 320
      const defaultY = viewportPosition?.y ?? 160
      const normalizedX = hasCustomX ? providedX : defaultX
      const normalizedY = hasCustomY ? providedY : defaultY

      const newAvatar = {
        id: 'avatar_' + Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9),
        type: 'avatar',
        x: normalizedX,
        y: normalizedY,
        size: size,
        diameter: diameter,
        personalId: '',
        userId: null,
        avatarUrl: '/Avatar.png',
        username: '',
        stroke: '#5D8BF4',
        strokeWidth: 3,
        selected: false,
        created_at: new Date().toISOString(),
        ...restData
      }

      this.cards.push(newAvatar)

      const historyStore = useHistoryStore()
      historyStore.setActionMetadata('create', 'Добавлен Аватар')
      historyStore.saveState()

      return newAvatar
    },

async removeCard(cardId) {
      const connectionsStore = useConnectionsStore()
      const boardStore = useBoardStore()
      const authStore = useAuthStore()
      const notesStore = useNotesStore()

      const card = this.cards.find(c => c.id === cardId)
      if (!card) return false

      // Удаляем заметки на сервере перед удалением карточки
      if (boardStore.currentBoardId && authStore.isAuthenticated && authStore.token) {
        try {
          const response = await fetch(
            `${API_URL}/boards/${boardStore.currentBoardId}/cards/${cardId}/notes`,
            {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${authStore.token}`,
                'Content-Type': 'application/json'
              }
            }
          )

          if (!response.ok) {
            console.error('Ошибка при удалении заметок карточки:', await response.text())
          } else {
            // Очищаем заметки из локального состояния
            notesStore.clearNotesForCard(cardId)
          }
        } catch (error) {
          console.error('Ошибка сети при удалении заметок:', error)
        }
      }

      const historyStore = useHistoryStore()
      // Устанавливаем метаданные до всех изменений
      historyStore.setActionMetadata('delete', `Удалена карточка "${card.text}"`)

      // Выполняем мутации состояния без сохранения в историю
      connectionsStore.removeConnectionsByCardId(cardId, { saveToHistory: false })

      const index = this.cards.findIndex(c => c.id === cardId)
      if (index !== -1) {
        this.cards.splice(index, 1)

        // Теперь сохраняем итоговое состояние в историю один раз
        historyStore.saveState()
        return true
      }

      return false
    },
    
updateCardPosition(cardId, x, y, options = { saveToHistory: true }) {
      const card = this.cards.find(c => c.id === cardId)
      if (card) {
        card.x = x
        card.y = y
        
        if (options.saveToHistory) {
          const historyStore = useHistoryStore()
          historyStore.setActionMetadata('update', `Перемещена карточка "${card.text}"`)
          historyStore.saveState()
        }
      }
      return card
    },
    
    updateCardHeaderColor(cardIds, colorIndex, customColor) {
      const updatedCards = []
      const isPaletteIndex = Number.isInteger(colorIndex) && colorIndex >= 0
      const headerBg = isPaletteIndex
        ? getHeaderColorRgb(colorIndex)
        : customColor || getHeaderColorRgb(0)
      const appliedIndex = isPaletteIndex ? colorIndex : -1   
      cardIds.forEach(cardId => {
        const card = this.cards.find(c => c.id === cardId)
        if (card) {
          card.headerBg = headerBg
          card.colorIndex = appliedIndex
          updatedCards.push(card)
        }
      })
      
      if (updatedCards.length > 0) {
        const historyStore = useHistoryStore()
        const description = updatedCards.length === 1
          ? `Изменен цвет заголовка карточки "${updatedCards[0].text}"`
          : `Изменен цвет заголовка у ${updatedCards.length} карточек`
        historyStore.setActionMetadata('update', description)
        historyStore.saveState()
      }
      
      return updatedCards
    },
    
    selectCard(cardId) {
      const card = this.cards.find(c => c.id === cardId)
      if (card && !card.selected) {
        card.selected = true
        this.selectedCardIds.push(cardId)
      }
    },
    
    deselectCard(cardId) {
      const card = this.cards.find(c => c.id === cardId)
      if (card && card.selected) {
        card.selected = false
        const index = this.selectedCardIds.indexOf(cardId)
        if (index > -1) {
          this.selectedCardIds.splice(index, 1)
        }
      }
    },
    
    toggleCardSelection(cardId) {
      const card = this.cards.find(c => c.id === cardId)
      if (card) {
        if (card.selected) {
          this.deselectCard(cardId)
        } else {
          this.selectCard(cardId)
        }
      }
    },
    
    deselectAllCards() {
      this.cards.forEach(card => {
        card.selected = false
      })
      this.selectedCardIds = []
    },
    
    selectAllCards() {
      this.cards.forEach(card => {
        card.selected = true
      })
      this.selectedCardIds = this.cards.map(card => card.id)
    },
    
    loadCards(cardsData) {
      this.cards = []
      this.selectedCardIds = []
      this.calculationMeta = createEmptyMeta()

      const typeDefaults = {
        large: { width: 543.4, height: 364 },
        gold: { width: 543.4, height: 364 },
        small: { width: 418, height: 280 }
      }
      cardsData.forEach(cardData => {
        // Если это аватар, обрабатываем его отдельно
        if (cardData.type === 'avatar') {
          const size = Number.isFinite(cardData.size) ? cardData.size : 100
          const diameter = Number.isFinite(cardData.diameter) ? cardData.diameter : (418 * size / 100)

          const normalizedAvatar = {
            id: cardData.id || 'avatar_' + Date.now().toString(),
            type: 'avatar',
            x: Number.isFinite(cardData.x) ? cardData.x : 0,
            y: Number.isFinite(cardData.y) ? cardData.y : 0,
            size: size,
            diameter: diameter,
            personalId: cardData.personalId || '',
            userId: cardData.userId || null,
            avatarUrl: cardData.avatarUrl || '/Avatar.png',
            username: cardData.username || '',
            stroke: cardData.stroke || '#5D8BF4',
            strokeWidth: Number.isFinite(cardData.strokeWidth) ? cardData.strokeWidth : 3,
            selected: false,
            created_at: cardData.created_at || new Date().toISOString()
          }

          this.cards.push(normalizedAvatar)
          return
        }

        // Обработка обычных карточек (лицензий)
        const detectedType = cardData.type
          || ((cardData.width && cardData.width >= 543.4) || (cardData.height && cardData.height >= 364)
            ? 'large'
            : 'small')

        const defaults = typeDefaults[detectedType] || typeDefaults.large

        const width = Number.isFinite(cardData.width) ? cardData.width : defaults.width
        const height = Number.isFinite(cardData.height) ? cardData.height : defaults.height

        const headerBg = cardData.headerBg
          || (detectedType === 'gold' ? '#d4af37' : getHeaderColorRgb(0))

        const colorIndex = Number.isFinite(cardData.colorIndex)
          ? cardData.colorIndex
          : (detectedType === 'gold' ? -1 : 0)


        const noteState = ensureNoteStructure(cardData.note);

        const normalizedCard = {
          id: cardData.id || Date.now().toString(),
          x: Number.isFinite(cardData.x) ? cardData.x : 0,
          y: Number.isFinite(cardData.y) ? cardData.y : 0,
          text: cardData.text || 'RUY68123456789',
          width,
          height,
          fill: cardData.fill || '#ffffff',
          stroke: cardData.stroke || '#000000',
          strokeWidth: Number.isFinite(cardData.strokeWidth) ? cardData.strokeWidth : 2,
          headerBg,
          colorIndex,
          selected: false,
          pv: cardData.pv || '330/330pv',
          balance: typeof cardData.balance === 'string' ? cardData.balance : '0 / 0',
          activePv: cardData.activePv || '0 / 0',
          cycle: typeof cardData.cycle === 'string' ? cardData.cycle : '0',
          coinFill: typeof cardData.coinFill === 'string' ? cardData.coinFill : COIN_EMPTY_COLOR,
          previousPvLeft: Number.isFinite(cardData.previousPvLeft) ? cardData.previousPvLeft : 330,
          total: toFiniteNumber(cardData.total),
          stage: toFiniteNumber(cardData.stage),
          toNext: toFiniteNumber(cardData.toNext),
          showSlfBadge: Boolean(cardData.showSlfBadge),
          showFendouBadge: Boolean(cardData.showFendouBadge),
          rankBadge: cardData.rankBadge || null,
          bodyHTML: cardData.bodyHTML || '',
          bodyGradient: cardData.bodyGradient || (detectedType === 'gold' ? GOLD_BODY_GRADIENT : ''),
          type: detectedType,
          note: noteState
        };
        const calculationSource = {
          L: toFiniteNumber(cardData.calculated?.L),
          R: toFiniteNumber(cardData.calculated?.R),
          total: toFiniteNumber(cardData.calculated?.total ?? cardData.total),
          cycles: toFiniteNumber(cardData.calculated?.cycles ?? (
            typeof cardData.cycle === 'string' ? Number.parseInt(cardData.cycle, 10) : cardData.cycles
          )),
          stage: toFiniteNumber(cardData.calculated?.stage ?? cardData.stage),
          toNext: toFiniteNumber(cardData.calculated?.toNext ?? cardData.toNext)
        }
        const initialIsFull = typeof cardData.calculated?.isFull === 'boolean'
          ? cardData.calculated.isFull
          : Boolean(cardData.isFull)

        updateCardCalculation(normalizedCard, calculationSource, initialIsFull, { preserveCoin: true })

        this.cards.push(normalizedCard)
      })
    },

    getCardsForExport() {
      return this.cards.map(card => {
        const serializedNote = normalizeNoteForExport(card.note)
        return {
          ...card,
          note: serializedNote
        }
      })
    },

    highlightCard(cardId) {
      const card = this.cards.find(c => c.id === cardId)
      if (!card) {
        return false
      }

      // Устанавливаем флаг подсветки
      card.highlighted = true

      // Через 2 секунды снимаем подсветку
      setTimeout(() => {
        card.highlighted = false
      }, 2000)

      return true
    },
    highlightAvatar(avatarId) {
      const avatar = this.cards.find(c => c.id === avatarId && c.type === 'avatar')
      if (!avatar) {
        return false
      }

      avatar.highlighted = true

      setTimeout(() => {
        avatar.highlighted = false
      }, 2000)

      return true
    },
    resizeAvatar(avatarId, sizePercent) {
      const avatar = this.cards.find(c => c.id === avatarId)
      if (!avatar || avatar.type !== 'avatar') {
        return false
      }

      // Проверяем корректность размера
      const validSizes = [25, 50, 75, 100, 125, 150, 175, 200]
      if (!validSizes.includes(sizePercent)) {
        console.error('Некорректный размер. Допустимые значения: 25, 50, 75, 100, 125, 150, 175, 200')
        return false
      }

      // Базовый диаметр (100%)
      const BASE_DIAMETER = 418
      const newDiameter = BASE_DIAMETER * (sizePercent / 100)

      // Обновляем размер и диаметр
      avatar.size = sizePercent
      avatar.diameter = newDiameter

      // Записываем в историю
      const historyStore = useHistoryStore()
      historyStore.setActionMetadata('update', `Изменён размер Аватара на ${sizePercent}%`)
      historyStore.saveState()

      return true
    },

    updateAvatarUserData(avatarId, userData) {
      const avatar = this.cards.find(c => c.id === avatarId && c.type === 'avatar')
      if (!avatar) {
        return false
      }

      if (userData === null) {
        // Сброс на дефолтные значения
        avatar.personalId = ''
        avatar.userId = null
        avatar.avatarUrl = '/Avatar.png'
        avatar.username = ''
      } else {
        // Подстановка данных пользователя
        avatar.personalId = userData.personalId || ''
        avatar.userId = userData.id || null
        avatar.avatarUrl = userData.avatarUrl || '/Avatar.png'
        avatar.username = userData.username || ''
      }

      // Запись в историю
      const historyStore = useHistoryStore()
      historyStore.setActionMetadata('update', userData
        ? `Привязан пользователь ${userData.username} к Аватару`
        : 'Сброшена привязка пользователя к Аватару')
      historyStore.saveState()

      return true
    },

    showIncompatibilityWarning(type) {
      this.incompatibilityWarning.visible = true
      this.incompatibilityWarning.type = type
    },

    hideIncompatibilityWarning() {
      this.incompatibilityWarning.visible = false
      this.incompatibilityWarning.type = null      
    }
  }
})
