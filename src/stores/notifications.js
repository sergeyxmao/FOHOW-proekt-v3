import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useNotificationsStore = defineStore('notifications', () => {
  const notifications = ref([])
  let notificationIdCounter = 0

  /**
   * Добавляет новое уведомление
   * @param {Object} notification - Объект уведомления
   * @param {string} notification.message - Текст уведомления
   * @param {string} notification.type - Тип уведомления ('error', 'success', 'info')
   * @param {string} [notification.actionText] - Текст кнопки действия (опционально)
   * @param {Function} [notification.onAction] - Callback для кнопки действия (опционально)
   * @param {number} [notification.duration=6000] - Время показа уведомления в миллисекундах
   * @returns {number} ID созданного уведомления
   */
  function addNotification(notification) {
    const id = ++notificationIdCounter
    const duration = notification.duration || 6000 // По умолчанию 6 секунд

    const newNotification = {
      id,
      message: notification.message,
      type: notification.type || 'info',
      actionText: notification.actionText,
      onAction: notification.onAction,
      duration
    }

    notifications.value.push(newNotification)

    // Автоматически удаляем уведомление через заданное время
    setTimeout(() => {
      removeNotification(id)
    }, duration)

    return id
  }

  /**
   * Удаляет уведомление по ID
   * @param {number} id - ID уведомления для удаления
   */
  function removeNotification(id) {
    const index = notifications.value.findIndex(n => n.id === id)
    if (index !== -1) {
      notifications.value.splice(index, 1)
    }
  }

  /**
   * Очищает все уведомления
   */
  function clearAll() {
    notifications.value = []
  }

  return {
    notifications,
    addNotification,
    removeNotification,
    clearAll
  }
})
