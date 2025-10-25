<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { storeToRefs } from 'pinia'

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
const { gridStep, isGridBackgroundVisible } = storeToRefs(canvasStore)

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
const backgroundGradient = ref('#b9c4da')

// Ссылки на DOM элементы
const hiddenLineColorPicker = ref(null)
const hiddenHeaderColorPicker = ref(null)
const hiddenBackgroundPicker = ref(null)

// Шаблоны для вставки
const templateMenuRef = ref(null)
const isTemplateMenuOpen = ref(false)

const templateModules = import.meta.glob('@/templates/*.json', {
  eager: true,
  import: 'default'
})

function buildTemplateLabel(fileName, templateData) {
  const baseName = fileName.replace(/\.json$/i, '')

  if (templateData && typeof templateData === 'object') {
    const title = templateData.meta?.title || templateData.title || templateData.name
    if (typeof title === 'string' && title.trim().length > 0) {
      return title.trim()
    }
  }

  return baseName
}

const templatesRegistry = Object.entries(templateModules).reduce((map, [path, templateData]) => {
  const fileName = path.split('/').pop()
  if (!fileName) {
    return map
  }

  const id = fileName.replace(/\.json$/i, '')
  map[id] = {
    id,
    label: buildTemplateLabel(fileName, templateData),
    fileName,
    data: templateData
  }  
  return map
}, {})

const templateOptions = computed(() =>
  Object.values(templatesRegistry)
    .sort((a, b) => a.label.localeCompare(b.label, 'ru'))
    .map(template => ({
      id: template.id,
      label: template.label,
      fileName: template.fileName,
      displayText: template.label
    }))
)

const GRID_STEP_MIN = 5
const GRID_STEP_MAX = 200
const gridStepModel = computed({
  get() {
    return gridStep.value
  },
  set(value) {
    const numericValue = Number(value)
    if (!Number.isFinite(numericValue)) {
      return
    }

    const clampedValue = Math.min(Math.max(Math.round(numericValue), GRID_STEP_MIN), GRID_STEP_MAX)
    canvasStore.setGridStep(clampedValue)
  }
})

function toggleGridBackgroundVisibility() {
  canvasStore.toggleGridBackground()
}  
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
    cardsStore.updateCardHeaderColor(cardIds, headerColorIndex.value, headerColor.value)
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
function addGoldCard() {
  cardsStore.addCard({
    type: 'gold'
  });
}

function closeTemplateMenu() {
  isTemplateMenuOpen.value = false
}

function toggleTemplateMenu() {
  isTemplateMenuOpen.value = !isTemplateMenuOpen.value
}

function selectTemplate(templateId) {
  const template = templatesRegistry[templateId]
  if (!template) {
    return
  }

  insertTemplate(template.data)
  closeTemplateMenu()
}

function insertTemplate(templateData) {
  if (!templateData || !Array.isArray(templateData.cards)) {
    return
  }

  const createdCardsMap = new Map()
  const createdCardIds = []

  templateData.cards.forEach(cardDef => {
    if (!cardDef) {
      return
    }

    const templateKey = cardDef.key || cardDef.id
    if (!templateKey) {
      return
    }

    const { key: _legacyKey, id: _legacyId, type = 'large', ...cardPayload } = cardDef
    const cardData = cardsStore.addCard({
      type,
      ...cardPayload,
      headerBg: headerColor.value,
      colorIndex: headerColorIndex.value
    })

    createdCardsMap.set(templateKey, cardData)
    createdCardIds.push(cardData.id)
  })

  const templateLines = Array.isArray(templateData.connections) ? templateData.connections : []


  templateLines.forEach(lineDef => {
    if (!lineDef) {
      return
    }

    const startKey = lineDef.startKey || lineDef.from || lineDef.sourceKey
    const endKey = lineDef.endKey || lineDef.to || lineDef.targetKey

    const startCard = startKey ? createdCardsMap.get(startKey) : null
    const endCard = endKey ? createdCardsMap.get(endKey) : null

    if (!startCard || !endCard) {
      return
    }

    const thicknessValue = Number.isFinite(lineDef.thickness)
      ? lineDef.thickness
      : Number.isFinite(lineDef.lineWidth)
        ? lineDef.lineWidth
        : thickness.value
		const animationMs = Number.isFinite(lineDef.animationDurationMs)
      ? lineDef.animationDurationMs
      : Number.isFinite(lineDef.animationDuration)
        ? lineDef.animationDuration
        : animationDuration.value * 1000
    
    connectionsStore.addConnection(startCard.id, endCard.id, {
      color: lineDef.color || lineDef.stroke || lineColor.value,
      thickness: thicknessValue,
      fromSide: lineDef.startSide || lineDef.fromSide || 'bottom',
      toSide: lineDef.endSide || lineDef.toSide || 'top',
      animationDuration: animationMs
    })
  })

  cardsStore.deselectAllCards()
  createdCardIds.forEach(id => cardsStore.selectCard(id))
}

