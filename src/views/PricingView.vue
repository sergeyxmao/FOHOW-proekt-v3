<template>
  <div class="pricing-page">
    <!-- Шапка страницы -->
    <div class="pricing-header">
      <button @click="goBack" class="back-button">
        ← Назад
      </button>
      <h1 class="pricing-title">Выберите подходящий тариф</h1>
      <p class="pricing-subtitle">Начните с бесплатного тарифа или выберите план с расширенными возможностями</p>
    </div>

    <!-- Переключатель периода оплаты -->
    <div class="billing-toggle">
      <span :class="{ active: billingPeriod === 'monthly' }">Ежемесячно</span>
      <button @click="toggleBilling" class="toggle-switch">
        <span class="toggle-slider" :class="{ yearly: billingPeriod === 'yearly' }"></span>
      </button>
      <span :class="{ active: billingPeriod === 'yearly' }">
        Ежегодно
        <span class="discount-badge">-20%</span>
      </span>
    </div>

    <!-- Карточки тарифов -->
    <div class="pricing-grid">
      <!-- Бесплатный тариф -->
      <div class="plan-card" :class="{ current: currentPlan === 'free' }">
        <div v-if="currentPlan === 'free'" class="current-badge">Текущий тариф</div>
        <div class="plan-header">
          <h3 class="plan-name">Бесплатный</h3>
          <div class="plan-price">
            <span class="price-amount">0₽</span>
            <span class="price-period">навсегда</span>
          </div>
        </div>
        
        <ul class="plan-features">
          <li class="feature-item">
            <span class="feature-icon">✓</span>
            <span>До 2 досок</span>
          </li>
          <li class="feature-item">
            <span class="feature-icon">✓</span>
            <span>До 10 заметок на доску</span>
          </li>
          <li class="feature-item">
            <span class="feature-icon">✓</span>
            <span>До 5 стикеров на доску</span>
          </li>
          <li class="feature-item">
            <span class="feature-icon">✓</span>
            <span>До 20 карточек на доску</span>
          </li>
          <li class="feature-item disabled">
            <span class="feature-icon">✗</span>
            <span>Экспорт в PDF</span>
          </li>
          <li class="feature-item disabled">
            <span class="feature-icon">✗</span>
            <span>Командная работа</span>
          </li>
        </ul>
        
        <button 
          class="plan-button" 
          :disabled="currentPlan === 'free'"
        >
          {{ currentPlan === 'free' ? 'Активный тариф' : 'Начать бесплатно' }}
        </button>
      </div>

      <!-- Базовый тариф -->
      <div class="plan-card" :class="{ current: currentPlan === 'basic', popular: true }">
        <div v-if="currentPlan === 'basic'" class="current-badge">Текущий тариф</div>
        <div class="popular-badge">Популярный</div>
        <div class="plan-header">
          <h3 class="plan-name">Базовый</h3>
          <div class="plan-price">
            <span class="price-amount">{{ billingPeriod === 'monthly' ? '499' : '399' }}₽</span>
            <span class="price-period">/месяц</span>
          </div>
          <div v-if="billingPeriod === 'yearly'" class="price-note">
            При оплате за год: 4,788₽
          </div>
        </div>
        
        <ul class="plan-features">
          <li class="feature-item">
            <span class="feature-icon">✓</span>
            <span>До 5 досок</span>
          </li>
          <li class="feature-item">
            <span class="feature-icon">✓</span>
            <span>До 50 заметок на доску</span>
          </li>
          <li class="feature-item">
            <span class="feature-icon">✓</span>
            <span>До 25 стикеров на доску</span>
          </li>
          <li class="feature-item">
            <span class="feature-icon">✓</span>
            <span>До 100 карточек на доску</span>
          </li>
          <li class="feature-item">
            <span class="feature-icon">✓</span>
            <span>Экспорт в PDF</span>
          </li>
          <li class="feature-item disabled">
            <span class="feature-icon">✗</span>
            <span>Командная работа</span>
          </li>
        </ul>
        
        <button 
          class="plan-button plan-button--primary"
          @click="selectPlan('basic')"
          :disabled="currentPlan === 'basic'"
        >
          {{ currentPlan === 'basic' ? 'Активный тариф' : 'Выбрать тариф' }}
        </button>
      </div>

      <!-- Профессиональный тариф -->
      <div class="plan-card" :class="{ current: currentPlan === 'professional' }">
        <div v-if="currentPlan === 'professional'" class="current-badge">Текущий тариф</div>
        <div class="plan-header">
          <h3 class="plan-name">Профессиональный</h3>
          <div class="plan-price">
            <span class="price-amount">{{ billingPeriod === 'monthly' ? '999' : '799' }}₽</span>
            <span class="price-period">/месяц</span>
          </div>
          <div v-if="billingPeriod === 'yearly'" class="price-note">
            При оплате за год: 9,588₽
          </div>
        </div>
        
        <ul class="plan-features">
          <li class="feature-item">
            <span class="feature-icon">✓</span>
            <span>До 20 досок</span>
          </li>
          <li class="feature-item">
            <span class="feature-icon">✓</span>
            <span>Безлимит заметок</span>
          </li>
          <li class="feature-item">
            <span class="feature-icon">✓</span>
            <span>Безлимит стикеров</span>
          </li>
          <li class="feature-item">
            <span class="feature-icon">✓</span>
            <span>До 500 карточек на доску</span>
          </li>
          <li class="feature-item">
            <span class="feature-icon">✓</span>
            <span>Экспорт в PDF</span>
          </li>
          <li class="feature-item">
            <span class="feature-icon">✓</span>
            <span>Командная работа (до 5 человек)</span>
          </li>
        </ul>
        
        <button 
          class="plan-button plan-button--primary"
          @click="selectPlan('professional')"
          :disabled="currentPlan === 'professional'"
        >
          {{ currentPlan === 'professional' ? 'Активный тариф' : 'Выбрать тариф' }}
        </button>
      </div>

      <!-- Корпоративный тариф -->
      <div class="plan-card plan-card--enterprise">
        <div class="plan-header">
          <h3 class="plan-name">Корпоративный</h3>
          <div class="plan-price">
            <span class="price-amount">По запросу</span>
          </div>
        </div>
        
        <ul class="plan-features">
          <li class="feature-item">
            <span class="feature-icon">✓</span>
            <span>Безлимит досок</span>
          </li>
          <li class="feature-item">
            <span class="feature-icon">✓</span>
            <span>Безлимит всех элементов</span>
          </li>
          <li class="feature-item">
            <span class="feature-icon">✓</span>
            <span>Неограниченная команда</span>
          </li>
          <li class="feature-item">
            <span class="feature-icon">✓</span>
            <span>Персональный менеджер</span>
          </li>
          <li class="feature-item">
            <span class="feature-icon">✓</span>
            <span>API доступ</span>
          </li>
          <li class="feature-item">
            <span class="feature-icon">✓</span>
            <span>SLA и приоритетная поддержка</span>
          </li>
        </ul>
        
        <button class="plan-button plan-button--enterprise" @click="contactSales">
          Связаться с нами
        </button>
      </div>
    </div>

    <!-- Сравнительная таблица -->
    <div class="comparison-section">
      <h2 class="comparison-title">Детальное сравнение возможностей</h2>
      <table class="comparison-table">
        <thead>
          <tr>
            <th>Возможности</th>
            <th>Бесплатный</th>
            <th class="highlight">Базовый</th>
            <th>Профессиональный</th>
            <th>Корпоративный</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="feature-name">Количество досок</td>
            <td>2</td>
            <td class="highlight">5</td>
            <td>20</td>
            <td>Безлимит</td>
          </tr>
          <tr>
            <td class="feature-name">Заметки на доску</td>
            <td>10</td>
            <td class="highlight">50</td>
            <td>Безлимит</td>
            <td>Безлимит</td>
          </tr>
          <tr>
            <td class="feature-name">Стикеры на доску</td>
            <td>5</td>
            <td class="highlight">25</td>
            <td>Безлимит</td>
            <td>Безлимит</td>
          </tr>
          <tr>
            <td class="feature-name">Карточки на доску</td>
            <td>20</td>
            <td class="highlight">100</td>
            <td>500</td>
            <td>Безлимит</td>
          </tr>
          <tr>
            <td class="feature-name">Экспорт в PDF</td>
            <td>❌</td>
            <td class="highlight">✅</td>
            <td>✅</td>
            <td>✅</td>
          </tr>
          <tr>
            <td class="feature-name">Командная работа</td>
            <td>❌</td>
            <td class="highlight">❌</td>
            <td>До 5 человек</td>
            <td>Безлимит</td>
          </tr>
          <tr>
            <td class="feature-name">API доступ</td>
            <td>❌</td>
            <td class="highlight">❌</td>
            <td>❌</td>
            <td>✅</td>
          </tr>
          <tr>
            <td class="feature-name">Приоритетная поддержка</td>
            <td>❌</td>
            <td class="highlight">❌</td>
            <td>✅</td>
            <td>✅ + SLA</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- FAQ секция -->
    <div class="faq-section">
      <h2 class="faq-title">Часто задаваемые вопросы</h2>
      <div class="faq-list">
        <div class="faq-item" v-for="(faq, index) in faqs" :key="index">
          <button 
            class="faq-question" 
            @click="toggleFaq(index)"
            :class="{ active: activeFaq === index }"
          >
            {{ faq.question }}
            <span class="faq-icon">{{ activeFaq === index ? '−' : '+' }}</span>
          </button>
          <transition name="faq">
            <div v-if="activeFaq === index" class="faq-answer">
              {{ faq.answer }}
            </div>
          </transition>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const userStore = useUserStore()
