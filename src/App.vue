<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import CanvasBoard from './components/Canvas/CanvasBoard.vue'
import ControlPanel from './components/Panels/ControlPanel.vue'
import RightPanel from './components/Panels/RightPanel.vue'

const isModernTheme = ref(false)
const isLeftPanelCollapsed = ref(false)
const panelScale = ref(1)
const canvasRef = ref(null)

const PANEL_SCALE_MIN = 0.4
const PANEL_SCALE_MAX = 1.5
const PANEL_SCALE_STEP = 0.1
const WHEEL_LISTENER_OPTIONS = { passive: false }

function setPanelScale(value) {
  const clamped = Math.min(PANEL_SCALE_MAX, Math.max(PANEL_SCALE_MIN, value))
  panelScale.value = Number(clamped.toFixed(2))
}

function toggleTheme() {
  isModernTheme.value = !isModernTheme.value
}

function toggleLeftPanel() {
  isLeftPanelCollapsed.value = !isLeftPanelCollapsed.value
}

function handlePanelCtrlClick(event) {
  const isLeftButton = event.button === undefined || event.button === 0
  if (!event.ctrlKey || !isLeftButton) {
    return
  }

  event.preventDefault()
  event.stopPropagation()
  event.stopImmediatePropagation?.()

  let nextScale = panelScale.value + PANEL_SCALE_STEP
  if (nextScale > PANEL_SCALE_MAX) {
    nextScale = PANEL_SCALE_MIN
  }

  setPanelScale(nextScale)
}

function handlePanelCtrlWheel(event) {
  if (!event.ctrlKey) {
    return
  }

  const tagName = event.target?.tagName
  const isEditableTarget = event.target?.isContentEditable
  if (tagName === 'INPUT' || tagName === 'TEXTAREA' || isEditableTarget) {
    return
  }

  event.preventDefault()
  event.stopPropagation()

  const direction = event.deltaY < 0 ? 1 : event.deltaY > 0 ? -1 : 0
  if (direction === 0) {
    return
  }

  const nextScale = panelScale.value + direction * PANEL_SCALE_STEP
  setPanelScale(nextScale)
}
function handleGlobalKeydown(event) {
  const isResetCombo = event.ctrlKey && !event.shiftKey && (event.code === 'Digit0' || event.code === 'Numpad0')
  if (!isResetCombo) {
    return
  }

  event.preventDefault()
  setPanelScale(1)
  canvasRef.value?.resetView()
}

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeydown)
  window.addEventListener('wheel', handlePanelCtrlWheel, WHEEL_LISTENER_OPTIONS)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
  window.removeEventListener('wheel', handlePanelCtrlWheel, WHEEL_LISTENER_OPTIONS)
})

const leftPanelStyle = computed(() => ({
  transform: `scale(${panelScale.value})`,
  transformOrigin: 'left top'
}))

const rightPanelStyle = computed(() => ({
  transform: `scale(${panelScale.value})`,
  transformOrigin: 'right top'
}))

</script>

<template>
  <div id="app">
    <!-- Левая панель -->
    <div
      :class="[
        'ui-panel-left',
        {
          collapsed: isLeftPanelCollapsed
        }
      ]"
      :style="leftPanelStyle"
      @click.capture="handlePanelCtrlClick"
    >
      <ControlPanel
        :is-modern-theme="isModernTheme"
        :is-collapsed="isLeftPanelCollapsed"
        @toggle-theme="toggleTheme"
        @toggle-collapse="toggleLeftPanel"
      />
    </div>

    <!-- Правая панель -->
    <RightPanel
      :is-modern-theme="isModernTheme"
      :style="rightPanelStyle"
      @click.capture="handlePanelCtrlClick"
    />
    <div id="canvas">
      <CanvasBoard ref="canvasRef" />
    </div>
  </div>
</template>

<style>
:root{
  --card-width: 380px;
  --brand: #0f62fe;
  --ink: #111827;
  --muted: #6b7280;
  --panel: #ffffff;
  --surface: #ffffff;
  --bg: #f5f7fb;
  --radius: 14px;
  --shadow: 0 8px 20px rgba(0,0,0,.12);
}

html,body{
  margin:0; padding:0; width:100%; height:100%;
  overflow-x: hidden;
  overflow-y: auto;
  background: var(--bg);
  font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
  color: var(--ink);
  user-select: none;
}

#app {
  position: relative;
  width: 100%;
  min-height: 100vh;
}

/* Панели */
.ui-panel-left{
  position: fixed;
  top: 20px;
  left: 0;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px 20px;
  background: transparent;
  border-radius: 0 24px 24px 0;
  box-shadow: var(--shadow);
  transition: top .3s ease, transform .3s ease, padding .3s ease;
  max-height: none;
  overflow: visible;
  box-sizing: border-box;
}
.ui-panel-left.collapsed {
  top: 16px;
  padding: 16px 20px;
}
/* Canvas/SVG */
#canvas{ position:relative; width:100%; height:100%; transform-origin:0 0; cursor:default; }
</style>
