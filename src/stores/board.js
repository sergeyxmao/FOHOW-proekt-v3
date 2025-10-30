import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

export const useBoardStore = defineStore('board', () => {
  const currentBoardId = ref(null)
  const currentBoardName = ref('Без названия')
  const lastSaved = ref(null)
  const isSaving = ref(false)
  const hasUnsavedChanges = ref(false)

  const isCurrentBoard = computed(() => currentBoardId.value !== null)

  function setCurrentBoard(id, name) {
    currentBoardId.value = id
    currentBoardName.value = name || 'Без названия'
    hasUnsavedChanges.value = false
    lastSaved.value = new Date()
  }

  function clearCurrentBoard() {
    currentBoardId.value = null
    currentBoardName.value = 'Без названия'
    hasUnsavedChanges.value = false
    lastSaved.value = null
  }

  function markAsChanged() {
    hasUnsavedChanges.value = true
  }

  function markAsSaved() {
    hasUnsavedChanges.value = false
    lastSaved.value = new Date()
    isSaving.value = false
  }

  return {
    currentBoardId,
    currentBoardName,
    lastSaved,
    isSaving,
    hasUnsavedChanges,
    isCurrentBoard,
    setCurrentBoard,
    clearCurrentBoard,
    markAsChanged,
    markAsSaved
  }
})
