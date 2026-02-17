<script setup>
import { computed, inject, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useSidePanelsStore } from '@/stores/sidePanels'
import { useMobileStore } from '@/stores/mobile'

const props = defineProps({
  isModernTheme: {
    type: Boolean,
    default: false
  }
})

const { t } = useI18n()
const sidePanelsStore = useSidePanelsStore()
const mobileStore = useMobileStore()

const { activePanel } = storeToRefs(sidePanelsStore)
const isMobile = computed(() => mobileStore.isMobileMode)
const isPencilMode = inject('isPencilMode', ref(false))

const panels = computed(() => [
  { key: 'partners', icon: '👤', label: t('mobileMenu.partners'), action: () => sidePanelsStore.openPartners() },
  { key: 'notes', icon: '📅', label: t('mobileMenu.notes'), action: () => sidePanelsStore.openNotes() },
  { key: 'images', icon: '🖼️', label: t('panels.photos'), action: () => sidePanelsStore.openImages() },
  { key: 'comments', icon: '💬', label: t('mobileMenu.comments'), action: () => sidePanelsStore.openComments() },
  { key: 'anchors', icon: '🧭', label: t('elementsMenu.geolocation'), action: () => sidePanelsStore.openAnchors() },
  { key: 'stickerMessages', icon: '📌', label: t('mobileMenu.stickers'), action: () => sidePanelsStore.openStickerMessages() }
])

const handleSwitch = (panel) => {
  if (activePanel.value !== panel.key) {
    panel.action()
  }
}
</script>

<template>
  <div
    v-if="isMobile && !isPencilMode"
    class="panel-switch-bar"
    :class="{ 'panel-switch-bar--dark': isModernTheme }"
  >
    <button
      v-for="panel in panels"
      :key="panel.key"
      class="panel-switch-bar__btn"
      :class="{ 'panel-switch-bar__btn--active': activePanel === panel.key }"
      type="button"
      :title="panel.label"
      :aria-label="panel.label"
      @click="handleSwitch(panel)"
    >
      {{ panel.icon }}
    </button>
  </div>
</template>

<style scoped>
.panel-switch-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 6px 8px;
  border-bottom: 1px solid var(--md-sys-color-outline-variant);
  flex-shrink: 0;
}

.panel-switch-bar--dark {
  border-bottom-color: color-mix(in srgb, var(--md-sys-color-outline-variant) 50%, transparent);
}

.panel-switch-bar__btn {
  width: 40px;
  height: 36px;
  border: none;
  border-radius: var(--md-sys-shape-corner-medium);
  background: transparent;
  color: var(--md-sys-color-on-surface-variant);
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    background var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-standard),
    transform var(--md-sys-motion-duration-short3) var(--md-sys-motion-easing-standard);
  -webkit-tap-highlight-color: transparent;
}

.panel-switch-bar__btn:hover {
  background: var(--md-sys-color-surface-container-highest);
}

.panel-switch-bar__btn:active {
  transform: scale(0.9);
}

.panel-switch-bar__btn--active {
  background: var(--md-sys-color-primary-container);
  color: var(--md-sys-color-on-primary-container);
}

.panel-switch-bar--dark .panel-switch-bar__btn--active {
  background: var(--md-sys-color-primary-container);
  color: var(--md-sys-color-on-primary-container);
}
</style>
