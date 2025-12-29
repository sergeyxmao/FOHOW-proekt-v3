import { ref } from 'vue'
import { getMyStats } from '@/services/imageService'

/**
 * Composable для управления лимитами пользователя
 *
 * Функционал:
 * - Получение информации о лимитах
 * - Статистика библиотеки изображений
 * - Цветовое отображение прогресса
 */
export function useUserLimits({ subscriptionStore }) {
  // === State ===
  const imageLibraryStats = ref(null)
  const imageStatsError = ref('')

  // === Методы ===

  /**
   * Получить информацию о лимите
   */
  function getLimitInfo(resourceType) {
    const limitData = subscriptionStore.checkLimit(resourceType)
    const maxDisplay = limitData.max === -1 ? '∞' : limitData.max
    const percentage = limitData.max === -1 ? 0 : Math.min(100, Math.round((limitData.current / limitData.max) * 100))

    return {
      current: limitData.current,
      max: limitData.max,
      maxDisplay,
      percentage
    }
  }

  /**
   * Получить информацию о лимите изображений
   */
  function getImageLimitInfo(resourceKey) {
    const usage = imageLibraryStats.value?.usage || {}
    const limits = imageLibraryStats.value?.limits || {}

    const currentRaw = Number(usage[resourceKey] ?? 0)
    const limitRaw = limits[resourceKey]
    const isUnlimited = limitRaw === -1

    const currentDisplay = resourceKey === 'storageMB'
      ? `${currentRaw.toFixed(2)} МБ`
      : currentRaw

    const maxDisplay = isUnlimited
      ? '∞'
      : resourceKey === 'storageMB'
        ? `${Number(limitRaw ?? 0)} МБ`
        : Number(limitRaw ?? 0)

    const percentage = (!isUnlimited && Number(limitRaw) > 0)
      ? Math.min(100, Math.round((currentRaw / Number(limitRaw)) * 100))
      : 0

    return { currentDisplay, maxDisplay, percentage }
  }

  /**
   * Получить цвет прогресс-бара
   */
  function getLimitColor(percentage) {
    if (percentage < 70) return '#4caf50' // Зелёный
    if (percentage < 90) return '#ffc107' // Оранжевый
    return '#f44336' // Красный
  }

  /**
   * Загрузить статистику библиотеки изображений
   */
  async function loadImageLibraryStats() {
    try {
      imageStatsError.value = ''
      imageLibraryStats.value = await getMyStats()
    } catch (error) {
      console.error('Ошибка загрузки лимитов библиотеки изображений:', error)
      imageStatsError.value = error.message || 'Не удалось загрузить лимиты библиотеки изображений'
    }
  }

  return {
    // State
    imageLibraryStats,
    imageStatsError,

    // Methods
    getLimitInfo,
    getImageLimitInfo,
    getLimitColor,
    loadImageLibraryStats
  }
}
