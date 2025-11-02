<script setup>
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import CanvasBoard from './components/Canvas/CanvasBoard.vue'
import AppHeader from './components/Layout/AppHeader.vue'
import TopMenuButtons from './components/Layout/TopMenuButtons.vue'
import MobileHeader from './components/Layout/MobileHeader.vue'
import MobileToolbar from './components/Layout/MobileToolbar.vue'
import MobileSidebar from './components/Layout/MobileSidebar.vue'
import MobileVersionDialog from './components/Layout/MobileVersionDialog.vue'
import VersionSwitcher from './components/Layout/VersionSwitcher.vue'
import PencilOverlay from './components/Overlay/PencilOverlay.vue'
import ResetPasswordForm from './components/ResetPasswordForm.vue'
import { useAuthStore } from './stores/auth'
import { useCanvasStore } from './stores/canvas' // Предполагаемый импорт
import { useBoardStore } from './stores/board'
import { useCardsStore } from './stores/cards' // Assuming this store exists
import { useConnectionsStore } from './stores/connections' // Assuming this store exists
import { useViewportStore } from './stores/viewport'
import { useMobileStore } from './stores/mobile'
import { useViewSettingsStore } from './stores/viewSettings'
import { useProjectActions } from './composables/useProjectActions'
import { storeToRefs } from 'pinia'

const authStore = useAuthStore()
const canvasStore = useCanvasStore() // Предполагаемая инициализация
const boardStore = useBoardStore()
const cardsStore = useCardsStore() // Assuming initialization
const connectionsStore = useConnectionsStore() // Assuming initialization
const viewportStore = useViewportStore()
const mobileStore = useMobileStore()
const viewSettingsStore = useViewSettingsStore()
const { isAuthenticated } = storeToRefs(authStore)
const { isSaving } = storeToRefs(boardStore)
const { isMobileMode } = storeToRefs(mobileStore)
const { headerColor, headerColorIndex } = storeToRefs(viewSettingsStore)

const { zoomPercentage } = storeToRefs(viewportStore)
const zoomDisplay = computed(() => `${zoomPercentage.value}%`)

const { handleExportHTML, handleLoadProject } = useProjectActions()

const isModernTheme = ref(false)
const isPencilMode = ref(false)
const pencilSnapshot = ref(null)
const pencilBounds = ref(null)
const canvasRef = ref(null)
const showProfile = ref(false)

// Состояние для сброса пароля
const showResetPassword = ref(false)
const resetToken = ref('')

// Автосохранение
let autoSaveInterval = null
const API_URL = import.meta.env.VITE_API_URL || 'https://interactive.marketingfohow.ru/api'

function toggleTheme() {
  isModernTheme.value = !isModernTheme.value
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
}

async function openBoard(boardId) {
  // Загружаем доску
  await loadBoard(boardId)
}

async function loadBoard(boardId) {
  try {
    boardStore.isSaving = true
    
    const response = await fetch(`${API_URL}/boards/${boardId}`, {
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    })

    if (!response.ok) {
      throw new Error('Ошибка загрузки доски')
    }

    const data = await response.json()
    
    // Устанавливаем текущую доску
    boardStore.setCurrentBoard(data.board.id, data.board.name)

    // Очищаем текущее состояние
    cardsStore.cards = []
    connectionsStore.connections = []

    // Загружаем содержимое доски
    if (data.board.content) {
      const content = data.board.content

      // Восстанавливаем фон
      if (content.background) {
        canvasStore.backgroundColor = content.background
      }

      // Восстанавливаем карточки
      if (content.objects && Array.isArray(content.objects)) {
        content.objects.forEach(cardData => {
          cardsStore.addCard(cardData, { saveToHistory: false })
        })
      }

      // Восстанавливаем соединения
      if (content.connections && Array.isArray(content.connections)) {
        content.connections.forEach(connData => {
          connectionsStore.addConnection(connData.from, connData.to, {
            ...connData,
            saveToHistory: false
          })
        })
      }

      console.log('✅ Загружена доска:', data.board.name)
      console.log('  Карточек:', content.objects?.length || 0)
      console.log('  Соединений:', content.connections?.length || 0)
    }
    
    boardStore.isSaving = false
    
    // Запускаем автосохранение
    startAutoSave()
  } catch (err) {
    console.error('❌ Ошибка загрузки доски:', err)
    alert('Не удалось загрузить доску')
    boardStore.isSaving = false
  }
}