function handleDocumentClick(event) {
  const menuEl = templateMenuRef.value
  if (!isTemplateMenuOpen.value || !menuEl) {
    return
  }

  if (!menuEl.contains(event.target)) {
    closeTemplateMenu()
  }
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

  document.addEventListener('click', handleDocumentClick)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleDocumentClick)  
})

// Следим за изменениями параметров линий и обновляем значения по умолчанию
watch([lineColor, thickness, animationDuration], ([newColor, newThickness, newDuration]) => {
  connectionsStore.setDefaultConnectionParameters(newColor, newThickness, newDuration * 1000)
})

watch(isCollapsed, (collapsed) => {
  if (collapsed) {
    closeTemplateMenu()
  }
})  
</script>

<template>
  <div
    :class="[
      'right-control-panel',
      {
        'right-control-panel--collapsed': isCollapsed,
        'right-control-panel--modern': props.isModernTheme
      }
    ]"
  >
    <div class="right-control-panel__shell">
      <button
        class="right-control-panel__collapse"
        type="button"
        :title="isCollapsed ? 'Развернуть настройки' : 'Свернуть настройки'"
        :aria-expanded="!isCollapsed"
        @click="togglePanel"
      >
        <span aria-hidden="true">{{ isCollapsed ? '❮' : '❯' }}</span>
      </button>

      <div v-if="!isCollapsed" class="right-control-panel__card">
        <div class="right-control-panel__top">
          <button
            class="line-color-button"
            type="button"
            :style="{ backgroundColor: lineColor }"
            title="Выбрать цвет линии"
            @click="openLineColorPicker"
          ></button>
          <button
            class="global-mode-button"
            type="button"
            :class="{ active: isGlobalLineMode }"
            title="Применить ко всем линиям"
            @click="toggleGlobalLineMode"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          </button>
        </div>

        <input
          ref="hiddenLineColorPicker"
          type="color"
          :value="lineColor"
          style="display: none"
          @input="handleLineColorChange"
        >

        <div class="control-section">
          <div class="control-section__header">
            <span class="control-section__title" id="thickness-slider-label">Толщина линии</span>
            <span class="control-section__value">{{ thickness }}px</span>
          </div>
          <div class="control-section__slider">
            <input
              id="thickness-slider"
              class="thickness-slider"
              type="range"
              min="1"
              max="20"
              step="1"
              :value="thickness"
              :style="{ background: sliderTrackStyle }"
              aria-labelledby="thickness-slider-label"
              @input="updateThickness($event.target.value)"
            />
          </div>
        </div>

        <div class="control-section">
          <span class="control-section__title">Анимация</span>
          <div class="animation-row" aria-label="Настройки анимации">
            <label class="animation-input" for="animation-duration-input">
              <input
                id="animation-duration-input"
                class="animation-duration-input"
                type="number"
                min="2"
                max="999"
                step="1"
                :value="animationDuration"
                title="Продолжительность анимации в секундах"
                inputmode="numeric"
                maxlength="3"
                @input="updateAnimationDuration($event.target.value)"
              />
              <span class="animation-unit">сек</span>
            </label>
            <button
              class="animation-infinity-btn"
              type="button"
              title="Бесконечная анимация"
              aria-label="Бесконечная анимация"
            >
              ∞
            </button>
          </div>
        </div>

        <div class="control-section control-section--accent">
          <span class="control-section__title control-section__title--accent">Заголовок</span>
          <div class="control-section__actions">
            <button
              class="header-color-button"
              type="button"
              :style="{ backgroundColor: headerColor }"
               title="Выбрать цвет заголовка"
             
              @click="openHeaderColorPicker"
            ></button>
            <button
              class="header-cycle-button"
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
            style="display: none"
            @input="handleHeaderColorChange"
          >
        </div>

        <div class="control-section control-section--accent">
          <span class="control-section__title control-section__title--accent">Фон</span>
          <div class="background-row">
            <button
              class="background-button"
              type="button"
              :style="{ backgroundColor: '#f5f7fb' }"
              title="Светлый фон"          
              @click="updateBackground('#f5f7fb')"
            ></button>

            <button
              class="background-button background-button--icon"
              type="button"
              title="Выбрать цвет"
              @click="openBackgroundPicker"
            >🎨</button>
          </div>
          <input 
            ref="hiddenBackgroundPicker"
            type="color"
            :value="backgroundGradient"
            style="display: none"
            @input="handleBackgroundChange"
          >
        </div>
        <div class="control-section">
          <span class="control-section__title">Сетка</span>
          <div class="grid-settings" aria-label="Настройки сетки">
            <label class="grid-settings__field" for="grid-step-input">
              <span class="grid-settings__label">Шаг</span>
              <input
                id="grid-step-input"
                class="grid-settings__input"
                type="number"
                min="5"
                :max="GRID_STEP_MAX"
                step="1"
                v-model.number="gridStepModel"
              >
              <span class="grid-settings__unit">px</span>
            </label>

            <button
              class="grid-settings__toggle"
              type="button"
              :class="{ active: isGridBackgroundVisible }"
              :aria-pressed="isGridBackgroundVisible"
              title="Показать или скрыть фон сетки"
              @click="toggleGridBackgroundVisibility"
            >
              ▦
            </button>
          </div>
        </div>

        <div class="control-section control-section--footer">
          <button class="add-card-btn" type="button" title="Добавить лицензию" @click="addCard">□</button>
          <button class="add-card-btn add-card-btn--large" type="button" title="Добавить большую лицензию" @click="addLargeCard">⧠</button>
           <button
            class="add-card-btn add-card-btn--large add-card-btn--gold"
            type="button"
            title="Добавить Goold лицензию"
            @click="addGoldCard"
          >★</button>         
            <div ref="templateMenuRef" class="template-menu">
            <button
              class="add-card-btn"
              type="button"
              title="Добавить шаблон"
              @click.stop="toggleTemplateMenu"
              :disabled="!templateOptions.length"
              aria-haspopup="true"
              :aria-expanded="isTemplateMenuOpen"
            >⧉</button>
            <div
              v-if="isTemplateMenuOpen && templateOptions.length"
              class="template-menu__list template-menu__list--drop-up"
              role="menu"
              aria-label="Выбор шаблона"
            >
              <button
                v-for="option in templateOptions"
                :key="option.id"
                class="template-menu__item"
                type="button"
                role="menuitem"
                @click.stop="selectTemplate(option.id)"
              >
                {{ option.displayText }}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div v-else class="right-control-panel__collapsed-actions">
        <button class="add-card-btn" type="button" title="Добавить лицензию" @click="addCard">□</button>
        <button class="add-card-btn add-card-btn--large" type="button" title="Добавить большую лицензию" @click="addLargeCard">⧠</button>
        <button
          class="add-card-btn add-card-btn--large add-card-btn--gold"
          type="button"
          title="Добавить Goold лицензию"
          @click="addGoldCard"
        >★</button>        
        <div ref="templateMenuRef" class="template-menu">
          <button
            class="add-card-btn"
            type="button"
            title="Добавить шаблон"
            @click.stop="toggleTemplateMenu"
            :disabled="!templateOptions.length"
            aria-haspopup="true"
            :aria-expanded="isTemplateMenuOpen"
          >⧉</button>
          <div
            v-if="isTemplateMenuOpen && templateOptions.length"
            class="template-menu__list"
            role="menu"
            aria-label="Выбор шаблона"
          >
            <button
              v-for="option in templateOptions"
              :key="option.id"
              class="template-menu__item"
              type="button"
              role="menuitem"
              @click.stop="selectTemplate(option.id)"
            >
              {{ option.displayText }}
            </button>
          </div>
        </div>
      </div>     
    </div>
  </div>
