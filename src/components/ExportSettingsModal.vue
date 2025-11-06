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

const handleExport = () => {
  const format = pageFormats.find(f => f.id === selectedFormat.value)

  emit('export', {
    format: selectedFormat.value,
    width: format.width,
    height: format.height,
    orientation: selectedOrientation.value,
    dpi: selectedDPI.value
  })
}

const handleClose = () => {
  emit('close')
}
</script>

<template>
  <div class="modal-overlay" @click.self="handleClose">
    <div class="modal-dialog">
      <div class="modal-header">
        <h2 class="modal-title">Настройки экспорта PNG</h2>
        <button
          type="button"
          class="modal-close-btn"
          @click="handleClose"
          aria-label="Закрыть"
        >
          ×
        </button>
      </div>

      <div class="modal-body">
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

      <div class="modal-footer">
        <button
          type="button"
          class="btn btn-secondary"
          @click="handleClose"
        >
          Закрыть
        </button>
        <button
          type="button"
          class="btn btn-primary"
          @click="handleExport"
        >
          Сохранить
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  backdrop-filter: blur(4px);
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.modal-dialog {
  background: #ffffff;
  border-radius: 20px;
  box-shadow: 0 24px 64px rgba(15, 23, 42, 0.25);
  max-width: 500px;
  width: 90%;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  animation: slideUp 0.3s ease;
}

@keyframes slideUp {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px 28px;
  border-bottom: 1px solid rgba(15, 23, 42, 0.08);
}

.modal-title {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: -0.01em;
}

.modal-close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 12px;
  background: rgba(15, 23, 42, 0.06);
  color: #0f172a;
  font-size: 28px;
  cursor: pointer;
  transition: all 0.2s ease;
  line-height: 1;
}

.modal-close-btn:hover {
  background: rgba(239, 68, 68, 0.12);
  color: #dc2626;
  transform: scale(1.05);
}

.modal-close-btn:active {
  transform: scale(0.95);
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 28px;
}

.form-group {
  margin-bottom: 24px;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-label {
  display: block;
  margin-bottom: 10px;
  font-size: 15px;
  font-weight: 600;
  color: #0f172a;
  letter-spacing: 0.01em;
}

.form-select {
  width: 100%;
  padding: 12px 16px;
  font-size: 15px;
  font-family: inherit;
  color: #0f172a;
  background: rgba(248, 250, 252, 0.9);
  border: 1px solid rgba(15, 23, 42, 0.12);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.form-select:hover {
  border-color: rgba(59, 130, 246, 0.3);
  background: rgba(248, 250, 252, 1);
}

.form-select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
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
  gap: 8px;
  padding: 16px 12px;
  border: 2px solid rgba(15, 23, 42, 0.12);
  border-radius: 14px;
  background: rgba(248, 250, 252, 0.7);
  color: #0f172a;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.orientation-btn:hover {
  border-color: rgba(59, 130, 246, 0.3);
  background: rgba(248, 250, 252, 1);
  transform: translateY(-2px);
  box-shadow: 0 8px 16px rgba(15, 23, 42, 0.08);
}

.orientation-btn.active {
  border-color: #3b82f6;
  background: rgba(59, 130, 246, 0.1);
  color: #1d4ed8;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
}

.orientation-btn:active {
  transform: translateY(0);
}

.orientation-icon {
  font-size: 32px;
  line-height: 1;
}

.info-box {
  margin-top: 20px;
  padding: 16px;
  background: rgba(59, 130, 246, 0.08);
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: 12px;
}

.info-text {
  margin: 0;
  font-size: 14px;
  color: #1e40af;
  line-height: 1.5;
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  padding: 20px 28px;
  border-top: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(248, 250, 252, 0.5);
}

.btn {
  padding: 12px 24px;
  border: none;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  letter-spacing: 0.01em;
}

.btn-secondary {
  background: rgba(15, 23, 42, 0.08);
  color: #0f172a;
}

.btn-secondary:hover {
  background: rgba(15, 23, 42, 0.14);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.1);
}

.btn-secondary:active {
  transform: translateY(0);
}

.btn-primary {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: #ffffff;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.btn-primary:hover {
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(59, 130, 246, 0.4);
}

.btn-primary:active {
  transform: translateY(0);
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
}
</style>
