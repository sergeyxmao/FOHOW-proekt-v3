<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'

import { useCardsStore } from '../../stores/cards'
import { useConnectionsStore } from '../../stores/connections'
import { useViewSettingsStore } from '../../stores/viewSettings'
import { checkAndAlertCardLimit } from '../../utils/limitsCheck'

const props = defineProps({
  isModernTheme: {
    type: Boolean,
    default: false
  },
  hideThemeToggle: {
    type: Boolean,
    default: false
  },
  variant: {
    type: String,
    default: 'default'
  }
})

const emit = defineEmits(['toggle-theme'])

const cardsStore = useCardsStore()
const connectionsStore = useConnectionsStore()
const viewSettingsStore = useViewSettingsStore()

const {
  lineColor,
  lineThickness,
  animationSeconds,
  headerColor,
  headerColorIndex
} = storeToRefs(viewSettingsStore)

const templateAnchorRef = ref(null)
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

const themeTitle = computed(() =>
  props.isModernTheme ? 'Вернуть светлое меню' : 'Включить тёмное меню'
)
const isMenuVariant = computed(() => props.variant === 'menu')

function addCard() {
  // Проверяем лимит перед добавлением карточки
  if (!checkAndAlertCardLimit(1)) {
    return
  }

  cardsStore.addCard({
    type: 'small',
    headerBg: headerColor.value,
    colorIndex: headerColorIndex.value
  })
}

function addLargeCard() {
  // Проверяем лимит перед добавлением карточки
  if (!checkAndAlertCardLimit(1)) {
    return
  }

  cardsStore.addCard({
    type: 'large',
    headerBg: headerColor.value,
    colorIndex: headerColorIndex.value
  })
}

function addGoldCard() {
  // Проверяем лимит перед добавлением карточки
  if (!checkAndAlertCardLimit(1)) {
    return
  }

  cardsStore.addCard({
    type: 'gold'
  })
}

function closeTemplateMenu() {
  isTemplateMenuOpen.value = false
}

function toggleTemplateMenu() {
  if (!templateOptions.value.length) {
    return
  }

  isTemplateMenuOpen.value = !isTemplateMenuOpen.value
}

function handleTemplateButtonClick(event) {
  event?.preventDefault?.()
  event?.stopPropagation?.()
  toggleTemplateMenu()
}