const authStore = useAuthStore()

const billingPeriod = ref('monthly')
const activeFaq = ref(null)

// Определяем текущий план пользователя
const currentPlan = computed(() => {
  const planCodeName = userStore.plan?.code_name
  return planCodeName || 'free'
})

// FAQ данные
const faqs = [
  {
    question: 'Можно ли изменить тариф в любое время?',
    answer: 'Да, вы можете повысить или понизить тариф в любое время. При повышении тарифа изменения вступают в силу сразу, при понижении - с начала следующего расчетного периода.'
  },
  {
    question: 'Есть ли пробный период?',
    answer: 'Бесплатный тариф доступен всегда и не требует оплаты. Для платных тарифов мы предоставляем 14-дневную гарантию возврата средств.'
  },
  {
    question: 'Что происходит с моими данными при смене тарифа?',
    answer: 'Все ваши данные сохраняются при смене тарифа. При понижении тарифа вы не сможете создавать новые элементы сверх лимита, но существующие останутся доступными.'
  },
  {
    question: 'Как работает командная работа?',
    answer: 'В профессиональном тарифе вы можете пригласить до 5 членов команды для совместной работы над досками. В корпоративном тарифе количество участников не ограничено.'
  },
  {
    question: 'Какие способы оплаты доступны?',
    answer: 'Мы принимаем банковские карты (Visa, MasterCard, МИР), электронные кошельки и безналичный расчет для юридических лиц.'
  }
]

