<template>
  <Teleport to="body">
    <div v-if="isOpen" class="modal-overlay" @click.self="close">
      <div class="modal-content">
        <button class="close-btn" @click="close">×</button>

        <div class="modal-body">
          <!-- Иконка и заголовок -->
          <div class="header-section">
            <div class="lock-icon">🔒</div>
            <h2 class="modal-title">Функция недоступна</h2>
          </div>

          <!-- Сообщение об ограничении -->
          <div class="limit-message">
            <p>{{ limitMessage }}</p>
          </div>

          <!-- Карточки тарифов -->
          <div class="plans-section">
            <h3 class="section-title">Улучшите свой тариф</h3>
            <div class="plans-grid">
              <div
                v-for="plan in recommendedPlans"
                :key="plan.id"
                class="plan-card"
              >
                <div class="plan-header">
                  <h4 class="plan-name">{{ plan.name }}</h4>
                  <div class="plan-price">
                    <span class="price-amount">{{ plan.price }}₽</span>
                    <span class="price-period">/месяц</span>
                  </div>
                </div>
                <ul class="plan-features">
                  <li v-for="feature in plan.features" :key="feature">
                    <span class="feature-icon">✓</span>
                    {{ feature }}
                  </li>
                </ul>
                <button class="select-btn" @click="selectPlan(plan.id)">
                  Выбрать
                </button>
              </div>
            </div>
          </div>

          <!-- Ссылка на сравнение всех тарифов -->
          <div class="footer-section">
            <a href="/pricing" class="compare-link" @click.prevent="goToPricing">
              Сравнить все тарифы →
            </a>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed } from 'vue'
import { useUserStore } from '@/stores/user'
import { useRouter } from 'vue-router'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  featureName: {
    type: String,
    required: true,
    validator: (value) => ['max_boards', 'max_notes', 'max_stickers', 'export_pdf'].includes(value)
  }
})

const emit = defineEmits(['close', 'select-plan'])

const userStore = useUserStore()
const router = useRouter()

// Определение сообщений о лимитах
const featureMessages = {
  max_boards: {
    title: 'Достигнут лимит досок',
    message: computed(() => {
      const limit = userStore.maxBoards
      return `На вашем тарифе "${userStore.planName}" можно создать только ${limit} ${limit === 2 ? 'доски' : 'досок'}. Улучшите тариф, чтобы создавать больше досок.`
    })
  },
  max_notes: {
    title: 'Достигнут лимит заметок',
    message: computed(() => {
      const limit = userStore.maxNotesPerBoard
      return `На вашем тарифе "${userStore.planName}" можно создать только ${limit} заметок на доске. Улучшите тариф для увеличения лимита.`
    })
  },
  max_stickers: {
    title: 'Достигнут лимит стикеров',
    message: computed(() => {
      const limit = userStore.maxStickersPerBoard
      return `На вашем тарифе "${userStore.planName}" можно создать только ${limit} стикеров на доске. Улучшите тариф для увеличения лимита.`
    })
  },
  export_pdf: {
    title: 'Экспорт в PDF недоступен',
    message: computed(() => {
      return `Функция экспорта в PDF недоступна на тарифе "${userStore.planName}". Улучшите тариф, чтобы получить доступ к этой функции.`
    })
  }
}

// Вычисляемое сообщение о лимите
const limitMessage = computed(() => {
  const feature = featureMessages[props.featureName]
  return feature ? feature.message.value : 'Эта функция недоступна на вашем тарифе.'
})

// Доступные тарифы для апгрейда (захардкожены)
const availablePlans = [
  {
    id: 'professional',
    name: 'Профессиональный',
    price: 999,
    features: [
      'До 10 досок',
      'Безлимит заметок и стикеров',
      'Экспорт в PDF',
      'Приоритетная поддержка'
    ]
  },
  {
    id: 'corporate',
    name: 'Корпоративный',
    price: 2999,
    features: [
      'Безлимитное количество досок',
      'Безлимит заметок и стикеров',
      'Экспорт в PDF',
      'Командная работа',
      'Персональный менеджер'
    ]
  }
]

// Рекомендуемые тарифы на основе текущего тарифа
const recommendedPlans = computed(() => {
  // Показываем все доступные тарифы
  return availablePlans
})

function close() {
  emit('close')
}

function selectPlan(planId) {
  emit('select-plan', planId)
  // В будущем здесь можно добавить переход на страницу оплаты
  console.log('Выбран тариф:', planId)
}

