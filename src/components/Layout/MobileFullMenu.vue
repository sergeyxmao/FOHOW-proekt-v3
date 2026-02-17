<script setup>
import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useViewSettingsStore } from '@/stores/viewSettings'
import { useSidePanelsStore } from '@/stores/sidePanels'
import { useMobileStore } from '@/stores/mobile'
import { useBoardStore } from '@/stores/board'
import { useStickersStore } from '@/stores/stickers'
import { useDesignModeStore } from '@/stores/designMode'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  isDark: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits([
  'close',
  'activate-pencil',
  'toggle-theme',
  'clear-canvas',
  'new-structure'
])

const { t, locale } = useI18n()
const viewSettingsStore = useViewSettingsStore()
const sidePanelsStore = useSidePanelsStore()
const mobileStore = useMobileStore()
const boardStore = useBoardStore()
const stickersStore = useStickersStore()
const designModeStore = useDesignModeStore()
const { isAuroraDesign } = storeToRefs(designModeStore)

const {
  lineColor,
  lineThickness,
  isAnimationEnabled,
  animationSeconds,
  isGlobalLineMode,
  headerColor,
  headerColorIndex,
  backgroundGradient
} = storeToRefs(viewSettingsStore)

// Accordion state
const openSections = ref({ tools: false, view: false, discussion: false })

const toggleSection = (key) => {
  const wasOpen = openSections.value[key]
  // Закрываем все секции
  openSections.value = { tools: false, view: false, discussion: false }
  // Если была закрыта — открываем, если была открыта — оставляем закрытой
  if (!wasOpen) {
    openSections.value[key] = true
  }
}

// --- Tools actions ---
const handlePencil = () => {
  emit('activate-pencil')
  emit('close')
}

const handleToggleTheme = () => {
  emit('toggle-theme')
  emit('close')
}

const handleToggleVersion = () => {
  if (mobileStore.isMobileMode) {
    mobileStore.switchToDesktop()
  } else {
    mobileStore.switchToMobile()
  }
  emit('close')
}

const handleClearCanvas = () => {
  if (confirm(t('mobileMenu.clearConfirm'))) {
    emit('clear-canvas')
    emit('close')
  }
}

const handleNewStructure = () => {
  if (confirm(t('mobileMenu.newStructureConfirm'))) {
    emit('new-structure')
    emit('close')
  }
}

// --- View: Lines ---
const lineColorInput = ref(null)
const openLineColorPicker = () => {
  lineColorInput.value?.click()
}
const handleLineColorChange = (e) => {
  viewSettingsStore.setLineColor(e.target.value)
}
const handleLineThicknessChange = (e) => {
  viewSettingsStore.setLineThickness(Number(e.target.value))
}

// --- View: Animation ---
const handleAnimationToggle = () => {
  viewSettingsStore.toggleAnimation()
}
const handleAnimationSecondsChange = (e) => {
  const val = Number(e.target.value)
  if (Number.isFinite(val) && val >= 2 && val <= 999) {
    viewSettingsStore.setAnimationSeconds(val)
  }
}

// --- View: Background ---
const bgColorInput = ref(null)
const openBgColorPicker = () => {
  bgColorInput.value?.click()
}
const selectPresetBg = (color) => {
  viewSettingsStore.setBackground(color)
}
const handleBgChange = (e) => {
  viewSettingsStore.setBackground(e.target.value)
}

// --- View: Header color ---
const headerColorInput = ref(null)
const openHeaderColorPicker = () => {
  headerColorInput.value?.click()
}
const handleHeaderColorChange = (e) => {
  viewSettingsStore.setHeaderColor(e.target.value)
}
const handleCycleHeaderColor = () => {
  viewSettingsStore.cycleHeaderColor()
}

// --- View: Language ---
const changeLocale = (newLocale) => {
  locale.value = newLocale
  try {
    localStorage.setItem('locale', newLocale)
  } catch (e) {
    // ignore
  }
}

// --- Discussion actions ---
const handleTogglePartners = () => {
  sidePanelsStore.togglePartners()
  emit('close')
}
const handleToggleNotes = () => {
  sidePanelsStore.toggleNotes()
  emit('close')
}
const handleToggleImages = () => {
  sidePanelsStore.toggleImages()
  emit('close')
}
const handleToggleComments = () => {
  sidePanelsStore.toggleComments()
  emit('close')
}
const handleToggleAnchors = () => {
  sidePanelsStore.toggleAnchors()
  emit('close')
}
const handleAddAnchor = () => {
  stickersStore.disablePlacementMode()
  boardStore.setPlacementMode(boardStore.placementMode === 'anchor' ? null : 'anchor')
  emit('close')
}
const handleToggleStickers = () => {
  sidePanelsStore.toggleStickerMessages()
  emit('close')
}
const handleAddSticker = () => {
  boardStore.setPlacementMode(null)
  stickersStore.enablePlacementMode()
  emit('close')
}

