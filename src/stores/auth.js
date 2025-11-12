import { defineStore } from 'pinia'

// API_URL лучше вынести в константу
const API_URL = import.meta.env.VITE_API_URL || 'https://interactive.marketingfohow.ru/api'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoadingProfile: true // Изначально считаем, что профиль загружается
  }),

  getters: {
    // Получить лимит на количество карточек на доске
    maxCardsPerBoard: (state) => {
      if (!state.user?.plan?.features) {
        return -1 // -1 означает безлимит (на случай если план не определен)
      }
      const limit = state.user.plan.features.max_cards_per_board
      return typeof limit === 'number' ? limit : -1
    },

    // Получить название плана
    planName: (state) => {
      return state.user?.plan?.name || 'Не определен'
    },

    // Проверить, есть ли лимит на карточки
    hasCardsLimit: (state) => {
      const limit = state.user?.plan?.features?.max_cards_per_board
      return typeof limit === 'number' && limit > 0
    }
  },

  actions: {
    // Метод для быстрой загрузки данных пользователя из JWT токена (без запроса к серверу)
    loadUser() {
      const token = localStorage.getItem('token')

      if (!token) {
        this.user = null
        this.isAuthenticated = false
        return
      }

      try {
        // Декодируем JWT токен (payload - вторая часть токена между точками)
        const payload = JSON.parse(atob(token.split('.')[1]))

        this.user = {
          id: payload.userId,
          email: payload.email,
          role: payload.role  // ВАЖНО: извлекаем роль из токена
        }

        this.token = token
        this.isAuthenticated = true

        console.log('[AUTH] User loaded from token:', { email: this.user.email, role: this.user.role })
      } catch (error) {
        console.error('[AUTH] Error decoding token:', error)
        this.logout()
      }
    },

    async init() {
      const token = localStorage.getItem('token');
      const cachedUser = localStorage.getItem('user');

      this.isLoadingProfile = true; // Начинаем загрузку

      if (token) {
        this.token = token;

        // Если есть кэшированные данные пользователя, показываем их немедленно
        if (cachedUser) {
          try {
            this.user = JSON.parse(cachedUser);
          } catch (e) {
            console.error("Ошибка парсинга кэшированного пользователя:", e);
            localStorage.removeItem('user'); // Удаляем некорректные данные
          }
        }

        // Всегда пытаемся запросить свежие данные профиля, чтобы проверить токен
        try {
          const response = await fetch(`${API_URL}/profile`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });

          if (response.ok) {
            const data = await response.json();
            this.user = data.user; // Обновляем на свежие данные
            localStorage.setItem('user', JSON.stringify(data.user)); // Обновляем кэш
            this.isAuthenticated = true; // Токен валиден, пользователь авторизован
          } else {
            // Токен невалидный - вызываем logout для полного сброса
            await this.logout();
          }
        } catch (err) {
          console.error('Ошибка фоновой загрузки профиля:', err);
          // Если нет сети или другая ошибка, считаем, что токен невалиден
          await this.logout();
        } finally {
          this.isLoadingProfile = false; // Завершаем загрузку в любом случае
        }
      } else {
        // Если токена нет в localStorage, пользователь не авторизован
        this.isAuthenticated = false;
        this.isLoadingProfile = false; // Завершаем загрузку
      }
    },

    async register(email, password, verificationCode, verificationToken) {
      // ... (код регистрации остается без изменений) ...
      const response = await fetch(`${API_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, verificationCode, verificationToken })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка регистрации')
      }

      await this.finalizeAuthentication(data.token, data.user)
    },

    async login(email, password, verificationCode, verificationToken) {
      // ... (код входа остается без изменений) ...
      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, verificationCode, verificationToken })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка входа')
      }

      await this.finalizeAuthentication(data.token, data.user)
    },

    async finalizeAuthentication(token, fallbackUser) {
      this.isLoadingProfile = true
      this.token = token
      localStorage.setItem('token', token)

      try {
        const profileResponse = await fetch(`${API_URL}/profile`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })

        if (profileResponse.ok) {
          const profileData = await profileResponse.json()
          this.user = profileData.user
        } else {
          // Если данные профиля не удалось получить, используем fallbackUser
          this.user = fallbackUser
        }
      } catch (err) {
        console.error('Ошибка загрузки профиля после входа:', err)
        // Если была ошибка сети, используем fallbackUser
        this.user = fallbackUser
      } finally {
        this.isLoadingProfile = false // Завершаем загрузку профиля
      }

      this.isAuthenticated = true // Устанавливаем isAuthenticated в true только после всех манипуляций
      localStorage.setItem('user', JSON.stringify(this.user))
    },

    async logout() {
      // Пытаемся отправить запрос на сервер для удаления сессии
      if (this.token) {
        try {
          await fetch(`${API_URL}/logout`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${this.token}`
            }
          })
          // Не проверяем response.ok, так как локальную очистку нужно сделать в любом случае
        } catch (err) {
          // Игнорируем ошибки сети (например, отсутствие интернета)
          console.warn('Не удалось уведомить сервер о выходе:', err)
        }
      }

      // ГАРАНТИРОВАННАЯ локальная очистка (выполняется всегда)
      this.user = null
      this.token = null
      this.isAuthenticated = false

      localStorage.removeItem('token')
      localStorage.removeItem('user')

      // Очищаем личные комментарии при выходе
      try {
        // Динамический импорт, чтобы не загружать этот модуль, если он не нужен
        const { useUserCommentsStore } = await import('./userComments.js')
        const userCommentsStore = useUserCommentsStore()
        userCommentsStore.clearComments()
      } catch (err) {
        console.error('Ошибка очистки комментариев:', err)
      }
    },

    async fetchProfile() {
      if (!this.token) {
        // Если токена нет, нет смысла запрашивать профиль
        this.isLoadingProfile = false; // Завершаем загрузку
        throw new Error('Отсутствует токен авторизации')
      }

      this.isLoadingProfile = true

      try {
        const response = await fetch(`${API_URL}/profile`, {
          headers: {
            'Authorization': `Bearer ${this.token}`
          }
        })

        if (!response.ok) {
          // Если токен невалиден, вызываем logout
          const errorData = await response.json().catch(() => ({})); // Пытаемся получить тело ошибки
          console.error('Ошибка загрузки профиля (невалидный токен?):', errorData.error || response.statusText);
          await this.logout(); 
          throw new Error(errorData.error || 'Ошибка загрузки профиля'); // Перебрасываем ошибку дальше
        }

        const data = await response.json()
        this.user = data.user
        localStorage.setItem('user', JSON.stringify(data.user))

        return data.user
      } finally {
        this.isLoadingProfile = false
      }
    },

    async updateProfile(profileData) {
      if (!this.token) {
        throw new Error('Отсутствует токен авторизации')
      }

      const response = await fetch(`${API_URL}/profile`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(profileData)
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Ошибка обновления профиля')
      }

      const data = await response.json()
      this.user = data.user
      localStorage.setItem('user', JSON.stringify(data.user))

      return data.user
    },

    async applyPromoCode(code) {
      if (!this.token) {
        throw new Error('Отсутствует токен авторизации')
      }

      const response = await fetch(`${API_URL}/promo/apply`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ code })
      })

      // Сначала проверяем response.ok
      if (!response.ok) {
        // Читаем тело ответа как JSON
        const data = await response.json()
        // Выбрасываем ошибку с сообщением из поля error
        throw new Error(data.error || 'Ошибка применения промокода')
      }

      // Если response.ok, читаем успешный ответ
      const data = await response.json()

      // После успешного применения промокода обновляем профиль пользователя
      await this.fetchProfile()

      return data
    }
  }
})
