<script setup>
import { ref, onMounted, onBeforeUnmount, computed, watch, provide } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import CanvasBoard from './components/Canvas/CanvasBoard.vue'
import AppHeader from './components/Layout/AppHeader.vue'
import TopMenuButtons from './components/Layout/TopMenuButtons.vue'
import MobileHeader from './components/Layout/MobileHeader.vue'
import MobileToolbar from './components/Layout/MobileToolbar.vue'
import MobileSidebar from './components/Layout/MobileSidebar.vue'
import MobileFullMenu from './components/Layout/MobileFullMenu.vue'
import MobileVersionDialog from './components/Layout/MobileVersionDialog.vue'
import VersionSwitcher from './components/Layout/VersionSwitcher.vue'
import PencilOverlay from './components/Overlay/PencilOverlay.vue'
import ResetPasswordForm from './components/ResetPasswordForm.vue'
import AuthModal from './components/AuthModal.vue'
import UserProfile from './components/UserProfile.vue'
import BoardsModal from './components/Board/BoardsModal.vue'
import StructureNameModal from './components/Board/StructureNameModal.vue'
import { useAuthStore } from './stores/auth'
import { useCanvasStore } from './stores/canvas'
import { useBoardStore } from './stores/board'
import { useCardsStore } from './stores/cards'
import { useConnectionsStore } from './stores/connections'
import { useStickersStore } from './stores/stickers'
import { useViewportStore } from './stores/viewport'
import { useMobileStore } from './stores/mobile'
import { useViewSettingsStore } from './stores/viewSettings'
import { useNotesStore } from './stores/notes'
import { useHistoryStore } from './stores/history'
import { useUserStore } from './stores/user'
import { useSubscriptionStore } from './stores/subscription'
import { useImagesStore } from './stores/images'
import { useMobileUIScaleGesture } from './composables/useMobileUIScaleGesture'
import { usePerformanceModeStore } from './stores/performanceMode'
import { useDesignModeStore } from './stores/designMode'
import { storeToRefs } from 'pinia'
import { makeBoardThumbnail } from './utils/boardThumbnail'
import { checkAndAlertCardLimit } from './utils/limitsCheck'
import { calculateAutoLayout, findRootAmongSelected } from './utils/autoLayout'
import NotesSidePanel from './components/Panels/NotesSidePanel.vue'
import CommentsSidePanel from './components/Panels/CommentsSidePanel.vue'
import StickerMessagesPanel from './components/Panels/StickerMessagesPanel.vue'
import ImagesPanel from './components/Panels/ImagesPanel.vue'
import BoardAnchorsPanel from './components/Panels/BoardAnchorsPanel.vue'
import PartnersPanel from './components/Panels/PartnersPanel.vue'  
import TheNotifications from './components/TheNotifications.vue'
import SessionExpiredModal from './components/Common/SessionExpiredModal.vue'
import { useSidePanelsStore } from './stores/sidePanels'
import { useNotificationsStore } from './stores/notifications'

// Флаг, который защищает от рендеринга до готовности
const isAppInitialized = ref(false)

// Определяем layout для текущего маршрута
const route = useRoute()
const router = useRouter()
const layout = computed(() => route.meta.layout)
const isSimpleLayout = computed(() => layout.value === 'public' || layout.value === 'admin')
const isBoardsPage = computed(() => route.name === 'boards')
const routeBoardId = computed(() => (route.name === 'board' ? route.params.id : null))
  
// Подключаем i18n для мультиязычности
const { t } = useI18n()

const authStore = useAuthStore()
const canvasStore = useCanvasStore()
const boardStore = useBoardStore()
const cardsStore = useCardsStore()
const connectionsStore = useConnectionsStore()
const stickersStore = useStickersStore()
const viewportStore = useViewportStore()
const mobileStore = useMobileStore()
const viewSettingsStore = useViewSettingsStore()
const notesStore = useNotesStore()
const historyStore = useHistoryStore()
const sidePanelsStore = useSidePanelsStore()
const notificationsStore = useNotificationsStore()
const userStore = useUserStore()
const subscriptionStore = useSubscriptionStore()
const imagesStore = useImagesStore()
const { isAuthenticated } = storeToRefs(authStore)
const { isSaving, currentBoardId, currentBoardName } = storeToRefs(boardStore)
const { isMobileMode } = storeToRefs(mobileStore)
const { headerColor, headerColorIndex } = storeToRefs(viewSettingsStore)
const { isNotesOpen, isCommentsOpen, isStickerMessagesOpen, isImagesOpen, isAnchorsOpen, isPartnersOpen } = storeToRefs(sidePanelsStore)

const { zoomPercentage } = storeToRefs(viewportStore)
const zoomDisplay = computed(() => `${zoomPercentage.value}%`)

const performanceModeStore = usePerformanceModeStore()
const designModeStore = useDesignModeStore()
const { mode: performanceMode, isFull: isFullMode, isView: isViewMode } = storeToRefs(performanceModeStore)
const { isAuroraDesign } = storeToRefs(designModeStore)
const showMobileFullMenu = ref(false)
const performanceModeLabel = computed(() => {
  const labels = { full: 'Полный', light: 'Лёгкий', view: 'Просмотр' }
  return labels[performanceMode.value] || 'Полный'
})
const performanceModeIcon = computed(() => {
  const icons = { full: '\uD83D\uDD34', light: '\uD83D\uDFE1', view: '\uD83D\uDFE2' }
  return icons[performanceMode.value] || '\uD83D\uDD34'
})
const isSaveAvailable = computed(() => {
  const boardName = (currentBoardName.value ?? '').trim()
  return boardName.length > 0
})

const saveTooltip = computed(() =>
  isSaveAvailable.value
    ? t('board.saveStructure')
    : t('board.savePrompt')
)

const isModernTheme = ref(false)
const isPencilMode = ref(false)
// Делаем isPencilMode доступным для дочерних компонентов
provide('isPencilMode', isPencilMode)
const pencilSnapshot = ref(null)
const pencilBounds = ref(null)
const canvasRef = ref(null)
const showProfile = ref(false)
const showMobileAuthPrompt = ref(false)
const mobileAuthModalView = ref('login')
const isMobileAuthModalOpen = ref(false)
const isBoardsModalOpen = ref(false)
const isStructureNameModalOpen = ref(false)
const isCreatingNewStructure = ref(false)  
const pendingAction = ref(null)

const showResetPassword = ref(false)
const resetToken = ref('')
const graceNotificationShown = ref(false) // Флаг показа уведомления о grace-периоде

// Состояние для модала завершения сессии
const isSessionExpiredModalOpen = ref(false)
const sessionExpiredReason = ref('forced_logout') // 'forced_logout' | 'session_expired'

let autoSaveInterval = null
const API_URL = import.meta.env.VITE_API_URL || '/api' // Используем относительный путь для прокси

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
      const dd = String(now.getDate()).padStart(2, '0')
      const mm = String(now.getMonth() + 1).padStart(2, '0')
      const hh = String(now.getHours()).padStart(2, '0')
      const min = String(now.getMinutes()).padStart(2, '0')
      const filename = `${dd}.${mm}_${hh}.${min}.png`

      downloadPencilImage(payload.image, filename)
    }
  }

  resetPencilState()
}

function handleClearCanvas() {
  // Очищаем все карточки
  cardsStore.cards = []

  // Очищаем все соединения
  connectionsStore.connections = []

  // Очищаем все стикеры
  stickersStore.clearStickers()

  // Очищаем все заметки
  notesStore.notes = []

  // Очищаем все изображения
  imagesStore.clearImages()

  console.log('🧹 Холст очищен')
}

/**
 * Вычислить центр видимой области viewport с учетом zoom и pan
 * @returns {Object} - объект с координатами { x, y }
 */
function getViewportCenter() {
  if (!canvasRef.value) {
    return { x: 400, y: 300 } // Значения по умолчанию
  }

  // Получаем контейнер canvas
  const container = document.querySelector('.canvas-container')
  const content = container?.querySelector('.canvas-content')

  if (!container || !content) {
    return { x: 400, y: 300 }
  }

  // Получаем размеры видимой области
  const containerRect = container.getBoundingClientRect()
  const viewportWidth = containerRect.width
  const viewportHeight = containerRect.height

  // Получаем текущие значения zoom и pan из viewport store
  const zoom = viewportStore.zoomScale || 1
  const translateX = viewportStore.translateX || 0
  const translateY = viewportStore.translateY || 0

  // Вычисляем центр viewport в координатах canvas
  const viewportCenterX = viewportWidth / 2
  const viewportCenterY = viewportHeight / 2

  // Преобразуем координаты с учетом zoom и pan
  const canvasCenterX = (viewportCenterX - translateX) / zoom
  const canvasCenterY = (viewportCenterY - translateY) / zoom

  return {
    x: Math.max(0, Math.round(canvasCenterX)),
    y: Math.max(0, Math.round(canvasCenterY))
  }
}

