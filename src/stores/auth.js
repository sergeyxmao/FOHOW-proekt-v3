import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

const API_URL = import.meta.env.VITE_API_URL || 'https://interactive.marketingfohow.ru/api'

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('token') || null)
  const user = ref(JSON.parse(localStorage.getItem('user') || 'null'))
  
  const isAuthenticated = computed(() => !!token.value)
  
  async function register(email, password) {
    const response = await fetch(`${API_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
    
    const data = await response.json()
    
    if (!response.ok) {
      throw new Error(data.error || 'Ошибка регистрации')
    }
    
    return data
  }
  
  async function login(email, password) {
    const response = await fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
    
    const data = await response.json()
    
    if (!response.ok) {
      throw new Error(data.error || 'Ошибка входа')
    }
    
    token.value = data.token
    user.value = data.user
    
    localStorage.setItem('token', data.token)
    localStorage.setItem('user', JSON.stringify(data.user))
    
    return data
  }
  
  function logout() {
    token.value = null
    user.value = null
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  }
  
  return {
    token,
    user,
    isAuthenticated,
    register,
    login,
    logout
  }
})