const handleOverlayClick = () => {
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <transition name="fullmenu-fade">
      <div
        v-if="visible"
        class="fullmenu-overlay"
        :class="{ 'fullmenu-overlay--dark': isDark, 'fullmenu-overlay--aurora': isAuroraDesign }"
        @click.self="handleOverlayClick"
      >
        <transition name="fullmenu-slide">
          <div
            v-if="visible"
            class="fullmenu-panel"
            :class="{ 'fullmenu-panel--dark': isDark, 'fullmenu-panel--aurora': isAuroraDesign }"
          >
            <!-- Header -->
            <div class="fullmenu-header">
              <span class="fullmenu-header__title">{{ t('mobile.menu') }}</span>
              <button class="fullmenu-close" type="button" @click="emit('close')">✕</button>
            </div>

            <!-- Scrollable content -->
            <div class="fullmenu-content">

              <!-- ========== TOOLS SECTION ========== -->
              <div class="fullmenu-section">
                <button
                  class="fullmenu-section__toggle"
                  type="button"
                  @click="toggleSection('tools')"
                >
                  <span class="fullmenu-section__icon">🛠️</span>
                  <span class="fullmenu-section__label">{{ t('topMenu.tools') }}</span>
                  <span
                    class="fullmenu-section__arrow"
                    :class="{ 'fullmenu-section__arrow--open': openSections.tools }"
                  >▸</span>
                </button>

                <div v-if="openSections.tools" class="fullmenu-section__body">
                  <button class="fullmenu-item" type="button" @click="handlePencil">
                    <span class="fullmenu-item__icon">✏️</span>
                    <span>{{ t('mobileMenu.drawing') }}</span>
                  </button>
                  <button class="fullmenu-item fullmenu-item--danger" type="button" @click="handleClearCanvas">
                    <span class="fullmenu-item__icon">🧹</span>
                    <span>{{ t('toolsMenu.clearCanvas') }}</span>
                  </button>
                  <button class="fullmenu-item" type="button" @click="handleNewStructure">
                    <span class="fullmenu-item__icon">📄</span>
                    <span>{{ t('toolsMenu.newStructure') }}</span>
                  </button>
                </div>
              </div>

              <!-- ========== VIEW SECTION ========== -->
              <div class="fullmenu-section">
                <button
                  class="fullmenu-section__toggle"
                  type="button"
                  @click="toggleSection('view')"
                >
                  <span class="fullmenu-section__icon">👁️</span>
                  <span class="fullmenu-section__label">{{ t('topMenu.view') }}</span>
                  <span
                    class="fullmenu-section__arrow"
                    :class="{ 'fullmenu-section__arrow--open': openSections.view }"
                  >▸</span>
                </button>

                <div v-if="openSections.view" class="fullmenu-section__body">

                  <!-- Lines -->
                  <div class="fullmenu-subsection">
                    <div class="fullmenu-subsection__header">{{ t('viewMenu.lines') }}</div>
                    <div class="fullmenu-row">
                      <button
                        class="fullmenu-chip"
                        :class="{ 'fullmenu-chip--active': isGlobalLineMode }"
                        type="button"
                        @click="viewSettingsStore.toggleGlobalLineMode()"
                      >{{ t('mobileMenu.allLines') }}</button>
                      <button
                        class="fullmenu-swatch"
                        type="button"
                        :style="{ background: lineColor }"
                        @click="openLineColorPicker"
                        :title="t('mobileMenu.lineColor')"
                      ></button>
                      <input
                        ref="lineColorInput"
                        type="color"
                        class="fullmenu-hidden-input"
                        :value="lineColor"
                        @input="handleLineColorChange"
                      >
                      <label class="fullmenu-range-label">
                        <span>{{ lineThickness }}px</span>
                        <input
                          type="range"
                          class="fullmenu-range"
                          :value="lineThickness"
                          @input="handleLineThicknessChange"
                          min="1"
                          max="20"
                          step="1"
                        >
                      </label>
                    </div>
                  </div>

                  <!-- Animation -->
                  <div class="fullmenu-subsection">
                    <div class="fullmenu-subsection__header">{{ t('viewMenu.animation') }}</div>
                    <div class="fullmenu-row">
                      <button
                        class="fullmenu-chip"
                        :class="{ 'fullmenu-chip--active': isAnimationEnabled }"
                        type="button"
                        @click="handleAnimationToggle"
                      >{{ isAnimationEnabled ? t('mobileMenu.on') : t('mobileMenu.off') }}</button>
                      <label class="fullmenu-inline-input">
                        <input
                          type="number"
                          class="fullmenu-input"
                          :value="animationSeconds"
                          @change="handleAnimationSecondsChange"
                          min="2"
                          max="999"
                          step="1"
                        >
                        <span class="fullmenu-inline-input__unit">{{ t('mobileMenu.sec') }}</span>
                      </label>
                    </div>
                  </div>

                  <!-- Background -->
                  <div class="fullmenu-subsection">
                    <div class="fullmenu-subsection__header">{{ t('viewMenu.background') }}</div>
                    <div class="fullmenu-row">
                      <button
                        class="fullmenu-swatch fullmenu-swatch--preset"
                        type="button"
                        style="background: #f5f7fb"
                        @click="selectPresetBg('#f5f7fb')"
                        :title="t('mobileMenu.lightBg')"
                      ></button>
                      <button
                        class="fullmenu-swatch fullmenu-swatch--preset"
                        type="button"
                        style="background: #111827"
                        @click="selectPresetBg('#111827')"
                        :title="t('mobileMenu.darkBg')"
                      ></button>
                      <button
                        class="fullmenu-swatch"
                        type="button"
                        :style="{ background: backgroundGradient }"
                        @click="openBgColorPicker"
                        :title="t('mobileMenu.customColor')"
                      >🎨</button>
                      <input
                        ref="bgColorInput"
                        type="color"
                        class="fullmenu-hidden-input"
                        @input="handleBgChange"
                      >
                    </div>
                  </div>

                  <!-- Header color -->
                  <div class="fullmenu-subsection">
                    <div class="fullmenu-subsection__header">{{ t('viewMenu.headerColor') }}</div>
                    <div class="fullmenu-row">
                      <button
                        class="fullmenu-swatch"
                        type="button"
                        :style="{ background: headerColor }"
                        @click="openHeaderColorPicker"
                        :title="t('mobileMenu.selectColor')"
                      ></button>
                      <input
                        ref="headerColorInput"
                        type="color"
                        class="fullmenu-hidden-input"
                        :value="headerColor"
                        @input="handleHeaderColorChange"
                      >
                      <button class="fullmenu-chip" type="button" @click="handleCycleHeaderColor">
                        {{ t('mobileMenu.change') }}
                      </button>
                      <span class="fullmenu-muted">#{{ headerColorIndex }}</span>
                    </div>
                  </div>

                  <!-- Language -->
                  <div class="fullmenu-subsection">
                    <div class="fullmenu-subsection__header">{{ t('viewMenu.language') }}</div>
                    <div class="fullmenu-row">
                      <button
                        class="fullmenu-chip"
                        :class="{ 'fullmenu-chip--active': locale === 'ru' }"
                        type="button"
                        @click="changeLocale('ru')"
                      >🇷🇺</button>
                      <button
                        class="fullmenu-chip"
                        :class="{ 'fullmenu-chip--active': locale === 'en' }"
                        type="button"
                        @click="changeLocale('en')"
                      >🇬🇧</button>
                      <button
                        class="fullmenu-chip"
                        :class="{ 'fullmenu-chip--active': locale === 'zh' }"
                        type="button"
                        @click="changeLocale('zh')"
                      >🇨🇳</button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- ========== DISCUSSION SECTION ========== -->
              <div class="fullmenu-section">
                <button
                  class="fullmenu-section__toggle"
                  type="button"
                  @click="toggleSection('discussion')"
                >
                  <span class="fullmenu-section__icon">💬</span>
                  <span class="fullmenu-section__label">{{ t('discussionMenu.title') }}</span>
                  <span
                    class="fullmenu-section__arrow"
                    :class="{ 'fullmenu-section__arrow--open': openSections.discussion }"
                  >▸</span>
                </button>

                <div v-if="openSections.discussion" class="fullmenu-section__body">
                  <button class="fullmenu-item" type="button" @click="handleTogglePartners">
                    <span class="fullmenu-item__icon">👤</span>
                    <span>{{ t('mobileMenu.partners') }}</span>
                  </button>
                  <button class="fullmenu-item" type="button" @click="handleToggleNotes">
                    <span class="fullmenu-item__icon">📅</span>
                    <span>{{ t('mobileMenu.notes') }}</span>
                  </button>
                  <button class="fullmenu-item" type="button" @click="handleToggleImages">
                    <span class="fullmenu-item__icon">🖼️</span>
                    <span>{{ t('mobileMenu.images') }}</span>
                  </button>
                  <button class="fullmenu-item" type="button" @click="handleToggleComments">
                    <span class="fullmenu-item__icon">💬</span>
                    <span>{{ t('mobileMenu.comments') }}</span>
                  </button>
                  <div class="fullmenu-item-row">
                    <button class="fullmenu-item fullmenu-item--grow" type="button" @click="handleToggleAnchors">
                      <span class="fullmenu-item__icon">🧭</span>
                      <span>{{ t('discussionMenu.geolocation') }}</span>
                    </button>
                    <button class="fullmenu-add-btn" type="button" @click="handleAddAnchor" :title="t('mobileMenu.addToCanvas')">
                      ＋
                    </button>
                  </div>
                  <div class="fullmenu-item-row">
                    <button class="fullmenu-item fullmenu-item--grow" type="button" @click="handleToggleStickers">
                      <span class="fullmenu-item__icon">📌</span>
                      <span>{{ t('mobileMenu.stickers') }}</span>
                    </button>
                    <button class="fullmenu-add-btn" type="button" @click="handleAddSticker" :title="t('mobileMenu.addToCanvas')">
                      ＋
                    </button>
                  </div>
                </div>
              </div>

              <!-- Нижние кнопки-переключатели -->
              <div class="fullmenu-bottom-actions">
                <!-- Переключатель дизайна -->
                <button
                  class="fullmenu-aurora-toggle"
                  :class="{ 'fullmenu-aurora-toggle--active': isAuroraDesign }"
                  type="button"
                  @click="designModeStore.toggleDesign()"
                >
                  <span class="fullmenu-aurora-toggle__glow"></span>
                  <span class="fullmenu-aurora-toggle__label">
                    ✦ {{ t('mobileMenu.themeAurora') }}
                  </span>
                </button>

                <!-- Переключатель светлой/тёмной темы -->
                <button
                  class="fullmenu-theme-toggle"
                  :class="{ 'fullmenu-theme-toggle--dark': isDark, 'fullmenu-theme-toggle--aurora': isAuroraDesign }"
                  type="button"
                  @click="handleToggleTheme"
                >
                  <span class="fullmenu-theme-toggle__icon" aria-hidden="true"></span>
                  <span class="fullmenu-theme-toggle__label">{{ isDark ? t('mobileMenu.lightTheme') : t('mobileMenu.darkTheme') }}</span>
                </button>

                <!-- Версия для ПК -->
                <button
                  class="fullmenu-theme-toggle"
                  :class="{ 'fullmenu-theme-toggle--aurora': isAuroraDesign }"
                  type="button"
                  @click="handleToggleVersion"
                >
                  <span class="fullmenu-theme-toggle__pc-icon" aria-hidden="true">💻</span>
                  <span class="fullmenu-theme-toggle__label">{{ t('mobileMenu.desktopVersion') }}</span>
                </button>
              </div>

            </div>
          </div>
        </transition>
      </div>
    </transition>
  </Teleport>
</template>

<style scoped>
/* ============================================================
   MobileFullMenu — Material Design 3 slide-out panel
   Teleported to <body>, uses --md-ref-* tokens directly
   ============================================================ */

/* --- Overlay (scrim) --- */
.fullmenu-overlay {
  position: fixed;
  inset: 0;
  background: color-mix(in srgb, var(--md-ref-neutral-10) 32%, transparent);
  z-index: 2500;
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.fullmenu-overlay--dark {
  background: color-mix(in srgb, var(--md-ref-neutral-0) 55%, transparent);
}

/* --- Panel --- */
.fullmenu-panel {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  width: min(50vw, 280px);
  background: color-mix(in srgb, var(--md-ref-neutral-98) 78%, transparent);
  backdrop-filter: blur(20px) saturate(1.4);
  -webkit-backdrop-filter: blur(20px) saturate(1.4);
  color: var(--md-ref-neutral-10);
  box-shadow: var(--md-sys-elevation-4);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-right: 1px solid color-mix(in srgb, var(--md-ref-neutral-10) 8%, transparent);
}

.fullmenu-panel--dark {
  background: color-mix(in srgb, var(--md-ref-neutral-12) 72%, transparent);
  color: var(--md-ref-neutral-90);
  border-right: 1px solid color-mix(in srgb, var(--md-ref-neutral-variant-60) 15%, transparent);
}

/* --- Header --- */
.fullmenu-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid color-mix(in srgb, var(--md-ref-neutral-10) 10%, transparent);
  flex-shrink: 0;
}

.fullmenu-panel--dark .fullmenu-header {
  border-bottom-color: color-mix(in srgb, var(--md-ref-neutral-90) 12%, transparent);
}

.fullmenu-header__title {
  font-size: 17px;
  font-weight: 700;
  letter-spacing: 0.3px;
}

.fullmenu-close {
  width: 32px;
  height: 32px;
  border-radius: var(--md-sys-shape-corner-full);
  border: none;
  background: color-mix(in srgb, var(--md-ref-neutral-10) 8%, transparent);
  color: inherit;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-standard);
}

