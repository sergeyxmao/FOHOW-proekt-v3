import { defineStore } from 'pinia'
import { useAuthStore } from './auth'
import router from '../router'

const API_URL = import.meta.env.VITE_API_URL || 'https://interactive.marketingfohow.ru/api'

/**
 * Обработка ответов с ошибками авторизации (401/403)
 * @param {Response} response - Ответ от сервера
 * @param {string} defaultMessage - Сообщение по умолчанию
 * @returns {Promise<never>}
 */
async function handleAdminErrorResponse(response, defaultMessage = 'Произошла ошибка') {
  const authStore = useAuthStore()

  let data
  try {
    data = await response.json()
  } catch (e) {
    // Если не удалось распарсить JSON, используем статус код
    data = {}
  }

  const error = new Error(data.error || defaultMessage)
  error.code = data.code
  error.status = response.status

  // Обработка специфических HTTP статус кодов
  switch (response.status) {
    case 401:
      error.code = error.code || 'UNAUTHORIZED'
      error.message = 'Сессия истекла. Пожалуйста, войдите в систему снова.'
      // Выполняем logout и редирект на главную
      await authStore.logout()
      router.push('/')
      break
    case 403:
      error.code = error.code || 'FORBIDDEN'
      error.message = data.error || 'Недостаточно прав для выполнения этого действия.'
      break
    default:
      error.message = data.error || defaultMessage
  }

  throw error
}