function goToPricing() {
  close()
  router.push('/pricing')
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.modal-content {
  position: relative;
  border-radius: 24px;
  max-width: 720px;
  width: min(720px, calc(100vw - 32px));
  max-height: min(92vh, 800px);
  overflow-y: auto;
  background: rgba(255, 255, 255, 0.98);
  border: 1px solid rgba(15, 23, 42, 0.14);
  box-shadow: 0 32px 64px rgba(15, 23, 42, 0.2);
  backdrop-filter: blur(22px);
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.close-btn {
  position: absolute;
  top: 18px;
  right: 22px;
  background: none;
  border: none;
  font-size: 30px;
  cursor: pointer;
  color: rgba(15, 23, 42, 0.5);
  z-index: 1;
  transition: all 0.2s ease;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
}

.close-btn:hover {
  color: #0f172a;
  background: rgba(15, 23, 42, 0.08);
}

.modal-body {
  padding: 48px 40px;
}

.header-section {
  text-align: center;
  margin-bottom: 24px;
}

.lock-icon {
  font-size: 56px;
  margin-bottom: 16px;
  animation: bounce 0.6s ease-out;
}

@keyframes bounce {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

.modal-title {
  font-size: 28px;
  font-weight: 700;
  color: #0f172a;
  margin: 0;
  letter-spacing: -0.02em;
}

.limit-message {
  text-align: center;
  margin-bottom: 40px;
  padding: 20px;
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 12px;
}

.limit-message p {
  margin: 0;
  font-size: 16px;
  line-height: 1.6;
  color: #dc2626;
}

.plans-section {
  margin-bottom: 32px;
}

.section-title {
  font-size: 18px;
  font-weight: 700;
  color: #0f172a;
  margin: 0 0 20px 0;
  text-align: center;
}

.plans-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
}

.plan-card {
  background: rgba(248, 250, 252, 0.8);
  border: 2px solid rgba(15, 23, 42, 0.12);
  border-radius: 16px;
  padding: 24px;
  transition: all 0.3s ease;
  display: flex;
  flex-direction: column;
}

.plan-card:hover {
  border-color: #3b82f6;
  box-shadow: 0 12px 24px rgba(59, 130, 246, 0.15);
  transform: translateY(-4px);
}

.plan-header {
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(15, 23, 42, 0.1);
}

.plan-name {
  font-size: 20px;
  font-weight: 700;
  color: #0f172a;
  margin: 0 0 8px 0;
}

.plan-price {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.price-amount {
  font-size: 32px;
  font-weight: 700;
  color: #3b82f6;
}

.price-period {
  font-size: 14px;
  color: #64748b;
}

.plan-features {
  list-style: none;
  padding: 0;
  margin: 0 0 24px 0;
  flex: 1;
}

.plan-features li {
  padding: 8px 0;
  font-size: 14px;
  color: #475569;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  line-height: 1.5;
}

.feature-icon {
  color: #22c55e;
  font-weight: 700;
  font-size: 16px;
  flex-shrink: 0;
}

.select-btn {
  width: 100%;
  padding: 12px 24px;
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: #ffffff;
  border: none;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.select-btn:hover {
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  box-shadow: 0 6px 16px rgba(59, 130, 246, 0.4);
  transform: translateY(-2px);
}

.select-btn:active {
  transform: translateY(0);
}

.footer-section {
  text-align: center;
  padding-top: 24px;
  border-top: 1px solid rgba(15, 23, 42, 0.1);
}

.compare-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 15px;
  font-weight: 600;
  color: #3b82f6;
  text-decoration: none;
  transition: all 0.2s ease;
}

.compare-link:hover {
  color: #2563eb;
  gap: 10px;
}

/* Адаптивность */
@media (max-width: 768px) {
  .modal-body {
    padding: 32px 24px;
  }

  .modal-title {
    font-size: 24px;
  }

  .lock-icon {
    font-size: 48px;
  }

  .plans-grid {
    grid-template-columns: 1fr;
  }

  .plan-card {
    padding: 20px;
  }
}

/* Скроллбар */
.modal-content::-webkit-scrollbar {
  width: 8px;
}

.modal-content::-webkit-scrollbar-track {
  background: rgba(15, 23, 42, 0.05);
  border-radius: 4px;
}

.modal-content::-webkit-scrollbar-thumb {
  background: rgba(59, 130, 246, 0.3);
  border-radius: 4px;
}

.modal-content::-webkit-scrollbar-thumb:hover {
  background: rgba(59, 130, 246, 0.5);
}
</style>
