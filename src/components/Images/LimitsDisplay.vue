<script setup>
import { computed } from 'vue'

const props = defineProps({
  usage: {
    type: Object,
    required: true
  },
  limits: {
    type: Object,
    required: true
  },
  planName: {
    type: String,
    default: ''
  }
})

// Вычисление процента использования
const filesPercent = computed(() => {
  if (props.limits.files === -1) return 0
  return Math.min((props.usage.files / props.limits.files) * 100, 100)
})

const foldersPercent = computed(() => {
  if (props.limits.folders === -1) return 0
  return Math.min((props.usage.folders / props.limits.folders) * 100, 100)
})

const storagePercent = computed(() => {
  if (props.limits.storageMB === -1) return 0
  return Math.min((props.usage.storageMB / props.limits.storageMB) * 100, 100)
})

// Форматирование текста лимитов
const filesText = computed(() => {
  if (props.limits.files === -1) return `${props.usage.files} / ∞`
  return `${props.usage.files} / ${props.limits.files}`
})

const foldersText = computed(() => {
  if (props.limits.folders === -1) return `${props.usage.folders} / ∞`
  return `${props.usage.folders} / ${props.limits.folders}`
})

const storageText = computed(() => {
  if (props.limits.storageMB === -1) {
    return `${props.usage.storageMB.toFixed(2)} МБ / ∞`
  }
  return `${props.usage.storageMB.toFixed(2)} / ${props.limits.storageMB} МБ`
})
</script>

<template>
  <div class="limits-display">
    <div class="limits-display__title">Использование ({{ planName }})</div>

    <div class="limits-display__item">
      <div class="limits-display__label">
        <span>Файлов:</span>
        <span class="limits-display__value">{{ filesText }}</span>
      </div>
      <div v-if="limits.files !== -1" class="limits-display__progress">
        <div class="limits-display__progress-bar" :style="{ width: filesPercent + '%' }"></div>
      </div>
    </div>

    <div class="limits-display__item">
      <div class="limits-display__label">
        <span>Папок:</span>
        <span class="limits-display__value">{{ foldersText }}</span>
      </div>
      <div v-if="limits.folders !== -1" class="limits-display__progress">
        <div class="limits-display__progress-bar" :style="{ width: foldersPercent + '%' }"></div>
      </div>
    </div>

    <div class="limits-display__item">
      <div class="limits-display__label">
        <span>Объём:</span>
        <span class="limits-display__value">{{ storageText }}</span>
      </div>
      <div v-if="limits.storageMB !== -1" class="limits-display__progress">
        <div class="limits-display__progress-bar" :style="{ width: storagePercent + '%' }"></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.limits-display {
  padding: 16px;
  background: rgba(248, 250, 252, 0.8);
  border-radius: 8px;
  margin-bottom: 16px;
  border: 1px solid rgba(15, 23, 42, 0.08);
}

.limits-display__title {
  font-size: 13px;
  font-weight: 600;
  color: #475569;
  margin-bottom: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.limits-display__item {
  margin-bottom: 12px;
}

.limits-display__item:last-child {
  margin-bottom: 0;
}

.limits-display__label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
  color: #64748b;
  margin-bottom: 6px;
}

.limits-display__value {
  font-weight: 600;
  color: #0f172a;
}

.limits-display__progress {
  height: 6px;
  background: rgba(15, 23, 42, 0.08);
  border-radius: 3px;
  overflow: hidden;
}

.limits-display__progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6 0%, #2563eb 100%);
  border-radius: 3px;
  transition: width 0.3s ease;
}

/* Предупреждение при превышении 80% */
.limits-display__progress-bar[style*="width: 8"],
.limits-display__progress-bar[style*="width: 9"],
.limits-display__progress-bar[style*="width: 100"] {
  background: linear-gradient(90deg, #f59e0b 0%, #d97706 100%);
}
</style>
