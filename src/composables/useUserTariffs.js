import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useNotificationsStore } from '@/stores/notifications'

// Иерархия тарифов: чем выше число, тем выше тариф
const PLAN_LEVELS = {
  guest: 0,
  demo: 1,
  individual: 2,
  premium: 3
}

/**
 * Composable для управления тарифами
 *
 * Функционал:
 * - Загрузка доступных тарифов
 * - Форматирование функций тарифа
 * - Управление раскрытием карточек тарифов
 * - Переход к оплате через Продамус
 * - Определение состояния кнопок тарифов (правила перехода)
 */
export function useUserTariffs({ subscriptionStore }) {
  // === State ===
  const loadingPlans = ref(false)
  const availablePlans = ref([])
  const expandedPlanIds = ref([]) // Раскрытые карточки тарифов
  const showCurrentTariffFeatures = ref(false) // Показать возможности текущего тарифа

  // Маппинг для человекочитаемых названий функций тарифов
  const featureLabels = {
    // Лимиты
    'max_boards': (value) => value === -1 ? '∞ Безлимитные доски' : `📊 До ${value} досок`,
    'max_notes': (value) => value === -1 ? '∞ Безлимитные заметки' : `📝 До ${value} заметок`,
    'max_stickers': (value) => value === -1 ? '∞ Безлимитные стикеры' : `🎨 До ${value} стикеров`,
    'max_licenses': (value) => value === -1 ? '∞ Безлимитные лицензии' : `🗂️ До ${value} лицензий`,
    'max_cards_per_board': (value) => value === -1 ? '∞ Безлимитные лицензии' : `🗂️ До ${value} лицензий на доске`,
    'max_comments': (value) => value === -1 ? '∞ Безлимитные комментарии' : `💬 До ${value} комментариев`,

    // Булевы функции
    'can_export_pdf': '📄 Экспорт в PDF',
    'can_export_png_formats': (value) => {
      if (Array.isArray(value) && value.length > 0) {
        return `🖼️ Скачать доску (структуру) как изображение: ${value.join(', ')}`
      }
      return '🖼️ Скачать доску (структуру) как изображение'
    },
    'can_export_html': '🌐 Поделиться доской (структурой) как веб\u2011страницей',
    'can_invite_drawing': '✏️ Режим рисования',
    'can_duplicate_boards': '📋 Дублирование досок',
    'can_use_images': '🖼️ Изображения'
  }

  // Основные функции для краткого списка (первые 4)
  const primaryFeatures = ['max_boards', 'max_licenses', 'max_notes', 'max_stickers']

  // Дополнительные функции для расширенного списка
  const secondaryFeatures = [
    'max_comments',
    'can_export_png_formats',
    'can_export_html',
    'can_invite_drawing',
    'can_use_images',
    'can_export_pdf',
    'can_duplicate_boards'
  ]

  // === Методы ===

  /**
   * Форматирование функции
   */
  function formatFeature(key, value) {
    if (key in featureLabels) {
      const formatter = featureLabels[key]
      if (typeof formatter === 'function') {
        return formatter(value)
      }
      return formatter
    }
    return null
  }

  /**
   * Получение основных функций для карточки
   */
  function getPrimaryFeatures(features) {
    if (!features) return []
    return Object.entries(features)
      .filter(([key]) => primaryFeatures.includes(key))
      .map(([key, value]) => ({
        key,
        label: formatFeature(key, value),
        available: typeof value === 'boolean' ? value : true
      }))
      .filter(f => f.label !== null)
      .sort((a, b) => primaryFeatures.indexOf(a.key) - primaryFeatures.indexOf(b.key))
  }

  /**
   * Получение дополнительных функций для раскрытого списка
   */
  function getSecondaryFeatures(features) {
    if (!features) return []
    return Object.entries(features)
      .filter(([key]) => secondaryFeatures.includes(key))
      .map(([key, value]) => ({
        key,
        label: formatFeature(key, value),
        available: typeof value === 'boolean' ? value : true
      }))
      .filter(f => f.label !== null)
      .sort((a, b) => secondaryFeatures.indexOf(a.key) - secondaryFeatures.indexOf(b.key))
  }

  /**
   * Переключение раскрытия карточки тарифа
   */
  function togglePlanExpanded(planId) {
    const index = expandedPlanIds.value.indexOf(planId)
    if (index === -1) {
      expandedPlanIds.value.push(planId)
    } else {
      expandedPlanIds.value.splice(index, 1)
    }
  }

  /**
   * Проверка раскрыта ли карточка
   */
  function isPlanExpanded(planId) {
    return expandedPlanIds.value.includes(planId)
  }

  /**
   * Загрузить список доступных тарифов
   */
  async function loadAvailablePlans() {
    loadingPlans.value = true
    try {
      await subscriptionStore.fetchPlans()
      // Фильтруем планы - исключаем текущий
      availablePlans.value = subscriptionStore.plans.filter(
        plan => plan.code_name !== subscriptionStore.currentPlan?.code_name
      )
    } catch (err) {
      console.error('Ошибка загрузки тарифов:', err)
      availablePlans.value = []
    } finally {
      loadingPlans.value = false
    }
  }

  /**
   * Определение состояния кнопки для карточки тарифа
   *
   * Правила перехода:
   * - Апгрейд: разрешён всегда (без ограничений)
   * - Продление: разрешено за 30 дней до окончания (анти-стакинг: макс 60 дней)
   * - Даунгрейд: разрешён за 30 дней до окончания (отложенная активация)
   * - Запланированный тариф блокирует все покупки
   *
   * @param {Object} plan - тарифный план
   * @returns {{ label: string, disabled: boolean, tooltip: string, action: string }}
   */
  function getPlanButtonState(plan) {
    const currentPlan = subscriptionStore.currentPlan
    const daysLeft = subscriptionStore.daysLeft
    const hasScheduled = subscriptionStore.hasScheduledPlan

    // Неприобретаемые тарифы
    if (plan.code_name === 'guest' || plan.code_name === 'demo') {
      return { label: '', disabled: true, tooltip: '', action: 'unavailable' }
    }

    // Пользователь не авторизован или нет текущего плана
    if (!currentPlan) {
      return { label: 'Выбрать тариф', disabled: false, tooltip: '', action: 'upgrade' }
    }

    const currentLevel = PLAN_LEVELS[currentPlan.code_name] ?? 0
    const targetLevel = PLAN_LEVELS[plan.code_name] ?? 0

    // Этот тариф уже запланирован
    if (subscriptionStore.scheduledPlan?.code_name === plan.code_name) {
      return {
        label: 'Тариф запланирован',
        disabled: true,
        tooltip: 'Тариф активируется после окончания текущей подписки',
        action: 'scheduled'
      }
    }

    // Есть любой запланированный тариф — блокируем все покупки
    if (hasScheduled) {
      return {
        label: 'Тариф запланирован',
        disabled: true,
        tooltip: 'У вас уже есть запланированный тариф',
        action: 'unavailable'
      }
    }

    // Тот же тариф — продление
    if (plan.code_name === currentPlan.code_name) {
      // Нет активной подписки (Guest без срока)
      if (daysLeft === null || daysLeft <= 0) {
        return { label: 'Текущий план', disabled: true, tooltip: '', action: 'current' }
      }
      if (daysLeft > 30) {
        return {
          label: 'Продлить',
          disabled: true,
          tooltip: `Продление доступно за 30 дней до окончания. Осталось ${daysLeft} дн.`,
          action: 'renew'
        }
      }
      return {
        label: 'Продлить подписку',
        disabled: false,
        tooltip: '',
        action: 'renew'
      }
    }

    // Нет активной подписки или она истекла — можно купить любой
    if (daysLeft === null || daysLeft <= 0) {
      return { label: 'Выбрать тариф', disabled: false, tooltip: '', action: 'upgrade' }
    }

    // Апгрейд (Individual → Premium) — разрешён всегда
    if (targetLevel > currentLevel) {
      return {
        label: 'Повысить тариф',
        disabled: false,
        tooltip: '',
        action: 'upgrade'
      }
    }

    // Даунгрейд (Premium → Individual)
    if (targetLevel < currentLevel) {
      if (daysLeft > 30) {
        return {
          label: 'У вас более высокий тариф',
          disabled: true,
          tooltip: `Понижение доступно за 30 дней до окончания подписки. Осталось ${daysLeft} дн.`,
          action: 'downgrade'
        }
      }
      return {
        label: 'Перейти после окончания текущего',
        disabled: false,
        tooltip: 'Новый тариф активируется после окончания текущей подписки',
        action: 'downgrade'
      }
    }

    return { label: 'Выбрать тариф', disabled: false, tooltip: '', action: 'upgrade' }
  }

  /**
   * Переход на другой тариф через Продамус
   * Создаёт ссылку на оплату и перенаправляет пользователя
   */
  async function handleUpgrade(plan) {
    const authStore = useAuthStore()
    const notificationsStore = useNotificationsStore()
    const API_URL = import.meta.env.VITE_API_URL || 'https://interactive.marketingfohow.ru/api'

    const buttonState = getPlanButtonState(plan)

    // Подтверждение при даунгрейде
    if (buttonState.action === 'downgrade') {
      const expiryDate = subscriptionStore.currentPlan?.expiresAt
        ? new Date(subscriptionStore.currentPlan.expiresAt).toLocaleDateString('ru-RU')
        : ''

      const confirmed = window.confirm(
        `Вы переходите на тариф "${plan.name}".\n\n` +
        `Текущий тариф "${subscriptionStore.currentPlan?.name}" будет действовать до ${expiryDate}.\n` +
        `После этого автоматически активируется тариф "${plan.name}" на 30 дней.\n\n` +
        `Продолжить?`
      )
      if (!confirmed) return
    }

    try {
      const response = await fetch(`${API_URL}/payments/create-link`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authStore.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ planId: plan.id })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))

        // Обработка специфичных кодов ошибок
        const warningCodes = ['SCHEDULED_PLAN_EXISTS', 'RENEWAL_TOO_EARLY', 'DOWNGRADE_TOO_EARLY']
        if (errorData.code && warningCodes.includes(errorData.code)) {
          notificationsStore.addNotification({
            type: 'warning',
            message: errorData.error
          })
          return
        }

        throw new Error(errorData.error || 'Ошибка создания ссылки на оплату')
      }

      const data = await response.json()
      if (data.paymentUrl) {
        window.location.href = data.paymentUrl
      }
    } catch (error) {
      console.error('Ошибка при переходе к оплате:', error)
      notificationsStore.addNotification({
        type: 'error',
        message: error.message || 'Не удалось перейти к оплате. Попробуйте позже.'
      })
    }
  }

  return {
    // State
    loadingPlans,
    availablePlans,
    expandedPlanIds,
    showCurrentTariffFeatures,
    featureLabels,
    primaryFeatures,
    secondaryFeatures,

    // Methods
    formatFeature,
    getPrimaryFeatures,
    getSecondaryFeatures,
    togglePlanExpanded,
    isPlanExpanded,
    loadAvailablePlans,
    getPlanButtonState,
    handleUpgrade
  }
}
