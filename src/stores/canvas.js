import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useCanvasStore = defineStore('canvas', () => {
  // State
  const backgroundColor = ref('#ffffff')
  
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
  
  // Return public API
  return {
    // State
    backgroundColor,
    // Actions
    setBackgroundColor,
    setBackgroundGradient
  }
})