<script setup>
import { ref, onMounted, onBeforeUnmount, computed, watch } from 'vue'
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
import AuthModal from './components/AuthModal.vue'
import UserProfile from './components/UserProfile.vue'
import BoardsModal from './components/Board/BoardsModal.vue' 
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
import { makeBoardThumbnail } from './utils/boardThumbnail'
 
const authStore = useAuthStore()
const canvasStore = useCanvasStore() // Предполагаемая инициализация
const boardStore = useBoardStore()
const cardsStore = useCardsStore() // Assuming initialization
const connectionsStore = useConnectionsStore() // Assuming initialization
const viewportStore = useViewportStore()
const mobileStore = useMobileStore()
const viewSettingsStore = useViewSettingsStore()
const { isAuthenticated } = storeToRefs(authStore)
const { isSaving, currentBoardId, currentBoardName } = storeToRefs(boardStore)
const { isMobileMode } = storeToRefs(mobileStore)
const { headerColor, headerColorIndex } = storeToRefs(viewSettingsStore)

const { zoomPercentage } = storeToRefs(viewportStore)
const zoomDisplay = computed(() => `${zoomPercentage.value}%`)
const isSaveAvailable = computed(() => {
  const boardName = (currentBoardName.value ?? '').trim()

  return boardName.length > 0
})

const saveTooltip = computed(() =>
  isSaveAvailable.value
    ? 'Сохранить проект'
    : 'Задайте название проекта, чтобы сохранить'
)

const { handleExportHTML, handleLoadProject } = useProjectActions()

const isModernTheme = ref(false)
const isPencilMode = ref(false)
const pencilSnapshot = ref(null)
const pencilBounds = ref(null)
const canvasRef = ref(null)
const showProfile = ref(false)
const showMobileAuthPrompt = ref(false)
const mobileAuthModalView = ref('login')
const isMobileAuthModalOpen = ref(false)
const isBoardsModalOpen = ref(false)
const menuTouchPointers = new Map()
let menuPointerListenersAttached = false
let initialMenuPinchDistance = null

const MENU_SCALE_MIN = 1
const MENU_SCALE_MAX = 1.6

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

const calculateAverageDistance = () => {
  const pointers = Array.from(menuTouchPointers.values())
  if (pointers.length < 2) {
    return 0
  }

  const activePointers = pointers.slice(0, 3)
  let totalDistance = 0
  let pairs = 0

  for (let i = 0; i < activePointers.length; i += 1) {
    for (let j = i + 1; j < activePointers.length; j += 1) {
      const dx = activePointers[i].x - activePointers[j].x
      const dy = activePointers[i].y - activePointers[j].y
      totalDistance += Math.hypot(dx, dy)
      pairs += 1
    }
  }

  if (pairs === 0) {
    return 0
  }

  return totalDistance / pairs
}

const resetMenuPinchState = () => {
  initialMenuPinchDistance = null
  mobileStore.resetMenuScale()
} 
// Состояние для сброса пароля
const showResetPassword = ref(false)
const resetToken = ref('')

// Автосохранение
let autoSaveInterval = null
const API_URL = import.meta.env.VITE_API_URL || 'https://interactive.marketingfohow.ru'

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

    const content = data.board.content || {}

    // Восстанавливаем фон
    if (content.background) {
      canvasStore.backgroundColor = content.background
    }
  
    // Восстанавливаем карточки через специализированный метод,
    // чтобы сохранить оригинальные стили и параметры
    const cardsData = Array.isArray(content.objects) ? content.objects : []
    cardsStore.loadCards(cardsData)

    // Восстанавливаем соединения через стандартный загрузчик,
    // чтобы корректно перенести все свойства
    const connectionsData = Array.isArray(content.connections)
      ? content.connections
      : []
    connectionsStore.loadConnections(connectionsData)

    console.log('✅ Загружена доска:', data.board.name)
    console.log('  Карточек:', cardsData.length)
    console.log('  Соединений:', connectionsData.length) 
    
    boardStore.isSaving = false
    
    // Запускаем автосохранение происходит через наблюдатель isSaveAvailable

  } catch (err) {
    console.error('❌ Ошибка загрузки доски:', err)
    alert('Не удалось загрузить доску')
    boardStore.isSaving = false
  }
}

