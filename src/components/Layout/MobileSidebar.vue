<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useCardsStore } from '@/stores/cards'
import { useConnectionsStore } from '@/stores/connections'
import { useViewSettingsStore } from '@/stores/viewSettings'
import { useMobileStore } from '@/stores/mobile'
import { useAuthStore } from '@/stores/auth'
import { checkAndAlertCardLimit } from '@/utils/limitsCheck'
import { calculateTemplateOffset } from '@/utils/viewport'
 
const props = defineProps({
  isModernTheme: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits([
  'add-license',
  'add-lower',
  'add-gold',
  'add-template'
])

const cardsStore = useCardsStore()
const connectionsStore = useConnectionsStore()
const viewSettingsStore = useViewSettingsStore()
const mobileStore = useMobileStore()
const authStore = useAuthStore()

const { headerColor, headerColorIndex, lineColor, lineThickness, animationSeconds } = storeToRefs(viewSettingsStore)
const { isMenuScaled, menuScale } = storeToRefs(mobileStore)

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
  if (!fileName) return map
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

const handleAddLicense = () => {
  emit('add-license')
}

const handleAddLower = () => {
  emit('add-lower')
}

const handleAddGold = () => {
  emit('add-gold')
}

const toggleTemplateMenu = () => {
  if (!templateOptions.value.length) return
  isTemplateMenuOpen.value = !isTemplateMenuOpen.value
}

const closeTemplateMenu = () => {
  isTemplateMenuOpen.value = false
}

const selectTemplate = (templateId) => {
  const template = templatesRegistry[templateId]
  if (template) {
    insertTemplate(template.data)
  }
  closeTemplateMenu()
}

function insertTemplate(templateData) {
  if (!templateData || !Array.isArray(templateData.cards)) {
    return
  }

  // Проверяем лимит перед добавлением карточек из шаблона
  const cardsToAdd = templateData.cards.length
  if (!checkAndAlertCardLimit(cardsToAdd)) {
    return
  }

  // Вычисляем смещение для позиционирования шаблона в viewport
  const offset = calculateTemplateOffset(templateData.cards)
  const dx = offset?.dx ?? 0
  const dy = offset?.dy ?? 0

  const createdCardsMap = new Map()
  const createdCardIds = []

  templateData.cards.forEach(cardDef => {
    if (!cardDef) return

    const templateKey = cardDef.key || cardDef.id
    if (!templateKey) return

    const { key: _legacyKey, id: _legacyId, type = 'large', ...cardPayload } = cardDef

    // Применяем смещение к координатам карточки
    const adjustedPayload = { ...cardPayload }
    if (Number.isFinite(cardPayload.x)) {
      adjustedPayload.x = cardPayload.x + dx
    }
    if (Number.isFinite(cardPayload.y)) {
      adjustedPayload.y = cardPayload.y + dy
    }

    const cardData = cardsStore.addCard({
      type,
      ...adjustedPayload,
      headerBg: headerColor.value,
      colorIndex: headerColorIndex.value
    })

    createdCardsMap.set(templateKey, cardData)
    createdCardIds.push(cardData.id)
  })

  const templateLines = Array.isArray(templateData.connections) ? templateData.connections : []

  templateLines.forEach(lineDef => {
    if (!lineDef) return

    const startKey = lineDef.startKey || lineDef.from || lineDef.sourceKey
    const endKey = lineDef.endKey || lineDef.to || lineDef.targetKey

    const startCard = startKey ? createdCardsMap.get(startKey) : null
    const endCard = endKey ? createdCardsMap.get(endKey) : null

    if (!startCard || !endCard) return

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

function handleDocumentClick(event) {
  if (!isTemplateMenuOpen.value) return
  const anchor = templateAnchorRef.value
  if (!anchor || anchor.contains(event.target)) return
  const menuEl = templateMenuRef.value
  if (menuEl && menuEl.contains(event.target)) return
  closeTemplateMenu()
}

onMounted(() => {
  document.addEventListener('click', handleDocumentClick)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleDocumentClick)
})
</script>

<template>
  <div
    v-if="authStore.isAuthenticated"
    class="mobile-sidebar"
    :class="{ 'mobile-sidebar--dark': isModernTheme, 'mobile-sidebar--scaled': isMenuScaled }"
    :style="{ '--menu-scale': menuScale }"
   >
   <!-- Добавить лицензию -->
    <button
      class="mobile-sidebar-button"
      type="button"
      @click="handleAddLicense"
      title="Добавить лицензию"
    >
      <span class="sidebar-icon">□</span>
    </button>

    <!-- Добавить более низкую -->
    <button
      class="mobile-sidebar-button"
      type="button"
      @click="handleAddLower"
      title="Добавить более низкую"
    >
      <span class="sidebar-icon">⧠</span>
    </button>

    <!-- Добавить Gold -->
    <button
      class="mobile-sidebar-button gold-button"
      type="button"
      @click="handleAddGold"
      title="Добавить Gold"
    >
      <span class="sidebar-icon">★</span>
    </button>

    <!-- Добавить шаблон -->
    <div ref="templateAnchorRef" class="mobile-sidebar-item">
      <button
        class="mobile-sidebar-button"
        type="button"
        @click="toggleTemplateMenu"
        :disabled="!templateOptions.length"
        title="Добавить шаблон"
      >
        <span class="sidebar-icon">⧉</span>
      </button>

      <transition name="sidebar-menu">
        <div
          v-if="isTemplateMenuOpen && templateOptions.length"
          ref="templateMenuRef"
          class="sidebar-template-menu"
        >
          <button
            v-for="option in templateOptions"
            :key="option.id"
            class="sidebar-menu-item"
            type="button"
            @click.stop="selectTemplate(option.id)"
          >
            {{ option.displayText }}
          </button>
        </div>
      </transition>
    </div>
  </div>
</template>

<style scoped>
.mobile-sidebar {
  position: fixed;
  right: 8px;
  top: calc(50% - 28px);
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  gap: 16px;
  z-index: 1100;
}

.mobile-sidebar-item {
  position: relative;
}

.mobile-sidebar-button {
  width: 56px;
  height: 56px;
  border: none;
  border-radius: var(--md-sys-shape-corner-large);
  background: var(--md-sys-color-surface-container-high);
  color: var(--md-sys-color-on-surface);
  cursor: pointer;
  transition: background var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-standard),
    box-shadow var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-standard),
    transform var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-standard);
  box-shadow: var(--md-sys-elevation-3);
  display: flex;
  align-items: center;
  justify-content: center;
  user-select: none;
  font-size: 24px;
  transform: scale(var(--menu-scale, 1));
}

.mobile-sidebar--dark .mobile-sidebar-button {
  background: var(--md-ref-neutral-22);
  color: var(--md-ref-neutral-90);
}

.mobile-sidebar--scaled {
  gap: 20px;
}

.mobile-sidebar--scaled .mobile-sidebar-button {
  transform: scale(var(--menu-scale, 1));
}

.mobile-sidebar-button:hover:not(:disabled) {
  background: var(--md-sys-color-primary-container);
  color: var(--md-sys-color-on-primary-container);
  box-shadow: var(--md-sys-elevation-4);
}

.mobile-sidebar--dark .mobile-sidebar-button:hover:not(:disabled) {
  background: var(--md-ref-primary-30);
  color: var(--md-ref-primary-90);
}

.mobile-sidebar-button:active:not(:disabled) {
  transform: scale(calc(var(--menu-scale, 1) * 0.95));
  box-shadow: var(--md-sys-elevation-1);
}

.mobile-sidebar-button:disabled {
  opacity: var(--md-sys-state-disabled-opacity);
  cursor: not-allowed;
}

.sidebar-icon {
  font-size: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Gold button — uses tertiary container instead of gradient */
.gold-button {
  background: var(--md-sys-color-tertiary-container);
  color: var(--md-sys-color-on-tertiary-container);
}

.gold-button:hover:not(:disabled) {
  background: var(--md-sys-color-tertiary);
  color: var(--md-sys-color-on-tertiary);
}

.gold-button:active:not(:disabled) {
  background: var(--md-sys-color-tertiary);
  color: var(--md-sys-color-on-tertiary);
}

.mobile-sidebar--dark .gold-button {
  background: var(--md-ref-tertiary-30);
  color: var(--md-ref-tertiary-90);
}

.mobile-sidebar--dark .gold-button:hover:not(:disabled) {
  background: var(--md-ref-tertiary-40);
  color: var(--md-ref-tertiary-99);
}

/* Template menu */
.sidebar-template-menu {
  position: absolute;
  right: calc(100% + 10px);
  top: 0;
  min-width: 200px;
  max-height: 320px;
  overflow-y: auto;
  padding: 8px;
  border-radius: var(--md-sys-shape-corner-large);
  background: var(--md-sys-color-surface-container-high);
  border: none;
  box-shadow: var(--md-sys-elevation-3);
  display: flex;
  flex-direction: column;
  gap: 4px;
  z-index: 1000;
}

.mobile-sidebar--dark .sidebar-template-menu {
  background: var(--md-ref-neutral-22);
}

.sidebar-menu-item {
  padding: 10px 14px;
  border-radius: var(--md-sys-shape-corner-medium);
  border: none;
  background: transparent;
  color: var(--md-sys-color-on-surface);
  font-size: 14px;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
  transition: background var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-standard);
}

.sidebar-menu-item:hover {
  background: var(--md-sys-color-primary-container);
  color: var(--md-sys-color-on-primary-container);
}

.mobile-sidebar--dark .sidebar-menu-item {
  color: var(--md-ref-neutral-90);
}

.mobile-sidebar--dark .sidebar-menu-item:hover {
  background: var(--md-ref-primary-30);
  color: var(--md-ref-primary-90);
}

/* Transition */
.sidebar-menu-enter-active,
.sidebar-menu-leave-active {
  transition: opacity var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-standard),
    transform var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-standard);
}

.sidebar-menu-enter-from,
.sidebar-menu-leave-to {
  opacity: 0;
  transform: translateX(10px);
}

@media (max-width: 480px) {
  .mobile-sidebar {
    right: 6px;
    gap: 12px;
  }

  .mobile-sidebar-button {
    width: 48px;
    height: 48px;
  }

  .sidebar-icon {
    font-size: 22px;
  }

  .sidebar-template-menu {
    min-width: 180px;
  }
}
</style>