.fullmenu-panel--dark .fullmenu-close {
  background: color-mix(in srgb, var(--md-ref-neutral-90) 12%, transparent);
}

.fullmenu-close:hover {
  background: color-mix(in srgb, var(--md-ref-neutral-10) 16%, transparent);
}

.fullmenu-panel--dark .fullmenu-close:hover {
  background: color-mix(in srgb, var(--md-ref-neutral-90) 20%, transparent);
}

/* --- Scrollable content --- */
.fullmenu-content {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
  -webkit-overflow-scrolling: touch;
}

/* --- Section (accordion) --- */
.fullmenu-section {
  border-bottom: 1px solid color-mix(in srgb, var(--md-ref-neutral-10) 6%, transparent);
}

.fullmenu-panel--dark .fullmenu-section {
  border-bottom-color: color-mix(in srgb, var(--md-ref-neutral-90) 8%, transparent);
}

.fullmenu-section__toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 12px 14px;
  border: none;
  background: transparent;
  color: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  min-height: 48px;
  transition: background var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-standard);
}

.fullmenu-section__toggle:hover {
  background: color-mix(in srgb, var(--md-ref-neutral-10) 5%, transparent);
}

.fullmenu-panel--dark .fullmenu-section__toggle:hover {
  background: color-mix(in srgb, var(--md-ref-neutral-90) 8%, transparent);
}

