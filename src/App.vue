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
import { storeToRefs } from 'pinia'
import { makeBoardThumbnail } from './utils/boardThumbnail'
import { checkAndAlertCardLimit } from './utils/limitsCheck'
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
    if (!isMobileMode.value) {
      alert(t('board.createFailed'))
    }
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
      pv: card.pv
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

function handleMobileExportHTML() {
  handleExportHTML()
}

async function handleMobileLoadJSON() {
  const canProceed = await ensureStructureExists()

  if (canProceed) {
    handleLoadProject()
  }
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
      'app--admin': layout === 'admin'
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
        v-show="!isPencilMode && !showResetPassword"
        class="no-print"
        :is-modern-theme="isModernTheme"
        @toggle-theme="toggleTheme"
        @activate-pencil="handleActivatePencil"
        @clear-canvas="handleClearCanvas"
        @new-structure="handleNewStructure"
      />
      <AppHeader
        v-show="!isPencilMode && !showResetPassword"
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
      />
      <MobileToolbar
        v-show="!isPencilMode && !showResetPassword"
        class="no-print"
        :is-modern-theme="isModernTheme"
        @save="saveCurrentBoard"
        @toggle-theme="toggleTheme"
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
      />
      <MobileVersionDialog class="no-print" />
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

    <!-- Side Panels -->
    <transition name="side-panel-slide">
      <PartnersPanel
        v-if="isPartnersOpen && !isMobileMode"
        class="no-print"
        :is-modern-theme="isModernTheme"
      />
    </transition>

    <transition name="side-panel-slide">
      <NotesSidePanel
        v-if="isNotesOpen && !isMobileMode"
        class="no-print"
        :is-modern-theme="isModernTheme"
      />
    </transition>

    <transition name="side-panel-slide">
      <CommentsSidePanel
        v-if="isCommentsOpen && !isMobileMode"
        class="no-print"
        :is-modern-theme="isModernTheme"
      />
    </transition>

    <transition name="side-panel-slide">
      <StickerMessagesPanel
        v-if="isStickerMessagesOpen && !isMobileMode"
        class="no-print"
        :is-modern-theme="isModernTheme"
      />
    </transition>

    <transition name="side-panel-slide">
      <ImagesPanel
        v-if="isImagesOpen && !isMobileMode && !isPencilMode"
        class="no-print"
        :is-modern-theme="isModernTheme"
      />
    </transition>
    <transition name="side-panel-slide">
      <BoardAnchorsPanel
        v-if="isAnchorsOpen && !isMobileMode"
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
  transform: translateX(-50%);
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
  transform: translateX(-50%);
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
</style>
// Test webhook Tue Jan 20 12:59:42 PM UTC 2026
