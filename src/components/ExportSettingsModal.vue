<script setup>
import { ref } from 'vue'

const emit = defineEmits(['close', 'export'])

// Форматы листа с размерами в миллиметрах
const pageFormats = [
  { id: 'original', label: 'Оригинальный размер', width: null, height: null },
  { id: 'a4', label: 'A4', width: 210, height: 297 },
  { id: 'a3', label: 'A3', width: 297, height: 420 },
  { id: 'a2', label: 'A2', width: 420, height: 594 },
  { id: 'a1', label: 'A1', width: 594, height: 841 }
]

// DPI опции
const dpiOptions = [
  { value: 96, label: '96 DPI (веб)' },
  { value: 150, label: '150 DPI (стандарт)' },
  { value: 300, label: '300 DPI (печать)' },
  { value: 600, label: '600 DPI (высокое качество)' }
]

// Состояние формы
const selectedFormat = ref('a4')
const selectedOrientation = ref('portrait') // 'portrait' или 'landscape'
const selectedDPI = ref(300)
const hideContent = ref(false) // Скрыть содержимое
const blackAndWhite = ref(false) // Ч/Б (контур)

const handleExport = () => {
  const format = pageFormats.find(f => f.id === selectedFormat.value)

  emit('export', {
    format: selectedFormat.value,
    width: format.width,
    height: format.height,
    orientation: selectedOrientation.value,
    dpi: selectedDPI.value,
    hideContent: hideContent.value,
    blackAndWhite: blackAndWhite.value
  })
}

const handleClose = () => {
  emit('close')
}
</script>

<template>
  <div class="export-settings-panel">
    <div class="export-settings-panel__header">
      <h3 class="export-settings-panel__title">Настройки экспорта PNG</h3>
      <button
        type="button"
        class="export-settings-panel__close"
        @click="handleClose"
        aria-label="Закрыть"
      >
        ×
      </button>
    </div>

    <div class="export-settings-panel__body">
      <!-- Формат листа -->
      <div class="form-group">
        <label for="page-format" class="form-label">Формат листа:</label>
        <select
          id="page-format"
          v-model="selectedFormat"
          class="form-select"
        >
          <option
            v-for="format in pageFormats"
            :key="format.id"
            :value="format.id"
          >
            {{ format.label }}
          </option>
        </select>
      </div>

      <!-- Ориентация -->
      <div class="form-group">
        <label class="form-label">Ориентация:</label>
        <div class="orientation-buttons">
          <button
            type="button"
            class="orientation-btn"
            :class="{ active: selectedOrientation === 'portrait' }"
            @click="selectedOrientation = 'portrait'"
          >
            <span class="orientation-icon">📄</span>
            <span>Книжная</span>
          </button>
          <button
            type="button"
            class="orientation-btn"
            :class="{ active: selectedOrientation === 'landscape' }"
            @click="selectedOrientation = 'landscape'"
          >
            <span class="orientation-icon">📃</span>
            <span>Альбомная</span>
          </button>
        </div>
      </div>

      <!-- Разрешение (DPI) -->
      <div class="form-group">
        <label for="dpi" class="form-label">Разрешение:</label>
        <select
          id="dpi"
          v-model.number="selectedDPI"
          class="form-select"
        >
          <option
            v-for="dpi in dpiOptions"
            :key="dpi.value"
            :value="dpi.value"
          >
            {{ dpi.label }}
          </option>
        </select>
      </div>

      <!-- Дополнительные опции -->
      <div class="form-group">
        <label class="form-label">Дополнительные опции:</label>
        <div class="checkbox-group">
          <label class="checkbox-label">
            <input
              type="checkbox"
              v-model="hideContent"
              class="checkbox-input"
            />
            <span class="checkbox-text">Скрыть содержимое</span>
          </label>
          <label class="checkbox-label">
            <input
              type="checkbox"
              v-model="blackAndWhite"
              class="checkbox-input"
            />
            <span class="checkbox-text">Ч/Б (контур)</span>
          </label>
        </div>
      </div>

      <!-- Информация о размере -->
      <div v-if="selectedFormat !== 'original'" class="info-box">
        <p class="info-text">
          <strong>Размер изображения:</strong>
          {{
            selectedOrientation === 'portrait'
              ? Math.round((pageFormats.find(f => f.id === selectedFormat).width / 25.4) * selectedDPI)
              : Math.round((pageFormats.find(f => f.id === selectedFormat).height / 25.4) * selectedDPI)
          }}
          ×
          {{
            selectedOrientation === 'portrait'
              ? Math.round((pageFormats.find(f => f.id === selectedFormat).height / 25.4) * selectedDPI)
              : Math.round((pageFormats.find(f => f.id === selectedFormat).width / 25.4) * selectedDPI)
          }}
          пикселей
        </p>
      </div>
    </div>

    <div class="export-settings-panel__footer">
      <button
        type="button"
        class="export-btn export-btn--secondary"
        @click="handleClose"
      >
        Отмена
      </button>
      <button
        type="button"
        class="export-btn export-btn--primary"
        @click="handleExport"
      >
        Экспорт
      </button>
    </div>
  </div>
