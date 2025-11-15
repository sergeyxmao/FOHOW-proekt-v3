import { defineStore } from 'pinia'

/**
 * Store для управления состоянием объектов на доске
 * Поддерживает любые типы объектов: изображения, фигуры, текст и т.д.
 */
export const useDrawingStore = defineStore('drawing', {
  state: () => ({
    objects: [],           // массив всех объектов на доске
    selectedObjectId: null // ID выбранного объекта (или null)
  }),

  getters: {
    /**
     * Получить выбранный объект
     * @returns {Object|null} - выбранный объект или null
     */
    selectedObject(state) {
      if (!state.selectedObjectId) {
        return null
      }
      return state.objects.find(obj => obj.id === state.selectedObjectId) || null
    },

    /**
     * Получить объект по ID
     * @returns {Function} - функция для поиска объекта по ID
     */
    getObjectById: (state) => (id) => {
      return state.objects.find(obj => obj.id === id) || null
    },

    /**
     * Получить массив объектов, отсортированный по zIndex
     * @returns {Array} - отсортированный массив объектов
     */
    sortedObjects(state) {
      return [...state.objects].sort((a, b) => {
        const zIndexA = a.zIndex ?? 0
        const zIndexB = b.zIndex ?? 0
        return zIndexA - zIndexB
      })
    },

    /**
     * Получить все выбранные объекты
     * @returns {Array} - массив выбранных объектов
     */
    selectedObjects(state) {
      return state.objects.filter(obj => obj.isSelected === true)
    },

    /**
     * Проверить, есть ли выбранные объекты
     * @returns {boolean}
     */
    hasSelectedObjects(state) {
      return state.selectedObjectId !== null ||
             state.objects.some(obj => obj.isSelected === true)
    }
  },

  actions: {
    /**
     * Добавить объект в массив
     * @param {Object} object - объект для добавления
     * @returns {Object} - добавленный объект
     */
    addObject(object) {
      if (!object || typeof object !== 'object') {
        console.error('addObject: invalid object provided')
        return null
      }

      // Убедимся, что у объекта есть ID
      if (!object.id) {
        object.id = this.generateObjectId()
      }

      // Снимаем выделение со всех других объектов
      this.objects.forEach(obj => {
        obj.isSelected = false
      })

      // Устанавливаем isSelected для нового объекта
      object.isSelected = true

      // Добавляем объект в массив
      this.objects.push(object)

      // Устанавливаем selectedObjectId
      this.selectedObjectId = object.id

      return object
    },

    /**
     * Удалить объект с указанным ID
     * @param {string} objectId - ID объекта для удаления
     * @returns {boolean} - true если объект был удален
     */
    removeObject(objectId) {
      const index = this.objects.findIndex(obj => obj.id === objectId)

      if (index === -1) {
        return false
      }

      // Удаляем объект из массива
      this.objects.splice(index, 1)

      // Если удаляемый объект был выделен - сбрасываем selectedObjectId
      if (this.selectedObjectId === objectId) {
        this.selectedObjectId = null
      }

      return true
    },

    /**
     * Обновить объект
     * @param {Object} payload - объект с id и updates
     * @param {string} payload.id - ID объекта
     * @param {Object} payload.updates - обновления для применения
     * @returns {Object|null} - обновленный объект или null
     */
    updateObject({ id, updates }) {
      const object = this.objects.find(obj => obj.id === id)

      if (!object) {
        console.warn(`updateObject: object with id ${id} not found`)
        return null
      }

      // Применяем обновления
      Object.assign(object, updates)

      return object
    },

    /**
     * Выбрать объект
     * @param {string} objectId - ID объекта для выбора
     */
    selectObject(objectId) {
      // Снимаем выделение со всех объектов
      this.objects.forEach(obj => {
        obj.isSelected = false
      })

      // Находим и выделяем нужный объект
      const object = this.objects.find(obj => obj.id === objectId)

      if (object) {
        object.isSelected = true
        this.selectedObjectId = objectId
      } else {
        console.warn(`selectObject: object with id ${objectId} not found`)
        this.selectedObjectId = null
      }
    },

    /**
     * Снять выделение со всех объектов
     */
    deselectAll() {
      this.objects.forEach(obj => {
        obj.isSelected = false
      })
      this.selectedObjectId = null
    },

    /**
     * Переместить объект на передний план
     * @param {string} objectId - ID объекта
     * @returns {boolean} - true если операция успешна
     */
    bringToFront(objectId) {
      const object = this.objects.find(obj => obj.id === objectId)

      if (!object) {
        console.warn(`bringToFront: object with id ${objectId} not found`)
        return false
      }

      // Находим максимальный zIndex среди всех объектов
      const maxZIndex = this.objects.reduce((max, obj) => {
        const zIndex = obj.zIndex ?? 0
        return Math.max(max, zIndex)
      }, 0)

      // Устанавливаем zIndex = maxZIndex + 1
      object.zIndex = maxZIndex + 1

      return true
    },

    /**
     * Переместить объект на задний план
     * @param {string} objectId - ID объекта
     * @returns {boolean} - true если операция успешна
     */
    sendToBack(objectId) {
      const object = this.objects.find(obj => obj.id === objectId)

      if (!object) {
        console.warn(`sendToBack: object with id ${objectId} not found`)
        return false
      }

      // Находим минимальный zIndex среди всех объектов
      const minZIndex = this.objects.reduce((min, obj) => {
        const zIndex = obj.zIndex ?? 0
        return Math.min(min, zIndex)
      }, 0)

      // Устанавливаем zIndex = minZIndex - 1
      object.zIndex = minZIndex - 1

      return true
    },

    /**
     * Переместить объект вперед на один уровень
     * @param {string} objectId - ID объекта
     * @returns {boolean} - true если операция успешна
     */
    bringForward(objectId) {
      const object = this.objects.find(obj => obj.id === objectId)

      if (!object) {
        console.warn(`bringForward: object with id ${objectId} not found`)
        return false
      }

      const currentZIndex = object.zIndex ?? 0

      // Находим ближайший объект с большим zIndex
      const objectsAbove = this.objects
        .filter(obj => obj.id !== objectId)
        .filter(obj => (obj.zIndex ?? 0) > currentZIndex)
        .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))

      if (objectsAbove.length > 0) {
        // Меняем местами zIndex с ближайшим объектом выше
        const nextObject = objectsAbove[0]
        const nextZIndex = nextObject.zIndex ?? 0
        object.zIndex = nextZIndex
        nextObject.zIndex = currentZIndex
      } else {
        // Если нет объектов выше, просто увеличиваем zIndex
        object.zIndex = currentZIndex + 1
      }

      return true
    },

    /**
     * Переместить объект назад на один уровень
     * @param {string} objectId - ID объекта
     * @returns {boolean} - true если операция успешна
     */
    sendBackward(objectId) {
      const object = this.objects.find(obj => obj.id === objectId)

      if (!object) {
        console.warn(`sendBackward: object with id ${objectId} not found`)
        return false
      }

      const currentZIndex = object.zIndex ?? 0

      // Находим ближайший объект с меньшим zIndex
      const objectsBelow = this.objects
        .filter(obj => obj.id !== objectId)
        .filter(obj => (obj.zIndex ?? 0) < currentZIndex)
        .sort((a, b) => (b.zIndex ?? 0) - (a.zIndex ?? 0))

      if (objectsBelow.length > 0) {
        // Меняем местами zIndex с ближайшим объектом ниже
        const prevObject = objectsBelow[0]
        const prevZIndex = prevObject.zIndex ?? 0
        object.zIndex = prevZIndex
        prevObject.zIndex = currentZIndex
      } else {
        // Если нет объектов ниже, просто уменьшаем zIndex
        object.zIndex = currentZIndex - 1
      }

      return true
    },

    /**
     * Загрузить объекты из массива
     * @param {Array} objectsData - массив объектов для загрузки
     */
    loadObjects(objectsData) {
      if (!Array.isArray(objectsData)) {
        console.error('loadObjects: objectsData must be an array')
        return
      }

      this.objects = objectsData.map(obj => ({
        ...obj,
        isSelected: false // Сбрасываем выделение при загрузке
      }))

      this.selectedObjectId = null
    },

    /**
     * Очистить все объекты
     */
    clearObjects() {
      this.objects = []
      this.selectedObjectId = null
    },

    /**
     * Получить объекты для экспорта
     * @returns {Array} - массив объектов без служебных полей
     */
    getObjectsForExport() {
      return this.objects.map(obj => {
        const { isSelected, ...exportData } = obj
        return exportData
      })
    },

    /**
     * Генерировать уникальный ID для объекта
     * @returns {string} - уникальный ID
     */
    generateObjectId() {
      return 'obj_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
    },

    /**
     * Дублировать объект
     * @param {string} objectId - ID объекта для дублирования
     * @param {Object} offset - смещение для нового объекта {x, y}
     * @returns {Object|null} - новый объект или null
     */
    duplicateObject(objectId, offset = { x: 20, y: 20 }) {
      const object = this.objects.find(obj => obj.id === objectId)

      if (!object) {
        console.warn(`duplicateObject: object with id ${objectId} not found`)
        return null
      }

      // Создаем копию объекта
      const newObject = {
        ...object,
        id: this.generateObjectId(),
        isSelected: false
      }

      // Применяем смещение если у объекта есть координаты
      if (typeof object.x === 'number') {
        newObject.x = object.x + offset.x
      }
      if (typeof object.y === 'number') {
        newObject.y = object.y + offset.y
      }

      // Добавляем новый объект
      return this.addObject(newObject)
    },

    /**
     * Получить объекты по типу
     * @param {string} type - тип объекта
     * @returns {Array} - массив объектов указанного типа
     */
    getObjectsByType(type) {
      return this.objects.filter(obj => obj.type === type)
    },

    /**
     * Удалить все выбранные объекты
     * @returns {number} - количество удаленных объектов
     */
    removeSelectedObjects() {
      const selectedIds = this.objects
        .filter(obj => obj.isSelected)
        .map(obj => obj.id)

      selectedIds.forEach(id => this.removeObject(id))

      return selectedIds.length
    }
  }
})
