<script setup>
import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useCanvasStore } from '@/stores/canvas'
import { useViewSettingsStore } from '@/stores/viewSettings'
import { useSidePanelsStore } from '@/stores/sidePanels'

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

const { locale } = useI18n()
const canvasStore = useCanvasStore()
const viewSettingsStore = useViewSettingsStore()
const sidePanelsStore = useSidePanelsStore()

const { guidesEnabled, isGridBackgroundVisible, gridStep } = storeToRefs(canvasStore)
const {
  lineColor,
  lineThickness,
  isAnimationEnabled,
  animationSeconds,
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

const handleToggleGuides = () => {
  canvasStore.toggleGuides()
}

const handleToggleTheme = () => {
  emit('toggle-theme')
  emit('close')
}

const handleClearCanvas = () => {
  if (confirm('Очистить холст? Все объекты будут удалены.')) {
    emit('clear-canvas')
    emit('close')
  }
}

const handleNewStructure = () => {
  if (confirm('Создать новую структуру? Текущие данные могут быть потеряны.')) {
    emit('new-structure')
    emit('close')
  }
}

// --- View: Grid ---
const handleGridToggle = () => {
  canvasStore.toggleGridBackground()
}

const gridStepLocal = computed({
  get: () => gridStep.value,
  set: (val) => {
    const num = Number(val)
    if (Number.isFinite(num) && num >= 5 && num <= 200) {
      canvasStore.setGridStep(num)
    }
  }
})

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
const handleToggleStickers = () => {
  sidePanelsStore.toggleStickerMessages()
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
        :class="{ 'fullmenu-overlay--dark': isDark }"
        @click.self="handleOverlayClick"
      >
        <transition name="fullmenu-slide">
          <div
            v-if="visible"
            class="fullmenu-panel"
            :class="{ 'fullmenu-panel--dark': isDark }"
          >
            <!-- Header -->
            <div class="fullmenu-header">
              <span class="fullmenu-header__title">Меню</span>
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
                  <span class="fullmenu-section__label">Инструменты</span>
                  <span
                    class="fullmenu-section__arrow"
                    :class="{ 'fullmenu-section__arrow--open': openSections.tools }"
                  >▸</span>
                </button>

                <div v-if="openSections.tools" class="fullmenu-section__body">
                  <button class="fullmenu-item" type="button" @click="handlePencil">
                    <span class="fullmenu-item__icon">✏️</span>
                    <span>Рисование</span>
                  </button>
                  <button
                    class="fullmenu-item"
                    :class="{ 'fullmenu-item--active': guidesEnabled }"
                    type="button"
                    @click="handleToggleGuides"
                  >
                    <span class="fullmenu-item__icon">📐</span>
                    <span>Направляющие</span>
                    <span class="fullmenu-item__badge" v-if="guidesEnabled">ВКЛ</span>
                  </button>
                  <button class="fullmenu-item" type="button" @click="handleToggleTheme">
                    <span class="fullmenu-item__icon">🎨</span>
                    <span>Смена темы</span>
                  </button>
                  <button class="fullmenu-item fullmenu-item--danger" type="button" @click="handleClearCanvas">
                    <span class="fullmenu-item__icon">🧹</span>
                    <span>Очистить холст</span>
                  </button>
                  <button class="fullmenu-item" type="button" @click="handleNewStructure">
                    <span class="fullmenu-item__icon">📄</span>
                    <span>Новая структура</span>
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
                  <span class="fullmenu-section__label">Вид</span>
                  <span
                    class="fullmenu-section__arrow"
                    :class="{ 'fullmenu-section__arrow--open': openSections.view }"
                  >▸</span>
                </button>

                <div v-if="openSections.view" class="fullmenu-section__body">
                  <!-- Grid -->
                  <div class="fullmenu-subsection">
                    <div class="fullmenu-subsection__header">Сетка</div>
                    <div class="fullmenu-row">
                      <button
                        class="fullmenu-chip"
                        :class="{ 'fullmenu-chip--active': isGridBackgroundVisible }"
                        type="button"
                        @click="handleGridToggle"
                      >{{ isGridBackgroundVisible ? 'ВКЛ' : 'ВЫКЛ' }}</button>
                      <label class="fullmenu-inline-input">
                        <span class="fullmenu-inline-input__label">Шаг:</span>
                        <input
                          type="number"
                          class="fullmenu-input"
                          :value="gridStepLocal"
                          @change="gridStepLocal = $event.target.value"
                          min="5"
                          max="200"
                          step="5"
                        >
                        <span class="fullmenu-inline-input__unit">px</span>
                      </label>
                    </div>
                  </div>

                  <!-- Lines -->
                  <div class="fullmenu-subsection">
                    <div class="fullmenu-subsection__header">Линии</div>
                    <div class="fullmenu-row">
                      <button
                        class="fullmenu-swatch"
                        type="button"
                        :style="{ background: lineColor }"
                        @click="openLineColorPicker"
                        title="Цвет линий"
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
                    <div class="fullmenu-subsection__header">Анимация</div>
                    <div class="fullmenu-row">
                      <button
                        class="fullmenu-chip"
                        :class="{ 'fullmenu-chip--active': isAnimationEnabled }"
                        type="button"
                        @click="handleAnimationToggle"
                      >{{ isAnimationEnabled ? 'ВКЛ' : 'ВЫКЛ' }}</button>
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
                        <span class="fullmenu-inline-input__unit">сек</span>
                      </label>
                    </div>
                  </div>

                  <!-- Background -->
                  <div class="fullmenu-subsection">
                    <div class="fullmenu-subsection__header">Фон</div>
                    <div class="fullmenu-row">
                      <button
                        class="fullmenu-swatch fullmenu-swatch--preset"
                        type="button"
                        style="background: #f5f7fb"
                        @click="selectPresetBg('#f5f7fb')"
                        title="Светлый"
                      ></button>
                      <button
                        class="fullmenu-swatch fullmenu-swatch--preset"
                        type="button"
                        style="background: #111827"
                        @click="selectPresetBg('#111827')"
                        title="Тёмный"
                      ></button>
                      <button
                        class="fullmenu-swatch"
                        type="button"
                        :style="{ background: backgroundGradient }"
                        @click="openBgColorPicker"
                        title="Свой цвет"
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
                    <div class="fullmenu-subsection__header">Цвет заголовка</div>
                    <div class="fullmenu-row">
                      <button
                        class="fullmenu-swatch"
                        type="button"
                        :style="{ background: headerColor }"
                        @click="openHeaderColorPicker"
                        title="Выбрать цвет"
                      ></button>
                      <input
                        ref="headerColorInput"
                        type="color"
                        class="fullmenu-hidden-input"
                        :value="headerColor"
                        @input="handleHeaderColorChange"
                      >
                      <button class="fullmenu-chip" type="button" @click="handleCycleHeaderColor">
                        Сменить
                      </button>
                      <span class="fullmenu-muted">#{{ headerColorIndex }}</span>
                    </div>
                  </div>

                  <!-- Language -->
                  <div class="fullmenu-subsection">
                    <div class="fullmenu-subsection__header">Язык</div>
                    <div class="fullmenu-row">
                      <button
                        class="fullmenu-chip"
                        :class="{ 'fullmenu-chip--active': locale === 'ru' }"
                        type="button"
                        @click="changeLocale('ru')"
                      >🇷🇺 RU</button>
                      <button
                        class="fullmenu-chip"
                        :class="{ 'fullmenu-chip--active': locale === 'en' }"
                        type="button"
                        @click="changeLocale('en')"
                      >🇬🇧 EN</button>
                      <button
                        class="fullmenu-chip"
                        :class="{ 'fullmenu-chip--active': locale === 'zh' }"
                        type="button"
                        @click="changeLocale('zh')"
                      >🇨🇳 ZH</button>
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
                  <span class="fullmenu-section__label">Обсуждение</span>
                  <span
                    class="fullmenu-section__arrow"
                    :class="{ 'fullmenu-section__arrow--open': openSections.discussion }"
                  >▸</span>
                </button>

                <div v-if="openSections.discussion" class="fullmenu-section__body">
                  <button class="fullmenu-item" type="button" @click="handleTogglePartners">
                    <span class="fullmenu-item__icon">👤</span>
                    <span>Партнёры</span>
                  </button>
                  <button class="fullmenu-item" type="button" @click="handleToggleNotes">
                    <span class="fullmenu-item__icon">📅</span>
                    <span>Заметки</span>
                  </button>
                  <button class="fullmenu-item" type="button" @click="handleToggleImages">
                    <span class="fullmenu-item__icon">🖼️</span>
                    <span>Изображения</span>
                  </button>
                  <button class="fullmenu-item" type="button" @click="handleToggleComments">
                    <span class="fullmenu-item__icon">💬</span>
                    <span>Комментарии</span>
                  </button>
                  <button class="fullmenu-item" type="button" @click="handleToggleAnchors">
                    <span class="fullmenu-item__icon">🧭</span>
                    <span>Геолокация</span>
                  </button>
                  <button class="fullmenu-item" type="button" @click="handleToggleStickers">
                    <span class="fullmenu-item__icon">📌</span>
                    <span>Стикеры</span>
                  </button>
                </div>
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
</style>
