<script setup>
import { ref } from 'vue'
import { useCardsStore } from '@/stores/cardsStore'
import { useHistoryStore } from '@/stores/historyStore'

const props = defineProps({
  isModernTheme: Boolean,
  isCollapsed: Boolean
})

const emit = defineEmits(['toggle-theme', 'toggle-collapse'])

const cardsStore = useCardsStore()
const historyStore = useHistoryStore()

const handleUndo = () => {
  historyStore.undo()
}

const handleRedo = () => {
  historyStore.redo()
}

const handleSaveProject = () => {
  const projectData = {
    cards: cardsStore.cards,
    timestamp: new Date().toISOString()
  }
  const json = JSON.stringify(projectData, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `fohow-project-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
}

const handleExportHTML = () => {
  console.log('Экспорт в HTML')
}

const handleExportSVG = () => {
  console.log('Экспорт в SVG')
}

const handlePrint = () => {
  window.print()
}

const handleLoadProject = () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json,application/json'
  input.onchange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const projectData = JSON.parse(event.target.result)
        if (projectData.cards) {
          cardsStore.loadCards(projectData.cards)
        }
      } catch (error) {
        console.error('Ошибка при загрузке проекта:', error)
      }
    }
    reader.readAsText(file)
  }
  input.click()
}

const handleNotesList = () => {
  console.log('Открыть список заметок')
}

const handleSelectionMode = () => {
  console.log('Переключить режим выделения')
}

const handleHierarchicalDragMode = () => {
  console.log('Переключить режим иерархии')
}

const handleToggleGuides = () => {
  console.log('Переключить направляющие')
}
</script>

<template>
 <div
    :class="[
      'left-panel-controls',
      {
        'left-panel-controls--modern': props.isModernTheme,
        'left-panel-controls--collapsed': props.isCollapsed
      }
    ]"
  >
    <div class="left-panel-controls__top">
      <button
        class="ui-btn theme-toggle"
        type="button"
        :title="props.isModernTheme ? 'Вернуться к классическому интерфейсу' : 'Включить новый интерфейс'"
        @click="emit('toggle-theme')"
      >
        <span class="theme-toggle__icon" aria-hidden="true"></span>
      </button>
      <div class="left-panel-controls__history">
        <button
          class="ui-btn"
          id="undo-btn"
          title="Отменить (Ctrl+Z)"
          @click="handleUndo"
          :disabled="!historyStore.canUndo"
        >
          ↶
        </button>
        <button
          class="ui-btn"
          id="redo-btn"
          title="Повторить (Ctrl+Shift+Z)"
          @click="handleRedo"
          :disabled="!historyStore.canRedo"
        >
          ↷
        </button>
      </div>
      <button
        class="ui-btn left-panel-controls__collapse"
        type="button"
        :title="props.isCollapsed ? 'Развернуть панель' : 'Свернуть панель'"
        :aria-expanded="!props.isCollapsed"
        @click="emit('toggle-collapse')"
      >
        <span aria-hidden="true">{{ props.isCollapsed ? '❯' : '❮' }}</span>
      </button>
    </div>

    <div v-if="!props.isCollapsed" class="left-panel-controls__grid">
      <button class="ui-btn" title="Сохранить проект (JSON)" @click="handleSaveProject">💾</button>
      <button class="ui-btn" title="Экспорт в HTML (просмотр)" @click="handleExportHTML">📄</button>
      <button class="ui-btn" title="Экспорт в SVG (вектор)" @click="handleExportSVG">🖋️</button>
      <button class="ui-btn" title="Печать / Экспорт в PDF" @click="handlePrint">🖨️</button>
      <button class="ui-btn" title="Загрузить проект из JSON" @click="handleLoadProject">📂</button>
      <button class="ui-btn" title="Список заметок" @click="handleNotesList" disabled>🗒️</button>
      <button class="ui-btn" title="Режим выделения (Esc)" @click="handleSelectionMode">⬚</button>
      <button class="ui-btn" title="Режим иерархии" @click="handleHierarchicalDragMode">🌳</button>
      <button class="ui-btn" title="Показать/скрыть направляющие" @click="handleToggleGuides">📐</button>
    </div>
    <input type="file" accept=".json,application/json" style="display:none">
  </div>
</template>

<style scoped>
.left-panel-controls {
  --left-panel-btn-size: 64px;
  --left-panel-btn-radius: 18px;
  --left-panel-btn-font: 28px;
  --left-panel-btn-bg: rgba(255, 255, 255, 0.92);
  --left-panel-btn-border: rgba(15, 23, 42, 0.14);
  --left-panel-btn-color: #111827;
  --left-panel-btn-shadow: 0 12px 28px rgba(15, 23, 42, 0.16);
  display: flex;
  flex-direction: column;
  gap: 18px;
  width: 100%;
}

.left-panel-controls--modern {
  --left-panel-btn-size: 80px;
  --left-panel-btn-radius: 24px;
  --left-panel-btn-font: 34px;
  --left-panel-btn-bg: rgba(28, 38, 58, 0.78);
  --left-panel-btn-border: rgba(96, 164, 255, 0.24);
  --left-panel-btn-color: #e5f3ff;
  --left-panel-btn-shadow: 0 24px 44px rgba(8, 12, 22, 0.55);
  gap: 24px;
}

.left-panel-controls--collapsed {
  gap: 12px;
}

.left-panel-controls__top {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 16px;
  justify-content: space-between;
}

.left-panel-controls__history {
  display: flex;
  gap: 16px;
  justify-content: center;
}

.left-panel-controls--modern .left-panel-controls__top {
  flex-direction: column;
  justify-items: center;
  gap: 22px;
}

.left-panel-controls--modern .left-panel-controls__history {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 22px;
}

.left-panel-controls--collapsed .left-panel-controls__top {
  flex-direction: column;
  justify-content: flex-start;
}

.left-panel-controls__grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.left-panel-controls--modern .left-panel-controls__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 24px;
  justify-items: center;
}

.left-panel-controls .ui-btn {
  width: var(--left-panel-btn-size);
  height: var(--left-panel-btn-size);
  border-radius: var(--left-panel-btn-radius);
  border: 1px solid var(--left-panel-btn-border);
  background: var(--left-panel-btn-bg);
  color: var(--left-panel-btn-color);
  font-size: var(--left-panel-btn-font);
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: transform .2s ease, box-shadow .2s ease, background .2s ease, border-color .2s ease;
  box-shadow: var(--left-panel-btn-shadow);
}

.left-panel-controls .ui-btn:hover:not(:disabled) {
  transform: translateY(-4px);
  box-shadow: 0 18px 32px rgba(15, 23, 42, 0.22);
}

.left-panel-controls--modern .ui-btn:hover:not(:disabled) {
  background: rgba(44, 58, 82, 0.95);
  box-shadow: 0 32px 52px rgba(8, 12, 22, 0.58);
}

.left-panel-controls .ui-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.theme-toggle {
  position: relative;
  border: none;
  background: linear-gradient(145deg, rgba(15,98,254,0.18), rgba(15,98,254,0.08));
  box-shadow: inset 0 2px 0 rgba(255,255,255,0.25), 0 18px 30px rgba(15, 23, 42, 0.16);
}

.left-panel-controls--modern .theme-toggle {
  background: linear-gradient(160deg, rgba(89, 208, 255, 0.22) 0%, rgba(89, 208, 255, 0.05) 100%);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.18), 0 32px 50px rgba(6, 11, 21, 0.48);
}

.theme-toggle__icon {
  display: block;
  width: calc(var(--left-panel-btn-size) / 2.8);
  height: calc(var(--left-panel-btn-size) / 2.8);
  border-radius: 50%;
  margin: 0 auto;
  background: radial-gradient(circle at 30% 30%, #59d0ff 0%, #11cbff 45%, rgba(17,203,255,0.2) 70%, transparent 100%);
}

.left-panel-controls:not(.left-panel-controls--modern) .theme-toggle__icon {
  background: radial-gradient(circle at 30% 30%, #0f62fe 0%, rgba(15,98,254,0.55) 60%, transparent 100%);
}

.left-panel-controls__collapse {
  width: calc(var(--left-panel-btn-size) * 0.7);
  font-size: calc(var(--left-panel-btn-font) * 0.75);
}

.left-panel-controls--modern .left-panel-controls__collapse {
  width: calc(var(--left-panel-btn-size) * 0.6);
  box-shadow: 0 18px 34px rgba(6, 11, 21, 0.52);
}

.left-panel-controls--collapsed .left-panel-controls__history {
  gap: 12px;
}

.left-panel-controls--collapsed .ui-btn {
  box-shadow: 0 10px 18px rgba(15, 23, 42, 0.18);
}

.left-panel-controls--collapsed .theme-toggle {
  box-shadow: inset 0 2px 0 rgba(255,255,255,0.18), 0 18px 30px rgba(15, 23, 42, 0.18);
}
</style>
