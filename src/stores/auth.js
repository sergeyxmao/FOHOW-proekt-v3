import { defineStore } from 'pinia'

const API_URL = import.meta.env.VITE_API_URL || 'https://interactive.marketingfohow.ru/api'

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

    async register(email, password) {
      const response = await fetch(`${API_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка регистрации')
      }

      // После регистрации автоматически логинимся
      await this.login(email, password)
    },

    async login(email, password) {
      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка входа')
      }

      this.token = data.token
      this.user = data.user
      this.isAuthenticated = true

      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))
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
