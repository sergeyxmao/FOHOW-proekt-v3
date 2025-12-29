import { ref } from 'vue'

/**
 * Composable для управления промокодами
 *
 * Функционал:
 * - Ввод и применение промокода
 * - Обработка ошибок и успешных применений
 */
export function useUserPromo({ authStore, subscriptionStore }) {
  // === State ===
  const promoCodeInput = ref('')
  const promoError = ref('')
  const promoSuccess = ref('')
  const applyingPromo = ref(false)

  // === Методы ===

  /**
   * Применить промокод
   */
  async function handleApplyPromo() {
    promoError.value = ''
    promoSuccess.value = ''

    const code = promoCodeInput.value.trim()

    if (!code) {
      promoError.value = 'Введите промокод'
      return
    }

    applyingPromo.value = true

    try {
      await authStore.applyPromoCode(code)
      promoSuccess.value = 'Промокод успешно применен!'
      promoCodeInput.value = ''

      // Обновляем план подписки
      await subscriptionStore.loadPlan()

      setTimeout(() => {
        promoSuccess.value = ''
      }, 5000)
    } catch (err) {
      promoError.value = err.message || 'Ошибка применения промокода'
    } finally {
      applyingPromo.value = false
    }
  }

  /**
   * Очистить форму
   */
  function clearForm() {
    promoCodeInput.value = ''
    promoError.value = ''
    promoSuccess.value = ''
  }

  return {
    // State
    promoCodeInput,
    promoError,
    promoSuccess,
    applyingPromo,

    // Methods
    handleApplyPromo,
    clearForm
  }
}
