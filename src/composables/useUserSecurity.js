import { ref, computed } from 'vue'

/**
 * Composable для управления безопасностью пользователя
 *
 * Функционал:
 * - Форма смены пароля
 * - Валидация паролей (минимальная длина, совпадение)
 * - Отправка запроса на смену пароля
 */
export function useUserSecurity({ authStore }) {
  // === Константы ===
  const MIN_PASSWORD_LENGTH = 6

  // === State ===
  const securityForm = ref({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })

  const securityError = ref('')
  const securitySuccess = ref('')
  const savingSecurity = ref(false)

  // === Computed ===

  /**
   * Проверка, заполнены ли все поля
   */
  const isFormFilled = computed(() => {
    return securityForm.value.currentPassword.trim() !== '' &&
           securityForm.value.newPassword.trim() !== '' &&
           securityForm.value.confirmPassword.trim() !== ''
  })

  /**
   * Проверка, совпадают ли новые пароли
   */
  const passwordsMatch = computed(() => {
    if (!securityForm.value.newPassword || !securityForm.value.confirmPassword) {
      return true // Не показываем ошибку, если поля пустые
    }
    return securityForm.value.newPassword === securityForm.value.confirmPassword
  })

  /**
   * Проверка длины нового пароля
   */
  const isNewPasswordValid = computed(() => {
    if (!securityForm.value.newPassword) {
      return true // Не показываем ошибку, если поле пустое
    }
    return securityForm.value.newPassword.length >= MIN_PASSWORD_LENGTH
  })

  // === Методы ===

  /**
   * Валидация формы
   */
  function validateForm() {
    securityError.value = ''

    if (!securityForm.value.currentPassword.trim()) {
      securityError.value = 'Введите текущий пароль'
      return false
    }

    if (!securityForm.value.newPassword.trim()) {
      securityError.value = 'Введите новый пароль'
      return false
    }

    if (securityForm.value.newPassword.length < MIN_PASSWORD_LENGTH) {
      securityError.value = `Новый пароль должен содержать минимум ${MIN_PASSWORD_LENGTH} символов`
      return false
    }

    if (!securityForm.value.confirmPassword.trim()) {
      securityError.value = 'Подтвердите новый пароль'
      return false
    }

    if (securityForm.value.newPassword !== securityForm.value.confirmPassword) {
      securityError.value = 'Новые пароли не совпадают'
      return false
    }

    if (securityForm.value.currentPassword === securityForm.value.newPassword) {
      securityError.value = 'Новый пароль должен отличаться от текущего'
      return false
    }

    return true
  }

  /**
   * Сохранить новый пароль
   */
  async function savePassword() {
    securityError.value = ''
    securitySuccess.value = ''

    if (!validateForm()) {
      return
    }

    savingSecurity.value = true

    try {
      await authStore.updateProfile({
        currentPassword: securityForm.value.currentPassword,
        newPassword: securityForm.value.newPassword
      })

      securitySuccess.value = 'Пароль успешно изменен!'

      // Очистить форму после успешной смены пароля
      clearForm()

      setTimeout(() => {
        securitySuccess.value = ''
      }, 5000)
    } catch (err) {
      securityError.value = err.message || 'Произошла ошибка при смене пароля'
    } finally {
      savingSecurity.value = false
    }
  }

  /**
   * Очистить форму
   */
  function clearForm() {
    securityForm.value.currentPassword = ''
    securityForm.value.newPassword = ''
    securityForm.value.confirmPassword = ''
    securityError.value = ''
  }

  return {
    // Constants
    MIN_PASSWORD_LENGTH,

    // State
    securityForm,
    securityError,
    securitySuccess,
    savingSecurity,

    // Computed
    isFormFilled,
    passwordsMatch,
    isNewPasswordValid,

    // Methods
    validateForm,
    savePassword,
    clearForm
  }
}
