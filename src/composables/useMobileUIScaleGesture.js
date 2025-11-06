import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useMobileStore } from '@/stores/mobile'

/**
 * Composable для жеста масштабирования UI элементов в мобильной версии
 * Активация: зажатие пальца у левого края экрана + движение вверх/вниз
 *
 * @param {Object} options - Опции настройки жеста
 * @param {number} options.edgeZonePercent - Процент ширины экрана для зоны активации (по умолчанию 15%)
 * @param {number} options.minScale - Минимальный масштаб (по умолчанию 1)
 * @param {number} options.sensitivity - Чувствительность жеста (по умолчанию 0.002)
 * @param {string} options.uiSelector - CSS селектор для UI элементов (по умолчанию '.mobile-toolbar, .mobile-sidebar, .mobile-header')
 * @param {string} options.canvasSelector - CSS селектор для canvas (по умолчанию '#canvas')
 * @param {number} options.safetyMargin - Минимальное расстояние между элементами в пикселях (по умолчанию 8)
 */
export function useMobileUIScaleGesture(options = {}) {
  const {
    edgeZonePercent = 15,
    minScale = 1,
    sensitivity = 0.002,
    uiSelector = '.mobile-toolbar, .mobile-sidebar, .mobile-header',
    canvasSelector = '#canvas',
    safetyMargin = 8
  } = options

  const mobileStore = useMobileStore()

  // Состояние жеста
  const isGestureActive = ref(false)
  const gestureStartY = ref(0)
  const gestureStartScale = ref(1)
  const currentMaxScale = ref(2)

  /**
   * Вычисляет максимально допустимый масштаб на основе текущих позиций UI элементов
   * @returns {number} Максимальный масштаб
   */
  function calculateMaxScale() {
    if (typeof window === 'undefined') return 2

    try {
      const uiElements = document.querySelectorAll(uiSelector)
      const canvasElement = document.querySelector(canvasSelector)

      if (!uiElements.length) return 2

      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight

      let minAllowedScale = 2 // Начинаем с максимально возможного значения

      // Проверяем каждый UI элемент
      uiElements.forEach(element => {
        const rect = element.getBoundingClientRect()
        const currentScale = mobileStore.menuScale

        // Вычисляем базовые размеры элемента (без текущего масштаба)
        const baseWidth = rect.width / currentScale
        const baseHeight = rect.height / currentScale

        // Вычисляем позицию элемента
        const left = rect.left
        const top = rect.top
        const right = rect.right
        const bottom = rect.bottom

        // Проверяем расстояние до границ экрана
        // Учитываем, что при увеличении масштаба элемент будет расти от своего центра
        const centerX = left + rect.width / 2
        const centerY = top + rect.height / 2

        // Вычисляем максимальный масштаб для каждой границы
        const maxScaleLeft = centerX > safetyMargin
          ? (centerX - safetyMargin) / (baseWidth / 2)
          : currentScale

        const maxScaleRight = (viewportWidth - centerX) > safetyMargin
          ? (viewportWidth - centerX - safetyMargin) / (baseWidth / 2)
          : currentScale

        const maxScaleTop = centerY > safetyMargin
          ? (centerY - safetyMargin) / (baseHeight / 2)
          : currentScale

        const maxScaleBottom = (viewportHeight - centerY) > safetyMargin
          ? (viewportHeight - centerY - safetyMargin) / (baseHeight / 2)
          : currentScale

        // Берем минимальное значение из всех границ
        const elementMaxScale = Math.min(
          maxScaleLeft,
          maxScaleRight,
          maxScaleTop,
          maxScaleBottom
        )

        // Обновляем общий минимум
        minAllowedScale = Math.min(minAllowedScale, elementMaxScale)
      })

      // Проверяем столкновения между UI элементами
      const elements = Array.from(uiElements)
      for (let i = 0; i < elements.length; i++) {
        for (let j = i + 1; j < elements.length; j++) {
          const rect1 = elements[i].getBoundingClientRect()
          const rect2 = elements[j].getBoundingClientRect()

          const currentScale = mobileStore.menuScale

          // Вычисляем расстояние между элементами
          const distanceX = Math.min(
            Math.abs(rect2.left - rect1.right),
            Math.abs(rect1.left - rect2.right)
          )

          const distanceY = Math.min(
            Math.abs(rect2.top - rect1.bottom),
            Math.abs(rect1.top - rect2.bottom)
          )

          // Если элементы находятся рядом друг с другом
          if (distanceX < 200 && distanceY < 200) {
            // Вычисляем максимальный масштаб, при котором они не столкнутся
            const baseDistance = Math.min(distanceX, distanceY) / currentScale
            const maxScaleForPair = (baseDistance - safetyMargin) / (baseDistance / currentScale)

            minAllowedScale = Math.min(minAllowedScale, Math.max(minScale, maxScaleForPair))
          }
        }
      }

      // Убеждаемся, что значение находится в разумных пределах
      return Math.max(minScale, Math.min(2, minAllowedScale))
    } catch (error) {
      console.warn('Ошибка при вычислении максимального масштаба:', error)
      return 2
    }
  }

  /**
   * Обработчик начала касания
   */
  function handleTouchStart(event) {
    if (event.touches.length !== 1) return

    const touch = event.touches[0]
    const edgeZoneWidth = window.innerWidth * (edgeZonePercent / 100)

    console.log('👆 Touch start:', {

      x: touch.clientX,

      y: touch.clientY,

      edgeZoneWidth,

      isInZone: touch.clientX <= edgeZoneWidth

    })

 

    // Проверяем, что касание началось в левой зоне экрана

    if (touch.clientX <= edgeZoneWidth) {
    }
  }

  /**
   * Обработчик движения касания
   */
  function handleTouchMove(event) {
    if (!isGestureActive.value || event.touches.length !== 1) return

    event.preventDefault() // Предотвращаем прокрутку

    const touch = event.touches[0]
    const deltaY = gestureStartY.value - touch.clientY // Инвертируем: вверх = положительное

    // Вычисляем новый масштаб на основе движения
    const scaleDelta = deltaY * sensitivity
    let newScale = gestureStartScale.value + scaleDelta

    // Пересчитываем максимальный масштаб в реальном времени
    currentMaxScale.value = calculateMaxScale()

    // Ограничиваем масштаб
    newScale = Math.max(minScale, Math.min(currentMaxScale.value, newScale))

    console.log('📏 Масштабирование:', {

      deltaY,

      scaleDelta,

      newScale,

      currentScale: mobileStore.menuScale,

      maxScale: currentMaxScale.value

    })

    // Применяем масштаб
    mobileStore.setMenuScale(newScale)
  }

  /**
   * Обработчик окончания касания
   */
  function handleTouchEnd(event) {
    if (!isGestureActive.value) return

    isGestureActive.value = false
    gestureStartY.value = 0
  }

  /**
   * Обработчик отмены касания
   */
  function handleTouchCancel(event) {
    isGestureActive.value = false
    gestureStartY.value = 0
  }

  /**
   * Инициализация обработчиков событий
   */
  function setupEventListeners() {
    if (typeof window === 'undefined') return

    console.log('🎬 Настройка обработчиков жеста масштабирования UI')

 

    document.addEventListener('touchstart', handleTouchStart, { passive: false })

    document.addEventListener('touchmove', handleTouchMove, { passive: false })

    document.addEventListener('touchend', handleTouchEnd, { passive: true })

    document.addEventListener('touchcancel', handleTouchCancel, { passive: true })

 

    console.log('✅ Обработчики жеста настроены')
  }

  /**
   * Удаление обработчиков событий
   */
  function removeEventListeners() {
    if (typeof window === 'undefined') return

    document.removeEventListener('touchstart', handleTouchStart)
    document.removeEventListener('touchmove', handleTouchMove)
    document.removeEventListener('touchend', handleTouchEnd)
    document.removeEventListener('touchcancel', handleTouchCancel)
  }

  // Lifecycle hooks
  onMounted(() => {
    setupEventListeners()
  })

  onBeforeUnmount(() => {
    removeEventListeners()
  })

  return {
    isGestureActive,
    currentMaxScale,
    calculateMaxScale,
    setupEventListeners,
    removeEventListeners
  }
}
