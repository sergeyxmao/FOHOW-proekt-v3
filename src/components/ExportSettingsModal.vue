<script setup>
import { computed, ref } from 'vue'
import { useAuthStore } from '../stores/auth.js'
import { useSubscriptionStore } from '../stores/subscription.js'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const emit = defineEmits(['close', 'export'])
const authStore = useAuthStore()
const subscriptionStore = useSubscriptionStore()
const isAdmin = computed(() => authStore.user?.role === 'admin')

const isGuestPlan = computed(() => {
  return subscriptionStore.currentPlan?.code_name === 'guest'
})

const allFormats = [
  { id: 'a4', label: 'A4', width: 210, height: 297 },
  { id: 'a3', label: 'A3', width: 297, height: 420 }
]

const pageFormats = computed(() => {
  if (isAdmin.value) return allFormats
  const allowed = subscriptionStore.features?.can_export_png_formats
  if (!allowed || !Array.isArray(allowed) || allowed.length === 0) return allFormats
  return allFormats.filter(f => allowed.includes(f.label))
})

const mode = ref('print')
const defaultFormat = pageFormats.value.some(f => f.id === 'a3') ? 'a3' : (pageFormats.value[0]?.id || 'a4')
const selectedFormat = ref(defaultFormat)
const selectedOrientation = ref('landscape')
const hideContent = ref(false)
const blackAndWhite = ref(false)

const handleExport = () => {
  if (mode.value === 'messenger') {
    emit('export', {
      format: 'original',
      exportOnlyVisible: true,
      hideContent: hideContent.value,
      blackAndWhite: blackAndWhite.value
    })
  } else {
    const format = pageFormats.value.find(f => f.id === selectedFormat.value)
    emit('export', {
      format: selectedFormat.value,
      width: format.width,
      height: format.height,
      orientation: selectedOrientation.value,
      dpi: 300,
      exportOnlyVisible: isAdmin.value ? false : true,
      hideContent: hideContent.value,
      blackAndWhite: blackAndWhite.value
    })
  }
}

const handleClose = () => {
  emit('close')
}
</script>