async function handleNewStructure(shouldSave) {
  // Если нужно сохранить текущую структуру перед созданием новой
  if (shouldSave && currentBoardId.value && authStore.isAuthenticated) {
    await saveCurrentBoard()
  }

  // Запрашиваем имя для новой структуры
  // Очистка холста и сброс доски произойдут только после подтверждения названия
  isCreatingNewStructure.value = true
  isStructureNameModalOpen.value = true

  console.log('📄 Создается новая структура: запрос имени')
}

function handleGlobalKeydown(event) {
  // Обработка Esc
  if (event.key === 'Escape') {
    // Деактивация режима иерархии
    if (canvasStore.isHierarchicalDragMode) {
      canvasStore.toggleHierarchicalDragMode()
      event.preventDefault()
      return
    }

    // Снятие выделения со всех объектов
    const hasSelectedCards = cardsStore.selectedCardIds && cardsStore.selectedCardIds.length > 0
    const hasSelectedStickers = stickersStore.selectedStickerIds && stickersStore.selectedStickerIds.length > 0
    const hasSelectedImages = imagesStore.selectedImageIds && imagesStore.selectedImageIds.length > 0

    if (hasSelectedCards || hasSelectedStickers || hasSelectedImages) {
      cardsStore.deselectAllCards()
      stickersStore.deselectAllStickers()
      imagesStore.deselectAllImages()
      event.preventDefault()
      return
    }
  }

  // Переключение режима по клавише M
  if (!event.ctrlKey && !event.shiftKey && !event.altKey && event.code === 'KeyM') {
    const activeTag = document.activeElement?.tagName?.toLowerCase()
    const isInput = activeTag === 'input' || activeTag === 'textarea' ||
                     document.activeElement?.contentEditable === 'true'
    if (!isInput) {
      event.preventDefault()
      performanceModeStore.cycleMode()
      return
    }
  }

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
  resetToken.value = ''

  router.replace({ name: 'home' }).catch(() => {
    router.replace('/').catch(() => {})
  })
}

async function ensureStructureExists(action) {
  if (!authStore.isAuthenticated) {
    return false
  }

  if (currentBoardId.value !== null) {
    return true
  }

  // В мобильном режиме создаем структуру автоматически с именем по умолчанию
  if (isMobileMode.value) {
    const defaultName = `Структура ${new Date().toLocaleDateString('ru-RU')}`
    return await createStructureWithName(defaultName, action)
  }

  // В десктопном режиме показываем модальное окно
  return new Promise((resolve) => {
    pendingAction.value = { action, resolve }
    isStructureNameModalOpen.value = true
  })
}

async function createStructureWithName(name, action = null, initialState = null) {
  try {
    boardStore.isSaving = true

    // Если передано начальное состояние, используем его, иначе берём текущее
    const canvasState = initialState !== null ? initialState : getCanvasState()

    const createResponse = await fetch(`${API_URL}/boards`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: name,
        content: canvasState
      })
    })

    if (!createResponse.ok) {
      // Проверяем, не превышен ли лимит
      if (createResponse.status === 403) {
        try {
          const errorData = await createResponse.json()
          if (errorData.code === 'USAGE_LIMIT_REACHED') {
            // Показываем специфичное сообщение о превышении лимита
            alert(errorData.error || t('board.createError'))
            boardStore.isSaving = false
            return false
          }
        } catch (parseError) {
          // Если не удалось распарсить JSON, показываем общую ошибку
        }
      }

      throw new Error('Ошибка создания структуры')
    }

    const createData = await createResponse.json()
    const createdBoard = createData?.board ?? createData

    if (!createdBoard?.id) {
      throw new Error('Сервер не вернул идентификатор новой структуры')
    }

    boardStore.setCurrentBoard(createdBoard.id, createdBoard.name ?? name)
    window.dispatchEvent(new CustomEvent('boards:refresh'))

    if (action) {
      action()
    }

    boardStore.isSaving = false
    return true
  } catch (err) {
    console.error('❌ Ошибка создания структуры:', err)
    alert(t('board.createFailed'))
    boardStore.isSaving = false
    return false
  }
}

async function handleStructureNameConfirm(name) {
  isStructureNameModalOpen.value = false
  if (isCreatingNewStructure.value) {
    isCreatingNewStructure.value = false
    pendingAction.value = null

    // Создаём пустое начальное состояние для новой структуры
    const emptyState = {
      objects: [],
      connections: [],
      stickers: [],
      images: [],
      notes: [],
      background: canvasStore.background || '#ffffff',
      zoom: 1
    }

    // Сначала очищаем холст локально
    handleClearCanvas()

    // Сбрасываем историю
    const historyStore = useHistoryStore()
    historyStore.clearHistory()

    // Создаём структуру на сервере с пустым состоянием
    // Функция createStructureWithName сама установит новую доску через boardStore.setCurrentBoard
    await createStructureWithName(name, null, emptyState)

    return
  }

  if (!pendingAction.value) {
    return
  }

  const { action, resolve } = pendingAction.value
  pendingAction.value = null

  const success = await createStructureWithName(name, action)

  if (resolve) {
    resolve(success)
  }
}

function handleStructureNameCancel() {
  isStructureNameModalOpen.value = false
  if (isCreatingNewStructure.value) {
    isCreatingNewStructure.value = false
    pendingAction.value = null
    return
  }

  if (pendingAction.value?.resolve) {
    pendingAction.value.resolve(false)
  }
  pendingAction.value = null
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
      // Обработка блокировки доски (hard_lock)
      if (response.status === 403) {
        try {
          const errorData = await response.json()
          if (errorData.lockStatus === 'hard_lock' || errorData.locked) {
            alert(errorData.message || 'Эта доска заблокирована.')
            boardStore.isSaving = false
            return
          }
        } catch (parseError) {
          // Если не удалось распарсить JSON, показываем общую ошибку
        }
      }
      throw new Error('Ошибка загрузки структуры')
    }

    const data = await response.json()

    // Устанавливаем текущую доску с информацией о блокировке
    boardStore.setCurrentBoard(data.board.id, data.board.name, {
      readOnly: data.board.readOnly || false,
      lockStatus: data.board.lock_status || 'active',
      daysUntilBlock: data.board.daysUntilBlock
    })

    // Сбрасываем историю действий — у каждой доски чистая история
    const historyStore = useHistoryStore()
    historyStore.clearHistory()

    // Показываем предупреждение для soft_lock досок
    if (data.board.lock_status === 'soft_lock') {
      notificationsStore.addNotification({
        type: 'warning',
        message: `⏱️ Режим только для чтения. Доска будет заблокирована через ${data.board.daysUntilBlock || 0} дней.`,
        duration: 6000
      })
    }

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
    const userCardConnectionsData = Array.isArray(content.userCardConnections)
      ? content.userCardConnections
      : []
    connectionsStore.loadUserCardConnections(userCardConnectionsData)
    // Восстанавливаем стикеры из сохраненных данных
    const stickersData = Array.isArray(content.stickers)
      ? content.stickers
      : []
    stickersStore.loadStickers(stickersData)

    // Восстанавливаем изображения из сохраненных данных
    const imagesData = Array.isArray(content.images)
      ? content.images
      : []
    await imagesStore.loadImages(imagesData)

    console.log('✅ Загружена структура:', data.board.name)
    console.log('  Карточек:', cardsData.length)
    console.log('  Соединений:', connectionsData.length)
    console.log('  Стикеров:', stickersData.length)
    console.log('  Изображений:', imagesData.length)

    // Загружаем заметки для структуры
    try {
      await notesStore.fetchNotesForBoard(boardId);
      console.log('✅ Загружены заметки для структуры');

      // Создаем НОВЫЙ массив карточек, чтобы "разбудить" реактивность Vue
      const cleanedCards = cardsStore.cards.map(card => {
        // Создаем копию карточки, чтобы не мутировать оригинал напрямую
        const newCard = { ...card };
        if (newCard.note && (newCard.note.entries || newCard.note.colors)) {
          // Создаем и копию объекта note, удаляя старые поля
          const { entries, colors, ...restOfNote } = newCard.note;
          newCard.note = restOfNote;
        }
        return newCard;
      });

      // Заменяем старый массив карточек на новый.
      // Это "сильное" изменение, которое Vue точно заметит.
      cardsStore.cards = cleanedCards;

      console.log('✅ Очищены старые заметки и принудительно обновлен cardsStore');

    } catch (error) {
      console.error('⚠️ Ошибка загрузки заметок:', error);
      // Продолжаем работу, даже если заметки не загрузились
    }

    boardStore.isSaving = false
    
    // Запускаем автосохранение происходит через наблюдатель isSaveAvailable

  } catch (err) {
    console.error('❌ Ошибка загрузки структуры:', err)
    alert(t('board.loadError'))
    boardStore.isSaving = false
  }
}