.fullmenu-section__icon {
  font-size: 17px;
  flex-shrink: 0;
}

.fullmenu-section__label {
  flex: 1;
  text-align: left;
}

.fullmenu-section__arrow {
  font-size: 14px;
  opacity: 0.6;
  transition: transform var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-standard);
}

.fullmenu-section__arrow--open {
  transform: rotate(90deg);
}

/* --- Section body --- */
.fullmenu-section__body {
  padding: 4px 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

/* --- Menu item (button) --- */
.fullmenu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px 10px;
  border: none;
  border-radius: var(--md-sys-shape-corner-medium);
  background: color-mix(in srgb, var(--md-ref-neutral-10) 4%, transparent);
  color: inherit;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  min-height: 42px;
  transition:
    background var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-standard),
    transform var(--md-sys-motion-duration-short3) var(--md-sys-motion-easing-standard);
  text-align: left;
}

.fullmenu-panel--dark .fullmenu-item {
  background: color-mix(in srgb, var(--md-ref-neutral-90) 5%, transparent);
}

.fullmenu-item:hover {
  background: var(--md-ref-primary-90);
  color: var(--md-ref-primary-10);
}

.fullmenu-panel--dark .fullmenu-item:hover {
  background: var(--md-ref-primary-30);
  color: var(--md-ref-primary-90);
}

