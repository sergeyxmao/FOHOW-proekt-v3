<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { storeToRefs } from 'pinia'

import { useCardsStore } from '../../stores/cards'
import { useConnectionsStore } from '../../stores/connections'
import { useViewSettingsStore } from '../../stores/viewSettings'

const props = defineProps({
  isModernTheme: {
    type: Boolean,
    default: false
  }
})
const PANEL_SCALE_VAR_NAME = '--ui-panel-scale'
const PANEL_SCALE_MARGIN = 12
const MIN_PANEL_SCALE = 0.75

const panelRootRef = ref(null)
const panelCardRef = ref(null)
let currentPanelScale = 1
let resizeFrameId = null
  
// Stores
const cardsStore = useCardsStore()
const connectionsStore = useConnectionsStore()
const viewSettingsStore = useViewSettingsStore()
const {
  lineColor,
  lineThickness,
  animationSeconds,
  headerColor,
  headerColorIndex,
  backgroundGradient
} = storeToRefs(viewSettingsStore)
// Базовая реактивность
const isCollapsed = ref(false)

// Шаблоны для вставки
const templateMenuRef = ref(null)
const templateMenuListRef = ref(null)	
const templateMenuPlacement = ref({
  dropUp: false,
  maxHeight: ''
})
const TEMPLATE_MENU_MARGIN = 16	
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
function setPanelScale(value) {
  currentPanelScale = Number.isFinite(value) ? value : currentPanelScale

  if (typeof document === 'undefined') {
    return
  }

  const root = document.documentElement
  if (!root) {
    return
  }

  const safeValue = Math.min(1, Math.max(currentPanelScale, MIN_PANEL_SCALE))
  currentPanelScale = safeValue
  root.style.setProperty(PANEL_SCALE_VAR_NAME, safeValue.toFixed(4))
}

function getPanelAvailableHeight(element) {
  if (typeof window === 'undefined' || !element) {
    return 0
  }

  const styles = window.getComputedStyle(element)
  const heightValue = parseFloat(styles.height)

  if (Number.isFinite(heightValue) && heightValue > 0) {
    return heightValue
  }

  return Math.max(window.innerHeight - 48, 0)
}

function calculateTargetPanelScale() {
  const cardEl = panelCardRef.value
  const panelEl = panelRootRef.value

  if (!cardEl || !panelEl) {
    return currentPanelScale
  }

  const availableHeight = Math.max(getPanelAvailableHeight(panelEl) - PANEL_SCALE_MARGIN, 0)
  const baseScale = currentPanelScale || 1
  const rawContentHeight = cardEl.scrollHeight / baseScale

  if (!Number.isFinite(rawContentHeight) || rawContentHeight <= 0 || availableHeight <= 0) {
    return 1
  }

  const proposedScale = availableHeight / rawContentHeight
  return Math.min(1, Math.max(proposedScale, MIN_PANEL_SCALE))
}

function updatePanelScale() {
  if (typeof window === 'undefined') {
    return
  }

  const nextScale = calculateTargetPanelScale()
  setPanelScale(nextScale)
}

function schedulePanelScaleUpdate() {
  if (resizeFrameId) {
    cancelAnimationFrame(resizeFrameId)
  }

  resizeFrameId = requestAnimationFrame(() => {
    resizeFrameId = null
    updatePanelScale()
    if (isTemplateMenuOpen.value) {
      updateTemplateMenuPlacement()
    }	  
  })
}
 
// Методы для управления панелью
function togglePanel() {
  isCollapsed.value = !isCollapsed.value
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
  const nextState = !isTemplateMenuOpen.value

  if (nextState) {
    isTemplateMenuOpen.value = true
    nextTick(() => {
      updateTemplateMenuPlacement()
    })
  } else {
    closeTemplateMenu()
  }
}

