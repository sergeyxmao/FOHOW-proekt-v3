import { defineStore } from 'pinia'
import { useAuthStore } from './auth'

const API_URL = import.meta.env.VITE_API_URL || 'https://interactive.marketingfohow.ru/api'

export const useAdminStore = defineStore('admin', {
  state: () => ({
    users: [],
    selectedUser: null,
    stats: null,
    logs: [],
    isLoading: false,
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
    }
  }
})