function insertTemplate(templateData) {
  if (!templateData || !Array.isArray(templateData.cards)) {
    return
  }

  // Проверяем лимит перед добавлением шаблона
  const cardsToAdd = templateData.cards.length
  if (!checkAndAlertCardLimit(cardsToAdd)) {
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

function selectTemplate(templateId) {
  const template = templatesRegistry[templateId]
  if (!template) {
    return
  }

  insertTemplate(template.data)
  closeTemplateMenu()
}

function handleDocumentClick(event) {
  if (!isTemplateMenuOpen.value) {
    return
  }

  const anchor = templateAnchorRef.value
  if (!anchor || anchor.contains(event.target)) {
    return
  }

  const menuEl = templateMenuRef.value
  if (menuEl && menuEl.contains(event.target)) {
    return
  }

  closeTemplateMenu()
}

function handleKeydown(event) {
  if (event.key === 'Escape') {
    closeTemplateMenu()
  }
}

onMounted(() => {
  document.addEventListener('click', handleDocumentClick)
  document.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleDocumentClick)
  document.removeEventListener('keydown', handleKeydown)
})

function handleToggleTheme() {
  emit('toggle-theme')
}
</script>

<template>
  <div
    :class="[
      'header-actions',
      {
        'header-actions--modern': props.isModernTheme,
        'header-actions--menu': isMenuVariant
      }
    ]"
  >
    <template v-if="isMenuVariant">
      <div class="header-actions__grid" role="group" aria-label="Быстрое добавление карт">

        <button
          class="header-actions__grid-button"
          type="button"
          title="Добавить лицензию"
          @click="addCard"
        >
          <span class="header-actions__icon" aria-hidden="true">□</span>
          <span class="visually-hidden">Добавить лицензию</span>
        </button>
        <button
          class="header-actions__grid-button header-actions__grid-button--large"
          type="button"
          title="Добавить большую лицензию"
          @click="addLargeCard"
        >
          <span class="header-actions__icon" aria-hidden="true">⧠</span>
          <span class="visually-hidden">Добавить большую лицензию</span>
        </button>
        <button
          class="header-actions__grid-button header-actions__grid-button--gold"
          type="button"
          title="Добавить Gold лицензию"
          @click="addGoldCard"
        >
          <span class="header-actions__icon" aria-hidden="true">★</span>
          <span class="visually-hidden">Добавить Gold лицензию</span>
        </button>
        <div ref="templateAnchorRef" class="header-actions__grid-item header-actions__grid-item--template">
          <button
            class="header-actions__grid-button"
            type="button"
            title="Добавить шаблон"
            :disabled="!templateOptions.length"
            aria-haspopup="true"
            :aria-expanded="isTemplateMenuOpen"
            @click="handleTemplateButtonClick"
          >
            <span class="header-actions__icon" aria-hidden="true">⧉</span>
            <span class="visually-hidden">Добавить шаблон</span>
          </button>
          <transition name="header-actions-menu">
            <div
              v-if="isTemplateMenuOpen && templateOptions.length"
              ref="templateMenuRef"
              class="header-actions__menu"
              role="menu"
              aria-label="Выбор шаблона"
            >
              <button
                v-for="option in templateOptions"
                :key="option.id"
                class="header-actions__menu-item"
                type="button"
                role="menuitem"
                @click.stop="selectTemplate(option.id)"
              >
                {{ option.displayText }}
              </button>
            </div>
          </transition>
        </div>
      </div>
      <button
        v-if="!props.hideThemeToggle"
        class="header-actions__theme-toggle"
        type="button"
        :title="themeTitle"
        @click="handleToggleTheme"
      >
        <span class="header-actions__theme-icon" aria-hidden="true"></span>
      </button>
    </template>
    <template v-else>
      <div class="header-actions__licenses">
        <button
          class="header-actions__button"
          type="button"
          title="Добавить лицензию"
          @click="addCard"
        >
          <span class="header-actions__icon" aria-hidden="true">□</span>
          <span class="visually-hidden">Добавить лицензию</span>
        </button>
        <button
          class="header-actions__button header-actions__button--large"
          type="button"
          title="Добавить большую лицензию"
          @click="addLargeCard"
        >
          <span class="header-actions__icon" aria-hidden="true">⧠</span>
          <span class="visually-hidden">Добавить большую лицензию</span>
        </button>
        <button
          class="header-actions__button header-actions__button--gold"
          type="button"
          title="Добавить Gold лицензию"
          @click="addGoldCard"
        >
          <span class="header-actions__icon" aria-hidden="true">★</span>
          <span class="visually-hidden">Добавить Gold лицензию</span>
        </button>
        <div ref="templateAnchorRef" class="header-actions__templates">
          <button
            class="header-actions__button"
            type="button"
            title="Добавить шаблон"
            :disabled="!templateOptions.length"
            aria-haspopup="true"
            :aria-expanded="isTemplateMenuOpen"
            @click="handleTemplateButtonClick"
          >
            <span class="header-actions__icon" aria-hidden="true">⧉</span>
            <span class="visually-hidden">Добавить шаблон</span>
          </button>
          <transition name="header-actions-menu">
            <div
              v-if="isTemplateMenuOpen && templateOptions.length"
              ref="templateMenuRef"
              class="header-actions__menu"
              role="menu"
              aria-label="Выбор шаблона"
            >
              <button
                v-for="option in templateOptions"
                :key="option.id"
                class="header-actions__menu-item"
                type="button"
                role="menuitem"
                @click.stop="selectTemplate(option.id)"
              >
                {{ option.displayText }}
              </button>
            </div>
          </transition>
        </div>
      </div>

      <button
        v-if="!props.hideThemeToggle"
        class="header-actions__theme-toggle"
        type="button"
        :title="themeTitle"
        @click="handleToggleTheme"
      >
        <span class="header-actions__theme-icon" aria-hidden="true"></span>
      </button>
    </template>    
  </div>
</template>

