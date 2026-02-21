<template>
  <div class="pricing-page">
    <div class="pricing-container">
      <!-- Заголовок -->
      <section class="pricing-hero">
        <h1 class="pricing-title">Выберите подходящий тариф</h1>
        <p class="pricing-subtitle">Подберите план, который подходит именно вам</p>
      </section>

      <!-- Состояние загрузки -->
      <div v-if="loading" class="pricing-loading">
        <div class="pricing-spinner"></div>
        <p>Загрузка тарифов...</p>
      </div>

      <!-- Сообщение об ошибке -->
      <div v-if="error" class="pricing-error">
        <p>{{ error }}</p>
      </div>

      <!-- Сетка с карточками тарифов -->
      <div v-if="!loading && !error" class="pricing-grid">
        <div
          v-for="plan in plans"
          :key="plan.id"
          class="plan-card"
          :class="{
            'plan-card--featured': plan.is_featured,
            'plan-card--current': isCurrentPlan(plan),
            'plan-card--expanded': isPlanExpanded(plan.id)
          }"
        >
          <!-- Бейдж "Рекомендуем" -->
          <div v-if="plan.is_featured && !isCurrentPlan(plan)" class="plan-badge plan-badge--featured">
            Рекомендуем
          </div>

          <!-- Бейдж "Ваш текущий план" -->
          <div v-if="isCurrentPlan(plan)" class="plan-badge plan-badge--current">
            ✓ Ваш текущий план
          </div>

          <!-- Название и описание -->
          <h2 class="plan-name">{{ plan.name }}</h2>
          <p v-if="plan.description" class="plan-description">{{ plan.description }}</p>

          <!-- Цена -->
          <div class="plan-price">
            <span class="plan-price-amount">{{ plan.price_monthly || 0 }}</span>
            <span class="plan-price-period">₽/мес</span>
          </div>

          <!-- Разделитель -->
          <div class="plan-divider"></div>

          <!-- Основные функции (всегда видны) -->
          <ul class="plan-features plan-features--primary">
            <li
              v-for="feature in getPrimaryFeatures(plan.features)"
              :key="feature.key"
              :class="{ 'feature-unavailable': !feature.available }"
            >
              <span class="feature-icon">{{ feature.available ? '✓' : '✗' }}</span>
              {{ feature.label }}
            </li>
          </ul>

          <!-- Кнопка раскрытия дополнительных функций -->
          <button
            v-if="getSecondaryFeatures(plan.features).length > 0"
            class="btn-expand"
            @click="togglePlanExpanded(plan.id)"
          >
            <span v-if="isPlanExpanded(plan.id)">Скрыть подробности ▲</span>
            <span v-else>Подробнее ▼</span>
          </button>

          <!-- Дополнительные функции (раскрываются) -->
          <div v-if="isPlanExpanded(plan.id)" class="plan-features-expanded">
            <ul class="plan-features plan-features--secondary">
              <li
                v-for="feature in getSecondaryFeatures(plan.features)"
                :key="feature.key"
                :class="{ 'feature-unavailable': !feature.available }"
              >
                <span class="feature-icon">{{ feature.available ? '✓' : '✗' }}</span>
                {{ feature.label }}
              </li>
            </ul>
          </div>

          <!-- Кнопка действия -->
          <div v-if="plan.code_name !== 'guest' && plan.code_name !== 'demo'" class="plan-action">
            <button
              v-if="isCurrentPlan(plan) && (!getPlanButtonState(plan).action || getPlanButtonState(plan).action === 'current')"
              class="btn-plan btn-plan--current"
              disabled
            >
              Текущий план
            </button>
            <button
              v-else
              class="btn-plan"
              :class="{
                'btn-plan--disabled': getPlanButtonState(plan).disabled,
                'btn-plan--downgrade': getPlanButtonState(plan).action === 'downgrade' && !getPlanButtonState(plan).disabled,
                'btn-plan--renew': getPlanButtonState(plan).action === 'renew' && !getPlanButtonState(plan).disabled,
                'btn-plan--scheduled': getPlanButtonState(plan).action === 'scheduled' || getPlanButtonState(plan).action === 'unavailable'
              }"
              :disabled="getPlanButtonState(plan).disabled"
              :title="getPlanButtonState(plan).tooltip"
              @click="handleUpgrade(plan)"
            >
              {{ getPlanButtonState(plan).label || 'Выбрать тариф' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Ссылка назад -->
      <div v-if="!loading" class="pricing-back">
        <a href="/" class="pricing-back-link">← Вернуться на главную</a>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useSubscriptionStore } from '@/stores/subscription'
import { useUserTariffs } from '@/composables/useUserTariffs'

const API_URL = import.meta.env.VITE_API_URL || 'https://interactive.marketingfohow.ru/api'

const subscriptionStore = useSubscriptionStore()

const {
  handleUpgrade,
  getPlanButtonState,
  getPrimaryFeatures,
  getSecondaryFeatures,
  togglePlanExpanded,
  isPlanExpanded
} = useUserTariffs({ subscriptionStore })

const plans = ref([])
const loading = ref(true)
const error = ref(null)

function isCurrentPlan(plan) {
  return subscriptionStore.currentPlan?.code_name === plan.code_name
}

onMounted(async () => {
  try {
    const token = localStorage.getItem('token')
    if (token) {
      try {
        await subscriptionStore.loadPlan()
      } catch (err) {
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
        features: {
          max_boards: 2,
          max_notes: -1,
          max_stickers: -1,
          max_licenses: -1,
          max_comments: -1,
          can_export_png_formats: false,
          can_export_html: false,
          can_duplicate_boards: false,
          can_invite_drawing: true,
          can_use_images: false
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

<style scoped>
.pricing-page {
  min-height: 100vh;
  min-height: 100dvh;
  min-width: 320px;
  padding: 40px 20px 60px;
  background: rgba(17, 24, 39, 0.97);
  color: #e2e8f0;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.pricing-container {
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
}

/* Заголовок */
.pricing-hero {
  text-align: center;
  margin-bottom: 48px;
}

.pricing-title {
  font-size: 2rem;
  font-weight: 700;
  color: #fff;
  margin: 0 0 12px 0;
}

.pricing-subtitle {
  font-size: 16px;
  color: rgba(148, 163, 184, 0.9);
  margin: 0;
}

/* Загрузка */
.pricing-loading {
  text-align: center;
  padding: 60px 20px;
  color: rgba(148, 163, 184, 0.9);
  font-size: 16px;
}

.pricing-spinner {
  width: 36px;
  height: 36px;
  border: 3px solid rgba(255, 193, 7, 0.2);
  border-top-color: #ffc107;
  border-radius: 50%;
  margin: 0 auto 16px;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Ошибка */
.pricing-error {
  text-align: center;
  padding: 40px 20px;
  color: #fca5a5;
  font-size: 16px;
}

/* Сетка тарифов */
.pricing-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 20px;
}

@media (min-width: 1100px) {
  .pricing-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

/* Карточка тарифа */
.plan-card {
  position: relative;
  padding: 24px 20px;
  background: rgba(30, 41, 59, 0.85);
  border: 2px solid rgba(148, 163, 184, 0.2);
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  transition: all 0.3s ease;
}

.plan-card:hover {
  border-color: rgba(255, 193, 7, 0.5);
  transform: translateY(-4px);
  box-shadow: 0 12px 32px rgba(255, 193, 7, 0.15);
}

/* Рекомендуемый тариф */
.plan-card--featured {
  border-color: rgba(255, 193, 7, 0.5);
}

/* Текущий план */
.plan-card--current {
  border-color: #ffc107;
  background: linear-gradient(135deg, rgba(255, 193, 7, 0.12) 0%, rgba(232, 169, 0, 0.08) 100%);
}

/* Бейджи */
.plan-badge {
  position: absolute;
  top: -12px;
  left: 50%;
  transform: translateX(-50%);
  padding: 4px 16px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.plan-badge--featured {
  background: linear-gradient(135deg, #ffc107 0%, #e8a900 100%);
  color: #000;
}

.plan-badge--current {
  background: #10b981;
  color: #fff;
}

/* Название */
.plan-name {
  font-size: 22px;
  font-weight: 700;
  color: #fff;
  margin: 8px 0 8px 0;
}

/* Описание */
.plan-description {
  font-size: 13px;
  color: rgba(148, 163, 184, 0.9);
  margin: 0 0 16px 0;
  line-height: 1.5;
}

/* Цена */
.plan-price {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin-bottom: 20px;
}

.plan-price-amount {
  font-size: 32px;
  font-weight: 700;
  color: #e8a900;
}

.plan-price-period {
  font-size: 14px;
  color: rgba(148, 163, 184, 0.7);
}

/* Разделитель */
.plan-divider {
  height: 1px;
  background: rgba(148, 163, 184, 0.15);
  margin-bottom: 16px;
}

/* Список функций */
.plan-features {
  list-style: none;
  padding: 0;
  margin: 0 0 12px 0;
}

.plan-features li {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 4px 0;
  font-size: 13px;
  color: #e2e8f0;
}

.plan-features li .feature-icon {
  flex-shrink: 0;
  font-weight: 600;
  color: #4CAF50;
}

.plan-features li.feature-unavailable {
  color: rgba(148, 163, 184, 0.5);
  text-decoration: line-through;
}

.plan-features li.feature-unavailable .feature-icon {
  color: #e74c3c;
}

.plan-features--primary {
  margin-bottom: 8px;
}

.plan-features--secondary {
  padding-top: 8px;
  border-top: 1px dashed rgba(148, 163, 184, 0.2);
}

/* Кнопка раскрытия */
.btn-expand {
  width: 100%;
  padding: 6px 12px;
  margin-bottom: 12px;
  background: transparent;
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 6px;
  color: rgba(148, 163, 184, 0.7);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-expand:hover {
  border-color: rgba(255, 193, 7, 0.5);
  color: #e8a900;
  transform: none;
  box-shadow: none;
}

/* Раскрытие функций */
.plan-features-expanded {
  animation: expandFeatures 0.3s ease;
}

@keyframes expandFeatures {
  from { opacity: 0; max-height: 0; }
  to { opacity: 1; max-height: 500px; }
}

.plan-card--expanded {
  background: rgba(30, 41, 59, 0.95);
}

/* Кнопка действия */
.plan-action {
  margin-top: auto;
  padding-top: 16px;
}

.btn-plan {
  width: 100%;
  padding: 12px;
  background: linear-gradient(135deg, #ffc107 0%, #e8a900 100%);
  color: #000;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-plan:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(255, 193, 7, 0.4);
}

.btn-plan:active {
  transform: translateY(0);
}

/* Текущий план */
.btn-plan--current {
  background: rgba(148, 163, 184, 0.2);
  color: rgba(148, 163, 184, 0.6);
  cursor: not-allowed;
}

.btn-plan--current:hover {
  transform: none;
  box-shadow: none;
}

/* Заблокированная */
.btn-plan--disabled {
  background: rgba(148, 163, 184, 0.15);
  color: rgba(148, 163, 184, 0.5);
  cursor: not-allowed;
  opacity: 0.7;
}

.btn-plan--disabled:hover {
  transform: none;
  box-shadow: none;
}

/* Даунгрейд */
.btn-plan--downgrade {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: #000;
}

.btn-plan--downgrade:hover {
  box-shadow: 0 6px 16px rgba(245, 158, 11, 0.4);
}

/* Продление */
.btn-plan--renew {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: #fff;
}

.btn-plan--renew:hover {
  box-shadow: 0 6px 16px rgba(16, 185, 129, 0.4);
}

/* Запланированный */
.btn-plan--scheduled {
  background: rgba(107, 114, 128, 0.3);
  color: rgba(148, 163, 184, 0.6);
  cursor: not-allowed;
  opacity: 0.7;
}

.btn-plan--scheduled:hover {
  transform: none;
  box-shadow: none;
}

/* Ссылка назад */
.pricing-back {
  text-align: center;
  margin-top: 40px;
}

.pricing-back-link {
  color: rgba(148, 163, 184, 0.7);
  font-size: 14px;
  text-decoration: none;
  transition: color 0.2s ease;
}

.pricing-back-link:hover {
  color: #ffc107;
  text-decoration: none;
}

/* Адаптивность */
@media (max-width: 768px) {
  .pricing-page {
    padding: 24px 12px 40px;
  }

  .pricing-title {
    font-size: 1.5rem;
  }

  .pricing-grid {
    grid-template-columns: 1fr !important;
    gap: 16px;
  }

  .plan-card {
    padding: 20px 16px;
  }
}
</style>