<template>
  <div class="export-settings-panel">
    <div class="export-settings-panel__header">
      <h3 class="export-settings-panel__title">{{ t('saveAsImage.title') }}</h3>
      <button type="button" class="export-settings-panel__close" @click="handleClose" aria-label="Close">×</button>
    </div>

    <div class="export-settings-panel__body">
      <!-- Переключатель режимов -->
      <div class="mode-tabs">
        <button type="button" class="mode-tab" :class="{ active: mode === 'print' }" @click="mode = 'print'">
          🖨️ {{ t('saveAsImage.forPrint') }}
        </button>
        <button type="button" class="mode-tab" :class="{ active: mode === 'messenger' }" @click="mode = 'messenger'">
          💬 {{ t('saveAsImage.forMessenger') }}
        </button>
      </div>

      <!-- Настройки печати -->
      <template v-if="mode === 'print'">
        <div class="form-group">
          <label class="form-label">{{ t('saveAsImage.format') }}:</label>
          <div class="format-buttons">
            <button
              v-for="format in pageFormats"
              :key="format.id"
              type="button"
              class="format-btn"
              :class="{ active: selectedFormat === format.id }"
              @click="selectedFormat = format.id"
            >{{ format.label }}</button>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">{{ t('saveAsImage.orientation') }}:</label>
          <div class="orientation-buttons">
            <button type="button" class="orientation-btn" :class="{ active: selectedOrientation === 'portrait' }" @click="selectedOrientation = 'portrait'">
              <span class="orientation-icon">📄</span>
              <span>{{ t('saveAsImage.portrait') }}</span>
            </button>
            <button type="button" class="orientation-btn" :class="{ active: selectedOrientation === 'landscape' }" @click="selectedOrientation = 'landscape'">
              <span class="orientation-icon">📃</span>
              <span>{{ t('saveAsImage.landscape') }}</span>
            </button>
          </div>
        </div>
      </template>

      <!-- Описание мессенджера -->
      <template v-else>
        <p class="messenger-hint">{{ t('saveAsImage.messengerHint') }}</p>
      </template>

      <!-- Общие чекбоксы -->
      <div class="form-group">
        <div class="checkbox-group">
          <label class="checkbox-label" :class="{ 'checkbox-label--disabled': isGuestPlan && !isAdmin }">
            <input type="checkbox" v-model="hideContent" class="checkbox-input" :disabled="isGuestPlan && !isAdmin" />
            <span class="checkbox-text">{{ t('saveAsImage.hideContent') }}{{ (isGuestPlan && !isAdmin) ? ` (${t('saveAsImage.unavailable')})` : '' }}</span>
          </label>
          <label class="checkbox-label" :class="{ 'checkbox-label--disabled': isGuestPlan && !isAdmin }">
            <input type="checkbox" v-model="blackAndWhite" class="checkbox-input" :disabled="isGuestPlan && !isAdmin" />
            <span class="checkbox-text">{{ t('saveAsImage.blackAndWhite') }}{{ (isGuestPlan && !isAdmin) ? ` (${t('saveAsImage.unavailable')})` : '' }}</span>
          </label>
        </div>
      </div>
    </div>

    <div class="export-settings-panel__footer">
      <button type="button" class="export-btn export-btn--secondary" @click="handleClose">
        {{ t('saveAsImage.cancel') }}
      </button>
      <button type="button" class="export-btn export-btn--primary" @click="handleExport">
        {{ t('saveAsImage.export') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.export-settings-panel {
  min-width: 360px;
  max-width: 420px;
  background: rgba(255, 255, 255, 0.98);
  border-radius: 16px;
  box-shadow: 0 18px 48px rgba(15, 23, 42, 0.2);
  border: 1px solid rgba(15, 23, 42, 0.08);
  backdrop-filter: blur(8px);
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 120px);
  overflow: hidden;
  animation: slideIn 0.25s ease-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(-10px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.export-settings-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px;
  border-bottom: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(248, 250, 252, 0.6);
}

.export-settings-panel__title {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: -0.01em;
}

.export-settings-panel__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 10px;
  background: rgba(15, 23, 42, 0.06);
  color: #0f172a;
  font-size: 24px;
  cursor: pointer;
  transition: all 0.2s ease;
  line-height: 1;
  flex-shrink: 0;
}

.export-settings-panel__close:hover {
  background: rgba(239, 68, 68, 0.12);
  color: #dc2626;
  transform: scale(1.05);
}

.export-settings-panel__close:active {
  transform: scale(0.95);
}

.export-settings-panel__body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 193, 7, 0.4) rgba(15, 23, 42, 0.05);
}

.export-settings-panel__body::-webkit-scrollbar {
  width: 6px;
}

.export-settings-panel__body::-webkit-scrollbar-track {
  background: rgba(15, 23, 42, 0.05);
  border-radius: 3px;
}

.export-settings-panel__body::-webkit-scrollbar-thumb {
  background: rgba(255, 193, 7, 0.4);
  border-radius: 3px;
}

.export-settings-panel__body::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 193, 7, 0.6);
}

.form-group {
  margin-bottom: 24px;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
  letter-spacing: 0.01em;
}

/* Переключатель режимов */
.mode-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.mode-tab {
  flex: 1;
  padding: 12px 16px;
  border: 2px solid rgba(15, 23, 42, 0.1);
  border-radius: 12px;
  background: rgba(248, 250, 252, 0.8);
  font-size: 15px;
  font-weight: 700;
  color: #0f172a;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: center;
}

.mode-tab:hover {
  border-color: rgba(255, 193, 7, 0.5);
  background: rgba(255, 193, 7, 0.06);
}

.mode-tab.active {
  border-color: #ffc107;
  background: rgba(255, 193, 7, 0.12);
  box-shadow: 0 0 0 2px rgba(255, 193, 7, 0.25);
}

/* Подсказка мессенджера */
.messenger-hint {
  padding: 16px;
  color: #475569;
  font-size: 14px;
  line-height: 1.5;
  text-align: center;
  background: rgba(248, 250, 252, 0.6);
  border-radius: 10px;
  border: 1px dashed rgba(15, 23, 42, 0.12);
  margin: 0;
}

/* Кнопки ориентации */
.orientation-buttons {
  display: flex;
  gap: 12px;
}

