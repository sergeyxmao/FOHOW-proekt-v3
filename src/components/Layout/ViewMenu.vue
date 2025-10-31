<script setup>
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'

import { useCanvasStore } from '../../stores/canvas.js'
import { useViewSettingsStore } from '../../stores/viewSettings.js'

const canvasStore = useCanvasStore()
const viewSettingsStore = useViewSettingsStore()

const { guidesEnabled, isGridBackgroundVisible, gridStep } = storeToRefs(canvasStore)
const {
  lineColor,
  lineThickness,
  animationSeconds,
  headerColor,
  headerColorIndex,
  backgroundGradient,
  isGlobalLineMode
} = storeToRefs(viewSettingsStore)

const openSubmenuId = ref(null)
const lineColorPickerRef = ref(null)
const headerColorPickerRef = ref(null)
const backgroundPickerRef = ref(null)

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
    const clamped = Math.min(Math.max(Math.round(numericValue), GRID_STEP_MIN), GRID_STEP_MAX)
    canvasStore.setGridStep(clamped)
  }
})

const sliderTrackStyle = computed(() => viewSettingsStore.sliderTrackStyle)

function toggleGuides() {
  canvasStore.toggleGuides()
}

function toggleSubmenu(id) {
  openSubmenuId.value = openSubmenuId.value === id ? null : id
}

function toggleGridBackground() {
  canvasStore.toggleGridBackground()
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

function cycleHeaderColor() {
  viewSettingsStore.cycleHeaderColor()
}

function selectPresetBackground(color) {
  viewSettingsStore.setBackground(color)
}
</script>

<template>
  <div class="view-menu" role="menu" aria-label="Настройки вида">
    <h3 class="view-menu__title">Вид</h3>
    <div class="view-menu__list">
      <div class="view-menu__item">
        <span class="view-menu__icon" aria-hidden="true">📐</span>
        <button
          type="button"
          class="view-menu__action"
          :class="{ 'view-menu__action--active': guidesEnabled }"
          @click="toggleGuides"
        >
          Показать направляющие
        </button>
      </div>

      <div
        class="view-menu__item view-menu__item--submenu"
        :class="{ 'view-menu__item--open': openSubmenuId === 'grid' }"
      >
        <button type="button" class="view-menu__main" @click="toggleSubmenu('grid')">
          <span class="view-menu__icon" aria-hidden="true">▦</span>
          <span class="view-menu__label">Показать сетку</span>
          <span class="view-menu__caret" aria-hidden="true">›</span>
        </button>
        <div v-if="openSubmenuId === 'grid'" class="view-menu__submenu">
          <label class="view-menu__field" for="view-menu-grid-step">
            <span class="view-menu__field-label">Шаг</span>
            <input
              id="view-menu-grid-step"
              class="view-menu__number"
              type="number"
              :min="GRID_STEP_MIN"
              :max="GRID_STEP_MAX"
              step="1"
              v-model.number="gridStepModel"
            >
            <span class="view-menu__field-suffix">px</span>
          </label>
          <button
            type="button"
            class="view-menu__control"
            :class="{ 'view-menu__control--active': isGridBackgroundVisible }"
            @click.stop="toggleGridBackground"
          >
            Фон сетки
          </button>
        </div>
      </div>

      <div
        class="view-menu__item view-menu__item--submenu"
        :class="{ 'view-menu__item--open': openSubmenuId === 'lines' }"
      >
        <button type="button" class="view-menu__main" @click="toggleSubmenu('lines')">
          <span class="view-menu__icon view-menu__icon--swatch" :style="{ backgroundColor: lineColor }" aria-hidden="true"></span>
          <span class="view-menu__label">Линии</span>
          <span class="view-menu__caret" aria-hidden="true">›</span>
        </button>
        <div v-if="openSubmenuId === 'lines'" class="view-menu__submenu">
          <div class="view-menu__controls">
            <button type="button" class="view-menu__swatch" :style="{ backgroundColor: lineColor }" @click.stop="openLineColorPicker" aria-label="Выбрать цвет линий"></button>
            <button
              type="button"
              class="view-menu__control"
              :class="{ 'view-menu__control--active': isGlobalLineMode }"
              @click.stop="toggleGlobalLineMode"
            >
              Ко всем линиям
            </button>
          </div>
          <label class="view-menu__field" for="view-menu-line-thickness">
            <span class="view-menu__field-label">Толщина</span>
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
          <span class="view-menu__label">Анимация</span>
          <span class="view-menu__caret" aria-hidden="true">›</span>
        </button>
        <div v-if="openSubmenuId === 'animation'" class="view-menu__submenu">
          <label class="view-menu__field" for="view-menu-animation">
            <span class="view-menu__field-label">Длительность</span>
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
            <span class="view-menu__field-suffix">сек</span>
          </label>
        </div>
      </div>

      <div
        class="view-menu__item view-menu__item--submenu"
        :class="{ 'view-menu__item--open': openSubmenuId === 'background' }"
      >
        <button type="button" class="view-menu__main" @click="toggleSubmenu('background')">
          <span class="view-menu__icon view-menu__icon--swatch" :style="{ backgroundColor: backgroundGradient }" aria-hidden="true"></span>
          <span class="view-menu__label">Фон</span>
          <span class="view-menu__caret" aria-hidden="true">›</span>
        </button>
        <div v-if="openSubmenuId === 'background'" class="view-menu__submenu">
          <div class="view-menu__controls">
            <button type="button" class="view-menu__swatch" style="background-color: #f5f7fb" @click.stop="selectPresetBackground('#f5f7fb')" aria-label="Светлый фон"></button>
            <button type="button" class="view-menu__swatch" style="background-color: #111827" @click.stop="selectPresetBackground('#111827')" aria-label="Темный фон"></button>
            <button type="button" class="view-menu__swatch view-menu__swatch--picker" @click.stop="openBackgroundPicker" aria-label="Выбрать цвет фона">🎨</button>
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
          <span class="view-menu__label">Цвет заголовка</span>
          <span class="view-menu__caret" aria-hidden="true">›</span>
        </button>
        <div v-if="openSubmenuId === 'header'" class="view-menu__submenu">
          <div class="view-menu__controls">
            <button type="button" class="view-menu__swatch" :style="{ backgroundColor: headerColor }" @click.stop="openHeaderColorPicker" aria-label="Выбрать цвет заголовка"></button>
            <button type="button" class="view-menu__control" @click.stop="cycleHeaderColor">Сменить цвет</button>
          </div>
          <p class="view-menu__note">Текущий индекс: {{ headerColorIndex }}</p>
          <input
            ref="headerColorPickerRef"
            type="color"
            :value="headerColor"
            class="view-menu__hidden-input"
            @input="handleHeaderColorChange"
          >
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
  box-shadow: 0 12px 24px rgba(15, 23, 42, 0.12);
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
  background: linear-gradient(120deg, #3b82f6 0%, #2563eb 100%);
  color: #ffffff;
  box-shadow: 0 12px 24px rgba(37, 99, 235, 0.28);
}

.view-menu__control:hover {
  box-shadow: 0 10px 22px rgba(37, 99, 235, 0.2);
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
  box-shadow: 0 12px 24px rgba(15, 23, 42, 0.14);
}

.view-menu__action--active {
  background: linear-gradient(120deg, #3b82f6 0%, #2563eb 100%);
  color: #ffffff;
  box-shadow: 0 12px 28px rgba(37, 99, 235, 0.32);
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
  box-shadow: 0 12px 24px rgba(37, 99, 235, 0.18);
}
</style>