async function saveCurrentBoard() {
  if (!boardStore.currentBoardId || !authStore.isAuthenticated) {
    return
  }

  try {
    boardStore.isSaving = true

    // Получаем состояние canvas
    const canvasState = getCanvasState()

    const response = await fetch(`${API_URL}/boards/${boardStore.currentBoardId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${authStore.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        content: canvasState
      })
    })

    if (!response.ok) {
      throw new Error('Ошибка сохранения')
    }

    boardStore.markAsSaved()
    console.log('💾 Доска автоматически сохранена:', new Date().toLocaleTimeString())
  } catch (err) {
    console.error('❌ Ошибка автосохранения:', err)
    boardStore.isSaving = false
  }
}

function getCanvasState() {
  // Получаем все карточки и соединения из stores
  const cardsData = cardsStore.cards.map(card => ({
    id: card.id,
    x: card.x,
    y: card.y,
    width: card.width,
    height: card.height,
    text: card.text,
    fill: card.fill,
    stroke: card.stroke,
    strokeWidth: card.strokeWidth,
    headerBg: card.headerBg,
    colorIndex: card.colorIndex,
    bodyHTML: card.bodyHTML,
    pv: card.pv,
    note: card.note // сохраняем заметки тоже
  }))

  const connectionsData = connectionsStore.connections.map(conn => ({
    id: conn.id,
    from: conn.from,
    to: conn.to,
    fromSide: conn.fromSide,
    toSide: conn.toSide,
    color: conn.color,
    thickness: conn.thickness,
    highlightType: conn.highlightType,
    animationDuration: conn.animationDuration
  }))

  console.log('📤 Сохраняем состояние:', {
    cardsCount: cardsData.length,
    connectionsCount: connectionsData.length
  })

  return {
    version: 1,
    background: canvasStore.backgroundColor,
    zoom: 1, // пока фиксированное значение
    objects: cardsData,
    connections: connectionsData
  }
}

function startAutoSave() {
  // Останавливаем предыдущий интервал, если был
  stopAutoSave()

  // Автосохранение каждые 10 мину
  autoSaveInterval = setInterval(() => {
    if (boardStore.currentBoardId && authStore.isAuthenticated) {
      saveCurrentBoard()
    }
  }, 600000) // 10 минут

  console.log('🔄 Автосохранение запущено (каждые 10 минут)')
}

function stopAutoSave() {
  if (autoSaveInterval) {
    clearInterval(autoSaveInterval)
    autoSaveInterval = null
    console.log('⏹️ Автосохранение остановлено')
  }
}

// Mobile-specific functions
function handleAddLicense() {
  cardsStore.addCard({
    type: 'small',
    headerBg: headerColor.value,
    colorIndex: headerColorIndex.value
  })
}

function handleAddLower() {
  cardsStore.addCard({
    type: 'large',
    headerBg: headerColor.value,
    colorIndex: headerColorIndex.value
  })
}

function handleAddGold() {
  cardsStore.addCard({
    type: 'gold'
  })
}

function handleAddTemplate(templateId) {
  if (!templateId) {
    // If no template ID is provided, just add a default card
    cardsStore.addCard({
      type: 'large',
      headerBg: headerColor.value,
      colorIndex: headerColorIndex.value
    })
    return
  }

  // Load and insert the template
  // This will be handled by the template insertion logic in MobileSidebar
  console.log('Template selected:', templateId)
}

function handleMobileExportHTML() {
  handleExportHTML()
}

function handleMobileLoadJSON() {
  handleLoadProject()
}

function handleOpenProfile() {
  showProfile.value = true
}

function handleLogout() {
  if (confirm('Вы уверены, что хотите выйти?')) {
    authStore.logout()
  }
}

onMounted(async () => {
  // Инициализируем authStore - загружаем данные пользователя
  await authStore.init()

  // Определяем тип устройства
  mobileStore.detectDevice()

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
  stopAutoSave()
})
</script>

<template>
  <div id="app" :class="{ 'app--mobile': isMobileMode }">
    <!-- Desktop UI -->
    <template v-if="!isMobileMode">
      <TopMenuButtons
        v-show="!isPencilMode && !showResetPassword"
        :is-modern-theme="isModernTheme"
        @toggle-theme="toggleTheme"
        @activate-pencil="handleActivatePencil"
      />
      <AppHeader
        v-show="!isPencilMode && !showResetPassword"
        :is-modern-theme="isModernTheme"
        :zoom-display="zoomDisplay"
        @open-board="openBoard"
        @save-board="saveCurrentBoard"
        @toggle-theme="toggleTheme"
        @fit-to-content="handleFitToContent"
      />
      <button
        v-if="isAuthenticated"
        v-show="!isPencilMode && !showResetPassword"
        class="save-floating-button"
        :class="{ 'save-floating-button--modern': isModernTheme }"
        type="button"
        :disabled="isSaving"
        @click="saveCurrentBoard"
      >
        💾 Сохранить
      </button>
    </template>

    <!-- Mobile UI -->
    <template v-else>
      <MobileHeader
        v-show="!isPencilMode && !showResetPassword"
        :is-modern-theme="isModernTheme"
        @toggle-theme="toggleTheme"
        @open-profile="handleOpenProfile"
        @export-html="handleMobileExportHTML"
        @load-json="handleMobileLoadJSON"
        @open-board="openBoard"
        @logout="handleLogout"
      />
      <MobileToolbar
        v-show="!isPencilMode && !showResetPassword"
        :is-modern-theme="isModernTheme"
        @save="saveCurrentBoard"
        @toggle-theme="toggleTheme"
        @fit-to-content="handleFitToContent"
      />
      <MobileSidebar
        v-show="!isPencilMode && !showResetPassword"
        :is-modern-theme="isModernTheme"
        @add-license="handleAddLicense"
        @add-lower="handleAddLower"
        @add-gold="handleAddGold"
        @add-template="handleAddTemplate"
      />
      <MobileVersionDialog />
    </template>

    <!-- Canvas (shared between mobile and desktop) -->
    <div
      id="canvas"
      :class="{
        'canvas--inactive': isPencilMode || showResetPassword,
        'canvas--mobile': isMobileMode
      }"
    >
      <CanvasBoard ref="canvasRef" :is-modern-theme="isModernTheme" />
    </div>

    <!-- Pencil Overlay (shared) -->
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

    <!-- Version Switcher (только для десктопа) -->
    <VersionSwitcher
      v-if="!isMobileMode"
      v-show="!isPencilMode && !showResetPassword"
      :is-modern-theme="isModernTheme"
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

.save-floating-button {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 1800;
  padding: 12px 22px;
  border-radius: 18px;
  border: 1px solid rgba(148, 163, 184, 0.45);
  background: rgba(248, 250, 252, 0.92);
  color: #0f172a;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 18px 36px rgba(15, 23, 42, 0.2);
  transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease, color 0.2s ease, border-color 0.2s ease;
  backdrop-filter: blur(6px);
}

.save-floating-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 24px 42px rgba(15, 98, 254, 0.32);
  background: #0f62fe;
  color: #ffffff;
  border-color: rgba(15, 98, 254, 0.8);
}

.save-floating-button:disabled {
  cursor: default;
  opacity: 0.7;
  box-shadow: none;
}

.save-floating-button--modern {
  border-color: rgba(104, 171, 255, 0.45);
  background: rgba(32, 44, 68, 0.9);
  color: #e5f3ff;
  box-shadow: 0 22px 42px rgba(6, 11, 21, 0.55);
}

.save-floating-button--modern:hover:not(:disabled) {
  box-shadow: 0 28px 48px rgba(12, 84, 196, 0.4);
  background: #0f62fe;
  color: #ffffff;
  border-color: rgba(15, 98, 254, 0.85);
}

/* Canvas/SVG */
#canvas {
  position: relative;
  width: 100%;
  height: 100%;
  transform-origin: 0 0;
  cursor: default;
}

/* Mobile adjustments */
.app--mobile #canvas {
  padding-top: 56px;
  padding-bottom: 68px;
  height: 100vh;
  box-sizing: border-box;
}

.canvas--mobile {
  overflow: hidden;
}

/* Hide desktop-only elements in mobile mode */
.app--mobile .save-floating-button {
  display: none;
}

/* Responsive optimizations for mobile */
@media (max-width: 768px) {
  .app--mobile {
    overflow: hidden;
  }

  .app--mobile #canvas {
    touch-action: pan-x pan-y pinch-zoom;
  }
}

@media (max-width: 480px) {
  .app--mobile #canvas {
    padding-top: 52px;
    padding-bottom: 64px;
  }
}

@media (max-width: 360px) {
  .app--mobile #canvas {
    padding-top: 52px;
    padding-bottom: 64px;
  }
}
</style>
