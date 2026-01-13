import { ref } from 'vue'

/**
 * Composable для управления тарифами
 *
 * Функционал:
 * - Загрузка доступных тарифов
 * - Форматирование функций тарифа
 * - Управление раскрытием карточек тарифов
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
    'can_export_png': '🖼️ Экспорт в PNG',
    'can_export_png_formats': (value) => {
      if (Array.isArray(value) && value.length > 0) {
        return `📏 Экспорт в PNG: ${value.join(', ')}`
      }
      return '📏 Экспорт в разных форматах'
    },
    'can_export_html': '🌐 Экспорт в HTML',
    'can_invite_drawing': '✏️ Режим рисования',
    'can_duplicate_boards': '📋 Дублирование досок',
    'can_use_images': '🖼️ Изображения'
  }

  // Основные функции для краткого списка (первые 4)
  const primaryFeatures = ['max_boards', 'max_licenses', 'max_notes', 'max_stickers']

  // Дополнительные функции для расширенного списка
  const secondaryFeatures = [
    'max_comments',
    'can_export_png',
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
   * Маппинг code_name тарифа на Tribute product_id для веб-ссылок
   *
   * ВАЖНО: Для веб-ссылок (web.tribute.tg/s/{id}) НЕ нужен префикс 's'
   * В backend (tributeService.js) используется формат с префиксом 's' (sLe1, sLc8)
   * для обработки webhook'ов от Tribute — это разные форматы!
   */
  const TRIBUTE_PRODUCTS = {
    'premium': 'Le1',      // Premium - 399₽/мес
    'individual': 'Lc8'    // Individual - 249₽/мес
  }

  /**
   * Переход на другой тариф через Tribute
   * Открывает страницу оплаты Tribute в новой вкладке
   */
  function handleUpgrade(plan) {
    const productId = TRIBUTE_PRODUCTS[plan.code_name]

    if (!productId) {
      alert(`Оплата для тарифа "${plan.name}" временно недоступна. Пожалуйста, свяжитесь с поддержкой.`)
      return
    }

    // Открываем ссылку Tribute в новой вкладке
    const tributeUrl = `https://web.tribute.tg/s/${productId}`
    window.open(tributeUrl, '_blank')
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
    handleUpgrade
  }
}
