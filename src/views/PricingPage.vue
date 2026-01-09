<template>
  <div class="pricing-page">
    <div class="pricing-container">
      <!-- Заголовок с анимацией -->
      <section class="pricing-hero fade-in">
        <h1 class="pricing-title">Выберите подходящий тариф</h1>
      </section>

      <!-- Переключатель периода оплаты -->
      <div class="billing-toggle fade-in" style="animation-delay: 0.1s">
        <button
          :class="['toggle-btn', { active: billingPeriod === 'monthly' }]"
          @click="billingPeriod = 'monthly'"
        >
          Помесячно
        </button>
        <button
          :class="['toggle-btn', { active: billingPeriod === '3-months' }]"
          @click="billingPeriod = '3-months'"
        >
          3 месяца
        </button>
      </div>

      <!-- Состояние загрузки -->
      <div v-if="loading" class="loading">
        <p>Загрузка тарифов...</p>
      </div>

      <!-- Сообщение об ошибке -->
      <div v-if="error" class="error-message">
        <p>{{ error }}</p>
      </div>

      <!-- Сетка с карточками тарифов -->
      <div v-if="!loading && !error" class="pricing-grid">
        <div
          v-for="(plan, index) in plans"
          :key="plan.id"
          :class="['pricing-card', 'fade-in-stagger', {
            featured: plan.is_featured,
            'is-current': isCurrentPlan(plan)
          }]"
          :style="{ animationDelay: `${index * 0.1}s` }"
        >
          <!-- Плашка "Рекомендуем" -->
          <div v-if="plan.is_featured" class="featured-badge">
            Рекомендуем
          </div>

          <!-- Бейдж "Текущий план" -->
          <div v-if="isCurrentPlan(plan)" class="badge-current">
            ✓ Ваш текущий план
          </div>

          <div class="card-content">
            <h2 class="plan-name">{{ plan.name }}</h2>
            <p class="plan-description">{{ plan.description }}</p>

            <div class="price-section">
              <div class="price">
                <span class="price-amount">
                  {{ getDisplayPrice(plan) }}
                </span>
                <span class="price-currency">₽</span>
              </div>
              <div class="price-period">
                {{ billingPeriod === 'monthly' ? '/ месяц' : '/ 3 месяца' }}
              </div>

              <!-- Показать экономию при оплате за 3 месяца -->
              <div v-if="billingPeriod === '3-months' && getMonthlySavings(plan) > 0" class="savings-badge">
                Экономия {{ getMonthlySavings(plan) }}₽ за 3 месяца
              </div>
            </div>

            <!-- Список возможностей -->
            <ul class="features-list">
              <li
                v-for="feature in getDisplayFeatures(plan.features)"
                :key="feature.key"
                class="feature-item"
              >
                <svg
                  v-if="feature.available"
                  class="feature-icon"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                </svg>
                <svg
                  v-else
                  class="feature-icon unavailable-icon"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                </svg>
                <span :class="{ 'line-through text-gray-400': !feature.available }">
                  {{ feature.label }}
                </span>
              </li>
            </ul>

            <!-- Кнопка -->
            <button
              v-if="isCurrentPlan(plan)"
              class="select-plan-btn btn-current"
              disabled
            >
              Текущий план
            </button>
            <button
              v-else-if="plan.code_name !== 'guest'"
              class="select-plan-btn"
            >
              Выбрать тариф
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useSubscriptionStore } from '@/stores/subscription'

const API_URL = import.meta.env.VITE_API_URL || 'https://interactive.marketingfohow.ru/api'

const subscriptionStore = useSubscriptionStore()

const plans = ref([])
const billingPeriod = ref('monthly')
const loading = ref(true)
const error = ref(null)

// Маппинг для человекочитаемых названий функций
const featureLabels = {
  // Лимиты
  'max_boards': (value) => value === -1 ? '∞ Безлимитные доски' : `📊 До ${value} досок`,
  'max_notes': (value) => value === -1 ? '∞ Безлимитные заметки' : `📝 До ${value} заметок`,
  'max_stickers': (value) => value === -1 ? '∞ Безлимитные стикеры' : `🎨 До ${value} стикеров`,
  'max_licenses': (value) => value === -1 ? '∞ Безлимитные карточки' : `🗂️ До ${value} карточек`,
  'max_cards_per_board': (value) => value === -1 ? '∞ Безлимитные карточки' : `🗂️ До ${value} карточек на доске`,
  'max_comments': (value) => value === -1 ? '∞ Безлимитные комментарии' : `💬 До ${value} комментариев`,
  'max_team_members': (value) => `👥 До ${value} участников`,

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
  'can_use_images': '🖼️ Изображения',
  'can_save_project': '💾 Сохранение проекта',
  'can_load_project': '📂 Загрузка проекта',
  'can_share_project': '🔗 Поделиться проектом',
  'can_share_boards': '🔗 Поделиться досками',
  'can_duplicate_boards': '📋 Дублирование досок',
  'can_use_templates': '📑 Готовые шаблоны',
  'can_invite_members': '👥 Приглашение участников',
  'can_use_shared_structures': '🏢 Совместные структуры',

  // Поддержка
  'support_level': (value) => {
    const levels = {
      'basic': '📧 Базовая поддержка',
      'priority': '⚡ Приоритетная поддержка',
      'dedicated': '🎯 Персональный менеджер'
    }
    return levels[value] || value
  }
}