// Методы
function goBack() {
  router.go(-1)
}

function toggleBilling() {
  billingPeriod.value = billingPeriod.value === 'monthly' ? 'yearly' : 'monthly'
}

function toggleFaq(index) {
  activeFaq.value = activeFaq.value === index ? null : index
}

function selectPlan(planName) {
  if (!authStore.isAuthenticated) {
    alert('Пожалуйста, войдите в систему для выбора тарифа')
    return
  }
  
  // Здесь будет логика оплаты
  console.log('Выбран тариф:', planName)
  alert(`Оплата тарифа "${planName}" будет доступна в ближайшее время`)
}

function contactSales() {
  alert('Для корпоративного тарифа свяжитесь с нами по email: sales@marketingfohow.ru')
}

onMounted(() => {
  // Загружаем данные о текущем тарифе пользователя
  if (authStore.isAuthenticated) {
    userStore.fetchUserPlan().catch(console.error)
  }
})
</script>

<style scoped>
.pricing-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.pricing-header {
  text-align: center;
  margin-bottom: 40px;
  position: relative;
}

.back-button {
  position: absolute;
  left: 0;
  top: 0;
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: white;
  padding: 10px 20px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.back-button:hover {
  background: rgba(255, 255, 255, 0.3);
}

.pricing-title {
  font-size: 42px;
  color: white;
  margin: 0 0 12px 0;
  font-weight: 700;
}

.pricing-subtitle {
  font-size: 18px;
  color: rgba(255, 255, 255, 0.9);
  margin: 0;
}

/* Переключатель периода оплаты */
.billing-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-bottom: 40px;
  color: white;
  font-size: 16px;
  font-weight: 500;
}

.billing-toggle span.active {
  font-weight: 700;
}

.toggle-switch {
  position: relative;
  width: 60px;
  height: 32px;
  background: rgba(255, 255, 255, 0.3);
  border: none;
  border-radius: 16px;
  cursor: pointer;
  padding: 0;
}

.toggle-slider {
  position: absolute;
  left: 4px;
  top: 4px;
  width: 24px;
  height: 24px;
  background: white;
  border-radius: 50%;
  transition: transform 0.2s;
}

.toggle-slider.yearly {
  transform: translateX(28px);
}

.discount-badge {
  background: #22c55e;
  color: white;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 700;
  margin-left: 8px;
}

/* Сетка тарифов */
.pricing-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 24px;
  max-width: 1200px;
  margin: 0 auto 60px;
}

.plan-card {
  background: white;
  border-radius: 16px;
  padding: 32px;
  position: relative;
  transition: transform 0.2s, box-shadow 0.2s;
}

.plan-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
}

.plan-card.popular {
  border: 3px solid #3b82f6;
}

.plan-card.current {
  border: 3px solid #22c55e;
}

