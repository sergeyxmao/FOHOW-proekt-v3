<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import CanvasBoard from './components/Canvas/CanvasBoard.vue'
import ControlPanel from './components/Panels/ControlPanel.vue'
import RightPanel from './components/Panels/RightPanel.vue'
import AppHeader from './components/Layout/AppHeader.vue'
import PencilOverlay from './components/Overlay/PencilOverlay.vue'  

const isModernTheme = ref(false)
const isLeftPanelCollapsed = ref(false)
const isPencilMode = ref(false)
const pencilSnapshot = ref(null)
const pencilBounds = ref(null)  
const canvasRef = ref(null)

function toggleTheme() {
  isModernTheme.value = !isModernTheme.value
}

function toggleLeftPanel() {
  isLeftPanelCollapsed.value = !isLeftPanelCollapsed.value
}

function resetPencilState() {
  isPencilMode.value = false
  pencilSnapshot.value = null
  pencilBounds.value = null
}

function downloadPencilImage(image, filename) {
  if (!image || !filename) {
    return
  }

  const link = document.createElement('a')
  link.href = image
  link.download = filename
  link.click()
}

async function handleActivatePencil() {
  if (!canvasRef.value?.captureViewportSnapshot) {
    return
  }

  const bounds = canvasRef.value.getViewportBounds?.()
  const snapshot = await canvasRef.value.captureViewportSnapshot()

  if (!bounds || !bounds.width || !bounds.height || !snapshot) {
    console.warn('Не удалось активировать режим карандаша: отсутствуют корректные размеры или снимок полотна')
    return
  }

  pencilBounds.value = bounds
  pencilSnapshot.value = snapshot
  isPencilMode.value = true
}

function handlePencilClose(payload) {
  if (payload?.image) {
    const shouldSave = window.confirm('Сохранить скрин полотна?')

    if (shouldSave) {
      const now = new Date()
      const numberPart = Math.floor(now.getTime() / 1000)
      const timePart = [
        String(now.getHours()).padStart(2, '0'),
        String(now.getMinutes()).padStart(2, '0'),
        String(now.getSeconds()).padStart(2, '0')
      ].join('-')
      const filename = `${numberPart}-${timePart}.png`

      downloadPencilImage(payload.image, filename)
    }
  }

  resetPencilState()
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
      v-show="!isPencilMode"
      :is-modern-theme="isModernTheme"
    />
    <!-- Левая панель -->
    <div
      v-show="!isPencilMode"
      :class="[
        'ui-panel-left',
        {
          collapsed: isLeftPanelCollapsed,
          'ui-panel-left--modern': isModernTheme
        }
      ]"
    >
      <button
        class="ui-panel-left__collapse"
        type="button"
        :title="isLeftPanelCollapsed ? 'Развернуть панель' : 'Свернуть панель'"
        :aria-expanded="!isLeftPanelCollapsed"
        @pointerdown.stop
        @click="toggleLeftPanel"
      >
        <span aria-hidden="true">{{ isLeftPanelCollapsed ? '❯' : '❮' }}</span>
      </button>      
      <ControlPanel
        :is-modern-theme="isModernTheme"
        :is-collapsed="isLeftPanelCollapsed"
        @toggle-theme="toggleTheme"
        @toggle-collapse="toggleLeftPanel"
        @activate-pencil="handleActivatePencil"
        @fit-to-content="handleFitToContent"
        />
    </div>

    <!-- Правая панель -->
    <RightPanel
       v-show="!isPencilMode"     
      :is-modern-theme="isModernTheme"
    />
    <div
      id="canvas"
      :class="{ 'canvas--inactive': isPencilMode }"
    >
      <CanvasBoard ref="canvasRef" />
    </div>
    <PencilOverlay
      v-if="isPencilMode && pencilSnapshot && pencilBounds"
      :snapshot="pencilSnapshot"
      :bounds="pencilBounds"
      :is-modern-theme="isModernTheme"     
      @close="handlePencilClose"
    />    
  </div>
</template>

<style>
:root{
  --card-width: 418px;
  --brand: #0f62fe;
  --ink: #111827;
  --muted: #6b7280;
  --panel: #ffffff;
  --surface: #ffffff;
  --bg: #b9c4da; 
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
.canvas--inactive {
  pointer-events: none;
}
/* Панели */
.ui-panel-left{
  position: fixed;
  top: 24px;
  left: 0;
  z-index: 2000;
  display: flex;
  align-items: stretch;
  justify-content: center;
  padding: 18px 20px;
  background: transparent;
  border-radius: 0 24px 24px 0;
  box-shadow: var(--shadow);
  transition: top .3s ease, transform .3s ease, padding .3s ease;
  height: calc(100vh - 48px);
  max-height: calc(100vh - 48px);
  overflow: visible;
  box-sizing: border-box;
  --left-panel-collapse-bg: rgba(255, 255, 255, 0.94);
  --left-panel-collapse-color: #111827;
  --left-panel-collapse-border: rgba(15, 23, 42, 0.14);
  --left-panel-collapse-shadow: var(--shadow);
  --left-panel-collapse-hover-shadow: 0 22px 42px rgba(15, 98, 254, 0.25);
  --left-panel-collapse-hover-color: #0f62fe;  
}
.ui-panel-left.collapsed {
  top: 20px;
  padding: 16px 20px;
  height: auto;
  max-height: none;  
}
.ui-panel-left--modern {
  --left-panel-collapse-bg: rgba(28, 38, 58, 0.9);
  --left-panel-collapse-color: #e5f3ff;
  --left-panel-collapse-border: rgba(96, 164, 255, 0.35);
  --left-panel-collapse-shadow: 0 18px 34px rgba(6, 11, 21, 0.45);
  --left-panel-collapse-hover-shadow: 0 24px 40px rgba(6, 11, 21, 0.55);
  --left-panel-collapse-hover-color: #73c8ff;
}
.ui-panel-left__collapse {
  position: absolute;
  top: 50%;
  right: -52px;
  transform: translateY(-50%);
  width: 52px;
  min-height: 64px;
  padding: 0 14px;
  border-radius: 0 26px 26px 0;
  border: 1px solid var(--left-panel-collapse-border);
  border-left: none;
  background: var(--left-panel-collapse-bg);
  color: var(--left-panel-collapse-color);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: var(--left-panel-collapse-shadow);
  backdrop-filter: blur(22px);
  transition: transform .2s ease, box-shadow .2s ease, color .2s ease;
}

.ui-panel-left__collapse:hover {
  transform: translateY(-50%) translateX(2px);
  box-shadow: var(--left-panel-collapse-hover-shadow);
  color: var(--left-panel-collapse-hover-color);
}

.ui-panel-left__collapse span {
  pointer-events: none;
}

.ui-panel-left.collapsed .ui-panel-left__collapse {
  top: 50%;
}  
/* Canvas/SVG */
#canvas{ position:relative; width:100%; height:100%; transform-origin:0 0; cursor:default; }
</style>
