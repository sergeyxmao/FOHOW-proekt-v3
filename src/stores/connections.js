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
    defaultLineColor: '#0f62fe',
    defaultLineThickness: 5,
    defaultHighlightType: null,
    defaultAnimationDuration: MIN_ANIMATION_DURATION
  }),
  
  actions: {
    addConnection(fromCardId, toCardId, options = {}) {
      const existingConnection = this.connections.find(
        conn => (conn.from === fromCardId && conn.to === toCardId) ||
                (conn.from === toCardId && conn.to === fromCardId)
      )
      
      if (existingConnection) {
        return null
      }

      const animationDuration = clampAnimationDuration(
        options.animationDuration ?? this.defaultAnimationDuration
      )

      
      const newConnection = {
        id: `${Date.now().toString()}-${Math.random().toString(36).slice(2, 9)}`,
        from: fromCardId,
        to: toCardId,
        fromSide: options.fromSide || 'right',
        toSide: options.toSide || 'left',
        color: options.color || this.defaultLineColor, 
        thickness: options.thickness || this.defaultLineThickness,
        highlightType: options.highlightType ?? this.defaultHighlightType,
        animationDuration 
      }
      
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

        const historyStore = useHistoryStore()
        historyStore.setActionMetadata('delete', `Удалено соединение`)
        
        this.connections.splice(index, 1)
        
        // Сохраняем состояние после удаления
        historyStore.saveState()
        return true
      }
      return false
    },
  
    removeConnectionsByCardId(cardId, options = { saveToHistory: true }) {
      const removedCount = this.connections.filter(
        conn => conn.from === cardId || conn.to === cardId
      ).length

      if (removedCount > 0) {
        this.connections = this.connections.filter(
          conn => conn.from !== cardId && conn.to !== cardId
        )

        if (options.saveToHistory) {
          const historyStore = useHistoryStore()
          historyStore.setActionMetadata('delete', `Удалено ${removedCount} соединений`)
          historyStore.saveState()
        }
      }

      return removedCount
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
        historyStore.setActionMetadata('update', 'Изменены свойства соединения')
        historyStore.saveState()
      }
      return connection
    },

    updateAllConnectionsColor(color) {
      const updatedConnections = []
      
      this.connections.forEach(connection => {
        connection.color = color
        updatedConnections.push(connection)
      })

      this.defaultLineColor = color

      if (updatedConnections.length > 0) {
        const historyStore = useHistoryStore()
        historyStore.setActionMetadata('update', 'Изменен цвет всех соединений')
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

      if (updatedConnections.length > 0) {
        const historyStore = useHistoryStore()
        historyStore.setActionMetadata('update', 'Изменена толщина всех соединений')
        historyStore.saveState()
      }
      
      return updatedConnections
    },

    updateAllConnections(updates) {
      const updatedConnections = []
      
      this.connections.forEach(connection => {
        const normalizedUpdates = { ...updates }

        if (Object.prototype.hasOwnProperty.call(normalizedUpdates, 'animationDuration')) {
          normalizedUpdates.animationDuration = clampAnimationDuration(normalizedUpdates.animationDuration)
        }

        Object.assign(connection, normalizedUpdates)
        updatedConnections.push(connection)
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

      if (updatedConnections.length > 0) {
        const historyStore = useHistoryStore()
        historyStore.setActionMetadata('update', 'Изменены параметры всех соединений')
        historyStore.saveState()
      }
      
      return updatedConnections
    },
    
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

    loadConnections(connectionsData = []) {
      if (!Array.isArray(connectionsData)) {
        this.connections = []
        return this.connections
      }

      const normalizedConnections = connectionsData
        .map(connection => {
          if (!connection || typeof connection !== 'object') {
            return null
          }

          if (!connection.from || !connection.to) {
            return null
          }

          const thickness = typeof connection.thickness === 'number' && !Number.isNaN(connection.thickness)
            ? connection.thickness
            : this.defaultLineThickness

          const animationDuration = clampAnimationDuration(
            typeof connection.animationDuration === 'number' && !Number.isNaN(connection.animationDuration)
              ? connection.animationDuration
              : this.defaultAnimationDuration
          )

          return {
            id: connection.id || `${Date.now().toString()}-${Math.random().toString(36).slice(2, 9)}`,
            from: connection.from,
            to: connection.to,
            fromSide: connection.fromSide || 'right',
            toSide: connection.toSide || 'left',
            color: connection.color || this.defaultLineColor,
            thickness,
            highlightType: Object.prototype.hasOwnProperty.call(connection, 'highlightType')
              ? connection.highlightType
              : this.defaultHighlightType,
            animationDuration
          }
        })
        .filter(Boolean)

      this.connections = normalizedConnections
      return this.connections
    },
    removeMultipleConnections(connectionIds) {
      const removedConnections = []
      
      connectionIds.forEach(id => {
        const index = this.connections.findIndex(conn => conn.id === id)
        if (index !== -1) {
          removedConnections.push(this.connections[index])
          this.connections.splice(index, 1)
        }
      })

      if (removedConnections.length > 0) {
        const historyStore = useHistoryStore()
        historyStore.setActionMetadata('delete', `Удалено ${removedConnections.length} соединений`)
        historyStore.saveState()
      }
      
      return removedConnections
    }
  }
})
