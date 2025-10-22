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

// Константы линий
const MIN_ANIMATION_SECONDS = 2
const MAX_ANIMATION_SECONDS = 999

const defaultLineColor = connectionsStore.defaultLineColor || '#0f62fe'
const defaultLineThickness = connectionsStore.defaultLineThickness || 5
const defaultAnimationSeconds = Math.min(
  Math.max(Math.round((connectionsStore.defaultAnimationDuration || (MIN_ANIMATION_SECONDS * 1000)) / 1000), MIN_ANIMATION_SECONDS),
  MAX_ANIMATION_SECONDS
)

function clampAnimationSeconds(value) {
  if (Number.isNaN(value)) {
    return MIN_ANIMATION_SECONDS
  }

  return Math.min(Math.max(value, MIN_ANIMATION_SECONDS), MAX_ANIMATION_SECONDS)
}
// Базовая реактивность
const isCollapsed = ref(false)

// Управление линиями
const lineColor = ref(defaultLineColor)
const thickness = ref(defaultLineThickness)
const isGlobalLineMode = ref(false) // применить ко всем линиям

// Управление анимацией
const animationDuration = ref(defaultAnimationSeconds) // в секундах

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
  const numericValue = Math.min(Math.max(Number(value), 1), 20)
  thickness.value = numericValue
  
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
  const clampedValue = Math.min(Math.max(val, min), max)
  const percent = ((clampedValue - min) / (max - min)) * 100
  return `linear-gradient(to right, ${lineColor.value} 0%, ${lineColor.value} ${percent}%, #e5e7eb ${percent}%, #e5e7eb 100%)`
}

// Управление анимацией
function updateAnimationDuration(value) {
  const seconds = clampAnimationSeconds(Number(value))
  const durationMs = seconds * 1000

  animationDuration.value = seconds

  if (isGlobalLineMode.value) {
    connectionsStore.updateAllConnections({ animationDuration: durationMs })
  }
  
    connectionsStore.setDefaultConnectionParameters(lineColor.value, thickness.value, durationMs)
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
function addCard() {
  // Эта функция вызывается кнопкой "Добавить лицензию" (маленькую)
  cardsStore.addCard({ 
    type: 'small',
    headerBg: headerColor.value,
    colorIndex: headerColorIndex.value
  });
}

function addLargeCard() {
  // Эта функция вызывается кнопкой "Добавить большую лицензию"
  cardsStore.addCard({ 
    type: 'large',
    headerBg: headerColor.value,
    colorIndex: headerColorIndex.value
  });
}

function addTemplate() {
  const templateCards = [
    { key: 'lena', x: 2240, y: -770, text: 'Елена', pv: '330/330pv', isLarge: true, showSlfBadge: false, showFendouBadge: false, rankBadge: null },
    { key: 'a', x: 1750, y: -420, text: 'A', pv: '30/330pv' },
    { key: 'c', x: 1470, y: -70, text: 'C', pv: '30/330pv' },
    { key: 'd', x: 2030, y: -70, text: 'D', pv: '30/330pv' },
    { key: 'b', x: 2870, y: -420, text: 'B', pv: '30/330pv' },
    { key: 'e', x: 2590, y: -70, text: 'E', pv: '30/330pv' },
    { key: 'f', x: 3150, y: -70, text: 'F', pv: '30/330pv' },
  ];

  const createdCardsMap = new Map();

  templateCards.forEach(cardDef => {
    const cardData = cardsStore.addCard({
      type: cardDef.isLarge ? 'large' : 'small',
      ...cardDef, // Передаем все свойства из шаблона (x, y, text, pv и т.д.)
      headerBg: headerColor.value,
      colorIndex: headerColorIndex.value,
    });
    createdCardsMap.set(cardDef.key, cardData);
  });

  const templateLines = [
    { startKey: 'b', startSide: 'right', endKey: 'f', endSide: 'top', thickness: 4 },
    { startKey: 'b', startSide: 'left',  endKey: 'e', endSide: 'top', thickness: 4 },
    { startKey: 'a', startSide: 'right', endKey: 'd', endSide: 'top', thickness: 4 },
    { startKey: 'a', startSide: 'left',  endKey: 'c', endSide: 'top', thickness: 4 },
    { startKey: 'lena', startSide: 'left',  endKey: 'a', endSide: 'top', thickness: 4 },
    { startKey: 'lena', startSide: 'right', endKey: 'b', endSide: 'top', thickness: 4 },
  ];

  templateLines.forEach(lineDef => {
    const startCard = createdCardsMap.get(lineDef.startKey);
    const endCard   = createdCardsMap.get(lineDef.endKey);
    if (!startCard || !endCard) return;

    connectionsStore.addConnection(startCard.id, endCard.id, {
      color: lineColor.value,
      thickness: lineDef.thickness,
      fromSide: lineDef.startSide,
      toSide: lineDef.endSide,
      animationDuration: animationDuration.value * 1000
    });
   });
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
  connectionsStore.setDefaultConnectionParameters(
    lineColor.value,
    thickness.value,
    animationDuration.value * 1000
  )  
  console.log('RightPanel mounted successfully');
})

