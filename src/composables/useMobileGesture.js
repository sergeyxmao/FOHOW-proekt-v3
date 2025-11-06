import { onMounted, onBeforeUnmount } from 'vue'
import { useMobileStore } from '@/stores/mobile'

/**
 * Composable для обработки жеста масштабирования UI элементов в мобильной версии
 * Жест: зажать палец на левом краю экрана и провести вверх
 */
export function useMobileGesture() {
  const mobileStore = useMobileStore()

  // Настройки жеста
  const EDGE_THRESHOLD = 50 // Ширина левого края в пикселях для активации жеста
  const MIN_SWIPE_DISTANCE = 30 // Минимальная дистанция свайпа для активации
  const SCALE_SENSITIVITY = 0.002 // Чувствительность масштабирования (масштаб на пиксель)

  let touchStartX = 0
  let touchStartY = 0
  let isGestureActive = false
  let initialScale = 1

  const handleTouchStart = (event) => {
    // Проверяем, что касание началось на левом краю экрана
    const touch = event.touches[0]
    touchStartX = touch.clientX
    touchStartY = touch.clientY

    // Активируем жест только если касание началось на левом краю
    if (touchStartX <= EDGE_THRESHOLD) {
      isGestureActive = true
      initialScale = mobileStore.menuScale
    }
  }

  const handleTouchMove = (event) => {
    if (!isGestureActive) return

    const touch = event.touches[0]
    const deltaY = touchStartY - touch.clientY // Отрицательное значение = движение вверх

    // Проверяем минимальную дистанцию свайпа
    if (Math.abs(deltaY) < MIN_SWIPE_DISTANCE) return

    // Вычисляем новый масштаб
    // Движение вверх (deltaY > 0) увеличивает масштаб
    const scaleDelta = deltaY * SCALE_SENSITIVITY
    const newScale = initialScale + scaleDelta

    // Обновляем масштаб через store (с учетом ограничений 1-1.6)
    mobileStore.setMenuScale(newScale)

    // Предотвращаем стандартное поведение браузера
    event.preventDefault()
  }

  const handleTouchEnd = () => {
    if (isGestureActive) {
      isGestureActive = false
    }
  }

  const handleTouchCancel = () => {
    if (isGestureActive) {
      isGestureActive = false
    }
  }

  onMounted(() => {
    // Добавляем обработчики событий только для touch-устройств
    if ('ontouchstart' in window) {
      document.addEventListener('touchstart', handleTouchStart, { passive: false })
      document.addEventListener('touchmove', handleTouchMove, { passive: false })
      document.addEventListener('touchend', handleTouchEnd)
      document.addEventListener('touchcancel', handleTouchCancel)
    }
  })

  onBeforeUnmount(() => {
    if ('ontouchstart' in window) {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleTouchEnd)
      document.removeEventListener('touchcancel', handleTouchCancel)
    }
  })

  return {
    // Можно вернуть дополнительные методы или состояние при необходимости
  }
}
