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
    userCardConnections: [], // Массив соединений между карточками партнёров (UserCard) на холсте
    selectedConnectionIds: [], // Массив выбранных соединений
    defaultLineColor: '#0f62fe',
    defaultLineThickness: 5,
    defaultHighlightType: null,
    defaultAnimationDuration: MIN_ANIMATION_DURATION
  }),
  
  actions: {
    addConnection(fromCardId, toCardId, options = {}) {
      // Если force=true, пропускаем проверку на существующие соединения
      if (!options.force) {
        const existingConnection = this.connections.find(
          conn => (conn.from === fromCardId && conn.to === toCardId) ||
                  (conn.from === toCardId && conn.to === fromCardId)
        )

        if (existingConnection) {
          console.log('⚠️ Соединение уже существует:', existingConnection.id)
          return null
        }
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

    updateSelectedConnections(connectionIds, updates) {
      if (!Array.isArray(connectionIds) || connectionIds.length === 0) {
        return []
      }

      const updatedConnections = []

      connectionIds.forEach(id => {
        const connection = this.connections.find(conn => conn.id === id)
        if (connection) {
          const normalizedUpdates = { ...updates }

          if (Object.prototype.hasOwnProperty.call(normalizedUpdates, 'animationDuration')) {
            normalizedUpdates.animationDuration = clampAnimationDuration(normalizedUpdates.animationDuration)
          }

          Object.assign(connection, normalizedUpdates)
          updatedConnections.push(connection)
        }
      })

      // Также обновляем user-card-connections если они есть в выборке
      connectionIds.forEach(id => {
        const userCardConnection = this.userCardConnections.find(conn => conn.id === id)
        if (userCardConnection) {
          const normalizedUpdates = { ...updates }

          if (Object.prototype.hasOwnProperty.call(normalizedUpdates, 'animationDuration')) {
            normalizedUpdates.animationDuration = clampAnimationDuration(normalizedUpdates.animationDuration)
          }

          Object.assign(userCardConnection, normalizedUpdates)
          updatedConnections.push(userCardConnection)
        }
      })

      if (updatedConnections.length > 0) {
        const historyStore = useHistoryStore()
        historyStore.setActionMetadata('update', `Изменены параметры ${updatedConnections.length} соединений`)
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
    },

    // ========== Методы для UserCard-соединений (карточки партнёров на холсте) ==========

    addUserCardConnection(fromUserCardId, toUserCardId, options = {}) {
      const existingConnection = this.userCardConnections.find(
        conn => (conn.from === fromUserCardId && conn.to === toUserCardId) ||
                (conn.from === toUserCardId && conn.to === fromUserCardId)
      )

      if (existingConnection) {
        return null
      }

      const animationDuration = clampAnimationDuration(
        options.animationDuration ?? this.defaultAnimationDuration
      )

      // Начальная позиция контрольной точки - посередине между начальной и конечной точками
      const controlPoints = options.controlPoints || []

      const newConnection = {
        id: `user-card-${Date.now().toString()}-${Math.random().toString(36).slice(2, 9)}`,
        type: 'user-card-connection',
        from: fromUserCardId,
        to: toUserCardId,
        fromPointIndex: options.fromPointIndex || 1,
        toPointIndex: options.toPointIndex || 1,
        controlPoints,
        color: options.color || this.defaultLineColor,
        thickness: options.thickness || this.defaultLineThickness,
        animationDuration,
        highlightType: options.highlightType ?? this.defaultHighlightType
      }

      this.userCardConnections.push(newConnection)

      const historyStore = useHistoryStore()
      historyStore.setActionMetadata('create', `Создано соединение между карточками партнёров`)
      historyStore.saveState()

      return newConnection
    },

    removeUserCardConnection(connectionId) {
      const index = this.userCardConnections.findIndex(conn => conn.id === connectionId)
      if (index !== -1) {
        const historyStore = useHistoryStore()
        historyStore.setActionMetadata('delete', `Удалено соединение карточек партнёров`)

        this.userCardConnections.splice(index, 1)
        historyStore.saveState()
        return true
      }
      return false
    },

    removeUserCardConnectionsByUserCardId(userCardId, options = { saveToHistory: true }) {
      const removedCount = this.userCardConnections.filter(
        conn => conn.from === userCardId || conn.to === userCardId
      ).length

      if (removedCount > 0) {
        this.userCardConnections = this.userCardConnections.filter(
          conn => conn.from !== userCardId && conn.to !== userCardId
        )

        if (options.saveToHistory) {
          const historyStore = useHistoryStore()
          historyStore.setActionMetadata('delete', `Удалено ${removedCount} соединений карточек партнёров`)
          historyStore.saveState()
        }
      }

      return removedCount
    },

    updateUserCardConnection(connectionId, updates, options = { saveToHistory: true }) {
      const connection = this.userCardConnections.find(conn => conn.id === connectionId)
      if (connection) {
        const normalizedUpdates = { ...updates }

        if (Object.prototype.hasOwnProperty.call(normalizedUpdates, 'animationDuration')) {
          normalizedUpdates.animationDuration = clampAnimationDuration(normalizedUpdates.animationDuration)
        }

        Object.assign(connection, normalizedUpdates)

        if (options.saveToHistory) {
          const historyStore = useHistoryStore()
          historyStore.setActionMetadata('update', 'Изменены свойства соединения карточек партнёров')
          historyStore.saveState()
        }
      }
      return connection
    },

    // Обновить цвет всех соединений (включая user-card-соединения)
    updateAllConnectionsColorIncludingUserCards(color) {
      this.updateAllConnectionsColor(color)

      this.userCardConnections.forEach(connection => {
        connection.color = color
      })

      return { connections: this.connections.length, userCardConnections: this.userCardConnections.length }
    },

    // Обновить толщину всех соединений (включая user-card-соединения)
    updateAllConnectionsThicknessIncludingUserCards(thickness) {
      this.updateAllConnectionsThickness(thickness)

      this.userCardConnections.forEach(connection => {
        connection.thickness = thickness
      })

      return { connections: this.connections.length, userCardConnections: this.userCardConnections.length }
    },

    // Обновить все соединения (включая user-card-соединения)
    updateAllConnectionsIncludingUserCards(updates) {
      this.updateAllConnections(updates)

      this.userCardConnections.forEach(connection => {
        const normalizedUpdates = { ...updates }

        if (Object.prototype.hasOwnProperty.call(normalizedUpdates, 'animationDuration')) {
          normalizedUpdates.animationDuration = clampAnimationDuration(normalizedUpdates.animationDuration)
        }

        Object.assign(connection, normalizedUpdates)
      })

      return { connections: this.connections.length, userCardConnections: this.userCardConnections.length }
    },

    // Обновить только user-card-соединения (карточки партнёров)
    updateAllUserCardConnections(updates) {
      const updatedConnections = []

      this.userCardConnections.forEach(connection => {
        const normalizedUpdates = { ...updates }

        if (Object.prototype.hasOwnProperty.call(normalizedUpdates, 'animationDuration')) {
          normalizedUpdates.animationDuration = clampAnimationDuration(normalizedUpdates.animationDuration)
        }

        Object.assign(connection, normalizedUpdates)
        updatedConnections.push(connection)
      })

      if (updatedConnections.length > 0) {
        const historyStore = useHistoryStore()
        historyStore.setActionMetadata('update', 'Изменены параметры всех соединений карточек партнёров')
        historyStore.saveState()
      }

      return updatedConnections
    },

    // Обновить цвет всех user-card-соединений (карточки партнёров)
    updateAllUserCardConnectionsColor(color) {
      const updatedConnections = []

      this.userCardConnections.forEach(connection => {
        connection.color = color
        updatedConnections.push(connection)
      })

      if (updatedConnections.length > 0) {
        const historyStore = useHistoryStore()
        historyStore.setActionMetadata('update', 'Изменен цвет всех соединений карточек партнёров')
        historyStore.saveState()
      }

      return updatedConnections
    },

    // Обновить толщину всех user-card-соединений (карточки партнёров)
    updateAllUserCardConnectionsThickness(thickness) {
      const updatedConnections = []

      this.userCardConnections.forEach(connection => {
        connection.thickness = thickness
        updatedConnections.push(connection)
      })

      if (updatedConnections.length > 0) {
        const historyStore = useHistoryStore()
        historyStore.setActionMetadata('update', 'Изменена толщина всех соединений карточек партнёров')
        historyStore.saveState()
      }

      return updatedConnections
    },

    loadUserCardConnections(connectionsData = []) {
      if (!Array.isArray(connectionsData)) {
        this.userCardConnections = []
        return this.userCardConnections
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
            id: connection.id || `user-card-${Date.now().toString()}-${Math.random().toString(36).slice(2, 9)}`,
            type: 'user-card-connection',
            from: connection.from,
            to: connection.to,
            fromPointIndex: connection.fromPointIndex || 1,
            toPointIndex: connection.toPointIndex || 1,
            controlPoints: Array.isArray(connection.controlPoints) ? connection.controlPoints : [],
            color: connection.color || this.defaultLineColor,
            thickness,
            highlightType: Object.prototype.hasOwnProperty.call(connection, 'highlightType')
              ? connection.highlightType
              : this.defaultHighlightType,
            animationDuration
          }
        })
        .filter(Boolean)

      this.userCardConnections = normalizedConnections
      return this.userCardConnections
    },

    // Управление выбранными соединениями
    setSelectedConnections(connectionIds) {
      this.selectedConnectionIds = Array.isArray(connectionIds) ? connectionIds : []
    },

    clearSelectedConnections() {
      this.selectedConnectionIds = []
    },

    toggleConnectionSelection(connectionId) {
      const index = this.selectedConnectionIds.indexOf(connectionId)
      if (index > -1) {
        this.selectedConnectionIds.splice(index, 1)
      } else {
        this.selectedConnectionIds.push(connectionId)
      }
    }
  }
})
