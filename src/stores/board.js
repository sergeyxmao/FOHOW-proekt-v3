import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { useAuthStore } from './auth.js'

export const useBoardStore = defineStore('board', () => {
  const currentBoardId = ref(null)
  const currentBoardName = ref('Без названия')
  const lastSaved = ref(null)
  const isSaving = ref(false)
  const hasUnsavedChanges = ref(false)
  const isReadOnly = ref(false) // Флаг readonly режима (для soft_lock досок)
  const lockStatus = ref('active') // 'active' | 'soft_lock' | 'hard_lock'
  const daysUntilBlock = ref(null) // Дней до полной блокировки (для soft_lock)
  const anchors = ref([])
  const selectedAnchorId = ref(null)
  const pendingFocusAnchorId = ref(null)
  const pendingEditAnchorId = ref(null)
  const animatingAnchorId = ref(null)
  const placementMode = ref(null) // 'anchor' | null
  const isNavigating = ref(false) // Флаг для предотвращения конфликтов при программной навигации
  const targetViewPoint = ref(null) // { x, y, timestamp } - целевая точка для центрирования
  const isCurrentBoard = computed(() => currentBoardId.value !== null)
  const API_URL = import.meta.env.VITE_API_URL || 'https://interactive.marketingfohow.ru/api'
  
  let anchorAnimationTimeout = null
  
  function setCurrentBoard(id, name, options = {}) {
    currentBoardId.value = id
    currentBoardName.value = name || 'Без названия'
    hasUnsavedChanges.value = false
    lastSaved.value = new Date()
    // Устанавливаем статус блокировки и readonly режим
    isReadOnly.value = options.readOnly || false
    lockStatus.value = options.lockStatus || 'active'
    daysUntilBlock.value = options.daysUntilBlock ?? null
  }

  function clearCurrentBoard() {
    currentBoardId.value = null
    currentBoardName.value = 'Без названия'
    hasUnsavedChanges.value = false
    lastSaved.value = null
    isReadOnly.value = false
    lockStatus.value = 'active'
    daysUntilBlock.value = null
    anchors.value = []
    selectedAnchorId.value = null
    pendingFocusAnchorId.value = null
    pendingEditAnchorId.value = null
    stopAnchorAnimation()
    placementMode.value = null
  }

  function markAsChanged() {
    hasUnsavedChanges.value = true
  }

  function markAsSaved() {
    hasUnsavedChanges.value = false
    lastSaved.value = new Date()
    isSaving.value = false
  }

  function setAnchors(list) {
    anchors.value = Array.isArray(list) ? list : []
  }

  function addAnchor(anchor) {
    anchors.value.push(anchor)
    selectedAnchorId.value = anchor.id
    markAsChanged()
  }

  function updateAnchor(id, data) {
    const index = anchors.value.findIndex(anchor => anchor.id === id)
    if (index === -1) {
      return
    }
    anchors.value[index] = { ...anchors.value[index], ...data }
    markAsChanged()
  }

  function removeAnchor(id) {
    anchors.value = anchors.value.filter(anchor => anchor.id !== id)
    if (selectedAnchorId.value === id) {
      selectedAnchorId.value = null
    }
    if (pendingFocusAnchorId.value === id) {
      pendingFocusAnchorId.value = null
    }
    if (pendingEditAnchorId.value === id) {
      pendingEditAnchorId.value = null
    }
    markAsChanged()
  }

  function selectAnchor(id) {
    selectedAnchorId.value = id
  }

  function focusAnchor(id) {
    pendingFocusAnchorId.value = id
    selectedAnchorId.value = id
  }
  function startAnchorAnimation(id, durationMs = 3000) {
    if (!id) {
      stopAnchorAnimation()
      return
    }

    if (anchorAnimationTimeout) {
      clearTimeout(anchorAnimationTimeout)
      anchorAnimationTimeout = null
    }

    // Сбрасываем значение, чтобы можно было перезапустить анимацию для той же точки
    animatingAnchorId.value = null

    requestAnimationFrame(() => {
      animatingAnchorId.value = id
      anchorAnimationTimeout = setTimeout(() => {
        animatingAnchorId.value = null
        anchorAnimationTimeout = null
      }, durationMs)
    })
  }

  function stopAnchorAnimation() {
    if (anchorAnimationTimeout) {
      clearTimeout(anchorAnimationTimeout)
      anchorAnimationTimeout = null
    }
    animatingAnchorId.value = null
  }
  function requestAnchorEdit(id) {
    pendingEditAnchorId.value = id
  }

  function clearPendingAnchorEdit() {
    pendingEditAnchorId.value = null
  }

  function setPlacementMode(mode) {
    placementMode.value = mode
  }

  function centerViewOnPoint(x, y) {
    // Сохраняем целевую точку с timestamp для триггера watch
    targetViewPoint.value = {
      x,
      y,
      timestamp: Date.now()
    }
    return true
  }

  async function updateCurrentBoardName(newName) {
    const trimmedName = typeof newName === 'string' ? newName.trim() : ''

    if (!trimmedName) {
      return { success: false, reason: 'empty' }
    }

    if (trimmedName === currentBoardName.value) {
      return { success: false, reason: 'unchanged' }
    }

    const previousName = currentBoardName.value
    currentBoardName.value = trimmedName

    if (!currentBoardId.value) {
      return { success: true, synced: false }
    }

    const authStore = useAuthStore()

    if (!authStore.isAuthenticated || !authStore.token) {
      return { success: true, synced: false }
    }

    try {
      isSaving.value = true

      const response = await fetch(`${API_URL}/boards/${currentBoardId.value}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${authStore.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: trimmedName })
      })

      if (!response.ok) {
        // Проверяем, не превышен ли лимит
        if (response.status === 403) {
          try {
            const errorData = await response.json()
            if (errorData.code === 'USAGE_LIMIT_REACHED') {
              // Показываем специфичное сообщение о превышении лимита
              alert(errorData.error || 'Достигнут лимит на вашем тарифе')
              currentBoardName.value = previousName
              isSaving.value = false
              return { success: false, synced: false, limitReached: true }
            }
          } catch (parseError) {
            // Если не удалось распарсить JSON, продолжаем с общей ошибкой
          }
        }
        throw new Error('Ошибка переименования структуры')
      }

      lastSaved.value = new Date()

      return { success: true, synced: true }
    } catch (error) {
      currentBoardName.value = previousName
      throw error
    } finally {
      isSaving.value = false
    }
  }
  return {
    currentBoardId,
    currentBoardName,
    lastSaved,
    isSaving,
    hasUnsavedChanges,
    isReadOnly,
    lockStatus,
    daysUntilBlock,
    isCurrentBoard,
    anchors,
    selectedAnchorId,
    pendingFocusAnchorId,
    pendingEditAnchorId,
    animatingAnchorId,
    placementMode,
    isNavigating,
    targetViewPoint,
    setCurrentBoard,
    clearCurrentBoard,
    markAsChanged,
    markAsSaved,
    updateCurrentBoardName,
    setAnchors,
    addAnchor,
    updateAnchor,
    removeAnchor,
    selectAnchor,
    focusAnchor,
    startAnchorAnimation,
    stopAnchorAnimation,
    requestAnchorEdit,
    clearPendingAnchorEdit,
    setPlacementMode,
    centerViewOnPoint
  }
})
