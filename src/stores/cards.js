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
    addCard(card) {
      console.log('=== cardsStore.addCard called ===');
      console.log('Input card data:', card);
      
      // Генерируем случайный номер лицензии, если не указан
      const generateLicenseNumber = () => {
        const prefix = 'RUY';
        const number = Math.floor(Math.random() * 10000000000).toString().padStart(10, '0');
        return prefix + number;
      };
      
      const newCard = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        x: card.x || 100,
        y: card.y || 100,
        text: card.text || generateLicenseNumber(),
        width: card.width || 380,
        height: 280,
        fill: card.fill || '#ffffff',
        stroke: card.stroke || '#000000',
        strokeWidth: card.strokeWidth || 2,
        headerBg: card.headerBg || getHeaderColorRgb(0),
        colorIndex: card.colorIndex || 0,
        selected: false,
        
        // Новые поля для лицензий
        pv: card.pv || '330/330pv',
        balance: card.balance || '0 / 0',
        activePv: card.activePv || '0 / 0',
        cycle: card.cycle || '0',
        coinFill: card.coinFill || '#ffd700',
        
        // Значки
        showSlfBadge: card.showSlfBadge || false,
        showFendouBadge: card.showFendouBadge || false,
        rankBadge: card.rankBadge || null, // null, '1', '2', '3', etc.
        
        // Дополнительные свойства
        bodyHTML: card.bodyHTML || ''
      }
      
      console.log('Created newCard object:', newCard);
      this.cards.push(newCard)
      console.log('Card added. Total cards:', this.cards.length);
      
      const historyStore = useHistoryStore()
      historyStore.setActionMetadata('create', `Создана карточка "${newCard.text}"`)
      historyStore.saveState()
      
      console.log('=== cardsStore.addCard finished ===');
      return newCard
    },
    
    updateCardPosition(cardId, x, y) {
      const card = this.cards.find(c => c.id === cardId)
      if (card) {
        card.x = x
        card.y = y
        
        const historyStore = useHistoryStore()
        historyStore.setActionMetadata('update', `Перемещена карточка "${card.text}"`)
        historyStore.saveState()
      }
      return card
    },
    
    updateCard(cardId, updates) {
      const card = this.cards.find(c => c.id === cardId)
      if (card) {
        const oldText = card.text
        Object.assign(card, updates)
        
        const historyStore = useHistoryStore()
        const description = oldText !== updates.text
          ? `Изменена карточка "${updates.text}"`
          : `Изменены свойства карточки "${card.text}"`
        historyStore.setActionMetadata('update', description)
        historyStore.saveState()
      }
      return card
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
