<script setup>
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'

import { useViewSettingsStore } from '../../stores/viewSettings.js'
const props = defineProps({
  isModernTheme: {
    type: Boolean,
    default: false
  }
})

const { t, locale } = useI18n()
const viewSettingsStore = useViewSettingsStore()

const {
  lineColor,
  lineThickness,
  animationSeconds,
  animationColor,
  isAnimationEnabled,
  headerColor,
  headerColorIndex,
  backgroundGradient,
  isGlobalLineMode
} = storeToRefs(viewSettingsStore)

const openSubmenuId = ref(null)
const lineColorPickerRef = ref(null)
const animationColorPickerRef = ref(null)  
const headerColorPickerRef = ref(null)
const backgroundPickerRef = ref(null)


const sliderTrackStyle = computed(() => viewSettingsStore.sliderTrackStyle)

function toggleSubmenu(id) {
  openSubmenuId.value = openSubmenuId.value === id ? null : id
}

function handleLineThickness(value) {
  viewSettingsStore.setLineThickness(value)
}

function handleLineColorChange(event) {
  viewSettingsStore.setLineColor(event.target.value)
}

function handleHeaderColorChange(event) {
  viewSettingsStore.setHeaderColor(event.target.value)
}

function handleBackgroundChange(event) {
  viewSettingsStore.setBackground(event.target.value)
}

function openLineColorPicker() {
  lineColorPickerRef.value?.click()
}
function openAnimationColorPicker() {
  animationColorPickerRef.value?.click()
}
function openHeaderColorPicker() {
  headerColorPickerRef.value?.click()
}

function openBackgroundPicker() {
  backgroundPickerRef.value?.click()
}

function toggleGlobalLineMode() {
  viewSettingsStore.toggleGlobalLineMode()
}

function handleAnimationChange(value) {
  viewSettingsStore.setAnimationSeconds(value)
}
function handleAnimationColorChange(event) {
  viewSettingsStore.setAnimationColor(event.target.value)
}

function toggleAnimation() {
  viewSettingsStore.toggleAnimation()
}

function cycleHeaderColor() {
  viewSettingsStore.cycleHeaderColor()
}

function selectPresetBackground(color) {
  viewSettingsStore.setBackground(color)
}

// Language switcher
const availableLocales = [
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'zh', name: '中文', flag: '🇨🇳' }
]

function changeLocale(newLocale) {
  locale.value = newLocale
  localStorage.setItem('locale', newLocale)
}
</script>

