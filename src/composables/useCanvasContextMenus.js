/**
 * Composable для управления контекстными меню на холсте
 * Обрабатывает контекстные меню для изображений и других объектов
 */

import { ref, watch, onBeforeUnmount } from 'vue'

/**
 * @typedef {Object} UseCanvasContextMenusOptions
 * @property {Object} imagesStore - Pinia store для изображений
 * @property {Function} screenToCanvas - Функция конвертации координат экрана в canvas
 * @property {Function} getObjectAtPoint - Функция поиска объекта в точке
 * @property {Function} clearObjectSelections - Функция очистки выделения объектов
 * @property {Function} closeAvatarContextMenu - Функция закрытия контекстного меню аватара
 */

/**
 * Composable для управления контекстными меню
 * @param {UseCanvasContextMenusOptions} options
 */
export function useCanvasContextMenus(options) {
  const {
    imagesStore,
    screenToCanvas,
    getObjectAtPoint,
    clearObjectSelections,
    closeAvatarContextMenu
  } = options

  // === Refs ===

  // Контекстное меню для изображения
  const imageContextMenu = ref(null) // { imageId }
  const imageContextMenuPosition = ref({ x: 0, y: 0 })

  // === Основные функции ===

  /**
   * Закрытие контекстного меню изображения
   */
  const closeImageContextMenu = () => {
    imageContextMenu.value = null
  }

  /**
   * Обработчик клика вне контекстного меню для его закрытия
   * @param {Event} event - Событие клика
   */
  const handleClickOutsideContextMenu = (event) => {
    // Проверяем, что клик был вне контекстного меню
    const contextMenuElement = document.querySelector('.context-menu')
    if (contextMenuElement && !contextMenuElement.contains(event.target)) {
      closeImageContextMenu()
    }
  }

  /**
   * Обработчик правого клика на изображении для открытия контекстного меню
   * @param {Event} event - Событие контекстного меню
   * @param {string} imageId - ID изображения
   */
  const handleImageContextMenu = (event, imageId) => {
    event.preventDefault()
    event.stopPropagation()

    // Закрываем другие контекстные меню
    closeAvatarContextMenu()
    closeImageContextMenu()

    // Выделяем изображение, если оно еще не выделено
    if (!imagesStore.selectedImageIds.includes(imageId)) {
      clearObjectSelections()
      imagesStore.selectImage(imageId)
    }

    // Открываем контекстное меню для изображения
    const image = imagesStore.images.find(img => img.id === imageId)
    if (image) {
      imageContextMenu.value = { imageId }
      imageContextMenuPosition.value = {
        x: event.clientX,
        y: event.clientY
      }
    }
  }

  /**
   * Обработчик правого клика на canvas для изображений на заднем плане
   * @param {Event} event - Событие контекстного меню
   */
  const handleStageContextMenu = (event) => {
    // Проверяем, есть ли изображение под курсором (даже если оно на заднем плане)
    const canvasPos = screenToCanvas(event.clientX, event.clientY)
    const imageUnderCursor = getObjectAtPoint(canvasPos.x, canvasPos.y)

    // Если найдено изображение под курсором
    if (imageUnderCursor && !imageUnderCursor.isLocked) {
      event.preventDefault()
      event.stopImmediatePropagation()

      // Вызываем обработчик контекстного меню для изображения
      handleImageContextMenu(event, imageUnderCursor.id)
    }
  }

  /**
   * Закрытие всех контекстных меню
   */
  const closeAllContextMenus = () => {
    closeAvatarContextMenu()
    closeImageContextMenu()
  }

  // === Watch ===

  // Watch для добавления/удаления обработчика клика вне меню
  watch(imageContextMenu, (newValue, oldValue) => {
    if (newValue && !oldValue) {
      // Меню открылось - добавляем обработчик с небольшой задержкой,
      // чтобы не закрыть меню сразу при открытии
      setTimeout(() => {
        document.addEventListener('click', handleClickOutsideContextMenu)
        document.addEventListener('pointerdown', handleClickOutsideContextMenu)
      }, 0)
    } else if (!newValue && oldValue) {
      // Меню закрылось - удаляем обработчик
      document.removeEventListener('click', handleClickOutsideContextMenu)
      document.removeEventListener('pointerdown', handleClickOutsideContextMenu)
    }
  })

  // Cleanup при размонтировании
  onBeforeUnmount(() => {
    document.removeEventListener('click', handleClickOutsideContextMenu)
    document.removeEventListener('pointerdown', handleClickOutsideContextMenu)
  })

  // === Возвращаемые значения ===
  return {
    // Refs
    imageContextMenu,
    imageContextMenuPosition,

    // Функции
    handleImageContextMenu,
    handleStageContextMenu,
    handleClickOutsideContextMenu,
    closeImageContextMenu,
    closeAllContextMenus
  }
}
