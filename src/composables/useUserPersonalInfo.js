import { ref, reactive, computed } from 'vue'

/**
 * Composable для управления личной информацией пользователя
 *
 * Функционал:
 * - Форма личной информации
 * - Валидация представительства и компьютерного номера
 * - Сохранение данных с проверками верификации
 * - Управление предупреждениями при изменении критических полей
 */
export function useUserPersonalInfo({ user, authStore, verificationStatus, cancelVerification, loadVerificationStatus }) {
  // === Константы ===
  const OFFICE_PATTERN = /^[A-Z]{3}\d{2,3}$/

  // === State ===
  const personalForm = reactive({
    username: '',
    full_name: '',
    phone: '',
    city: '',
    country: '',
    office: '',
    personal_id: ''
  })

  const officeError = ref('')
  const personalIdError = ref('')
  const personalIdSuffix = ref('')
  const personalError = ref('')
  const personalSuccess = ref('')
  const savingPersonal = ref(false)

  // Ссылки на поддержку (для ошибки VERIFIED_BY_OTHER)
  const supportLinks = ref(null)

  // Предупреждение об изменении компьютерного номера
  const showPersonalIdWarning = ref(false)
  const pendingPersonalId = ref('')
  const pendingOffice = ref('')

  // Предупреждение при изменении данных во время pending заявки
  const showPendingWarning = ref(false)

  // Подтверждение отмены заявки на верификацию
  const showCancelConfirm = ref(false)
  const cancellingVerification = ref(false)

  // === Computed ===

  const officePrefix = computed(() => personalForm.office.trim().toUpperCase())

  const isPersonalIdComplete = computed(() => {
    const suffix = personalIdSuffix.value.replace(/\D/g, '')
    return OFFICE_PATTERN.test(officePrefix.value) && suffix.length === 9
  })

  // === Методы ===

  /**
   * Нормализовать представительство
   */
  function normalizeOffice(value) {
    return (value || '').trim().toUpperCase()
  }

  /**
   * Валидация представительства
   */
  function validateOffice() {
    const office = normalizeOffice(personalForm.office)
    personalForm.office = office

    if (!office) {
      officeError.value = ''
      personalIdError.value = ''
      updatePersonalId(false)
      return true
    }

    if (!OFFICE_PATTERN.test(office)) {
      officeError.value = 'Представительство должно быть в формате: 3 английские буквы + 2-3 цифры (например: RUY68)'
      personalIdError.value = officeError.value
      return false
    }

    officeError.value = ''
    updatePersonalId()
    return true
  }

  /**
   * Обновить компьютерный номер
   */
  function updatePersonalId(showOfficeValidation = true) {
    const office = normalizeOffice(personalForm.office)
    personalForm.office = office

    const digitsOnly = personalIdSuffix.value.replace(/\D/g, '')
    if (digitsOnly !== personalIdSuffix.value) {
      personalIdSuffix.value = digitsOnly
    }

    if (personalIdSuffix.value.length > 9) {
      personalIdSuffix.value = personalIdSuffix.value.slice(0, 9)
    }

    const suffix = personalIdSuffix.value
    personalForm.personal_id = office + suffix

    if (!office) {
      personalIdError.value = showOfficeValidation ? 'Укажите представительство' : ''
      return
    }

    if (!OFFICE_PATTERN.test(office)) {
      personalIdError.value = showOfficeValidation ? (officeError.value || 'Некорректный формат представительства') : ''
      return
    }

    if (suffix.length === 9) {
      personalIdError.value = ''
    } else {
      personalIdError.value = `Введено ${suffix.length}/9 цифр`
    }
  }

  /**
   * Валидация компьютерного номера
   */
  function validatePersonalId() {
    const isOfficeValid = validateOffice()
    const office = officePrefix.value
    const suffix = personalIdSuffix.value.replace(/\D/g, '')

    if (!office) {
      personalIdError.value = 'Укажите представительство'
      return false
    }

    if (!isOfficeValid) {
      personalIdError.value = officeError.value
      return false
    }

    if (suffix.length !== 9) {
      personalIdError.value = `Введено ${suffix.length}/9 цифр`
      return false
    }

    personalForm.personal_id = office + suffix
    personalIdError.value = ''
    return true
  }

  /**
   * Инициализация полей personal_id
   */
  function initializePersonalIdFields() {
    personalForm.office = normalizeOffice(personalForm.office)
    const existingPersonalId = (personalForm.personal_id || '').trim()
    let suffix = ''

    if (existingPersonalId && officePrefix.value && existingPersonalId.startsWith(officePrefix.value)) {
      suffix = existingPersonalId.slice(officePrefix.value.length)
    } else if (existingPersonalId) {
      const match = existingPersonalId.match(/^([A-Z]{3}\d{2,3})(\d{0,9})/)
      if (match) {
        personalForm.office = match[1]
        suffix = match[2]
      }
    }

    personalIdSuffix.value = (suffix || '').replace(/\D/g, '').slice(0, 9)
    updatePersonalId(false)
  }

  /**
   * Сохранить личную информацию
   */
  async function savePersonalInfo() {
    personalError.value = ''
    personalSuccess.value = ''

    if (!validatePersonalId()) {
      personalError.value = personalIdError.value || 'Проверьте корректность представительства и компьютерного номера'
      return
    }

    // Проверяем, изменились ли критические поля (office или personal_id)
    const officeChanged = personalForm.office &&
      personalForm.office.trim().toUpperCase() !== (user.value.office || '').trim().toUpperCase()
    const personalIdChanged = personalForm.personal_id &&
      personalForm.personal_id.trim() !== '' &&
      personalForm.personal_id !== user.value.personal_id

    // ПРОВЕРКА 1: Если есть pending заявка и изменяются критические поля
    if (verificationStatus.hasPendingRequest && (officeChanged || personalIdChanged)) {
      // Показать предупреждение о pending заявке
      showPendingWarning.value = true
      pendingPersonalId.value = personalForm.personal_id
      pendingOffice.value = personalForm.office
      return // Остановить выполнение до подтверждения
    }

    // ПРОВЕРКА 2: Проверка изменения номера/офиса для верифицированных пользователей
    if (user.value.is_verified && (officeChanged || personalIdChanged)) {
      // Открыть модальное окно предупреждения
      showPersonalIdWarning.value = true
      pendingPersonalId.value = personalForm.personal_id
      pendingOffice.value = personalForm.office
      return // Остановить выполнение до подтверждения
    }

    // Если предупреждение не нужно, продолжить обычное сохранение
    savingPersonal.value = true

    try {
      await authStore.updateProfile({
        username: personalForm.username,
        full_name: personalForm.full_name,
        phone: personalForm.phone,
        city: personalForm.city,
        country: personalForm.country,
        office: personalForm.office,
        personal_id: personalForm.personal_id
      })

      personalSuccess.value = 'Личная информация успешно обновлена!'
      supportLinks.value = null

      setTimeout(() => {
        personalSuccess.value = ''
      }, 3000)
    } catch (err) {
      personalError.value = err.message || 'Произошла ошибка при сохранении'

      // Обработка ошибки VERIFIED_BY_OTHER
      if (err.errorType === 'VERIFIED_BY_OTHER') {
        supportLinks.value = {
          telegram: err.supportTelegram,
          email: err.supportEmail
        }
      } else {
        supportLinks.value = null
      }
    } finally {
      savingPersonal.value = false
    }
  }

  /**
   * Подтвердить изменение компьютерного номера
   */
  function confirmPersonalIdChange() {
    showPersonalIdWarning.value = false
    // Продолжить сохранение с новым номером
    savePersonalInfoConfirmed()
  }

  /**
   * Отменить изменение компьютерного номера
   */
  function cancelPersonalIdChange() {
    showPersonalIdWarning.value = false
    // Вернуть старые значения
    personalForm.personal_id = user.value.personal_id || ''
    personalForm.office = user.value.office || ''
    pendingPersonalId.value = ''
    pendingOffice.value = ''
    // Обновить суффикс
    if (user.value.personal_id && user.value.office) {
      personalIdSuffix.value = user.value.personal_id.replace(user.value.office.toUpperCase(), '')
    }
  }

  /**
   * Сохранить личную информацию после подтверждения
   */
  async function savePersonalInfoConfirmed() {
    savingPersonal.value = true
    personalError.value = ''
    personalSuccess.value = ''

    try {
      await authStore.updateProfile({
        username: personalForm.username,
        full_name: personalForm.full_name,
        phone: personalForm.phone,
        city: personalForm.city,
        country: personalForm.country,
        office: pendingOffice.value || personalForm.office,
        personal_id: pendingPersonalId.value || personalForm.personal_id
      })

      personalSuccess.value = 'Личная информация обновлена. Верификация отменена.'

      setTimeout(() => {
        personalSuccess.value = ''
      }, 3000)
    } catch (err) {
      personalError.value = err.message || 'Произошла ошибка при сохранении'
    } finally {
      savingPersonal.value = false
      pendingPersonalId.value = ''
      pendingOffice.value = ''
    }
  }

  /**
   * Отменить изменения при pending заявке
   */
  function cancelPendingChange() {
    showPendingWarning.value = false
    // Вернуть старые значения
    personalForm.personal_id = user.value.personal_id || ''
    personalForm.office = user.value.office || ''
    pendingPersonalId.value = ''
    pendingOffice.value = ''
    // Обновить суффикс
    if (user.value.personal_id && user.value.office) {
      personalIdSuffix.value = user.value.personal_id.replace(user.value.office.toUpperCase(), '')
    }
  }

  /**
   * Подтвердить изменения и отменить pending заявку
   */
  async function confirmPendingChange() {
    cancellingVerification.value = true
    try {
      // Отменить заявку на верификацию
      await cancelVerification()

      // Закрыть модальное окно
      showPendingWarning.value = false

      // Продолжить сохранение с новыми данными
      savingPersonal.value = true

      await authStore.updateProfile({
        username: personalForm.username,
        full_name: personalForm.full_name,
        phone: personalForm.phone,
        city: personalForm.city,
        country: personalForm.country,
        office: pendingOffice.value || personalForm.office,
        personal_id: pendingPersonalId.value || personalForm.personal_id
      })

      personalSuccess.value = 'Заявка на верификацию отменена. Данные обновлены.'

      setTimeout(() => {
        personalSuccess.value = ''
      }, 3000)
    } catch (err) {
      personalError.value = err.message || 'Произошла ошибка'
    } finally {
      cancellingVerification.value = false
      savingPersonal.value = false
      pendingPersonalId.value = ''
      pendingOffice.value = ''
    }
  }

  /**
   * Открыть подтверждение отмены заявки
   */
  function openCancelConfirm() {
    showCancelConfirm.value = true
  }

  /**
   * Закрыть подтверждение отмены заявки
   */
  function closeCancelConfirm() {
    showCancelConfirm.value = false
  }

  /**
   * Подтвердить отмену заявки
   */
  async function confirmCancelVerification() {
    cancellingVerification.value = true
    try {
      await cancelVerification()
      showCancelConfirm.value = false
      personalSuccess.value = 'Заявка на верификацию отменена.'
      setTimeout(() => {
        personalSuccess.value = ''
      }, 3000)
    } catch (err) {
      personalError.value = err.message || 'Не удалось отменить заявку'
    } finally {
      cancellingVerification.value = false
    }
  }

  /**
   * Инициализировать форму из данных пользователя
   */
  function initializeForm() {
    if (user.value) {
      personalForm.username = user.value.username || ''
      personalForm.full_name = user.value.full_name || ''
      personalForm.phone = user.value.phone || ''
      personalForm.city = user.value.city || ''
      personalForm.country = user.value.country || ''
      personalForm.office = user.value.office || ''
      personalForm.personal_id = user.value.personal_id || ''
      initializePersonalIdFields()
    }
  }

  return {
    // Constants
    OFFICE_PATTERN,

    // State
    personalForm,
    officeError,
    personalIdError,
    personalIdSuffix,
    personalError,
    personalSuccess,
    savingPersonal,
    supportLinks,
    showPersonalIdWarning,
    pendingPersonalId,
    pendingOffice,
    showPendingWarning,
    showCancelConfirm,
    cancellingVerification,

    // Computed
    officePrefix,
    isPersonalIdComplete,

    // Methods
    normalizeOffice,
    validateOffice,
    updatePersonalId,
    validatePersonalId,
    initializePersonalIdFields,
    savePersonalInfo,
    confirmPersonalIdChange,
    cancelPersonalIdChange,
    savePersonalInfoConfirmed,
    cancelPendingChange,
    confirmPendingChange,
    openCancelConfirm,
    closeCancelConfirm,
    confirmCancelVerification,
    initializeForm
  }
}
