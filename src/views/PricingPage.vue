<template>
  <div class="pricing-page">
    <div class="pricing-container">
      <h1 class="pricing-title">Выберите подходящий тариф</h1>

      <!-- Переключатель периода оплаты -->
      <div class="billing-toggle">
        <button
          :class="['toggle-btn', { active: billingPeriod === 'monthly' }]"
          @click="billingPeriod = 'monthly'"
        >
          Помесячно
        </button>
        <button
          :class="['toggle-btn', { active: billingPeriod === 'yearly' }]"
          @click="billingPeriod = 'yearly'"
        >
          Годовая оплата
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
          v-for="plan in plans"
          :key="plan.id"
          :class="['pricing-card', { featured: plan.is_featured }]"
        >
          <!-- Плашка "Рекомендуем" -->
          <div v-if="plan.is_featured" class="featured-badge">
            Рекомендуем
          </div>

          <div class="card-content">
            <h2 class="plan-name">{{ plan.name }}</h2>
            <p class="plan-description">{{ plan.description }}</p>

            <div class="price-section">
              <div class="price">
                <span class="price-amount">
                  {{ billingPeriod === 'monthly' ? plan.price_monthly : plan.price_yearly }}
                </span>
                <span class="price-currency">₽</span>
              </div>
              <div class="price-period">
                {{ billingPeriod === 'monthly' ? '/ месяц' : '/ год' }}
              </div>
            </div>

            <!-- Список возможностей -->
            <ul class="features-list">
              <li v-for="(value, key) in plan.features" :key="key" class="feature-item">
                <svg class="feature-icon" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                </svg>
                <span>{{ formatFeature(key, value) }}</span>
              </li>
            </ul>

            <button class="select-plan-btn">
              Выбрать тариф
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const API_URL = import.meta.env.VITE_API_URL || 'https://interactive.marketingfohow.ru/api'

const plans = ref([])
const billingPeriod = ref('monthly')
const loading = ref(true)
const error = ref(null)

// Функция для форматирования возможностей тарифа
const formatFeature = (key, value) => {
  const featureNames = {
    max_cards_per_board: 'Карточек на доске',
    max_boards: 'Досок',
    session_limit: 'Активных сессий',
    storage_mb: 'Хранилище (МБ)',
    support_priority: 'Приоритет поддержки',
    custom_branding: 'Кастомный брендинг',
    api_access: 'Доступ к API',
    analytics: 'Аналитика'
  }

  const featureName = featureNames[key] || key

  if (typeof value === 'boolean') {
    return value ? featureName : `Нет: ${featureName}`
  }

  if (value === -1 || value === 'unlimited') {
    return `${featureName}: безлимит`
  }

  return `${featureName}: ${value}`
}

// Загрузка тарифов при монтировании компонента
onMounted(async () => {
  try {
    const response = await fetch(`${API_URL}/plans`)

    if (!response.ok) {
      throw new Error('Не удалось загрузить тарифы')
    }

    const data = await response.json()
    plans.value = data.plans || []
  } catch (err) {
    console.error('Ошибка загрузки тарифов:', err)
    error.value = 'Не удалось загрузить тарифы. Пожалуйста, попробуйте позже.'
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.pricing-page {
  min-height: 100vh;
  padding: 40px 20px;
  background: var(--color-background);
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
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 30px;
  margin-top: 40px;
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

/* Адаптивность */
@media (max-width: 768px) {
  .pricing-title {
    font-size: 2rem;
  }

  .pricing-grid {
    grid-template-columns: 1fr;
  }

  .toggle-btn {
    padding: 10px 20px;
    font-size: 14px;
  }
}
</style>
