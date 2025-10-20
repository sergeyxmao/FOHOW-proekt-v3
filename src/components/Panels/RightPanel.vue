<script setup>
import { ref } from 'vue'
import { useCardsStore } from '@/stores/cards'
import { useConnectionsStore } from '@/stores/connections'

const connectionsStore = useConnectionsStore()
  isModernTheme: Boolean
})

const cardsStore = useCardsStore()
const connectionsStore = useConnectionsStore()

const isCollapsed = ref(false)
const headerColor = ref('#5D8BF4')
const headerColorIndex = ref(0)
const backgroundGradient = ref('#f5f7fb')
const lineThickness = ref(3)
const lineColor = ref('#0f62fe')

const hiddenHeaderColorPicker = ref(null)
const hiddenBackgroundPicker = ref(null)
const hiddenLineColorPicker = ref(null)

const headerColors = [
  '#5D8BF4', '#22C55E', '#EF4444', '#F59E0B', '#8B5CF6', '#EC4899', '#10B981', '#F97316'
]

function togglePanel() {
  isCollapsed.value = !isCollapsed.value
}

function cycleHeaderColor() {
  headerColorIndex.value = (headerColorIndex.value + 1) % headerColors.length
  headerColor.value = headerColors[headerColorIndex.value]
}

function openHeaderPicker() {
  hiddenHeaderColorPicker.value?.click()
}

function handleHeaderColorChange(e) {
  headerColor.value = e.target.value
}

function openBackgroundPicker() {
  hiddenBackgroundPicker.value?.click()
}

function handleBackgroundChange(e) {
  backgroundGradient.value = e.target.value
  updateBackground(e.target.value)
}

function updateBackground(gradient) {
  backgroundGradient.value = gradient
  const canvas = document.getElementById('canvas')
  if (canvas) {
    canvas.style.background = gradient
  }
}

function openLineColorPicker() {
  hiddenLineColorPicker.value?.click()
}

function handleLineColorChange(e) {
  lineColor.value = e.target.value
}

function applyLineSettingsToAll() {
  connectionsStore.connections.forEach(connection => {
    connection.color = lineColor.value
    connection.thickness = lineThickness.value
  })
}

function addCard(isLarge = false) {
  console.log('=== addCard called ===')
  console.log('isLarge =', isLarge)
  console.log('headerColor.value =', headerColor.value)
  console.log('headerColorIndex.value =', headerColorIndex.value)

  const newCard = {
    x: 100,
    y: 100,
    width: isLarge ? 520 : 380,
    height: isLarge ? 400 : 280,
    headerBg: headerColor.value,
    text: isLarge ? 'Большая лицензия' : 'Новая лицензия',
    fill: '#ffffff',
    stroke: '#000000',
    strokeWidth: 2,
    colorIndex: headerColorIndex.value
  }

  console.log('Creating card object:', newCard)
  console.log('Calling cardsStore.addCard...')
  
  const createdCard = cardsStore.addCard(newCard)
  
  console.log('Card created successfully:', createdCard)
  console.log('Total cards in store after adding:', cardsStore.cards.length)
  console.log('=== addCard finished ===')
  
  return createdCard
}

function addLargeCard() {
  addCard(true)
}

