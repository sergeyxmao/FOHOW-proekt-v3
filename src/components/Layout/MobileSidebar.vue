<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useCardsStore } from '@/stores/cards'
import { useConnectionsStore } from '@/stores/connections'
import { useViewSettingsStore } from '@/stores/viewSettings'
import { useMobileStore } from '@/stores/mobile'
 
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

const { headerColor, headerColorIndex, lineColor, lineThickness, animationSeconds } = storeToRefs(viewSettingsStore)
const { isMenuScaled } = storeToRefs(mobileStore)

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

  const createdCardsMap = new Map()
  const createdCardIds = []

  templateData.cards.forEach(cardDef => {
    if (!cardDef) return

    const templateKey = cardDef.key || cardDef.id
    if (!templateKey) return

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
    class="mobile-sidebar"
    :class="{ 'mobile-sidebar--dark': isModernTheme, 'mobile-sidebar--scaled': isMenuScaled }"
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
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  gap: 12px;
  z-index: 900;
}

.mobile-sidebar-item {
  position: relative;
}

.mobile-sidebar-button {
  --sidebar-button-scale: 1;
  width: 52px;
  height: 52px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  color: #111827;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  user-select: none;
  font-size: 24px;
  transform: scale(var(--sidebar-button-scale)); 
}

.mobile-sidebar--dark .mobile-sidebar-button {
  background: rgba(28, 38, 58, 0.95);
  color: #e5f3ff;
  border-color: rgba(255, 255, 255, 0.1);
}
.mobile-sidebar--scaled {
  gap: 16px;
}

.mobile-sidebar--scaled .mobile-sidebar-button {
  --sidebar-button-scale: 1.12;
}
.mobile-sidebar-button:active:not(:disabled) {
  transform: scale(calc(var(--sidebar-button-scale) * 0.95));
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
}

.mobile-sidebar-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.sidebar-icon {
  font-size: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Gold button */
.gold-button {
  background: linear-gradient(135deg, #ffe272 0%, #f5b300 100%);
  color: #7a4a00;
  border-color: rgba(245, 179, 0, 0.5);
  box-shadow: 0 4px 12px rgba(245, 179, 0, 0.4);
}

.gold-button:active:not(:disabled) {
  background: linear-gradient(135deg, #ffec8f 0%, #ffbc1f 100%);
  color: #5b3600;
}

.mobile-sidebar--dark .gold-button {
  color: #5a3a00;
  box-shadow: 0 4px 12px rgba(255, 206, 84, 0.5);
}

/* Template menu */
.sidebar-template-menu {
  position: absolute;
  right: calc(100% + 10px);
  top: 0;
  min-width: 200px;
  max-height: 320px;
  overflow-y: auto;
  padding: 10px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid rgba(0, 0, 0, 0.08);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  backdrop-filter: blur(10px);
  display: flex;
  flex-direction: column;
  gap: 6px;
  z-index: 1000;
}

.mobile-sidebar--dark .sidebar-template-menu {
  background: rgba(28, 38, 58, 0.95);
  border-color: rgba(255, 255, 255, 0.1);
}

.sidebar-menu-item {
  padding: 8px 12px;
  border-radius: 10px;
  border: none;
  background: rgba(0, 0, 0, 0.04);
  color: #111827;
  font-size: 14px;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s ease;
}

.sidebar-menu-item:hover {
  background: rgba(15, 98, 254, 0.15);
  color: #0f62fe;
}

.mobile-sidebar--dark .sidebar-menu-item {
  background: rgba(255, 255, 255, 0.08);
  color: #e5f3ff;
}

.mobile-sidebar--dark .sidebar-menu-item:hover {
  background: rgba(59, 130, 246, 0.25);
  color: #ffffff;
}

/* Transition */
.sidebar-menu-enter-active,
.sidebar-menu-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.sidebar-menu-enter-from,
.sidebar-menu-leave-to {
  opacity: 0;
  transform: translateX(10px);
}

/* Адаптация для маленьких экранов */
@media (max-width: 480px) {
  .mobile-sidebar {
    right: 6px;
    gap: 10px;
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
