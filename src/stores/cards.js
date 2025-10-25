import { defineStore } from 'pinia'
import { useConnectionsStore } from './connections'
import { useHistoryStore } from './history'
import { getHeaderColorRgb } from '../utils/constants'

const GOLD_BODY_GRADIENT = 'linear-gradient(135deg, #fff6d1 0%, #ffd700 45%, #fff2a8 100%)'

export const useCardsStore = defineStore('cards', {
  state: () => ({
    cards: [],
    selectedCardIds: []
  }),
  
  getters: {
    selectedCards: (state) => {
      return state.cards.filter(card => card.selected)
    },
    
    hasSelectedCards: (state) => {
      return state.selectedCards.length > 0
    }
  },
  
  actions: {
    updateCard(cardId, updates = {}, options = {}) {
      const card = this.cards.find(c => c.id === cardId)
      if (!card) {
        return null
      }

      const normalizedUpdates = { ...updates }

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
    
    addCard(options = {}) {
      const { type = 'large', ...cardData } = options;

      const generateLicenseNumber = () => {
        const prefix = 'RUY';
        const number = Math.floor(Math.random() * 10000000000).toString().padStart(10, '0');
        return prefix + number;
      };

      // Пресеты для разных типов лицензий
      const presets = {
        large: {
          width: 494,
          height: 364,
          pv: '330/330pv',
          text: generateLicenseNumber(),
          historyText: 'Создана большая лицензия'
        },
        small: {
          width: 380,
          height: 280,
          pv: '330/330pv',
          text: 'Малая лицензия',
          historyText: 'Создана малая лицензия'
           },
        gold: {
          width: 494,
          height: 364,
          pv: '330/330pv',
          text: generateLicenseNumber(),
          historyText: 'Создана золотая лицензия',
          headerBg: '#d4af37',
          colorIndex: -1,
          bodyGradient: GOLD_BODY_GRADIENT,
          fill: '#fffdf2'       
        }
      };

      const preset = presets[type] || presets.large;

      const newCard = {
        // Базовые свойства
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        // Размещаем новую лицензию в верхнем левом секторе рядом с панелью управления
        x: 320,
        y: 160,
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
        coinFill: '#ffd700',
        
        // Значки
        showSlfBadge: false,
        showFendouBadge: false,
        rankBadge: null,
        
        // Дополнительные свойства
        bodyHTML: '',
        bodyGradient: preset.bodyGradient || '',
        type,
        // Переданные вручную свойства (например, x, y) имеют наивысший приоритет
        ...cardData
      };
      
      this.cards.push(newCard);
      
      const historyStore = useHistoryStore();
      historyStore.setActionMetadata('create', `${preset.historyText} "${newCard.text}"`);
      historyStore.saveState();
      
      return newCard;
    },
    
removeCard(cardId) {
      const connectionsStore = useConnectionsStore()
      const card = this.cards.find(c => c.id === cardId)
      if (!card) return false

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
    
    updateCardHeaderColor(cardIds, colorIndex) {
      const updatedCards = []
      const headerBg = getHeaderColorRgb(colorIndex)
      
      cardIds.forEach(cardId => {
        const card = this.cards.find(c => c.id === cardId)
        if (card) {
          card.headerBg = headerBg
          card.colorIndex = colorIndex
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
 
      const typeDefaults = {
        large: { width: 494, height: 364 },
        gold: { width: 494, height: 364 },
        small: { width: 380, height: 280 }
      }     
      cardsData.forEach(cardData => {
        const generateLicenseNumber = () => {
          const prefix = 'RUY'
          const number = Math.floor(Math.random() * 10000000000).toString().padStart(10, '0')
          return prefix + number
        }

        const detectedType = cardData.type
          || ((cardData.width && cardData.width >= 494) || (cardData.height && cardData.height >= 364)
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

        
        this.cards.push({
          id: cardData.id || Date.now().toString(),
          x: Number.isFinite(cardData.x) ? cardData.x : 0,
          y: Number.isFinite(cardData.y) ? cardData.y : 0,
          text: cardData.text || generateLicenseNumber(),
          width,
          height,
          fill: cardData.fill || '#ffffff',
          stroke: cardData.stroke || '#000000',
          strokeWidth: Number.isFinite(cardData.strokeWidth) ? cardData.strokeWidth : 2,
          headerBg,
          colorIndex,
          selected: false,
          pv: cardData.pv || '330/330pv',
          balance: cardData.balance || '0 / 0',
          activePv: cardData.activePv || '0 / 0',
          cycle: cardData.cycle || '0',
          coinFill: cardData.coinFill || '#ffd700',
          showSlfBadge: Boolean(cardData.showSlfBadge),
          showFendouBadge: Boolean(cardData.showFendouBadge),
          rankBadge: cardData.rankBadge || null,
          bodyHTML: cardData.bodyHTML || '',
          bodyGradient: cardData.bodyGradient || (detectedType === 'gold' ? GOLD_BODY_GRADIENT : ''),
          type: detectedType        })
      })
    }
  }
})
