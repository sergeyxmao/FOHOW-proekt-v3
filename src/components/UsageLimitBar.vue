<template>
  <div
    :class="[
      'usage-limit-bar',
      { 'usage-limit-bar--modern': isModernTheme }
    ]"
  >
    <div class="limit-header">
      <span class="limit-label">{{ label }}</span>
      <span class="limit-counter">
        {{ current }} / {{ isUnlimited ? '∞' : limit }}
      </span>
    </div>

    <div v-if="!isUnlimited" class="progress-bar-container">
      <div
        class="progress-bar-fill"
        :style="{
          width: `${cappedPercentage}%`,
          backgroundColor: progressColor
        }"
      ></div>
    </div>

    <div v-else class="unlimited-indicator">
      <span>✓ Безлимитный доступ</span>
    </div>

    <div v-if="showWarning && !isUnlimited" class="usage-warning">
      <span class="warning-icon">⚠️</span>
      <span class="warning-text">
        Вы используете {{ percentage.toFixed(0) }}% от доступного лимита.
        <a href="#" class="upgrade-link" @click.prevent="$emit('upgrade')">
          Улучшите тариф
        </a>
        для увеличения возможностей.
      </span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  label: {
    type: String,
    required: true
  },
  current: {
    type: Number,
    required: true,
    default: 0
  },
  limit: {
    type: Number,
    required: true,
    default: -1
  },
  isModernTheme: {
    type: Boolean,
    default: false
  }
})

defineEmits(['upgrade'])

// Проверка на безлимит
const isUnlimited = computed(() => props.limit === -1)

// Рассчитываем процент использования
const percentage = computed(() => {
  if (isUnlimited.value || props.limit === 0) return 0
  return (props.current / props.limit) * 100
})

// Ограничиваем процент максимум до 100% для визуализации
const cappedPercentage = computed(() => {
  return Math.min(percentage.value, 100)
})

// Определяем цвет прогресс-бара в зависимости от процента
const progressColor = computed(() => {
  const p = percentage.value

  if (p < 70) {
    return '#4caf50' // Зеленый
  } else if (p < 90) {
    return '#ff9800' // Оранжевый
  } else {
    return '#f44336' // Красный
  }
})

// Показываем предупреждение при использовании >80%
const showWarning = computed(() => {
  return percentage.value > 80
})
</script>

<style scoped>
.usage-limit-bar {
  padding: 16px;
  border-radius: 12px;
  background: var(--limit-bg);
  border: 1px solid var(--limit-border);
  transition: background 0.3s ease, border-color 0.3s ease;

  --limit-bg: #ffffff;
  --limit-border: #e5e7eb;
  --limit-text: #111827;
  --limit-muted: #6b7280;
  --limit-warning-bg: #fff8e1;
  --limit-warning-text: #f57c00;
  --limit-warning-border: #ffb300;
  --limit-link: #2196f3;
  --limit-link-hover: #1976d2;
  --limit-unlimited-bg: #e8f5e9;
  --limit-unlimited-text: #2e7d32;
}

.usage-limit-bar--modern {
  --limit-bg: rgba(30, 41, 59, 0.6);
  --limit-border: rgba(148, 163, 184, 0.3);
  --limit-text: #e2e8f0;
  --limit-muted: rgba(148, 163, 184, 0.9);
  --limit-warning-bg: rgba(251, 191, 36, 0.15);
  --limit-warning-text: #fbbf24;
  --limit-warning-border: rgba(251, 191, 36, 0.4);
  --limit-link: #38bdf8;
  --limit-link-hover: #0ea5e9;
  --limit-unlimited-bg: rgba(34, 197, 94, 0.15);
  --limit-unlimited-text: #86efac;
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
  color: var(--limit-text);
}

.limit-counter {
  font-size: 14px;
  font-weight: 600;
  color: var(--limit-muted);
}

.progress-bar-container {
  position: relative;
  width: 100%;
  height: 8px;
  background: var(--limit-border);
  border-radius: 4px;
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s ease, background-color 0.3s ease;
}

.unlimited-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  background: var(--limit-unlimited-bg);
  border-radius: 8px;
  color: var(--limit-unlimited-text);
  font-weight: 600;
  font-size: 14px;
}

.usage-warning {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-top: 12px;
  padding: 12px;
  background: var(--limit-warning-bg);
  border: 1px solid var(--limit-warning-border);
  border-radius: 8px;
}

.warning-icon {
  font-size: 18px;
  flex-shrink: 0;
}

.warning-text {
  font-size: 13px;
  line-height: 1.5;
  color: var(--limit-warning-text);
}

.upgrade-link {
  color: var(--limit-link);
  text-decoration: none;
  font-weight: 600;
  transition: color 0.2s ease;
}

.upgrade-link:hover {
  color: var(--limit-link-hover);
  text-decoration: underline;
}

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