function handleTemplateButtonClick(event) {
  if (event) {
    event.preventDefault?.()
    event.stopPropagation?.()
  }

  if (!templateOptions.value.length) {
    return
  }

  toggleTemplateMenu()
}
function resetTemplateMenuPlacement() {
  templateMenuPlacement.value = {
    dropUp: false,
    maxHeight: ''
  }
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
        : lineThickness.value
		const animationMs = Number.isFinite(lineDef.animationDurationMs)
      ? lineDef.animationDurationMs
      : Number.isFinite(lineDef.animationDuration)
        ? lineDef.animationDuration
        : animationSeconds.value * 1000
    
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
function updateTemplateMenuPlacement() {
  if (!isTemplateMenuOpen.value || typeof window === 'undefined') {
    return
  }

  const listEl = templateMenuListRef.value
  const anchorEl = templateMenuRef.value

  if (!listEl || !anchorEl) {
    return
  }

  const anchorRect = anchorEl.getBoundingClientRect()
  const listRect = listEl.getBoundingClientRect()
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0

  const availableBelow = Math.max(viewportHeight - anchorRect.bottom - TEMPLATE_MENU_MARGIN, 0)
  const availableAbove = Math.max(anchorRect.top - TEMPLATE_MENU_MARGIN, 0)

  const shouldDropUp = availableBelow < listRect.height && availableAbove > availableBelow
  const maxAvailableSpace = shouldDropUp ? availableAbove : availableBelow

  templateMenuPlacement.value = {
    dropUp: shouldDropUp,
    maxHeight: maxAvailableSpace > 0 ? `${Math.floor(maxAvailableSpace)}px` : ''
  }
}

function handlePanelScroll() {
  if (!isTemplateMenuOpen.value) {
    return
  }

  updateTemplateMenuPlacement()
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

// Инициализация
onMounted(() => {
  viewSettingsStore.setBackground(backgroundGradient.value)
  
  // Устанавливаем параметры по умолчанию для новых соединений
  connectionsStore.setDefaultConnectionParameters(
    lineColor.value,
    lineThickness.value,
    animationSeconds.value * 1000
  )
  console.log('RightPanel mounted successfully');

  document.addEventListener('click', handleDocumentClick)

  if (typeof window !== 'undefined') {
    window.addEventListener('resize', schedulePanelScaleUpdate, { passive: true })
  }

  nextTick(() => {
    schedulePanelScaleUpdate()
  })	
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleDocumentClick)

  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', schedulePanelScaleUpdate)
  }

  if (resizeFrameId) {
    cancelAnimationFrame(resizeFrameId)
    resizeFrameId = null
  }
  panelCardRef.value?.removeEventListener('scroll', handlePanelScroll)

  setPanelScale(1)
})

// Следим за изменениями параметров линий и обновляем значения по умолчанию
watch([lineColor, lineThickness, animationSeconds], ([newColor, newThickness, newDuration]) => {
  connectionsStore.setDefaultConnectionParameters(newColor, newThickness, newDuration * 1000)
})

watch(isCollapsed, (collapsed) => {
  if (collapsed) {
    closeTemplateMenu()
  } else {
    nextTick(() => {
      schedulePanelScaleUpdate()
    })	  
  }
})

watch(isTemplateMenuOpen, (isOpen) => {
  if (isOpen) {
    nextTick(() => {
      updateTemplateMenuPlacement()
      schedulePanelScaleUpdate()
    })
  } else {
    resetTemplateMenuPlacement()
  }
})

