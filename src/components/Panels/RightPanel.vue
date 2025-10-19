<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useCardsStore } from '../../stores/cards'
import { useCanvasStore } from '../../stores/canvas'
import { useConnectionsStore } from '../../stores/connections'
import { HEADER_COLORS, getHeaderColorRgb } from '../../utils/constants'

const props = defineProps({
  isModernTheme: {
    type: Boolean,
    default: false
  }
})

  
// Stores
const cardsStore = useCardsStore()
const canvasStore = useCanvasStore()
const connectionsStore = useConnectionsStore()

// Базовая реактивность
const isCollapsed = ref(false)

// Управление линиями
const lineColor = ref('#0f62fe') // DEFAULT_LINE_COLOR
const thickness = ref(5)
const isGlobalLineMode = ref(false) // применить ко всем линиям

// Управление анимацией
const animationDuration = ref(2) // в секундах

// Управление цветом заголовка
const headerColor = ref('#5D8BF4')
const headerColorIndex = ref(0)

// Управление фоном
const backgroundGradient = ref('#f5f7fb')

// Ссылки на DOM элементы
const hiddenLineColorPicker = ref(null)
const hiddenHeaderColorPicker = ref(null)
const hiddenBackgroundPicker = ref(null)

// Методы для управления панелью
function togglePanel() {
  isCollapsed.value = !isCollapsed.value
}

// Управление линиями
function updateLineColor(color) {
  lineColor.value = color
  
  if (isGlobalLineMode.value) {
    // Применяем ко всем линиям
    connectionsStore.updateAllConnectionsColor(color)
  } else {
    // Применяем только к выделенным линиям (если есть)
    // TODO: Добавить логику для выделенных линий
  }
}

function updateThickness(value) {
  thickness.value = Number(value)
  
  if (isGlobalLineMode.value) {
    // Применяем ко всем линиям
    connectionsStore.updateAllConnectionsThickness(thickness.value)
  } else {
    // Применяем только к выделенным линиям (если есть)
    // TODO: Добавить логику для выделенных линий
  }
}

function toggleGlobalLineMode() {
  isGlobalLineMode.value = !isGlobalLineMode.value
}

function updateSliderTrack(val) {
  const min = 1
  const max = 20
  const percent = Math.round(((val - min) / (max - min)) * 100)
  return `linear-gradient(90deg, ${lineColor.value} 0%, ${lineColor.value} ${percent}%, #e5e7eb ${percent}%)`
}

// Управление анимацией
function updateAnimationDuration(value) {
  const seconds = Number(value)
  if (seconds >= 2 && seconds <= 999) {
    animationDuration.value = seconds
  }
}

// Управление цветом заголовка
function updateHeaderColor(color) {
  headerColor.value = color
  
  // Находим индекс цвета в палитре
  const colorIndex = HEADER_COLORS.findIndex(c => c.rgb === color)
  if (colorIndex !== -1) {
    headerColorIndex.value = colorIndex
  } else {
    headerColorIndex.value = -1 // Пользовательский цвет
  }
  
  // Применяем к выделенным карточкам
  const selectedCards = cardsStore.selectedCards
  if (selectedCards.length > 0) {
    const cardIds = selectedCards.map(card => card.id)
    cardsStore.updateCardHeaderColor(cardIds, headerColorIndex.value)
  }
}

function cycleHeaderColor() {
  // Вычисляем следующий индекс цвета
  const nextIndex = headerColorIndex.value >= 0 
    ? (headerColorIndex.value + 1) % HEADER_COLORS.length 
    : 0
  
  headerColorIndex.value = nextIndex
  headerColor.value = getHeaderColorRgb(nextIndex)
  
  // Применяем к выделенным карточкам
  const selectedCards = cardsStore.selectedCards
  if (selectedCards.length > 0) {
    const cardIds = selectedCards.map(card => card.id)
    cardsStore.updateCardHeaderColor(cardIds, nextIndex)
  }
}

// Управление фоном
function updateBackground(gradient) {
  backgroundGradient.value = gradient
  canvasStore.setBackgroundGradient(gradient)
}