.fullmenu-item:active {
  transform: scale(0.98);
}

.fullmenu-item--active {
  background: color-mix(in srgb, var(--md-ref-primary-40) 15%, transparent);
}

.fullmenu-panel--dark .fullmenu-item--active {
  background: color-mix(in srgb, var(--md-ref-primary-80) 15%, transparent);
}

.fullmenu-item--danger:hover {
  background: var(--md-ref-error-90);
  color: var(--md-ref-error-10);
}

.fullmenu-panel--dark .fullmenu-item--danger:hover {
  background: var(--md-ref-error-30);
  color: var(--md-ref-error-90);
}

.fullmenu-item__icon {
  font-size: 15px;
  flex-shrink: 0;
  width: 20px;
  text-align: center;
}

.fullmenu-item__badge {
  margin-left: auto;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: var(--md-sys-shape-corner-full);
  background: var(--md-ref-primary-90);
  color: var(--md-ref-primary-10);
}

.fullmenu-panel--dark .fullmenu-item__badge {
  background: var(--md-ref-primary-30);
  color: var(--md-ref-primary-90);
}

/* --- Item row (item + add button) --- */
.fullmenu-item-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.fullmenu-item--grow {
  flex: 1;
  min-width: 0;
}

.fullmenu-add-btn {
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  border: 1px solid color-mix(in srgb, var(--md-ref-primary-40) 30%, transparent);
  border-radius: var(--md-sys-shape-corner-medium);
  background: color-mix(in srgb, var(--md-ref-primary-40) 10%, transparent);
  color: var(--md-ref-primary-40);
  font-size: 18px;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    background var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-standard),
    transform var(--md-sys-motion-duration-short3) var(--md-sys-motion-easing-standard);
}

.fullmenu-add-btn:hover {
  background: var(--md-ref-primary-90);
  color: var(--md-ref-primary-10);
}

.fullmenu-add-btn:active {
  transform: scale(0.92);
}

.fullmenu-panel--dark .fullmenu-add-btn {
  border-color: color-mix(in srgb, var(--md-ref-primary-80) 30%, transparent);
  background: color-mix(in srgb, var(--md-ref-primary-80) 10%, transparent);
  color: var(--md-ref-primary-80);
}

.fullmenu-panel--dark .fullmenu-add-btn:hover {
  background: var(--md-ref-primary-30);
  color: var(--md-ref-primary-90);
}

/* --- Subsection (within View) --- */
.fullmenu-subsection {
  padding: 8px 0;
}

.fullmenu-subsection__header {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  opacity: 0.6;
  padding: 0 6px 6px;
}

/* --- Row (horizontal items) --- */
.fullmenu-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 6px;
  flex-wrap: wrap;
}

/* --- Chip (small toggle button) --- */
.fullmenu-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px 10px;
  border: 1px solid color-mix(in srgb, var(--md-ref-neutral-10) 12%, transparent);
  border-radius: var(--md-sys-shape-corner-full);
  background: transparent;
  color: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  min-height: 32px;
  transition:
    background var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-standard),
    border-color var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-standard),
    color var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-standard);
}

.fullmenu-panel--dark .fullmenu-chip {
  border-color: color-mix(in srgb, var(--md-ref-neutral-90) 20%, transparent);
}

.fullmenu-chip:hover {
  background: color-mix(in srgb, var(--md-ref-neutral-10) 8%, transparent);
}

.fullmenu-panel--dark .fullmenu-chip:hover {
  background: color-mix(in srgb, var(--md-ref-neutral-90) 12%, transparent);
}

.fullmenu-chip--active {
  background: var(--md-ref-primary-90);
  color: var(--md-ref-primary-10);
  border-color: var(--md-ref-primary-40);
}