</template>

<style scoped>
.right-control-panel {
  position: fixed;
  top: 24px;
  right: 24px;
  z-index: 2000;
  display: flex;
  align-items: flex-end;
  max-height: calc(100vh - 48px);
  overflow: visible;
  --panel-bg: rgba(255, 255, 255, 0.6);
  --panel-border: rgba(15, 23, 42, 0.12);
  --panel-text: #17223b;
  --panel-shadow: 0 18px 36px rgba(16, 33, 67, 0.18);
  --panel-muted: rgba(23, 34, 59, 0.58);
  --panel-highlight: rgba(15, 98, 254, 0.14);
  --panel-button-bg: rgba(255, 255, 255, 0.68);
  --panel-button-border: rgba(15, 98, 254, 0.18);
  --panel-button-shadow: 0 14px 26px rgba(15, 98, 254, 0.2);
  --panel-button-hover-shadow: 0 20px 36px rgba(15, 98, 254, 0.28);
  --panel-button-color: #0f62fe;
  --panel-surface: rgba(255, 255, 255, 0.48);
  --panel-surface-border: rgba(15, 98, 254, 0.12);
  --panel-contrast: #0f62fe;
  --panel-card-btn-bg: rgba(255, 255, 255, 0.75);
  --panel-card-btn-border: rgba(15, 98, 254, 0.18);
  --panel-card-btn-shadow: 0 18px 30px rgba(15, 98, 254, 0.22);
  --panel-card-btn-hover-shadow: 0 26px 40px rgba(15, 98, 254, 0.28);
  --panel-card-btn-color: #1d3f8f;
  --panel-badge-bg: rgba(15, 98, 254, 0.1);
  --panel-badge-text: rgba(23, 34, 59, 0.75);
  color: var(--panel-text);
}