// Добавление карточек
function addCard(isLarge = false) {
  console.log('=== addCard called ===');
  console.log('isLarge =', isLarge);
  console.log('headerColor.value =', headerColor.value);
  console.log('headerColorIndex.value =', headerColorIndex.value);
  
  const newCard = {
    x: 100,
    y: 100,
    text: 'RUY1234567890',
    width: isLarge ? 494 : 380,
    height: 280,
    fill: '#ffffff',
    stroke: '#000000',
    strokeWidth: 2,
    headerBg: headerColor.value,
    colorIndex: headerColorIndex.value
  }
  
  console.log('Creating card object:', newCard);
  console.log('Calling cardsStore.addCard...');
  const createdCard = cardsStore.addCard(newCard);
  console.log('Card created successfully:', createdCard);
  console.log('Total cards in store after adding:', cardsStore.cards.length);
  console.log('=== addCard finished ===');
}

function addLargeCard() {
  console.log('=== addLargeCard called ===');
  addCard(true)
  console.log('=== addLargeCard finished ===');
}

function addTemplate() {
  console.log('=== addTemplate called ===');
  console.log('Creating template cards...');
  
  const templateCards = [
    { 
      key: 'lena', 
      x: 2240, 
      y: -770, 
      text: 'Елена',
      pv: '330/330pv',
      balance: '0 / 0',
      activePv: '0 / 0',
      cycle: '0',
      coinFill: '#ffd700', 
      isLarge: true,
      showSlfBadge: false,
      showFendouBadge: false,
      rankBadge: null
    },
    { 
      key: 'a', 
      x: 1750, 
      y: -420, 
      text: 'A',
      pv: '30/330pv',
      balance: '0 / 0',
      activePv: '0 / 0',
      cycle: '0',
      coinFill: '#ffd700'
    },
    { 
      key: 'c', 
      x: 1470, 
      y: -70, 
      text: 'C',
      pv: '30/330pv',
      balance: '0 / 0',
      activePv: '0 / 0',
      cycle: '0',
      coinFill: '#ffd700'
    },
    { 
      key: 'd', 
      x: 2030, 
      y: -70, 
      text: 'D',
      pv: '30/330pv',
      balance: '0 / 0',
      activePv: '0 / 0',
      cycle: '0',
      coinFill: '#ffd700'
    },
    { 
      key: 'b', 
      x: 2870, 
      y: -420, 
      text: 'B',
      pv: '30/330pv',
      balance: '0 / 0',
      activePv: '0 / 0',
      cycle: '0',
      coinFill: '#ffd700'
    },
    { 
      key: 'e', 
      x: 2590, 
      y: -70, 
      text: 'E',
      pv: '30/330pv',
      balance: '0 / 0',
      activePv: '0 / 0',
      cycle: '0',
      coinFill: '#ffd700'
    },
    { 
      key: 'f', 
      x: 3150, 
      y: -70, 
      text: 'F',
      pv: '30/330pv',
      balance: '0 / 0',
      activePv: '0 / 0',
      cycle: '0',
      coinFill: '#ffd700'
    },
  ];

  console.log('Template cards definition:', templateCards);
  const createdCardsMap = new Map();

  templateCards.forEach(cardDef => {
    console.log('Creating template card:', cardDef.key);
    
    const cardData = cardsStore.addCard({
      x: cardDef.x,
      y: cardDef.y,
      text: cardDef.text,
      width: cardDef.isLarge ? 494 : 380,
      height: 280,
      headerBg: headerColor.value,
      colorIndex: headerColorIndex.value,
      pv: cardDef.pv,
      balance: cardDef.balance,
      activePv: cardDef.activePv,
      cycle: cardDef.cycle,
      coinFill: cardDef.coinFill,
      showSlfBadge: cardDef.showSlfBadge || false,
      showFendouBadge: cardDef.showFendouBadge || false,
      rankBadge: cardDef.rankBadge || null
    });
    
    createdCardsMap.set(cardDef.key, cardData);
    console.log('Template card created:', cardDef.key, cardData);
  });

  console.log('All template cards created. Total cards in store:', cardsStore.cards.length);
  console.log('Creating template connections...');

  const templateLines = [
    { startKey: 'b', startSide: 'right', endKey: 'f', endSide: 'top', thickness: 4 },
    { startKey: 'b', startSide: 'left',  endKey: 'e', endSide: 'top', thickness: 4 },
    { startKey: 'a', startSide: 'right', endKey: 'd', endSide: 'top', thickness: 4 },
    { startKey: 'a', startSide: 'left',  endKey: 'c', endSide: 'top', thickness: 4 },
    { startKey: 'lena', startSide: 'left',  endKey: 'a', endSide: 'top', thickness: 4 },
    { startKey: 'lena', startSide: 'right', endKey: 'b', endSide: 'top', thickness: 4 },
  ];

  console.log('Template lines definition:', templateLines);

  templateLines.forEach(lineDef => {
    const startCard = createdCardsMap.get(lineDef.startKey);
    const endCard   = createdCardsMap.get(lineDef.endKey);
    if (!startCard || !endCard) {
      console.log('Skipping connection - missing cards:', lineDef);
      return;
    }

    console.log('Creating connection:', lineDef);
    connectionsStore.addConnection(
      startCard.id,
      endCard.id,
      {
        color: lineColor.value,
        thickness: lineDef.thickness
      }
    );
  });
  
  console.log('Total connections after template creation:', connectionsStore.connections.length);
  console.log('=== addTemplate finished ===');
}