.fullmenu-panel--dark .fullmenu-chip--active {
  background: var(--md-ref-primary-30);
  color: var(--md-ref-primary-90);
  border-color: var(--md-ref-primary-80);
}

/* --- Color swatch --- */
.fullmenu-swatch {
  width: 30px;
  height: 30px;
  border-radius: var(--md-sys-shape-corner-small);
  border: 2px solid color-mix(in srgb, var(--md-ref-neutral-10) 15%, transparent);
  cursor: pointer;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  transition: transform var(--md-sys-motion-duration-short3) var(--md-sys-motion-easing-standard);
}

.fullmenu-panel--dark .fullmenu-swatch {
  border-color: color-mix(in srgb, var(--md-ref-neutral-90) 25%, transparent);
}

.fullmenu-swatch:hover {
  transform: scale(1.1);
}

.fullmenu-swatch:active {
  transform: scale(0.95);
}

.fullmenu-swatch--preset {
  width: 28px;
  height: 28px;
  border-radius: var(--md-sys-shape-corner-small);
}

/* Hidden color input */
.fullmenu-hidden-input {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
}

/* --- Inline input (number) --- */
.fullmenu-inline-input {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 500;
}

.fullmenu-inline-input__label {
  opacity: 0.7;
}

.fullmenu-inline-input__unit {
  opacity: 0.6;
  font-size: 12px;
}

.fullmenu-input {
  width: 50px;
  padding: 4px 6px;
  border: 1px solid color-mix(in srgb, var(--md-ref-neutral-10) 15%, transparent);
  border-radius: var(--md-sys-shape-corner-small);
  background: color-mix(in srgb, var(--md-ref-neutral-10) 4%, transparent);
  color: inherit;
  font-size: 13px;
  font-weight: 600;
  text-align: center;
  outline: none;
  transition: border-color var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-standard);
}

.fullmenu-panel--dark .fullmenu-input {
  background: color-mix(in srgb, var(--md-ref-neutral-90) 8%, transparent);
  border-color: color-mix(in srgb, var(--md-ref-neutral-90) 20%, transparent);
}

.fullmenu-input:focus {
  border-color: var(--md-ref-primary-40);
}

.fullmenu-panel--dark .fullmenu-input:focus {
  border-color: var(--md-ref-primary-80);
}

/* --- Range slider --- */
.fullmenu-range-label {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  font-size: 13px;
  font-weight: 600;
  min-width: 0;
}

.fullmenu-range {
  flex: 1;
  min-width: 80px;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: color-mix(in srgb, var(--md-ref-neutral-10) 15%, transparent);
  border-radius: 2px;
  outline: none;
}

.fullmenu-panel--dark .fullmenu-range {
  background: color-mix(in srgb, var(--md-ref-neutral-90) 20%, transparent);
}

.fullmenu-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--md-ref-primary-40);
  cursor: pointer;
  border: none;
}

.fullmenu-panel--dark .fullmenu-range::-webkit-slider-thumb {
  background: var(--md-ref-primary-80);
}

.fullmenu-range::-moz-range-thumb {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--md-ref-primary-40);
  cursor: pointer;
  border: none;
}

.fullmenu-panel--dark .fullmenu-range::-moz-range-thumb {
  background: var(--md-ref-primary-80);
}

/* --- Muted text --- */
.fullmenu-muted {
  font-size: 12px;
  opacity: 0.5;
  font-weight: 500;
}

/* ============================================================
   TRANSITIONS
   ============================================================ */

/* Overlay fade */
.fullmenu-fade-enter-active,
.fullmenu-fade-leave-active {
  transition: opacity var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-standard);
}

.fullmenu-fade-enter-from,
.fullmenu-fade-leave-to {
  opacity: 0;
}

/* Panel slide from left */
.fullmenu-slide-enter-active {
  transition: transform var(--md-sys-motion-duration-medium2) var(--md-sys-motion-easing-emphasized-decelerate);
}

.fullmenu-slide-leave-active {
  transition: transform var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-emphasized-accelerate);
}

.fullmenu-slide-enter-from,
.fullmenu-slide-leave-to {
  transform: translateX(-100%);
}

/* ============================================================
   AURORA DESIGN — Spatial Glass Theme
   ============================================================ */

/* --- Bottom actions container --- */
.fullmenu-bottom-actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px 14px 8px;
}

.fullmenu-bottom-actions .fullmenu-aurora-toggle,
.fullmenu-bottom-actions .fullmenu-theme-toggle {
  margin-top: 0;
}

/* --- Aurora Toggle Button --- */
.fullmenu-aurora-toggle {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 48px;
  margin-top: 16px;
  padding: 12px 20px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 14px;
  background: linear-gradient(135deg, rgba(0, 212, 170, 0.08), rgba(0, 136, 255, 0.08), rgba(139, 92, 246, 0.08));
  color: var(--md-ref-neutral-30);
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  overflow: hidden;
  transition: all 0.3s ease;
  -webkit-tap-highlight-color: transparent;
}