.right-control-panel--modern {
  --panel-bg: rgba(32, 44, 72, 0.88);
  --panel-border: rgba(114, 182, 255, 0.35);
  --panel-text: #e6f2ff;
  --panel-shadow: 0 28px 48px rgba(6, 12, 21, 0.62);
  --panel-muted: rgba(172, 198, 247, 0.78);
  --panel-highlight: rgba(102, 176, 255, 0.18);
  --panel-button-bg: rgba(44, 58, 88, 0.78);
  --panel-button-border: rgba(136, 188, 255, 0.4);
  --panel-button-shadow: 0 18px 34px rgba(5, 10, 20, 0.52);
  --panel-button-hover-shadow: 0 26px 42px rgba(5, 10, 20, 0.6);
  --panel-button-color: #73c8ff;
  --panel-surface: rgba(40, 56, 90, 0.8);
  --panel-surface-border: rgba(114, 182, 255, 0.28);
  --panel-contrast: #73c8ff;
  --panel-card-btn-bg: rgba(28, 38, 62, 0.8);
  --panel-card-btn-border: rgba(136, 188, 255, 0.42);
  --panel-card-btn-shadow: 0 20px 36px rgba(5, 10, 20, 0.58);
  --panel-card-btn-hover-shadow: 0 28px 46px rgba(5, 10, 20, 0.64);
  --panel-card-btn-color: #e8f5ff;
  --panel-badge-bg: rgba(255, 215, 64, 0.25);
  --panel-badge-text: rgba(229, 243, 255, 0.92);
}

.right-control-panel__shell {
  display: flex;
  align-items: stretch;
  gap: 0;
  max-height: 100%;

}

.right-control-panel__collapse {
  position: relative;
  width: 52px;
  min-height: 64px;
  padding: 0 14px;
  border-radius: 26px 0 0 26px;
  border: 1px solid var(--panel-border);
  border-right: none;
  background: var(--panel-bg);
  color: var(--panel-button-color);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: var(--panel-shadow);
  backdrop-filter: blur(22px);
  transition: transform 0.2s ease, box-shadow 0.2s ease, color 0.2s ease;
}

.right-control-panel__collapse:hover {
  transform: translateX(-2px);
  box-shadow: 0 22px 42px rgba(15, 98, 254, 0.25);
  color: var(--panel-contrast);
}

.right-control-panel--collapsed .right-control-panel__collapse {
  border-radius: 26px 0 0 26px;

}

.right-control-panel__collapsed-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 2px 18px;  background: var(--panel-bg);
  border: 1px solid var(--panel-border);
  border-left: none;
  border-radius: 0 26px 26px 0;
  box-shadow: var(--panel-shadow);
  backdrop-filter: blur(22px);
  margin-left: -1px;  
}