// Обработчики событий для DOM элементов
function handleLineColorChange(e) {
  updateLineColor(e.target.value)
}

function handleHeaderColorChange(e) {
  updateHeaderColor(e.target.value)
}

function handleBackgroundChange(e) {
  updateBackground(e.target.value)
}

function openLineColorPicker() {
  hiddenLineColorPicker.value?.click()
}

function openHeaderColorPicker() {
  hiddenHeaderColorPicker.value?.click()
}

function openBackgroundPicker() {
  hiddenBackgroundPicker.value?.click()
}

// Вычисляемые свойства
const sliderTrackStyle = computed(() => {
  return updateSliderTrack(thickness.value)
})

// Инициализация
onMounted(() => {
  // Устанавливаем начальные значения
  updateLineColor(lineColor.value)
  updateHeaderColor(headerColor.value)
  updateBackground(backgroundGradient.value)
  
  // Устанавливаем параметры по умолчанию для новых соединений
  connectionsStore.setDefaultConnectionParameters(lineColor.value, thickness.value)
  
  console.log('RightPanel mounted successfully');
})

// Следим за изменениями параметров линий и обновляем значения по умолчанию
watch([lineColor, thickness], ([newColor, newThickness]) => {
  connectionsStore.setDefaultConnectionParameters(newColor, newThickness)
})
</script>

<template>
  <div :class="['ui-panel-right', { collapsed: isCollapsed, 'ui-panel-right--modern': props.isModernTheme }]">
    <div :class="['ui-panel-right__container', { 'ui-panel-right__container--modern': props.isModernTheme }]">
      <template v-if="!(props.isModernTheme && isCollapsed)">
        <button
          class="ui-btn panel-collapse-btn"
          :class="{ 'panel-collapse-btn--modern': props.isModernTheme }"
          :title="isCollapsed ? 'Развернуть настройки' : 'Свернуть настройки'"
          :aria-expanded="!isCollapsed"
          @click="togglePanel"
        >
          <span aria-hidden="true">{{ isCollapsed ? '❮' : '❯' }}</span>
        </button>
      </template>
      <div :class="['ui-panel-right__body', { 'ui-panel-right__body--modern': props.isModernTheme }]">
        <div class="line-controls-panel">
          <div class="line-color-group">
            <div
              class="line-color-trigger" 
              :style="{ backgroundColor: lineColor }" 
              title="Выбрать цвет линии"
              @click="openLineColorPicker"
            ></div>
            <button 
              class="apply-all-btn" 
              title="Применить ко всем линиям"
              :class="{ active: isGlobalLineMode }"
              @click="toggleGlobalLineMode"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
            </button>
          </div>
          <input 
            ref="hiddenLineColorPicker"
            type="color" 
            :value="lineColor" 
            style="display:none;"
            @input="handleLineColorChange"
          >
          <div class="line-controls-col">
            <label for="thickness-slider">Толщина: <span>{{ thickness }}</span>px</label>
            <div class="thickness-row">
              <input 
                type="range" 
                id="thickness-slider" 
                class="thickness-slider" 
                min="1" 
                max="20" 
                :value="thickness"
                :style="{ background: sliderTrackStyle }"
                @input="updateThickness($event.target.value)"
              />
            </div>
          </div>
          <div class="animation-controls" aria-label="Настройки анимации">
            <span class="animation-label">Анимация</span>
            <div class="animation-block">
              <label class="animation-duration-wrapper" for="animation-duration-input">
                <span class="animation-duration-label">Продолжительность</span>
                <div class="animation-input-group">
                  <input 
                    type="number" 
                    id="animation-duration-input" 
                    class="animation-duration-input" 
                    min="2" 
                    max="999" 
                    step="1" 
                    :value="animationDuration"
                    @input="updateAnimationDuration($event.target.value)"
                    title="Продолжительность анимации в секундах" 
                    inputmode="numeric" 
                    maxlength="3"
                  />
                  <span class="animation-unit">сек</span>
                </div>
              </label>
            </div>
          </div>
        </div>

        <div class="card-header-panel" aria-label="Настройки заголовка лицензии">
          <span class="card-header-panel__label">Заголовок</span>
          <div class="card-header-panel__controls">
            <button
              class="card-header-color-btn"
              :class="{ 'card-header-color-btn--modern': props.isModernTheme }"
              type="button"
              title="Выбрать цвет заголовка"
              :style="{ backgroundColor: headerColor }"
              @click="openHeaderColorPicker"
            ></button>
            <button 
              class="card-header-cycle-btn" 
              type="button" 
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
      </div>
    </div>

    <div :class="['ui-panel-right__actions', 'row', { 'ui-panel-right__actions--modern': props.isModernTheme }]">
      <template v-if="props.isModernTheme && isCollapsed">
        <button
          class="ui-btn panel-collapse-btn panel-collapse-btn--modern panel-collapse-btn--floating"
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
  right: 0px;
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
  box-shadow: inset 0 -2px 0 rgba(255,255,255,.65), 0 10px 18px rgba(15,98,254,.22);
  background: rgba(255,255,255,.92);
}