// Список важных функций для отображения (в порядке приоритета)
const importantFeatures = [
  'max_boards',
  'max_licenses',
  'max_notes',
  'max_stickers',
  'max_comments',
  'can_export_png',
  'can_export_png_formats',
  'can_export_html',
  'can_invite_drawing',
  'can_use_images',
  'can_export_pdf',
  'can_save_project',
  'can_load_project',
  'can_share_project',
  'can_share_boards',
  'can_duplicate_boards',
  'can_use_templates',
  'can_invite_members',
  'can_use_shared_structures',
  'max_team_members',
  'support_level'
]

// Функция форматирования
function formatFeature(key, value) {
  if (key in featureLabels) {
    const formatter = featureLabels[key]
    if (typeof formatter === 'function') {
      return formatter(value)
    }
    return formatter
  }

  // Если нет в маппинге, пропускаем
  return null
}

// Функция для получения отфильтрованных функций
function getDisplayFeatures(features) {
  return Object.entries(features)
    .filter(([key]) => importantFeatures.includes(key))
    .map(([key, value]) => ({
      key,
      label: formatFeature(key, value),
      available: typeof value === 'boolean' ? value : true
    }))
    .filter(f => f.label !== null) // Убрать null
    .sort((a, b) => {
      // Сортируем по порядку в importantFeatures
      return importantFeatures.indexOf(a.key) - importantFeatures.indexOf(b.key)
    })
}

// Проверка текущего плана
function isCurrentPlan(plan) {
  return subscriptionStore.currentPlan?.code_name === plan.code_name
}

// Вычисление отображаемой цены (с учетом скидки для оплаты за 3 месяца)
function getDisplayPrice(plan) {
  if (billingPeriod.value === '3-months') {
    // Цена за 3 месяца с 10% скидкой
    const basePrice = plan.price_monthly || 0
    const threeMonthsPrice = basePrice * 3 * 0.9
    return Math.round(threeMonthsPrice)
  }
  return plan.price_monthly || 0
}

// Вычисление экономии при оплате за 3 месяца
function getMonthlySavings(plan) {
  if (billingPeriod.value === '3-months') {
    const basePrice = plan.price_monthly || 0
    const fullThreeMonths = basePrice * 3
    const discountedThreeMonths = getDisplayPrice(plan)
    return fullThreeMonths - discountedThreeMonths
  }
  return 0
}

// Загрузка тарифов при монтировании компонента
onMounted(async () => {
  try {
    // Загружаем текущий план пользователя (если авторизован)
    const token = localStorage.getItem('token')
    if (token) {
      try {
        await subscriptionStore.loadPlan()
      } catch (err) {
        // Игнорируем ошибки загрузки плана пользователя
        console.warn('Не удалось загрузить текущий план:', err)
      }
    }

    const response = await fetch(`${API_URL}/plans`)

    if (!response.ok) {
      throw new Error('Не удалось загрузить тарифы')
    }

    const data = await response.json()
    let loadedPlans = data.plans || []

    // Добавляем демо-план, если его нет в API
    const hasDemoPlan = loadedPlans.some(plan => plan.code_name === 'demo')

    if (!hasDemoPlan) {
      const demoPlan = {
        id: 0,
        name: 'Демо',
        code_name: 'demo',
        description: 'Попробуйте все возможности бесплатно',
        price_monthly: 0,
        price_yearly: 0,
        features: {
          max_boards: 2,
          max_notes: -1,
          max_stickers: -1,
          max_licenses: -1,
          max_comments: -1,
          can_export_pdf: false,
          can_export_png: false,
          can_duplicate_boards: false
        },
        is_featured: false
      }

      loadedPlans = [demoPlan, ...loadedPlans]
    }

    plans.value = loadedPlans
  } catch (err) {
    console.error('Ошибка загрузки тарифов:', err)
    error.value = 'Не удалось загрузить тарифы. Пожалуйста, попробуйте позже.'
  } finally {
    loading.value = false
  }
})
</script>

<style>
/* Глобальные стили для публичной страницы pricing */
body {
  background: #f5f5f5 !important;
}

html {
  background: #f5f5f5 !important;
}
</style>

<style scoped>
.pricing-page {
  min-height: 100vh;
  padding: 40px 20px;
  background: #ffffff;
  position: relative;
  z-index: 1;
}

.pricing-container {
  max-width: 1200px;
  margin: 0 auto;
}

.pricing-title {
  font-size: 2.5rem;
  font-weight: 700;
  text-align: center;
  color: var(--color-heading);
  margin-bottom: 40px;
}

