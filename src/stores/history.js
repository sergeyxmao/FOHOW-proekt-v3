import { defineStore } from 'pinia'
import { useCardsStore } from './cards'
import { useConnectionsStore } from './connections'

export const useHistoryStore = defineStore('history', {
  state: () => ({
    // Стеки для хранения состояний
    undoStack: [],      // Состояния для отмены
    redoStack: [],      // Состояния для повтора
    
    // Метаданные истории
    historyLimit: 50,   // Максимальное количество состояний в истории
    currentStateIndex: -1, // Индекс текущего состояния
    
    // Флаги состояния
    isRestoring: false,  // Флаг восстановления состояния
    lastSavedSnapshot: null, // Последний сохраненный снимок для оптимизации
    
    // Метаданные последнего действия
    lastActionType: 'unknown',
    lastActionDescription: ''
  }),
  
  getters: {
    // Проверка возможности отмены
    canUndo: (state) => state.undoStack.length > 0,
    
    // Проверка возможности повтора
    canRedo: (state) => state.redoStack.length > 0,
    
    // Количество состояний в истории
    historySize: (state) => state.undoStack.length + state.redoStack.length,
    
    // Текущее состояние
    currentState: (state) => {
      if (state.undoStack.length > 0) {
        return JSON.parse(state.undoStack[state.undoStack.length - 1])
      }
      return null
    }
  },
  
  actions: {
    // Создание снимка состояния приложения
    createSnapshot() {
      const cardsStore = useCardsStore()
      const connectionsStore = useConnectionsStore()
      
      // Создаем глубокую копию текущего состояния
      const snapshot = {
        timestamp: Date.now(),
        version: '1.0',
        cards: JSON.parse(JSON.stringify(cardsStore.cards)),
        connections: JSON.parse(JSON.stringify(connectionsStore.connections)),
        metadata: {
          actionType: this.lastActionType || 'unknown',
          actionDescription: this.lastActionDescription || ''
        }
      }
      
      return snapshot
    },
    
    // Сохранение текущего состояния в историю
    saveState(snapshot = null) {
      // Если восстанавливаем состояние, не сохраняем в историю
      if (this.isRestoring) return
      
      // Создаем снимок, если не предоставлен
      const newSnapshot = snapshot || this.createSnapshot()
      
      // Проверка на дубликаты (оптимизация)
      const serialized = JSON.stringify(newSnapshot)
      if (serialized === this.lastSavedSnapshot) return
      
      // Добавляем в стек отмены
      this.undoStack.push(serialized)
      this.lastSavedSnapshot = serialized
      
      // Очищаем стек повтора при новом действии
      this.redoStack = []
      
      // Применяем ограничение истории
      this.optimizeHistory()
    },
  
    saveStateSoon(snapshot) {
      if (this.isRestoring) return

      if (snapshot !== undefined) {
        this._pendingSnapshot = snapshot
      }

      if (this._saveStateTimer != null) {
        return
      }

      const runSave = () => {
        this._saveStateTimer = null
        const pending = this._pendingSnapshot
        this._pendingSnapshot = undefined
        this.saveState(pending)
      }

      const hasWindow = typeof window !== 'undefined'
      if (hasWindow && typeof window.requestIdleCallback === 'function') {
        this._saveStateTimer = window.requestIdleCallback(() => {
          runSave()
        })
      } else {
        this._saveStateTimer = setTimeout(() => {
          runSave()
        }, 0)
      }
    },  
    // Отмена последнего действия
    undo() {
      if (!this.canUndo) return false
      
      // Извлекаем текущее состояние
      const currentState = this.undoStack.pop()
      
      // Добавляем его в стек повтора
      this.redoStack.push(currentState)
      
      // Восстанавливаем предыдущее состояние
      if (this.undoStack.length > 0) {
        const previousState = JSON.parse(this.undoStack[this.undoStack.length - 1])
        this.restoreSnapshot(previousState)
      } else {
        // Если в стеке отмены больше нет состояний, восстанавливаем пустое состояние
        this.restoreSnapshot({
          cards: [],
          connections: [],
          metadata: {
            actionType: 'empty',
            actionDescription: 'Начальное состояние'
          }
        })
      }
      
      return true
    },
    
    // Повтор последнего отмененного действия
    redo() {
      if (!this.canRedo) return false
      
      // Извлекаем состояние из стека повтора
      const stateToRestore = this.redoStack.pop()
      
      // Добавляем его в стек отмены
      this.undoStack.push(stateToRestore)
      
      // Восстанавливаем состояние
      this.restoreSnapshot(JSON.parse(stateToRestore))
      
      return true
    },
    
    // Восстановление состояния из снимка
    restoreSnapshot(snapshot) {
      // Устанавливаем флаг восстановления
      this.isRestoring = true
      
      try {
        const cardsStore = useCardsStore()
        const connectionsStore = useConnectionsStore()
        
        // Восстанавливаем карточки
        cardsStore.$patch({
          cards: JSON.parse(JSON.stringify(snapshot.cards))
        })
        
        // Восстанавливаем соединения
        connectionsStore.$patch({
          connections: JSON.parse(JSON.stringify(snapshot.connections))
        })
        
        // Восстанавливаем метаданные
        if (snapshot.metadata) {
          this.lastActionType = snapshot.metadata.actionType || 'unknown'
          this.lastActionDescription = snapshot.metadata.actionDescription || ''
        }
      } finally {
        // Сбрасываем флаг восстановления
        this.isRestoring = false
      }
    },
    
    // Оптимизация истории (ограничение размера)
    optimizeHistory() {
      // Если размер стека превышает лимит, удаляем старые состояния
      while (this.undoStack.length > this.historyLimit) {
        this.undoStack.shift()
      }
      
      // Аналогично для стека повтора
      while (this.redoStack.length > this.historyLimit) {
        this.redoStack.shift()
      }
    },
    
    // Очистка всей истории
    clearHistory() {
      this.undoStack = []
      this.redoStack = []
      this.currentStateIndex = -1
      this.lastSavedSnapshot = null
      this.lastActionType = 'unknown'
      this.lastActionDescription = ''
    },
    
    // Установка метаданных для следующего действия
    setActionMetadata(type, description) {
      this.lastActionType = type
      this.lastActionDescription = description
    }
  }
})