.fullmenu-panel--dark .fullmenu-aurora-toggle {
  color: rgba(255, 255, 255, 0.85);
  border-color: rgba(255, 255, 255, 0.12);
}

.fullmenu-aurora-toggle:hover {
  border-color: rgba(0, 212, 170, 0.3);
  box-shadow: 0 0 24px rgba(0, 212, 170, 0.12);
}

.fullmenu-aurora-toggle--active {
  background: linear-gradient(135deg, rgba(0, 212, 170, 0.2), rgba(0, 136, 255, 0.2), rgba(139, 92, 246, 0.2));
  border-color: rgba(0, 212, 170, 0.4);
  box-shadow: 0 0 30px rgba(0, 212, 170, 0.15), inset 0 0 20px rgba(0, 136, 255, 0.05);
  color: #00d4aa;
}

.fullmenu-aurora-toggle__glow {
  position: absolute;
  inset: -1px;
  border-radius: inherit;
  background: linear-gradient(135deg, #00d4aa, #0088ff, #8b5cf6);
  opacity: 0;
  transition: opacity 0.4s ease;
  z-index: -1;
  filter: blur(8px);
}

.fullmenu-aurora-toggle--active .fullmenu-aurora-toggle__glow {
  opacity: 0.25;
}

.fullmenu-aurora-toggle__label {
  position: relative;
  z-index: 1;
  letter-spacing: 0.5px;
}

/* --- Theme Toggle Button (light/dark) --- */
.fullmenu-theme-toggle {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 44px;
  margin-top: 8px;
  padding: 10px 20px;
  border: 1px solid color-mix(in srgb, var(--md-ref-neutral-10) 10%, transparent);
  border-radius: 14px;
  background: color-mix(in srgb, var(--md-ref-neutral-10) 4%, transparent);
  color: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.25s ease;
  -webkit-tap-highlight-color: transparent;
}

.fullmenu-panel--dark .fullmenu-theme-toggle {
  border-color: color-mix(in srgb, var(--md-ref-neutral-90) 12%, transparent);
  background: color-mix(in srgb, var(--md-ref-neutral-90) 5%, transparent);
}

.fullmenu-theme-toggle:hover {
  background: color-mix(in srgb, var(--md-ref-neutral-10) 8%, transparent);
}

.fullmenu-panel--dark .fullmenu-theme-toggle:hover {
  background: color-mix(in srgb, var(--md-ref-neutral-90) 10%, transparent);
}

.fullmenu-theme-toggle:active {
  transform: scale(0.98);
}

.fullmenu-theme-toggle__icon {
  position: relative;
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  border-radius: 50%;
  background: linear-gradient(135deg, #0f172a 0%, #2563eb 100%);
  box-shadow: inset -4px -4px 10px rgba(255, 255, 255, 0.22), 0 4px 8px rgba(15, 23, 42, 0.18);
}

.fullmenu-theme-toggle__icon::before,
.fullmenu-theme-toggle__icon::after {
  content: '';
  position: absolute;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.85);
  transition: opacity 0.2s ease;
}

.fullmenu-theme-toggle__icon::before {
  inset: 4px;
  opacity: 0.4;
}

.fullmenu-theme-toggle__icon::after {
  inset: 7px;
  opacity: 0.2;
}

/* Dark theme — light icon */
.fullmenu-theme-toggle--dark .fullmenu-theme-toggle__icon {
  background: linear-gradient(135deg, #e5f3ff 0%, #73c8ff 100%);
  box-shadow: inset -4px -4px 10px rgba(6, 11, 21, 0.35), 0 4px 8px rgba(6, 11, 21, 0.3);
}

.fullmenu-theme-toggle__label {
  letter-spacing: 0.3px;
}

.fullmenu-theme-toggle__pc-icon {
  font-size: 18px;
  flex-shrink: 0;
  width: 20px;
  text-align: center;
  line-height: 1;
}

/* Aurora variant */
.fullmenu-theme-toggle--aurora {
  border-color: rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
  color: rgba(255, 255, 255, 0.8);
}

.fullmenu-theme-toggle--aurora:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(0, 212, 170, 0.2);
}

.fullmenu-theme-toggle--aurora .fullmenu-theme-toggle__icon {
  box-shadow: inset -3px -3px 8px rgba(255, 255, 255, 0.15), 0 0 10px rgba(0, 212, 170, 0.15);
}

/* --- Aurora Overlay --- */
.fullmenu-overlay--aurora {
  background: rgba(4, 6, 14, 0.6);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

/* --- Aurora Panel --- */
.fullmenu-panel--aurora {
  background: rgba(8, 12, 20, 0.82);
  backdrop-filter: blur(30px) saturate(1.4);
  -webkit-backdrop-filter: blur(30px) saturate(1.4);
  border-right: none;
  box-shadow:
    1px 0 0 0 rgba(0, 212, 170, 0.15),
    4px 0 30px rgba(0, 136, 255, 0.08),
    inset -1px 0 0 0 rgba(255, 255, 255, 0.04);
}

.fullmenu-panel--aurora .fullmenu-header {
  border-bottom-color: rgba(255, 255, 255, 0.06);
}

.fullmenu-panel--aurora .fullmenu-header__title {
  color: rgba(255, 255, 255, 0.92);
  background: linear-gradient(135deg, #e0f7fa, #00d4aa);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.fullmenu-panel--aurora .fullmenu-close {
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.fullmenu-panel--aurora .fullmenu-close:hover {
  background: rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.95);
}

/* Aurora sections */
.fullmenu-panel--aurora .fullmenu-section {
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.02);
  overflow: hidden;
}

.fullmenu-panel--aurora .fullmenu-section__toggle {
  background: transparent;
  color: rgba(255, 255, 255, 0.88);
  border-color: transparent;
}

.fullmenu-panel--aurora .fullmenu-section__toggle:hover {
  background: rgba(255, 255, 255, 0.04);
}

.fullmenu-panel--aurora .fullmenu-section__icon {
  filter: drop-shadow(0 0 4px rgba(0, 212, 170, 0.3));
}

.fullmenu-panel--aurora .fullmenu-section__arrow {
  color: rgba(0, 212, 170, 0.6);
}

.fullmenu-panel--aurora .fullmenu-section__body {
  border-top-color: rgba(255, 255, 255, 0.04);
  background: rgba(0, 0, 0, 0.15);
}

/* Aurora menu items */
.fullmenu-panel--aurora .fullmenu-item {
  color: rgba(255, 255, 255, 0.8);
  border-radius: 10px;
  transition: all 0.25s ease;
}

.fullmenu-panel--aurora .fullmenu-item:hover {
  background: rgba(0, 212, 170, 0.1);
  color: #00d4aa;
  box-shadow: 0 0 16px rgba(0, 212, 170, 0.08);
}

.fullmenu-panel--aurora .fullmenu-item:active {
  background: rgba(0, 212, 170, 0.15);
}

.fullmenu-panel--aurora .fullmenu-item__icon {
  filter: drop-shadow(0 0 3px rgba(0, 212, 170, 0.2));
}

/* Aurora chips */
.fullmenu-panel--aurora .fullmenu-chip {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.7);
}

.fullmenu-panel--aurora .fullmenu-chip:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(0, 212, 170, 0.2);
}