// Следим за изменениями параметров линий и обновляем значения по умолчанию
watch([lineColor, thickness, animationDuration], ([newColor, newThickness, newDuration]) => {
  connectionsStore.setDefaultConnectionParameters(newColor, newThickness, newDuration * 1000)
})
</script>

<template>
  <div :class="['ui-panel-right', { collapsed: isCollapsed, 'ui-panel-right--modern': props.isModernTheme }]">    <div class="ui-panel-right__container">
      <button
        class="ui-btn panel-collapse-btn"
        :title="isCollapsed ? 'Развернуть настройки' : 'Свернуть настройки'"
        :aria-expanded="!isCollapsed"
        @click="togglePanel"
      >
        <span aria-hidden="true">{{ isCollapsed ? '❮' : '❯' }}</span>
      </button>
      <div class="ui-panel-right__body">
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
            <label for="thickness-slider">Толщина линии</label>
            <div class="thickness-row">
              <input
                type="range"
                id="thickness-slider"
                class="thickness-slider"
                min="1"
                max="20"
                step="1"
                :value="thickness"
                :style="{ background: sliderTrackStyle }"
                @input="updateThickness($event.target.value)"
              />
              <span id="thickness-value">{{ thickness }}px</span>
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

    <div class="ui-panel-right__actions row">  
      <button
        class="add-btn"
        title="Добавить лицензию"
        @click="addCard"
      >□</button>
      <button
        class="add-btn add-btn--large"
        title="Добавить большую лицензию"
        @click="addLargeCard"
      >⧠</button>
      <button
        class="add-btn"
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
  --right-panel-bg: #fff;
  --right-panel-text: var(--ink);
  --right-panel-shadow: 10px 12px 24px rgba(15,35,95,.16), -6px -6px 18px rgba(255,255,255,.85);
  --right-panel-btn-bg: #fff;
  --right-panel-btn-border: #e5e7eb;
  --right-panel-btn-color: var(--ink);
  --right-panel-btn-shadow: 0 2px 6px rgba(0,0,0,.06);
  --right-panel-btn-hover-bg: #fff;
  --right-panel-btn-hover-border: #d1d5db;
  --right-panel-btn-hover-shadow: 0 6px 14px rgba(0,0,0,.12);
  --right-panel-btn-active-bg: #eaf1ff;
  --right-panel-btn-active-border: #cfe0ff;
  --right-panel-btn-active-color: #0b5bd3;
  --right-panel-add-btn-bg: #fff;
  --right-panel-add-btn-color: var(--brand);
  --right-panel-add-btn-border: #e5e7eb;
  --right-panel-add-btn-shadow: var(--shadow);
  --right-panel-add-btn-hover-border: #cfe0ff;
  --right-panel-add-btn-hover-shadow: 0 10px 22px rgba(0,0,0,.14);
  --right-panel-muted: #7b849a;
  --right-panel-surface: rgba(255,255,255,.65);
  --right-panel-surface-shadow: inset 0 2px 6px rgba(175,188,210,.45);
  --right-panel-input-bg: #fff;
  --right-panel-input-border: rgba(167,178,204,.45);
  --right-panel-input-shadow: inset 0 -2px 0 rgba(255,255,255,.45);
  --right-panel-input-color: #111827;
  --right-panel-input-focus-outline: rgba(15,98,254,.25);
  --right-panel-input-focus-border: #0f62fe;
  --right-panel-unit-color: #9ca3af;
  --right-panel-apply-bg: rgba(255,255,255,.8);
  --right-panel-apply-border: rgba(167,178,204,.5);
  --right-panel-apply-color: #5d6b8a;
  --right-panel-apply-shadow: inset 0 -2px 0 rgba(255,255,255,.45), 0 6px 12px rgba(88,112,160,.18);
  --right-panel-apply-hover-bg: rgba(255,255,255,.92);
  --right-panel-apply-hover-border: #0f62fe;
  --right-panel-apply-hover-color: #0f62fe;
  --right-panel-apply-hover-shadow: inset 0 -2px 0 rgba(255,255,255,.65), 0 10px 18px rgba(15,98,254,.22);
  --right-panel-card-bg: rgba(15,98,254,.05);
  --right-panel-card-border: rgba(15,98,254,.12);
  --right-panel-card-label: #5d6b8a;
  --right-panel-card-btn-bg: #fff;
  --right-panel-card-btn-border: #d1d5db;
  --right-panel-card-btn-color: #4b5563;
  --right-panel-card-btn-shadow: inset 0 -2px 0 rgba(255,255,255,.55), 0 8px 16px rgba(88,112,160,.18);
  --right-panel-card-btn-hover-border: #0f62fe;
  --right-panel-card-btn-hover-color: #0f62fe;
  --right-panel-card-btn-hover-shadow: inset 0 -2px 0 rgba(255,255,255,.75), 0 10px 20px rgba(15,98,254,.25);
  --right-panel-gradient-bg: #fff;
  --right-panel-gradient-shadow: var(--shadow);
  --right-panel-grad-btn-border: #e5e7eb;
  --right-panel-grad-btn-shadow: 0 2px 6px rgba(0,0,0,.06);
  --right-panel-title-color: #374151;
  --right-panel-slider-track: #dbe3f4;
  --right-panel-section-shadow: 0 4px 10px rgba(0,0,0,.08);
}

