<script setup>
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { useBoardStore } from '@/stores/board'
import { useMobileStore } from '@/stores/mobile'
import { useViewportStore } from '@/stores/viewport'
import { usePerformanceModeStore } from '@/stores/performanceMode'
import { useDesignModeStore } from '@/stores/designMode'

const props = defineProps({
  isModernTheme: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['save', 'fit-to-content', 'open-profile', 'request-auth'])

const { t } = useI18n()
const authStore = useAuthStore()
const boardStore = useBoardStore()
const mobileStore = useMobileStore()
const viewportStore = useViewportStore()

const performanceModeStore = usePerformanceModeStore()
const designModeStore = useDesignModeStore()
const { mode: performanceMode, isView } = storeToRefs(performanceModeStore)
const { isAuroraDesign } = storeToRefs(designModeStore)
const performanceModeIcon = computed(() => {
  const icons = { full: '\uD83D\uDD34', light: '\uD83D\uDFE1', view: '\uD83D\uDFE2' }
  return icons[performanceMode.value] || '\uD83D\uDD34'
})

const { isSaving, currentBoardId, currentBoardName } = storeToRefs(boardStore)
const { isMenuScaled, menuScale } = storeToRefs(mobileStore)
const { zoomPercentage } = storeToRefs(viewportStore)
const zoomDisplay = computed(() => String(zoomPercentage.value ?? 0))
const isSaveAvailable = computed(() => {
  const boardName = (currentBoardName.value ?? '').trim()

  return boardName.length > 0
})

const saveTooltip = computed(() =>
  isSaveAvailable.value
    ? t('common.save')
    : t('board.savePrompt')
)

const handleSave = () => {
  if (!isSaveAvailable.value) {
    return
  }
  
  emit('save')
}

const openMarketingLink = () => {
  window.open('https://t.me/marketingFohow', '_blank')
}

const handleFitToContent = () => {
  emit('fit-to-content')
}

const handleProfileClick = () => {
  if (authStore.isAuthenticated) {
    emit('open-profile')
    return
  }

  emit('request-auth')
}
</script>

<template>
  <div
    class="mobile-toolbar"
    :class="{ 'mobile-toolbar--dark': isModernTheme, 'mobile-toolbar--scaled': isMenuScaled, 'mobile-toolbar--aurora': isAuroraDesign }"
    :style="{ '--menu-scale': menuScale }"  
    >
    <div class="mobile-toolbar-layout">
      <div class="mobile-toolbar-section mobile-toolbar-section--left">
        <!-- @marketingFohow -->
        <button
          class="mobile-toolbar-button marketing-button"
          type="button"
          @click="openMarketingLink"
          title="@marketingFohow"
          :aria-label="t('common.close')"
        >
          <svg class="marketing-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M21.543 2.47a1.25 1.25 0 0 0-1.303-.193L3.154 9.53c-.5.214-.82.7-.798 1.23.022.53.38.99.897 1.16l4.72 1.566 1.837 5.52c.18.54.68.905 1.25.923h.04c.56 0 1.06-.34 1.26-.86l1.68-4.32 4.66 3.54c.22.17.49.26.76.26.17 0 .34-.03.5-.1.39-.16.68-.5.78-.91l3.18-13.42c.13-.54-.12-1.1-.6-1.36Z"
              fill="currentColor"
            />
          </svg>
        </button>
      </div>

      <div class="mobile-toolbar-section mobile-toolbar-section--center">
        <!-- Текущий масштаб -->
        <button
          v-if="authStore.isAuthenticated"
          class="mobile-toolbar-button zoom-button"
          type="button"
          @click="handleFitToContent"
          :title="`${t('editor.zoom')}: ${zoomDisplay}%`"
          :aria-label="t('board.autoFitZoom')"
        >
          <span class="button-icon zoom-button__value" data-zoom-display>{{ zoomDisplay }}</span>
        </button>
        <!-- Переключатель режима производительности -->
        <button
          v-if="authStore.isAuthenticated"
          class="mobile-toolbar-button mode-button"
          type="button"
          @click="performanceModeStore.cycleMode()"
          :title="`Mode: ${performanceMode}`"
          aria-label="Performance mode"
        >
          <span class="button-icon">{{ performanceModeIcon }}</span>
        </button>
      </div>

      <div class="mobile-toolbar-section mobile-toolbar-section--right">
        <button
          v-if="!authStore.isAuthenticated"
          class="mobile-toolbar-button auth-button"
          type="button"
          @click="handleProfileClick"
          :title="t('auth.login')"
          :aria-label="t('auth.login')"
        >
          <span class="button-icon">👤</span>
        </button>

        <!-- Кнопка сохранения (скрыта в View-режиме) -->
        <button
          v-if="authStore.isAuthenticated && !isView"
          class="mobile-toolbar-button save-button"
          type="button"
          :disabled="isSaving || !isSaveAvailable"
          @click="handleSave"
          :title="saveTooltip"
          :aria-label="saveTooltip"
        >
          <span class="button-icon">💾</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ============================================================
   MobileToolbar — Material Design 3 style
   Uses global M3 tokens from m3-tokens.css
   ============================================================ */

.mobile-toolbar {
  position: fixed;
  bottom: env(safe-area-inset-bottom, 0);
  left: 0;
  right: 0;
  height: 56px;
  background: transparent;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  display: flex;
  align-items: center;
  padding: 0 8px;
  padding-left: calc(8px + env(safe-area-inset-left, 0));
  padding-right: calc(8px + env(safe-area-inset-right, 0));
  z-index: 1000;
  pointer-events: none;
}

.mobile-toolbar--dark {
  background: transparent;
}

.mobile-toolbar-layout {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.mobile-toolbar-section {
  display: flex;
  align-items: center;
  gap: 8px;
}

.mobile-toolbar-section--left,
.mobile-toolbar-section--right {
  flex: 0 0 auto;
}

.mobile-toolbar-section--center {
  flex: 1 1 auto;
  justify-content: center;
}

.mobile-toolbar-section--right {
  margin-left: auto;
}

/* --- Base button (tonal filled, pill shape) --- */
.mobile-toolbar-button {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  width: 44px;
  height: 44px;
  border: none;
  border-radius: var(--md-sys-shape-corner-full);
  background: var(--md-sys-color-surface-container-high);
  color: var(--md-sys-color-on-surface);
  cursor: pointer;
  transition:
    background var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-standard),
    box-shadow var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-standard),
    transform var(--md-sys-motion-duration-short3) var(--md-sys-motion-easing-standard),
    opacity var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-standard);
  user-select: none;
  box-shadow: var(--md-sys-elevation-1);
  text-decoration: none;
  flex-shrink: 0;
  transform: scale(var(--menu-scale, 1));
  pointer-events: auto;
  overflow: hidden;
  -webkit-tap-highlight-color: transparent;
}