watch(panelCardRef, (current, previous) => {
  previous?.removeEventListener('scroll', handlePanelScroll)
  current?.addEventListener('scroll', handlePanelScroll, { passive: true })
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
    ref="panelRootRef"	  
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

      <div
        v-if="!isCollapsed"
        ref="panelCardRef"
        class="right-control-panel__card"
      >
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
              @click="handleTemplateButtonClick"
              :disabled="!templateOptions.length"
              aria-haspopup="true"
              :aria-expanded="isTemplateMenuOpen"
            >⧉</button>
            <div
              v-if="isTemplateMenuOpen && templateOptions.length"
              ref="templateMenuListRef"
              :class="[
                'template-menu__list',
                { 'template-menu__list--drop-up': templateMenuPlacement.dropUp }
              ]"
              :style="{ maxHeight: templateMenuPlacement.maxHeight || undefined }"
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
            @click="handleTemplateButtonClick"
            :disabled="!templateOptions.length"
            aria-haspopup="true"
            :aria-expanded="isTemplateMenuOpen"
          >⧉</button>
          <div
            v-if="isTemplateMenuOpen && templateOptions.length"
            ref="templateMenuListRef"
            :class="[
              'template-menu__list',
              { 'template-menu__list--drop-up': templateMenuPlacement.dropUp }
            ]"
            :style="{ maxHeight: templateMenuPlacement.maxHeight || undefined }"
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
  --panel-scale: var(--ui-panel-scale, 1);	
  position: fixed;
  top: 24px;
  right: 24px;
  z-index: 2000;
  display: flex;
  align-items: stretch;
  height: calc(100vh - 48px);
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
  --panel-btn-size: calc(72px * var(--panel-scale));
  --panel-btn-radius: calc(22px * var(--panel-scale));
  --panel-collapse-width: calc(52px * var(--panel-scale));
  --panel-collapse-min-height: calc(64px * var(--panel-scale));
  --panel-collapse-padding: calc(14px * var(--panel-scale));
  --panel-collapse-radius: calc(26px * var(--panel-scale));
  --panel-card-width: calc(268px * var(--panel-scale));
  --panel-card-padding-top: calc(22px * var(--panel-scale));
  --panel-card-padding-inline: calc(20px * var(--panel-scale));
  --panel-card-padding-bottom: calc(18px * var(--panel-scale));
  --panel-card-gap: calc(12px * var(--panel-scale));
  --panel-top-padding: calc(18px * var(--panel-scale));
  --panel-gap: calc(14px * var(--panel-scale));
  --panel-font-size: calc(20px * var(--panel-scale));
  --panel-scrollbar-size: calc(8px * var(--panel-scale));
  --panel-scrollbar-border: calc(2px * var(--panel-scale));
  --panel-card-padding-right: calc(28px * var(--panel-scale));
  --panel-inner-radius: calc(22px * var(--panel-scale));
  --panel-inner-spacing: calc(14px * var(--panel-scale));
  --panel-small-spacing: calc(12px * var(--panel-scale));
  --panel-radius-small: calc(12px * var(--panel-scale));
  --panel-radius-medium: calc(18px * var(--panel-scale));
  --panel-padding-xs: calc(4px * var(--panel-scale));
  --panel-padding-small: calc(12px * var(--panel-scale));
  --panel-padding-medium: calc(14px * var(--panel-scale));
  --panel-padding-large: calc(16px * var(--panel-scale));
  --template-menu-gap: calc(18px * var(--panel-scale));
  --template-menu-offset: calc(var(--panel-card-width) + var(--template-menu-gap));	
  color: var(--panel-text);
  --panel-collapse-bg: var(--panel-bg);
  --panel-collapse-color: var(--panel-text);
  --panel-collapse-border: var(--panel-border);
  --panel-collapse-shadow: var(--panel-shadow);
  --panel-collapse-hover-shadow: var(--panel-button-hover-shadow);
  --panel-collapse-hover-color: var(--panel-button-color);	
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
  --panel-collapse-hover-color: #73c8ff;	
}

.right-control-panel__shell {
  position: relative;
  display: flex;
  align-items: stretch;
  gap: 0;
  height: 100%;	
  max-height: 100%;

}

.right-control-panel__collapse {
  position: absolute;
  top: 50%;
  left: calc(-1 * var(--panel-collapse-width));
  transform: translateY(-50%);
  width: var(--panel-collapse-width);
  min-height: var(--panel-collapse-min-height);
  padding: 0 var(--panel-collapse-padding);
  border-radius: var(--panel-collapse-radius) 0 0 var(--panel-collapse-radius);
  border: 1px solid var(--panel-collapse-border);
  border-right: none;
  background: var(--panel-collapse-bg);
  color: var(--panel-collapse-color);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--panel-font-size);
  font-weight: 600;
  cursor: pointer;
  box-shadow: var(--panel-collapse-shadow);
  backdrop-filter: blur(22px);
  transition: transform 0.2s ease, box-shadow 0.2s ease, color 0.2s ease;
}

.right-control-panel__collapse:hover {
  transform: translateY(-50%) translateX(-2px);
  box-shadow: var(--panel-collapse-hover-shadow);
  color: var(--panel-collapse-hover-color);
}

.right-control-panel__collapse span {
  pointer-events: none;
}
.right-control-panel--collapsed .right-control-panel__collapse {
  top: 50%;
}