.ui-panel-right--modern {
  --right-panel-bg: linear-gradient(165deg, rgba(18,28,48,.98) 0%, rgba(14,20,36,.95) 100%);
  --right-panel-text: #e5f3ff;
  --right-panel-shadow: 0 24px 48px rgba(6,12,21,.65);
  --right-panel-btn-bg: rgba(33,43,66,.88);
  --right-panel-btn-border: rgba(96,164,255,.35);
  --right-panel-btn-color: #e5f3ff;
  --right-panel-btn-shadow: 0 12px 26px rgba(5,10,20,.5);
  --right-panel-btn-hover-bg: rgba(44,58,88,.95);
  --right-panel-btn-hover-border: rgba(136,188,255,.6);
  --right-panel-btn-hover-shadow: 0 18px 34px rgba(4,9,18,.55);
  --right-panel-btn-active-bg: rgba(44,58,88,.96);
  --right-panel-btn-active-border: rgba(156,206,255,.65);
  --right-panel-btn-active-color: #66b7ff;
  --right-panel-add-btn-bg: rgba(33,43,66,.92);
  --right-panel-add-btn-color: #66b7ff;
  --right-panel-add-btn-border: rgba(96,164,255,.35);
  --right-panel-add-btn-shadow: 0 20px 36px rgba(5,10,20,.55);
  --right-panel-add-btn-hover-border: rgba(156,206,255,.65);
  --right-panel-add-btn-hover-shadow: 0 28px 44px rgba(5,10,20,.6);
  --right-panel-muted: #93a8d6;
  --right-panel-surface: rgba(33,43,66,.8);
  --right-panel-surface-shadow: inset 0 2px 6px rgba(9,15,28,.55);
  --right-panel-input-bg: rgba(21,29,46,.9);
  --right-panel-input-border: rgba(96,164,255,.35);
  --right-panel-input-shadow: inset 0 -2px 0 rgba(255,255,255,.08);
  --right-panel-input-color: #e5f3ff;
  --right-panel-input-focus-outline: rgba(102,170,255,.35);
  --right-panel-input-focus-border: rgba(136,188,255,.65);
  --right-panel-unit-color: #b5c9f0;
  --right-panel-apply-bg: rgba(33,43,66,.88);
  --right-panel-apply-border: rgba(96,164,255,.35);
  --right-panel-apply-color: #cfe4ff;
  --right-panel-apply-shadow: inset 0 -2px 0 rgba(255,255,255,.12), 0 12px 24px rgba(5,10,20,.5);
  --right-panel-apply-hover-bg: rgba(44,58,88,.96);
  --right-panel-apply-hover-border: rgba(136,188,255,.65);
  --right-panel-apply-hover-color: #66b7ff;
  --right-panel-apply-hover-shadow: inset 0 -2px 0 rgba(255,255,255,.18), 0 18px 30px rgba(5,10,20,.55);
  --right-panel-card-bg: rgba(33,43,66,.82);
  --right-panel-card-border: rgba(96,164,255,.25);
  --right-panel-card-label: #9db5e6;
  --right-panel-card-btn-bg: rgba(24,34,52,.9);
  --right-panel-card-btn-border: rgba(96,164,255,.35);
  --right-panel-card-btn-color: #dce9ff;
  --right-panel-card-btn-shadow: inset 0 -2px 0 rgba(255,255,255,.12), 0 12px 26px rgba(5,10,20,.5);
  --right-panel-card-btn-hover-border: rgba(156,206,255,.65);
  --right-panel-card-btn-hover-color: #66b7ff;
  --right-panel-card-btn-hover-shadow: inset 0 -2px 0 rgba(255,255,255,.18), 0 18px 32px rgba(5,10,20,.55);
  --right-panel-gradient-bg: rgba(33,43,66,.88);
  --right-panel-gradient-shadow: 0 18px 34px rgba(5,10,20,.5);
  --right-panel-grad-btn-border: rgba(96,164,255,.35);
  --right-panel-grad-btn-shadow: 0 12px 24px rgba(5,10,20,.45);
  --right-panel-title-color: #b5c9f0;
  --right-panel-slider-track: rgba(64,84,124,.9);
  --right-panel-section-shadow: 0 18px 34px rgba(5,10,20,.5);
}
.ui-panel-right__container {
  display: flex;
  align-items: stretch;
  gap: 0; /* Убираем зазор */
  /* Переносим тень на контейнер, чтобы она была общей */
  box-shadow: var(--right-panel-shadow);
  /* Скругляем углы контейнера, чтобы тень была правильной */
  border-radius: 12px;
}