.plan-card--enterprise {
  background: linear-gradient(135deg, #1e293b, #334155);
  color: white;
}

.current-badge {
  position: absolute;
  top: -12px;
  left: 50%;
  transform: translateX(-50%);
  background: #22c55e;
  color: white;
  padding: 4px 16px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 700;
}

.popular-badge {
  position: absolute;
  top: -12px;
  right: 24px;
  background: #3b82f6;
  color: white;
  padding: 4px 16px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 700;
}

.plan-header {
  text-align: center;
  margin-bottom: 32px;
  padding-bottom: 24px;
  border-bottom: 1px solid #e5e7eb;
}

.plan-card--enterprise .plan-header {
  border-bottom-color: rgba(255, 255, 255, 0.2);
}

.plan-name {
  font-size: 24px;
  font-weight: 700;
  margin: 0 0 16px 0;
  color: #111827;
}

.plan-card--enterprise .plan-name {
  color: white;
}

.plan-price {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 4px;
}

.price-amount {
  font-size: 40px;
  font-weight: 700;
  color: #111827;
}

.plan-card--enterprise .price-amount {
  color: white;
  font-size: 24px;
}

.price-period {
  font-size: 16px;
  color: #6b7280;
}

.price-note {
  font-size: 12px;
  color: #6b7280;
  margin-top: 8px;
}

.plan-card--enterprise .price-note {
  color: rgba(255, 255, 255, 0.7);
}

/* Список возможностей */
.plan-features {
  list-style: none;
  padding: 0;
  margin: 0 0 32px 0;
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  color: #374151;
}

.plan-card--enterprise .feature-item {
  color: rgba(255, 255, 255, 0.9);
}

.feature-item.disabled {
  opacity: 0.5;
}

.feature-icon {
  font-size: 18px;
  color: #22c55e;
}

.feature-item.disabled .feature-icon {
  color: #ef4444;
}

/* Кнопки */
.plan-button {
  width: 100%;
  padding: 14px 24px;
  border: 2px solid #e5e7eb;
  background: white;
  color: #6b7280;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.plan-button:hover:not(:disabled) {
  border-color: #3b82f6;
  color: #3b82f6;
}

.plan-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.plan-button--primary {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: white;
  border: none;
}

.plan-button--primary:hover:not(:disabled) {
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  transform: translateY(-2px);
  box-shadow: 0 8px 16px rgba(59, 130, 246, 0.3);
}

.plan-button--enterprise {
  background: white;
  color: #1e293b;
  border: none;
}

.plan-button--enterprise:hover {
  background: #f1f5f9;
}

/* Таблица сравнения */
.comparison-section {
  max-width: 1200px;
  margin: 0 auto 60px;
  background: white;
  border-radius: 16px;
  padding: 40px;
  overflow-x: auto;
}

.comparison-title {
  font-size: 28px;
  font-weight: 700;
  margin: 0 0 32px 0;
  text-align: center;
  color: #111827;
}

.comparison-table {
  width: 100%;
  border-collapse: collapse;
}

.comparison-table th,
.comparison-table td {
  padding: 16px;
  text-align: center;
  border-bottom: 1px solid #e5e7eb;
}

.comparison-table th {
  background: #f9fafb;
  font-weight: 700;
  color: #111827;
}

.comparison-table th.highlight,
.comparison-table td.highlight {
  background: rgba(59, 130, 246, 0.1);
}

.comparison-table .feature-name {
  text-align: left;
  font-weight: 600;
  color: #374151;
}

/* FAQ секция */
.faq-section {
  max-width: 800px;
  margin: 0 auto;
  background: white;
  border-radius: 16px;
  padding: 40px;
}

.faq-title {
  font-size: 28px;
  font-weight: 700;
  margin: 0 0 32px 0;
  text-align: center;
  color: #111827;
}

.faq-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.faq-item {
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  overflow: hidden;
}

.faq-question {
  width: 100%;
  padding: 20px;
  background: white;
  border: none;
  text-align: left;
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: background 0.2s;
}

.faq-question:hover {
  background: #f9fafb;
}

.faq-question.active {
  background: #f3f4f6;
}

.faq-icon {
  font-size: 24px;
  color: #6b7280;
}

.faq-answer {
  padding: 0 20px 20px 20px;
  color: #6b7280;
  line-height: 1.6;
}

/* Анимация FAQ */
.faq-enter-active,
.faq-leave-active {
  transition: all 0.3s ease;
}

.faq-enter-from,
.faq-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

/* Адаптивность */
@media (max-width: 768px) {
  .pricing-title {
    font-size: 28px;
  }
  
  .pricing-subtitle {
    font-size: 16px;
  }
  
  .pricing-grid {
    grid-template-columns: 1fr;
  }
  
  .comparison-section {
    padding: 20px;
    overflow-x: scroll;
  }
  
  .comparison-table {
    min-width: 600px;
  }
  
  .faq-section {
    padding: 20px;
  }
}
</style>