<template>
  <div
    class="view-menu"
    :class="{ 'view-menu--modern': props.isModernTheme }"
    role="menu"
    :aria-label="t('viewMenu.title')"
  >
    <h3 class="view-menu__title">{{ t('viewMenu.title') }}</h3>
    <div class="view-menu__list">
      <div
        class="view-menu__item view-menu__item--submenu"
        :class="{ 'view-menu__item--open': openSubmenuId === 'lines' }"
      >
        <button type="button" class="view-menu__main" @click="toggleSubmenu('lines')">
          <span class="view-menu__icon view-menu__icon--swatch" :style="{ backgroundColor: lineColor }" aria-hidden="true"></span>
          <span class="view-menu__label">{{ t('viewMenu.lines') }}</span>
          <span class="view-menu__info" @click.stop>&#9432;<span class="view-menu__tooltip" v-html="t('viewMenu.tooltips.lines')"></span></span>
          <span class="view-menu__caret" aria-hidden="true">›</span>
        </button>
        <div v-if="openSubmenuId === 'lines'" class="view-menu__submenu">
          <div class="view-menu__controls">
            <button type="button" class="view-menu__swatch" :style="{ backgroundColor: lineColor }" @click.stop="openLineColorPicker" :aria-label="t('viewMenu.selectLineColor')"></button>
            <button
              type="button"
              class="view-menu__control"
              :class="{ 'view-menu__control--active': isGlobalLineMode }"
              @click.stop="toggleGlobalLineMode"
            >
              {{ t('viewMenu.applyToAllLines') }}
            </button>
          </div>
          <label class="view-menu__field" for="view-menu-line-thickness">
            <span class="view-menu__field-label">{{ t('viewMenu.lineThickness') }}</span>
            <input
              id="view-menu-line-thickness"
              class="view-menu__slider"
              type="range"
              min="1"
              max="20"
              step="1"
              :value="lineThickness"
              :style="{ background: sliderTrackStyle }"
              @input="handleLineThickness($event.target.value)"
            >
            <span class="view-menu__field-suffix">{{ lineThickness }}px</span>
          </label>
          <input
            ref="lineColorPickerRef"
            type="color"
            :value="lineColor"
            class="view-menu__hidden-input"
            @input="handleLineColorChange"
          >
        </div>
      </div>

      <div
        class="view-menu__item view-menu__item--submenu"
        :class="{ 'view-menu__item--open': openSubmenuId === 'animation' }"
      >
        <button type="button" class="view-menu__main" @click="toggleSubmenu('animation')">
          <span class="view-menu__icon" aria-hidden="true">⏱️</span>
          <span class="view-menu__label">{{ t('viewMenu.animation') }}</span>
          <span class="view-menu__info" @click.stop>&#9432;<span class="view-menu__tooltip" v-html="t('viewMenu.tooltips.animation')"></span></span>
          <span class="view-menu__caret" aria-hidden="true">›</span>
        </button>
        <div v-if="openSubmenuId === 'animation'" class="view-menu__submenu">
          <div class="view-menu__controls">
            <button
              type="button"
              class="view-menu__control"
              :class="{ 'view-menu__control--active': isAnimationEnabled }"
              @click.stop="toggleAnimation"
            >
              {{ isAnimationEnabled ? t('viewMenu.animationEnabled') : t('viewMenu.animationDisabled') }}
            </button>
            <button
              type="button"
              class="view-menu__swatch"
              :style="{ backgroundColor: animationColor }"
              @click.stop="openAnimationColorPicker"
              :aria-label="t('viewMenu.selectAnimationColor')"
            ></button>
          </div>          
          <label class="view-menu__field" for="view-menu-animation">
            <span class="view-menu__field-label">{{ t('viewMenu.duration') }}</span>
            <input
              id="view-menu-animation"
              class="view-menu__number"
              type="number"
              min="2"
              max="999"
              step="1"
              :value="animationSeconds"
              @input="handleAnimationChange($event.target.value)"
            >
            <span class="view-menu__field-suffix">{{ t('viewMenu.seconds') }}</span>
          </label>
          <input
            ref="animationColorPickerRef"
            type="color"
            :value="animationColor"
            class="view-menu__hidden-input"
            @input="handleAnimationColorChange"
          >          
        </div>
      </div>

      <div
        class="view-menu__item view-menu__item--submenu"
        :class="{ 'view-menu__item--open': openSubmenuId === 'background' }"
      >
        <button type="button" class="view-menu__main" @click="toggleSubmenu('background')">
          <span class="view-menu__icon view-menu__icon--swatch" :style="{ backgroundColor: backgroundGradient }" aria-hidden="true"></span>
          <span class="view-menu__label">{{ t('viewMenu.background') }}</span>
          <span class="view-menu__info" @click.stop>&#9432;<span class="view-menu__tooltip" v-html="t('viewMenu.tooltips.background')"></span></span>
          <span class="view-menu__caret" aria-hidden="true">›</span>
        </button>
        <div v-if="openSubmenuId === 'background'" class="view-menu__submenu">
          <div class="view-menu__controls">
            <button type="button" class="view-menu__swatch" style="background-color: #f5f7fb" @click.stop="selectPresetBackground('#f5f7fb')" :aria-label="t('viewMenu.lightBackground')"></button>
            <button type="button" class="view-menu__swatch" style="background-color: #111827" @click.stop="selectPresetBackground('#111827')" :aria-label="t('viewMenu.darkBackground')"></button>
            <button type="button" class="view-menu__swatch view-menu__swatch--picker" @click.stop="openBackgroundPicker" :aria-label="t('viewMenu.selectBackgroundColor')">🎨</button>
          </div>
          <input
            ref="backgroundPickerRef"
            type="color"
            :value="backgroundGradient"
            class="view-menu__hidden-input"
            @input="handleBackgroundChange"
          >
        </div>
      </div>

      <div
        class="view-menu__item view-menu__item--submenu"
        :class="{ 'view-menu__item--open': openSubmenuId === 'header' }"
      >
        <button type="button" class="view-menu__main" @click="toggleSubmenu('header')">
          <span class="view-menu__icon view-menu__icon--swatch" :style="{ backgroundColor: headerColor }" aria-hidden="true"></span>
          <span class="view-menu__label">{{ t('viewMenu.headerColor') }}</span>
          <span class="view-menu__info" @click.stop>&#9432;<span class="view-menu__tooltip" v-html="t('viewMenu.tooltips.headerColor')"></span></span>
          <span class="view-menu__caret" aria-hidden="true">›</span>
        </button>
        <div v-if="openSubmenuId === 'header'" class="view-menu__submenu">
          <div class="view-menu__controls">
            <button type="button" class="view-menu__swatch" :style="{ backgroundColor: headerColor }" @click.stop="openHeaderColorPicker" :aria-label="t('viewMenu.selectHeaderColor')"></button>
            <button type="button" class="view-menu__control" @click.stop="cycleHeaderColor">{{ t('viewMenu.changeColor') }}</button>
          </div>
          <p class="view-menu__note">{{ t('viewMenu.currentIndex') }}: {{ headerColorIndex }}</p>
          <input
            ref="headerColorPickerRef"
            type="color"
            :value="headerColor"
            class="view-menu__hidden-input"
            @input="handleHeaderColorChange"
          >
        </div>
      </div>

      <!-- Language Switcher -->
      <div
        class="view-menu__item view-menu__item--submenu"
        :class="{ 'view-menu__item--open': openSubmenuId === 'language' }"
      >
        <button type="button" class="view-menu__main" @click="toggleSubmenu('language')">
          <span class="view-menu__icon" aria-hidden="true">🌐</span>
          <span class="view-menu__label">{{ t('viewMenu.language') }}</span>
          <span class="view-menu__info" @click.stop>&#9432;<span class="view-menu__tooltip" v-html="t('viewMenu.tooltips.language')"></span></span>
          <span class="view-menu__caret" aria-hidden="true">›</span>
        </button>
        <div v-if="openSubmenuId === 'language'" class="view-menu__submenu">
          <button
            v-for="lang in availableLocales"
            :key="lang.code"
            type="button"
            class="view-menu__control view-menu__lang-option"
            :class="{ 'view-menu__control--active': locale === lang.code }"
            @click="changeLocale(lang.code)"
            :title="lang.name"
          >
            {{ lang.flag }} {{ lang.name }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.view-menu {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 18px;
  min-width: 280px;
}

.view-menu__title {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: #0f172a;
}

.view-menu__list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.view-menu__item {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.view-menu__main {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.08);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.view-menu__main:hover {
  transform: translateY(-1px);
  background: #ffc107;
  border-color: rgba(255, 193, 7, 0.8);
  box-shadow: 0 12px 24px rgba(255, 193, 7, 0.3);
}

.view-menu__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 12px;
  background: rgba(59, 130, 246, 0.12);
  font-size: 18px;
}

.view-menu__icon--swatch {
  border-radius: 12px;
  border: 1px solid rgba(15, 23, 42, 0.12);
  box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.45);
}