.ui-panel-right__body {
  display: flex;
  flex-direction: column;
  gap: 18px;
  background: var(--right-panel-bg);
  color: var(--right-panel-text);
  padding: 20px 22px;
  /* Скругляем только правые углы */
  border-radius: 0 12px 12px 0;
  /* Убираем собственную тень, так как она теперь на контейнере */
  box-shadow: none;
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
  background: var(--right-panel-btn-bg);
  border: 1px solid var(--right-panel-btn-border);
  border-radius: 10px;
  font-size: 18px;
  cursor: pointer;
  box-shadow: var(--right-panel-btn-shadow);
  transition: transform .15s, box-shadow .15s, background-color .15s, border-color .15s;
  display: grid;
  place-items: center;
  color: var(--right-panel-btn-color);
}

.ui-btn:hover {
  transform: translateY(-1px);
  box-shadow: var(--right-panel-btn-hover-shadow);
  border-color: var(--right-panel-btn-hover-border);
  background: var(--right-panel-btn-hover-bg);
}

.ui-btn.active {
  background: var(--right-panel-btn-active-bg);
  border-color: var(--right-panel-btn-active-border);
  color: var(--right-panel-btn-active-color);
}

.ui-btn:disabled {
  opacity: .45;
  cursor: not-allowed;
}