export const useAdminStore = defineStore('admin', {
  state: () => ({
    users: [],
    selectedUser: null,
    stats: null,
    logs: [],
    pendingImages: [],
    pendingImagesTotal: 0,
    pendingVerifications: [],
    pendingVerificationsTotal: 0,
    sharedFolders: [],
    sharedFoldersWithDetails: [],
    currentFolderImages: [],
    isLoading: false,
    isLoadingImages: false,
    isLoadingVerifications: false,
    error: null,
    pagination: {
      page: 1,
      limit: 50,
      total: 0,
      totalPages: 0
    }
  }),

  getters: {
    isAdmin: () => {
      const authStore = useAuthStore()
      return authStore.user?.role === 'admin'
    },

    hasUsers: (state) => {
      return state.users.length > 0
    },

    totalUsers: (state) => {
      return state.pagination.total
    }
  },

  actions: {
    /**
     * Получить список пользователей с пагинацией и поиском
     */
    async fetchUsers({ page = 1, limit = 50, search = '', sortBy = 'created_at', sortOrder = 'DESC' } = {}) {
      this.isLoading = true
      this.error = null

      try {
        const authStore = useAuthStore()
        const params = new URLSearchParams({
          page: page.toString(),
          limit: limit.toString(),
          search,
          sortBy,
          sortOrder
        })

        const response = await fetch(`${API_URL}/admin/users?${params}`, {
          headers: {
            'Authorization': `Bearer ${authStore.token}`
          }
        })

        if (!response.ok) {
          throw new Error(`Ошибка ${response.status}: ${response.statusText}`)
        }

        const data = await response.json()
        this.users = data.data
        this.pagination = data.pagination

        return data
      } catch (err) {
        console.error('[ADMIN] Ошибка загрузки пользователей:', err)
        this.error = err.message
        throw err
      } finally {
        this.isLoading = false
      }
    },

    /**
     * Получить детальную информацию о пользователе
     */
    async fetchUserDetails(userId) {
      this.isLoading = true
      this.error = null

      try {
        const authStore = useAuthStore()
        const response = await fetch(`${API_URL}/admin/users/${userId}`, {
          headers: {
            'Authorization': `Bearer ${authStore.token}`
          }
        })

        if (!response.ok) {
          throw new Error(`Ошибка ${response.status}: ${response.statusText}`)
        }

        const data = await response.json()
        this.selectedUser = data.user

        return data
      } catch (err) {
        console.error('[ADMIN] Ошибка загрузки данных пользователя:', err)
        this.error = err.message
        throw err
      } finally {
        this.isLoading = false
      }
    },

    /**
     * Изменить роль пользователя
     */
    async changeUserRole(userId, role) {
      this.isLoading = true
      this.error = null

      try {
        const authStore = useAuthStore()
        const response = await fetch(`${API_URL}/admin/users/${userId}/role`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${authStore.token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ role })
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || `Ошибка ${response.status}`)
        }

        const data = await response.json()

        // Обновляем пользователя в списке
        const userIndex = this.users.findIndex(u => u.id === userId)
        if (userIndex !== -1) {
          this.users[userIndex] = { ...this.users[userIndex], role }
        }

        // Обновляем выбранного пользователя
        if (this.selectedUser?.id === userId) {
          this.selectedUser = { ...this.selectedUser, role }
        }

        return data
      } catch (err) {
        console.error('[ADMIN] Ошибка изменения роли:', err)
        this.error = err.message
        throw err
      } finally {
        this.isLoading = false
      }
    },

    /**
     * Изменить тарифный план пользователя
     */
    async changeUserPlan(userId, planId, duration = 30) {
      this.isLoading = true
      this.error = null

      try {
        const authStore = useAuthStore()
        const response = await fetch(`${API_URL}/admin/users/${userId}/plan`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${authStore.token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ planId, duration })
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || `Ошибка ${response.status}`)
        }

        const data = await response.json()

        // Обновляем пользователя в списке
        const userIndex = this.users.findIndex(u => u.id === userId)
        if (userIndex !== -1) {
          this.users[userIndex] = {
            ...this.users[userIndex],
            plan_id: planId,
            plan_name: data.plan.name
          }
        }

        return data
      } catch (err) {
        console.error('[ADMIN] Ошибка изменения плана:', err)
        this.error = err.message
        throw err
      } finally {
        this.isLoading = false
      }
    },

    /**
     * Удалить пользователя
     */
    async deleteUser(userId) {
      this.isLoading = true
      this.error = null

      try {
        const authStore = useAuthStore()
        const response = await fetch(`${API_URL}/admin/users/${userId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${authStore.token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ confirm: true })
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || `Ошибка ${response.status}`)
        }

        const data = await response.json()

        // Удаляем пользователя из списка
        this.users = this.users.filter(u => u.id !== userId)
        this.pagination.total--

        // Очищаем выбранного пользователя, если он был удален
        if (this.selectedUser?.id === userId) {
          this.selectedUser = null
        }

        return data
      } catch (err) {
        console.error('[ADMIN] Ошибка удаления пользователя:', err)
        this.error = err.message
        throw err
      } finally {
        this.isLoading = false
      }
    },

    /**
     * Получить общую статистику
     */
    async fetchStats() {
      this.isLoading = true
      this.error = null

      try {
        const authStore = useAuthStore()
        const response = await fetch(`${API_URL}/admin/stats`, {
          headers: {
            'Authorization': `Bearer ${authStore.token}`
          }
        })

        if (!response.ok) {
          throw new Error(`Ошибка ${response.status}: ${response.statusText}`)
        }

        const data = await response.json()
        this.stats = data

        return data
      } catch (err) {
        console.error('[ADMIN] Ошибка загрузки статистики:', err)
        this.error = err.message
        throw err
      } finally {
        this.isLoading = false
      }
    },

    /**
     * Получить системные логи
     */
    async fetchLogs({ page = 1, limit = 100, level = null } = {}) {
      this.isLoading = true
      this.error = null

      try {
        const authStore = useAuthStore()
        const params = new URLSearchParams({
          page: page.toString(),
          limit: limit.toString()
        })
        if (level) {
          params.append('level', level)
        }

        const response = await fetch(`${API_URL}/admin/logs?${params}`, {
          headers: {
            'Authorization': `Bearer ${authStore.token}`
          }
        })

        if (!response.ok) {
          throw new Error(`Ошибка ${response.status}: ${response.statusText}`)
        }

        const data = await response.json()
        this.logs = data.logs

        return data
      } catch (err) {
        console.error('[ADMIN] Ошибка загрузки логов:', err)
        this.error = err.message
        throw err
      } finally {
        this.isLoading = false
      }
    },

    /**
     * Завершить сессию пользователя
     */
    async terminateSession(sessionId) {
      this.isLoading = true
      this.error = null

      try {
        const authStore = useAuthStore()
        const response = await fetch(`${API_URL}/admin/sessions/${sessionId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${authStore.token}`
          }
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || `Ошибка ${response.status}`)
        }

        return await response.json()
      } catch (err) {
        console.error('[ADMIN] Ошибка завершения сессии:', err)
        this.error = err.message
        throw err
      } finally {
        this.isLoading = false
      }
    },

    /**
     * Завершить все сессии пользователя
     */
    async terminateUserSessions(userId) {
      this.isLoading = true
      this.error = null

      try {
        const authStore = useAuthStore()
        const response = await fetch(`${API_URL}/admin/users/${userId}/sessions`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${authStore.token}`
          }
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || `Ошибка ${response.status}`)
        }

        return await response.json()
      } catch (err) {
        console.error('[ADMIN] Ошибка завершения сессий пользователя:', err)
        this.error = err.message
        throw err
      } finally {
        this.isLoading = false
      }
    },

    /**
     * Очистить ошибки
     */
    clearError() {
      this.error = null
    },

    /**
     * Очистить выбранного пользователя
     */
    clearSelectedUser() {
      this.selectedUser = null
    },

    /**
     * Получить список изображений, ожидающих модерации
     */
    async fetchPendingImages() {
      this.isLoading = true
      this.error = null

      try {
        const authStore = useAuthStore()
        const response = await fetch(`${API_URL}/admin/images/pending`, {
          headers: {
            'Authorization': `Bearer ${authStore.token}`
          }
        })

        if (!response.ok) {
          await handleAdminErrorResponse(response, 'Ошибка загрузки изображений на модерации')

          return          
        }

        const data = await response.json()

        // Формируем объекты изображений с правильным previewUrl
        this.pendingImages = (data.items || []).map(image => ({
          id: image.id,
          previewUrl: image.public_url || image.yandex_path || '',
          original_name: image.original_name,
          file_size: image.file_size,
          width: image.width,
          height: image.height,
          share_requested_at: image.share_requested_at,
          user_full_name: image.user_full_name,
          user_personal_id: image.user_personal_id,
          // Сохраняем также оригинальный public_url для совместимости
          public_url: image.public_url,
          yandex_path: image.yandex_path
        }))

        // Сохраняем общее количество изображений
        this.pendingImagesTotal = data.total || 0

        return data
      } catch (err) {
        console.error('[ADMIN] Ошибка загрузки изображений на модерации:', err)
        this.error = err.message
        throw err
      } finally {
        this.isLoading = false
      }
    },

    /**
     * Получить список папок для общей библиотеки
     * Использует GET /api/admin/shared-folders и извлекает только id и name из папок
     */
    async fetchSharedFolders() {
      this.error = null

      try {
        const authStore = useAuthStore()
        const response = await fetch(`${API_URL}/admin/shared-folders`, {
          headers: {
            'Authorization': `Bearer ${authStore.token}`
          }
        })

        if (!response.ok) {
          await handleAdminErrorResponse(response, 'Ошибка загрузки папок общей библиотеки')

          return          
        }

        const data = await response.json()

        // Извлекаем только id и name из каждой папки
        this.sharedFolders = (data.folders || []).map(folder => ({
          id: folder.id,
          name: folder.name
        }))

        return data
      } catch (err) {
        console.error('[ADMIN] Ошибка загрузки папок:', err)
        this.error = err.message
        throw err
      }
    },

    /**
     * Одобрить изображение и переместить в общую библиотеку
     * @param {number} imageId - ID изображения
     * @param {string} folderName - Название папки в общей библиотеке (существующей или новой)
     */
    async approveImage(imageId, folderName) {
      this.isLoading = true
      this.error = null

      try {
        const authStore = useAuthStore()
        const response = await fetch(`${API_URL}/admin/images/${imageId}/approve`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authStore.token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ folder_name: folderName })
        })

        if (!response.ok) {
          await handleAdminErrorResponse(response, 'Ошибка одобрения изображения')

          return          
        }

        const data = await response.json()

        // Удаляем изображение из списка ожидающих модерации
        this.pendingImages = this.pendingImages.filter(img => img.id !== imageId)

        // Обновляем счётчик pending_count
        if (this.pendingImagesTotal > 0) {
          this.pendingImagesTotal--
        }

        return data
      } catch (err) {
        console.error('[ADMIN] Ошибка одобрения изображения:', err)
        this.error = err.message
        throw err
      } finally {
        this.isLoading = false
      }
    },

    /**
     * Отклонить изображение и удалить его
     */
    async rejectImage(imageId) {
      this.isLoading = true
      this.error = null

      try {
        const authStore = useAuthStore()
        const response = await fetch(`${API_URL}/admin/images/${imageId}/reject`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authStore.token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({})
        })

        if (!response.ok) {
          await handleAdminErrorResponse(response, 'Ошибка отклонения изображения')

          return          
        }

        const data = await response.json()

        // Удаляем изображение из списка ожидающих модерации
        this.pendingImages = this.pendingImages.filter(img => img.id !== imageId)

        // Обновляем счётчик pending_count
        if (this.pendingImagesTotal > 0) {
          this.pendingImagesTotal--
        }

        return data
      } catch (err) {
        console.error('[ADMIN] Ошибка отклонения изображения:', err)
        this.error = err.message
        throw err
      } finally {
        this.isLoading = false
      }
    },

    /**
     * Получить список папок общей библиотеки с количеством изображений
     * Использует GET /api/admin/shared-folders
     */
    async fetchSharedFoldersWithDetails() {
      this.isLoading = true
      this.error = null

      try {
        const authStore = useAuthStore()
        const response = await fetch(`${API_URL}/admin/shared-folders`, {
          headers: {
            'Authorization': `Bearer ${authStore.token}`
          }
        })

        if (!response.ok) {
          await handleAdminErrorResponse(response, 'Ошибка загрузки папок общей библиотеки')

          return          
        }

        const data = await response.json()
        this.sharedFoldersWithDetails = data.folders || []

        return data
      } catch (err) {
        console.error('[ADMIN] Ошибка загрузки папок:', err)
        this.error = err.message
        throw err
      } finally {
        this.isLoading = false
      }
    },

    /**
     * Создать новую папку в общей библиотеке
     * @param {string} name - Название папки
     */
    async createSharedFolder(name) {
      this.isLoading = true
      this.error = null

      try {
        const authStore = useAuthStore()
        const response = await fetch(`${API_URL}/admin/shared-folders`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authStore.token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ name })
        })

        if (!response.ok) {
          await handleAdminErrorResponse(response, 'Ошибка создания папки')

          return          
        }

        const newFolder = await response.json()

        // Добавляем новую папку в список
        this.sharedFoldersWithDetails.push(newFolder)
        this.sharedFolders.push({ id: newFolder.id, name: newFolder.name })

        return newFolder
      } catch (err) {
        console.error('[ADMIN] Ошибка создания папки:', err)
        this.error = err.message
        throw err
      } finally {
        this.isLoading = false
      }
    },
    /**
     * Переименовать папку в общей библиотеке
     * @param {number} folderId - ID папки
     * @param {string} name - Новое название папки
     */
    async renameSharedFolder(folderId, name) {
      this.isLoading = true
      this.error = null

      try {
        const authStore = useAuthStore()
        const response = await fetch(`${API_URL}/admin/shared-folders/${folderId}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${authStore.token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ name })
        })

        if (!response.ok) {
          await handleAdminErrorResponse(response, 'Ошибка переименования папки')

          return          
        }

        const updatedFolder = await response.json()

        // Обновляем папку в расширенном списке
        const folderIndex = this.sharedFoldersWithDetails.findIndex(f => f.id === folderId)
        if (folderIndex !== -1) {
          this.sharedFoldersWithDetails[folderIndex] = {
            ...this.sharedFoldersWithDetails[folderIndex],
            ...updatedFolder
          }
        }

        // Обновляем папку в кратком списке
        const shortIndex = this.sharedFolders.findIndex(f => f.id === folderId)
        if (shortIndex !== -1) {
          this.sharedFolders[shortIndex] = {
            ...this.sharedFolders[shortIndex],
            name: updatedFolder.name
          }
        }

        return updatedFolder
      } catch (err) {
        console.error('[ADMIN] Ошибка переименования папки:', err)
        this.error = err.message
        throw err
      } finally {
        this.isLoading = false
      }
    },

    /**
     * Удалить папку общей библиотеки
     * @param {number} folderId - ID папки
     */
    async deleteSharedFolder(folderId) {
      this.isLoading = true
      this.error = null

      try {
        const authStore = useAuthStore()
        const response = await fetch(`${API_URL}/admin/shared-folders/${folderId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${authStore.token}`
          }
        })

        if (!response.ok && response.status !== 204) {
          await handleAdminErrorResponse(response, 'Ошибка удаления папки')
        }

        // Удаляем папку из списков
        this.sharedFoldersWithDetails = this.sharedFoldersWithDetails.filter(folder => folder.id !== folderId)
        this.sharedFolders = this.sharedFolders.filter(folder => folder.id !== folderId)
        this.currentFolderImages = []

        return { success: true }
      } catch (err) {
        console.error('[ADMIN] Ошибка удаления папки:', err)
        this.error = err.message
        throw err
      } finally {
        this.isLoading = false
      }
    },

    /**
     * Получить изображения из конкретной папки
     * @param {number} folderId - ID папки
     */
    async fetchFolderImages(folderId) {
      this.isLoadingImages = true
      this.error = null

      try {
        const authStore = useAuthStore()
        const response = await fetch(`${API_URL}/images/shared`, {
          headers: {
            'Authorization': `Bearer ${authStore.token}`
          }
        })

        if (!response.ok) {
          await handleAdminErrorResponse(response, 'Ошибка загрузки изображений')

          return          
        }

        const data = await response.json()

        // Находим нужную папку и извлекаем её изображения
        const folder = (data.folders || []).find(f => f.id === folderId)
        this.currentFolderImages = folder ? (folder.images || []) : []

        return this.currentFolderImages
      } catch (err) {
        console.error('[ADMIN] Ошибка загрузки изображений папки:', err)
        this.error = err.message
        throw err
      } finally {
        this.isLoadingImages = false
      }
    },

    /**
     * Загрузить изображение в общую библиотеку
     * @param {File} file - Файл изображения
     * @param {number} sharedFolderId - ID папки
     * @param {number} width - Ширина изображения
     * @param {number} height - Высота изображения
     */
    async uploadSharedImage(file, sharedFolderId, width, height) {
      this.isLoading = true
      this.error = null

      try {
        const authStore = useAuthStore()
        const formData = new FormData()
        formData.append('file', file)
        formData.append('shared_folder_id', sharedFolderId.toString())
        if (width) formData.append('width', width.toString())
        if (height) formData.append('height', height.toString())

        const response = await fetch(`${API_URL}/admin/images/upload-shared`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authStore.token}`
          },
          body: formData
        })

        if (!response.ok) {
          await handleAdminErrorResponse(response, 'Ошибка загрузки изображения')

          return          
        }

        const newImage = await response.json()

        // Добавляем новое изображение в список текущей папки, если она открыта
        if (this.currentFolderImages.length >= 0) {
          this.currentFolderImages.push(newImage)
        }

        // Обновляем счётчик изображений в папке
        const folderIndex = this.sharedFoldersWithDetails.findIndex(f => f.id === sharedFolderId)
        if (folderIndex !== -1) {
          this.sharedFoldersWithDetails[folderIndex].images_count =
            (this.sharedFoldersWithDetails[folderIndex].images_count || 0) + 1
        }

        return newImage
      } catch (err) {
        console.error('[ADMIN] Ошибка загрузки изображения:', err)
        this.error = err.message
        throw err
      } finally {
        this.isLoading = false
      }
    },

    /**
     * Переместить изображение в другую папку
     * @param {number} imageId - ID изображения
     * @param {number} newFolderId - ID новой папки
     * @param {number} currentFolderId - ID текущей папки (для обновления списка)
     */
    async moveImageToFolder(imageId, newFolderId, currentFolderId) {
      this.isLoading = true
      this.error = null

      try {
        const authStore = useAuthStore()
        const response = await fetch(`${API_URL}/admin/images/${imageId}/move-to-folder`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authStore.token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ shared_folder_id: newFolderId })
        })

        if (!response.ok) {
          await handleAdminErrorResponse(response, 'Ошибка перемещения изображения')

          return          
        }

        const data = await response.json()

        // Если переместили в другую папку, удаляем из текущего списка
        if (newFolderId !== currentFolderId) {
          this.currentFolderImages = this.currentFolderImages.filter(img => img.id !== imageId)

          // Обновляем счётчики в папках
          const oldFolderIndex = this.sharedFoldersWithDetails.findIndex(f => f.id === currentFolderId)
          if (oldFolderIndex !== -1 && this.sharedFoldersWithDetails[oldFolderIndex].images_count > 0) {
            this.sharedFoldersWithDetails[oldFolderIndex].images_count--
          }

          const newFolderIndex = this.sharedFoldersWithDetails.findIndex(f => f.id === newFolderId)
          if (newFolderIndex !== -1) {
            this.sharedFoldersWithDetails[newFolderIndex].images_count =
              (this.sharedFoldersWithDetails[newFolderIndex].images_count || 0) + 1
          }
        }

        return data
      } catch (err) {
        console.error('[ADMIN] Ошибка перемещения изображения:', err)
        this.error = err.message
        throw err
      } finally {
        this.isLoading = false
      }
    },

    /**
     * Удалить изображение из общей библиотеки
     * @param {number} imageId - ID изображения
     * @param {number} folderId - ID папки (для обновления списка)
     */
    async deleteSharedImage(imageId, folderId) {
      this.isLoading = true
      this.error = null

      try {
        const authStore = useAuthStore()
        const response = await fetch(`${API_URL}/admin/images/${imageId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${authStore.token}`
          }
        })

        if (!response.ok && response.status !== 204) {
          await handleAdminErrorResponse(response, 'Ошибка удаления изображения')
        }

        // Удаляем изображение из списка
        this.currentFolderImages = this.currentFolderImages.filter(img => img.id !== imageId)

        // Обновляем счётчик изображений в папке
        if (folderId) {
          const folderIndex = this.sharedFoldersWithDetails.findIndex(f => f.id === folderId)
          if (folderIndex !== -1 && this.sharedFoldersWithDetails[folderIndex].images_count > 0) {
            this.sharedFoldersWithDetails[folderIndex].images_count--
          }
        }

        return { success: true }
      } catch (err) {
        console.error('[ADMIN] Ошибка удаления изображения:', err)
        this.error = err.message
        throw err
      } finally {
        this.isLoading = false
      }
    },

    /**
     * Переименовать изображение в общей библиотеке
     * @param {number} imageId - ID изображения
     * @param {string} newName - Новое имя изображения
     */
    async renameImage(imageId, newName) {
      this.isLoading = true
      this.error = null

      try {
        const authStore = useAuthStore()
        const response = await fetch(`${API_URL}/admin/images/${imageId}/rename`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${authStore.token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ new_name: newName })
        })

        if (!response.ok) {
          await handleAdminErrorResponse(response, 'Ошибка переименования изображения')

           return         
        }

        const data = await response.json()

        console.log(`[ADMIN] Изображение переименовано: image_id=${imageId}, boards_updated=${data.boards_updated}`)

        return data

      } catch (err) {
        console.error('[ADMIN] Ошибка переименования изображения:', err)
        this.error = err.message
        throw err
      } finally {
        this.isLoading = false
      }
    },

    /**
     * Получить список заявок на верификацию
     */
    async fetchPendingVerifications() {
      this.isLoadingVerifications = true
      this.error = null

      try {
        const authStore = useAuthStore()
        const response = await fetch(`${API_URL}/admin/verifications/pending`, {
          headers: {
            'Authorization': `Bearer ${authStore.token}`
          }
        })

        if (!response.ok) {
          await handleAdminErrorResponse(response, 'Ошибка загрузки заявок на верификацию')

           return         
        }

        const data = await response.json()
        this.pendingVerifications = data.items || []
        this.pendingVerificationsTotal = data.total || 0

        return data
      } catch (err) {
        console.error('[ADMIN] Ошибка загрузки заявок на верификацию:', err)
        this.error = err.message
        throw err
      } finally {
        this.isLoadingVerifications = false
      }
    },

    /**
     * Одобрить заявку на верификацию
     * @param {number} verificationId - ID заявки
     */
    async approveVerification(verificationId) {
      this.isLoading = true
      this.error = null

      try {
        const authStore = useAuthStore()
        const response = await fetch(`${API_URL}/admin/verifications/${verificationId}/approve`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authStore.token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({})
        })

        if (!response.ok) {
          await handleAdminErrorResponse(response, 'Ошибка одобрения заявки')

          return          
        }

        const data = await response.json()

        // Удаляем заявку из списка ожидающих
        this.pendingVerifications = this.pendingVerifications.filter(v => v.id !== verificationId)
        if (this.pendingVerificationsTotal > 0) {
          this.pendingVerificationsTotal--
        }

        return data
      } catch (err) {
        console.error('[ADMIN] Ошибка одобрения заявки:', err)
        this.error = err.message
        throw err
      } finally {
        this.isLoading = false
      }
    },

    /**
     * Отклонить заявку на верификацию
     * @param {number} verificationId - ID заявки
     * @param {string} rejectionReason - Причина отклонения
     */
    async rejectVerification(verificationId, rejectionReason) {
      this.isLoading = true
      this.error = null

      try {
        const authStore = useAuthStore()
        const response = await fetch(`${API_URL}/admin/verifications/${verificationId}/reject`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authStore.token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ rejection_reason: rejectionReason })
        })

        if (!response.ok) {
          await handleAdminErrorResponse(response, 'Ошибка отклонения заявки')

          return         
        }

        const data = await response.json()

        // Удаляем заявку из списка ожидающих
        this.pendingVerifications = this.pendingVerifications.filter(v => v.id !== verificationId)
        if (this.pendingVerificationsTotal > 0) {
          this.pendingVerificationsTotal--
        }

        return data
      } catch (err) {
        console.error('[ADMIN] Ошибка отклонения заявки:', err)
        this.error = err.message
        throw err
      } finally {
        this.isLoading = false
      }
    }
  }
})
