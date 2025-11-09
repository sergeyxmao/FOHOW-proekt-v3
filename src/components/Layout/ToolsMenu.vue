<script setup>
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useCanvasStore } from '../../stores/canvas.js'
import { useHistoryStore } from '../../stores/history.js'
const props = defineProps({
  isModernTheme: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['request-close', 'activate-pencil', 'clear-canvas', 'new-structure'])

const canvasStore = useCanvasStore()
const historyStore = useHistoryStore()
const { isSelectionMode, isHierarchicalDragMode, guidesEnabled } = storeToRefs(canvasStore)
const { canUndo, canRedo } = storeToRefs(historyStore)

const showClearCanvasDialog = ref(false)
const showNewStructureDialog = ref(false)

const handleSelectionMode = () => {
  canvasStore.toggleSelectionMode()
  emit('request-close')
}

const handleHierarchicalMode = () => {
  canvasStore.toggleHierarchicalDragMode()
  emit('request-close')
}

const handleActivatePencil = () => {
  emit('activate-pencil')
  emit('request-close')
}

const handleUndo = () => {
  if (!canUndo.value) {
    return
  }

  historyStore.undo()
  emit('request-close')
}

const handleRedo = () => {
  if (!canRedo.value) {
    return
  }

  historyStore.redo()
  emit('request-close')
}

const toggleGuides = () => {
  canvasStore.toggleGuides()
  emit('request-close')
}

const handleClearCanvas = () => {
  showClearCanvasDialog.value = true
}

const confirmClearCanvas = () => {
  showClearCanvasDialog.value = false
  emit('clear-canvas')
  emit('request-close')
}

const cancelClearCanvas = () => {
  showClearCanvasDialog.value = false
}

const handleNewStructure = () => {
  showNewStructureDialog.value = true
}

const confirmNewStructure = (shouldSave) => {
  showNewStructureDialog.value = false
  emit('new-structure', shouldSave)
  emit('request-close')
}

const cancelNewStructure = () => {
  showNewStructureDialog.value = false
}
</script>

<template>
  <div
    class="tools-menu"
    :class="{ 'tools-menu--modern': props.isModernTheme }"
    role="menu"
  >
    <h3 class="tools-menu__title">Инструменты</h3>
    <div class="tools-menu__list">
      <div class="tools-menu__item">
        <span class="tools-menu__icon" aria-hidden="true">⬚</span>
        <button
          type="button"
          class="tools-menu__action"
          :class="{ 'tools-menu__action--active': isSelectionMode }"
          @click="handleSelectionMode"
        >
          Режим выделения
        </button>
      </div>
      <div class="tools-menu__item">
        <span class="tools-menu__icon" aria-hidden="true">🌳</span>
        <button
          type="button"
          class="tools-menu__action"
          :class="{ 'tools-menu__action--active': isHierarchicalDragMode }"
          @click="handleHierarchicalMode"
        >
          Режим иерархии
        </button>
      </div>
      <div class="tools-menu__item">
        <span class="tools-menu__icon" aria-hidden="true">✏️</span>
        <button
          type="button"
          class="tools-menu__action"
          @click="handleActivatePencil"
        >
          Режим рисования
        </button>
      </div>
      <div class="tools-menu__item">
        <span class="tools-menu__icon" aria-hidden="true">📐</span>
        <button
          type="button"
          class="tools-menu__action"
          :class="{ 'tools-menu__action--active': guidesEnabled }"
          @click="toggleGuides"
        >
          Показать направляющие
        </button>
      </div>
      <div class="tools-menu__item">
        <span class="tools-menu__icon" aria-hidden="true">🧹</span>
        <button
          type="button"
          class="tools-menu__action"
          @click="handleClearCanvas"
        >
          Очистить холст
        </button>
      </div>
      <div class="tools-menu__item">
        <span class="tools-menu__icon" aria-hidden="true">📄</span>
        <button
          type="button"
          class="tools-menu__action"
          @click="handleNewStructure"
        >
          Новая структура
        </button>
      </div>
    </div>

    <!-- Диалог подтверждения очистки холста -->
    <div v-if="showClearCanvasDialog" class="dialog-overlay" @click="cancelClearCanvas">
      <div class="dialog-content" @click.stop>
        <h3 class="dialog-title">Подтверждение очистки</h3>
        <p class="dialog-message">Вы уверены, что хотите очистить холст? Все объекты будут удалены.</p>
        <div class="dialog-actions">
          <button class="dialog-button dialog-button--cancel" @click="cancelClearCanvas">
            Отмена
          </button>
          <button class="dialog-button dialog-button--confirm" @click="confirmClearCanvas">
            Продолжить
          </button>
        </div>
      </div>
    </div>

    <!-- Диалог новой структуры -->
    <div v-if="showNewStructureDialog" class="dialog-overlay" @click="cancelNewStructure">
      <div class="dialog-content" @click.stop>
        <h3 class="dialog-title">Новая структура</h3>
        <p class="dialog-message">Хотите сохранить текущую структуру перед созданием новой?</p>
        <div class="dialog-actions">
          <button class="dialog-button dialog-button--cancel" @click="cancelNewStructure">
            Отмена
          </button>
          <button class="dialog-button dialog-button--secondary" @click="confirmNewStructure(false)">
            Не сохранять
          </button>
          <button class="dialog-button dialog-button--confirm" @click="confirmNewStructure(true)">
            Сохранить и создать новую
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tools-menu {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
}

.tools-menu__title {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: #0f172a;
}

.tools-menu__list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.tools-menu__item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.tools-menu__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 12px;
  background: rgba(59, 130, 246, 0.12);
  font-size: 18px;
}