/* Кнопки + и ▶ в едином стиле */
.add-btn {
  width: 56px;
  height: 56px;
  background: var(--right-panel-add-btn-bg);
  color: var(--right-panel-add-btn-color);
  border: 1px solid var(--right-panel-add-btn-border);
  border-radius: 12px;
  font-size: 28px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: var(--right-panel-add-btn-shadow);
  transition: transform .15s, box-shadow .15s, border-color .15s;
  display: grid;
  place-items: center;
}

.add-btn:hover {
  transform: translateY(-1px);
  box-shadow: var(--right-panel-add-btn-hover-shadow);
  border-color: var(--right-panel-add-btn-hover-border);
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
  /* Скругляем только левые углы */
  border-radius: 12px 0 0 12px;
  /* Убираем тень и правую рамку для слияния */
  box-shadow: none;
  border-right: none;
  /* Фон делаем таким же, как у панели */
  background: var(--right-panel-bg);
  /* Убеждаемся, что рамка слева такая же, как у всей панели */
  border: 1px solid var(--right-panel-btn-border);
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
  gap: 14px;
  padding: 16px;
  background: var(--right-panel-surface, #fff);
  border-radius: 18px;
  box-shadow: var(--right-panel-section-shadow, 0 4px 10px rgba(0, 0, 0, .08));
  color: var(--right-panel-text, #1f2937);
  border: 1px solid var(--right-panel-card-border, transparent);}

.line-color-group {
  display: flex;
  gap: 10px;
  align-items: center;
}

.line-color-trigger {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  border: 3px solid rgba(255, 255, 255, .85);
  box-shadow: inset 0 0 0 2px rgba(15, 98, 254, .25),
              0 8px 16px rgba(15, 98, 254, .18);
  cursor: pointer;
  transition: all .2s;
}

.line-color-trigger:hover {
  transform: translateY(-2px);
  box-shadow: inset 0 0 0 2px rgba(15, 98, 254, .35),
              0 10px 20px rgba(15, 98, 254, .25);
}

.apply-all-btn {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  border: 1px solid var(--right-panel-apply-border, #d1d5db);
  background: var(--right-panel-apply-bg, #fff);
  color: var(--right-panel-apply-color, #6b7280);
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: all .2s;
  box-shadow: var(--right-panel-apply-shadow, inset 0 -2px 0 rgba(255,255,255,.45));
}

.apply-all-btn:hover {
  background: var(--right-panel-apply-hover-bg, #f9fafb);
  border-color: var(--right-panel-apply-hover-border, #0f62fe);
  color: var(--right-panel-apply-hover-color, #0f62fe);
  box-shadow: var(--right-panel-apply-hover-shadow, inset 0 -2px 0 rgba(255,255,255,.65));
}

.apply-all-btn.active {
  background: var(--right-panel-btn-active-bg, #eaf1ff);
  border-color: var(--right-panel-btn-active-border, #0f62fe);
  color: var(--right-panel-btn-active-color, #0f62fe);
}

.line-controls-col {
  display: flex;
  flex-direction: column;
  gap: 10px;
  color: var(--right-panel-text, #1f2937);
}
.line-controls-col label {
  font-size: 13px;
  font-weight: 600;
}

.thickness-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 14px;
  background: var(--right-panel-surface, #f3f4f6);
  box-shadow: var(--right-panel-surface-shadow, inset 0 -1px 0 rgba(255, 255, 255, .8));
}

.thickness-slider {
  width: 100%;
  height: 8px;
  border-radius: 6px;
  background: linear-gradient(
    to right,
    #0f62fe 0%,
    #0f62fe 20%,
    #e5e7eb 20%,
    #e5e7eb 100%
  );
  outline: none;
  -webkit-appearance: none;
  appearance: none;
}

.thickness-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #fff;
  border: 3px solid #0f62fe;
  cursor: pointer;
  box-shadow: 0 4px 10px rgba(15, 98, 254, .28);
  transition: all .15s;
}

.thickness-slider::-webkit-slider-thumb:hover {
  transform: scale(1.08);
  box-shadow: 0 6px 14px rgba(15, 98, 254, .4);
}

.thickness-slider::-moz-range-thumb {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #fff;
  border: 3px solid #0f62fe;
  cursor: pointer;
  box-shadow: 0 4px 10px rgba(15, 98, 254, .28);
  transition: all .15s;
}

.thickness-slider::-moz-range-thumb:hover {
  transform: scale(1.08);
  box-shadow: 0 6px 14px rgba(15, 98, 254, .4);
}

#thickness-value {
  font-variant-numeric: tabular-nums;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 26px;
  height: 24px;
  margin-left: 8px;
  border-radius: 9px;
  background: var(--right-panel-apply-bg, rgba(255, 255, 255, .85));
  box-shadow: var(--right-panel-apply-shadow, inset 0 -2px 0 rgba(255, 255, 255, .45));
  color: var(--right-panel-text, #1f2937);
  border: 1px solid var(--right-panel-apply-border, transparent);
}

.animation-controls {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.animation-label {
  font-size: 13px;
  font-weight: 700;
  color: var(--right-panel-title-color, #374151);
}

.animation-block {
  display: flex;
  align-items: center;
  gap: 12px;
}

.animation-duration-wrapper {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
  color: var(--right-panel-muted, #6b7280);
}

.animation-duration-label {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.animation-input-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.animation-duration-input {
  width: 60px;
  height: 36px;
  padding: 4px 8px;
  border: 1px solid var(--right-panel-input-border, #d1d5db);
  border-radius: 8px;
  font-size: 14px;
  text-align: center;
  outline: none;
  background: var(--right-panel-input-bg, #fff);
  color: var(--right-panel-input-color, #111827);
  box-shadow: var(--right-panel-input-shadow, inset 0 -2px 0 rgba(255,255,255,.45));}

.animation-duration-input:focus {
  border-color: var(--right-panel-input-focus-border, #0f62fe);
  box-shadow: 0 0 0 3px var(--right-panel-input-focus-outline, rgba(15, 98, 254, .1));
}

.animation-unit {
  font-size: 13px;
  color: var(--right-panel-unit-color, #6b7280);
  font-weight: 500;
}

/* Фон */
.gradient-selector {
  display: grid;
  grid-template-columns: repeat(3, 45px);
  gap: 8px;
  background: var(--right-panel-gradient-bg);
  padding: 10px 12px;
  border-radius: 12px;
  box-shadow: var(--right-panel-gradient-shadow);
  justify-items: center;
  align-items: center;
}

.gradient-title {
  grid-column: 1/-1;
  font-size: 13px;
  font-weight: 700;
  margin-bottom: 2px;
  color: var(--right-panel-title-color);
}

.grad-btn {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  border: 1px solid var(--right-panel-grad-btn-border);
  cursor: pointer;
  box-shadow: var(--right-panel-grad-btn-shadow);
  transition: transform .15s;
  background: var(--right-panel-btn-bg);
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
  background: var(--right-panel-card-bg);
  border: 1px solid var(--right-panel-card-border);
}

.card-header-panel__label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--right-panel-card-label);
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
  border: 1px solid var(--right-panel-card-btn-border);
  background: var(--right-panel-card-btn-bg);
  color: var(--right-panel-card-btn-color);
  cursor: pointer;
  display: grid;
  place-items: center;
  font-size: 22px;
  line-height: 1;
  box-shadow: var(--right-panel-card-btn-shadow);
  transition: .2s;
}

.card-header-cycle-btn:hover {
  border-color: var(--right-panel-card-btn-hover-border);
  color: var(--right-panel-card-btn-hover-color);
  box-shadow: var(--right-panel-card-btn-hover-shadow);
}
</style>
