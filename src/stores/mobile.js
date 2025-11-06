import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'

const MENU_SCALE_STORAGE_KEY = 'fohow_mobile_menu_scale'

export const useMobileStore = defineStore('mobile', () => {
  // Определяем, является ли устройство мобильным
  const isMobileDevice = ref(false)

  // Пользователь принудительно включил мобильную версию
  const forceMobileMode = ref(false)

  // Пользователь принудительно включил десктопную версию
  const forceDesktopMode = ref(false)

  // Загружаем сохраненный масштаб из localStorage или используем 1 по умолчанию
  const loadSavedScale = () => {
    try {
      const saved = localStorage.getItem(MENU_SCALE_STORAGE_KEY)
      if (saved) {
        const parsed = parseFloat(saved)
        if (!isNaN(parsed) && parsed >= 1 && parsed <= 2) {
          return parsed
        }
      }
    } catch (error) {
      console.warn('Не удалось загрузить сохраненный масштаб:', error)
    }
    return 1
  }

  // Текущее масштабирование элементов мобильного меню
  const menuScale = ref(loadSavedScale())

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
  const setMenuScale = (value) => {
    const numericValue = Number(value)
    if (!Number.isFinite(numericValue)) {
      menuScale.value = 1
      return
    }

    const clamped = Math.min(Math.max(numericValue, 1), 2)
    menuScale.value = clamped

    // Сохраняем в localStorage
    try {
      localStorage.setItem(MENU_SCALE_STORAGE_KEY, String(clamped))
    } catch (error) {
      console.warn('Не удалось сохранить масштаб:', error)
    }
  }

  const resetMenuScale = () => {
    menuScale.value = 1
    try {
      localStorage.setItem(MENU_SCALE_STORAGE_KEY, '1')
    } catch (error) {
      console.warn('Не удалось сохранить масштаб:', error)
    }
  }

  const isMenuScaled = computed(() => menuScale.value > 1.01)

  return {
    isMobileDevice,
    forceMobileMode,
    forceDesktopMode,
    isMobileMode,
    showMobileDialog,
    isMenuScaled,
    menuScale,
    detectDevice,
    switchToMobile,
    switchToDesktop,
    closeMobileDialog,
    setMenuScale,
    resetMenuScale
  }
})