async function saveCurrentBoard() {
  if (!isSaveAvailable.value || !authStore.isAuthenticated) {
    return
  }

  const boardId = currentBoardId.value

  if (!boardId) {
    const canProceed = await ensureStructureExists(() => {
      saveCurrentBoard()
    })
    return
  }

  try {
    boardStore.isSaving = true

    // Получаем состояние canvas
    const canvasState = getCanvasState()

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
      // Проверяем, не превышен ли лимит
      if (response.status === 403) {
        try {
          const errorData = await response.json()
          if (errorData.code === 'USAGE_LIMIT_REACHED') {
            // Показываем специфичное сообщение о превышении лимита
            alert(errorData.error || t('board.limitReached'))
            boardStore.isSaving = false
            return
          }
        } catch (parseError) {
          // Если не удалось распарсить JSON, продолжаем с общей ошибкой
        }
      }
      throw new Error('Ошибка сохранения')
    }

    boardStore.markAsSaved()
    await uploadBoardThumbnail(boardId)

    console.log('💾 Структура автоматически сохранена:', new Date().toLocaleTimeString())
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
      // Проверяем, не превышен ли лимит
      if (response.status === 403) {
        try {
          const errorData = await response.json()
          if (errorData.code === 'USAGE_LIMIT_REACHED') {
            // Для миниатюры просто логируем, не показываем alert
            console.warn('Достигнут лимит:', errorData.error)
            return
          }
        } catch (parseError) {
          // Если не удалось распарсить JSON, продолжаем с общей ошибкой
        }
      }
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
    console.error('❌ Не удалось обновить миниатюру структуры:', error)
  }
}