.apply-all-btn.active {
  background: rgba(15,98,254,.12);
  border-color: #0f62fe;
  color: #0f62fe;
  box-shadow: inset 0 -2px 0 rgba(255,255,255,.75), 0 10px 20px rgba(15,98,254,.25);
}

.animation-controls {
  display: flex;
  flex-direction: column;
  gap: 10px;
  font-size: 12px;
  font-weight: 600;
  color: #6f7b96;
}

.animation-label {
  font-size: 13px;
  font-weight: 700;
  color: #414c67;
  text-align: left;
}

.animation-block {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.animation-duration-wrapper {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-weight: 600;
  color: #6b7280;
  flex: 1;
  position: relative;
}

.animation-duration-label {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0,0,0,0);
  white-space: nowrap;
  border: 0;
}

.animation-input-group {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  background: rgba(255,255,255,.75);
  border-radius: 14px;
  padding: 6px 8px;
  box-shadow: inset 0 2px 6px rgba(175,188,210,.35);
}

.animation-duration-input {
  width: calc(3ch + 12px);
  height: 42px;
  border-radius: 14px;
  border: 1px solid rgba(167,178,204,.45);
  font-size: 18px;
  font-weight: 600;
  color: #111827;
  text-align: center;
  background: #fff;
  box-shadow: inset 0 -2px 0 rgba(255,255,255,.45);
}

.animation-duration-input:focus {
  outline: 2px solid rgba(15,98,254,.25);
  outline-offset: 1px;
  border-color: #0f62fe;
}

.animation-unit {
  font-size: 12px;
  text-transform: lowercase;
  color: #9ca3af;
  margin-left: auto;
}

/* Слайдеры */
.thickness-slider {
  appearance: none;
  width: 100%;
  height: 8px;
  border-radius: 999px;
  background: #dbe3f4;
  outline: none;
  accent-color: var(--brand);
}

.thickness-slider::-webkit-slider-thumb {
  appearance: none;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--brand);
  box-shadow: 0 4px 10px rgba(15,98,254,.35);
  cursor: pointer;
  border: 3px solid #fff;
  transition: transform .15s, box-shadow .15s;
}

.thickness-slider::-webkit-slider-thumb:hover {
  transform: scale(1.08);
  box-shadow: 0 6px 14px rgba(15,98,254,.4);
}

.thickness-slider::-moz-range-thumb {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--brand);
  box-shadow: 0 4px 10px rgba(15,98,254,.35);
  border: 3px solid #fff;
  cursor: pointer;
  transition: transform .15s, box-shadow .15s;
}

.thickness-slider::-moz-range-thumb:hover {
  transform: scale(1.08);
  box-shadow: 0 6px 14px rgba(15,98,254,.4);
}

