import { defineStore } from 'pinia'
import { useHistoryStore } from './history'

const MIN_ANIMATION_DURATION = 2000
const MAX_ANIMATION_DURATION = 999000

function clampAnimationDuration(duration) {
  if (typeof duration !== 'number' || Number.isNaN(duration)) {
    return MIN_ANIMATION_DURATION
  }

  return Math.min(Math.max(duration, MIN_ANIMATION_DURATION), MAX_ANIMATION_DURATION)
}

export const useConnectionsStore = defineStore('connections', {
  state: () => ({
    connections: [],
    // Параметры по умолчанию для новых соединений
    defaultLineColor: '#0f62fe',
    defaultLineThickness: 5,
    defaultHighlightType: null,
    defaultAnimationDuration: MIN_ANIMATION_DURATION
  }),
  
  actions: {
    addConnection(fromCardId, toCardId, options = {}) {
      // Проверяем, что соединение еще не существует
      const existingConnection = this.connections.find(
        conn => (conn.from === fromCardId && conn.to === toCardId) ||
                (conn.from === toCardId && conn.to === fromCardId)
      )
      
      if (existingConnection) {
        return null // Соединение уже существует
      }

      const animationDuration = clampAnimationDuration(
        options.animationDuration ?? this.defaultAnimationDuration
      )

      
      const newConnection = {
        id: `${Date.now().toString()}-${Math.random().toString(36).slice(2, 9)}`,
        from: fromCardId,
        to: toCardId,
        fromSide: options.fromSide || 'right',
        toSide: options.toSide || 'left',        color: options.color || this.defaultLineColor,
        thickness: options.thickness || this.defaultLineThickness,
        highlightType: options.highlightType ?? this.defaultHighlightType,
        animationDuration      }
      
      this.connections.push(newConnection)
      
      // Сохраняем состояние в историю
      const historyStore = useHistoryStore()
      historyStore.setActionMetadata('create', `Создано соединение между карточками`)
      historyStore.saveState()
      
      return newConnection
    },
    
    removeConnection(connectionId) {
      const index = this.connections.findIndex(conn => conn.id === connectionId)
      if (index !== -1) {
        // Получаем информацию о соединении перед удалением
        const connection = this.connections[index]
        
        // Сохраняем состояние до удаления
        const historyStore = useHistoryStore()
        historyStore.setActionMetadata('delete', `Удалено соединение`)
        
        this.connections.splice(index, 1)
        
        // Сохраняем состояние после удаления
        historyStore.saveState()
        return true
      }
      return false
    },
    
    removeConnectionsByCardId(cardId) {
      // Удаляем все соединения, связанные с указанной карточкой
      const initialLength = this.connections.length
      const removedCount = this.connections.filter(
        conn => conn.from === cardId || conn.to === cardId
      ).length
      
      this.connections = this.connections.filter(
        conn => conn.from !== cardId && conn.to !== cardId
      )
      
      // Сохраняем состояние в историю, если были удалены соединения
      if (removedCount > 0) {
        const historyStore = useHistoryStore()
        historyStore.setActionMetadata('delete', `Удалено ${removedCount} соединений`)
        historyStore.saveState()
      }
      
      return removedCount // Возвращаем количество удаленных соединений
    },
    
    // Метод для обновления свойств соединения
    updateConnection(connectionId, updates) {
      const connection = this.connections.find(conn => conn.id === connectionId)
      if (connection) {
        const normalizedUpdates = { ...updates }

        if (Object.prototype.hasOwnProperty.call(normalizedUpdates, 'animationDuration')) {
          normalizedUpdates.animationDuration = clampAnimationDuration(normalizedUpdates.animationDuration)
        }
        
        // Обновляем свойства соединения
        Object.assign(connection, normalizedUpdates)
        
        // Сохраняем состояние в историю
        const historyStore = useHistoryStore()
        historyStore.setActionMetadata('update', `Изменены свойства соединения`)
        historyStore.saveState()
      }
      return connection
    },
    
    // Обновить цвет всех соединений
    updateAllConnectionsColor(color) {
      const updatedConnections = []
      
      this.connections.forEach(connection => {
        connection.color = color
        updatedConnections.push(connection)
      })

      this.defaultLineColor = color
      
      // Сохраняем состояние в историю
      if (updatedConnections.length > 0) {
        const historyStore = useHistoryStore()
        historyStore.setActionMetadata('update', `Изменен цвет всех соединений`)
        historyStore.saveState()
      }
      
      return updatedConnections
    },
    
    // Обновить толщину всех соединений
    updateAllConnectionsThickness(thickness) {
      const updatedConnections = []
      
      this.connections.forEach(connection => {
        connection.thickness = thickness
        updatedConnections.push(connection)
      })

    this.defaultLineThickness = thickness
      
      // Сохраняем состояние в историю
      if (updatedConnections.length > 0) {
        const historyStore = useHistoryStore()
        historyStore.setActionMetadata('update', `Изменена толщина всех соединений`)
        historyStore.saveState()
      }
      
      return updatedConnections
    },
    
    // Обновить параметры всех соединений
    updateAllConnections(updates) {
      const updatedConnections = []
      
      this.connections.forEach(connection => {
        const normalizedUpdates = { ...updates }

        if (Object.prototype.hasOwnProperty.call(normalizedUpdates, 'animationDuration')) {
          normalizedUpdates.animationDuration = clampAnimationDuration(normalizedUpdates.animationDuration)
        }

        Object.assign(connection, normalizedUpdates)        updatedConnections.push(connection)
      })


      if (Object.prototype.hasOwnProperty.call(updates, 'color')) {
        this.defaultLineColor = updates.color
      }

      if (Object.prototype.hasOwnProperty.call(updates, 'thickness')) {
        this.defaultLineThickness = updates.thickness
      }

      if (Object.prototype.hasOwnProperty.call(updates, 'highlightType')) {
        this.defaultHighlightType = updates.highlightType
      }

      if (Object.prototype.hasOwnProperty.call(updates, 'animationDuration')) {
        this.defaultAnimationDuration = clampAnimationDuration(updates.animationDuration)
      }
      
      // Сохраняем состояние в историю
      if (updatedConnections.length > 0) {
        const historyStore = useHistoryStore()
        historyStore.setActionMetadata('update', `Изменены параметры всех соединений`)
        historyStore.saveState()
      }
      
      return updatedConnections
    },
    
    // Установить параметры по умолчанию для новых соединений
    setDefaultConnectionParameters(color, thickness, animationDuration) {
      if (typeof color === 'string') {
        this.defaultLineColor = color
      }

      if (typeof thickness === 'number' && !Number.isNaN(thickness)) {
        this.defaultLineThickness = thickness
      }

      if (typeof animationDuration === 'number' && !Number.isNaN(animationDuration)) {
        this.defaultAnimationDuration = clampAnimationDuration(animationDuration)
      }
    },
    
    // Групповая операция для удаления нескольких соединений
    removeMultipleConnections(connectionIds) {
      const removedConnections = []
      
      connectionIds.forEach(id => {
        const index = this.connections.findIndex(conn => conn.id === id)
        if (index !== -1) {
          removedConnections.push(this.connections[index])
          this.connections.splice(index, 1)
        }
      })
      
      // Сохраняем состояние в историю после всех удалений
      if (removedConnections.length > 0) {
        const historyStore = useHistoryStore()
        historyStore.setActionMetadata('delete', `Удалено ${removedConnections.length} соединений`)
        historyStore.saveState()
      }
      
      return removedConnections
    }
  }
})
