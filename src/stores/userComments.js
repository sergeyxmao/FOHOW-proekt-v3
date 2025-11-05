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
      // Валидация commentId на клиенте
      if (!commentId || commentId === 'undefined' || commentId === 'null') {
        throw new Error('Некорректный ID комментария')
      }

      const commentIdNum = Number(commentId)
      if (!Number.isInteger(commentIdNum) || commentIdNum <= 0) {
        throw new Error('ID комментария должен быть положительным числом')
      }

      const response = await fetch(`${API_URL}/comments/${commentIdNum}`, {
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
      const index = comments.value.findIndex(c => c.id === commentIdNum)
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

    console.log('🔍 deleteComment вызван с ID:', commentId, 'Тип:', typeof commentId)

    try {
      // Валидация commentId на клиенте
      if (!commentId || commentId === 'undefined' || commentId === 'null') {
        throw new Error('Некорректный ID комментария')
      }

      const commentIdNum = Number(commentId)
      console.log('🔢 Преобразованный commentIdNum:', commentIdNum, 'isInteger:', Number.isInteger(commentIdNum))

      if (!Number.isInteger(commentIdNum) || commentIdNum <= 0) {
        throw new Error('ID комментария должен быть положительным числом')
      }

      const url = `${API_URL}/comments/${commentIdNum}`
      console.log('🌐 Отправка DELETE запроса на:', url)

      const response = await fetch(url, {
        method: 'DELETE',
        headers: getAuthHeaders()
      })

      console.log('📡 Ответ сервера - статус:', response.status, 'OK:', response.ok)

      if (!response.ok) {
        const contentType = response.headers.get('content-type')
        console.log('📄 Content-Type ответа:', contentType)

        let errorMessage = 'Ошибка удаления комментария'
        try {
          const data = await response.json()
          console.log('📦 Данные ошибки от сервера:', data)
          errorMessage = data.error || errorMessage
        } catch (parseErr) {
          console.error('❌ Не удалось распарсить JSON ошибки:', parseErr)
          const text = await response.text()
          console.log('📝 Текст ответа сервера:', text)
        }
        throw new Error(errorMessage)
      }

      // Удаляем комментарий из массива
      comments.value = comments.value.filter(c => c.id !== commentIdNum)
      console.log('✅ Комментарий успешно удалён из локального состояния')
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
