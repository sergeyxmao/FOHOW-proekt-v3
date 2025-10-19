<script setup>
import { ref } from 'vue'
import { useCardsStore } from '../../stores/cards.js'
import { useHistoryStore } from '../../stores/history.js'

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
  <div class="left-panel-controls">
    <button class="ui-btn" title="Отменить (Ctrl+Z)" @click="handleUndo" :disabled="!historyStore.canUndo">↶</button>
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
</style>
