import { defineStore } from 'pinia'
import { useConnectionsStore } from './connections'
import { useHistoryStore } from './history'
import { getHeaderColorRgb } from '../utils/constants'

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
          width: 380,
          height: 280,
          pv: '330/330pv',
          text: generateLicenseNumber(),
          historyText: 'Создана большая лицензия'
        },
        small: {
          width: 250,
          height: 180,
          pv: '110/110pv',
          text: 'Малая лицензия',
          historyText: 'Создана малая лицензия'
        }
      };

      const preset = presets[type] || presets.large;

      const newCard = {
        // Базовые свойства
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        x: 100,
        y: 100,
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
    
    updateMultipleCardsPositions(updates) {
      const updatedCards = []
      
      updates.forEach(({ cardId, x, y }) => {
        const card = this.cards.find(c => c.id === cardId)
        if (card) {
          card.x = x
          card.y = y
          updatedCards.push(card)
        }
      })
      
      if (updatedCards.length > 0) {
        const historyStore = useHistoryStore()
        historyStore.setActionMetadata('update', `Перемещено ${updatedCards.length} карточек`)
        historyStore.saveState()
      }
      
      return updatedCards
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
      
      cardsData.forEach(cardData => {
        const generateLicenseNumber = () => {
          const prefix = 'RUY';
          const number = Math.floor(Math.random() * 10000000000).toString().padStart(10, '0');
          return prefix + number;
        };
        
        this.cards.push({
          id: cardData.id || Date.now().toString(),
          x: cardData.x || 0,
          y: cardData.y || 0,
          text: cardData.text || generateLicenseNumber(),
          width: cardData.width || 380,
          height: 280,
          fill: cardData.fill || '#ffffff',
          stroke: cardData.stroke || '#000000',
          strokeWidth: cardData.strokeWidth || 2,
          headerBg: cardData.headerBg || getHeaderColorRgb(0),
          colorIndex: cardData.colorIndex || 0,
          selected: false,
          pv: cardData.pv || '330/330pv',
          balance: cardData.balance || '0 / 0',
          activePv: cardData.activePv || '0 / 0',
          cycle: cardData.cycle || '0',
          coinFill: cardData.coinFill || '#ffd700',
          showSlfBadge: cardData.showSlfBadge || false,
          showFendouBadge: cardData.showFendouBadge || false,
          rankBadge: cardData.rankBadge || null,
          bodyHTML: cardData.bodyHTML || ''
        })
      })
    }
  }
})
