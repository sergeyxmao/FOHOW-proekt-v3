import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useCanvasStore = defineStore('canvas', () => {
  // State
  const backgroundColor = ref('#ffffff')
    const isSelectionMode = ref(false)
  const isHierarchicalDragMode = ref(false)
  const guidesEnabled = ref(true)
  // Actions
  function setBackgroundColor(color) {
    backgroundColor.value = color;
    // Применяем цвет к body
    if (typeof document !== 'undefined') {
      document.body.style.background = color;
    }
  }
  
  function setBackgroundGradient(gradient) {
    backgroundColor.value = gradient;
    // Применяем градиент к body
    if (typeof document !== 'undefined') {
      document.body.style.background = gradient;
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
  
  
  // Return public API
  return {
    // State
    backgroundColor,
    isSelectionMode,
    isHierarchicalDragMode,
    guidesEnabled,    
    // Actions
    setBackgroundColor,
    setBackgroundGradient,
    setSelectionMode,
    toggleSelectionMode,
    setHierarchicalDragMode,
    toggleHierarchicalDragMode,
    setGuidesEnabled,
    toggleGuides  }
})
