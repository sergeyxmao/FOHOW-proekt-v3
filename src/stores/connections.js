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
    avatarConnections: [], // Новый массив для соединений между аватарами
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

      // Также обновляем avatar-connections если они есть в выборке
      connectionIds.forEach(id => {
        const avatarConnection = this.avatarConnections.find(conn => conn.id === id)
        if (avatarConnection) {
          const normalizedUpdates = { ...updates }

          if (Object.prototype.hasOwnProperty.call(normalizedUpdates, 'animationDuration')) {
            normalizedUpdates.animationDuration = clampAnimationDuration(normalizedUpdates.animationDuration)
          }

          Object.assign(avatarConnection, normalizedUpdates)
          updatedConnections.push(avatarConnection)
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

    // ========== Методы для Avatar-соединений ==========

    addAvatarConnection(fromAvatarId, toAvatarId, options = {}) {
      const existingConnection = this.avatarConnections.find(
        conn => (conn.from === fromAvatarId && conn.to === toAvatarId) ||
                (conn.from === toAvatarId && conn.to === fromAvatarId)
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
        id: `avatar-${Date.now().toString()}-${Math.random().toString(36).slice(2, 9)}`,
        type: 'avatar-connection',
        from: fromAvatarId,
        to: toAvatarId,
        fromPointIndex: options.fromPointIndex || 1,
        toPointIndex: options.toPointIndex || 1,
        controlPoints,
        color: options.color || this.defaultLineColor,
        thickness: options.thickness || this.defaultLineThickness,
        animationDuration,
        highlightType: options.highlightType ?? this.defaultHighlightType
      }

      this.avatarConnections.push(newConnection)

      const historyStore = useHistoryStore()
      historyStore.setActionMetadata('create', `Создано соединение между аватарами`)
      historyStore.saveState()

      return newConnection
    },

    removeAvatarConnection(connectionId) {
      const index = this.avatarConnections.findIndex(conn => conn.id === connectionId)
      if (index !== -1) {
        const historyStore = useHistoryStore()
        historyStore.setActionMetadata('delete', `Удалено соединение аватаров`)

        this.avatarConnections.splice(index, 1)
        historyStore.saveState()
        return true
      }
      return false
    },

    removeAvatarConnectionsByAvatarId(avatarId, options = { saveToHistory: true }) {
      const removedCount = this.avatarConnections.filter(
        conn => conn.from === avatarId || conn.to === avatarId
      ).length

      if (removedCount > 0) {
        this.avatarConnections = this.avatarConnections.filter(
          conn => conn.from !== avatarId && conn.to !== avatarId
        )

        if (options.saveToHistory) {
          const historyStore = useHistoryStore()
          historyStore.setActionMetadata('delete', `Удалено ${removedCount} соединений аватаров`)
          historyStore.saveState()
        }
      }

      return removedCount
    },

    updateAvatarConnection(connectionId, updates, options = { saveToHistory: true }) {
      const connection = this.avatarConnections.find(conn => conn.id === connectionId)
      if (connection) {
        const normalizedUpdates = { ...updates }

        if (Object.prototype.hasOwnProperty.call(normalizedUpdates, 'animationDuration')) {
          normalizedUpdates.animationDuration = clampAnimationDuration(normalizedUpdates.animationDuration)
        }

        Object.assign(connection, normalizedUpdates)

        if (options.saveToHistory) {
          const historyStore = useHistoryStore()
          historyStore.setActionMetadata('update', 'Изменены свойства соединения аватаров')
          historyStore.saveState()
        }
      }
      return connection
    },

    // Обновить цвет всех соединений (включая avatar-соединения)
    updateAllConnectionsColorIncludingAvatars(color) {
      this.updateAllConnectionsColor(color)

      this.avatarConnections.forEach(connection => {
        connection.color = color
      })

      return { connections: this.connections.length, avatarConnections: this.avatarConnections.length }
    },

    // Обновить толщину всех соединений (включая avatar-соединения)
    updateAllConnectionsThicknessIncludingAvatars(thickness) {
      this.updateAllConnectionsThickness(thickness)

      this.avatarConnections.forEach(connection => {
        connection.thickness = thickness
      })

      return { connections: this.connections.length, avatarConnections: this.avatarConnections.length }
    },

    // Обновить все соединения (включая avatar-соединения)
    updateAllConnectionsIncludingAvatars(updates) {
      this.updateAllConnections(updates)

      this.avatarConnections.forEach(connection => {
        const normalizedUpdates = { ...updates }

        if (Object.prototype.hasOwnProperty.call(normalizedUpdates, 'animationDuration')) {
          normalizedUpdates.animationDuration = clampAnimationDuration(normalizedUpdates.animationDuration)
        }

        Object.assign(connection, normalizedUpdates)
      })

      return { connections: this.connections.length, avatarConnections: this.avatarConnections.length }
    },

    // Обновить только avatar-соединения
    updateAllAvatarConnections(updates) {
      const updatedConnections = []

      this.avatarConnections.forEach(connection => {
        const normalizedUpdates = { ...updates }

        if (Object.prototype.hasOwnProperty.call(normalizedUpdates, 'animationDuration')) {
          normalizedUpdates.animationDuration = clampAnimationDuration(normalizedUpdates.animationDuration)
        }

        Object.assign(connection, normalizedUpdates)
        updatedConnections.push(connection)
      })

      if (updatedConnections.length > 0) {
        const historyStore = useHistoryStore()
        historyStore.setActionMetadata('update', 'Изменены параметры всех avatar-соединений')
        historyStore.saveState()
      }

      return updatedConnections
    },

    // Обновить цвет всех avatar-соединений
    updateAllAvatarConnectionsColor(color) {
      const updatedConnections = []

      this.avatarConnections.forEach(connection => {
        connection.color = color
        updatedConnections.push(connection)
      })

      if (updatedConnections.length > 0) {
        const historyStore = useHistoryStore()
        historyStore.setActionMetadata('update', 'Изменен цвет всех avatar-соединений')
        historyStore.saveState()
      }

      return updatedConnections
    },

    // Обновить толщину всех avatar-соединений
    updateAllAvatarConnectionsThickness(thickness) {
      const updatedConnections = []

      this.avatarConnections.forEach(connection => {
        connection.thickness = thickness
        updatedConnections.push(connection)
      })

      if (updatedConnections.length > 0) {
        const historyStore = useHistoryStore()
        historyStore.setActionMetadata('update', 'Изменена толщина всех avatar-соединений')
        historyStore.saveState()
      }

      return updatedConnections
    },

    loadAvatarConnections(connectionsData = []) {
      if (!Array.isArray(connectionsData)) {
        this.avatarConnections = []
        return this.avatarConnections
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
            id: connection.id || `avatar-${Date.now().toString()}-${Math.random().toString(36).slice(2, 9)}`,
            type: 'avatar-connection',
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

      this.avatarConnections = normalizedConnections
      return this.avatarConnections
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
