import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useCanvasStore = defineStore('canvas', () => {
  
  const backgroundColor = ref('#ffffff')
  const isSelectionMode = ref(false)
  const isHierarchicalDragMode = ref(false)
  const guidesEnabled = ref(true)

  function setBackgroundColor(color) {
    backgroundColor.value = color
    if (typeof document !== 'undefined') {
      document.body.style.background = color
    }
  }
  
  function setBackgroundGradient(gradient) {
    backgroundColor.value = gradient

    if (typeof document !== 'undefined') {
      document.body.style.background = gradient
    }
  }

  function setSelectionMode(value) {
    const nextValue = Boolean(value)
    isSelectionMode.value = nextValue
    if (nextValue) {
      isHierarchicalDragMode.value = false
    }
  }

  function toggleSelectionMode() {
    setSelectionMode(!isSelectionMode.value)
  }

  function setHierarchicalDragMode(value) {
    const nextValue = Boolean(value)
    isHierarchicalDragMode.value = nextValue
    if (nextValue) {
      isSelectionMode.value = false
    }
  }

  function toggleHierarchicalDragMode() {
    setHierarchicalDragMode(!isHierarchicalDragMode.value)
  }

  function setGuidesEnabled(value) {
    guidesEnabled.value = Boolean(value)
  }

  function toggleGuides() {
    setGuidesEnabled(!guidesEnabled.value)
  }

  function applyState(state = {}) {
    if (!state || typeof state !== 'object') {
      return
    }

    if (typeof state.backgroundColor === 'string') {
      const value = state.backgroundColor

      if (value.includes('gradient(')) {
        setBackgroundGradient(value)
      } else {
        setBackgroundColor(value)
      }
    }

    if (typeof state.isSelectionMode === 'boolean') {
      setSelectionMode(state.isSelectionMode)
    }

    if (typeof state.isHierarchicalDragMode === 'boolean') {
      setHierarchicalDragMode(state.isHierarchicalDragMode)
    }

    if (typeof state.guidesEnabled === 'boolean') {
      setGuidesEnabled(state.guidesEnabled)
    }
  }
  return {
    backgroundColor,
    isSelectionMode,
    isHierarchicalDragMode,
    guidesEnabled,
    setBackgroundColor,
    setBackgroundGradient,
    setSelectionMode,
    toggleSelectionMode,
    setHierarchicalDragMode,
    toggleHierarchicalDragMode,
    setGuidesEnabled,
    toggleGuides,
    applyState
  }})
