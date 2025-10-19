import { defineStore } from 'pinia'
import { useConnectionsStore } from './connections'
import { useHistoryStore } from './history'
import { getHeaderColorRgb } from '../utils/constants'

export const useCardsStore = defineStore('cards', {
  state: () => ({
    cards: [
      {
        id: 'default-card',
        x: 100,
        y: 100,
        text: 'Демонстрационная карточка',
        width: 150,
        height: 80,
        fill: '#4CAF50',
        stroke: '#2E7D32',
        strokeWidth: 2,
        headerBg: getHeaderColorRgb(0), // Цвет заголовка по умолчанию (синий)
        colorIndex: 0,                   // Индекс цвета в палитре
        selected: false                  // Флаг выделения карточки
      }
    ],
    selectedCardIds: [] // Массив ID выделенных карточек
  }),
  
  actions: {
    addCard(card) {
      console.log('=== cardsStore.addCard called ===');
      console.log('Input card data:', card);
      console.log('Current cards count before adding:', this.cards.length);
      
      // Проверяем состояние кнопки шаблона в хранилище ДО добавления
      console.log('Store state before adding card:', {
        cardsCount: this.cards.length,
        selectedCardIds: [...this.selectedCardIds],
        hasSelectedCards: this.hasSelectedCards
      });
      
      const newCard = {
        id: Date.now().toString(), // Генерируем уникальный ID на основе временной метки
        x: card.x || 0,
        y: card.y || 0,
        text: card.text || '',
        width: card.width || 150,
        height: card.height || 80,
        fill: card.fill || '#4CAF50',
        stroke: card.stroke || '#2E7D32',
        strokeWidth: card.strokeWidth || 2,
        headerBg: card.headerBg || getHeaderColorRgb(0), // Цвет заголовка по умолчанию
        colorIndex: card.colorIndex || 0,                 // Индекс цвета по умолчанию
        selected: false,                                  // Флаг выделения карточки
        bodyHTML: card.bodyHTML || ''                     // HTML содержимое тела карточки
      }
      console.log('Created newCard object:', newCard);
      
      this.cards.push(newCard)
      console.log('Card added to store. Total cards:', this.cards.length);
      console.log('Cards array after adding:', this.cards.map(c => ({ id: c.id, text: c.text })));
      
      // Сохраняем состояние в историю
      const historyStore = useHistoryStore()
      historyStore.setActionMetadata('create', `Создана карточка "${newCard.text}"`)
      historyStore.saveState()
      
      // Проверяем состояние кнопки шаблона в хранилище ПОСЛЕ добавления
      console.log('Store state after adding card:', {
        cardsCount: this.cards.length,
        selectedCardIds: [...this.selectedCardIds],
        hasSelectedCards: this.hasSelectedCards
      });
      
      console.log('=== cardsStore.addCard finished ===');
      return newCard
    },
    
    updateCardPosition(cardId, x, y) {
      const card = this.cards.find(c => c.id === cardId)
      if (card) {
        card.x = x
        card.y = y
        
        // Сохраняем состояние в историю
        const historyStore = useHistoryStore()
        historyStore.setActionMetadata('update', `Перемещена карточка "${card.text}"`)
        historyStore.saveState()
      }
      return card
    },
    
    updateCard(cardId, updates) {
      const card = this.cards.find(c => c.id === cardId)
      if (card) {
        // Сохраняем старые значения для описания
        const oldText = card.text
        
        // Обновляем свойства карточки
        Object.assign(card, updates)
        
        // Сохраняем состояние в историю
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
      // Получаем доступ к хранилищу соединений
      const connectionsStore = useConnectionsStore()
      
      // Находим карточку для получения информации
      const card = this.cards.find(c => c.id === cardId)
      
      // Сохраняем состояние до удаления
      const historyStore = useHistoryStore()
      historyStore.setActionMetadata('delete', `Удалена карточка "${card?.text || 'Без названия'}"`)
      
      // Удаляем все соединения, связанные с этой карточкой
      connectionsStore.removeConnectionsByCardId(cardId)
      
      // Удаляем саму карточку
      const index = this.cards.findIndex(c => c.id === cardId)
      if (index !== -1) {
        this.cards.splice(index, 1)
        
        // Сохраняем состояние после удаления
        historyStore.saveState()
        return true
      }
      return false
    },
    
    // Групповая операция для перемещения нескольких карточек
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
      
      // Сохраняем состояние в историю после всех обновлений
      if (updatedCards.length > 0) {
        const historyStore = useHistoryStore()
        historyStore.setActionMetadata('update', `Перемещено ${updatedCards.length} карточек`)
        historyStore.saveState()
      }
      
      return updatedCards
    },
    
    // Обновить цвет заголовка для одной или нескольких карточек
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
      
      // Сохраняем состояние в историю после всех обновлений
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
    
    // Выделить карточку
    selectCard(cardId) {
      const card = this.cards.find(c => c.id === cardId)
      if (card && !card.selected) {
        card.selected = true
        this.selectedCardIds.push(cardId)
      }
    },
    
    // Снять выделение с карточки
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
    
    // Переключить выделение карточки
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
    
    // Снять выделение со всех карточек
    deselectAllCards() {
      this.cards.forEach(card => {
        card.selected = false
      })
      this.selectedCardIds = []
    },
    
    // Выделить все карточки
    selectAllCards() {
      this.cards.forEach(card => {
        card.selected = true
      })
      this.selectedCardIds = this.cards.map(card => card.id)
    }
  },
  
  getters: {
    // Получить выделенные карточки
    selectedCards: (state) => {
      return state.cards.filter(card => card.selected)
    },
    
    // Проверить, есть ли выделенные карточки
    hasSelectedCards: (state) => {
      return state.selectedCards.length > 0
    },
    
    // Загрузка карточек из проекта
    loadCards(cardsData) {
      // Очищаем текущие карточки
      this.cards = []
      this.selectedCardIds = []
      
      // Загружаем новые карточки
      cardsData.forEach(cardData => {
        this.cards.push({
          id: cardData.id || Date.now().toString(),
          x: cardData.x || 0,
          y: cardData.y || 0,
          text: cardData.text || '',
          width: cardData.width || 150,
          height: cardData.height || 80,
          fill: cardData.fill || '#4CAF50',
          stroke: cardData.stroke || '#2E7D32',
          strokeWidth: cardData.strokeWidth || 2,
          headerBg: cardData.headerBg || getHeaderColorRgb(0),
          colorIndex: cardData.colorIndex || 0,
          selected: false,
          bodyHTML: cardData.bodyHTML || ''
        })
      })
    }
  }
})