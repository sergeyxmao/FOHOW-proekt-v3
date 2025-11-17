import { defineStore } from 'pinia'
import { useAuthStore } from './auth.js'

// API_URL берем из переменных окружения
const API_URL = import.meta.env.VITE_API_URL || 'https://interactive.marketingfohow.ru/api'

export const useSubscriptionStore = defineStore('subscription', {
  state: () => ({
    currentPlan: null,      // Текущий тарифный план
    plans: [],              // Список всех доступных тарифных планов
    features: {},           // Возможности плана
    usage: {},              // Использование ресурсов
    limits: {},             // Лимиты
    loading: false,         // Загрузка
    error: null            // Ошибки
  }),

  getters: {
    /**
     * Проверка, является ли пользователь на демо-плане
     * @returns {boolean}
     */
    isDemo: (state) => {
      return state.currentPlan?.code_name === 'demo'
    },

    /**
     * Проверка, является ли пользователь на Pro или Enterprise плане
     * @returns {boolean}
     */
    isPro: (state) => {
      const proPlans = ['pro', 'enterprise', 'premium']
      return proPlans.includes(state.currentPlan?.code_name)
    },

    /**
     * Количество дней до истечения подписки
     * @returns {number|null} Количество дней или null, если подписка бессрочная
     */
    daysLeft: (state) => {
      if (!state.currentPlan?.expiresAt) {
        return null // Бессрочная подписка
      }

      const expiresDate = new Date(state.currentPlan.expiresAt)
      const today = new Date()
      const diffTime = expiresDate - today
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

      return diffDays > 0 ? diffDays : 0
    },

    /**
     * Проверка, истекает ли подписка в ближайшие 7 дней
     * @returns {boolean}
     */
    isExpiring: (state) => {
      const daysLeft = state.daysLeft

      // Если подписка бессрочная (null), то не истекает
      if (daysLeft === null) {
        return false
      }

      // Истекает, если осталось меньше 7 дней
      return daysLeft < 7 && daysLeft >= 0
    }
  },

  actions: {
    /**
     * Загрузка текущего плана из API
     * @returns {Promise<Object>} Данные о плане
     */
    async loadPlan() {
      this.loading = true
      this.error = null

      try {
        const token = localStorage.getItem('token')

        if (!token) {
          throw new Error('Отсутствует токен авторизации')
        }

        const response = await fetch(`${API_URL}/user/plan`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || 'Ошибка загрузки данных о плане')
        }

        const data = await response.json()

        // Сохраняем данные в state
        this.currentPlan = {
          id: data.plan?.id,
          name: data.plan?.name,
          code_name: data.plan?.code_name,
          priceMonthly: data.plan?.priceMonthly,
          expiresAt: data.user?.subscriptionExpiresAt
        }

        this.features = data.features || {}
        this.usage = data.usage || {}

        // Формируем лимиты из features
        this.limits = {
          boards: data.features?.max_boards ?? -1,
          notes: data.features?.max_notes ?? -1,
          stickers: data.features?.max_stickers ?? -1,
          comments: data.features?.max_comments ?? -1,
          cards: data.features?.max_licenses ?? -1
        }

        return data
      } catch (error) {
        console.error('Ошибка при загрузке плана:', error)
        this.error = error.message
        throw error
      } finally {
        this.loading = false
      }
    },

    /**
     * Проверка доступности функции
     * @param {string} featureName - Название функции (например, 'can_export_pdf')
     * @returns {boolean} true, если функция доступна
     */
    checkFeature(featureName) {
      // Администраторы имеют доступ ко всем функциям (как на бэкенде)
      const authStore = useAuthStore()
      if (authStore.user?.role === 'admin') {
        return true
      }

      if (!this.features) {
        return false
      }

      const feature = this.features[featureName]

      // Специальная логика для can_use_images: если флаг не задан (undefined),
      // разрешаем доступ для всех тарифов, кроме guest
      if (featureName === 'can_use_images' && feature === undefined) {
        const isGuest = this.currentPlan?.code_name === 'guest'
        return !isGuest
      }

      // Если значение boolean, возвращаем его
      if (typeof feature === 'boolean') {
        return feature
      }

      // Если значение число, проверяем что оно больше 0 или -1 (безлимит)
      if (typeof feature === 'number') {
        return feature > 0 || feature === -1
      }
      // В некоторых тарифах значения приходят строкой — пробуем нормализовать
      if (typeof feature === 'string') {
        const normalized = feature.trim().toLowerCase()

        if (normalized === 'true') {
          return true
        }

        if (normalized === 'false') {
          return false
        }

        const numericValue = Number(feature)

        if (!Number.isNaN(numericValue)) {
          return numericValue > 0 || numericValue === -1
        }
      }

      // В остальных случаях считаем функцию недоступной
      return false
    },

    /**
     * Проверка лимита ресурса
     * @param {string} resourceType - Тип ресурса ('boards', 'notes', 'stickers', 'comments', 'cards')
     * @returns {Object} { current, max, canCreate, percentage }
     */
    checkLimit(resourceType) {
      // Маппинг: comments → userComments (для совместимости с API)
      const usageKey = resourceType === 'comments' ? 'userComments' : resourceType

      const usageData = this.usage[usageKey]
      const limit = this.limits[resourceType]

      // Если данных нет, возвращаем дефолтные значения
      if (!usageData) {
        return {
          current: 0,
          max: limit ?? -1,
          canCreate: limit === -1 || limit > 0,
          percentage: 0
        }
      }

      const current = usageData.current ?? 0
      const max = limit ?? -1

      // Если лимит -1, это безлимит
      const canCreate = max === -1 || current < max

      // Процент использования (для безлимита всегда 0)
      const percentage = max === -1 ? 0 : Math.round((current / max) * 100)

      return {
        current,
        max,
        canCreate,
        percentage
      }
    },

    /**
     * Обновление статистики использования
     * @returns {Promise<void>}
     */
    async refreshUsage() {
      // Просто перезагружаем план, что автоматически обновит usage
      await this.loadPlan()
    },

    /**
     * Получить текст для кнопки апгрейда
     * @param {string} featureName - Название функции
     * @returns {string} Текст сообщения
     */
    getUpgradeMessage(featureName) {
      // Проверяем доступность функции
      const isAvailable = this.checkFeature(featureName)

      if (isAvailable) {
        return 'Функция доступна'
      }

      // Если пользователь на демо-плане
      if (this.isDemo) {
        return 'Перейдите на платный план для доступа к этой функции'
      }

      // Если пользователь на Pro, но функция недоступна
      if (this.isPro) {
        return 'Эта функция недоступна в вашем плане'
      }

      // Общее сообщение
      return 'Улучшите план для доступа к этой функции'
    },

    /**
     * Загрузка списка всех доступных тарифных планов
     * @returns {Promise<Array>} Массив тарифных планов
     */
    async fetchPlans() {
      try {
        const response = await fetch(`${API_URL}/plans`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || 'Ошибка загрузки списка тарифных планов')
        }

        const data = await response.json()
        this.plans = data.plans || []

        return this.plans
      } catch (error) {
        console.error('Ошибка при загрузке списка планов:', error)
        this.error = error.message
        throw error
      }
    },

    /**
     * Очистить данные хранилища
     */
    clear() {
      this.currentPlan = null
      this.plans = []
      this.features = {}
      this.usage = {}
      this.limits = {}
      this.loading = false
      this.error = null
    }
  }
})
