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
const pencilInitialScale = ref(1)
const pencilInitialTranslateX = ref(0)
const pencilInitialTranslateY = ref(0)
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
  pencilInitialScale.value = 1
  pencilInitialTranslateX.value = 0
  pencilInitialTranslateY.value = 0  
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
  const canvasApi = canvasRef.value

  if (!canvasApi?.captureViewportSnapshot) {
    return
  }

  const bounds = canvasApi.getViewportBounds?.()
  const transform = canvasApi.getCurrentViewTransform?.()

  let snapshotResult = null
  if (typeof canvasApi.captureStageSnapshot === 'function') {
    snapshotResult = await canvasApi.captureStageSnapshot()
  }

  let snapshot = snapshotResult?.image
  if (!snapshot) {
    snapshot = await canvasApi.captureViewportSnapshot()
    pencilInitialScale.value = 1
    pencilInitialTranslateX.value = 0
    pencilInitialTranslateY.value = 0
  } else {
    pencilInitialScale.value = Number.isFinite(transform?.scale) ? transform.scale : 1
    pencilInitialTranslateX.value = Number.isFinite(transform?.translateX) ? transform.translateX : 0
    pencilInitialTranslateY.value = Number.isFinite(transform?.translateY) ? transform.translateY : 0
  }

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
          collapsed: isLeftPanelCollapsed
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
      :initial-scale="pencilInitialScale"
      :initial-translate-x="pencilInitialTranslateX"
      :initial-translate-y="pencilInitialTranslateY"
      @close="handlePencilClose"
    />    
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

.ui-panel-left__collapse {
  position: absolute;
  top: 50%;
  right: -52px;
  transform: translateY(-50%);
  width: 52px;
  min-height: 64px;
  padding: 0 14px;
  border-radius: 0 26px 26px 0;
  border: 1px solid rgba(15, 23, 42, 0.14);
  border-left: none;
  background: rgba(255, 255, 255, 0.94);
  color: #111827;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: var(--shadow);
  backdrop-filter: blur(22px);
  transition: transform .2s ease, box-shadow .2s ease, color .2s ease;
}

.ui-panel-left__collapse:hover {
  transform: translateY(-50%) translateX(2px);
  box-shadow: 0 22px 42px rgba(15, 98, 254, 0.25);
  color: #0f62fe;
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
