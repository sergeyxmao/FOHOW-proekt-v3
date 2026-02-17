import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useDesignModeStore = defineStore('designMode', () => {
  const isAuroraDesign = ref(false)

  function toggleDesign() {
    isAuroraDesign.value = !isAuroraDesign.value
  }

  return { isAuroraDesign, toggleDesign }
})
