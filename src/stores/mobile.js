import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useMobileStore = defineStore('mobile', () => {
  // Определяем, является ли устройство мобильным
  const isMobileDevice = ref(false)

  // Пользователь принудительно включил мобильную версию
  const forceMobileMode = ref(false)

  // Пользователь принудительно включил десктопную версию
  const forceDesktopMode = ref(false)

  // Показывать ли диалог о мобильной версии
  const showMobileDialog = ref(false)

  // Вычисляемое свойство для определения текущего режима
  const isMobileMode = computed(() => {
    if (forceDesktopMode.value) return false
    if (forceMobileMode.value) return true
    return isMobileDevice.value
  })

  // Инициализация определения устройства
  const detectDevice = () => {
    // Проверяем размер экрана
    const isSmallScreen = window.innerWidth <= 768

    // Проверяем User Agent
    const userAgent = navigator.userAgent || navigator.vendor || window.opera
    const isMobileUA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
      userAgent.toLowerCase()
    )

    // Проверяем touch support
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0

    isMobileDevice.value = isSmallScreen || (isMobileUA && isTouchDevice)

    // Если это мобильное устройство, показываем диалог
    if (isMobileDevice.value && !forceDesktopMode.value) {
      showMobileDialog.value = true
    }
  }

  // Переключение на мобильную версию
  const switchToMobile = () => {
    forceMobileMode.value = true
    forceDesktopMode.value = false
    showMobileDialog.value = true
  }

  // Переключение на десктопную версию
  const switchToDesktop = () => {
    forceDesktopMode.value = true
    forceMobileMode.value = false
    showMobileDialog.value = false
  }

  // Закрытие диалога
  const closeMobileDialog = () => {
    showMobileDialog.value = false
  }

  return {
    isMobileDevice,
    forceMobileMode,
    forceDesktopMode,
    isMobileMode,
    showMobileDialog,
    detectDevice,
    switchToMobile,
    switchToDesktop,
    closeMobileDialog
  }
})