</template>

<style scoped>
/* Стили остаются без изменений */
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
  scrollbar-color: rgba(59, 130, 246, 0.3) rgba(15, 23, 42, 0.05);
}

.export-settings-panel__body::-webkit-scrollbar {
  width: 6px;
}

.export-settings-panel__body::-webkit-scrollbar-track {
  background: rgba(15, 23, 42, 0.05);
  border-radius: 3px;
}

.export-settings-panel__body::-webkit-scrollbar-thumb {
  background: rgba(59, 130, 246, 0.3);
  border-radius: 3px;
}

.export-settings-panel__body::-webkit-scrollbar-thumb:hover {
  background: rgba(59, 130, 246, 0.5);
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

.form-select {
  width: 100%;
  padding: 10px 14px;
  font-size: 14px;
  font-family: inherit;
  color: #0f172a;
  background: rgba(248, 250, 252, 0.95);
  border: 1px solid rgba(15, 23, 42, 0.12);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.form-select:hover {
  border-color: rgba(59, 130, 246, 0.4);
  background: rgba(255, 255, 255, 1);
}

.form-select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
}

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
  border-color: rgba(59, 130, 246, 0.4);
  background: rgba(255, 255, 255, 1);
  transform: translateY(-1px);
  box-shadow: 0 6px 12px rgba(15, 23, 42, 0.1);
}

.orientation-btn.active {
  border-color: #3b82f6;
  background: rgba(59, 130, 246, 0.12);
  color: #1d4ed8;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

.orientation-btn:active {
  transform: translateY(0);
}

.orientation-icon {
  font-size: 28px;
  line-height: 1;
}

.info-box {
  margin-top: 16px;
  padding: 12px 14px;
  background: rgba(59, 130, 246, 0.08);
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: 10px;
}

.info-text {
  margin: 0;
  font-size: 13px;
  color: #1e40af;
  line-height: 1.5;
}

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
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: #ffffff;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.export-btn--primary:hover {
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  transform: translateY(-1px);
  box-shadow: 0 6px 14px rgba(59, 130, 246, 0.4);
}

.export-btn--primary:active {
  transform: translateY(0);
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
}

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

.checkbox-label:hover {
  background: rgba(255, 255, 255, 1);
  border-color: rgba(59, 130, 246, 0.4);
  transform: translateY(-1px);
  box-shadow: 0 4px 10px rgba(15, 23, 42, 0.08);
}

.checkbox-label:has(.checkbox-input:checked) {
  background: rgba(59, 130, 246, 0.1);
  border-color: #3b82f6;
}

.checkbox-input {
  width: 18px;
  height: 18px;
  border-radius: 5px;
  border: 2px solid rgba(15, 23, 42, 0.24);
  cursor: pointer;
  transition: all 0.2s ease;
  accent-color: #3b82f6;
  flex-shrink: 0;
}

.checkbox-input:checked {
  border-color: #3b82f6;
}

.checkbox-text {
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
  letter-spacing: 0.01em;
}
</style>