/* State layer (pseudo-element for M3 hover/active tints) */
.mobile-toolbar-button::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: var(--md-sys-color-on-surface);
  opacity: 0;
  transition: opacity var(--md-sys-motion-duration-short3) var(--md-sys-motion-easing-standard);
  pointer-events: none;
}

.mobile-toolbar--scaled .mobile-toolbar-button {
  transform: scale(var(--menu-scale, 1));
}

.mobile-toolbar--scaled .mobile-toolbar-section {
  gap: 12px;
}

/* Dark mode base button */
.mobile-toolbar--dark .mobile-toolbar-button {
  background: var(--md-sys-color-surface-container-high);
  color: var(--md-sys-color-on-surface);
  box-shadow: var(--md-sys-elevation-1);
}

/* Hover: 8% state layer tint */
.mobile-toolbar-button:hover:not(:disabled)::after {
  opacity: var(--md-sys-state-hover-opacity);
}

.mobile-toolbar-button:hover:not(:disabled) {
  box-shadow: var(--md-sys-elevation-2);
}

/* Active: scale down + 12% state layer */
.mobile-toolbar-button:active:not(:disabled)::after {
  opacity: var(--md-sys-state-pressed-opacity);
}

.mobile-toolbar-button:active:not(:disabled) {
  transform: scale(calc(var(--menu-scale, 1) * 0.95));
  box-shadow: var(--md-sys-elevation-1);
}

/* Disabled */
.mobile-toolbar-button:disabled {
  opacity: var(--md-sys-state-disabled-opacity);
  cursor: not-allowed;
  box-shadow: var(--md-sys-elevation-0);
}

