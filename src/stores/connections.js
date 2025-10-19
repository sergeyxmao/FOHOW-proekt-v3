import { defineStore } from 'pinia'
import { useHistoryStore } from './history'

export const useConnectionsStore = defineStore('connections', {
  state: () => ({
    connections: [],
    // Параметры по умолчанию для новых соединений
    defaultLineColor: '#0f62fe',
    defaultLineThickness: 5
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
      
      const newConnection = {
        id: Date.now().toString(), // Генерируем уникальный ID
        from: fromCardId,
        to: toCardId,
        color: options.color || this.defaultLineColor,
        thickness: options.thickness || this.defaultLineThickness
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
        // Обновляем свойства соединения
        Object.assign(connection, updates)
        
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
        Object.assign(connection, updates)
        updatedConnections.push(connection)
      })
      
      // Сохраняем состояние в историю
      if (updatedConnections.length > 0) {
        const historyStore = useHistoryStore()
        historyStore.setActionMetadata('update', `Изменены параметры всех соединений`)
        historyStore.saveState()
      }
      
      return updatedConnections
    },
    
    // Установить параметры по умолчанию для новых соединений
    setDefaultConnectionParameters(color, thickness) {
      this.defaultLineColor = color
      this.defaultLineThickness = thickness
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