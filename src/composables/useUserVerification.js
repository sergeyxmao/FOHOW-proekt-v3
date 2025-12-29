import { ref, reactive, computed } from 'vue'

/**
 * Composable для управления верификацией пользователя
 *
 * Функционал:
 * - Загрузка статуса и истории верификации
 * - Отправка и отмена заявок на верификацию
 * - Управление cooldown-таймером
 * - Модальные окна верификации
 */
export function useUserVerification({ user, authStore, API_URL, personalForm }) {
  // === State ===
  const verificationStatus = reactive({
    isVerified: false,
    hasPendingRequest: false,
    lastRejection: null,
    lastAttempt: null,
    cooldownUntil: null
  })

  const showVerificationModal = ref(false)
  const verificationForm = reactive({
    full_name: '',
    screenshot_1: null,
    screenshot_2: null
  })

  const verificationError = ref('')
  const submittingVerification = ref(false)
  const cancellingVerification = ref(false)

  // История верификации
  const verificationHistory = ref([])
  const loadingHistory = ref(false)
  const showHistory = ref(false)

  // Cooldown
  const cooldownTimeRemaining = ref('')
  let cooldownTimerInterval = null
  let verificationCheckInterval = null

  // === Computed ===

  const canSubmitVerification = computed(() => {
    // Нельзя подать заявку, если уже есть ожидающая
    if (verificationStatus.hasPendingRequest) return false

    // Нельзя подать заявку, если не указан компьютерный номер
    if (!personalForm.personal_id || !personalForm.personal_id.trim()) return false

    // Нельзя подать заявку, если действует кулдаун
    if (verificationStatus.cooldownUntil) {
      const now = new Date()
      const cooldownEnd = new Date(verificationStatus.cooldownUntil)
      if (now < cooldownEnd) return false
    }

    return true
  })

  const cooldownMessage = computed(() => {
    if (!verificationStatus.cooldownUntil) return ''

    const now = new Date()
    const cooldownEnd = new Date(verificationStatus.cooldownUntil)

    if (now >= cooldownEnd) return ''

    // Если есть точное оставшееся время, показать его
    if (cooldownTimeRemaining.value) {
      return `Повторная заявка доступна через ${cooldownTimeRemaining.value}`
    }

    // Fallback на часы/дни (если таймер ещё не запущен)
    const diffMs = cooldownEnd - now
    const diffHours = Math.ceil(diffMs / (1000 * 60 * 60))
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays > 1) {
      return `Повторная заявка доступна через ${diffDays} дн.`
    } else if (diffHours > 1) {
      return `Повторная заявка доступна через ${diffHours} ч.`
    } else {
      return 'Повторная заявка скоро будет доступна'
    }
  })

  // === Методы ===

  /**
   * Обновление таймера обратного отсчёта кулдауна
   */
  function updateCooldownTime() {
    const endTime = verificationStatus.cooldownUntil

    if (!endTime) {
      cooldownTimeRemaining.value = ''
      return
    }

    const now = new Date()
    const end = new Date(endTime)
    const diff = end - now

    if (diff <= 0) {
      cooldownTimeRemaining.value = ''
      // Очистить интервал
      if (cooldownTimerInterval) {
        clearInterval(cooldownTimerInterval)
        cooldownTimerInterval = null
      }
      // Перезагрузить статус
      loadVerificationStatus()
      return
    }

    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((diff % (1000 * 60)) / 1000)

    if (hours > 0) {
      cooldownTimeRemaining.value = `${hours}ч ${minutes}м ${seconds}с`
    } else if (minutes > 0) {
      cooldownTimeRemaining.value = `${minutes}м ${seconds}с`
    } else {
      cooldownTimeRemaining.value = `${seconds}с`
    }
  }

  /**
   * Запустить таймер кулдауна
   */
  function startCooldownTimer() {
    // Очистить предыдущий интервал
    if (cooldownTimerInterval) {
      clearInterval(cooldownTimerInterval)
    }

    // Запустить обновление каждую секунду
    cooldownTimerInterval = setInterval(updateCooldownTime, 1000)
    // Сразу обновить
    updateCooldownTime()
  }

  /**
   * Загрузка статуса верификации
   */
  async function loadVerificationStatus() {
    try {
      const response = await fetch(`${API_URL}/verification/status`, {
        headers: {
          'Authorization': `Bearer ${authStore.token}`
        }
      })

      if (response.ok) {
        const data = await response.json()

        // Если статус верификации изменился, обновить профиль пользователя
        if (data.isVerified !== user.value.is_verified) {
          await authStore.fetchProfile()
        }

        verificationStatus.isVerified = data.isVerified || false
        verificationStatus.hasPendingRequest = data.hasPendingRequest || false
        verificationStatus.lastRejection = data.lastRejection || null
        verificationStatus.lastAttempt = data.lastAttempt || null
        verificationStatus.cooldownUntil = data.cooldownUntil || null

        // Запустить таймер обратного отсчёта, если есть активный кулдаун
        if (data.cooldownUntil) {
          startCooldownTimer()
        } else {
          // Очистить таймер если кулдаун закончился
          if (cooldownTimerInterval) {
            clearInterval(cooldownTimerInterval)
            cooldownTimerInterval = null
          }
          cooldownTimeRemaining.value = ''
        }
      }
    } catch (error) {
      console.error('Ошибка загрузки статуса верификации:', error)
    }
  }

  /**
   * Загрузка истории верификации
   */
  async function loadVerificationHistory() {
    loadingHistory.value = true

    try {
      const response = await fetch(`${API_URL}/verification/history`, {
        headers: {
          'Authorization': `Bearer ${authStore.token}`
        }
      })

      if (!response.ok) {
        throw new Error('Ошибка загрузки истории')
      }

      const data = await response.json()
      verificationHistory.value = data.history || []
    } catch (err) {
      console.error('Ошибка загрузки истории верификации:', err)
    } finally {
      loadingHistory.value = false
    }
  }

  /**
   * Открыть историю верификации
   */
  function openHistory() {
    showHistory.value = true
    loadVerificationHistory()
  }

  /**
   * Закрыть историю верификации
   */
  function closeHistory() {
    showHistory.value = false
  }

  /**
   * Получить метку статуса
   */
  function getStatusLabel(status) {
    const labels = {
      'pending': '⏳ На модерации',
      'approved': '✅ Одобрено',
      'rejected': '❌ Отклонено'
    }
    return labels[status] || status
  }

  /**
   * Получить класс статуса
   */
  function getStatusClass(status) {
    return `status-${status}`
  }

  /**
   * Открыть модальное окно верификации
   */
  function openVerificationModal() {
    if (!canSubmitVerification.value) {
      return
    }

    // Предзаполнить ФИО из профиля
    verificationForm.full_name = user.value.full_name || ''
    verificationForm.screenshot_1 = null
    verificationForm.screenshot_2 = null
    verificationError.value = ''

    showVerificationModal.value = true
  }

  /**
   * Закрыть модальное окно верификации
   */
  function closeVerificationModal() {
    showVerificationModal.value = false
    verificationForm.full_name = ''
    verificationForm.screenshot_1 = null
    verificationForm.screenshot_2 = null
    verificationError.value = ''
  }

  /**
   * Обработка выбора файла скриншота
   */
  function handleScreenshotChange(event, screenshotNumber) {
    const file = event.target.files[0]

    if (!file) {
      return
    }

    // Валидация типа файла
    if (!file.type.match(/^image\/(jpeg|png)$/)) {
      verificationError.value = 'Допустимы только файлы JPG и PNG'
      event.target.value = ''
      return
    }

    // Валидация размера файла (5MB)
    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      verificationError.value = `Файл ${screenshotNumber === 1 ? '1' : '2'} превышает максимальный размер 5MB`
      event.target.value = ''
      return
    }

    if (screenshotNumber === 1) {
      verificationForm.screenshot_1 = file
    } else {
      verificationForm.screenshot_2 = file
    }

    verificationError.value = ''
  }

  /**
   * Отправить заявку на верификацию
   */
  async function submitVerification() {
    verificationError.value = ''

    // Валидация формы
    if (!verificationForm.full_name.trim()) {
      verificationError.value = 'Введите полное ФИО'
      return
    }

    if (!verificationForm.screenshot_1) {
      verificationError.value = 'Загрузите первый скриншот'
      return
    }

    if (!verificationForm.screenshot_2) {
      verificationError.value = 'Загрузите второй скриншот'
      return
    }

    submittingVerification.value = true

    try {
      const formData = new FormData()
      formData.append('full_name', verificationForm.full_name.trim())
      formData.append('screenshot_1', verificationForm.screenshot_1)
      formData.append('screenshot_2', verificationForm.screenshot_2)

      const response = await fetch(`${API_URL}/verification/submit`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authStore.token}`
        },
        body: formData
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка отправки заявки')
      }

      // Закрыть модальное окно
      closeVerificationModal()

      // Обновить статус верификации
      await loadVerificationStatus()

      // Показать успешное уведомление
      alert('Заявка на верификацию отправлена! Ожидайте проверки администратором.')

    } catch (err) {
      verificationError.value = err.message || 'Не удалось отправить заявку. Попробуйте позже.'
    } finally {
      submittingVerification.value = false
    }
  }

  /**
   * Отменить заявку на верификацию
   */
  async function cancelVerification() {
    const token = localStorage.getItem('token')
    if (!token) {
      throw new Error('Необходима авторизация')
    }

    const response = await fetch(`${API_URL}/verification/cancel`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Ошибка отмены заявки')
    }

    // Обновить статус верификации
    await loadVerificationStatus()

    return true
  }

  /**
   * Запуск автоматической проверки статуса верификации
   */
  function startVerificationCheck() {
    verificationCheckInterval = setInterval(async () => {
      if (verificationStatus.hasPendingRequest) {
        await loadVerificationStatus()
      }
    }, 10000) // 10 секунд
  }

  /**
   * Очистка ресурсов при размонтировании
   */
  function cleanup() {
    if (verificationCheckInterval) {
      clearInterval(verificationCheckInterval)
      verificationCheckInterval = null
    }

    if (cooldownTimerInterval) {
      clearInterval(cooldownTimerInterval)
      cooldownTimerInterval = null
    }
  }

  return {
    // State
    verificationStatus,
    showVerificationModal,
    verificationForm,
    verificationError,
    submittingVerification,
    cancellingVerification,
    verificationHistory,
    loadingHistory,
    showHistory,
    cooldownTimeRemaining,

    // Computed
    canSubmitVerification,
    cooldownMessage,

    // Methods
    loadVerificationStatus,
    loadVerificationHistory,
    openHistory,
    closeHistory,
    getStatusLabel,
    getStatusClass,
    openVerificationModal,
    closeVerificationModal,
    handleScreenshotChange,
    submitVerification,
    cancelVerification,
    startVerificationCheck,
    cleanup
  }
}