.right-control-panel__collapsed-actions {
  display: flex;
  align-items: center;
  gap: calc(var(--panel-btn-size) * 0.18);
  padding: calc(2px * var(--panel-scale)) calc(18px * var(--panel-scale));
  background: transparent;
  border: 1px solid var(--panel-border);
  border-left: none;
  border-radius: 0 var(--panel-collapse-radius) var(--panel-collapse-radius) 0;
  box-shadow: var(--panel-shadow);
  backdrop-filter: none;
  margin-left: -1px;
  --template-menu-gap: calc(var(--panel-btn-size) * 0.25);	
  --template-menu-offset: calc(var(--panel-btn-size) * 0.4);
  flex-wrap: wrap;
  justify-content: center;
  position: relative;
  overflow: visible;
}

.right-control-panel__card {
  width: var(--panel-card-width);
  display: flex;
  flex-direction: column;
  gap: var(--panel-card-gap);
  padding: var(--panel-card-padding-top) var(--panel-card-padding-inline) var(--panel-card-padding-bottom);
  background: transparent;
  border: 1px solid var(--panel-border);
  border-left: none;
  border-radius: 0 var(--panel-collapse-radius) var(--panel-collapse-radius) 0;
  box-shadow: var(--panel-shadow);
  backdrop-filter: none;
  height: 100%;
  overflow-x: visible;
  overflow-y: auto;
  padding-right: var(--panel-card-padding-right);
  box-sizing: border-box;
  scrollbar-width: thin;
  scrollbar-color: var(--panel-button-color) rgba(15, 23, 42, 0.08);
  margin-left: -1px;

}

.right-control-panel--collapsed {
  height: auto;
  max-height: none;
}

.right-control-panel--collapsed .right-control-panel__shell {
  height: auto;  
}

.right-control-panel__card::-webkit-scrollbar {
  width: var(--panel-scrollbar-size);
}

.right-control-panel__card::-webkit-scrollbar-track {
  background: rgba(15, 23, 42, 0.05);
  border-radius: var(--panel-radius-small);
}

.right-control-panel__card::-webkit-scrollbar-thumb {
  background: var(--panel-button-color);
  border-radius: var(--panel-radius-small);
  border: var(--panel-scrollbar-border) solid rgba(255, 255, 255, 0.4);
}

.right-control-panel__card::-webkit-scrollbar-thumb:hover {
  background: var(--panel-contrast);  
}

.right-control-panel__top {
  display: flex;
  gap: var(--panel-gap);
  align-items: center;
  padding: var(--panel-top-padding);
  border-radius: var(--panel-inner-radius);
  background: var(--panel-surface);
  border: 1px solid var(--panel-surface-border);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.25);
}

.line-color-button {
  width: var(--panel-btn-size);
  height: var(--panel-btn-size);
  border-radius: var(--panel-btn-radius);
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
  width: var(--panel-btn-size);
  height: var(--panel-btn-size);
  border-radius: var(--panel-btn-radius);
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
  width: calc(var(--panel-btn-size) * 0.33);
  height: calc(var(--panel-btn-size) * 0.33);	
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
  gap: calc(10px * var(--panel-scale));
  padding: var(--panel-padding-medium);
  border-radius: calc(20px * var(--panel-scale));
  background: var(--panel-surface);
  border: 1px solid var(--panel-surface-border);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.2);
}

.control-section__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: calc(8px * var(--panel-scale));
}

.control-section__title {

  font-weight: 600;
  font-size: calc(14px * var(--panel-scale));
  color: var(--panel-text);
}

.control-section__title--accent {
  font-size: calc(12px * var(--panel-scale));
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--panel-muted);
}

.control-section__value {
  padding: calc(4px * var(--panel-scale)) calc(12px * var(--panel-scale));
  border-radius: var(--panel-radius-small);
  background: var(--panel-badge-bg);
  color: var(--panel-contrast);
  font-size: calc(13px * var(--panel-scale));
  font-weight: 600;
}

.control-section__slider {

  padding: var(--panel-padding-small) var(--panel-padding-medium);
  border-radius: calc(16px * var(--panel-scale));
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid rgba(15, 98, 254, 0.12);
  box-shadow: inset 0 -2px 0 rgba(255, 255, 255, 0.45);
}

