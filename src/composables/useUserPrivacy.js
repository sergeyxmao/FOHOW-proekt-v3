import { ref } from 'vue'

/**
 * Composable для управления настройками конфиденциальности
 *
 * Функционал:
 * - Настройки видимости полей для поиска
 * - Сохранение настроек
 */
export function useUserPrivacy({ user, authStore, API_URL }) {
  // === State ===
  const privacySettings = ref({
    username: false,
    full_name: false,
    phone: false,
    city: false,
    country: false,
    office: false,
    personal_id: false,
    telegram_user: false,
    vk_profile: false,
    instagram_profile: false,
    website: false
  })

  const privacyError = ref('')
  const privacySuccess = ref('')
  const savingPrivacy = ref(false)

  // === Методы ===

  /**
   * Переключить настройку конфиденциальности
   */
  function togglePrivacy(field) {
    privacySettings.value[field] = !privacySettings.value[field]
  }

  /**
   * Сохранить настройки конфиденциальности
   */
  async function savePrivacySettings() {
    privacyError.value = ''
    privacySuccess.value = ''
    savingPrivacy.value = true

    try {
      const response = await fetch(`${API_URL}/profile/privacy`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${authStore.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ search_settings: privacySettings.value })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Ошибка сохранения настроек')
      }

      const result = await response.json()

      // Обновляем search_settings в authStore
      if (user.value) {
        user.value.search_settings = result.search_settings
      }

      privacySuccess.value = 'Настройки конфиденциальности успешно сохранены!'

      setTimeout(() => {
        privacySuccess.value = ''
      }, 3000)
    } catch (err) {
      privacyError.value = err.message || 'Произошла ошибка при сохранении'
    } finally {
      savingPrivacy.value = false
    }
  }

  /**
   * Инициализировать настройки из данных пользователя
   */
  function initializeSettings() {
    if (user.value && user.value.search_settings) {
      privacySettings.value = {
        username: user.value.search_settings.username || false,
        full_name: user.value.search_settings.full_name || false,
        phone: user.value.search_settings.phone || false,
        city: user.value.search_settings.city || false,
        country: user.value.search_settings.country || false,
        office: user.value.search_settings.office || false,
        personal_id: user.value.search_settings.personal_id || false,
        telegram_user: user.value.search_settings.telegram_user || false,
        vk_profile: user.value.search_settings.vk_profile || false,
        instagram_profile: user.value.search_settings.instagram_profile || false,
        website: user.value.search_settings.website || false
      }
    }
  }

  return {
    // State
    privacySettings,
    privacyError,
    privacySuccess,
    savingPrivacy,

    // Methods
    togglePrivacy,
    savePrivacySettings,
    initializeSettings
  }
}
