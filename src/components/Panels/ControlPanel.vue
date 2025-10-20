<script setup>
import { useCardsStore } from '../../stores/cards.js'
import { useHistoryStore } from '../../stores/history.js'

const props = defineProps({
  isModernTheme: {
    type: Boolean,
    default: false
  },
  isCollapsed: {
    type: Boolean,
    default: false    
  }
})

const emit = defineEmits(['toggle-theme', 'toggle-collapse'])  
const cardsStore = useCardsStore()
const historyStore = useHistoryStore()

// Обработчики для кнопок левой панели
const handleUndo = () => {
  historyStore.undo()
}

const handleRedo = () => {
  historyStore.redo()
}

const handleSaveProject = () => {
  // Сохранение проекта в JSON
  const projectData = {
    cards: cardsStore.cards,
    timestamp: Date.now()
  }
  const dataStr = JSON.stringify(projectData, null, 2)
  const dataBlob = new Blob([dataStr], {type: 'application/json'})
  const url = URL.createObjectURL(dataBlob)
  const link = document.createElement('a')
  link.href = url
  link.download = `fohow-project-${Date.now()}.json`
  link.click()
  URL.revokeObjectURL(url)
}

const handleExportHTML = () => {
  // Экспорт в HTML
  window.print()
}

const handleExportSVG = () => {
  // Экспорт в SVG
  const svgElement = document.querySelector('#svg-layer')
  if (!svgElement) return
  
  const svgData = new XMLSerializer().serializeToString(svgElement)
  const svgBlob = new Blob([svgData], {type: 'image/svg+xml;charset=utf-8'})
  const svgUrl = URL.createObjectURL(svgBlob)
  const downloadLink = document.createElement('a')
  downloadLink.href = svgUrl
  downloadLink.download = `fohow-board-${Date.now()}.svg`
  document.body.appendChild(downloadLink)
  downloadLink.click()
  document.body.removeChild(downloadLink)
  URL.revokeObjectURL(svgUrl)
}

const handlePrint = () => {
  // Печать / Экспорт в PDF
  window.print()
}

const handleLoadProject = () => {
  // Загрузка проекта из JSON
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json,application/json'
  input.onchange = (e) => {
    const file = e.target.files[0]
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
  // Список заметок
  console.log('Открыть список заметок')
}

const handleSelectionMode = () => {
  // Режим выделения
  console.log('Переключить режим выделения')
}

const handleHierarchicalDragMode = () => {
  // Режим иерархии
  console.log('Переключить режим иерархии')
}

const handleToggleGuides = () => {
  // Показать/скрыть направляющие
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
    <template v-if="props.isCollapsed">
      <div class="left-panel-controls__collapsed">
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
    </template>
    <template v-else>
      <div class="left-panel-controls__grid">
        <button
          class="ui-btn theme-toggle left-panel-controls__grid-item--full"
          type="button"
          :title="props.isModernTheme ? 'Вернуться к классическому интерфейсу' : 'Включить новый интерфейс'"
          @click="emit('toggle-theme')"
        >
          <span class="theme-toggle__icon" aria-hidden="true"></span>
        </button>
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
        <button class="ui-btn" title="Сохранить проект (JSON)" @click="handleSaveProject">💾</button>
        <button class="ui-btn" title="Экспорт в HTML (просмотр)" @click="handleExportHTML">📄</button>
        <button class="ui-btn" title="Экспорт в SVG (вектор)" @click="handleExportSVG">🖋️</button>
        <button class="ui-btn" title="Печать / Экспорт в PDF" @click="handlePrint">🖨️</button>
        <button class="ui-btn" title="Загрузить проект из JSON" @click="handleLoadProject">📂</button>
        <button class="ui-btn" title="Список заметок" @click="handleNotesList" disabled>🗒️</button>
        <button class="ui-btn" title="Режим выделения (Esc)" @click="handleSelectionMode">⬚</button>
        <button class="ui-btn" title="Режим иерархии" @click="handleHierarchicalDragMode">🌳</button>
        <button class="ui-btn" title="Показать/скрыть направляющие" @click="handleToggleGuides">📐</button>
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
    </template>
    <input type="file" accept=".json,application/json" style="display:none">
  </div>
</template>

<style scoped>
.left-panel-controls {
  --left-panel-btn-size: 72px;
  --left-panel-btn-radius: 22px;
  --left-panel-btn-font: 30px;
  --left-panel-btn-bg: rgba(255, 255, 255, 0.92);
  --left-panel-btn-border: rgba(15, 23, 42, 0.14);
  --left-panel-btn-color: #111827;
  --left-panel-btn-shadow: 0 12px 28px rgba(15, 23, 42, 0.16);
  --left-panel-section-gap: 18px;

  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--left-panel-section-gap);
  width: 100%;}

.left-panel-controls--modern {
  --left-panel-btn-size: 80px;
  --left-panel-btn-radius: 24px;
  --left-panel-btn-font: 34px;
  --left-panel-btn-bg: rgba(28, 38, 58, 0.78);
  --left-panel-btn-border: rgba(96, 164, 255, 0.24);
  --left-panel-btn-color: #e5f3ff;
  --left-panel-btn-shadow: 0 24px 44px rgba(8, 12, 22, 0.55);
  --left-panel-section-gap: 24px;
}

.left-panel-controls--collapsed {
  --left-panel-section-gap: 14px;
  gap: var(--left-panel-section-gap);
}
.left-panel-controls__collapsed {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: calc(var(--left-panel-section-gap) * 0.85);
  width: 100%;
}

.left-panel-controls__history {
  display: grid;
  grid-template-columns: repeat(2, var(--left-panel-btn-size));  
  justify-content: center;
  justify-items: center;
  column-gap: calc(var(--left-panel-section-gap) * 0.6);
  row-gap: calc(var(--left-panel-section-gap) * 0.6);
  width: 100%;
}

.left-panel-controls__grid {
  display: grid;
  grid-template-columns: repeat(2, var(--left-panel-btn-size));
  justify-content: center;
  justify-items: center;
  column-gap: calc(var(--left-panel-section-gap) * 0.75);
  row-gap: calc(var(--left-panel-section-gap) * 0.75);
  width: 100%;
}

.left-panel-controls__grid .ui-btn {
  width: var(--left-panel-btn-size);
}
.left-panel-controls__grid-item--full {
  grid-column: 1 / -1;
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
  width: var(--left-panel-btn-size);
  font-size: calc(var(--left-panel-btn-font) * 0.75);
}
.left-panel-controls--collapsed .left-panel-controls__collapse {
  width: calc(var(--left-panel-btn-size) * 0.7);
}

.left-panel-controls--modern .left-panel-controls__collapse {
  box-shadow: 0 18px 34px rgba(6, 11, 21, 0.52);
}
.left-panel-controls--modern.left-panel-controls--collapsed .left-panel-controls__collapse {
  width: calc(var(--left-panel-btn-size) * 0.6);
}

.left-panel-controls--collapsed .ui-btn {
  box-shadow: 0 10px 18px rgba(15, 23, 42, 0.18);
}

.left-panel-controls--collapsed .theme-toggle {
  box-shadow: inset 0 2px 0 rgba(255,255,255,0.18), 0 18px 30px rgba(15, 23, 42, 0.18);
}
</style>
