import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useCanvasStore = defineStore('canvas', () => {
  
  const backgroundColor = ref('#b9c4da')
  const isHierarchicalDragMode = ref(false)
  const guidesEnabled = ref(true)
  const gridStep = ref(40)
  const isGridBackgroundVisible = ref(true)

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

  function setHierarchicalDragMode(value) {
    const nextValue = Boolean(value)
    isHierarchicalDragMode.value = nextValue
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
  function setGridStep(value) {
    const numericValue = Number(value)
    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      return
    }

    gridStep.value = Math.max(1, Math.round(numericValue))
  }

  function setGridBackgroundVisible(value) {
    isGridBackgroundVisible.value = Boolean(value)
  }

  function toggleGridBackground() {
    setGridBackgroundVisible(!isGridBackgroundVisible.value)
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

    if (typeof state.isHierarchicalDragMode === 'boolean') {
      setHierarchicalDragMode(state.isHierarchicalDragMode)
    }

    if (typeof state.guidesEnabled === 'boolean') {
      setGuidesEnabled(state.guidesEnabled)
    }
 
    if (typeof state.gridStep === 'number') {
      setGridStep(state.gridStep)
    }

    const backgroundFlag =
      typeof state.isGridBackgroundVisible === 'boolean'
        ? state.isGridBackgroundVisible
        : typeof state.gridBackgroundEnabled === 'boolean'
          ? state.gridBackgroundEnabled
          : null

    if (backgroundFlag !== null) {
      setGridBackgroundVisible(backgroundFlag)
    }   
  }
  return {
    backgroundColor,
    isHierarchicalDragMode,
    guidesEnabled,
    gridStep,
    isGridBackgroundVisible,
    setBackgroundColor,
    setBackgroundGradient,
    setHierarchicalDragMode,
    toggleHierarchicalDragMode,
    setGuidesEnabled,
    setGridStep,
    setGridBackgroundVisible,
    toggleGridBackground,
    toggleGuides,
    applyState
  }})
