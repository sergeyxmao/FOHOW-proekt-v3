import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const usePerformanceModeStore = defineStore('performanceMode', () => {
  // Три режима: 'full', 'light', 'view'
  const mode = ref('full')

  const isFull = computed(() => mode.value === 'full')
  const isLight = computed(() => mode.value === 'light')
  const isView = computed(() => mode.value === 'view')

  // Удобные геттеры для компонентов
  const animationsEnabled = computed(() => mode.value === 'full')
  const editingEnabled = computed(() => mode.value !== 'view')
  const dragEnabled = computed(() => mode.value !== 'view')
  const controlsVisible = computed(() => mode.value !== 'view')
  const gridVisible = computed(() => mode.value === 'full')
  const shadowsEnabled = computed(() => mode.value === 'full')

  function setMode(newMode) {
    if (['full', 'light', 'view'].includes(newMode)) {
      mode.value = newMode
    }
  }

  // Циклическое переключение: full → light → view → full
  function cycleMode() {
    const order = ['full', 'light', 'view']
    const currentIndex = order.indexOf(mode.value)
    const nextIndex = (currentIndex + 1) % order.length
    mode.value = order[nextIndex]
  }

  return {
    mode,
    isFull,
    isLight,
    isView,
    animationsEnabled,
    editingEnabled,
    dragEnabled,
    controlsVisible,
    gridVisible,
    shadowsEnabled,
    setMode,
    cycleMode
  }
})