.view-menu__label {
  flex: 1;
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
}

.view-menu__main:hover .view-menu__label {
  color: #000000;
}

.view-menu__main:hover .view-menu__caret {
  color: #000000;
}

.view-menu__caret {
  font-size: 16px;
  color: rgba(15, 23, 42, 0.4);
}

.view-menu__submenu {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 14px;
  background: rgba(248, 250, 252, 0.92);
  border: 1px solid rgba(148, 163, 184, 0.2);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.5);
}

.view-menu__controls {
  display: flex;
  gap: 10px;
  align-items: center;
}

.view-menu__control {
  padding: 8px 12px;
  border-radius: 12px;
  border: 1px solid rgba(59, 130, 246, 0.25);
  background: rgba(255, 255, 255, 0.94);
  color: #1d4ed8;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease, box-shadow 0.2s ease;
}

.view-menu__control--active {
  background: #ffc107;
  color: #000000;
  border-color: rgba(255, 193, 7, 0.8);
  box-shadow: 0 12px 24px rgba(255, 193, 7, 0.3);
}

.view-menu__control:hover {
  background: #ffc107;
  color: #000000;
  border-color: rgba(255, 193, 7, 0.8);
  box-shadow: 0 10px 22px rgba(255, 193, 7, 0.3);
}

.view-menu__field {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  font-weight: 600;
  color: #1f2937;
}

.view-menu__field-label {
  min-width: 68px;
}

