<template>
  <div class="feature-gate">
    <!-- Если функция доступна - показываем контент -->
    <template v-if="isAvailable">
      <slot></slot>
    </template>

    <!-- Если функция НЕдоступна -->
    <template v-else>
      <!-- Вариант A: Скрыть полностью (ничего не рендерим) -->
      <template v-if="displayMode === 'hide'">
        <!-- Ничего не показываем -->
      </template>

      <!-- Вариант B: Показать с замком и кнопкой "Обновить" -->
      <div v-else-if="displayMode === 'lock'" class="feature-gate-locked">
        <div class="locked-content" :class="{ shake: shakeElement }" @click="handleLockedClick">
          <!-- Слот в полупрозрачном виде -->
          <div class="locked-overlay">
            <slot></slot>
          </div>

          <!-- Замок и кнопка апгрейда -->
          <div class="upgrade-overlay">
            <div class="lock-icon">🔒</div>
            <p class="upgrade-message">{{ upgradeMessageText }}</p>
            <button
              v-if="showUpgrade"
              class="upgrade-button"
              @click.stop="handleUpgrade"
            >
              Обновить тариф
            </button>
          </div>
        </div>
      </div>

      <!-- Вариант C: Показать неактивным (disabled) -->
      <div v-else-if="displayMode === 'disabled'" class="feature-gate-disabled">
        <!-- Делаем контент неактивным через CSS -->
        <div class="disabled-content" :class="{ shake: shakeElement }" :title="upgradeMessageText" @click="handleLockedClick">
          <slot></slot>
        </div>

        <!-- Опционально показываем кнопку апгрейда -->
        <button
          v-if="showUpgrade"
          class="upgrade-button-inline"
          @click.stop="handleUpgrade"
        >
          🔒 Обновить тариф
        </button>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useSubscriptionStore } from '@/stores/subscription'
import { useRouter } from 'vue-router'

const shakeElement = ref(false)

const props = defineProps({
  /**
   * Название функции для проверки доступности (например, 'can_export_pdf')
   */
  feature: {
    type: String,
    required: true
  },

  /**
   * Показывать ли кнопку апгрейда
   */
  showUpgrade: {
    type: Boolean,
    default: true
  },

  /**
   * Кастомное сообщение для апгрейда
   */
  upgradeMessage: {
    type: String,
    default: null
  },

  /**
   * Режим отображения когда функция недоступна:
   * - 'hide' - скрыть полностью
   * - 'lock' - показать с замком и кнопкой "Обновить"
   * - 'disabled' - показать неактивным (disabled)
   */
  displayMode: {
    type: String,
    default: 'lock',
    validator: (value) => ['hide', 'lock', 'disabled'].includes(value)
  }
})

const emit = defineEmits(['upgrade'])

const subscriptionStore = useSubscriptionStore()
const router = useRouter()

/**
 * Проверка доступности функции
 */
const isAvailable = computed(() => {
  return subscriptionStore.checkFeature(props.feature)
})

/**
 * Текст сообщения для апгрейда
 */
const upgradeMessageText = computed(() => {
  // Если передано кастомное сообщение, используем его
  if (props.upgradeMessage) {
    return props.upgradeMessage
  }

  // Иначе получаем из store
  return subscriptionStore.getUpgradeMessage(props.feature)
})

/**
 * Обработчик клика по кнопке апгрейда
 */
const handleUpgrade = () => {
  // Эмитим событие для родительского компонента
  emit('upgrade', props.feature)

  // Перенаправляем на страницу тарифов
  router.push({ name: 'pricing' })
}

/**
 * Обработчик клика по заблокированному элементу
 */
const handleLockedClick = () => {
  if (!isAvailable.value) {
    // Добавить класс shake
    shakeElement.value = true
    setTimeout(() => {
      shakeElement.value = false
    }, 300)
  }
  emit('upgrade', props.feature)
}
</script>

<style scoped>
.feature-gate {
  position: relative;
}

/* ----- Вариант B: Locked (с замком) ----- */
.feature-gate-locked {
  position: relative;
  display: inline-block;
}

.locked-content {
  position: relative;
}

.locked-overlay {
  opacity: 0.4;
  pointer-events: none;
  filter: grayscale(100%);
}

.upgrade-overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  background: rgba(255, 255, 255, 0.95);
  padding: 24px;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  min-width: 280px;
  max-width: 400px;
  z-index: 10;
}

.lock-icon {
  font-size: 48px;
  margin-bottom: 12px;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
}

.upgrade-message {
  margin: 12px 0;
  font-size: 14px;
  line-height: 1.5;
  color: #374151;
}

.upgrade-button {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.upgrade-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 16px rgba(102, 126, 234, 0.4);
}

.upgrade-button:active {
  transform: translateY(0);
}

/* ----- Вариант C: Disabled (неактивный) ----- */
.feature-gate-disabled {
  display: inline-flex;
  align-items: center;
  gap: 12px;
}

.disabled-content {
  opacity: 0.5;
  pointer-events: none;
  cursor: not-allowed;
  filter: grayscale(50%);
}

/* Делаем все интерактивные элементы неактивными */
.disabled-content :deep(button),
.disabled-content :deep(a),
.disabled-content :deep(input),
.disabled-content :deep(select),
.disabled-content :deep(textarea) {
  pointer-events: none;
  opacity: 0.6;
}

.upgrade-button-inline {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.upgrade-button-inline:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

/* ----- Темная тема (опционально) ----- */
@media (prefers-color-scheme: dark) {
  .upgrade-overlay {
    background: rgba(30, 41, 59, 0.95);
    border: 1px solid rgba(148, 163, 184, 0.3);
  }

  .upgrade-message {
    color: #e2e8f0;
  }
}

/* ----- Responsive ----- */
@media (max-width: 640px) {
  .upgrade-overlay {
    min-width: 240px;
    padding: 20px;
  }

  .lock-icon {
    font-size: 36px;
  }

  .upgrade-message {
    font-size: 13px;
  }

  .upgrade-button {
    padding: 10px 20px;
    font-size: 13px;
  }
}
</style>