/* Переключатель периода оплаты */
.billing-toggle {
  display: flex;
  justify-content: center;
  gap: 0;
  margin-bottom: 50px;
}

.toggle-btn {
  padding: 12px 30px;
  font-size: 16px;
  font-weight: 500;
  border: 2px solid var(--color-border);
  background: var(--color-background);
  color: var(--color-text);
  cursor: pointer;
  transition: all 0.3s ease;
}

.toggle-btn:first-child {
  border-radius: 8px 0 0 8px;
  border-right: 1px solid var(--color-border);
}

.toggle-btn:last-child {
  border-radius: 0 8px 8px 0;
  border-left: 1px solid var(--color-border);
}

.toggle-btn:hover {
  background: var(--color-background-soft);
}

.toggle-btn.active {
  background: var(--vt-c-indigo);
  color: white;
  border-color: var(--vt-c-indigo);
}

/* Состояния загрузки и ошибки */
.loading,
.error-message {
  text-align: center;
  padding: 40px;
  font-size: 18px;
}

.error-message {
  color: #e74c3c;
}

/* Сетка тарифов */
.pricing-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 24px;
  max-width: 1400px;
  margin: 40px auto 0;
}

@media (min-width: 1200px) {
  .pricing-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

/* Карточка тарифа */
.pricing-card {
  position: relative;
  background: var(--color-background-soft);
  border: 2px solid var(--color-border);
  border-radius: 12px;
  padding: 30px;
  transition: all 0.3s ease;
  display: flex;
  flex-direction: column;
}

.pricing-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
  border-color: var(--vt-c-indigo);
}

.pricing-card.featured {
  border-color: var(--vt-c-indigo);
  border-width: 3px;
}

/* Текущий план пользователя */
.pricing-card.is-current {
  border: 3px solid #10b981;
  background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
}

/* Контрастный текст для карточки текущего тарифа */
.pricing-card.is-current .plan-name {
  color: #065f46;
}

.pricing-card.is-current .plan-description {
  color: #047857;
}

.pricing-card.is-current .feature-item {
  color: #047857;
}

/* Плашка "Рекомендуем" */
.featured-badge {
  position: absolute;
  top: -15px;
  left: 50%;
  transform: translateX(-50%);
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 8px 20px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

/* Бейдж текущего плана */
.badge-current {
  position: absolute;
  top: -12px;
  left: 50%;
  transform: translateX(-50%);
  background: #10b981;
  color: white;
  padding: 6px 16px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
}

/* Содержимое карточки */
.card-content {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.plan-name {
  font-size: 1.8rem;
  font-weight: 700;
  color: var(--color-heading);
  margin-bottom: 10px;
}

.plan-description {
  color: var(--color-text);
  margin-bottom: 25px;
  line-height: 1.5;
  flex-grow: 0;
}

/* Секция цены */
.price-section {
  margin-bottom: 30px;
  padding-bottom: 25px;
  border-bottom: 2px solid var(--color-border);
}

.price {
  display: flex;
  align-items: baseline;
  gap: 5px;
  margin-bottom: 5px;
}

.price-amount {
  font-size: 3rem;
  font-weight: 700;
  color: var(--vt-c-indigo);
}

.price-currency {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--vt-c-indigo);
}

.price-period {
  font-size: 1rem;
  color: var(--color-text);
  opacity: 0.7;
}

/* Бейдж экономии */
.savings-badge {
  margin-top: 12px;
  padding: 6px 12px;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 600;
  text-align: center;
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
}

/* Список возможностей */
.features-list {
  list-style: none;
  padding: 0;
  margin: 0 0 30px 0;
  flex-grow: 1;
}

.feature-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 12px;
  color: var(--color-text);
}

.feature-icon {
  width: 20px;
  height: 20px;
  color: #10b981;
  flex-shrink: 0;
  margin-top: 2px;
}

/* Недоступная функция */
.line-through {
  text-decoration: line-through;
}

.text-gray-400 {
  color: #9ca3af;
}

.feature-icon.unavailable-icon {
  color: #ef4444;
}

/* Кнопка выбора тарифа */
.select-plan-btn {
  width: 100%;
  padding: 14px 24px;
  font-size: 16px;
  font-weight: 600;
  color: white;
  background: var(--vt-c-indigo);
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  margin-top: auto;
}

.select-plan-btn:hover {
  background: #1e2d3d;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(44, 62, 80, 0.3);
}

.select-plan-btn:active {
  transform: translateY(0);
}

/* Кнопка текущего плана */
.btn-current {
  background: #9ca3af;
  cursor: not-allowed;
  opacity: 0.7;
}

.btn-current:hover {
  background: #9ca3af;
  transform: none;
  box-shadow: none;
}

/* Адаптивность */
@media (max-width: 768px) {
  .pricing-title {
    font-size: 2rem;
  }

  .pricing-grid {
    grid-template-columns: 1fr !important;
  }

  .toggle-btn {
    padding: 10px 20px;
    font-size: 14px;
  }
}
</style>