.thickness-slider {
  width: 100%;
  height: calc(10px * var(--panel-scale));
  border-radius: 999px;
  background: linear-gradient(to right, #0f62fe 0%, #0f62fe 20%, rgba(203, 213, 225, 0.7) 20%, rgba(203, 213, 225, 0.7) 100%);
  outline: none;
  -webkit-appearance: none;
  appearance: none;
}

.thickness-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: calc(22px * var(--panel-scale));
  height: calc(22px * var(--panel-scale));
  border-radius: 50%;
  background: #fff;
  border: calc(4px * var(--panel-scale)) solid #0f62fe;  cursor: pointer;
  box-shadow: 0 10px 18px rgba(15, 98, 254, 0.32);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.thickness-slider::-webkit-slider-thumb:hover {
  transform: scale(1.08);
  box-shadow: 0 16px 26px rgba(15, 98, 254, 0.4);}

.thickness-slider::-moz-range-thumb {
  width: calc(22px * var(--panel-scale));
  height: calc(22px * var(--panel-scale));
  border-radius: 50%;
  background: #fff;
  border: calc(4px * var(--panel-scale)) solid #0f62fe;
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
  gap: var(--panel-small-spacing);
}

.animation-input {
  display: inline-flex;
  align-items: center;
  gap: calc(8px * var(--panel-scale));
  padding: calc(10px * var(--panel-scale)) calc(16px * var(--panel-scale));
  border-radius: calc(16px * var(--panel-scale));
  background: rgba(255, 200, 68, 0.2);
  border: 1px solid rgba(255, 200, 68, 0.34);
  box-shadow: inset 0 -2px 0 rgba(255, 255, 255, 0.45);
  color: var(--panel-text);
}

.animation-duration-input {
  width: calc(56px * var(--panel-scale));
  border: none;
  background: transparent;
  font-size: calc(16px * var(--panel-scale));
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
  font-size: calc(14px * var(--panel-scale));
  font-weight: 600;
  text-transform: lowercase;
}

.animation-infinity-btn {
  width: var(--panel-btn-size);
  height: var(--panel-btn-size);
  border-radius: var(--panel-btn-radius);
  border: 1px solid var(--panel-button-border);
  background: var(--panel-highlight);
  color: var(--panel-button-color);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: calc(var(--panel-btn-size) * 0.3);
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
  gap: var(--panel-small-spacing);
  align-items: center;
}

.header-color-button {
  width: var(--panel-btn-size);
  height: var(--panel-btn-size);
  border-radius: var(--panel-btn-radius);
  border: 3px solid rgba(255, 255, 255, 0.7);
  cursor: pointer;
  box-shadow: inset 0 0 0 3px rgba(255, 255, 255, 0.45), 0 18px 30px rgba(93, 139, 244, 0.24);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;	
}

.header-color-button:hover {
  transform: translateY(-2px) scale(1.03);
  box-shadow: inset 0 0 0 3px rgba(255, 255, 255, 0.6), 0 24px 36px rgba(93, 139, 244, 0.3);
}

.header-cycle-button {
  width: var(--panel-btn-size);
  height: var(--panel-btn-size);
  border-radius: var(--panel-btn-radius);
  border: 1px solid var(--panel-card-btn-border);
  background: var(--panel-card-btn-bg);
  color: var(--panel-card-btn-color);
  font-size: calc(var(--panel-btn-size) * 0.33);
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
  gap: var(--panel-small-spacing);
  align-items: center;	
}
.grid-settings {
  display: flex;
  flex-direction: column;
  gap: var(--panel-small-spacing);
  padding: var(--panel-padding-medium);
  border-radius: var(--panel-radius-medium);
  background: var(--panel-surface);
  border: 1px solid var(--panel-surface-border);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.18);
}

.grid-settings__field {
  display: flex;
  align-items: center;
  gap: calc(10px * var(--panel-scale));
  font-size: calc(14px * var(--panel-scale));
  color: var(--panel-muted);
}

.grid-settings__label {
  font-weight: 600;
  color: var(--panel-text);
}

.grid-settings__input {
  width: calc(72px * var(--panel-scale));
  padding: calc(6px * var(--panel-scale)) calc(10px * var(--panel-scale));
  border-radius: var(--panel-radius-small);
  border: 1px solid var(--panel-card-btn-border);
  background: var(--panel-button-bg);
  color: var(--panel-text);
  font-size: calc(14px * var(--panel-scale));
  text-align: center;
  box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.12);
}