function addTemplate() {
  console.log('=== addTemplate called ===')
  console.log('Creating template cards...')
  
  const templateCards = [
    { id: 'lena', title: 'Лена', x: 100, y: 100, width: 380, height: 280, headerColor: '#5D8BF4' },
    { id: 'mikhail', title: 'Михаил', x: 550, y: 100, width: 380, height: 280, headerColor: '#22C55E' },
    { id: 'katya', title: 'Катя', x: 1000, y: 100, width: 380, height: 280, headerColor: '#EF4444' },
    { id: 'ivan', title: 'Иван', x: 100, y: 450, width: 380, height: 280, headerColor: '#F59E0B' },
    { id: 'olga', title: 'Ольга', x: 550, y: 450, width: 380, height: 280, headerColor: '#8B5CF6' },
    { id: 'sergey', title: 'Сергей', x: 1000, y: 450, width: 380, height: 280, headerColor: '#EC4899' },
    { id: 'maria', title: 'Мария', x: 550, y: 800, width: 380, height: 280, headerColor: '#10B981' }
  ]

  console.log('Template cards definition:', templateCards)
  
  const createdCardsIds = []

  templateCards.forEach(card => {
    console.log('Creating template card:', card.id)
    const newCard = cardsStore.addCard({
      x: card.x,
      y: card.y,
      text: card.title,
      width: card.width,
      height: card.height,
      headerBg: card.headerColor,
      fill: '#ffffff',
      stroke: '#000000',
      strokeWidth: 2
    })
    createdCardsIds.push({ key: card.id, id: newCard.id })
  })

  console.log('All template cards created. Total cards in store:', cardsStore.cards.length)
  console.log('Creating template connections...')

  const templateLines = [
    { from: 'lena', to: 'mikhail' },
    { from: 'lena', to: 'katya' },
    { from: 'mikhail', to: 'maria' },
    { from: 'katya', to: 'maria' },
    { from: 'ivan', to: 'maria' },
    { from: 'olga', to: 'maria' },
    { from: 'sergey', to: 'maria' }
  ]

  console.log('Template lines definition:', templateLines)

  templateLines.forEach(line => {
    const fromCard = createdCardsIds.find(c => c.key === line.from)
    const toCard = createdCardsIds.find(c => c.key === line.to)
    
    if (fromCard && toCard) {
      console.log('Creating connection from', line.from, 'to', line.to)
      connectionsStore.addConnection(fromCard.id, toCard.id, {
        color: lineColor.value,
        thickness: lineThickness.value
      })
    }
  })

  console.log('Total connections after template creation:', connectionsStore.connections.length)
  console.log('=== addTemplate finished ===')
}
</script>

<template>
  <div :class="['ui-panel-right', { 'collapsed': isCollapsed }]">
    <div class="ui-panel-right__container">
      <div v-if="!isCollapsed" class="ui-panel-right__body">
        <div class="header-color-selector">
          <div class="header-color-title">Цвет заголовка</div>
          <div class="header-color-controls">
            <button 
              class="header-color-preview" 
              :style="{ backgroundColor: headerColor }"
              title="Выбрать цвет заголовка"
              @click="openHeaderPicker"
            ></button>
            <button
              class="header-color-cycle"
              title="Сменить цвет заголовка"
              @click="cycleHeaderColor"
            >
              ⟳
            </button>
          </div>
          <input
            ref="hiddenHeaderColorPicker"
            type="color" 
            :value="headerColor" 
            style="display:none;"
            @input="handleHeaderColorChange"
          >
        </div>

        <div class="gradient-selector">
          <div class="gradient-title">Фон</div>
          <button 
            class="grad-btn" 
            data-gradient="#f5f7fb" 
            title="Светлый"
            :style="{ backgroundColor: '#f5f7fb' }"
            @click="updateBackground('#f5f7fb')"
          ></button>
          <button 
            class="grad-btn" 
            data-gradient="linear-gradient(135deg,#eef1f5,#dde3ea)" 
            title="Серый"
            :style="{ background: 'linear-gradient(135deg,#eef1f5,#dde3ea)' }"
            @click="updateBackground('linear-gradient(135deg,#eef1f5,#dde3ea)')"
          ></button>
          <button 
            class="grad-btn" 
            title="Выбрать цвет"
            @click="openBackgroundPicker"
          >🎨</button>
          <input 
            ref="hiddenBackgroundPicker"
            type="color" 
            :value="backgroundGradient" 
            style="display:none;"
            @input="handleBackgroundChange"
          >
        </div>

        <div class="line-controls-panel">
          <div class="line-color-group">
            <button 
              class="line-color-trigger"
              :style="{ backgroundColor: lineColor }"
              title="Цвет линии"
              @click="openLineColorPicker"
            ></button>
            <div class="line-controls-col">
              <label>
                Толщина
                <span>{{ lineThickness }}px</span>
              </label>
              <div class="thickness-row">
                <input 
                  type="range" 
                  min="1" 
                  max="10" 
                  v-model.number="lineThickness"
                  style="flex:1;"
                >
              </div>
            </div>
            <button 
              class="apply-all-btn"
              title="Применить ко всем линиям"
              @click="applyLineSettingsToAll"
            >✓</button>
          </div>
          <input
            ref="hiddenLineColorPicker"
            type="color"
            :value="lineColor"
            style="display:none;"
            @input="handleLineColorChange"
          >
        </div>
      </div>
      
      <button
        v-if="!props.isModernTheme"
        class="ui-btn panel-collapse-btn"
        :title="isCollapsed ? 'Развернуть настройки' : 'Свернуть настройки'"
        :aria-expanded="!isCollapsed"
        @click="togglePanel"
      >
        <span aria-hidden="true">{{ isCollapsed ? '❮' : '❯' }}</span>
      </button>
    </div>

    <div class="ui-panel-right__actions">
      <template v-if="props.isModernTheme">
        <button
          class="ui-btn panel-collapse-btn panel-collapse-btn--modern"
          :title="isCollapsed ? 'Развернуть настройки' : 'Свернуть настройки'"
          :aria-expanded="!isCollapsed"
          @click="togglePanel"
        >
          <span aria-hidden="true">{{ isCollapsed ? '❮' : '❯' }}</span>
        </button>
      </template>      
      <button
        class="add-btn"
        :class="{ 'add-btn--modern': props.isModernTheme }"
        title="Добавить лицензию"
        @click="addCard"
      >□</button>
      <button
        class="add-btn add-btn--large"
        :class="{ 'add-btn--modern': props.isModernTheme }"
        title="Добавить большую лицензию"
        @click="addLargeCard"
      >⧠</button>
      <button
        class="add-btn"
        :class="{ 'add-btn--modern': props.isModernTheme }"
        title="Добавить шаблон"
        @click="addTemplate"
      >⧉</button>
    </div>
  </div>
