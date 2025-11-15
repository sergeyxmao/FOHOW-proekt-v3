<script setup>
import { ref } from 'vue'
import { useSidePanelsStore } from '../../stores/sidePanels.js'
import { useStickersStore } from '../../stores/stickers.js'
import FileBrowser from '../drawing/FileBrowser.vue'

const props = defineProps({
  isModernTheme: {
    type: Boolean,
    default: false
  }
})

const sidePanelsStore = useSidePanelsStore()
const stickersStore = useStickersStore()

// Состояние панели: 'initial' | 'browser'
const panelState = ref('initial')

const handleClose = () => {
  sidePanelsStore.closePanel()
  // Сброс состояния при закрытии
  panelState.value = 'initial'
}

const openBrowser = () => {
  panelState.value = 'browser'
}

const handleFileSelected = (fileData) => {
  console.log('Файл выбран:', fileData)
  // TODO: Шаг 3 - Интеграция с Canvas
  // Здесь будет добавлена логика для добавления изображения на холст
}
</script>

<template>
  <div
    class="image-browser-panel"
    :class="{
      'image-browser-panel--modern': props.isModernTheme,
      'image-browser-panel--no-pointer': stickersStore.isPlacementMode
    }"
  >
    <div class="image-browser-panel__header">
      <h2 class="image-browser-panel__title">Добавить изображение</h2>
      <button
        type="button"
        class="image-browser-panel__close"
        title="Закрыть"
        @click="handleClose"
      >
        ×
      </button>
    </div>

    <div class="image-browser-panel__content">
      <!-- Начальное состояние: пустая панель с кнопкой "Открыть" -->
      <div v-if="panelState === 'initial'" class="panel-initial">
        <button
          type="button"
          class="panel-initial__button"
          @click="openBrowser"
        >
          Открыть
        </button>
      </div>

      <!-- Состояние браузера: файловый браузер -->
      <div v-if="panelState === 'browser'" class="panel-browser">
        <FileBrowser @file-selected="handleFileSelected" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.image-browser-panel {
  position: fixed;
  left: 0;
  top: 0;
  bottom: 0;
  width: 320px;
  background: rgba(255, 255, 255, 0.98);
  border-right: 1px solid rgba(15, 23, 42, 0.12);
  box-shadow: 4px 0 24px rgba(15, 23, 42, 0.18);
  z-index: 2000;
  display: flex;
  flex-direction: column;
  transition: transform 0.3s ease;
}

.image-browser-panel--no-pointer {
  pointer-events: none;
  opacity: 0.3;
  backdrop-filter: blur(8px);
}

/* Header */
.image-browser-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px 24px 16px;
  border-bottom: 1px solid rgba(15, 23, 42, 0.08);
}

.image-browser-panel__title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: #1f2937;
}

.image-browser-panel__close {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  border: 1px solid rgba(15, 23, 42, 0.12);
  background: rgba(248, 250, 252, 0.92);
  color: #0f172a;
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: background 0.2s ease, color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
}

.image-browser-panel__close:hover {
  background: rgba(239, 68, 68, 0.12);
  color: #dc2626;
  box-shadow: 0 8px 16px rgba(15, 23, 42, 0.12);
  transform: translateY(-1px);
}

/* Content */
.image-browser-panel__content {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

/* Initial State */
.panel-initial {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.panel-initial__button {
  padding: 14px 32px;
  border-radius: 12px;
  border: 1px solid rgba(59, 130, 246, 0.3);
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.92) 0%, rgba(37, 99, 235, 0.92) 100%);
  color: #ffffff;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.panel-initial__button:hover {
  background: linear-gradient(135deg, rgba(59, 130, 246, 1) 0%, rgba(37, 99, 235, 1) 100%);
  box-shadow: 0 8px 20px rgba(59, 130, 246, 0.4);
  transform: translateY(-2px);
}

.panel-initial__button:active {
  transform: translateY(0);
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
}

/* Browser State */
.panel-browser {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Modern Theme */
.image-browser-panel--modern {
  background: rgba(18, 28, 48, 0.96);
  border-right-color: rgba(96, 164, 255, 0.28);
  box-shadow: 4px 0 28px rgba(6, 11, 21, 0.65);
}

.image-browser-panel--modern .image-browser-panel__header {
  border-bottom-color: rgba(96, 164, 255, 0.22);
}

.image-browser-panel--modern .image-browser-panel__title {
  color: #e5f3ff;
}

.image-browser-panel--modern .image-browser-panel__close {
  border-color: rgba(96, 164, 255, 0.35);
  background: rgba(24, 34, 58, 0.92);
  color: #e5f3ff;
  box-shadow: 0 16px 30px rgba(6, 11, 21, 0.6);
}

.image-browser-panel--modern .image-browser-panel__close:hover {
  background: rgba(248, 113, 113, 0.22);
  color: #fca5a5;
  box-shadow: 0 20px 36px rgba(6, 11, 21, 0.7);
}

.image-browser-panel--modern .panel-initial__button {
  border-color: rgba(96, 164, 255, 0.4);
  background: linear-gradient(135deg, rgba(96, 164, 255, 0.92) 0%, rgba(59, 130, 246, 0.92) 100%);
  box-shadow: 0 8px 20px rgba(6, 11, 21, 0.6);
}

.image-browser-panel--modern .panel-initial__button:hover {
  background: linear-gradient(135deg, rgba(96, 164, 255, 1) 0%, rgba(59, 130, 246, 1) 100%);
  box-shadow: 0 12px 28px rgba(6, 11, 21, 0.7);
}

/* Адаптивность для мобильных устройств */
@media (max-width: 768px) {
  .image-browser-panel {
    width: 90%;
  }
}
</style>
