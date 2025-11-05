import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

const API_URL = import.meta.env.VITE_API_URL || 'https://interactive.marketingfohow.ru/api'

export const useUserCommentsStore = defineStore('userComments', () => {
  // State
  const comments = ref([])
  const loading = ref(false)
  const error = ref(null)

  // Getters
  const hasComments = computed(() => comments.value.length > 0)
  const commentsCount = computed(() => comments.value.length)

  // Helper function to get auth headers
  const getAuthHeaders = () => {
    const token = localStorage.getItem('token')
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  }

  // Actions

  /**
   * Загрузить все комментарии пользователя
   */
  async function fetchComments() {
    loading.value = true
    error.value = null

    try {
      const response = await fetch(`${API_URL}/comments`, {
        headers: getAuthHeaders()
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Ошибка загрузки комментариев')
      }

      const data = await response.json()
      comments.value = data.comments || []
    } catch (err) {
      error.value = err.message
      console.error('❌ Ошибка загрузки комментариев:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Добавить новый комментарий
   * @param {Object} commentData - Данные комментария { content, color }
   */
  async function addComment(commentData) {
    loading.value = true
    error.value = null

    try {
      const response = await fetch(`${API_URL}/comments`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(commentData)
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Ошибка создания комментария')
      }

      const data = await response.json()

      // Добавляем новый комментарий в начало массива (так как сортируем по created_at DESC)
      comments.value.unshift(data.comment)

      return data.comment
    } catch (err) {
      error.value = err.message
      console.error('❌ Ошибка создания комментария:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Обновить комментарий
   * @param {number} commentId - ID комментария
   * @param {Object} updateData - Данные для обновления { content, color }
   */
  async function updateComment(commentId, updateData) {
    loading.value = true
    error.value = null

    try {
      const response = await fetch(`${API_URL}/comments/${commentId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(updateData)
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Ошибка обновления комментария')
      }

      const data = await response.json()

      // Обновляем комментарий в массиве
      const index = comments.value.findIndex(c => c.id === commentId)
      if (index !== -1) {
        comments.value[index] = data.comment
      }

      return data.comment
    } catch (err) {
      error.value = err.message
      console.error('❌ Ошибка обновления комментария:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Удалить комментарий
   * @param {number} commentId - ID комментария
   */
  async function deleteComment(commentId) {
    loading.value = true
    error.value = null

    try {
      const response = await fetch(`${API_URL}/comments/${commentId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Ошибка удаления комментария')
      }

      // Удаляем комментарий из массива
      comments.value = comments.value.filter(c => c.id !== commentId)
    } catch (err) {
      error.value = err.message
      console.error('❌ Ошибка удаления комментария:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Очистить все комментарии (при выходе пользователя)
   */
  function clearComments() {
    comments.value = []
    error.value = null
    loading.value = false
  }

  return {
    // State
    comments,
    loading,
    error,

    // Getters
    hasComments,
    commentsCount,

    // Actions
    fetchComments,
    addComment,
    updateComment,
    deleteComment,
    clearComments
  }
})