</template>

<style scoped>
/* Правая панель */
.ui-panel-right {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 2000;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 14px;
}

.ui-panel-right__container {
  display: flex;
  align-items: stretch;
  gap: 0px;
}

.ui-panel-right__body {
  display: flex;
  flex-direction: column;
  gap: 18px;
  background: #fff;
  padding: 20px 22px;
  border-radius: 22px;
  box-shadow: 10px 12px 24px rgba(15,35,95,.16), -6px -6px 18px rgba(255,255,255,.85);
  min-width: 240px;
}

.ui-panel-right__actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: flex-end;
}

.ui-panel-right.collapsed .ui-panel-right__body {
  display: none;
}

.ui-panel-right.collapsed .ui-panel-right__container {
  gap: 0;
}

.ui-panel-right .row {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.ui-btn {
  min-width: 40px;
  height: 40px;
  padding: 0 10px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  font-size: 18px;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0,0,0,.06);
  transition: transform .15s, box-shadow .15s, background-color .15s, border-color .15s;
  display: grid;
  place-items: center;
  color: var(--ink);
}

.ui-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 14px rgba(0,0,0,.12);
  border-color: #d1d5db;
}

.ui-btn.active {
  background: #eaf1ff;
  border-color: #cfe0ff;
  color: #0b5bd3;
}

.ui-btn:disabled {
  opacity: .45;
  cursor: not-allowed;
}

/* Кнопки + и ▶ в едином стиле */
.add-btn {
  width: 56px;
  height: 56px;
  background: #fff;
  color: var(--brand);
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  font-size: 28px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: var(--shadow);
  transition: transform .15s, box-shadow .15s, border-color .15s;
  display: grid;
  place-items: center;
}

.add-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 10px 22px rgba(0,0,0,.14);
  border-color: #cfe0ff;
}

.add-btn--triangle {
  color: #111;
  font-size: 24px;
}

.add-btn--large {
  font-size: 32px;
  font-weight: 500;
  line-height: 1;
  padding-bottom: 4px;
}

/* Обновленная панель управления линиями */
.panel-collapse-btn {
  font-size: 18px;
  width: 40px;
  height: 40px;
  padding: 0;
  border-radius: 12px 0 0 12px;
  box-shadow: 0 6px 14px rgba(0,0,0,.1);
}

