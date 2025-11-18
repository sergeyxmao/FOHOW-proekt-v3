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

// Компактное отображение значений
const filesDisplay = computed(() => {
  const value = props.usage.files
  if (props.limits.files === -1) return value.toString()
  return `${value}/${props.limits.files}`
})

const foldersDisplay = computed(() => {
  const value = props.usage.folders
  if (props.limits.folders === -1) return value.toString()
  return `${value}/${props.limits.folders}`
})

const storageDisplay = computed(() => {
  const value = props.usage.storageMB.toFixed(2)
  if (props.limits.storageMB === -1) return `${value} МБ`
  return `${value}/${props.limits.storageMB} МБ`
})

// Tooltip текст с полной информацией
const filesTitle = computed(() => {
  const limit = props.limits.files === -1 ? '∞' : props.limits.files
  return `Файлов: ${props.usage.files} из ${limit}`
})

const foldersTitle = computed(() => {
  const limit = props.limits.folders === -1 ? '∞' : props.limits.folders
  return `Папок: ${props.usage.folders} из ${limit}`
})

const storageTitle = computed(() => {
  const limit = props.limits.storageMB === -1 ? '∞' : `${props.limits.storageMB} МБ`
  return `Объём: ${props.usage.storageMB.toFixed(2)} МБ из ${limit}`
})
</script>

<template>
  <div class="usage-stats-compact">
    <span class="stat-item" :title="filesTitle">
      🖼️ {{ filesDisplay }}
    </span>
    <span class="stat-item" :title="foldersTitle">
      📁 {{ foldersDisplay }}
    </span>
    <span class="stat-item" :title="storageTitle">
      💾 {{ storageDisplay }}
    </span>
  </div>
</template>

<style scoped>
.usage-stats-compact {
  display: flex;
  gap: 1rem;
  font-size: 0.9rem;
  color: #666;
  padding: 8px 0;
}

.stat-item {
  cursor: help;
  white-space: nowrap;
}
</style>