.mobile-toolbar-button:disabled::after {
  display: none;
}

.button-icon {
  font-size: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* --- Marketing button (primary filled) --- */
.marketing-button {
  background: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
  box-shadow: var(--md-sys-elevation-1);
}

.marketing-button::after {
  background: var(--md-sys-color-on-primary);
}

.mobile-toolbar--dark .marketing-button {
  background: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
}

.marketing-icon {
  width: 20px;
  height: 20px;
}

/* --- Zoom button (surface, wider for numbers) --- */
.zoom-button {
  min-width: 52px;
  padding: 0 6px;
  font-variant-numeric: tabular-nums;
}

.zoom-button__value {
  font-size: 18px;
  font-weight: 600;
}

/* --- Auth button (same surface treatment) --- */
.auth-button {
  background: var(--md-sys-color-surface-container-high);
}

/* --- Save button (same surface treatment as other buttons) --- */
.save-button {
  background: var(--md-sys-color-surface-container-high);
  color: var(--md-sys-color-on-surface);
  box-shadow: var(--md-sys-elevation-1);
}

/* --- Mode button (same surface treatment) --- */
.mode-button {
  background: var(--md-sys-color-surface-container-high);
}

/* --- Responsive: small screens --- */
@media (max-width: 480px) {
  .mobile-toolbar {
    height: 52px;
    padding: 0 6px;
  }

  .mobile-toolbar-layout,
  .mobile-toolbar-section {
    gap: 6px;
  }

  .mobile-toolbar-button {
    min-width: 40px;
    width: 40px;
    height: 40px;
  }

  .button-icon {
    font-size: 18px;
  }
}

/* ============================================================
   AURORA DESIGN — Floating Glass Island
   ============================================================ */

.mobile-toolbar--aurora .mobile-toolbar-layout {
  background: rgba(8, 12, 20, 0.6);
  backdrop-filter: blur(24px) saturate(1.3);
  -webkit-backdrop-filter: blur(24px) saturate(1.3);
  border-radius: 28px;
  padding: 6px 12px;
  margin: 0 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.3),
    0 0 0 0.5px rgba(255, 255, 255, 0.06) inset;
  position: relative;
  font-family: 'Manrope', system-ui, -apple-system, sans-serif;
}

/* Aurora gradient border glow */
.mobile-toolbar--aurora .mobile-toolbar-layout::before {
  content: '';
  position: absolute;
  inset: -1px;
  border-radius: inherit;
  background: linear-gradient(135deg, rgba(0, 212, 170, 0.2), rgba(0, 136, 255, 0.15), rgba(139, 92, 246, 0.2));
  z-index: -1;
  filter: blur(1px);
  opacity: 0.5;
}

.mobile-toolbar--aurora .mobile-toolbar-button {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.85);
  box-shadow: none;
}

.mobile-toolbar--aurora .mobile-toolbar-button::after {
  background: rgba(255, 255, 255, 0.1);
}

.mobile-toolbar--aurora .mobile-toolbar-button:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(0, 212, 170, 0.2);
  box-shadow: 0 0 12px rgba(0, 212, 170, 0.08);
}

.mobile-toolbar--aurora .mobile-toolbar-button:active:not(:disabled) {
  background: rgba(255, 255, 255, 0.12);
  box-shadow: none;
}

/* Aurora marketing button */
.mobile-toolbar--aurora .marketing-button {
  background: linear-gradient(135deg, rgba(0, 212, 170, 0.25), rgba(0, 136, 255, 0.25));
  border-color: rgba(0, 212, 170, 0.3);
  color: #00d4aa;
}

.mobile-toolbar--aurora .marketing-button:hover:not(:disabled) {
  box-shadow: 0 0 16px rgba(0, 212, 170, 0.15);
}

.mobile-toolbar--aurora .marketing-button::after {
  background: rgba(0, 212, 170, 0.15);
}

/* Aurora save button */
.mobile-toolbar--aurora .save-button {
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.85);
  box-shadow: none;
}

/* Aurora zoom button */
.mobile-toolbar--aurora .zoom-button__value {
  color: rgba(0, 212, 170, 0.9);
  font-family: 'Manrope', system-ui, sans-serif;
  font-weight: 700;
  letter-spacing: -0.02em;
}
</style>
