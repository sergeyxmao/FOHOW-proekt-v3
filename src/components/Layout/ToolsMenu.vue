<script setup>
import { storeToRefs } from 'pinia'
import { useCanvasStore } from '../../stores/canvas.js'
import { useHistoryStore } from '../../stores/history.js'  

const emit = defineEmits(['request-close', 'activate-pencil'])

const canvasStore = useCanvasStore()
const historyStore = useHistoryStore()  
const { isSelectionMode, isHierarchicalDragMode } = storeToRefs(canvasStore)
const { canUndo, canRedo } = storeToRefs(historyStore)

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
</script>

<template>
  <div class="tools-menu" role="menu">
    <h3 class="tools-menu__title">Инструменты</h3>
    <div class="tools-menu__list">
      <div class="tools-menu__icon-row">
        <button
          type="button"
          class="tools-menu__icon-button"
          title="Отменить (Ctrl+Z)"
          :disabled="!canUndo"
          @click="handleUndo"
        >
          ↶
        </button>
        <button
          type="button"
          class="tools-menu__icon-button"
          title="Повторить (Ctrl+Shift+Z)"
          :disabled="!canRedo"
          @click="handleRedo"
        >
          ↷
        </button>
      </div>      
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
.tools-menu__icon-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-bottom: 4px;
  border-bottom: 1px solid rgba(15, 23, 42, 0.08);
}

.tools-menu__icon-button {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  border: 1px solid rgba(15, 23, 42, 0.12);
  background: rgba(255, 255, 255, 0.92);
  color: #1d4ed8;
  font-size: 20px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 10px 22px rgba(15, 23, 42, 0.16);
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease, color 0.2s ease;
}

.tools-menu__icon-button:hover:enabled {
  transform: translateY(-2px);
  box-shadow: 0 16px 28px rgba(15, 23, 42, 0.22);
  background: rgba(255, 255, 255, 1);
}

.tools-menu__icon-button:disabled {
  opacity: 0.5;
  cursor: default;
  box-shadow: none;
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
</style>
