<script setup>
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useCanvasStore } from '../../stores/canvas.js'
import { useHistoryStore } from '../../stores/history.js'
const props = defineProps({
  isModernTheme: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['request-close', 'activate-pencil', 'clear-canvas', 'new-structure'])

const { t } = useI18n()
const canvasStore = useCanvasStore()
const historyStore = useHistoryStore()
const { isHierarchicalDragMode, guidesEnabled } = storeToRefs(canvasStore)
const { canUndo, canRedo } = storeToRefs(historyStore)

const showClearCanvasDialog = ref(false)
const showNewStructureDialog = ref(false)
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

const toggleHierarchyMode = () => {
  canvasStore.toggleHierarchicalDragMode()
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
    <h3 class="tools-menu__title">{{ t('toolsMenu.title') }}</h3>
    <div class="tools-menu__list">
      <div class="tools-menu__item">
        <span class="tools-menu__icon" aria-hidden="true">✏️</span>
        <button
          type="button"
          class="tools-menu__action"
          @click="handleActivatePencil"
        >
          {{ t('toolsMenu.drawingMode') }}
          <span class="tools-menu__info" @click.stop>
            &#9432;
            <span class="tools-menu__tooltip" v-html="t('toolsMenu.tooltips.drawingMode')"></span>
          </span>
        </button>
      </div>
      <div class="tools-menu__item">
        <span class="tools-menu__icon" aria-hidden="true">🌳</span>
        <button
          type="button"
          class="tools-menu__action"
          :class="{ 'tools-menu__action--active': isHierarchicalDragMode }"
          @click="toggleHierarchyMode"
        >
          {{ t('toolsMenu.hierarchyMode') }}
          <span class="tools-menu__info" @click.stop>
            &#9432;
            <span class="tools-menu__tooltip" v-html="t('toolsMenu.tooltips.hierarchyMode')"></span>
          </span>
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
          {{ t('toolsMenu.showGuides') }}
          <span class="tools-menu__info" @click.stop>
            &#9432;
            <span class="tools-menu__tooltip" v-html="t('toolsMenu.tooltips.showGuides')"></span>
          </span>
        </button>
      </div>
      <div class="tools-menu__item">
        <span class="tools-menu__icon" aria-hidden="true">🧹</span>
        <button
          type="button"
          class="tools-menu__action"
          @click="handleClearCanvas"
        >
          {{ t('toolsMenu.clearCanvas') }}
          <span class="tools-menu__info" @click.stop>
            &#9432;
            <span class="tools-menu__tooltip" v-html="t('toolsMenu.tooltips.clearCanvas')"></span>
          </span>
        </button>
      </div>
      <div class="tools-menu__item">
        <span class="tools-menu__icon" aria-hidden="true">📄</span>
        <button
          type="button"
          class="tools-menu__action"
          @click="handleNewStructure"
        >
          {{ t('toolsMenu.newStructure') }}
          <span class="tools-menu__info" @click.stop>
            &#9432;
            <span class="tools-menu__tooltip" v-html="t('toolsMenu.tooltips.newStructure')"></span>
          </span>
        </button>
      </div>
    </div>

    <!-- Диалог подтверждения очистки холста -->
    <Teleport to="body">
      <div v-if="showClearCanvasDialog" class="dialog-overlay" @click="cancelClearCanvas">
        <div class="dialog-content" @click.stop>
          <h3 class="dialog-title">{{ t('toolsMenu.clearConfirmTitle') }}</h3>
          <p class="dialog-message">{{ t('toolsMenu.clearConfirmMessage') }}</p>
          <div class="dialog-actions">
            <button class="dialog-button dialog-button--cancel" @click="cancelClearCanvas">
              {{ t('common.cancel') }}
            </button>
            <button class="dialog-button dialog-button--confirm" @click="confirmClearCanvas">
              {{ t('toolsMenu.continueAction') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Диалог новой структуры -->
    <Teleport to="body">
      <div v-if="showNewStructureDialog" class="dialog-overlay" @click="cancelNewStructure">
        <div class="dialog-content" @click.stop>
          <h3 class="dialog-title">{{ t('toolsMenu.newStructureTitle') }}</h3>
          <p class="dialog-message">{{ t('toolsMenu.newStructureMessage') }}</p>
          <div class="dialog-actions">
            <button class="dialog-button dialog-button--cancel" @click="cancelNewStructure">
              {{ t('common.cancel') }}
            </button>
            <button class="dialog-button dialog-button--secondary" @click="confirmNewStructure(false)">
              {{ t('toolsMenu.dontSave') }}
            </button>
            <button class="dialog-button dialog-button--confirm" @click="confirmNewStructure(true)">
              {{ t('toolsMenu.saveAndCreate') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
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
  display: flex;
  align-items: center;
  gap: 8px;
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
  background: #ffc107;
  color: #000000;
  border-color: rgba(255, 193, 7, 0.8);
  box-shadow: 0 10px 22px rgba(255, 193, 7, 0.3);
}

.tools-menu__action--active {
  background: #ffc107;
  color: #000000;
  border-color: rgba(255, 193, 7, 0.8);
  box-shadow: 0 10px 24px rgba(255, 193, 7, 0.35);
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
  background: #ffc107;
  color: #000000;
  border-color: rgba(255, 193, 7, 0.85);
  box-shadow: 0 24px 40px rgba(255, 193, 7, 0.4);
}

.tools-menu--modern .tools-menu__action--active {
  background: #ffc107;
  color: #000000;
  border-color: rgba(255, 193, 7, 0.85);
  box-shadow: 0 20px 40px rgba(255, 193, 7, 0.4);
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
  background: #ffc107;
  color: #000000;
}

.dialog-button--confirm:hover {
  background: #e8a900;
  box-shadow: 0 4px 12px rgba(255, 193, 7, 0.3);
}

/* Info icon — скрыт по умолчанию, появляется при наведении на кнопку */
.tools-menu__info {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  font-size: 16px;
  border-radius: 50%;
  color: rgba(15, 23, 42, 0.35);
  opacity: 0;
  transition: opacity 0.2s ease, color 0.15s ease;
  cursor: help;
  flex-shrink: 0;
  margin-left: auto;
}

.tools-menu__action:hover .tools-menu__info {
  opacity: 1;
  color: rgba(0, 0, 0, 0.45);
}

.tools-menu__info:hover {
  color: rgba(0, 0, 0, 0.7) !important;
}

/* Modern theme — info icon */
.tools-menu--modern .tools-menu__info {
  color: rgba(229, 243, 255, 0.35);
}

.tools-menu--modern .tools-menu__action:hover .tools-menu__info {
  color: rgba(0, 0, 0, 0.45);
}

.tools-menu--modern .tools-menu__info:hover {
  color: rgba(0, 0, 0, 0.7) !important;
}

/* Tooltip — появляется при наведении на ⓘ */
.tools-menu__tooltip {
  position: absolute;
  left: calc(100% + 14px);
  top: 50%;
  transform: translateY(-50%);
  width: 230px;
  padding: 10px 14px;
  background: rgba(15, 23, 42, 0.94);
  color: #f1f5f9;
  font-size: 12.5px;
  font-weight: 400;
  line-height: 1.5;
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.22);
  white-space: normal;
  text-align: left;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.2s ease;
  z-index: 10;
}

/* Стрелка тултипа */
.tools-menu__tooltip::before {
  content: '';
  position: absolute;
  right: 100%;
  top: 50%;
  transform: translateY(-50%);
  border: 6px solid transparent;
  border-right-color: rgba(15, 23, 42, 0.94);
}

.tools-menu__info:hover .tools-menu__tooltip {
  opacity: 1;
}

/* Modern theme — tooltip */
.tools-menu--modern .tools-menu__tooltip {
  background: rgba(30, 42, 70, 0.96);
  border: 1px solid rgba(96, 164, 255, 0.25);
  box-shadow: 0 8px 24px rgba(6, 11, 21, 0.4);
}

.tools-menu--modern .tools-menu__tooltip::before {
  border-right-color: rgba(30, 42, 70, 0.96);
}
</style>
