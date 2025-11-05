import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useBoardStore } from './board.js'

const API_URL = import.meta.env.VITE_API_URL || 'https://interactive.marketingfohow.ru/api'

export const useUserCommentsStore = defineStore('userComments', () => {
  // State
  const comments = ref([])
  const loading = ref(false)
  const error = ref(null)

  // Getters
  const hasComments = computed(() => comments.value.length > 0)
  const commentsCount = computed(() => comments.value.length)

  // --- ИСПРАВЛЕНИЕ 1: Упрощенная функция для получения заголовков ---
  // Теперь она возвращает только то, что нужно всегда - токен авторизации.
  const getAuthHeaders = () => {
    const token = localStorage.getItem('token') // Предполагается, что токен хранится здесь
    return {
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
        headers: getAuthHeaders() // Используем новую "чистую" функцию
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
    const boardStore = useBoardStore()

    if (!boardStore.currentBoardId) {
      console.warn('Структура еще не создана');
      return { error: 'no_structure', message: 'Необходимо создать структуру перед созданием комментария' };
    }

    loading.value = true
    error.value = null

    try {
      const response = await fetch(`${API_URL}/comments`, {
        method: 'POST',
        // --- ИСПРАВЛЕНИЕ 2: Явно добавляем Content-Type ---
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(commentData)
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Ошибка создания комментария')
      }

      const data = await response.json()
      const newComment = data.comment

      comments.value.unshift(newComment)
      
      return newComment
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
      if (!commentId || !Number.isInteger(Number(commentId)) || Number(commentId) <= 0) {
        throw new Error('Некорректный ID комментария для обновления')
      }

      const response = await fetch(`${API_URL}/comments/${commentId}`, {
        method: 'PUT',
        // --- ИСПРАВЛЕНИЕ 2: Явно добавляем Content-Type ---
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Ошибка обновления комментария')
      }

      const data = await response.json()
      const updatedComment = data.comment

      const index = comments.value.findIndex(c => c.id === updatedComment.id)
      if (index !== -1) {
        comments.value[index] = updatedComment
      }

      return updatedComment
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
      if (!commentId || !Number.isInteger(Number(commentId)) || Number(commentId) <= 0) {
        throw new Error('Некорректный ID комментария для удаления')
      }

      const response = await fetch(`${API_URL}/comments/${commentId}`, {
        method: 'DELETE',
        headers: getAuthHeaders() // Используем новую "чистую" функцию
      })

      if (!response.ok) {
        // Улучшенная обработка ошибок для DELETE
        let errorMessage = `Ошибка сервера: ${response.status}`
        try {
          const data = await response.json()
          errorMessage = data.error || data.message || errorMessage
        } catch {
          // Если тело ответа пустое или не JSON
          errorMessage = await response.text() || errorMessage
        }
        throw new Error(errorMessage)
      }

      comments.value = comments.value.filter(c => c.id !== commentId)
      
    } catch (err) {
      error.value = err.message
      // Отображаем ошибку в UI, так как throw здесь не отлавливается
      alert(`Ошибка удаления комментария: ${err.message}`)
      console.error('❌ Ошибка удаления комментария:', err)
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