<style scoped>
.header-actions {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0;
  border-radius: 18px;
  background: transparent;
  border: none;
  box-shadow: none;
  backdrop-filter: none;
  --header-button-bg: rgba(248, 250, 252, 0.9);
  --header-button-border: rgba(148, 163, 184, 0.45);
  --header-button-color: #0f172a;
  --header-button-shadow: rgba(15, 23, 42, 0.18);
  --header-button-hover-shadow: rgba(15, 98, 254, 0.32);
}
.header-actions--menu {
  flex-direction: column;
  align-items: center;
  gap: 18px;
}

.header-actions--modern {
  background: transparent;
  border: none;
  box-shadow: none;
  --header-button-bg: rgba(32, 44, 68, 0.9);
  --header-button-border: rgba(104, 171, 255, 0.45);
  --header-button-color: #e5f3ff;
  --header-button-shadow: rgba(6, 11, 21, 0.5);
  --header-button-hover-shadow: rgba(12, 84, 196, 0.45);
}

.header-actions__grid {
  --header-grid-size: 60px;
  display: grid;
  grid-template-columns: repeat(2, var(--header-grid-size));
  gap: 14px;
}

.header-actions__grid-item {
  position: relative;
  display: flex;
}

.header-actions__grid-button {
  width: var(--header-grid-size);
  height: var(--header-grid-size);
  border-radius: 20px;
  border: 1px solid var(--header-button-border);
  background: var(--header-button-bg);
  color: var(--header-button-color);
  font-size: 20px;
  font-weight: 600;
  box-shadow: 0 16px 30px var(--header-button-shadow);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease, color 0.18s ease, border-color 0.18s ease;
  backdrop-filter: blur(10px);
}

.header-actions__grid-button:hover:not(:disabled),
.header-actions__grid-button:focus-visible:not(:disabled) {
  transform: translateY(-2px);
  background: #0f62fe;
  color: #ffffff;
  border-color: rgba(15, 98, 254, 0.82);
  box-shadow: 0 22px 38px var(--header-button-hover-shadow);
}

.header-actions__grid-button:disabled {
  opacity: 0.55;
  cursor: default;
  transform: none;
  box-shadow: none;
}

.header-actions__grid-button--large .header-actions__icon {
  font-size: 22px;
}

