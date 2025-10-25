<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import CanvasBoard from './components/Canvas/CanvasBoard.vue'
import ControlPanel from './components/Panels/ControlPanel.vue'
import RightPanel from './components/Panels/RightPanel.vue'
import AppHeader from './components/Layout/AppHeader.vue'

const isModernTheme = ref(false)
const isLeftPanelCollapsed = ref(false)
const canvasRef = ref(null)

function toggleTheme() {
  isModernTheme.value = !isModernTheme.value
}

function toggleLeftPanel() {
  isLeftPanelCollapsed.value = !isLeftPanelCollapsed.value
}
  
function handleGlobalKeydown(event) {
  const isResetCombo = event.ctrlKey && !event.shiftKey && (event.code === 'Digit0' || event.code === 'Numpad0')
  if (!isResetCombo) {
    return
  }

  event.preventDefault()
  canvasRef.value?.resetView()
}
function handleFitToContent() {
  canvasRef.value?.fitToContent()
}

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
})

</script>

<template>
  <div id="app">
    <AppHeader
      :is-modern-theme="isModernTheme"
    />    <!-- Левая панель -->
    <div
      :class="[
        'ui-panel-left',
        {
          collapsed: isLeftPanelCollapsed
        }
      ]"
    >
      <ControlPanel
        :is-modern-theme="isModernTheme"
        :is-collapsed="isLeftPanelCollapsed"
        @toggle-theme="toggleTheme"
        @toggle-collapse="toggleLeftPanel"
        @fit-to-content="handleFitToContent"   
      />
    </div>

    <!-- Правая панель -->
    <RightPanel
      :is-modern-theme="isModernTheme"
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