.right-control-panel__card {
  width: 268px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 22px 20px 18px;
  background: var(--panel-bg);
  border: 1px solid var(--panel-border);
  border-radius: 26px;
  border-left: none;
  border-radius: 0 26px 26px 0;  
  box-shadow: var(--panel-shadow);
  backdrop-filter: blur(28px);
  overflow: visible;
  padding-right: 28px;
  box-sizing: border-box;
  scrollbar-width: thin;
  scrollbar-color: var(--panel-button-color) rgba(15, 23, 42, 0.08);
  margin-left: -1px;
  
}

.right-control-panel__card::-webkit-scrollbar {
  width: 8px;
}

.right-control-panel__card::-webkit-scrollbar-track {
  background: rgba(15, 23, 42, 0.05);
  border-radius: 12px;
}

.right-control-panel__card::-webkit-scrollbar-thumb {
  background: var(--panel-button-color);
  border-radius: 12px;
  border: 2px solid rgba(255, 255, 255, 0.4);
}

.right-control-panel__card::-webkit-scrollbar-thumb:hover {
  background: var(--panel-contrast);  
}

.right-control-panel__top {
  display: flex;
  gap: 14px;
  align-items: center;
  padding: 18px;
  border-radius: 22px;
  background: var(--panel-surface);
  border: 1px solid var(--panel-surface-border);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.25);
}

.line-color-button {
  width: 56px;
  height: 56px;
  border-radius: 18px;
  border: 3px solid rgba(255, 255, 255, 0.7);
  box-shadow: inset 0 0 0 2px rgba(15, 98, 254, 0.22), 0 16px 28px rgba(15, 98, 254, 0.2);
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.line-color-button:hover {
  transform: translateY(-2px);
  box-shadow: inset 0 0 0 2px rgba(15, 98, 254, 0.32), 0 22px 34px rgba(15, 98, 254, 0.28);
}

.global-mode-button {
  width: 56px;
  height: 56px;
  border-radius: 18px;
  border: 1px solid var(--panel-button-border);
  background: var(--panel-button-bg);
  color: var(--panel-button-color);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease, background 0.2s ease;
  box-shadow: var(--panel-button-shadow);
}

.global-mode-button svg {
  stroke: currentColor;
}

.global-mode-button:hover {
  transform: translateY(-2px);
  box-shadow: var(--panel-button-hover-shadow);
  border-color: var(--panel-contrast);
}

.global-mode-button.active {
  background: var(--panel-contrast);
  color: #fff;
  border-color: var(--panel-contrast);
  box-shadow: 0 20px 36px rgba(15, 98, 254, 0.32);
}

.control-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  border-radius: 20px;
  background: var(--panel-surface);
  border: 1px solid var(--panel-surface-border);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.2);
}

.control-section__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;  
}

.control-section__title {

  font-weight: 600;
  font-size: 14px;
  color: var(--panel-text);
}

.control-section__title--accent {
  font-size: 12px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--panel-muted);
}

.control-section__value {
  padding: 4px 12px;
  border-radius: 12px;
  background: var(--panel-badge-bg);
  color: var(--panel-contrast);
  font-size: 13px;
  font-weight: 600;
}

.control-section__slider {

  padding: 12px 14px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid rgba(15, 98, 254, 0.12);
  box-shadow: inset 0 -2px 0 rgba(255, 255, 255, 0.45);
}

