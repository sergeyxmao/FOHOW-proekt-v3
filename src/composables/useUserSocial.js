import { ref, reactive } from 'vue'

/**
 * Composable для управления социальными сетями пользователя
 *
 * Функционал:
 * - Форма социальных сетей
 * - Сохранение данных
 */
export function useUserSocial({ user, authStore }) {
  // === State ===
  const socialForm = reactive({
    telegram_user: '',
    vk_profile: '',
    instagram_profile: '',
    website: ''
  })

  const socialError = ref('')
  const socialSuccess = ref('')
  const savingSocial = ref(false)

  // === Методы ===

  /**
   * Сохранить социальные сети
   */
  async function saveSocialInfo() {
    socialError.value = ''
    socialSuccess.value = ''
    savingSocial.value = true

    try {
      const profileData = {
        telegram_user: socialForm.telegram_user?.trim() || '',
        vk_profile: socialForm.vk_profile?.trim() || '',
        instagram_profile: socialForm.instagram_profile?.trim() || '',
        website: socialForm.website?.trim() || ''
      }

      await authStore.updateProfile(profileData)
      socialSuccess.value = 'Социальные сети успешно обновлены!'

      setTimeout(() => {
        socialSuccess.value = ''
      }, 3000)
    } catch (err) {
      socialError.value = err.message || 'Произошла ошибка при сохранении'
    } finally {
      savingSocial.value = false
    }
  }

  /**
   * Инициализировать форму из данных пользователя
   */
  function initializeForm() {
    if (user.value) {
      socialForm.telegram_user = user.value.telegram_user || ''
      socialForm.vk_profile = user.value.vk_profile || ''
      socialForm.instagram_profile = user.value.instagram_profile || ''
      socialForm.website = user.value.website || ''
    }
  }

  return {
    // State
    socialForm,
    socialError,
    socialSuccess,
    savingSocial,

    // Methods
    saveSocialInfo,
    initializeForm
  }
}
