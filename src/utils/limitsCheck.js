/**
 * Утилиты для проверки лимитов тарифных планов
 */

import { useAuthStore } from '@/stores/auth'
import { useCardsStore } from '@/stores/cards'

/**
 * Проверяет, можно ли добавить новую карточку на доску
 * @param {number} cardsToAdd - количество карточек, которые планируется добавить (по умолчанию 1)
 * @returns {Object} результат проверки { allowed: boolean, currentCount: number, limit: number, message: string }
 */
export function checkCardLimit(cardsToAdd = 1) {
  const authStore = useAuthStore()
  const cardsStore = useCardsStore()

  const currentCount = cardsStore.cards.length
  const limit = authStore.maxCardsPerBoard

  // Если лимит -1, значит безлимитный план
  if (limit === -1) {
    return {
      allowed: true,
      currentCount,
      limit,
      message: null
    }
  }

  // Проверяем, не превышен ли лимит
  const willExceed = (currentCount + cardsToAdd) > limit

  if (willExceed) {
    const planName = authStore.planName
    return {
      allowed: false,
      currentCount,
      limit,
      message: `Достигнут лимит карточек на вашем тарифе "${planName}" (${limit} карточек). Чтобы добавить больше, перейдите на следующий тарифный план.`
    }
  }

  return {
    allowed: true,
    currentCount,
    limit,
    message: null
  }
}

/**
 * Показывает alert с сообщением о достижении лимита
 * @param {string} message - сообщение для показа
 */
export function showLimitAlert(message) {
  if (message) {
    alert(message)
  }
}

/**
 * Проверяет лимит и показывает alert, если лимит достигнут
 * @param {number} cardsToAdd - количество карточек, которые планируется добавить
 * @returns {boolean} true, если можно добавлять карточки, false если лимит достигнут
 */
export function checkAndAlertCardLimit(cardsToAdd = 1) {
  const result = checkCardLimit(cardsToAdd)

  if (!result.allowed) {
    showLimitAlert(result.message)
    return false
  }

  return true
}