.view-menu__number {
  width: 72px;
  padding: 6px 8px;
  border-radius: 10px;
  border: 1px solid rgba(148, 163, 184, 0.5);
  font-size: 14px;
  text-align: center;
  background: rgba(255, 255, 255, 0.95);
}

.view-menu__slider {
  flex: 1;
  appearance: none;
  height: 6px;
  border-radius: 999px;
  background: linear-gradient(to right, #3b82f6, #2563eb);
  cursor: pointer;
}

.view-menu__slider::-webkit-slider-thumb {
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid #2563eb;
  background: #ffffff;
  box-shadow: 0 4px 10px rgba(37, 99, 235, 0.25);
}

.view-menu__slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid #2563eb;
  background: #ffffff;
  box-shadow: 0 4px 10px rgba(37, 99, 235, 0.25);
}

.view-menu__field-suffix {
  font-size: 13px;
  color: rgba(15, 23, 42, 0.56);
}

.view-menu__action {
  flex: 1;
  padding: 10px 14px;
  border-radius: 14px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(255, 255, 255, 0.92);
  color: #0f172a;
  font-size: 14px;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.08);
  transition: box-shadow 0.2s ease, transform 0.2s ease, color 0.2s ease;
}

.view-menu__action:hover {
  transform: translateY(-1px);
  background: #ffc107;
  color: #000000;
  border-color: rgba(255, 193, 7, 0.8);
  box-shadow: 0 12px 24px rgba(255, 193, 7, 0.3);
}

.view-menu__action--active {
  background: #ffc107;
  color: #000000;
  border-color: rgba(255, 193, 7, 0.8);
  box-shadow: 0 12px 28px rgba(255, 193, 7, 0.3);
}