.grid-settings__unit {
  font-size: calc(12px * var(--panel-scale));
  color: var(--panel-muted);
}


.grid-settings__toggle {
  align-self: flex-start;
  width: var(--panel-btn-size);
  height: var(--panel-btn-size);
  border-radius: var(--panel-btn-radius);
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--panel-card-btn-border);
  background: var(--panel-button-bg);
  color: var(--panel-text);
  font-size: calc(var(--panel-btn-size) * 0.33);
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
  width: var(--panel-btn-size);
  height: var(--panel-btn-size);
  border-radius: var(--panel-btn-radius);
  border: 1px solid var(--panel-card-btn-border);
  box-shadow: var(--panel-card-btn-shadow);
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
  background-size: cover;
  background-position: center;
  display: flex;
  align-items: center;
  justify-content: center;	
}

.background-button:hover {
  transform: translateY(-2px);
  border-color: var(--panel-contrast);
  box-shadow: var(--panel-card-btn-hover-shadow, 0 24px 38px rgba(15, 98, 254, 0.28));
}

.background-button--icon {
  background: var(--panel-card-btn-bg);
  color: var(--panel-card-btn-color);
  font-size: calc(var(--panel-btn-size) * 0.33);
  display: flex;
  align-items: center;
  justify-content: center;
}

.control-section--accent {
  gap: var(--panel-gap);
}

.control-section--footer {
  flex-direction: row;
  align-items: center;
  gap: calc(var(--panel-btn-size) * 0.18);
  padding: 0;
  background: transparent;
  border: none;
  box-shadow: none;
  flex-wrap: wrap;
  justify-content: center;	
}

.add-card-btn {
  width: var(--panel-btn-size);
  height: var(--panel-btn-size);
  border-radius: var(--panel-btn-radius);
  border: 1px solid var(--panel-card-btn-border);
  background: var(--panel-card-btn-bg);
  color: var(--panel-card-btn-color);
  font-size: calc(var(--panel-btn-size) * 0.36);
  font-weight: 700;
  cursor: pointer;
  box-shadow: var(--panel-card-btn-shadow);
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease, color 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;	
}

.add-card-btn--large {
  font-size: calc(var(--panel-btn-size) * 0.4);
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
  right: calc(100% + var(--template-menu-offset, 0px));
  left: auto;	
  margin-right: 0;
  top: calc(100% + 10px * var(--panel-scale));
  display: flex;
  flex-direction: column;
  gap: calc(6px * var(--panel-scale));
  padding: var(--panel-padding-small);
  min-width: calc(220px * var(--panel-scale));
  max-height: min(calc(240px * var(--panel-scale)), calc(100vh - 140px));
  overflow-y: auto;
  background: var(--panel-button-bg, rgba(255, 255, 255, 0.72));
  border: 1px solid var(--panel-button-border, rgba(15, 98, 254, 0.18));
  border-radius: calc(14px * var(--panel-scale));
  box-shadow: var(--panel-button-hover-shadow, 0 20px 36px rgba(15, 98, 254, 0.28));
  z-index: 10;
  scrollbar-width: thin;
}
.template-menu__list--drop-up {
  bottom: calc(100% + 10px * var(--panel-scale));
  top: auto;
  transform-origin: bottom left;
}
.template-menu__list::-webkit-scrollbar {
  width: calc(6px * var(--panel-scale));
}

.template-menu__list::-webkit-scrollbar-thumb {
  background: var(--panel-button-color, #0f62fe);
  border-radius: calc(10px * var(--panel-scale));
}

.template-menu__item {
  width: 100%;
  padding: calc(10px * var(--panel-scale)) calc(12px * var(--panel-scale));
  border: none;
  border-radius: calc(10px * var(--panel-scale));
  background: transparent;
  color: var(--panel-card-btn-color);
  font-size: calc(14px * var(--panel-scale));
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
    height: calc(100vh - 32px);
    max-height: calc(100vh - 32px);
  }

  .right-control-panel__card {
    width: calc(252px * var(--panel-scale));
    padding: calc(20px * var(--panel-scale)) calc(18px * var(--panel-scale)) calc(16px * var(--panel-scale));
  }
}
</style>
