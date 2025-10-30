<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import CanvasBoard from './components/Canvas/CanvasBoard.vue'
import ControlPanel from './components/Panels/ControlPanel.vue'
import RightPanel from './components/Panels/RightPanel.vue'
import AppHeader from './components/Layout/AppHeader.vue'
import PencilOverlay from './components/Overlay/PencilOverlay.vue'
import ResetPasswordForm from './components/ResetPasswordForm.vue'

const isModernTheme = ref(false)
const isLeftPanelCollapsed = ref(false)
const isPencilMode = ref(false)
const pencilSnapshot = ref(null)
const pencilBounds = ref(null)  
const canvasRef = ref(null)

// Состояние для сброса пароля
const showResetPassword = ref(false)
const resetToken = ref('')

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

function handleResetPasswordSuccess() {
  showResetPassword.value = false
  // Можно открыть форму входа через AppHeader
}

onMounted(() => {
  // Проверяем URL на токен сброса пароля
  const urlParams = new URLSearchParams(window.location.search)
  const token = urlParams.get('token')
  if (token) {
    resetToken.value = token
    showResetPassword.value = true
    // Очищаем URL от токена
    window.history.replaceState({}, document.title, window.location.pathname)
  }
  
  window.addEventListener('keydown', handleGlobalKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
})
</script>

<template>
  <div id="app">
    <AppHeader
      v-show="!isPencilMode && !showResetPassword"
      :is-modern-theme="isModernTheme"
    />
    
    <!-- Левая панель -->
    <div
      v-show="!isPencilMode && !showResetPassword"
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
      v-show="!isPencilMode && !showResetPassword"     
      :is-modern-theme="isModernTheme"
    />
    
    <div
      id="canvas"
      :class="{ 'canvas--inactive': isPencilMode || showResetPassword }"
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
    
    <!-- Модальное окно сброса пароля -->
    <div v-if="showResetPassword" class="reset-password-overlay">
      <div class="reset-password-modal">
        <ResetPasswordForm
          :token="resetToken"
          @success="handleResetPasswordSuccess"
        />
      </div>
    </div>
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
  --ui-panel-scale: 1;  
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
  filter: blur(5px);
}

/* Модальное окно сброса пароля */
.reset-password-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.reset-password-modal {
  background: white;
  border-radius: 10px;
  max-width: 500px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
}

/* Панели */
.ui-panel-left{
  --ui-left-panel-scale: var(--ui-panel-scale, 1);  
  position: fixed;
  top: 20px;
  left: 0;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: calc(18px * var(--ui-left-panel-scale)) calc(20px * var(--ui-left-panel-scale));
  background: transparent;
  border-radius: 0 calc(24px * var(--ui-left-panel-scale)) calc(24px * var(--ui-left-panel-scale)) 0;
  box-shadow: var(--shadow);
  transition: top .3s ease, transform .3s ease, padding .3s ease;
  max-height: none;
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
  top: calc(16px * var(--ui-left-panel-scale));
  padding: calc(16px * var(--ui-left-panel-scale)) calc(20px * var(--ui-left-panel-scale));
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
  right: calc(-52px * var(--ui-left-panel-scale));
  transform: translateY(-50%);
  width: calc(52px * var(--ui-left-panel-scale));
  min-height: calc(64px * var(--ui-left-panel-scale));
  padding: 0 calc(14px * var(--ui-left-panel-scale));
  border-radius: 0 calc(26px * var(--ui-left-panel-scale)) calc(26px * var(--ui-left-panel-scale)) 0;
  border: 1px solid var(--left-panel-collapse-border);
  border-left: none;
  background: var(--left-panel-collapse-bg);
  color: var(--left-panel-collapse-color);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: calc(20px * var(--ui-left-panel-scale));
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