.view-menu__swatch {
  width: 36px;
  height: 36px;
  border-radius: 12px;
  border: 1px solid rgba(148, 163, 184, 0.4);
  background: rgba(255, 255, 255, 0.9);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.view-menu__swatch:hover {
  transform: translateY(-1px);
  box-shadow: 0 10px 18px rgba(15, 23, 42, 0.15);
}

.view-menu__swatch--picker {
  font-size: 16px;
}

.view-menu__hidden-input {
  display: none;
}

.view-menu__note {
  margin: 0;
  font-size: 12px;
  color: rgba(15, 23, 42, 0.55);
}

.view-menu__item--submenu {
  position: relative;
}

.view-menu__item--open > .view-menu__main {
  background: #ffc107;
  border-color: rgba(255, 193, 7, 0.8);
  box-shadow: 0 12px 24px rgba(255, 193, 7, 0.3);
}

.view-menu__item--open > .view-menu__main .view-menu__label,
.view-menu__item--open > .view-menu__main .view-menu__caret {
  color: #000000;
}

.view-menu--modern .view-menu__title {
  color: #e5f3ff;
}

.view-menu--modern .view-menu__main {
  border-color: rgba(96, 164, 255, 0.35);
  background: rgba(24, 34, 58, 0.94);
  box-shadow: 0 18px 34px rgba(6, 11, 21, 0.6);
}

.view-menu--modern .view-menu__main:hover {
  background: #ffc107;
  border-color: rgba(255, 193, 7, 0.85);
  box-shadow: 0 24px 40px rgba(255, 193, 7, 0.4);
}

.view-menu--modern .view-menu__icon {
  background: rgba(114, 182, 255, 0.16);
  color: #e5f3ff;
}

.view-menu--modern .view-menu__icon--swatch {
  border-color: rgba(96, 164, 255, 0.35);
  box-shadow: inset 0 0 0 2px rgba(6, 11, 21, 0.35);
}

.view-menu--modern .view-menu__label {
  color: #e5f3ff;
}

.view-menu--modern .view-menu__main:hover .view-menu__label,
.view-menu--modern .view-menu__main:hover .view-menu__caret {
  color: #000000;
}

.view-menu--modern .view-menu__caret {
  color: rgba(196, 215, 255, 0.6);
}

.view-menu--modern .view-menu__submenu {
  background: rgba(18, 28, 48, 0.95);
  border-color: rgba(96, 164, 255, 0.35);
  box-shadow: inset 0 0 0 1px rgba(96, 164, 255, 0.12);
}

.view-menu--modern .view-menu__control {
  border-color: rgba(114, 182, 255, 0.35);
  background: rgba(24, 34, 58, 0.92);
  color: #9cd0ff;
  box-shadow: 0 16px 30px rgba(6, 11, 21, 0.55);
}

.view-menu--modern .view-menu__control:hover {
  background: #ffc107;
  color: #000000;
  border-color: rgba(255, 193, 7, 0.85);
  box-shadow: 0 22px 38px rgba(255, 193, 7, 0.4);
}

.view-menu--modern .view-menu__control--active {
  background: #ffc107;
  color: #000000;
  border-color: rgba(255, 193, 7, 0.85);
  box-shadow: 0 24px 44px rgba(255, 193, 7, 0.4);
}

.view-menu--modern .view-menu__field {
  color: #d7e4ff;
}

.view-menu--modern .view-menu__number,
.view-menu--modern .view-menu__slider {
  background: rgba(12, 18, 34, 0.85);
  color: #e5f3ff;
  border-color: rgba(96, 164, 255, 0.3);
}

.view-menu--modern .view-menu__field-suffix,
.view-menu--modern .view-menu__note {
  color: rgba(215, 228, 255, 0.7);
}

.view-menu--modern .view-menu__action {
  border-color: rgba(96, 164, 255, 0.35);
  background: rgba(24, 34, 58, 0.94);
  color: #e5f3ff;
  box-shadow: 0 18px 34px rgba(6, 11, 21, 0.6);
}

.view-menu--modern .view-menu__action:hover {
  background: #ffc107;
  color: #000000;
  border-color: rgba(255, 193, 7, 0.85);
  box-shadow: 0 24px 40px rgba(255, 193, 7, 0.4);
}

.view-menu--modern .view-menu__action--active {
  background: #ffc107;
  color: #000000;
  border-color: rgba(255, 193, 7, 0.85);
  box-shadow: 0 24px 44px rgba(255, 193, 7, 0.4);
}

.view-menu--modern .view-menu__swatch {
  border-color: rgba(96, 164, 255, 0.35);
  box-shadow: 0 12px 22px rgba(6, 11, 21, 0.65);
}

/* Language Switcher Styles */
.view-menu__lang-option {
  width: 100%;
  justify-content: flex-start;
}

/* Info icon — скрыт по умолчанию, появляется при наведении на пункт */
.view-menu__info {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  font-size: 16px;
  border-radius: 50%;
  color: rgba(15, 23, 42, 0.35);
  opacity: 0;
  transition: opacity 0.2s ease, color 0.15s ease;
  cursor: help;
  flex-shrink: 0;
}

.view-menu__main:hover .view-menu__info {
  opacity: 1;
  color: rgba(0, 0, 0, 0.45);
}

.view-menu__info:hover {
  color: rgba(0, 0, 0, 0.7) !important;
}

/* Modern theme — info icon */
.view-menu--modern .view-menu__info {
  color: rgba(229, 243, 255, 0.35);
}

.view-menu--modern .view-menu__main:hover .view-menu__info {
  color: rgba(0, 0, 0, 0.45);
}

.view-menu--modern .view-menu__info:hover {
  color: rgba(0, 0, 0, 0.7) !important;
}

/* Tooltip — появляется при наведении на ⓘ */
.view-menu__tooltip {
  position: absolute;
  left: calc(100% + 14px);
  top: 50%;
  transform: translateY(-50%);
  width: 230px;
  padding: 10px 14px;
  background: rgba(15, 23, 42, 0.94);
  color: #f1f5f9;
  font-size: 12.5px;
  font-weight: 400;
  line-height: 1.5;
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.22);
  white-space: normal;
  text-align: left;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.2s ease;
  z-index: 10;
}

.view-menu__tooltip::before {
  content: '';
  position: absolute;
  right: 100%;
  top: 50%;
  transform: translateY(-50%);
  border: 6px solid transparent;
  border-right-color: rgba(15, 23, 42, 0.94);
}

.view-menu__info:hover .view-menu__tooltip {
  opacity: 1;
}

/* Modern theme — tooltip */
.view-menu--modern .view-menu__tooltip {
  background: rgba(30, 42, 70, 0.96);
  border: 1px solid rgba(96, 164, 255, 0.25);
  box-shadow: 0 8px 24px rgba(6, 11, 21, 0.4);
}

.view-menu--modern .view-menu__tooltip::before {
  border-right-color: rgba(30, 42, 70, 0.96);
}
</style>