.fullmenu-panel--aurora .fullmenu-chip--active {
  background: rgba(0, 212, 170, 0.15);
  border-color: rgba(0, 212, 170, 0.4);
  color: #00d4aa;
  box-shadow: 0 0 12px rgba(0, 212, 170, 0.1);
}

/* Aurora inputs */
.fullmenu-panel--aurora .fullmenu-input {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.9);
}

.fullmenu-panel--aurora .fullmenu-input:focus {
  border-color: rgba(0, 212, 170, 0.4);
  box-shadow: 0 0 12px rgba(0, 212, 170, 0.1);
}

/* Aurora range */
.fullmenu-panel--aurora .fullmenu-range {
  accent-color: #00d4aa;
}

/* Aurora color swatches */
.fullmenu-panel--aurora .fullmenu-swatch {
  border-color: rgba(255, 255, 255, 0.1);
  box-shadow: 0 0 8px rgba(0, 0, 0, 0.3);
}

.fullmenu-panel--aurora .fullmenu-swatch--active {
  border-color: #00d4aa;
  box-shadow: 0 0 12px rgba(0, 212, 170, 0.3);
}

/* Aurora add buttons */
.fullmenu-panel--aurora .fullmenu-add-btn {
  background: rgba(0, 212, 170, 0.1);
  border-color: rgba(0, 212, 170, 0.3);
  color: #00d4aa;
}

.fullmenu-panel--aurora .fullmenu-add-btn:hover {
  background: rgba(0, 212, 170, 0.2);
  box-shadow: 0 0 16px rgba(0, 212, 170, 0.15);
}

/* Aurora labels */
.fullmenu-panel--aurora .fullmenu-label {
  color: rgba(255, 255, 255, 0.5);
}

/* Aurora lang buttons */
.fullmenu-panel--aurora .fullmenu-lang-btn {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.7);
}

.fullmenu-panel--aurora .fullmenu-lang-btn:hover {
  background: rgba(255, 255, 255, 0.08);
}

.fullmenu-panel--aurora .fullmenu-lang-btn--active {
  background: rgba(0, 212, 170, 0.15);
  border-color: rgba(0, 212, 170, 0.4);
  color: #00d4aa;
}

/* Aurora custom scrollbar */
.fullmenu-panel--aurora .fullmenu-content::-webkit-scrollbar {
  width: 4px;
}

.fullmenu-panel--aurora .fullmenu-content::-webkit-scrollbar-track {
  background: transparent;
}

.fullmenu-panel--aurora .fullmenu-content::-webkit-scrollbar-thumb {
  background: rgba(0, 212, 170, 0.3);
  border-radius: 4px;
}

/* Aurora close button glow on hover */
.fullmenu-panel--aurora .fullmenu-close:hover {
  border-color: rgba(255, 80, 80, 0.3);
  box-shadow: 0 0 12px rgba(255, 80, 80, 0.1);
}
</style>
