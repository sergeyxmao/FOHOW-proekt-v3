import { defineStore } from 'pinia'

// API_URL берем из переменных окружения
const API_URL = import.meta.env.VITE_API_URL || 'https://interactive.marketingfohow.ru/api'

export const useUserStore = defineStore('user', {
  state: () => ({
    user: null,        // Данные пользователя (id, username, email, subscriptionExpiresAt)
    plan: null,        // Информация о тарифном плане (id, name, code_name, priceMonthly)
    features: null,    // Доступные функции плана (max_boards, can_export_pdf, и т.д.)
    usage: null,       // Текущее использование ресурсов (boards, notes, stickers, userComments)
    loading: false     // Флаг загрузки данных
  }),

  getters: {
    // Проверка, может ли пользователь экспортировать в PDF
    canExportPDF: (state) => state.features?.can_export_pdf ?? false,

    // Максимальное количество досок
    maxBoards: (state) => state.features?.max_boards ?? 0,

    // Название тарифного плана
    planName: (state) => state.plan?.name ?? 'Неизвестно',

    // Проверка, является ли план демо-версией
    isDemo: (state) => state.plan?.code_name === 'demo',

    // Проверка, может ли пользователь создать еще доски
    canCreateMoreBoards: (state) => {
      // Если данные еще не загружены, возвращаем false
      if (!state.usage?.boards || !state.features?.max_boards) {
        return false
      }

      const currentBoards = state.usage.boards.current
      const maxBoards = state.features.max_boards

      // Если лимит -1, это означает безлимит
      if (maxBoards === -1) {
        return true
      }

      // Проверяем, не превышен ли лимит
      return currentBoards < maxBoards
    },

    // Максимальное количество заметок на доске
    maxNotesPerBoard: (state) => state.features?.max_notes_per_board ?? 0,

    // Максимальное количество стикеров на доске
    maxStickersPerBoard: (state) => state.features?.max_stickers_per_board ?? 0,

    // Максимальное количество комментариев
    maxComments: (state) => state.features?.max_comments ?? 0,

    // Получить текущее использование досок
    boardsUsage: (state) => state.usage?.boards ?? { current: 0, limit: -1 },

    // Получить текущее использование заметок
    notesUsage: (state) => state.usage?.notes ?? { current: 0, limit: -1 },

    // Получить текущее использование стикеров
    stickersUsage: (state) => state.usage?.stickers ?? { current: 0, limit: -1 },

    // Получить текущее использование комментариев
    commentsUsage: (state) => state.usage?.userComments ?? { current: 0, limit: -1 }
  },

  actions: {
    // Загрузить информацию о тарифном плане пользователя
    async fetchUserPlan() {
      this.loading = true

      try {
        // Получаем токен из localStorage (предполагается, что он уже установлен)
        const token = localStorage.getItem('token')

        if (!token) {
          throw new Error('Отсутствует токен авторизации')
        }

        // Выполняем GET запрос на API
        const response = await fetch(`${API_URL}/user/plan`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })

        // Проверяем успешность ответа
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || 'Ошибка загрузки данных о плане')
        }

        // Парсим JSON ответ
        const data = await response.json()

        // Раскладываем полученные данные по соответствующим полям state
        this.user = data.user
        this.plan = data.plan
        this.features = data.features
        this.usage = data.usage

        return data
      } catch (error) {
        console.error('Ошибка при загрузке информации о тарифном плане:', error)

        // Сбрасываем данные при ошибке
        this.user = null
        this.plan = null
        this.features = null
        this.usage = null

        // Пробрасываем ошибку дальше, чтобы компоненты могли её обработать
        throw error
      } finally {
        // Всегда снимаем флаг загрузки
        this.loading = false
      }
    },

    // Очистить данные хранилища (полезно при выходе из аккаунта)
    clearUserData() {
      this.user = null
      this.plan = null
      this.features = null
      this.usage = null
      this.loading = false
    }
  }
})
