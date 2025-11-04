import { defineStore } from 'pinia'

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:4000/api'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    token: null,
    isAuthenticated: false
  }),

  actions: {
    async init() {
      // Загружаем токен из localStorage
      const token = localStorage.getItem('token')
      
      if (token) {
        this.token = token
        
        // Загружаем актуальные данные пользователя с сервера
        try {
          const response = await fetch(`${API_URL}/profile`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          })
          
          if (response.ok) {
            const data = await response.json()
            this.user = data.user
            this.isAuthenticated = true
            
            // Сохраняем в localStorage
            localStorage.setItem('user', JSON.stringify(data.user))
          } else {
            // Токен невалидный - очищаем
            this.logout()
          }
        } catch (err) {
          console.error('Ошибка загрузки профиля:', err)
          // В случае ошибки используем данные из localStorage
          const savedUser = localStorage.getItem('user')
          if (savedUser) {
            this.user = JSON.parse(savedUser)
            this.isAuthenticated = true
          }
        }
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
      }

      this.isAuthenticated = true
      localStorage.setItem('user', JSON.stringify(this.user))
    },

    async fetchProfile() {
      if (!this.token) {
        throw new Error('Not authenticated')
      }

      try {
        const response = await fetch(`${API_URL}/profile`, {
          headers: {
            'Authorization': `Bearer ${this.token}`
          }
        })

        if (!response.ok) {
          throw new Error('Failed to fetch profile')
        }

        const data = await response.json()
        this.user = data.user
        localStorage.setItem('user', JSON.stringify(data.user))

        return data.user
      } catch (err) {
        console.error('Error fetching profile:', err)
        throw err
      }
    },

    logout() {
      this.user = null
      this.token = null
      this.isAuthenticated = false

      localStorage.removeItem('token')
      localStorage.removeItem('user')
    }
  }
})