async function saveCurrentBoard() {
  if (!isSaveAvailable.value || !authStore.isAuthenticated) {
    return
  }

  try {
    boardStore.isSaving = true

    // Получаем состояние canvas
    const canvasState = getCanvasState()
    const boardName = (currentBoardName.value ?? '').trim()
    let boardId = currentBoardId.value

    if (!boardId) {
      const createResponse = await fetch(`${API_URL}/boards`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authStore.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: boardName,
          content: canvasState
        })
      })

      if (!createResponse.ok) {
        throw new Error('Ошибка создания доски')
      }

      const createData = await createResponse.json()
      const createdBoard = createData?.board ?? createData 

      if (!createdBoard?.id) {
        throw new Error('Сервер не вернул идентификатор новой доски')
      }

      boardStore.setCurrentBoard(createdBoard.id, createdBoard.name ?? boardName)
      boardId = createdBoard.id

      window.dispatchEvent(new CustomEvent('boards:refresh'))
    }

    const response = await fetch(`${API_URL}/boards/${boardId}`, {
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
    await uploadBoardThumbnail(boardId)
   
    console.log('💾 Доска автоматически сохранена:', new Date().toLocaleTimeString())
  } catch (err) {
    console.error('❌ Ошибка автосохранения:', err)
    boardStore.isSaving = false
  }
}
async function uploadBoardThumbnail(boardId) {
  if (!boardId || !authStore.token) {
    return
  }

  const canvasElement = canvasRef.value?.$el instanceof HTMLElement
    ? canvasRef.value.$el
    : null

  const dataUrl = await makeBoardThumbnail(canvasElement)

  if (!dataUrl) {
    return
  }

  try {
    const response = await fetch(`${API_URL}/boards/${boardId}/thumbnail`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ image: dataUrl })
    })

    if (!response.ok) {
      throw new Error('Ошибка загрузки миниатюры')
    }

    let payload = null

    try {
      payload = await response.json()
    } catch (parseError) {
      payload = null
    }

    const thumbnailUrl = payload?.board?.thumbnail_url ?? payload?.thumbnail_url ?? null

    window.dispatchEvent(
      new CustomEvent('boards:refresh', {
        detail: { boardId, thumbnailUrl }
      })
    )
  } catch (error) {
    console.error('❌ Не удалось обновить миниатюру доски:', error)
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
    type: card.type,   
    bodyHTML: card.bodyHTML,
    bodyGradient: card.bodyGradient,  
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
  if (!isSaveAvailable.value || !authStore.isAuthenticated) {
    return
  }
 
  // Останавливаем предыдущий интервал, если был
  stopAutoSave()

  // Автосохранение каждые 10 мину
  autoSaveInterval = setInterval(() => {
    if (isSaveAvailable.value && authStore.isAuthenticated) {
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
function openMobileAuthPrompt() {
  showMobileAuthPrompt.value = true
}

function closeMobileAuthPrompt() {
  showMobileAuthPrompt.value = false
}

function handleMobileAuthLogin() {
  mobileAuthModalView.value = 'login'
  isMobileAuthModalOpen.value = true
  closeMobileAuthPrompt()
}

function handleMobileAuthRegister() {
  mobileAuthModalView.value = 'register'
  isMobileAuthModalOpen.value = true
  closeMobileAuthPrompt()
}

function handleMobileAuthClose() {
  isMobileAuthModalOpen.value = false
}

function handleMobileAuthSuccess() {
  isMobileAuthModalOpen.value = false
}

function handleOpenProfile() {
  if (isAuthenticated.value) {
    showProfile.value = true
    return
  }

  openMobileAuthPrompt()
}

function handleOpenMobileBoards() {
  if (!isAuthenticated.value) {
    openMobileAuthPrompt()
    return
  }

  isBoardsModalOpen.value = true
}

function handleMobileBoardsClose() {
  isBoardsModalOpen.value = false
}

function handleMobileBoardSelect(boardId) {
  isBoardsModalOpen.value = false
  openBoard(boardId)
}

const updateMenuScaleState = () => {
  if (!isMobileMode.value) {
    menuTouchPointers.clear()
    resetMenuPinchState()
    return   
  }

  if (menuTouchPointers.size < 3) {
    resetMenuPinchState()
    return
  }

  const distance = calculateAverageDistance()
  if (!distance) {
    return
  }

  if (initialMenuPinchDistance === null) {
    initialMenuPinchDistance = distance
    mobileStore.resetMenuScale()
    return
  }

  if (initialMenuPinchDistance === 0) {
    return
  }

  const scaleRatio = clamp(distance / initialMenuPinchDistance, MENU_SCALE_MIN, MENU_SCALE_MAX)
  mobileStore.setMenuScale(scaleRatio)
}

const handleMenuPointerDown = (event) => {
  if (!isMobileMode.value || event.pointerType !== 'touch') {
    return
  }

  menuTouchPointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
  if (menuTouchPointers.size >= 3) {
    initialMenuPinchDistance = null
  }
  updateMenuScaleState()
}

const handleMenuPointerMove = (event) => {
  if (!isMobileMode.value || event.pointerType !== 'touch') {
    return
  }

  if (!menuTouchPointers.has(event.pointerId)) {
    return
  }

  menuTouchPointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
  updateMenuScaleState()
}

const handleMenuPointerUp = (event) => {
  if (event.pointerType !== 'touch') {
    return
  }

  const wasPresent = menuTouchPointers.delete(event.pointerId)
  if (wasPresent && menuTouchPointers.size < 3) {
    initialMenuPinchDistance = null
  }
  updateMenuScaleState()
}

const attachMenuPointerListeners = () => {
  if (menuPointerListenersAttached) {
    return
  }

  window.addEventListener('pointerdown', handleMenuPointerDown)
  window.addEventListener('pointermove', handleMenuPointerMove) 
  window.addEventListener('pointerup', handleMenuPointerUp)
  window.addEventListener('pointercancel', handleMenuPointerUp)
  window.addEventListener('pointerleave', handleMenuPointerUp)
  window.addEventListener('pointerout', handleMenuPointerUp)
  menuPointerListenersAttached = true
}

const detachMenuPointerListeners = () => {
  if (!menuPointerListenersAttached) {
    return
  }

  window.removeEventListener('pointerdown', handleMenuPointerDown)
  window.removeEventListener('pointermove', handleMenuPointerMove) 
  window.removeEventListener('pointerup', handleMenuPointerUp)
  window.removeEventListener('pointercancel', handleMenuPointerUp)
  window.removeEventListener('pointerleave', handleMenuPointerUp)
  window.removeEventListener('pointerout', handleMenuPointerUp)
  menuPointerListenersAttached = false
  menuTouchPointers.clear()
  resetMenuPinchState()
}
watch(isAuthenticated, (value) => {
  if (value) {
    showMobileAuthPrompt.value = false
    isMobileAuthModalOpen.value = false
  }
})
watch(isSaveAvailable, (canSave) => {
  if (canSave) {
    startAutoSave()
  } else {
    stopAutoSave()
  }
}) 
watch(isMobileMode, (value) => {
  if (!value) {
    isBoardsModalOpen.value = false
    detachMenuPointerListeners()
  } else {
    attachMenuPointerListeners()   
  }
})

onMounted(async () => {
  // Инициализируем authStore - загружаем данные пользователя
  await authStore.init()

  // Определяем тип устройства
  mobileStore.detectDevice()
  if (isMobileMode.value) {
    attachMenuPointerListeners()
  }

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
  detachMenuPointerListeners() 
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
        class="zoom-floating-button"
        :class="{ 'zoom-floating-button--modern': isModernTheme }"
        type="button"
        title="Автоподгонка масштаба"
        @click="handleFitToContent"
      >
        Масштаб: <span class="zoom-floating-button__value">{{ zoomDisplay }}</span>
      </button>
      <button
        v-if="isAuthenticated"
        v-show="!isPencilMode && !showResetPassword"
        class="save-floating-button"
        :class="{ 'save-floating-button--modern': isModernTheme }"
        type="button"
        :disabled="isSaving || !isSaveAvailable"
        :title="saveTooltip"
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
        @open-boards="handleOpenMobileBoards"
        @request-auth="openMobileAuthPrompt"
        @export-html="handleMobileExportHTML"
        @load-json="handleMobileLoadJSON"
      />
      <MobileToolbar
        v-show="!isPencilMode && !showResetPassword"
        :is-modern-theme="isModernTheme"
        @save="saveCurrentBoard"
        @toggle-theme="toggleTheme"
        @fit-to-content="handleFitToContent"
        @open-profile="handleOpenProfile"
        @request-auth="openMobileAuthPrompt"
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
    <transition name="fade">
      <div
        v-if="showMobileAuthPrompt && isMobileMode"
        class="mobile-auth-overlay"
        @click.self="closeMobileAuthPrompt"
      >
        <div
          :class="['mobile-auth-dialog', { 'mobile-auth-dialog--modern': isModernTheme }]"
          role="dialog"
          aria-modal="true"
        >
          <h2 class="mobile-auth-dialog__title">Добро пожаловать</h2>
          <p class="mobile-auth-dialog__subtitle">Выберите действие для продолжения</p>
          <div class="mobile-auth-dialog__actions">
            <button
              type="button"
              class="mobile-auth-dialog__button mobile-auth-dialog__button--primary"
              @click="handleMobileAuthLogin"
            >
              Войти
            </button>
            <button
              type="button"
              class="mobile-auth-dialog__button mobile-auth-dialog__button--secondary"
              @click="handleMobileAuthRegister"
            >
              Регистрация
            </button>
          </div>
          <button
            type="button"
            class="mobile-auth-dialog__close"
            @click="closeMobileAuthPrompt"
          >
            Отмена
          </button>
        </div>
      </div>
    </transition>

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

    <AuthModal
      v-if="isMobileAuthModalOpen"
      :is-open="isMobileAuthModalOpen"
      :initial-view="mobileAuthModalView"
      :is-modern-theme="isModernTheme"
      @close="handleMobileAuthClose"
      @success="handleMobileAuthSuccess"
    />
    <BoardsModal
      :is-open="isBoardsModalOpen"
      @close="handleMobileBoardsClose"
      @open-board="handleMobileBoardSelect"
    />   
    <Teleport to="body">
      <div
        v-if="showProfile"
        :class="['profile-modal-overlay', { 'profile-modal-overlay--modern': isModernTheme }]"
        @click.self="showProfile = false"
      >
        <UserProfile
          :is-modern-theme="isModernTheme"
          @close="showProfile = false"
        />
      </div>
    </Teleport>
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
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.mobile-auth-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(10, 18, 36, 0.45);
  z-index: 1100;
}

.mobile-auth-dialog {
  width: 100%;
  max-width: 360px;
  background: rgba(255, 255, 255, 0.98);
  border-radius: 18px;
  box-shadow: 0 20px 45px rgba(15, 24, 44, 0.28);
  padding: 24px 20px 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  text-align: center;
  backdrop-filter: blur(12px);
}

.mobile-auth-dialog--modern {
  background: rgba(24, 33, 54, 0.96);
  color: #e5f3ff;
  box-shadow: 0 24px 60px rgba(12, 20, 38, 0.45);
  border: 1px solid rgba(87, 148, 255, 0.28);
}

.mobile-auth-dialog__title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: #111827;
}

.mobile-auth-dialog--modern .mobile-auth-dialog__title {
  color: #f8fbff;
}

.mobile-auth-dialog__subtitle {
  margin: 0;
  font-size: 14px;
  color: #4b5563;
}

.mobile-auth-dialog--modern .mobile-auth-dialog__subtitle {
  color: rgba(229, 243, 255, 0.72);
}

.mobile-auth-dialog__actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.mobile-auth-dialog__button {
  width: 100%;
  border: none;
  border-radius: 12px;
  padding: 12px 16px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.mobile-auth-dialog__button--primary {
  background: linear-gradient(135deg, #0f62fe 0%, #0353e9 100%);
  color: #ffffff;
  box-shadow: 0 12px 24px rgba(15, 98, 254, 0.35);
}

.mobile-auth-dialog__button--secondary {
  background: rgba(15, 98, 254, 0.08);
  color: #0f62fe;
  border: 1px solid rgba(15, 98, 254, 0.4);
}

.mobile-auth-dialog--modern .mobile-auth-dialog__button--secondary {
  background: rgba(37, 99, 235, 0.18);
  color: #e5f3ff;
  border-color: rgba(118, 169, 255, 0.45);
}

.mobile-auth-dialog__button:active {
  transform: scale(0.98);
}

.mobile-auth-dialog__close {
  border: none;
  background: transparent;
  color: #6b7280;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
} 
.profile-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  z-index: 10000;
}

.profile-modal-overlay--modern {
  background: rgba(5, 12, 24, 0.8);
}

.mobile-auth-dialog--modern .mobile-auth-dialog__close {
  color: rgba(229, 243, 255, 0.7);
}

@media (max-width: 420px) {
  .mobile-auth-dialog {
    max-width: 320px;
    padding: 20px 16px 16px;
  }

  .mobile-auth-dialog__title {
    font-size: 18px;
  }

  .mobile-auth-dialog__button {
    font-size: 15px;
  }
}

.zoom-floating-button {
  position: fixed;
  left: 50%;
  bottom: 24px;
  transform: translateX(-50%);
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

.zoom-floating-button:hover {
  transform: translateX(-50%) translateY(-2px);
  box-shadow: 0 24px 42px rgba(15, 98, 254, 0.32);
  background: #0f62fe;
  color: #ffffff;
  border-color: rgba(15, 98, 254, 0.8);
}

.zoom-floating-button__value {
  margin-left: 6px;
  font-weight: 800;
}

.zoom-floating-button--modern {
  border-color: rgba(104, 171, 255, 0.45);
  background: rgba(32, 44, 68, 0.9);
  color: #e5f3ff;
  box-shadow: 0 22px 42px rgba(6, 11, 21, 0.55);
}

.zoom-floating-button--modern:hover {
  transform: translateX(-50%) translateY(-2px);
  box-shadow: 0 28px 48px rgba(12, 84, 196, 0.4);
  background: #0f62fe;
  color: #ffffff;
  border-color: rgba(15, 98, 254, 0.85);
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
.app--mobile .save-floating-button,
.app--mobile .zoom-floating-button {
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
