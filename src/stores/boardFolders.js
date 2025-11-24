import { defineStore } from 'pinia'
import { useAuthStore } from './auth.js'

// API_URL берем из переменных окружения
const API_URL = import.meta.env.VITE_API_URL || 'https://interactive.marketingfohow.ru/api'

export const useBoardFoldersStore = defineStore('boardFolders', {
  state: () => ({
    folders: [],              // Массив всех папок пользователя
    currentFolderId: null,    // ID текущей открытой папки (null = показываем все доски)
    loading: false,           // Флаг загрузки
    error: null,              // Сообщение об ошибке
    collapsedFolders: {}      // Объект для хранения состояния свёрнутости папок { folderId: true/false }
  }),

  getters: {
    /**
     * Получить папку по ID
     * @param {string|number} id - ID папки
     * @returns {Object|undefined} Папка или undefined
     */
    folderById: (state) => (id) => {
      return state.folders.find(f => f.id === id)
    },

    /**
     * Проверка возможности создания новой папки
     * @returns {boolean} true, если можно создать папку
     */
    canCreateFolder: (state) => {
      const authStore = useAuthStore()
      const user = authStore.user

      if (!user || !user.plan_id) return false

      // Получить лимит из features плана
      const maxFolders = user.subscription_plan?.features?.max_folders || user.plan?.features?.max_folders || 0

      // Если лимит 0 - функция недоступна
      if (maxFolders === 0) return false

      // Если лимит -1 - безлимит
      if (maxFolders === -1) return true

      // Проверить текущее количество папок
      const currentCount = state.folders.length

      return currentCount < maxFolders
    },

    /**
     * Получить лимит на количество папок
     * @returns {number} Лимит папок (0 - недоступно, -1 - безлимит)
     */
    foldersLimit: () => {
      const authStore = useAuthStore()
      const user = authStore.user

      if (!user || !user.plan_id) return 0

      return user.subscription_plan?.features?.max_folders || user.plan?.features?.max_folders || 0
    },

    /**
     * Получить текущее количество папок
     * @returns {number} Количество папок
     */
    foldersCount: (state) => state.folders.length,

    /**
     * Проверить, свёрнута ли папка
     * @param {string|number} folderId - ID папки
     * @returns {boolean} true, если папка свёрнута
     */
    isFolderCollapsed: (state) => (folderId) => {
      return state.collapsedFolders[folderId] || false
    }
  },

  actions: {
    /**
     * Загрузить все папки текущего пользователя
     * @returns {Promise<Array>} Массив папок
     */
    async fetchFolders() {
      this.loading = true
      this.error = null

      try {
        const authStore = useAuthStore()

        if (!authStore.token) {
          throw new Error('Отсутствует токен авторизации')
        }

        const response = await fetch(`${API_URL}/board-folders`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${authStore.token}`,
            'Content-Type': 'application/json'
          }
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || 'Ошибка загрузки папок')
        }

        const data = await response.json()
        this.folders = data.folders || []

        return this.folders
      } catch (error) {
        console.error('Ошибка при загрузке папок:', error)
        this.error = error.message
        throw error
      } finally {
        this.loading = false
      }
    },

    /**
     * Создать новую папку
     * @param {string} name - Название папки
     * @returns {Promise<Object>} Созданная папка
     */
    async createFolder(name) {
      // Проверить возможность создания через getter canCreateFolder
      if (!this.canCreateFolder) {
        const limit = this.foldersLimit
        if (limit === 0) {
          throw new Error('Создание папок недоступно на вашем тарифном плане')
        }
        throw new Error(`Достигнут лимит папок (${limit}). Перейдите на более высокий тариф для создания дополнительных папок.`)
      }

      try {
        const authStore = useAuthStore()

        if (!authStore.token) {
          throw new Error('Отсутствует токен авторизации')
        }

        const response = await fetch(`${API_URL}/board-folders`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authStore.token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ name })
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || 'Ошибка создания папки')
        }

        const data = await response.json()
        const createdFolder = data.folder

        // Добавить созданную папку в массив folders
        this.folders.push(createdFolder)

        // Обновить список папок для синхронизации
        await this.fetchFolders()

        return createdFolder
      } catch (error) {
        console.error('Ошибка при создании папки:', error)
        this.error = error.message
        throw error
      }
    },

    /**
     * Переименовать папку
     * @param {string|number} folderId - ID папки
     * @param {string} newName - Новое название
     * @returns {Promise<Object>} Обновлённая папка
     */
    async renameFolder(folderId, newName) {
      try {
        const authStore = useAuthStore()

        if (!authStore.token) {
          throw new Error('Отсутствует токен авторизации')
        }

        const response = await fetch(`${API_URL}/board-folders/${folderId}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${authStore.token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ name: newName })
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || 'Ошибка переименования папки')
        }

        const data = await response.json()
        const updatedFolder = data.folder

        // Обновить имя папки в массиве folders
        const folderIndex = this.folders.findIndex(f => f.id === folderId)
        if (folderIndex !== -1) {
          this.folders[folderIndex] = { ...this.folders[folderIndex], ...updatedFolder }
        }

        return updatedFolder
      } catch (error) {
        console.error('Ошибка при переименовании папки:', error)
        this.error = error.message
        throw error
      }
    },

    /**
     * Удалить папку со всеми досками
     * @param {string|number} folderId - ID папки
     * @returns {Promise<number>} Количество удалённых досок
     */
    async deleteFolder(folderId) {
      try {
        const authStore = useAuthStore()

        if (!authStore.token) {
          throw new Error('Отсутствует токен авторизации')
        }

        const response = await fetch(`${API_URL}/board-folders/${folderId}?confirm=true`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${authStore.token}`,
            'Content-Type': 'application/json'
          }
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || 'Ошибка удаления папки')
        }

        const data = await response.json()
        const deletedBoardsCount = data.deletedBoardsCount || 0

        // Удалить папку из массива folders
        this.folders = this.folders.filter(f => f.id !== folderId)

        // Удалить состояние свёрнутости из collapsedFolders
        delete this.collapsedFolders[folderId]
        this.saveCollapsedState()

        return deletedBoardsCount
      } catch (error) {
        console.error('Ошибка при удалении папки:', error)
        this.error = error.message
        throw error
      }
    },

    /**
     * Получить доски в папке
     * @param {string|number} folderId - ID папки
     * @returns {Promise<Array>} Массив досок
     */
    async getFolderBoards(folderId) {
      try {
        const authStore = useAuthStore()

        if (!authStore.token) {
          throw new Error('Отсутствует токен авторизации')
        }

        const response = await fetch(`${API_URL}/board-folders/${folderId}/boards`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${authStore.token}`,
            'Content-Type': 'application/json'
          }
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || 'Ошибка загрузки досок папки')
        }

        const data = await response.json()
        return data.boards || []
      } catch (error) {
        console.error('Ошибка при загрузке досок папки:', error)
        this.error = error.message
        throw error
      }
    },

    /**
     * Добавить доску в папку
     * @param {string|number} folderId - ID папки
     * @param {string|number} boardId - ID доски
     * @returns {Promise<Object>} Результат операции
     */
    async addBoardToFolder(folderId, boardId) {
      try {
        const authStore = useAuthStore()

        if (!authStore.token) {
          throw new Error('Отсутствует токен авторизации')
        }

        const response = await fetch(`${API_URL}/board-folders/${folderId}/boards`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authStore.token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ boardId })
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || 'Ошибка добавления доски в папку')
        }

        const data = await response.json()

        // Обновить счётчик досок в папке (board_count)
        const folderIndex = this.folders.findIndex(f => f.id === folderId)
        if (folderIndex !== -1) {
          const currentCount = this.folders[folderIndex].board_count || 0
          this.folders[folderIndex].board_count = currentCount + 1
        }

        return data
      } catch (error) {
        console.error('Ошибка при добавлении доски в папку:', error)
        this.error = error.message
        throw error
      }
    },

    /**
     * Убрать доску из папки
     * @param {string|number} folderId - ID папки
     * @param {string|number} boardId - ID доски
     * @returns {Promise<Object>} Результат операции
     */
    async removeBoardFromFolder(folderId, boardId) {
      try {
        const authStore = useAuthStore()

        if (!authStore.token) {
          throw new Error('Отсутствует токен авторизации')
        }

        const response = await fetch(`${API_URL}/board-folders/${folderId}/boards/${boardId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${authStore.token}`,
            'Content-Type': 'application/json'
          }
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || 'Ошибка удаления доски из папки')
        }

        const data = await response.json()

        // Уменьшить счётчик досок в папке
        const folderIndex = this.folders.findIndex(f => f.id === folderId)
        if (folderIndex !== -1) {
          const currentCount = this.folders[folderIndex].board_count || 0
          this.folders[folderIndex].board_count = Math.max(0, currentCount - 1)
        }

        return data
      } catch (error) {
        console.error('Ошибка при удалении доски из папки:', error)
        this.error = error.message
        throw error
      }
    },

    /**
     * Получить доски вне папок
     * @returns {Promise<Array>} Массив досок без папки
     */
    async getUncategorizedBoards() {
      try {
        const authStore = useAuthStore()

        if (!authStore.token) {
          throw new Error('Отсутствует токен авторизации')
        }

        const response = await fetch(`${API_URL}/boards/uncategorized`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${authStore.token}`,
            'Content-Type': 'application/json'
          }
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || 'Ошибка загрузки досок без папки')
        }

        const data = await response.json()
        return data.boards || []
      } catch (error) {
        console.error('Ошибка при загрузке досок без папки:', error)
        this.error = error.message
        throw error
      }
    },

    /**
     * Установить текущую папку для фильтрации отображения
     * @param {string|number|null} folderId - ID папки или null для показа всех досок
     */
    setCurrentFolder(folderId) {
      this.currentFolderId = folderId
    },

    /**
     * Переключить состояние свёрнутости папки
     * @param {string|number} folderId - ID папки
     */
    toggleFolderCollapse(folderId) {
      // Инвертировать значение в collapsedFolders[folderId]
      this.collapsedFolders[folderId] = !this.collapsedFolders[folderId]

      // Сохранить состояние в localStorage
      this.saveCollapsedState()
    },

    /**
     * Сохранить состояние свёрнутости в localStorage
     */
    saveCollapsedState() {
      try {
        localStorage.setItem('board_folders_collapsed_state', JSON.stringify(this.collapsedFolders))
      } catch (error) {
        console.error('Ошибка сохранения состояния свёрнутости папок:', error)
      }
    },

    /**
     * Загрузить состояние свёрнутости из localStorage
     */
    loadCollapsedState() {
      try {
        const savedState = localStorage.getItem('board_folders_collapsed_state')
        if (savedState) {
          this.collapsedFolders = JSON.parse(savedState)
        }
      } catch (error) {
        console.error('Ошибка загрузки состояния свёрнутости папок:', error)
        this.collapsedFolders = {}
      }
    },

    /**
     * Очистить данные хранилища
     */
    clear() {
      this.folders = []
      this.currentFolderId = null
      this.loading = false
      this.error = null
      this.collapsedFolders = {}
    }
  }
})