.header-actions__grid-button--gold {
  background: linear-gradient(135deg, #ffe272 0%, #f5b300 100%);
  border: none;
  color: #7a4a00;
  box-shadow: 0 20px 36px rgba(245, 179, 0, 0.45);
}

.header-actions__grid-button--gold:hover:not(:disabled),
.header-actions__grid-button--gold:focus-visible:not(:disabled) {
  background: linear-gradient(135deg, #ffec8f 0%, #ffbc1f 100%);
  color: #5b3600;
  border: none;
  box-shadow: 0 24px 42px rgba(245, 179, 0, 0.5);
}

.header-actions--modern .header-actions__grid-button {
  border-color: rgba(104, 171, 255, 0.55);
}

.header-actions--modern .header-actions__grid-button--gold {
  color: #5a3a00;
  box-shadow: 0 18px 36px rgba(255, 206, 84, 0.55);
}

.header-actions--menu .header-actions__grid {
  grid-template-columns: repeat(2, var(--header-grid-size));
}
.header-actions__licenses {
  display: flex;
  align-items: center;
  gap: 10px;
}

.header-actions__button {
  width: 44px;
  height: 44px;
  border-radius: 16px;
  border: 1px solid var(--header-button-border);
  background: var(--header-button-bg);
  color: var(--header-button-color);
  font-size: 20px;
  font-weight: 600;
  box-shadow: 0 14px 28px var(--header-button-shadow);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease, color 0.2s ease, border-color 0.2s ease;
}

.header-actions__button:hover:enabled,
.header-actions__button:focus-visible:enabled {
  transform: translateY(-2px);
  box-shadow: 0 20px 34px var(--header-button-hover-shadow);
  background: #0f62fe;
  color: #ffffff;
  border-color: rgba(15, 98, 254, 0.8);
}

.header-actions__button:disabled {
  opacity: 0.5;
  cursor: default;
  box-shadow: none;
}

.header-actions__button--gold {
  color: #c98400;
}

.header-actions__templates {
  position: relative;
}

.header-actions__menu,
.header-actions__menu-dropdown {
  position: absolute;
  top: calc(100% + 10px);
  right: 0;
  min-width: 220px;
  max-height: 320px;
  overflow-y: auto;
  padding: 10px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid rgba(15, 23, 42, 0.08);
  box-shadow: 0 18px 32px rgba(15, 23, 42, 0.16);
  backdrop-filter: blur(6px);
  display: flex;
  flex-direction: column;
  gap: 6px;
  z-index: 2100;
}
.header-actions--modern .header-actions__menu,
.header-actions--modern .header-actions__menu-dropdown {
  background: rgba(40, 56, 90, 0.92);
  border-color: rgba(96, 164, 255, 0.35);
  box-shadow: 0 22px 38px rgba(6, 11, 21, 0.55);
}
.header-actions--menu .header-actions__menu {
  left: 50%;
  right: auto;
  transform: translateX(-50%);
}

.header-actions__menu-item {
  padding: 8px 12px;
  border-radius: 12px;
  border: none;
  background: rgba(15, 23, 42, 0.06);
  color: #0f172a;
  font-size: 14px;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease;
}

.header-actions__menu-item:hover {
  background: rgba(59, 130, 246, 0.2);
  color: #1d4ed8;
}
.visually-hidden {
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

.header-actions--modern .header-actions__menu-item {
  background: rgba(28, 38, 62, 0.78);
  color: #e5f3ff;
}

.header-actions--modern .header-actions__menu-item:hover {
  background: rgba(102, 176, 255, 0.3);
  color: #ffffff;
}

.header-actions__theme-toggle {
  width: 48px;
  height: 48px;
  border-radius: 18px;
  border: 1px solid rgba(15, 23, 42, 0.12);
  background: linear-gradient(145deg, rgba(59, 130, 246, 0.12), rgba(59, 130, 246, 0));
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 14px 26px rgba(37, 99, 235, 0.24);
  transition: transform 0.2s ease, box-shadow 0.2s ease, border 0.2s ease;
}
.header-actions__menu-icon,
.header-actions__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  font-size: inherit;
  color: currentColor;
  transition: color 0.2s ease;
}

.header-actions__menu-button--icon .header-actions__menu-icon {
  font-size: 20px;
}

.header-actions__icon {
  font-size: 20px;
}

.header-actions__button--large .header-actions__icon {
  font-size: 22px;
}

.header-actions--modern .header-actions__button--gold {
  color: #f5b74c;
}
.header-actions__theme-toggle:hover {
  transform: translateY(-2px);
  box-shadow: 0 20px 34px rgba(37, 99, 235, 0.32);
  border-color: rgba(59, 130, 246, 0.35);
}

.header-actions__theme-icon {
  position: relative;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: linear-gradient(135deg, #0f172a 0%, #2563eb 100%);
  box-shadow: inset -4px -4px 10px rgba(255, 255, 255, 0.22), 0 6px 12px rgba(15, 23, 42, 0.18);
}

.header-actions__theme-icon::before,
.header-actions__theme-icon::after {
  content: '';
  position: absolute;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.85);
  transition: opacity 0.2s ease;
}

.header-actions__theme-icon::before {
  inset: 4px;
  opacity: 0.4;
}

.header-actions__theme-icon::after {
  inset: 7px;
  opacity: 0.2;
}

.header-actions--modern .header-actions__theme-toggle {
  border-color: rgba(96, 164, 255, 0.42);
  background: linear-gradient(145deg, rgba(114, 182, 255, 0.25), rgba(114, 182, 255, 0));
  box-shadow: 0 18px 34px rgba(6, 11, 21, 0.52);
}

.header-actions--modern .header-actions__theme-icon {
  background: linear-gradient(135deg, #e5f3ff 0%, #73c8ff 100%);
  box-shadow: inset -4px -4px 10px rgba(6, 11, 21, 0.35), 0 6px 12px rgba(6, 11, 21, 0.3);
}

.header-actions-menu-enter-active,
.header-actions-menu-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.header-actions-menu-enter-from,
.header-actions-menu-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