/* Фон */
.gradient-selector {
  display: grid;
  grid-template-columns: repeat(3, 45px);
  gap: 8px;
  background: #fff;
  padding: 10px 12px;
  border-radius: 12px;
  box-shadow: var(--shadow);
  justify-items: center;
  align-items: center;
}

.gradient-title {
  grid-column: 1/-1;
  font-size: 13px;
  font-weight: 700;
  margin-bottom: 2px;
  color: #374151;
}

.grad-btn {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  border: 1px solid #e5e7eb;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0,0,0,.06);
  transition: transform .15s;
  background: #fff;
}

.grad-btn:hover {
  transform: translateY(-1px);
}

/* Настройки заголовка */
.card-header-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
  border-radius: 18px;
  background: rgba(15,98,254,.05);
  border: 1px solid rgba(15,98,254,.12);
}

.card-header-panel__label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #5d6b8a;
}

.card-header-panel__controls {
  display: flex;
  gap: 12px;
  align-items: center;
}

.card-header-color-btn {
  width: 46px;
  height: 46px;
  border-radius: 14px;
  border: none;
  cursor: pointer;
  box-shadow: inset 0 0 0 4px rgba(255,255,255,.65), 0 8px 16px rgba(93,139,244,.28);
  transition: transform .15s, box-shadow .15s;
}

.card-header-color-btn:hover {
  transform: translateY(-1px) scale(1.04);
  box-shadow: inset 0 0 0 4px rgba(255,255,255,.75), 0 10px 20px rgba(93,139,244,.32);
}

.card-header-cycle-btn {
  width: 46px;
  height: 46px;
  border-radius: 14px;
  border: 1px solid #d1d5db;
  background: #fff;
  color: #4b5563;
  cursor: pointer;
  display: grid;
  place-items: center;
  font-size: 22px;
  line-height: 1;
  box-shadow: inset 0 -2px 0 rgba(255,255,255,.55), 0 8px 16px rgba(88,112,160,.18);
  transition: .2s;
}

.card-header-cycle-btn:hover {
  border-color: #0f62fe;
  color: #0f62fe;
  box-shadow: inset 0 -2px 0 rgba(255,255,255,.75), 0 10px 20px rgba(15,98,254,.25);
}

.ui-panel-right--modern {
  top: auto;
  bottom: 60px;
  right: 0px;
  align-items: flex-start;
  gap: 24px;
}

.ui-panel-right__container--modern {
  gap: 20px;
  align-items: center;
}

.panel-collapse-btn--modern {
  width: 58px;
  height: 58px;
  border-radius: 0px;
  background: rgba(27, 36, 52, 0.96);
  border: 1px solid rgba(90, 148, 240, 0.32);
  color: #ebf3ff;
  box-shadow: inset 0 0 0 1px rgba(126, 184, 255, 0.2);
}

.panel-collapse-btn--modern.panel-collapse-btn--floating {
  width: 46px;
  height: 46px;
  border-radius: 18px;
  background: rgba(24, 34, 52, 0.9);
  border: 1px solid rgba(94, 156, 244, 0.28);
  box-shadow: 0 20px 36px rgba(5, 10, 20, 0.45);
}
  
.ui-panel-right__body--modern {
  background: rgba(20, 28, 42, 0.95);
  border-radius: 28px;
  padding: 32px 34px;
  min-width: 320px;
  color: #f4f7fb;
  box-shadow: 0 28px 46px rgba(5, 9, 18, 0.55);
  border: 1px solid rgba(92, 154, 240, 0.24);
}

.ui-panel-right__body--modern .line-controls-panel {
  gap: 24px;
}

.ui-panel-right__body--modern .line-color-group {
  gap: 18px;
  justify-content: flex-start;
}

.ui-panel-right__body--modern .line-color-trigger {
  border-radius: 18px;
  box-shadow: 0 16px 28px rgba(9, 14, 24, 0.6);
  border: 1px solid rgba(99, 166, 255, 0.35);
}

.ui-panel-right__body--modern .line-color-trigger:hover {
  transform: translateY(-2px) scale(1.06);
}

.ui-panel-right__body--modern .apply-all-btn {
  background: rgba(33, 46, 66, 0.82);
  border: 1px solid rgba(114, 182, 255, 0.32);
  color: #e3f2ff;
  box-shadow: 0 20px 36px rgba(5, 10, 20, 0.45);
}

