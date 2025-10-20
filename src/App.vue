<script setup>
import { ref, watchEffect, computed, onMounted, onBeforeUnmount } from 'vue'
import CanvasBoard from './components/Canvas/CanvasBoard.vue'
import ControlPanel from './components/Panels/ControlPanel.vue'
import RightPanel from './components/Panels/RightPanel.vue'

const isModernTheme = ref(false)
const isLeftPanelCollapsed = ref(false)
const panelScale = ref(1)
const canvasRef = ref(null)

const PANEL_SCALE_MIN = 1
const PANEL_SCALE_MAX = 1.5
const PANEL_SCALE_STEP = 0.1
const WHEEL_LISTENER_OPTIONS = { passive: false }

function setPanelScale(value) {
  const clamped = Math.min(PANEL_SCALE_MAX, Math.max(PANEL_SCALE_MIN, value))
  panelScale.value = Number(clamped.toFixed(2))
}function toggleTheme() {
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
  setPanelScale(nextScale)}

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

watchEffect(() => {  document.body.classList.toggle('theme-modern', isModernTheme.value)
})  
</script>

<template>
  <div id="app" :class="{ 'theme-modern': isModernTheme }">
    <!-- Левая панель -->
    <div
      :class="[
        'ui-panel-left',
        {
          collapsed: isLeftPanelCollapsed,
          'ui-panel-left--modern': isModernTheme,
          'ui-panel-left--classic': !isModernTheme
        }
      ]"
      :style="leftPanelStyle"
      @click.capture="handlePanelCtrlClick"    >
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
  overflow:hidden;
  background: var(--bg);
  font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
  color: var(--ink);
  user-select: none;
}

#app {
  position: relative;
  width: 100%;
  height: 100%;
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
  transition: top .3s ease, transform .3s ease, padding .3s ease;}

.ui-panel-left--classic {
  gap: 16px;
}

.ui-panel-left.collapsed {
  top: 16px;
  transform: none !important;
  padding: 16px 20px;
}
/* Canvas/SVG */
#canvas{ position:relative; width:100%; height:100%; transform-origin:0 0; cursor:default; }

#app.theme-modern {
  --card-width: 400px;
  --bg: #efe4d1;
  --panel: rgba(18, 24, 34, 0.88);
  --surface: rgba(24, 32, 46, 0.92);
  --ink: #f4f7fb;
  --muted: #9ba5b7;
  --brand: #59d0ff;
  --radius: 18px;
  --shadow: 0 16px 34px rgba(8, 11, 18, 0.45);
}

body.theme-modern {
  background: linear-gradient(145deg, #f3e9d6 0%, #efe3ce 48%, #f8efe0 100%);
  color: #f4f7fb;
}


.ui-panel-left--modern {
  top: 20px;
  transform: none;
  align-items: stretch;
  padding: 28px 26px;
  width: 220px;
  min-height: 420px;
  border-radius: 0 32px 32px 0;
  background: transparent;
  box-shadow: 0 24px 48px rgba(5, 8, 14, 0.68);
}

.ui-panel-left--modern.collapsed {
  width: auto;
  min-height: auto;
  padding: 20px 24px;
  background: transparent;
}
.ui-panel-left.collapsed.ui-panel-left--modern {
  top: 16px;
}

.theme-modern #canvas{
  position: absolute;
  top: 32px;
  right: 32px;
  bottom: 32px;
  left: 240px;  
  background: rgba(255,255,255,0.45);
  border-radius: 28px;
  box-shadow: 0 28px 48px rgba(6, 11, 21, 0.22);
}
</style>