function getCanvasState() {
  // Получаем все карточки и соединения из stores
  const cardsData = cardsStore.cards.map(card => {
    if (card.type === 'user_card') {
      return {
        id: card.id,
        type: card.type,
        x: card.x,
        y: card.y,
        size: card.size,
        diameter: card.diameter,
        personalId: card.personalId,
        userId: card.userId,
        avatarUrl: card.avatarUrl,
        username: card.username,
        stroke: card.stroke,
        strokeWidth: card.strokeWidth,
        created_at: card.created_at
      }
    }

    return {
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

      // Строковые значения карточки
      balance: card.balance,
      activePv: card.activePv,
      cycle: card.cycle,
      coinFill: card.coinFill,
      previousPvLeft: card.previousPvLeft,

      // Бейджи
      showSlfBadge: card.showSlfBadge,
      showFendouBadge: card.showFendouBadge,
      rankBadge: card.rankBadge,

      // Расчёты структуры
      calculated: card.calculated,
      calculatedIsFull: card.calculatedIsFull,
      total: card.total,
      stage: card.stage,
      toNext: card.toNext,

      // Active-PV состояние (основное поле, из которого восстанавливаются все производные)
      activePvState: card.activePvState,

      // Active-PV производные поля
      activePvManual: card.activePvManual,
      activePvLocal: card.activePvLocal,
      activePvAggregated: card.activePvAggregated,
      activePvLocalBalance: card.activePvLocalBalance,
      activePvBalance: card.activePvBalance,
      activePvPacks: card.activePvPacks,
      activePvCycles: card.activePvCycles,

      // Ручное переопределение баланса
      balanceManualOverride: card.balanceManualOverride || null,
      manualAdjustments: card.manualAdjustments || null,
      cyclesManualOverride: card.cyclesManualOverride || null
      // Заметки больше не сохраняются в составе карточки, они хранятся отдельно в таблице notes
    }
  })

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
  const userCardConnectionsData = connectionsStore.userCardConnections.map(conn => ({
    id: conn.id,
    type: conn.type,
    from: conn.from,
    to: conn.to,
    fromPointIndex: conn.fromPointIndex,
    toPointIndex: conn.toPointIndex,
    controlPoints: conn.controlPoints,
    color: conn.color,
    thickness: conn.thickness,
    highlightType: conn.highlightType,
    animationDuration: conn.animationDuration
  }))
  // Сохраняем стикеры
  const stickersData = stickersStore.stickers.map(sticker => ({
    id: sticker.id,
    pos_x: sticker.pos_x,
    pos_y: sticker.pos_y,
    color: sticker.color,
    content: sticker.content
  }))

  // Сохраняем изображения
  const imagesData = imagesStore.getImagesForExport()

  console.log('📤 Сохраняем состояние:', {
    cardsCount: cardsData.length,
    connectionsCount: connectionsData.length,
    stickersCount: stickersData.length,
    imagesCount: imagesData.length
  })

  return {
    version: 1,
    background: canvasStore.backgroundColor,
    zoom: 1, // пока фиксированное значение
    objects: cardsData,
    connections: connectionsData,
    userCardConnections: userCardConnectionsData,    
    stickers: stickersData,
    images: imagesData
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

/**
 * Полностью очищает все данные холста (карточки, соединения, стикеры, изображения, заметки)
 * Вызывается при logout для обеспечения чистого состояния UI
 */
function clearAllCanvasData() {
  console.log('🧹 Очистка всех данных холста')

  // Очищаем карточки
  cardsStore.cards = []
  cardsStore.selectedCardIds = []

  // Очищаем соединения
  connectionsStore.connections = []
  connectionsStore.userCardConnections = []

  // Очищаем стикеры
  stickersStore.clearStickers()

  // Очищаем изображения
  imagesStore.clearImages()

  // Очищаем заметки
  notesStore.notes = []

  // Сбрасываем историю
  const historyStore = useHistoryStore()
  historyStore.clearHistory()

  console.log('✅ Все данные холста очищены')
}

/**
 * Обработчик принудительного выхода (forced logout)
 * Выполняет автосохранение с таймаутом и затем logout
 *
 * Используется при получении события session_forced_logout
 * @param {CustomEvent} event - событие с detail.reason: 'forced_logout' | 'session_expired'
 */
async function handleForcedLogout(event) {
  // Извлекаем причину из события (по умолчанию forced_logout)
  const reason = event?.detail?.reason || 'forced_logout'
  sessionExpiredReason.value = reason

  console.log(`🔒 Forced logout (${reason}): начинаем graceful завершение сессии`)

  // Если пользователь не авторизован — просто очищаем состояние
  if (!authStore.isAuthenticated) {
    console.log('🔒 Forced logout: пользователь не авторизован, пропускаем')
    return
  }

  const SAVE_TIMEOUT_MS = 5000 // 5 секунд таймаут на сохранение

  // Проверяем есть ли активная доска и несохраненные изменения
  const shouldSave = currentBoardId.value && boardStore.hasUnsavedChanges

  if (shouldSave) {
    console.log('🔒 Forced logout: есть несохраненные изменения, выполняем автосохранение')

    try {
      // Создаем Promise для сохранения с таймаутом
      const savePromise = (async () => {
        const boardId = currentBoardId.value
        if (!boardId) return false

        const canvasState = getCanvasState()

        const response = await fetch(`${API_URL}/boards/${boardId}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${authStore.token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ content: canvasState })
        })

        if (response.ok) {
          boardStore.markAsSaved()
          console.log('💾 Forced logout: структура сохранена перед выходом')
          return true
        }

        console.warn('⚠️ Forced logout: ошибка сохранения, код:', response.status)
        return false
      })()

      // Таймаут Promise
      const timeoutPromise = new Promise((resolve) => {
        setTimeout(() => {
          console.warn('⏱️ Forced logout: таймаут сохранения (5 сек)')
          resolve(false)
        }, SAVE_TIMEOUT_MS)
      })

      // Ждем первый завершившийся промис
      await Promise.race([savePromise, timeoutPromise])

    } catch (error) {
      console.error('❌ Forced logout: ошибка при сохранении:', error)
      // Продолжаем с logout независимо от ошибки
    }
  } else {
    console.log('🔒 Forced logout: нет несохраненных изменений, пропускаем сохранение')
  }

  // ВАЖНО: Сначала очищаем ВСЕ данные холста (до logout)
  clearAllCanvasData()

  // Очищаем состояние доски
  boardStore.clearCurrentBoard()

  // Выполняем logout (очищает сторы и localStorage)
  console.log('🔒 Forced logout: выполняем authStore.logout()')
  await authStore.logout()

  // Останавливаем автосохранение
  stopAutoSave()

  // Показываем модальное окно с уведомлением
  isSessionExpiredModalOpen.value = true

  console.log('✅ Forced logout: завершено, UI в публичном состоянии')
}

/**
 * Обработчик закрытия модала сессии
 */
function handleSessionModalClose() {
  isSessionExpiredModalOpen.value = false
}

/**
 * Обработчик кнопки "Войти" в модале сессии (для session_expired)
 */
function handleSessionModalLogin() {
  isSessionExpiredModalOpen.value = false
  // Открываем модал авторизации
  if (isMobileMode.value) {
    mobileAuthModalView.value = 'login'
    isMobileAuthModalOpen.value = true
  }
  // Для десктопа пользователь может использовать кнопки в хедере
}

// Mobile-specific functions
async function handleAddLicense() {
  // Проверяем лимит перед добавлением карточки
  if (!checkAndAlertCardLimit(1)) {
    return
  }

  const canProceed = await ensureStructureExists()

  if (canProceed && currentBoardId.value !== null) {
    cardsStore.addCard({
      type: 'small',
      headerBg: headerColor.value,
      colorIndex: headerColorIndex.value
    })
  }
}

async function handleAddLower() {
  // Проверяем лимит перед добавлением карточки
  if (!checkAndAlertCardLimit(1)) {
    return
  }

  const canProceed = await ensureStructureExists()

  if (canProceed && currentBoardId.value !== null) {
    cardsStore.addCard({
      type: 'large',
      headerBg: headerColor.value,
      colorIndex: headerColorIndex.value
    })
  }
}

async function handleAddGold() {
  // Проверяем лимит перед добавлением карточки
  if (!checkAndAlertCardLimit(1)) {
    return
  }

  const canProceed = await ensureStructureExists()

  if (canProceed && currentBoardId.value !== null) {
    cardsStore.addCard({
      type: 'gold'
    })
  }
}

async function handleAddTemplate(templateId) {
  const canProceed = await ensureStructureExists()

  if (canProceed && currentBoardId.value !== null) {
    if (!templateId) {
      cardsStore.addCard({
        type: 'large',
        headerBg: headerColor.value,
        colorIndex: headerColorIndex.value
      })
    } else {
      console.log('Template selected:', templateId)
    }
  }
}

function handleAutoLayout() {
  if (boardStore.isReadOnly) return

  const selectedCards = cardsStore.selectedCards
  if (selectedCards.length === 0) return

  let rootId, targetCards, targetConnections

  if (selectedCards.length === 1) {
    rootId = selectedCards[0].id
    targetCards = cardsStore.cards
    targetConnections = connectionsStore.connections
  } else {
    const selectedIds = new Set(selectedCards.map(c => c.id))
    targetCards = selectedCards
    targetConnections = connectionsStore.connections.filter(
      conn => selectedIds.has(conn.from) && selectedIds.has(conn.to)
    )
    rootId = findRootAmongSelected(selectedCards, targetConnections)
  }

  if (!rootId) return

  const result = calculateAutoLayout({
    rootId,
    cards: targetCards,
    connections: targetConnections
  })

  if (result.affectedCardIds.length === 0) return

  historyStore.setActionMetadata('update', `Авто-раскладка (${result.affectedCardIds.length} карточек)`)

  for (const [cardId, pos] of result.positions) {
    cardsStore.updateCardPosition(cardId, pos.x, pos.y, { saveToHistory: false })
  }

  historyStore.saveState()
  boardStore.markAsChanged()
}

function handleMobileExportHTML() {
  handleExportHTML()
}

async function handleMobileLoadJSON() {
  const canProceed = await ensureStructureExists()

  if (canProceed) {
    handleLoadProject()
  }
}
function handleOpenFullMenu() {
  showMobileFullMenu.value = true
}

function handleCloseFullMenu() {
  showMobileFullMenu.value = false
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

/**
 * Проверяет, находится ли пользователь в grace-периоде и показывает уведомление
 */
function checkAndNotifyGracePeriod() {
  // Если уже показали уведомление в этой сессии, не показываем повторно
  if (graceNotificationShown.value) {
    return
  }

  // Проверяем наличие необходимых данных
  const user = userStore.user
  if (!user) {
    return
  }

  const expiresAt = user.subscriptionExpiresAt
  const gracePeriodUntil = user.gracePeriodUntil

  if (!expiresAt || !gracePeriodUntil) {
    return
  }

  const now = new Date()
  const expireDate = new Date(expiresAt)
  const graceDate = new Date(gracePeriodUntil)

  // Проверяем: подписка истекла, но grace-период еще активен
  const isExpired = now > expireDate
  const isGraceActive = now <= graceDate

  if (isExpired && isGraceActive) {
    // Форматируем дату окончания grace-периода
    const formattedDate = graceDate.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })

    // Показываем toast-уведомление
    notificationsStore.addNotification({
      type: 'warning',
      message: `⚠️ Ваша подписка истекла. Доступ сохранен до ${formattedDate}. Продлите подписку.`,
      duration: 8000 // 8 секунд
    })

    // Отмечаем, что уведомление показано
    graceNotificationShown.value = true
  }
}

watch(isAuthenticated, (value) => {
  if (value) {
    showMobileAuthPrompt.value = false
    isMobileAuthModalOpen.value = false
  }
})

// Закрываем боковые панели при входе в режим просмотра
watch(isViewMode, (viewing) => {
  if (viewing) {
    sidePanelsStore.closePanel()
  }
})
watch(isSaveAvailable, (canSave) => {
  if (canSave) {
    startAutoSave()
  } else {
    stopAutoSave()
  }
})
watch(routeBoardId, async (boardId) => {
  if (!boardId) {
    return
  }

  await loadBoard(boardId)
}, { immediate: true })

// Авто-скрытие боковой панели при активации placement mode на мобильном
watch(
  () => [boardStore.placementMode, stickersStore.isPlacementMode],
  ([placementMode, stickerPlacement]) => {
    if (isMobileMode.value && (placementMode || stickerPlacement)) {
      sidePanelsStore.closePanel()
    }
  }
)

onMounted(async () => {
  // Вся асинхронная инициализация (authStore.init) УЖЕ ЗАВЕРШИЛАСЬ в main.js
  // до того, как этот компонент был смонтирован.
  // Теперь мы просто выполняем логику, которая нужна самому компоненту App.vue.

  // Определяем тип устройства
  mobileStore.detectDevice()

  // Инициализация жеста масштабирования UI для мобильной версии
  if (mobileStore.isMobileMode) {
    console.log('🎯 Инициализация жеста масштабирования UI для мобильной версии')
    useMobileUIScaleGesture({
      edgeZonePercent: 15,
      minScale: 1,
      sensitivity: 0.002,
      safetyMargin: 8
    })
  }

  // Проверяем URL на токен сброса пароля
  const urlParams = new URLSearchParams(window.location.search)
  const token = urlParams.get('token')
  if (token) {
    resetToken.value = token
    showResetPassword.value = true
    window.history.replaceState({}, document.title, window.location.pathname)
  }

  // Загружаем данные о подписке пользователя, если авторизован
  if (localStorage.getItem('token')) {
    try {
      await userStore.fetchUserPlan()
      // Загружаем план подписки через subscription store
      await subscriptionStore.loadPlan()

      // Проверяем и показываем уведомление о grace-периоде
      checkAndNotifyGracePeriod()
    } catch (error) {
      console.error('⚠️ Ошибка загрузки данных о подписке:', error)
    }
  }

  window.addEventListener('keydown', handleGlobalKeydown)

  // Слушатель события принудительного выхода (forced logout)
  // Событие может быть вызвано при: истечении сессии, завершении сессии с другого устройства и т.д.
  window.addEventListener('session_forced_logout', handleForcedLogout)

  // В самом конце мы безопасно говорим, что приложение готово к отображению.
  isAppInitialized.value = true
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
  window.removeEventListener('session_forced_logout', handleForcedLogout)
  stopAutoSave()
})
</script>

<template>
  <!-- Показываем основной интерфейс только ПОСЛЕ полной инициализации -->
  <div
    v-if="isAppInitialized"
    id="app"
    :class="{
      'app--mobile': isMobileMode,
      'app--admin': layout === 'admin',
      'm3-dark': isModernTheme,
      'app--aurora': isAuroraDesign
    }"
  >
    <!-- Для публичных страниц показываем только компонент маршрута -->
    <template v-if="isSimpleLayout || isBoardsPage">
      <router-view v-slot="{ Component }">
        <transition name="page" mode="out-in">
          <component :is="Component" :key="$route.fullPath" />
        </transition>
      </router-view>
    </template>

    <!-- Для основного приложения показываем полный интерфейс -->
    <template v-else>
    <!-- Desktop UI -->
    <template v-if="!isMobileMode">
      <TopMenuButtons
        v-if="isAuthenticated"
        v-show="!isPencilMode && !showResetPassword && !isViewMode"
        class="no-print"
        :is-modern-theme="isModernTheme"
        @toggle-theme="toggleTheme"
        @activate-pencil="handleActivatePencil"
        @clear-canvas="handleClearCanvas"
        @new-structure="handleNewStructure"
      />
      <AppHeader
        v-show="!isPencilMode && !showResetPassword && !isViewMode"
        class="no-print"
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
        class="zoom-floating-button no-print"
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
        class="mode-floating-button no-print"
        :class="{ 'mode-floating-button--modern': isModernTheme }"
        type="button"
        :title="`${performanceModeLabel} (M)`"
        @click="performanceModeStore.cycleMode()"
      >
        {{ performanceModeIcon }} {{ performanceModeLabel }}
      </button>
      <button
        v-if="isAuthenticated"
        v-show="!isPencilMode && !showResetPassword && !isViewMode"
        class="save-floating-button no-print"
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
        class="no-print"
        :is-modern-theme="isModernTheme"
        @toggle-theme="toggleTheme"
        @open-profile="handleOpenProfile"
        @open-boards="handleOpenMobileBoards"
        @request-auth="openMobileAuthPrompt"
        @export-html="handleMobileExportHTML"
        @activate-pencil="handleActivatePencil"
        @open-full-menu="handleOpenFullMenu"
      />
      <MobileToolbar
        v-show="!isPencilMode && !showResetPassword"
        class="no-print"
        :is-modern-theme="isModernTheme"
        @save="saveCurrentBoard"
        @fit-to-content="handleFitToContent"
        @open-profile="handleOpenProfile"
        @request-auth="openMobileAuthPrompt"
      />
      <MobileSidebar
        v-if="isAuthenticated"
        v-show="!isPencilMode && !showResetPassword"
        class="no-print"
        :is-modern-theme="isModernTheme"
        @add-license="handleAddLicense"
        @add-lower="handleAddLower"
        @add-gold="handleAddGold"
        @add-template="handleAddTemplate"
        @auto-layout="handleAutoLayout"
      />
      <MobileVersionDialog class="no-print" />
      <MobileFullMenu
        :visible="showMobileFullMenu"
        :is-dark="isModernTheme"
        @close="handleCloseFullMenu"
        @activate-pencil="handleActivatePencil"
        @toggle-theme="toggleTheme"
        @clear-canvas="handleClearCanvas"
        @new-structure="handleNewStructure"
      />
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

    <!-- Canvas (shared between mobile and desktop) - НЕ показываем на странице boards -->
    <div
      v-if="!isBoardsPage"
      id="canvas"
      :class="{
        'canvas--inactive': isPencilMode || showResetPassword,
        'canvas--mobile': isMobileMode
      }"
    >
      <!-- Показываем canvas только для домашнего экрана и конкретной доски -->
      <CanvasBoard
        v-if="$route.name === 'home' || $route.name === 'board'"
        ref="canvasRef"
        :is-modern-theme="isModernTheme"
      />

      <!-- Для остальных роутов отображаем содержимое через router-view -->
      <router-view v-else />
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
      class="no-print"
      :is-modern-theme="isModernTheme"
    />

    <AuthModal
      v-if="isMobileAuthModalOpen"
      class="no-print"
      :is-open="isMobileAuthModalOpen"
      :initial-view="mobileAuthModalView"
      :is-modern-theme="isModernTheme"
      @close="handleMobileAuthClose"
      @success="handleMobileAuthSuccess"
    />
    <BoardsModal
      class="no-print"
      :is-open="isBoardsModalOpen"
      @close="handleMobileBoardsClose"
      @open-board="handleMobileBoardSelect"
    />

    <StructureNameModal
      class="no-print"
      :is-open="isStructureNameModalOpen"
      @close="handleStructureNameCancel"
      @confirm="handleStructureNameConfirm"
    />
    <Teleport to="body">
      <div
        v-if="showProfile"
        :class="['profile-modal-overlay no-print', { 'profile-modal-overlay--modern': isModernTheme }]"
        @click.self="showProfile = false"
      >
        <UserProfile
          :is-modern-theme="isModernTheme"
          @close="showProfile = false"
        />
      </div>
    </Teleport>

    <!-- Side Panels (desktop always, mobile only in Full mode, hidden in view mode) -->
    <transition name="side-panel-slide">
      <PartnersPanel
        v-if="isPartnersOpen && (!isMobileMode || isFullMode) && !isViewMode"
        class="no-print"
        :is-modern-theme="isModernTheme"
      />
    </transition>

    <transition name="side-panel-slide">
      <NotesSidePanel
        v-if="isNotesOpen && (!isMobileMode || isFullMode) && !isViewMode"
        class="no-print"
        :is-modern-theme="isModernTheme"
      />
    </transition>

    <transition name="side-panel-slide">
      <CommentsSidePanel
        v-if="isCommentsOpen && (!isMobileMode || isFullMode) && !isViewMode"
        class="no-print"
        :is-modern-theme="isModernTheme"
      />
    </transition>

    <transition name="side-panel-slide">
      <StickerMessagesPanel
        v-if="isStickerMessagesOpen && (!isMobileMode || isFullMode) && !isViewMode"
        class="no-print"
        :is-modern-theme="isModernTheme"
      />
    </transition>

    <transition name="side-panel-slide">
      <ImagesPanel
        v-if="isImagesOpen && (!isMobileMode || isFullMode) && !isPencilMode && !isViewMode"
        class="no-print"
        :is-modern-theme="isModernTheme"
      />
    </transition>
    <transition name="side-panel-slide">
      <BoardAnchorsPanel
        v-if="isAnchorsOpen && (!isMobileMode || isFullMode) && !isViewMode"
        class="no-print"
        :is-modern-theme="isModernTheme"
      />
    </transition>

    <!-- Контейнер для тост-уведомлений -->
    <TheNotifications />

    <!-- Модал завершения сессии (forced logout / session expired) -->
    <SessionExpiredModal
      :is-open="isSessionExpiredModalOpen"
      :reason="sessionExpiredReason"
      @close="handleSessionModalClose"
      @login="handleSessionModalLogin"
    />
    </template>
  </div>

  <!-- Пока идет инициализация, показываем заглушку -->
  <div v-else style="padding: 20px; font-family: sans-serif;">
    Загрузка приложения...
  </div>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700;800&display=swap');

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

/* Убираем фон body в мобильной версии */
body:has(.app--mobile) {
  background: transparent;
}

#app {
  position: relative;
  width: 100%;
  min-height: 100vh;
}

/* Убираем фон в мобильной версии, чтобы canvas был виден в safe-area */
.app--mobile {
  background: transparent;
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
  background: color-mix(in srgb, var(--md-sys-color-scrim) 32%, transparent);
  backdrop-filter: blur(4px);
  z-index: 1100;
}

.mobile-auth-dialog {
  width: 100%;
  max-width: 360px;
  background: var(--md-sys-color-surface-container-high);
  border-radius: var(--md-sys-shape-corner-extra-large);
  box-shadow: var(--md-sys-elevation-3);
  padding: 28px 24px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  text-align: center;
  border: none;
}

.mobile-auth-dialog--modern {
  background: var(--md-ref-neutral-17);
  color: var(--md-ref-neutral-90);
  box-shadow: var(--md-sys-elevation-3);
  border: none;
}

.mobile-auth-dialog__title {
  margin: 0;
  font-size: 22px;
  font-weight: 500;
  color: var(--md-sys-color-on-surface);
}

.mobile-auth-dialog--modern .mobile-auth-dialog__title {
  color: var(--md-ref-neutral-90);
}

.mobile-auth-dialog__subtitle {
  margin: 0;
  font-size: 14px;
  color: var(--md-sys-color-on-surface-variant);
}

.mobile-auth-dialog--modern .mobile-auth-dialog__subtitle {
  color: var(--md-ref-neutral-variant-80);
}

.mobile-auth-dialog__actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.mobile-auth-dialog__button {
  width: 100%;
  border: none;
  border-radius: var(--md-sys-shape-corner-full);
  padding: 14px 24px;
  font-size: 15px;
  font-weight: 500;
  letter-spacing: 0.02em;
  cursor: pointer;
  transition: background var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-standard),
    transform var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-standard),
    box-shadow var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-standard);
}

.mobile-auth-dialog__button--primary {
  background: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
  box-shadow: var(--md-sys-elevation-1);
}

.mobile-auth-dialog__button--primary:hover {
  box-shadow: var(--md-sys-elevation-2);
}

.mobile-auth-dialog__button--secondary {
  background: var(--md-sys-color-secondary-container);
  color: var(--md-sys-color-on-secondary-container);
}

.mobile-auth-dialog--modern .mobile-auth-dialog__button--primary {
  background: var(--md-ref-primary-80);
  color: var(--md-ref-primary-20);
}

.mobile-auth-dialog--modern .mobile-auth-dialog__button--secondary {
  background: var(--md-ref-secondary-30);
  color: var(--md-ref-secondary-90);
}

.mobile-auth-dialog__button:active {
  transform: scale(0.98);
}

.mobile-auth-dialog__close {
  border: none;
  background: transparent;
  color: var(--md-sys-color-on-surface-variant);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: color var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-standard);
}

.mobile-auth-dialog__close:hover {
  color: var(--md-sys-color-on-surface);
}

.mobile-auth-dialog--modern .mobile-auth-dialog__close {
  color: var(--md-ref-neutral-variant-70);
}

.mobile-auth-dialog--modern .mobile-auth-dialog__close:hover {
  color: var(--md-ref-neutral-90);
}

@media (max-width: 420px) {
  .mobile-auth-dialog {
    max-width: 320px;
    padding: 24px 20px 20px;
  }

  .mobile-auth-dialog__title {
    font-size: 18px;
  }

  .mobile-auth-dialog__button {
    font-size: 14px;
  }
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

.zoom-floating-button {
  position: fixed;
  left: 50%;
  bottom: 24px;
  transform: translate(-50%, 0);
  z-index: 1800;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  box-sizing: border-box;
  height: 46px;
  min-width: 210px;
  padding: 0 18px;
  border-radius: 18px;
  border: 1px solid rgba(148, 163, 184, 0.45);
  background: rgba(248, 250, 252, 0.92);
  color: #0f172a;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 18px 36px rgba(15, 23, 42, 0.2);
  transition: box-shadow 0.2s ease, background 0.2s ease, color 0.2s ease, border-color 0.2s ease;  backdrop-filter: blur(6px);
}

.zoom-floating-button:hover {
  left: 50% !important;
  transform: translate(-50%, 0) !important;
  box-shadow: 0 24px 42px rgba(255, 193, 7, 0.4);
  background: #ffc107;
  color: #000000;
  border-color: rgba(255, 193, 7, 0.8);
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
  left: 50% !important;
  transform: translate(-50%, 0) !important;
  box-shadow: 0 28px 48px rgba(255, 193, 7, 0.5);
  background: #ffc107;
  color: #000000;
  border-color: rgba(255, 193, 7, 0.85);
}

.mode-floating-button {
  position: fixed;
  left: calc(50% + 115px);
  bottom: 24px;
  z-index: 1800;
  padding: 10px 18px;
  border-radius: 18px;
  border: 1px solid rgba(148, 163, 184, 0.45);
  background: rgba(248, 250, 252, 0.92);
  color: #0f172a;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 18px 36px rgba(15, 23, 42, 0.2);
  transition: box-shadow 0.2s ease, background 0.2s ease, color 0.2s ease, border-color 0.2s ease;
  backdrop-filter: blur(6px);
  user-select: none;
  white-space: nowrap;
}
.mode-floating-button:hover {
  box-shadow: 0 24px 42px rgba(255, 193, 7, 0.4);
  background: #ffc107;
  color: #000000;
  border-color: rgba(255, 193, 7, 0.8);
}
.mode-floating-button--modern {
  border-color: rgba(104, 171, 255, 0.45);
  background: rgba(32, 44, 68, 0.9);
  color: #e5f3ff;
  box-shadow: 0 22px 42px rgba(6, 11, 21, 0.55);
}
.mode-floating-button--modern:hover {
  box-shadow: 0 28px 48px rgba(255, 193, 7, 0.5);
  background: #ffc107;
  color: #000000;
  border-color: rgba(255, 193, 7, 0.85);
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
  box-shadow: 0 24px 42px rgba(255, 193, 7, 0.4);
  background: #ffc107;
  color: #000000;
  border-color: rgba(255, 193, 7, 0.8);
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
  box-shadow: 0 28px 48px rgba(255, 193, 7, 0.5);
  background: #ffc107;
  color: #000000;
  border-color: rgba(255, 193, 7, 0.85);
}

/* Canvas/SVG */
#canvas {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  transform-origin: 0 0;
  pointer-events: auto;
  z-index: 0;  
  cursor: default;
}

/* Mobile adjustments */
.app--mobile #canvas {
  /* Растягиваем холст на весь экран, убирая белые полосы */
  top: 0;
  bottom: 0;
  height: 100vh;

  /* Сохраняем padding для отступов от панелей */
  padding-top: 0;
  padding-bottom: 0;

  box-sizing: border-box;
}

.canvas--mobile {
  overflow: hidden;
}

/* Hide desktop-only elements in mobile mode */
.app--mobile .save-floating-button,
.app--mobile .zoom-floating-button,
.app--mobile .mode-floating-button {
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

/* Media queries для очень маленьких экранов (если потребуется дополнительная настройка) */
@media (max-width: 480px) {
  .app--mobile #canvas {
    /* Настройки наследуются от основного .app--mobile #canvas */
  }
}

@media (max-width: 360px) {
  .app--mobile #canvas {
    /* Настройки наследуются от основного .app--mobile #canvas */
  }
}

/* Side Panel Transitions */
.side-panel-slide-enter-active,
.side-panel-slide-leave-active {
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.side-panel-slide-enter-from {
  transform: translateX(-100%);
  opacity: 0;
}

.side-panel-slide-leave-to {
  transform: translateX(-100%);
  opacity: 0;
}

/* Page Transitions */
.page-enter-active,
.page-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.page-enter-from {
  opacity: 0;
  transform: translateX(20px);
}

.page-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}

/* Print Styles - Печать только холста с карточками */
@media print {
  /* Скрываем все элементы интерфейса с классом no-print */
  .no-print,
  .zoom-floating-button,
  .save-floating-button,
  .mode-floating-button,
  .mobile-auth-overlay,
  .reset-password-overlay,
  .profile-modal-overlay {
    display: none !important;
  }

  /* Настройка страницы для печати - убираем поля и устанавливаем размер A4 альбомная */
  @page {
    margin: 0;
    size: A4 landscape;
  }

  html, body, #app {
    margin: 0 !important;
    padding: 0 !important;
    width: 100% !important;
    height: 100% !important;
    overflow: hidden !important;
    background: #ffffff !important;
  }

  /* Холст занимает ровно одну страницу */
  #canvas {
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    padding: 0 !important;
    margin: 0 !important;
    overflow: hidden !important;
    transform: none !important;
    page-break-after: avoid !important;
    page-break-inside: avoid !important;
  }
}

/* Mobile: адаптация ширины боковых панелей */
@media (max-width: 480px) {
  .partners-panel,
  .notes-side-panel,
  .comments-side-panel,
  .sticker-messages-panel,
  .images-panel,
  .anchors-panel {
    width: 100vw !important;
    max-width: 100vw !important;
  }
}

/* ============================================================
   AURORA DESIGN — Global Theme Override
   Selector prefix: #app.app--aurora  (specificity 1,1,0+)
   Beats scoped CSS (0,2,0) — no !important needed
   ============================================================ */

/* --- Aurora CSS Variables --- */
#app.app--aurora {
  --aurora-bg-deep: #080c14;
  --aurora-glass: rgba(255, 255, 255, 0.04);
  --aurora-glass-hover: rgba(255, 255, 255, 0.08);
  --aurora-glass-active: rgba(255, 255, 255, 0.12);
  --aurora-border: rgba(255, 255, 255, 0.07);
  --aurora-border-hover: rgba(0, 212, 170, 0.25);
  --aurora-text: rgba(255, 255, 255, 0.92);
  --aurora-text-secondary: rgba(255, 255, 255, 0.55);
  --aurora-text-muted: rgba(255, 255, 255, 0.35);
  --aurora-accent: #00d4aa;
  --aurora-accent-blue: #0088ff;
  --aurora-accent-purple: #8b5cf6;
  --aurora-glow: 0 0 20px rgba(0, 212, 170, 0.12);
  --aurora-glow-strong: 0 0 30px rgba(0, 212, 170, 0.2);
  --aurora-gradient: linear-gradient(135deg, #00d4aa, #0088ff, #8b5cf6);
  --aurora-panel-bg: rgba(8, 12, 20, 0.88);
  --aurora-panel-blur: blur(32px) saturate(1.4);
  --aurora-radius: 16px;
  --aurora-radius-sm: 10px;
  font-family: 'Manrope', system-ui, -apple-system, sans-serif;
}

/* --- Aurora Keyframe Animations --- */
@keyframes aurora-shimmer {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}

@keyframes aurora-pulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}

/* ==========================================================
   SIDE PANELS — Common Aurora base
   ========================================================== */

#app.app--aurora .images-panel,
#app.app--aurora .partners-panel,
#app.app--aurora .comments-side-panel,
#app.app--aurora .sticker-messages-panel,
#app.app--aurora .anchors-panel,
#app.app--aurora .notes-side-panel {
  background: var(--aurora-panel-bg);
  backdrop-filter: var(--aurora-panel-blur);
  -webkit-backdrop-filter: var(--aurora-panel-blur);
  border-color: var(--aurora-border);
  color: var(--aurora-text);
  font-family: 'Manrope', system-ui, -apple-system, sans-serif;
  box-shadow:
    -4px 0 40px rgba(0, 0, 0, 0.4),
    0 0 0 0.5px rgba(255, 255, 255, 0.05) inset;
}

/* --- Panel left-border aurora gradient glow (animated) --- */
#app.app--aurora .images-panel::before,
#app.app--aurora .partners-panel::before,
#app.app--aurora .comments-side-panel::before,
#app.app--aurora .sticker-messages-panel::before,
#app.app--aurora .anchors-panel::before,
#app.app--aurora .notes-side-panel::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  width: 2px;
  background: var(--aurora-gradient);
  background-size: 200% 200%;
  animation: aurora-shimmer 4s ease infinite;
  z-index: 1;
}

/* --- Panel headers --- */
#app.app--aurora .images-panel__header,
#app.app--aurora .partners-panel__header,
#app.app--aurora .comments-side-panel__header,
#app.app--aurora .sticker-messages-panel__header,
#app.app--aurora .anchors-panel__header,
#app.app--aurora .notes-side-panel__header {
  background: rgba(255, 255, 255, 0.02);
  border-bottom: 1px solid var(--aurora-border);
}

/* --- Panel titles — aurora gradient text --- */
#app.app--aurora .images-panel__title,
#app.app--aurora .partners-panel__title,
#app.app--aurora .comments-side-panel__title,
#app.app--aurora .sticker-messages-panel__title,
#app.app--aurora .anchors-panel__title,
#app.app--aurora .notes-side-panel__title {
  background: var(--aurora-gradient);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  font-weight: 700;
  letter-spacing: -0.02em;
}

/* --- Close buttons (frosted glass circle) --- */
#app.app--aurora .images-panel__close,
#app.app--aurora .partners-panel__close,
#app.app--aurora .comments-side-panel__close,
#app.app--aurora .sticker-messages-panel__close,
#app.app--aurora .anchors-panel__close,
#app.app--aurora .notes-side-panel__close {
  background: var(--aurora-glass);
  border: 1px solid var(--aurora-border);
  color: var(--aurora-text-secondary);
  border-radius: 50%;
  transition: all 0.2s ease;
}

#app.app--aurora .images-panel__close:hover,
#app.app--aurora .partners-panel__close:hover,
#app.app--aurora .comments-side-panel__close:hover,
#app.app--aurora .sticker-messages-panel__close:hover,
#app.app--aurora .anchors-panel__close:hover,
#app.app--aurora .notes-side-panel__close:hover {
  background: var(--aurora-glass-hover);
  border-color: rgba(255, 80, 80, 0.3);
  color: #ff5c5c;
  box-shadow: 0 0 12px rgba(255, 80, 80, 0.1);
}

/* --- Panel content areas --- */
#app.app--aurora .images-panel__content,
#app.app--aurora .partners-panel__content,
#app.app--aurora .comments-side-panel__content,
#app.app--aurora .sticker-messages-panel__content,
#app.app--aurora .anchors-panel__content,
#app.app--aurora .notes-side-panel__content {
  background: transparent;
  color: var(--aurora-text);
}

/* --- Aurora thin scrollbars --- */
#app.app--aurora .images-panel__content::-webkit-scrollbar,
#app.app--aurora .partners-panel__content::-webkit-scrollbar,
#app.app--aurora .comments-side-panel__content::-webkit-scrollbar,
#app.app--aurora .sticker-messages-panel__content::-webkit-scrollbar,
#app.app--aurora .anchors-panel__content::-webkit-scrollbar,
#app.app--aurora .notes-side-panel__content::-webkit-scrollbar {
  width: 4px;
}

#app.app--aurora .images-panel__content::-webkit-scrollbar-track,
#app.app--aurora .partners-panel__content::-webkit-scrollbar-track,
#app.app--aurora .comments-side-panel__content::-webkit-scrollbar-track,
#app.app--aurora .sticker-messages-panel__content::-webkit-scrollbar-track,
#app.app--aurora .anchors-panel__content::-webkit-scrollbar-track,
#app.app--aurora .notes-side-panel__content::-webkit-scrollbar-track {
  background: transparent;
}

#app.app--aurora .images-panel__content::-webkit-scrollbar-thumb,
#app.app--aurora .partners-panel__content::-webkit-scrollbar-thumb,
#app.app--aurora .comments-side-panel__content::-webkit-scrollbar-thumb,
#app.app--aurora .sticker-messages-panel__content::-webkit-scrollbar-thumb,
#app.app--aurora .anchors-panel__content::-webkit-scrollbar-thumb,
#app.app--aurora .notes-side-panel__content::-webkit-scrollbar-thumb {
  background: rgba(0, 212, 170, 0.3);
  border-radius: 4px;
}

/* ==========================================================
   IMAGES PANEL — Aurora specifics
   ========================================================== */

/* Tabs bar */
#app.app--aurora .images-panel__tabs {
  background: rgba(255, 255, 255, 0.02);
  border-bottom: 1px solid var(--aurora-border);
}

#app.app--aurora .images-panel__tab {
  color: var(--aurora-text-secondary);
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  transition: all 0.2s ease;
}

#app.app--aurora .images-panel__tab:hover {
  color: var(--aurora-text);
  background: var(--aurora-glass);
}

#app.app--aurora .images-panel__tab--active {
  color: var(--aurora-accent);
  background: rgba(0, 212, 170, 0.06);
  border-bottom-color: var(--aurora-accent);
}

/* Empty / access denied states */
#app.app--aurora .images-panel__empty-text,
#app.app--aurora .images-panel__access-denied-title {
  color: var(--aurora-text-secondary);
}

#app.app--aurora .images-panel__empty-hint,
#app.app--aurora .images-panel__access-denied-hint {
  color: var(--aurora-text-muted);
}

#app.app--aurora .images-panel__access-denied-icon {
  opacity: 0.5;
}

/* ==========================================================
   PARTNERS PANEL — Aurora specifics
   ========================================================== */

/* Search inputs (shared across panels) */
#app.app--aurora .panel-search .search-input,
#app.app--aurora .anchors-panel__search-input,
#app.app--aurora .notes-side-panel__search-input {
  background: var(--aurora-glass);
  border: 1px solid var(--aurora-border);
  color: var(--aurora-text);
  border-radius: var(--aurora-radius-sm);
  font-family: 'Manrope', system-ui, sans-serif;
  transition: all 0.25s ease;
}

#app.app--aurora .panel-search .search-input::placeholder,
#app.app--aurora .anchors-panel__search-input::placeholder,
#app.app--aurora .notes-side-panel__search-input::placeholder {
  color: var(--aurora-text-muted);
}

#app.app--aurora .panel-search .search-input:focus,
#app.app--aurora .anchors-panel__search-input:focus,
#app.app--aurora .notes-side-panel__search-input:focus {
  border-color: var(--aurora-accent);
  box-shadow: 0 0 0 3px rgba(0, 212, 170, 0.1), var(--aurora-glow);
  background: rgba(0, 212, 170, 0.04);
  outline: none;
}

/* Partner list items */
#app.app--aurora .partner-item {
  background: var(--aurora-glass);
  border: 1px solid var(--aurora-border);
  border-radius: var(--aurora-radius-sm);
  color: var(--aurora-text);
  margin-bottom: 4px;
  transition: all 0.2s ease;
}

#app.app--aurora .partner-item:hover {
  background: var(--aurora-glass-hover);
  border-color: var(--aurora-border-hover);
  box-shadow: var(--aurora-glow);
}

#app.app--aurora .partner-item--selected {
  background: rgba(0, 212, 170, 0.08);
  border-color: rgba(0, 212, 170, 0.3);
  box-shadow: 0 0 16px rgba(0, 212, 170, 0.08);
}

#app.app--aurora .partner-name {
  color: var(--aurora-text);
}

#app.app--aurora .partner-avatar {
  border: 1px solid var(--aurora-border);
  border-radius: 50%;
}

/* Partner details card */
#app.app--aurora .partner-details-card {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--aurora-border);
  border-radius: var(--aurora-radius);
  color: var(--aurora-text);
}

#app.app--aurora .partner-details-name {
  color: var(--aurora-text);
  font-weight: 700;
}

#app.app--aurora .partner-details-number,
#app.app--aurora .partner-details-label {
  color: var(--aurora-text-secondary);
}

#app.app--aurora .partner-details-link {
  color: var(--aurora-accent);
}

#app.app--aurora .partner-details-link:hover {
  color: var(--aurora-accent-blue);
}

#app.app--aurora .partner-details-close {
  color: var(--aurora-text-secondary);
}

#app.app--aurora .partner-details-close:hover {
  color: #ff5c5c;
}

/* Loading / Empty states */
#app.app--aurora .loading-state,
#app.app--aurora .empty-state {
  color: var(--aurora-text-secondary);
}

/* ==========================================================
   ANCHORS PANEL — Aurora specifics
   ========================================================== */

#app.app--aurora .anchors-panel__item {
  background: var(--aurora-glass);
  border: 1px solid var(--aurora-border);
  border-radius: var(--aurora-radius-sm);
  color: var(--aurora-text);
  transition: all 0.2s ease;
}

#app.app--aurora .anchors-panel__item:hover {
  background: var(--aurora-glass-hover);
  border-color: var(--aurora-border-hover);
}

#app.app--aurora .anchors-panel__item--active {
  background: rgba(0, 212, 170, 0.06);
  border-color: rgba(0, 212, 170, 0.3);
}

#app.app--aurora .anchors-panel__meta {
  color: var(--aurora-text-muted);
}

#app.app--aurora .anchors-panel__text {
  color: var(--aurora-text);
}

#app.app--aurora .anchors-panel__textarea {
  background: var(--aurora-glass);
  border: 1px solid var(--aurora-border);
  color: var(--aurora-text);
  border-radius: var(--aurora-radius-sm);
  font-family: 'Manrope', system-ui, sans-serif;
}

#app.app--aurora .anchors-panel__textarea:focus {
  border-color: var(--aurora-accent);
  box-shadow: 0 0 0 3px rgba(0, 212, 170, 0.1);
  outline: none;
}

#app.app--aurora .anchors-panel__action {
  background: var(--aurora-glass);
  border: 1px solid var(--aurora-border);
  color: var(--aurora-text-secondary);
  border-radius: var(--aurora-radius-sm);
  transition: all 0.2s ease;
}

#app.app--aurora .anchors-panel__action:hover {
  background: var(--aurora-glass-hover);
  border-color: var(--aurora-border-hover);
  color: var(--aurora-text);
}

#app.app--aurora .anchors-panel__icon {
  color: var(--aurora-text-secondary);
}

#app.app--aurora .anchors-panel__icon--danger {
  color: #ff5c5c;
}

#app.app--aurora .anchors-panel__empty {
  color: var(--aurora-text-muted);
}

/* ==========================================================
   NOTES PANEL — Aurora specifics
   ========================================================== */

#app.app--aurora .notes-side-panel__group {
  border-bottom: 1px solid var(--aurora-border);
}

#app.app--aurora .notes-side-panel__card-row {
  transition: all 0.2s ease;
}

#app.app--aurora .notes-side-panel__card-button {
  color: var(--aurora-text);
  background: transparent;
  border-radius: var(--aurora-radius-sm);
  transition: all 0.2s ease;
}

#app.app--aurora .notes-side-panel__card-button:hover {
  background: var(--aurora-glass-hover);
}

#app.app--aurora .notes-side-panel__entry {
  background: var(--aurora-glass);
  border: 1px solid var(--aurora-border);
  border-radius: var(--aurora-radius-sm);
  transition: all 0.2s ease;
}

#app.app--aurora .notes-side-panel__entry:hover {
  background: var(--aurora-glass-hover);
  border-color: var(--aurora-border-hover);
}

#app.app--aurora .notes-side-panel__entry-button {
  color: var(--aurora-text);
}

#app.app--aurora .notes-side-panel__entry-label {
  color: var(--aurora-text-secondary);
}

#app.app--aurora .notes-side-panel__icon-button {
  background: var(--aurora-glass);
  border: 1px solid var(--aurora-border);
  color: var(--aurora-text-secondary);
  border-radius: 50%;
  transition: all 0.2s ease;
}

#app.app--aurora .notes-side-panel__icon-button:hover {
  background: var(--aurora-glass-hover);
  border-color: var(--aurora-border-hover);
  color: var(--aurora-text);
}

#app.app--aurora .notes-side-panel__icon-button--danger {
  color: #ff5c5c;
}

#app.app--aurora .notes-side-panel__icon-button--danger:hover {
  border-color: rgba(255, 80, 80, 0.3);
  box-shadow: 0 0 12px rgba(255, 80, 80, 0.1);
}

#app.app--aurora .notes-side-panel__empty {
  color: var(--aurora-text-muted);
}

/* ==========================================================
   PANEL SWITCH BAR — Aurora floating glass bar
   ========================================================== */

#app.app--aurora .panel-switch-bar {
  position: relative;
  background: rgba(8, 12, 20, 0.7);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-bottom: none;
  gap: 2px;
  padding: 6px 10px;
}

/* Animated aurora gradient line at the bottom */
#app.app--aurora .panel-switch-bar::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 8%;
  right: 8%;
  height: 1px;
  background: var(--aurora-gradient);
  background-size: 200% 200%;
  animation: aurora-shimmer 4s ease infinite;
  opacity: 0.6;
}

#app.app--aurora .panel-switch-bar__btn {
  background: var(--aurora-glass);
  border: 1px solid transparent;
  color: var(--aurora-text-secondary);
  border-radius: var(--aurora-radius-sm);
  transition: all 0.2s ease;
}

#app.app--aurora .panel-switch-bar__btn:hover {
  background: var(--aurora-glass-hover);
  border-color: var(--aurora-border-hover);
  box-shadow: 0 0 10px rgba(0, 212, 170, 0.06);
}

#app.app--aurora .panel-switch-bar__btn:active {
  transform: scale(0.92);
}

#app.app--aurora .panel-switch-bar__btn--active {
  background: rgba(0, 212, 170, 0.1);
  border-color: rgba(0, 212, 170, 0.3);
  box-shadow: 0 0 14px rgba(0, 212, 170, 0.1);
}

/* ==========================================================
   PENCIL OVERLAY — Aurora glass drawing tools
   ========================================================== */

#app.app--aurora .pencil-overlay {
  font-family: 'Manrope', system-ui, sans-serif;
}

/* Tools bar — frosted glass capsule */
#app.app--aurora .pencil-overlay__tools-bar {
  background: rgba(8, 12, 20, 0.78);
  backdrop-filter: blur(24px) saturate(1.3);
  -webkit-backdrop-filter: blur(24px) saturate(1.3);
  border: 1px solid var(--aurora-border);
  border-radius: 20px;
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.35),
    0 0 0 0.5px rgba(255, 255, 255, 0.06) inset;
  padding: 6px;
}

/* Tool buttons — frosted glass chips */
#app.app--aurora .pencil-overlay__tool-btn {
  background: var(--aurora-glass);
  border: 1px solid var(--aurora-border);
  color: var(--aurora-text-secondary);
  border-radius: 12px;
  transition: all 0.2s ease;
}

#app.app--aurora .pencil-overlay__tool-btn:hover {
  background: var(--aurora-glass-hover);
  border-color: var(--aurora-border-hover);
  color: var(--aurora-text);
  box-shadow: 0 0 12px rgba(0, 212, 170, 0.08);
}

#app.app--aurora .pencil-overlay__tool-btn--active {
  background: rgba(0, 212, 170, 0.12);
  border-color: rgba(0, 212, 170, 0.35);
  color: var(--aurora-accent);
  box-shadow: 0 0 20px rgba(0, 212, 170, 0.12);
}

/* Close button — frosted glass circle */
#app.app--aurora .pencil-overlay__close-button {
  background: rgba(8, 12, 20, 0.78);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid var(--aurora-border);
  color: var(--aurora-text-secondary);
  border-radius: 50%;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  transition: all 0.2s ease;
}

#app.app--aurora .pencil-overlay__close-button:hover {
  background: rgba(255, 80, 80, 0.12);
  border-color: rgba(255, 80, 80, 0.3);
  color: #ff5c5c;
  box-shadow: 0 0 16px rgba(255, 80, 80, 0.1);
}

/* Undo/Redo bar — frosted glass capsule */
#app.app--aurora .pencil-overlay__undo-redo-bar {
  background: rgba(8, 12, 20, 0.78);
  backdrop-filter: blur(24px) saturate(1.3);
  -webkit-backdrop-filter: blur(24px) saturate(1.3);
  border: 1px solid var(--aurora-border);
  border-radius: 16px;
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.35),
    0 0 0 0.5px rgba(255, 255, 255, 0.06) inset;
}

#app.app--aurora .pencil-overlay__undo-redo-btn {
  background: var(--aurora-glass);
  border: 1px solid var(--aurora-border);
  color: var(--aurora-text-secondary);
  border-radius: 10px;
  transition: all 0.2s ease;
}

#app.app--aurora .pencil-overlay__undo-redo-btn:hover:not(:disabled) {
  background: var(--aurora-glass-hover);
  border-color: var(--aurora-border-hover);
  color: var(--aurora-text);
}

#app.app--aurora .pencil-overlay__undo-redo-btn:disabled {
  opacity: 0.25;
}

/* Dropdown menus */
#app.app--aurora .pencil-overlay__dropdown-content {
  background: rgba(8, 12, 20, 0.92);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid var(--aurora-border);
  border-radius: var(--aurora-radius);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
  color: var(--aurora-text);
}

#app.app--aurora .pencil-overlay__dropdown-select-btn {
  color: var(--aurora-text-secondary);
  border-radius: 8px;
  transition: all 0.15s ease;
}

#app.app--aurora .pencil-overlay__dropdown-select-btn:hover {
  background: var(--aurora-glass-hover);
  color: var(--aurora-text);
}

#app.app--aurora .pencil-overlay__control {
  color: var(--aurora-text-secondary);
}

#app.app--aurora .pencil-overlay__helper-text {
  color: var(--aurora-text-muted);
}

/* Image frame in pencil mode */
#app.app--aurora .pencil-overlay__image-frame {
  border-color: var(--aurora-accent);
}

#app.app--aurora .pencil-overlay__image-handle {
  background: var(--aurora-accent);
  border-color: rgba(0, 212, 170, 0.6);
}

/* Text input */
#app.app--aurora .pencil-overlay__text-input {
  border-color: var(--aurora-accent);
  color: var(--aurora-text);
  font-family: 'Manrope', system-ui, sans-serif;
}

/* ==========================================================
   AURORA — Global font & element overrides
   ========================================================== */

/* Form elements don't inherit font — force Manrope globally */
#app.app--aurora button,
#app.app--aurora input,
#app.app--aurora textarea,
#app.app--aurora select {
  font-family: 'Manrope', system-ui, -apple-system, sans-serif;
}

/* MobileFullMenu is teleported to <body> — needs separate selector */
body .fullmenu-panel--aurora {
  font-family: 'Manrope', system-ui, -apple-system, sans-serif;
}

body .fullmenu-panel--aurora button,
body .fullmenu-panel--aurora input,
body .fullmenu-panel--aurora textarea {
  font-family: 'Manrope', system-ui, -apple-system, sans-serif;
}

/* Aurora title gradient for fullmenu header (teleported) */
body .fullmenu-panel--aurora .fullmenu-header__title {
  font-family: 'Manrope', system-ui, -apple-system, sans-serif;
  font-weight: 800;
  letter-spacing: -0.03em;
}
</style>
// Test webhook Tue Jan 20 12:59:42 PM UTC 2026