.ui-panel-right__body--modern .apply-all-btn:hover,
.panel-collapse-btn--modern:hover {
  transform: translateY(-3px);
  background: rgba(45, 62, 88, 0.95);
  border-color: rgba(140, 198, 255, 0.48);
  box-shadow: 0 26px 44px rgba(5, 9, 18, 0.6);
}

.ui-panel-right__body--modern .apply-all-btn.active {
  background: rgba(84, 158, 255, 0.18);
  border-color: rgba(140, 198, 255, 0.52);
  color: #8cd4ff;
}

.ui-panel-right__body--modern .line-controls-col label {
  font-size: 13px;
  letter-spacing: 0.04em;
  color: #d8e6ff;
}

.ui-panel-right__body--modern .thickness-row {
  background: rgba(30, 44, 68, 0.72);
  box-shadow: inset 0 0 0 1px rgba(74, 130, 208, 0.24);
}

.ui-panel-right__body--modern .thickness-slider {
  accent-color: #63caff;
}

.ui-panel-right__body--modern .animation-controls {
  color: #b2c4e6;
  gap: 18px;
}

.ui-panel-right__body--modern .animation-label {
  color: #9fb7de;
}

.ui-panel-right__body--modern .animation-block {
  background: rgba(28, 40, 62, 0.65);
  padding: 16px 18px;
  border-radius: 20px;
  box-shadow: inset 0 0 0 1px rgba(70, 124, 198, 0.2);
}

.ui-panel-right__body--modern .animation-input-group {
  background: transparent;
  box-shadow: none;
}

.ui-panel-right__body--modern .animation-duration-input {
  background: rgba(12, 18, 30, 0.88);
  border: 1px solid rgba(90, 150, 236, 0.36);
  color: #f4f9ff;
  box-shadow: inset 0 0 0 1px rgba(74, 130, 208, 0.2);
}

.ui-panel-right__body--modern .animation-duration-input:focus {
  outline: 2px solid rgba(89, 208, 255, 0.32);
  border-color: rgba(89, 208, 255, 0.5);
}

.ui-panel-right__body--modern .animation-unit {
  color: #8ea6cc;
}

.ui-panel-right__body--modern .gradient-selector {
  background: transparent;
  box-shadow: none;
  gap: 14px;
}

.ui-panel-right__body--modern .grad-btn {
  border: 1px solid rgba(110, 176, 255, 0.32);
  box-shadow: 0 18px 32px rgba(6, 11, 21, 0.45);
}

.ui-panel-right__body--modern .grad-btn:hover {
  transform: translateY(-2px);
}

.ui-panel-right__body--modern .gradient-title {
  color: #d1e0fb;
  letter-spacing: 0.08em;
}

.ui-panel-right__body--modern .card-header-panel {
  background: rgba(33, 44, 66, 0.6);
  border: 1px solid rgba(92, 154, 240, 0.28);
}

.card-header-color-btn--modern {
  box-shadow: 0 18px 32px rgba(9, 14, 24, 0.55);
  border: 1px solid rgba(120, 186, 255, 0.3);
}

.card-header-cycle-btn--modern {
  background: rgba(29, 40, 60, 0.92);
  border: 1px solid rgba(100, 164, 255, 0.35);
  color: #d7e6ff;
  box-shadow: 0 18px 32px rgba(6, 11, 21, 0.45);
}

.card-header-cycle-btn--modern:hover {
  border-color: rgba(148, 206, 255, 0.55);
  color: #8bd3ff;
}

.ui-panel-right__actions--modern {
  position: fixed;
  top: 34px;
  right: 44px;
  flex-direction: row;
  gap: 12px;
  align-items: center;
  z-index: 2050;
}

.add-btn--modern {
  width: 46px;
  height: 46px;
  border-radius: 16px;
  background: rgba(24, 34, 52, 0.9);
  border: 1px solid rgba(94, 156, 244, 0.28);
  color: #f3f8ff;
  box-shadow: 0 20px 36px rgba(5, 10, 20, 0.45);
}

.add-btn--modern:hover {
  transform: translateY(-4px);
  background: rgba(35, 48, 72, 0.95);
  box-shadow: 0 26px 44px rgba(4, 8, 16, 0.55);
}

.ui-panel-right--modern .row {
  justify-content: flex-start;
}

.ui-panel-right--modern.collapsed .ui-panel-right__container {
  display: none;
}
  
</style>