.panel-collapse-btn--modern {
  border-radius: 12px;
  align-self: flex-end;
}

.panel-collapse-btn--floating {
  display: grid;
  place-items: center;
}
  
.ui-panel-right.collapsed .panel-collapse-btn {
  align-self: flex-end;
}

.line-controls-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: stretch;
}

.line-color-group {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.line-color-trigger {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  background-color: var(--brand);
  box-shadow: inset 0 0 0 4px rgba(255,255,255,.65), 0 8px 16px rgba(15,98,254,.28);
  transition: transform .15s, box-shadow .15s;
}

.line-color-trigger:hover {
  transform: translateY(-1px) scale(1.04);
  box-shadow: inset 0 0 0 4px rgba(255,255,255,.75), 0 10px 20px rgba(15,98,254,.32);
}

.line-controls-col {
  text-align: left;
}

.line-controls-col label {
  font-size: 11px;
  font-weight: 600;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #7b849a;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.thickness-row {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 10px;
  border-radius: 14px;
  background: rgba(255,255,255,.65);
  box-shadow: inset 0 2px 6px rgba(175,188,210,.45);
}

.apply-all-btn {
  width: 46px;
  height: 46px;
  padding: 0;
  border-radius: 14px;
  background: rgba(255,255,255,.8);
  border: 1px solid rgba(167,178,204,.5);
  color: #5d6b8a;
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: .2s;
  box-shadow: inset 0 -2px 0 rgba(255,255,255,.45), 0 6px 12px rgba(88,112,160,.18);
}

.apply-all-btn:hover {
  border-color: #0f62fe;
  color: #0f62fe;
  box-shadow: inset 0 -2px 0 rgba(255,255,255,.65), 0 10px 18px rgba(88,112,160,.26);
}

/* Селектор цвета заголовка */
.header-color-selector {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.header-color-title {
  font-size: 11px;
  font-weight: 600;
  color: #7b849a;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.header-color-controls {
  display: flex;
  gap: 12px;
  align-items: center;
}

.header-color-preview {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  box-shadow: inset 0 0 0 4px rgba(255,255,255,.65), 0 8px 16px rgba(0,0,0,.15);
  transition: transform .15s, box-shadow .15s;
}

.header-color-preview:hover {
  transform: translateY(-1px) scale(1.04);
  box-shadow: inset 0 0 0 4px rgba(255,255,255,.75), 0 10px 20px rgba(0,0,0,.2);
}

.header-color-cycle {
  width: 46px;
  height: 46px;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  background: #fff;
  color: #5d6b8a;
  font-size: 20px;
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: .2s;
  box-shadow: 0 4px 8px rgba(0,0,0,.08);
}

.header-color-cycle:hover {
  border-color: #0f62fe;
  color: #0f62fe;
  transform: rotate(90deg);
}

/* Селектор градиента фона */
.gradient-selector {
  display: flex;
  gap: 10px;
  align-items: center;
}

.gradient-title {
  font-size: 11px;
  font-weight: 600;
  color: #7b849a;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  min-width: 50px;
}

.grad-btn {
  width: 46px;
  height: 46px;
  border: 2px solid #e5e7eb;
  border-radius: 12px;
  cursor: pointer;
  transition: transform .15s, border-color .15s, box-shadow .15s;
  box-shadow: 0 4px 8px rgba(0,0,0,.08);
  font-size: 20px;
  display: grid;
  place-items: center;
}

.grad-btn:hover {
  transform: translateY(-2px);
  border-color: #0f62fe;
  box-shadow: 0 8px 16px rgba(0,0,0,.12);
}

/* Стили для модерного интерфейса */
.add-btn--modern {
  background: linear-gradient(145deg, #ffffff, #f0f4f8);
  box-shadow: 0 10px 24px rgba(15,98,254,.18);
}

.add-btn--modern:hover {
  background: linear-gradient(145deg, #f0f4f8, #e1e8f0);
  box-shadow: 0 14px 32px rgba(15,98,254,.24);
}

.panel-collapse-btn--modern {
  background: linear-gradient(145deg, #ffffff, #f0f4f8);
  box-shadow: 0 8px 18px rgba(0,0,0,.12);
}
</style>