.tools-menu__action {
  flex: 1;
  padding: 10px 14px;
  border: 1px solid rgba(15, 23, 42, 0.12);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.9);
  color: #0f172a;
  font-size: 14px;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease, box-shadow 0.2s ease;
}

.tools-menu__action:hover {
  background: rgba(59, 130, 246, 0.12);
  color: #1d4ed8;
  box-shadow: 0 8px 18px rgba(37, 99, 235, 0.18);
}

.tools-menu__action--active {
  background: linear-gradient(120deg, #3b82f6 0%, #2563eb 100%);
  color: #ffffff;
  box-shadow: 0 10px 24px rgba(37, 99, 235, 0.35);
}
.tools-menu--modern .tools-menu__title {
  color: #e5f3ff;
}

.tools-menu--modern .tools-menu__icon {
  background: rgba(96, 164, 255, 0.18);
  color: #e5f3ff;
}

.tools-menu--modern .tools-menu__action {
  border-color: rgba(96, 164, 255, 0.32);
  background: rgba(24, 34, 58, 0.92);
  color: #e5f3ff;
  box-shadow: 0 18px 32px rgba(6, 11, 21, 0.6);
}

.tools-menu--modern .tools-menu__action:hover {
  background: rgba(96, 164, 255, 0.22);
  color: #0b1324;
  box-shadow: 0 24px 40px rgba(6, 11, 21, 0.72);
}

.tools-menu--modern .tools-menu__action--active {
  background: linear-gradient(120deg, #73c8ff 0%, #2563eb 100%);
  color: #051125;
  box-shadow: 0 20px 40px rgba(6, 11, 21, 0.75);
}

/* Диалоговые окна */
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  backdrop-filter: blur(4px);
}

.dialog-content {
  background: white;
  border-radius: 16px;
  padding: 24px;
  max-width: 400px;
  width: 90%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.dialog-title {
  margin: 0 0 12px 0;
  font-size: 18px;
  font-weight: 700;
  color: #0f172a;
}

.dialog-message {
  margin: 0 0 24px 0;
  font-size: 14px;
  line-height: 1.5;
  color: #475569;
}

.dialog-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.dialog-button {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.dialog-button--cancel {
  background: #e2e8f0;
  color: #475569;
}

.dialog-button--cancel:hover {
  background: #cbd5e1;
}

.dialog-button--secondary {
  background: #f59e0b;
  color: white;
}

.dialog-button--secondary:hover {
  background: #d97706;
}

.dialog-button--confirm {
  background: linear-gradient(120deg, #3b82f6 0%, #2563eb 100%);
  color: white;
}

.dialog-button--confirm:hover {
  background: linear-gradient(120deg, #2563eb 0%, #1d4ed8 100%);
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
}
</style>
