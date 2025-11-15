import { defineStore } from 'pinia'
import { useHistoryStore } from './history'

/**
 * Store для управления изображениями на canvas
 */
export const useImagesStore = defineStore('images', {
  state: () => ({
    images: [],
    selectedImageIds: []
  }),

  getters: {
    selectedImages: (state) => {
      return state.images.filter(img => img.isSelected)
    },

    hasSelectedImages: (state) => {
      return state.selectedImages.length > 0
    },

    // Получить изображение по ID
    getImageById: (state) => (imageId) => {
      return state.images.find(img => img.id === imageId)
    }
  },

  actions: {
    /**
     * Добавить изображение на canvas
     * @param {Object} imageData - данные изображения
     * @param {string} imageData.name - имя файла
     * @param {string} imageData.dataUrl - base64 data URL
     * @param {number} imageData.width - оригинальная ширина
     * @param {number} imageData.height - оригинальная высота
     * @param {number} imageData.x - позиция X на доске
     * @param {number} imageData.y - позиция Y на доске
     * @param {Object} options - дополнительные опции
     * @param {boolean} options.saveToHistory - сохранить в историю (по умолчанию true)
     */
    addImage(imageData, options = {}) {
      const { saveToHistory = true } = options

      // Вычисляем размеры для отображения с учетом максимального размера 500px
      const displaySize = this.calculateDisplaySize(
        imageData.width,
        imageData.height,
        500
      )

      // Генерируем уникальный ID
      const id = 'img_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)

      // Вычисляем максимальный zIndex среди существующих изображений
      const maxZIndex = this.images.length > 0
        ? Math.max(...this.images.map(img => img.zIndex || 0))
        : 0

      const newImage = {
        id,
        type: 'image',
        dataUrl: imageData.dataUrl,
        x: imageData.x,
        y: imageData.y,
        width: displaySize.width,
        height: displaySize.height,
        originalWidth: imageData.width,
        originalHeight: imageData.height,
        rotation: 0,
        opacity: 1,
        zIndex: maxZIndex + 1,
        isSelected: true,
        isLocked: false,
        name: imageData.name
      }

      // Снимаем выделение со всех других изображений
      this.deselectAllImages()

      this.images.push(newImage)
      this.selectedImageIds = [id]

      if (saveToHistory) {
        const historyStore = useHistoryStore()
        historyStore.setActionMetadata('create', `Добавлено изображение "${imageData.name}"`)
        historyStore.saveState()
      }

      return newImage
    },

    /**
     * Вычислить размеры изображения для отображения с сохранением пропорций
     * @param {number} originalWidth - оригинальная ширина
     * @param {number} originalHeight - оригинальная высота
     * @param {number} maxSize - максимальный размер (по умолчанию 500)
     * @returns {Object} - объект с width и height
     */
    calculateDisplaySize(originalWidth, originalHeight, maxSize = 500) {
      // Если изображение меньше или равно maxSize, оставляем оригинальные размеры
      if (originalWidth <= maxSize && originalHeight <= maxSize) {
        return { width: originalWidth, height: originalHeight }
      }

      let displayWidth, displayHeight

      // Если ширина больше высоты
      if (originalWidth > originalHeight) {
        displayWidth = maxSize
        displayHeight = (originalHeight / originalWidth) * maxSize
      }
      // Если высота больше ширины
      else if (originalHeight > originalWidth) {
        displayHeight = maxSize
        displayWidth = (originalWidth / originalHeight) * maxSize
      }
      // Если ширина равна высоте
      else {
        displayWidth = maxSize
        displayHeight = maxSize
      }

      return {
        width: Math.round(displayWidth),
        height: Math.round(displayHeight)
      }
    },

    /**
     * Удалить изображение
     * @param {string} imageId - ID изображения
     * @param {Object} options - дополнительные опции
     * @param {boolean} options.saveToHistory - сохранить в историю (по умолчанию true)
     */
    removeImage(imageId, options = {}) {
      const { saveToHistory = true } = options

      const image = this.images.find(img => img.id === imageId)
      if (!image) return false

      const index = this.images.findIndex(img => img.id === imageId)
      if (index !== -1) {
        this.images.splice(index, 1)

        // Удаляем из выбранных
        const selectedIndex = this.selectedImageIds.indexOf(imageId)
        if (selectedIndex > -1) {
          this.selectedImageIds.splice(selectedIndex, 1)
        }

        if (saveToHistory) {
          const historyStore = useHistoryStore()
          historyStore.setActionMetadata('delete', `Удалено изображение "${image.name}"`)
          historyStore.saveState()
        }

        return true
      }

      return false
    },

    /**
     * Обновить позицию изображения
     * @param {string} imageId - ID изображения
     * @param {number} x - новая позиция X
     * @param {number} y - новая позиция Y
     * @param {Object} options - дополнительные опции
     * @param {boolean} options.saveToHistory - сохранить в историю (по умолчанию true)
     */
    updateImagePosition(imageId, x, y, options = {}) {
      const { saveToHistory = true } = options

      const image = this.images.find(img => img.id === imageId)
      if (image) {
        image.x = x
        image.y = y

        if (saveToHistory) {
          const historyStore = useHistoryStore()
          historyStore.setActionMetadata('update', `Перемещено изображение "${image.name}"`)
          historyStore.saveState()
        }
      }
      return image
    },

    /**
     * Обновить свойства изображения
     * @param {string} imageId - ID изображения
     * @param {Object} updates - объект с обновлениями
     * @param {Object} options - дополнительные опции
     * @param {boolean} options.saveToHistory - сохранить в историю (по умолчанию true)
     */
    updateImage(imageId, updates = {}, options = {}) {
      const { saveToHistory = true } = options

      const image = this.images.find(img => img.id === imageId)
      if (!image) return null

      Object.assign(image, updates)

      if (saveToHistory) {
        const historyStore = useHistoryStore()
        historyStore.setActionMetadata('update', `Обновлено изображение "${image.name}"`)
        historyStore.saveState()
      }

      return image
    },

    /**
     * Выбрать изображение
     */
    selectImage(imageId) {
      const image = this.images.find(img => img.id === imageId)
      if (image && !image.isSelected) {
        image.isSelected = true
        this.selectedImageIds.push(imageId)
      }
    },

    /**
     * Снять выделение с изображения
     */
    deselectImage(imageId) {
      const image = this.images.find(img => img.id === imageId)
      if (image && image.isSelected) {
        image.isSelected = false
        const index = this.selectedImageIds.indexOf(imageId)
        if (index > -1) {
          this.selectedImageIds.splice(index, 1)
        }
      }
    },

    /**
     * Переключить выделение изображения
     */
    toggleImageSelection(imageId) {
      const image = this.images.find(img => img.id === imageId)
      if (image) {
        if (image.isSelected) {
          this.deselectImage(imageId)
        } else {
          this.selectImage(imageId)
        }
      }
    },

    /**
     * Снять выделение со всех изображений
     */
    deselectAllImages() {
      this.images.forEach(image => {
        image.isSelected = false
      })
      this.selectedImageIds = []
    },

    /**
     * Выбрать все изображения
     */
    selectAllImages() {
      this.images.forEach(image => {
        image.isSelected = true
      })
      this.selectedImageIds = this.images.map(img => img.id)
    },

    /**
     * Загрузить изображения из данных
     */
    loadImages(imagesData) {
      this.images = []
      this.selectedImageIds = []

      if (!Array.isArray(imagesData)) {
        return
      }

      imagesData.forEach(imageData => {
        const normalizedImage = {
          id: imageData.id || ('img_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)),
          type: 'image',
          dataUrl: imageData.dataUrl || '',
          x: Number.isFinite(imageData.x) ? imageData.x : 0,
          y: Number.isFinite(imageData.y) ? imageData.y : 0,
          width: Number.isFinite(imageData.width) ? imageData.width : 100,
          height: Number.isFinite(imageData.height) ? imageData.height : 100,
          originalWidth: Number.isFinite(imageData.originalWidth) ? imageData.originalWidth : imageData.width,
          originalHeight: Number.isFinite(imageData.originalHeight) ? imageData.originalHeight : imageData.height,
          rotation: Number.isFinite(imageData.rotation) ? imageData.rotation : 0,
          opacity: Number.isFinite(imageData.opacity) ? imageData.opacity : 1,
          zIndex: Number.isFinite(imageData.zIndex) ? imageData.zIndex : 0,
          isSelected: false,
          isLocked: Boolean(imageData.isLocked),
          name: imageData.name || 'image.png'
        }

        this.images.push(normalizedImage)
      })
    },

    /**
     * Получить изображения для экспорта
     */
    getImagesForExport() {
      return this.images.map(image => ({
        ...image,
        isSelected: false // Не сохраняем состояние выделения
      }))
    },

    /**
     * Очистить все изображения
     */
    clearImages() {
      this.images = []
      this.selectedImageIds = []
    },

    /**
     * Переместить изображение на передний план
     * @param {string} imageId - ID изображения
     * @param {Object} options - дополнительные опции
     * @param {boolean} options.saveToHistory - сохранить в историю (по умолчанию true)
     * @returns {boolean} - true если операция успешна
     */
    bringToFront(imageId, options = {}) {
      const { saveToHistory = true } = options

      const image = this.images.find(img => img.id === imageId)
      if (!image) {
        console.warn(`bringToFront: image with id ${imageId} not found`)
        return false
      }

      // Находим максимальный zIndex среди всех изображений
      const maxZIndex = this.images.reduce((max, img) => {
        const zIndex = img.zIndex ?? 0
        return Math.max(max, zIndex)
      }, 0)

      // Устанавливаем zIndex = maxZIndex + 1
      image.zIndex = maxZIndex + 1

      if (saveToHistory) {
        const historyStore = useHistoryStore()
        historyStore.setActionMetadata('update', `Изображение "${image.name}" перемещено на передний план`)
        historyStore.saveState()
      }

      return true
    },

    /**
     * Переместить изображение на задний план
     * @param {string} imageId - ID изображения
     * @param {Object} options - дополнительные опции
     * @param {boolean} options.saveToHistory - сохранить в историю (по умолчанию true)
     * @returns {boolean} - true если операция успешна
     */
    sendToBack(imageId, options = {}) {
      const { saveToHistory = true } = options

      const image = this.images.find(img => img.id === imageId)
      if (!image) {
        console.warn(`sendToBack: image with id ${imageId} not found`)
        return false
      }

      // Находим минимальный zIndex среди всех изображений
      const minZIndex = this.images.reduce((min, img) => {
        const zIndex = img.zIndex ?? 0
        return Math.min(min, zIndex)
      }, 0)

      // Устанавливаем zIndex = minZIndex - 1
      image.zIndex = minZIndex - 1

      if (saveToHistory) {
        const historyStore = useHistoryStore()
        historyStore.setActionMetadata('update', `Изображение "${image.name}" перемещено на задний план`)
        historyStore.saveState()
      }

      return true
    },

    /**
     * Дублировать изображение
     * @param {string} imageId - ID изображения для дублирования
     * @param {Object} offset - смещение для нового изображения {x, y}
     * @param {Object} options - дополнительные опции
     * @param {boolean} options.saveToHistory - сохранить в историю (по умолчанию true)
     * @returns {Object|null} - новое изображение или null
     */
    duplicateImage(imageId, offset = { x: 20, y: 20 }, options = {}) {
      const { saveToHistory = true } = options

      const image = this.images.find(img => img.id === imageId)
      if (!image) {
        console.warn(`duplicateImage: image with id ${imageId} not found`)
        return null
      }

      // Генерируем новый ID
      const newId = 'img_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)

      // Вычисляем максимальный zIndex среди существующих изображений
      const maxZIndex = this.images.length > 0
        ? Math.max(...this.images.map(img => img.zIndex || 0))
        : 0

      // Создаем копию изображения
      const newImage = {
        ...image,
        id: newId,
        x: image.x + offset.x,
        y: image.y + offset.y,
        zIndex: maxZIndex + 1,
        isSelected: false
      }

      // Снимаем выделение со всех изображений
      this.deselectAllImages()

      // Добавляем новое изображение
      this.images.push(newImage)

      // Выделяем новое изображение
      newImage.isSelected = true
      this.selectedImageIds = [newId]

      if (saveToHistory) {
        const historyStore = useHistoryStore()
        historyStore.setActionMetadata('create', `Дублировано изображение "${image.name}"`)
        historyStore.saveState()
      }

      return newImage
    }
  }
})
