import { defineStore } from 'pinia'

const API_URL = import.meta.env.VITE_API_URL || 'https://interactive.marketingfohow.ru/api'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoadingProfile: true
  }),

  actions: {
    async init() {
      const token = localStorage.getItem('token');
      const cachedUser = localStorage.getItem('user');

      this.isLoadingProfile = true; // Начинаем загрузку в любом случае

      if (token) {
        this.token = token;
        this.isAuthenticated = true; // Сразу считаем авторизованным

        // Если есть кэшированные данные пользователя, показываем их немедленно
        if (cachedUser) {
          try {
            this.user = JSON.parse(cachedUser);
          } catch (e) {
            console.error("Ошибка парсинга кэшированного пользователя:", e);
            localStorage.removeItem('user');
          }
        }

        // В фоне всегда запрашиваем свежие данные профиля
        try {
          const response = await fetch(`${API_URL}/profile`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });

          if (response.ok) {
            const data = await response.json();
            this.user = data.user; // Обновляем на свежие данные
            localStorage.setItem('user', JSON.stringify(data.user)); // Обновляем кэш
          } else {
            // Токен невалидный - полный сброс
            this.logout(); 
          }
        } catch (err) {
          console.error('Ошибка фоновой загрузки профиля:', err);
          // Если нет сети, мы продолжим работать с кэшированными данными
        } finally {
          this.isLoadingProfile = false; // Завершаем загрузку
        }
      } else {
        // Если токена нет, просто завершаем
        this.isLoadingProfile = false;
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

      await this.finalizeAuthentication(data.token, data.user)

    },

    async login(email, password, verificationCode, verificationToken) {
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
          this.user = fallbackUser
        }
      } catch (err) {
        console.error('Ошибка загрузки профиля после входа:', err)
        this.user = fallbackUser
      } finally {
        this.isLoadingProfile = false
      }

      this.isAuthenticated = true
      localStorage.setItem('user', JSON.stringify(this.user))
    },

    async logout() {
      this.user = null
      this.token = null
      this.isAuthenticated = false

      localStorage.removeItem('token')
      localStorage.removeItem('user')

      // Очищаем личные комментарии при выходе
      try {
        const { useUserCommentsStore } = await import('./userComments.js')
        const userCommentsStore = useUserCommentsStore()
        userCommentsStore.clearComments()
      } catch (err) {
        console.error('Ошибка очистки комментариев:', err)
      }
    },

    async fetchProfile() {
      if (!this.token) {
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
          const data = await response.json()
          throw new Error(data.error || 'Ошибка загрузки профиля')
        }

        const data = await response.json()
        // Сохраняем весь объект пользователя без фильтрации полей
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
      // Обновляем состояние user данными, которые вернул сервер
      this.user = data.user
      localStorage.setItem('user', JSON.stringify(data.user))

      return data.user
    }
  }
})
