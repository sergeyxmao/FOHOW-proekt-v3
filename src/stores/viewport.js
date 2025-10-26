import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useViewportStore = defineStore('viewport', () => {
  const zoomScale = ref(1)

  const zoomPercentage = computed(() => Math.round(zoomScale.value * 100))

  const setZoomScale = (value) => {
    if (!Number.isFinite(value)) {
      return
    }
    zoomScale.value = value
  }

  return {
    zoomScale,
    zoomPercentage,
    setZoomScale
  }
})
