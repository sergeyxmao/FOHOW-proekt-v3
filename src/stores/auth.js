import { defineStore } from 'pinia'

// API_URL лучше вынести в константу
const API_URL = import.meta.env.VITE_API_URL || 'https://interactive.marketingfohow.ru/api'
function mergeUserData(existingUser, incomingUser) {
  const merged = {
    ...(existingUser ?? {}),
    ...(incomingUser ?? {}),
  }

  if (incomingUser && Object.prototype.hasOwnProperty.call(incomingUser, 'role')) {
    merged.role = incomingUser.role
  } else if (existingUser?.role && !merged.role) {
    merged.role = existingUser.role
  }

  return merged
}

function decodeJwtPayload(token) {
  const parts = token.split('.')

  if (parts.length < 2) {
    throw new Error('Некорректный формат токена')
  }

  const base64Url = parts[1]
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
  const paddingLength = (4 - (base64.length % 4)) % 4
  const padded = base64 + '='.repeat(paddingLength)

  const decoded = atob(padded)

  return JSON.parse(decoded)
}


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
      const limit = state.user.plan.features.max_licenses
      return typeof limit === 'number' ? limit : -1
    },

    // Получить название плана
    planName: (state) => {
      return state.user?.plan?.name || 'Не определен'
    },

    // Проверить, есть ли лимит на карточки
    hasCardsLimit: (state) => {
      const limit = state.user?.plan?.features?.max_licenses
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
        const payload = decodeJwtPayload(token)

        this.user = mergeUserData(this.user, {
          id: payload.userId,
          email: payload.email,
          role: payload.role  // ВАЖНО: извлекаем роль из токена
        })

        this.token = token
        this.isAuthenticated = true

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
        // Сразу извлекаем базовую информацию из токена, чтобы не потерять роль
        this.loadUser();

        // Если есть кэшированные данные пользователя, показываем их немедленно
        if (cachedUser) {
          try {
            this.user = mergeUserData(this.user, JSON.parse(cachedUser));
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
            // Обновляем данные, включая is_verified (с преобразованием в boolean)
            this.user = {
              ...mergeUserData(this.user, data.user),
              is_verified: Boolean(data.user?.is_verified),
              verified_at: data.user?.verified_at || null
            };
            localStorage.setItem('user', JSON.stringify(this.user)); // Обновляем кэш
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
      const response = await fetch(`${API_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, verificationCode, verificationToken })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка регистрации')
      }

      // Проверить, требуется ли вход после регистрации
      if (data.requiresLogin) {
        // Регистрация успешна, но токен не выдан — пользователь должен войти
        return {
          success: true,
          requiresLogin: true,
          message: data.message || 'Регистрация успешна. Войдите под своими данными.'
        }
      }

      // Если backend вернул токен (в будущем может быть такой сценарий)
      if (data.token) {
        await this.finalizeAuthentication(data.token, data.user)
        return {
          success: true,
          requiresLogin: false
        }
      }

      // Непредвиденный ответ
      throw new Error('Неожиданный ответ сервера при регистрации')
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

      // Проверить, требуется ли верификация email
      if (data.requiresVerification) {
        // Сохранить email для страницы верификации
        localStorage.setItem('verificationEmail', data.email || email)
        // Вернуть объект с флагом requiresVerification
        return {
          requiresVerification: true,
          email: data.email || email
        }
      }

      // Обычный вход - сохранить токен и данные пользователя
      await this.finalizeAuthentication(data.token, data.user)

      return {
        requiresVerification: false
      }
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
          // Обновляем данные, включая is_verified (с преобразованием в boolean)
          this.user = {
            ...mergeUserData(this.user, profileData.user),
            is_verified: Boolean(profileData.user?.is_verified),
            verified_at: profileData.user?.verified_at || null
          }
        } else {
          // Если данные профиля не удалось получить, используем fallbackUser
          this.user = mergeUserData(this.user, fallbackUser)
        }
      } catch (err) {
        console.error('Ошибка загрузки профиля после входа:', err)
        // Если была ошибка сети, используем fallbackUser
        this.user = mergeUserData(this.user, fallbackUser)
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
          if (response.status === 401) {
            await this.logout()
            throw new Error('Сессия истекла')
          }
          const errorData = await response.json().catch(() => ({}))
          console.error('Ошибка загрузки профиля:', errorData.error || response.statusText)
          throw new Error(errorData.error || 'Ошибка загрузки профиля')
        }

        const data = await response.json()

        // КРИТИЧЕСКИ ВАЖНО: Обновить ВСЕ поля, включая is_verified
        this.user = {
          ...mergeUserData(this.user, data.user),
          is_verified: Boolean(data.user?.is_verified), // Преобразовать в boolean
          verified_at: data.user?.verified_at || null
        }

        // Сохранить в localStorage
        localStorage.setItem('user', JSON.stringify(this.user))

        return data.user
      } catch (err) {
        console.error('[AUTH] Ошибка загрузки профиля:', err)
        throw err
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
        const error = new Error(data.error || 'Ошибка обновления профиля')
        // Добавляем дополнительные данные для обработки на клиенте
        error.errorType = data.errorType || null
        error.supportTelegram = data.supportTelegram || null
        error.supportEmail = data.supportEmail || null
        throw error
      }

      const data = await response.json()
      this.user = mergeUserData(this.user, data.user)
      localStorage.setItem('user', JSON.stringify(this.user))

      return this.user
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