.thickness-slider {
  width: 100%;
  height: 10px;
  border-radius: 999px;
  background: linear-gradient(to right, #0f62fe 0%, #0f62fe 20%, rgba(203, 213, 225, 0.7) 20%, rgba(203, 213, 225, 0.7) 100%);
  outline: none;
  -webkit-appearance: none;
  appearance: none;
}

.thickness-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #fff;
  border: 4px solid #0f62fe;  cursor: pointer;
  box-shadow: 0 10px 18px rgba(15, 98, 254, 0.32);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.thickness-slider::-webkit-slider-thumb:hover {
  transform: scale(1.08);
  box-shadow: 0 16px 26px rgba(15, 98, 254, 0.4);}

.thickness-slider::-moz-range-thumb {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #fff;
  border: 4px solid #0f62fe;
  cursor: pointer;
  box-shadow: 0 10px 18px rgba(15, 98, 254, 0.32);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.thickness-slider::-moz-range-thumb:hover {
  transform: scale(1.08);
  box-shadow: 0 16px 26px rgba(15, 98, 254, 0.4);
}

.animation-row {

  display: flex;
  align-items: center;
  gap: 12px;
}

.animation-input {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: 16px;
  background: rgba(255, 200, 68, 0.2);
  border: 1px solid rgba(255, 200, 68, 0.34);
  box-shadow: inset 0 -2px 0 rgba(255, 255, 255, 0.45);
  color: var(--panel-text);
}

.animation-duration-input {
  width: 56px;
  border: none;
  background: transparent;
  font-size: 16px;
  font-weight: 600;
  text-align: right;
  color: inherit;
  outline: none;
  -moz-appearance: textfield;
}

.animation-duration-input::-webkit-outer-spin-button,
.animation-duration-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.animation-unit {
  font-size: 14px;
  font-weight: 600;
  text-transform: lowercase;
}

.animation-infinity-btn {
  width: 48px;
  height: 48px;
  border-radius: 16px;
  border: 1px solid var(--panel-button-border);
  background: var(--panel-highlight);
  color: var(--panel-button-color);
  display: flex;
  align-items: center;  justify-content: center;
  font-size: 22px;
  cursor: pointer;
  box-shadow: inset 0 -2px 0 rgba(255, 255, 255, 0.45);
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}

.animation-infinity-btn:hover {
  transform: translateY(-2px);
  border-color: var(--panel-contrast);
  box-shadow: 0 18px 28px rgba(15, 98, 254, 0.22);
}

.control-section__actions {

  display: flex;
  gap: 12px;
  align-items: center;
}

.header-color-button {
  width: 52px;
  height: 52px;
  border-radius: 18px;
  border: 3px solid rgba(255, 255, 255, 0.7);
  cursor: pointer;
  box-shadow: inset 0 0 0 3px rgba(255, 255, 255, 0.45), 0 18px 30px rgba(93, 139, 244, 0.24);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.header-color-button:hover {
  transform: translateY(-2px) scale(1.03);
  box-shadow: inset 0 0 0 3px rgba(255, 255, 255, 0.6), 0 24px 36px rgba(93, 139, 244, 0.3);
}

.header-cycle-button {
  width: 52px;
  height: 52px;
  border-radius: 18px;
  border: 1px solid var(--panel-card-btn-border);
  background: var(--panel-card-btn-bg);
  color: var(--panel-card-btn-color);
  font-size: 24px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: var(--panel-card-btn-shadow);
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease, color 0.2s ease;
}

.header-cycle-button:hover {
  transform: translateY(-2px);
  border-color: var(--panel-contrast);
  color: var(--panel-contrast);
  box-shadow: var(--panel-card-btn-hover-shadow, 0 24px 38px rgba(15, 98, 254, 0.28));  
}

.background-row {
  display: flex;
  gap: 12px;
}
.grid-settings {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
  border-radius: 18px;
  background: var(--panel-surface);
  border: 1px solid var(--panel-surface-border);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.18);
}

.grid-settings__field {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  color: var(--panel-muted);
}

.grid-settings__label {
  font-weight: 600;
  color: var(--panel-text);
}

.grid-settings__input {
  width: 72px;
  padding: 6px 10px;
  border-radius: 12px;
  border: 1px solid var(--panel-card-btn-border);
  background: var(--panel-button-bg);
  color: var(--panel-text);
  font-size: 14px;
  text-align: center;
  box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.12);
}

.grid-settings__unit {
  font-size: 12px;
  color: var(--panel-muted);
}


.grid-settings__toggle {
  align-self: flex-start;
  padding: 6px 14px;
  border-radius: 12px;
  border: 1px solid var(--panel-card-btn-border);
  background: var(--panel-button-bg);
  color: var(--panel-text);
  font-size: 16px;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease, color 0.2s ease;
  box-shadow: var(--panel-button-shadow);
}

.grid-settings__toggle.active,
.grid-settings__toggle:hover {
  transform: translateY(-1px);
  border-color: var(--panel-contrast);
  color: var(--panel-contrast);
}

.background-button {
  width: 48px;
  height: 48px;
  border-radius: 16px;
  border: 1px solid var(--panel-card-btn-border);
  box-shadow: var(--panel-card-btn-shadow);
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
  background-size: cover;
  background-position: center;
}

.background-button:hover {
  transform: translateY(-2px);
  border-color: var(--panel-contrast);
  box-shadow: var(--panel-card-btn-hover-shadow, 0 24px 38px rgba(15, 98, 254, 0.28));
}

.background-button--icon {
  background: var(--panel-card-btn-bg);
  color: var(--panel-card-btn-color);
  font-size: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.control-section--accent {
  gap: 14px;
}

.control-section--footer {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 0;
  background: transparent;
  border: none;
  box-shadow: none;
}

.add-card-btn {
  width: 56px;
  height: 56px;
  border-radius: 18px;
  border: 1px solid var(--panel-card-btn-border);
  background: var(--panel-card-btn-bg);
  color: var(--panel-card-btn-color);
  font-size: 26px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: var(--panel-card-btn-shadow);
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease, color 0.2s ease;
}

.add-card-btn--large {
  font-size: 30px;
}
.add-card-btn--gold {
  background: linear-gradient(135deg, #fff6d1 0%, #ffd700 50%, #ffec8b 100%);
  border-color: rgba(218, 165, 32, 0.6);
  color: #8b6508;
  box-shadow: 0 18px 32px rgba(218, 165, 32, 0.38);
}

.add-card-btn--gold:hover {
  border-color: #c89600;
  color: #a66b00;
  box-shadow: 0 24px 42px rgba(198, 150, 0, 0.45);
}

.add-card-btn:hover {
  transform: translateY(-2px);
  border-color: var(--panel-contrast);
  color: var(--panel-contrast);
  box-shadow: var(--panel-card-btn-hover-shadow, 0 26px 40px rgba(15, 98, 254, 0.3));
}
.add-card-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.template-menu {
  position: relative;
  display: inline-flex;
}

.template-menu__list {
  position: absolute;
  right: 0;
  top: calc(100% + 10px);
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
  min-width: 220px;
  max-height: min(240px, calc(100vh - 140px));
  overflow-y: auto;  
  background: var(--panel-button-bg, rgba(255, 255, 255, 0.72));
  border: 1px solid var(--panel-button-border, rgba(15, 98, 254, 0.18));
  border-radius: 14px;
  box-shadow: var(--panel-button-hover-shadow, 0 20px 36px rgba(15, 98, 254, 0.28));
  z-index: 10;
  scrollbar-width: thin;
}
.template-menu__list--drop-up {
  bottom: calc(100% + 10px);
  top: auto;
  transform-origin: bottom right;
}
.template-menu__list::-webkit-scrollbar {
  width: 6px;
}

.template-menu__list::-webkit-scrollbar-thumb {
  background: var(--panel-button-color, #0f62fe);
  border-radius: 10px;  
}

.template-menu__item {
  width: 100%;
  padding: 10px 12px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: var(--panel-card-btn-color);
  font-size: 14px;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease;
}

.template-menu__item:hover {
  background: var(--panel-highlight, rgba(15, 98, 254, 0.14));
  color: var(--panel-contrast);
}

.right-control-panel--modern .control-section__slider {
  background: rgba(32, 44, 72, 0.78);
  border-color: rgba(114, 182, 255, 0.24);
  box-shadow: inset 0 -2px 0 rgba(255, 255, 255, 0.08);
}

.right-control-panel--modern .thickness-slider {
  background: linear-gradient(to right, rgba(114, 182, 255, 0.95) 0%, rgba(114, 182, 255, 0.95) 20%, rgba(62, 82, 124, 0.85) 20%, rgba(62, 82, 124, 0.85) 100%);
}

.right-control-panel--modern .thickness-slider::-webkit-slider-thumb,
.right-control-panel--modern .thickness-slider::-moz-range-thumb {
  border-color: #73c8ff;
  box-shadow: 0 12px 22px rgba(114, 182, 255, 0.35);
}

.right-control-panel--modern .animation-input {
  background: rgba(255, 200, 68, 0.24);
  border-color: rgba(255, 200, 68, 0.38);
  color: #fff;
}

.right-control-panel--modern .animation-infinity-btn {
  background: rgba(114, 182, 255, 0.22);
  color: #73c8ff;
}

.right-control-panel--modern .background-button {
  background-color: rgba(44, 58, 88, 0.92);
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}

@media (max-width: 1440px) {
  .right-control-panel {
    top: 16px;
    right: 16px;
    max-height: calc(100vh - 32px);
  }

  .right-control-panel__card {
    width: 252px;
    padding: 20px 18px 16px;
    max-height: calc(100vh - 32px);  }
}
</style>
