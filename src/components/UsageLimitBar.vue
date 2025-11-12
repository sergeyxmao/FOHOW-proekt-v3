<template>
  <div class="usage-limit-bar">
    <!-- Заголовок с информацией об использовании -->
    <div v-if="showDetails" class="limit-header">
      <span class="limit-label">{{ displayLabel }}</span>
      <span class="limit-counter">
        <template v-if="isUnlimited">
          Безлимит
        </template>
        <template v-else>
          {{ limitInfo.current }} / {{ limitInfo.max }} ({{ percentage }}%)
        </template>
      </span>
    </div>

    <!-- Прогресс-бар -->
    <div v-if="!isUnlimited" class="progress-bar-container">
      <div
        class="progress-bar-fill"
        :style="{
          width: `${cappedPercentage}%`,
          backgroundColor: progressColor
        }"
      ></div>
    </div>

    <!-- Индикатор безлимита -->
    <div v-else class="unlimited-indicator">
      <span>✓ Безлимит</span>
    </div>

    <!-- Предупреждение при достижении лимита -->
    <div v-if="isLimitReached && !isUnlimited" class="limit-reached-warning">
      <span class="warning-icon">⚠️</span>
      <span class="warning-text">
        Лимит достигнут. Обновите тариф
      </span>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useSubscriptionStore } from '@/stores/subscription'

const props = defineProps({
  /**
   * Тип ресурса ('boards', 'notes', 'stickers', 'comments', 'cards')
   */
  resourceType: {
    type: String,
    required: true,
    validator: (value) => ['boards', 'notes', 'stickers', 'comments', 'cards'].includes(value)
  },

  /**
   * Название ресурса (опционально, если не указано - используется дефолтное)
   */
  label: {
    type: String,
    default: null
  },

  /**
   * Показывать детали (заголовок с информацией)
   */
  showDetails: {
    type: Boolean,
    default: true
  }
})

const subscriptionStore = useSubscriptionStore()

// Загружаем план при монтировании, если данных нет
onMounted(async () => {
  if (!subscriptionStore.currentPlan) {
    try {
      await subscriptionStore.loadPlan()
    } catch (error) {
      console.error('Ошибка при загрузке плана подписки:', error)
    }
  }
})

// Дефолтные названия ресурсов
const defaultLabels = {
  boards: 'Доски',
  notes: 'Заметки',
  stickers: 'Стикеры',
  comments: 'Комментарии',
  cards: 'Карточки'
}

// Получаем название для отображения
const displayLabel = computed(() => {
  return props.label || defaultLabels[props.resourceType] || props.resourceType
})

// Получаем информацию о лимите из store
const limitInfo = computed(() => {
  return subscriptionStore.checkLimit(props.resourceType)
})

// Проверка на безлимит
const isUnlimited = computed(() => {
  return limitInfo.value.max === -1
})

// Процент использования
const percentage = computed(() => {
  if (isUnlimited.value) return 0
  return Math.round(limitInfo.value.percentage)
})

// Ограничиваем процент максимум до 100% для визуализации
const cappedPercentage = computed(() => {
  return Math.min(percentage.value, 100)
})

// Определяем цвет прогресс-бара в зависимости от процента
const progressColor = computed(() => {
  const p = percentage.value

  if (p < 70) {
    return '#4caf50' // 🟢 Зелёный
  } else if (p < 90) {
    return '#ffc107' // 🟡 Жёлтый
  } else {
    return '#f44336' // 🔴 Красный
  }
})

// Проверка достижения лимита (100%)
const isLimitReached = computed(() => {
  return !isUnlimited.value && percentage.value >= 100
})
</script>

<style scoped>
.usage-limit-bar {
  padding: 16px;
  border-radius: 12px;
  background: var(--limit-bg, #ffffff);
  border: 1px solid var(--limit-border, #e5e7eb);
  transition: background 0.3s ease, border-color 0.3s ease;
}

.limit-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.limit-label {
  font-weight: 600;
  font-size: 14px;
  color: var(--limit-text, #111827);
}

.limit-counter {
  font-size: 14px;
  font-weight: 600;
  color: var(--limit-muted, #6b7280);
}

.progress-bar-container {
  position: relative;
  width: 100%;
  height: 10px;
  background: var(--limit-border, #e5e7eb);
  border-radius: 5px;
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  border-radius: 5px;
  transition: width 0.5s ease, background-color 0.3s ease;
}

.unlimited-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  background: var(--limit-unlimited-bg, #e8f5e9);
  border-radius: 8px;
  color: var(--limit-unlimited-text, #2e7d32);
  font-weight: 600;
  font-size: 14px;
}

.limit-reached-warning {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
  padding: 12px;
  background: var(--limit-warning-bg, #ffebee);
  border: 1px solid var(--limit-warning-border, #ef5350);
  border-radius: 8px;
}

.warning-icon {
  font-size: 18px;
  flex-shrink: 0;
}

.warning-text {
  font-size: 13px;
  line-height: 1.5;
  color: var(--limit-warning-text, #c62828);
  font-weight: 600;
}

/* Темная тема (опционально) */
@media (prefers-color-scheme: dark) {
  .usage-limit-bar {
    --limit-bg: rgba(30, 41, 59, 0.6);
    --limit-border: rgba(148, 163, 184, 0.3);
    --limit-text: #e2e8f0;
    --limit-muted: rgba(148, 163, 184, 0.9);
    --limit-warning-bg: rgba(239, 83, 80, 0.15);
    --limit-warning-text: #ef5350;
    --limit-warning-border: rgba(239, 83, 80, 0.4);
    --limit-unlimited-bg: rgba(34, 197, 94, 0.15);
    --limit-unlimited-text: #86efac;
  }
}

/* Responsive */
@media (max-width: 480px) {
  .usage-limit-bar {
    padding: 12px;
  }

  .limit-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }

  .warning-text {
    font-size: 12px;
  }
}
</style>