.orientation-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 12px 8px;
  border: 1.5px solid rgba(15, 23, 42, 0.12);
  border-radius: 12px;
  background: rgba(248, 250, 252, 0.8);
  color: #0f172a;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.orientation-btn:hover {
  border-color: rgba(255, 193, 7, 0.6);
  background: rgba(255, 193, 7, 0.1);
  transform: translateY(-1px);
  box-shadow: 0 6px 12px rgba(255, 193, 7, 0.2);
}

.orientation-btn.active {
  border-color: #ffc107;
  background: rgba(255, 193, 7, 0.15);
  color: #000000;
  box-shadow: 0 0 0 2px rgba(255, 193, 7, 0.3);
}

.orientation-btn:active {
  transform: translateY(0);
}

.orientation-icon {
  font-size: 28px;
  line-height: 1;
}

/* Кнопки формата листа */
.format-buttons {
  display: flex;
  gap: 8px;
}

.format-btn {
  flex: 1;
  padding: 10px 8px;
  border: 1.5px solid rgba(15, 23, 42, 0.12);
  border-radius: 10px;
  background: rgba(248, 250, 252, 0.8);
  color: #0f172a;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: center;
}

.format-btn:hover {
  border-color: rgba(255, 193, 7, 0.6);
  background: rgba(255, 193, 7, 0.1);
  transform: translateY(-1px);
  box-shadow: 0 4px 10px rgba(255, 193, 7, 0.15);
}

.format-btn.active {
  border-color: #ffc107;
  background: rgba(255, 193, 7, 0.15);
  color: #000000;
  box-shadow: 0 0 0 2px rgba(255, 193, 7, 0.3);
}

.format-btn:active {
  transform: translateY(0);
}

/* Футер */
.export-settings-panel__footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 20px;
  border-top: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(248, 250, 252, 0.6);
}

.export-btn {
  padding: 10px 20px;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  letter-spacing: 0.01em;
}

.export-btn--secondary {
  background: rgba(15, 23, 42, 0.08);
  color: #0f172a;
  border: 1px solid rgba(15, 23, 42, 0.12);
}

.export-btn--secondary:hover {
  background: rgba(15, 23, 42, 0.14);
  transform: translateY(-1px);
  box-shadow: 0 4px 10px rgba(15, 23, 42, 0.1);
}

.export-btn--secondary:active {
  transform: translateY(0);
}

.export-btn--primary {
  background: #ffc107;
  color: #000000;
  box-shadow: 0 4px 12px rgba(255, 193, 7, 0.35);
}

.export-btn--primary:hover {
  background: #e8a900;
  transform: translateY(-1px);
  box-shadow: 0 6px 14px rgba(255, 193, 7, 0.45);
}

.export-btn--primary:active {
  transform: translateY(0);
  box-shadow: 0 2px 8px rgba(255, 193, 7, 0.3);
}

/* Чекбоксы */
.checkbox-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 10px;
  background: rgba(248, 250, 252, 0.8);
  border: 1.5px solid rgba(15, 23, 42, 0.08);
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
}

.checkbox-label--disabled {
  opacity: 0.5;
  cursor: not-allowed !important;
  background: rgba(248, 250, 252, 0.5) !important;
}

.checkbox-label--disabled .checkbox-input {
  cursor: not-allowed;
}

.checkbox-label--disabled .checkbox-text {
  color: #94a3b8;
}

.checkbox-label:hover {
  background: rgba(255, 255, 255, 1);
  border-color: rgba(255, 193, 7, 0.6);
  transform: translateY(-1px);
  box-shadow: 0 4px 10px rgba(255, 193, 7, 0.15);
}

.checkbox-label--disabled:hover {
  transform: none !important;
  box-shadow: none !important;
  border-color: rgba(15, 23, 42, 0.08) !important;
}

.checkbox-label:has(.checkbox-input:checked) {
  background: rgba(255, 193, 7, 0.12);
  border-color: #ffc107;
}

.checkbox-input {
  width: 18px;
  height: 18px;
  border-radius: 5px;
  border: 2px solid rgba(15, 23, 42, 0.24);
  cursor: pointer;
  transition: all 0.2s ease;
  accent-color: #ffc107;
  flex-shrink: 0;
}

.checkbox-input:checked {
  border-color: #ffc107;
}

.checkbox-text {
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
  letter-spacing: 0.01em;
}
</style>
