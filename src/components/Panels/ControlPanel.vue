<script setup>
import { ref } from 'vue'
import { useCardsStore } from '../../stores/cards.js'
import { useHistoryStore } from '../../stores/history.js'

const props = defineProps({
  isModernTheme: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['toggle-theme'])
  
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
  <div :class="['left-panel-controls', { 'left-panel-controls--modern': props.isModernTheme }]">
    <button
      class="ui-btn theme-toggle"
      type="button"
      :title="props.isModernTheme ? 'Вернуться к классическому интерфейсу' : 'Включить новый интерфейс'"
      @click="emit('toggle-theme')"
    >
      <span class="theme-toggle__icon" aria-hidden="true"></span>
    </button>    <button class="ui-btn" title="Отменить (Ctrl+Z)" @click="handleUndo" :disabled="!historyStore.canUndo">↶</button>
    <button class="ui-btn" title="Повторить (Ctrl+Shift+Z)" @click="handleRedo" :disabled="!historyStore.canRedo">↷</button>

    <button class="ui-btn ui-panel-toggle" title="Свернуть панель" aria-expanded="true">❮</button>
    <button class="ui-btn" title="Сохранить проект (JSON)" @click="handleSaveProject">💾</button>
    <button class="ui-btn" title="Экспорт в HTML (просмотр)" @click="handleExportHTML">📄</button>
    <button class="ui-btn" title="Экспорт в SVG (вектор)" @click="handleExportSVG">🖋️</button>
    <button class="ui-btn" title="Печать / Экспорт в PDF" @click="handlePrint">🖨️</button>
    <button class="ui-btn" title="Загрузить проект из JSON" @click="handleLoadProject">📂</button>

    <button class="ui-btn" title="Список заметок" @click="handleNotesList" disabled>🗒️</button>
    <button class="ui-btn" title="Режим выделения (Esc)" @click="handleSelectionMode">⬚</button>
    <button class="ui-btn" title="Режим иерархии" @click="handleHierarchicalDragMode">🌳</button>
    <button class="ui-btn" title="Показать/скрыть направляющие" @click="handleToggleGuides">📐</button>
    <!-- <a class="ui-btn" title="Открыть инструкцию (DOCX)" href="Описание.docx" download="Инструкция по проекту.docx">📘</a> -->

    <input type="file" accept=".json,application/json" style="display:none">
  </div>
</template>

<style scoped>
.left-panel-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.left-panel-controls--modern {
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

.theme-toggle {
  position: relative;
  width: 48px;
  height: 48px;
  border-radius: 16px;
  border: none;
  background: linear-gradient(160deg, rgba(89, 208, 255, 0.18) 0%, rgba(89, 208, 255, 0.05) 100%);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.15);
  cursor: pointer;
  transition: transform .25s ease, box-shadow .25s ease, background .25s ease;
}

.theme-toggle:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 24px rgba(17, 203, 255, 0.35);
}

.left-panel-controls:not(.left-panel-controls--modern) .theme-toggle {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  background: linear-gradient(145deg, rgba(15,98,254,0.12), rgba(15,98,254,0.22));
}

.theme-toggle__icon {
  display: block;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  margin: 0 auto;
  position: relative;
  background: radial-gradient(circle at 30% 30%, #59d0ff 0%, #11cbff 45%, rgba(17,203,255,0.2) 70%, transparent 100%);
}

.left-panel-controls:not(.left-panel-controls--modern) .theme-toggle__icon {
  background: radial-gradient(circle at 30% 30%, #0f62fe 0%, rgba(15,98,254,0.55) 60%, transparent 100%);
}

.left-panel-controls--modern .ui-btn {
  width: 48px;
  height: 48px;
  border-radius: 16px;
  background: rgba(28, 38, 58, 0.75);
  color: #e5f3ff;
  border: 1px solid rgba(96, 164, 255, 0.18);
  box-shadow: inset 0 0 0 1px rgba(89, 208, 255, 0.12);
  transition: transform .18s ease, box-shadow .18s ease, background .18s ease;
}

.left-panel-controls--modern .ui-btn:hover {
  transform: translateX(4px);
  background: rgba(37, 51, 76, 0.95);
  box-shadow: 0 14px 28px rgba(13, 20, 34, 0.45);
}

.left-panel-controls--modern .ui-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.left-panel-controls--modern .ui-panel-toggle {
  display: none;
}  
</style>
