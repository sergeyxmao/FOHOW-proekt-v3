import { defineStore } from 'pinia'
import { useHistoryStore } from './history'

/**
 * Store для управления изображениями на canvas
 */
export const useImagesStore = defineStore('images', {
  state: () => ({
    images: [],
    selectedImageIds: [],
    pendingFocusImageId: null
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
    },

    /**
     * Получить максимальный zIndex среди всех изображений
     * Диапазон для изображений: 1-4 (задний план) и 11-999 (передний план)
     */
    getMaxImageZIndex: (state) => {
      if (state.images.length === 0) return 10 // Минимальный zIndex для первого изображения - 11

      const maxZIndex = state.images.reduce((max, img) => {
        const zIndex = img.zIndex ?? 0
        return Math.max(max, zIndex)
      }, 10)

      return maxZIndex
    },

    /**
     * Получить минимальный zIndex среди изображений в зоне переднего плана (11-999)
     * Используется для определения свободного слота на переднем плане
     */
    getMinForegroundImageZIndex: (state) => {
      const foregroundImages = state.images.filter(img => {
        const zIndex = img.zIndex ?? 0
        return zIndex >= 11 && zIndex <= 999
      })

      if (foregroundImages.length === 0) return 11

      return foregroundImages.reduce((min, img) => {
        const zIndex = img.zIndex ?? 11
        return Math.min(min, zIndex)
      }, 999)
    },

    /**
     * Получить максимальный zIndex среди изображений в зоне переднего плана (11-999)
     * Используется для размещения нового изображения сверху
     */
    getMaxForegroundImageZIndex: (state) => {
      const foregroundImages = state.images.filter(img => {
        const zIndex = img.zIndex ?? 0
        return zIndex >= 11 && zIndex <= 999
      })

      if (foregroundImages.length === 0) return 10 // Вернём 10, чтобы при добавлении 1 получилось 11

      return foregroundImages.reduce((max, img) => {
        const zIndex = img.zIndex ?? 11
        return Math.max(max, zIndex)
      }, 10)
    }
  },

  actions: {
    /**
     * Добавить изображение на canvas
     * @param {Object} imageData - данные изображения
     * @param {string} imageData.name - имя файла
     * @param {number} imageData.imageId - ID изображения из библиотеки (опционально)
     * @param {string} imageData.dataUrl - base64 data URL или blob URL
     * @param {number} imageData.width - оригинальная ширина
     * @param {number} imageData.height - оригинальная высота
     * @param {number} imageData.x - позиция X на доске
     * @param {number} imageData.y - позиция Y на доске
     * @param {Object} options - дополнительные опции
     * @param {boolean} options.saveToHistory - сохранить в историю (по умолчанию true)
     */
    async addImage(imageData, options = {}) {
      const { saveToHistory = true } = options
      // Загружаем blob URL через прокси, если он не передан и есть imageId
      let resolvedDataUrl = imageData.dataUrl

      if (!resolvedDataUrl && imageData.imageId) {
        const { useImageProxy } = await import('@/composables/useImageProxy')
        const { getImageUrl } = useImageProxy()

        try {
          resolvedDataUrl = await getImageUrl(imageData.imageId)
        } catch (error) {
          console.error(`❌ Ошибка загрузки изображения ${imageData.imageId}:`, error)
        }
      }

      // Вычисляем размеры для отображения с учетом максимального размера 500px
      const displaySize = this.calculateDisplaySize(
        imageData.width,
        imageData.height,
        500
      )

      // Генерируем уникальный ID
      const id = 'img_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)

      // Вычисляем zIndex для нового изображения
      // Новое изображение добавляется на передний план (диапазон 11-999)
      // Находим максимальный zIndex среди изображений на переднем плане
      const maxForegroundZIndex = this.getMaxForegroundImageZIndex
      let newZIndex = Math.max(maxForegroundZIndex + 1, 11)

      // Ограничиваем zIndex диапазоном переднего плана (не больше 999)
      // Стикеры имеют zIndex >= 10000 и должны оставаться выше
      newZIndex = Math.min(newZIndex, 999)

      const newImage = {
        id,
        type: 'image',
        imageId: imageData.imageId, // ID из библиотеки
        dataUrl: resolvedDataUrl || imageData.previewDataUrl || imageData.preview_url || imageData.thumbnail || '', // Blob URL для отображения
        previewDataUrl: imageData.previewDataUrl || imageData.preview_url || imageData.thumbnail || null,
        x: imageData.x,
        y: imageData.y,
        width: displaySize.width,
        height: displaySize.height,
        originalWidth: imageData.width,
        originalHeight: imageData.height,
        rotation: 0,
        opacity: 1,
        zIndex: newZIndex,
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
    async loadImages(imagesData) {
      this.images = []
      this.selectedImageIds = []

      if (!Array.isArray(imagesData)) {
        return
      }

      // Импортируем useImageProxy для получения blob URLs
      const { useImageProxy } = await import('@/composables/useImageProxy')
      const { getImageUrl } = useImageProxy()
      // Кэш для поиска imageId по старым URL
      const resolvedLegacyIds = new Map()
      let myLibraryCache = null
      let sharedLibraryCache = null

      const loadMyLibraryOnce = async () => {
        if (myLibraryCache !== null) return myLibraryCache

        try {
          const { getMyImages } = await import('@/services/imageService')
          const response = await getMyImages({ page: 1, limit: 500 })
          myLibraryCache = Array.isArray(response?.items) ? response.items : []
        } catch (error) {
          console.error('❌ Ошибка загрузки личной библиотеки для миграции:', error)
          myLibraryCache = []
        }

        return myLibraryCache
      }

      const loadSharedLibraryOnce = async () => {
        if (sharedLibraryCache !== null) return sharedLibraryCache

        try {
          const { getSharedLibrary } = await import('@/services/imageService')
          const response = await getSharedLibrary()
          sharedLibraryCache = Array.isArray(response?.folders) ? response.folders : []
        } catch (error) {
          console.error('❌ Ошибка загрузки общей библиотеки для миграции:', error)
          sharedLibraryCache = []
        }

        return sharedLibraryCache
      }

      const findImageIdByUrl = async (legacyUrl) => {
        if (!legacyUrl) return null

        if (resolvedLegacyIds.has(legacyUrl)) {
          return resolvedLegacyIds.get(legacyUrl)
        }

        let foundId = null

        try {
          const myImages = await loadMyLibraryOnce()
          const match = myImages.find(img =>
            img.public_url === legacyUrl || img.preview_url === legacyUrl
          )

          if (match?.id) {
            foundId = match.id
          }
        } catch (error) {
          console.error('❌ Ошибка поиска изображения в личной библиотеке:', error)
        }

        if (!foundId) {
          try {
            const sharedFolders = await loadSharedLibraryOnce()

            for (const folder of sharedFolders) {
              const sharedMatch = (folder.images || []).find(img =>
                img.public_url === legacyUrl || img.preview_url === legacyUrl
              )

              if (sharedMatch?.id) {
                foundId = sharedMatch.id
                break
              }
            }
          } catch (error) {
            console.error('❌ Ошибка поиска изображения в общей библиотеке:', error)
          }
        }

        resolvedLegacyIds.set(legacyUrl, foundId)
        return foundId
      }

      const loadLegacyBlob = async (legacyUrl) => {
        if (!legacyUrl) return ''

        try {
          const response = await fetch(legacyUrl)

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`)
          }

          const blob = await response.blob()
          return URL.createObjectURL(blob)
        } catch (error) {
          console.error('❌ Ошибка загрузки изображения по прямой ссылке:', error)
          return ''
        }
      }

      // Загружаем изображения параллельно
      const imagePromises = imagesData.map(async (imageData) => {
        let dataUrl = imageData.dataUrl || ''
        let imageId = imageData.imageId
        const legacyUrl = imageData.originalUrl || imageData.public_url || imageData.preview_url

        // Миграция: если есть старые ссылки, пытаемся найти imageId в библиотеке
        if (!imageId && legacyUrl) {
          imageId = await findImageIdByUrl(legacyUrl)
        }
        // Если есть imageId, получаем свежий blob URL
        if (imageId && !dataUrl) {
          try {
            dataUrl = await getImageUrl(imageId)
          } catch (error) {
            console.error(`❌ Ошибка загрузки изображения ${imageId}:`, error)
          }
        }
        // Фоллбэк для старых данных без imageId
        if (!imageId && !dataUrl && legacyUrl) {
          dataUrl = await loadLegacyBlob(legacyUrl)
        }

        const normalizedImage = {
          id: imageData.id || ('img_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)),
          type: 'image',
          imageId: imageId, // Сохраняем imageId из библиотеки
          dataUrl: dataUrl,
          previewDataUrl: imageData.previewDataUrl || imageData.preview_url || imageData.thumbnail || null,
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

        return normalizedImage
      })

      // Ждем загрузки всех изображений
      this.images = await Promise.all(imagePromises)
    },

    /**
     * Получить изображения для экспорта
     */
    getImagesForExport() {
      return this.images.map(image => {
        const exportData = {
          ...image,
          isSelected: false // Не сохраняем состояние выделения
        }

        // Если есть imageId, не сохраняем blob URL и прямые ссылки (они временные)
        if (image.imageId) {
          delete exportData.dataUrl // Удаляем blob URL, будет получен заново при загрузке
          delete exportData.originalUrl
          delete exportData.public_url
          delete exportData.preview_url
        }

        return exportData
      })
    },

    /**
     * Запросить фокусировку на изображении по ID
     * @param {string} imageId - ID изображения на canvas
     */
    requestFocusOnImage(imageId) {
      this.pendingFocusImageId = imageId
    },

    /**
     * Очистить запрос фокусировки
     */
    clearPendingFocusImage() {
      this.pendingFocusImageId = null
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

      // Находим максимальный zIndex среди изображений на переднем плане (11-999)
      const maxForegroundZIndex = this.getMaxForegroundImageZIndex
      let newZIndex = Math.max(maxForegroundZIndex + 1, 11)

      // Ограничиваем zIndex диапазоном переднего плана (не больше 999)
      // Стикеры имеют zIndex >= 10000 и должны оставаться выше изображений
      newZIndex = Math.min(newZIndex, 999)

      // Устанавливаем новый zIndex
      image.zIndex = newZIndex

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

      // Изображение на заднем плане имеет zIndex от 1 до 4
      // Это позволяет ему быть:
      // - Выше фона (zIndex = 0)
      // - Ниже линий связи (zIndex = 5)
      // - Ниже карточек/лицензий (zIndex = 10)
      // - Ниже изображений на переднем плане (zIndex = 11-999)
      // - Ниже стикеров (zIndex >= 10000)

      // Находим минимальный занятый zIndex в диапазоне 1-4
      const backgroundImages = this.images.filter(img => {
        const zIndex = img.zIndex ?? 0
        return zIndex >= 1 && zIndex <= 4 && img.id !== imageId
      })

      let newZIndex = 1

      // Если есть другие изображения на заднем плане, ставим ниже самого нижнего
      if (backgroundImages.length > 0) {
        const minBackgroundZIndex = backgroundImages.reduce((min, img) => {
          const zIndex = img.zIndex ?? 1
          return Math.min(min, zIndex)
        }, 4)

        newZIndex = Math.max(minBackgroundZIndex - 1, 1)
      }

      // Устанавливаем zIndex в диапазоне заднего плана
      // Ограничиваем диапазоном 1-4
      image.zIndex = Math.max(1, Math.min(newZIndex, 4))

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

      // Вычисляем zIndex для дублированного изображения
      // Дублированное изображение размещается на переднем плане (диапазон 11-999)
      const maxForegroundZIndex = this.getMaxForegroundImageZIndex
      let newZIndex = Math.max(maxForegroundZIndex + 1, 11)

      // Ограничиваем zIndex диапазоном переднего плана (не больше 999)
      newZIndex = Math.min(newZIndex, 999)

      // Создаем копию изображения
      const newImage = {
        ...image,
        id: newId,
        x: image.x + offset.x,
        y: image.y + offset.y,
        zIndex: newZIndex,
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
