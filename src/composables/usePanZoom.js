import { ref, computed, onMounted, onUnmounted, isRef } from 'vue'

export function usePanZoom(canvasElement, options = {}) {
  const scale = ref(1)
  const translateX = ref(0)
  const translateY = ref(0)
  
  const MIN_SCALE = 0.01  // Минимальное уменьшение - 1%
  const MAX_SCALE = 5     // Максимальное увеличение - 500%
  const LOD_THRESHOLD = 0.35       // Порог LOD уровень 1 (35%) — скрываем PV, labels, монетку, красим body
  const LOD_THRESHOLD_DEEP = 0.20  // Порог LOD уровень 2 (20%) — зарезервирован
  const LOD_THRESHOLD_MINIMAL = 0.15 // Порог LOD уровень 3 (15%) — скрываем аватарку
  const LOD_THRESHOLD_ULTRA = 0.10   // Порог LOD уровень 4 (10%) — скрываем цифры, показываем имя

  const PAN_CURSOR_CLASS = 'canvas-container--panning'
  const SPACE_READY_CLASS = 'canvas-container--space-ready'
  const PAN_EXCLUDE_SELECTOR = [
	'.card',
    '.note-window',
    '.card-controls',
    '.card-header',
    '.card-body',
    '.line-group',
    '.line',
    '.line-hitbox',
    '.ui-panel-left',
    '.ui-panel-right',
    '.mobile-toolbar',
    '.mobile-header',
    '[data-prevent-pan]'
  ].join(', ')
	
  const WHEEL_EXCLUDE_SELECTOR = [
    '.partners-panel',
    '.images-panel',
    '.notes-side-panel',
    '.comments-side-panel',
    '.sticker-messages-panel',
    '.sticker-messages',
    '.board-anchors-panel'
  ].join(', ')
	
  let isPanning = false
  let startX = 0
  let startY = 0
  let previousCursor = ''
  const activeTouchPointers = new Map()
  let pinchState = null
  let panPointerId = null
  let panPointerType = null
  let transformFrame = null

  // "Горячие" значения — обновляются при каждом mousemove, НЕ являются Vue ref
  // Во время активного pan/zoom transform пишется напрямую в DOM, минуя Vue refs
  // Vue refs обновляются один раз при завершении действия (syncHotToRefs)
  let hotTranslateX = 0
  let hotTranslateY = 0
  let hotScale = 1
  let isHotMode = false
  let wheelSyncTimer = null
  let currentLodActive = false       // Текущее состояние LOD-класса на DOM
  let currentLodDeepActive = false   // LOD уровень 2
  let currentLodMinimalActive = false // LOD уровень 3
  let currentLodUltraActive = false  // LOD уровень 4

  // Состояние для панорамирования через Space + левая кнопка мыши
  let isSpaceDown = false
  let spaceStartedPan = false

  // Проверка условий для запуска панорамирования мышью (общая для middle и Space+LMB)
  const canStartMousePan = (event) => {
    if (!canvasElement.value) {
      return false
    }

    // Проверяем, что клик внутри canvas-элемента
    if (!canvasElement.value.contains(event.target)) {
      return false
    }

    // Отключаем панорамирование в режиме размещения стикера
    if (canvasElement.value.classList.contains('canvas-container--sticker-placement')) {
      return false
    }

    // Проверяем, что клик не на исключенных элементах
    const target = event?.target
    if (target && typeof target.closest === 'function' && PAN_EXCLUDE_SELECTOR && target.closest(PAN_EXCLUDE_SELECTOR)) {
      return false
    }

    return true
  }

  const canStartTouchPan = (event) => {
    if (!canvasElement.value) {
      return false
    }

    // Проверяем опцию canPan (функция или ref)
    // Если canPan вернул false — блокируем pan для одного пальца
    // ⚠️ ВАЖНО: Эта проверка применяется ТОЛЬКО для одного пальца!
    // Pinch-zoom (два пальца) работает ВСЕГДА, независимо от canPan
    if (options.canPan !== undefined) {
      const canPanValue = typeof options.canPan === 'function'
        ? options.canPan()
        : (isRef(options.canPan) ? options.canPan.value : options.canPan)
      if (!canPanValue) {
        return false
      }
    }

    const target = event?.target
    if (!target || typeof target.closest !== 'function') {
      return false
    }

    if (!canvasElement.value.contains(target)) {
      return false
    }

    if (PAN_EXCLUDE_SELECTOR && target.closest(PAN_EXCLUDE_SELECTOR)) {
      return false
    }

    return true
  }

  const enterHotMode = () => {
    if (isHotMode) return
    hotTranslateX = translateX.value
    hotTranslateY = translateY.value
    hotScale = scale.value
    isHotMode = true
  }

  const syncHotToRefs = () => {
    scale.value = hotScale
    translateX.value = hotTranslateX
    translateY.value = hotTranslateY
    isHotMode = false
  }

  const startPan = (event) => {
    if (!canvasElement.value) {
      return
    }

    enterHotMode()

    isPanning = true
    panPointerId = event.pointerId
    panPointerType = event.pointerType
    startX = event.clientX - hotTranslateX
    startY = event.clientY - hotTranslateY

    canvasElement.value.classList.add(PAN_CURSOR_CLASS)
    if (event.pointerType !== 'touch') {
      setBodyCursor('grabbing')
    }
  }

  const stopPanning = () => {
    if (!isPanning) {
      return
    }

    const wasTouch = panPointerType === 'touch'

    isPanning = false
    panPointerId = null
    panPointerType = null

    // Синхронизируем горячие значения в Vue refs при завершении pan
    if (isHotMode) {
      syncHotToRefs()
    }

    if (canvasElement.value) {
      canvasElement.value.classList.remove(PAN_CURSOR_CLASS)
    }

    if (!wasTouch) {
      setBodyCursor()
    }
  }
  const applyTransformStyles = () => {
    if (!canvasElement.value) {
      return
    }

    const canvasContent = canvasElement.value.querySelector('.canvas-content')
    if (!canvasContent) return

    const tx = isHotMode ? hotTranslateX : translateX.value
    const ty = isHotMode ? hotTranslateY : translateY.value
    const s = isHotMode ? hotScale : scale.value

    canvasContent.style.transform = `translate(${tx}px, ${ty}px) scale(${s})`

    // Прямое обновление отображения масштаба в DOM во время hot mode
    if (isHotMode) {
      const zoomValueEl = document.querySelector('.zoom-floating-button__value')
      if (zoomValueEl) {
        zoomValueEl.textContent = `${Math.round(s * 100)}%`
      }
      const mobileZoomEl = document.querySelector('[data-zoom-display]')
      if (mobileZoomEl) {
        mobileZoomEl.textContent = String(Math.round(s * 100))
      }
    }

    // LOD: добавить/убрать классы на canvas-container в зависимости от масштаба
    const shouldLod = s < LOD_THRESHOLD
    const shouldLodDeep = s < LOD_THRESHOLD_DEEP
    const shouldLodMinimal = s < LOD_THRESHOLD_MINIMAL

    if (shouldLod !== currentLodActive) {
      currentLodActive = shouldLod
      canvasElement.value.classList.toggle('canvas-container--lod', shouldLod)
    }
    if (shouldLodDeep !== currentLodDeepActive) {
      currentLodDeepActive = shouldLodDeep
      canvasElement.value.classList.toggle('canvas-container--lod-deep', shouldLodDeep)
    }
    if (shouldLodMinimal !== currentLodMinimalActive) {
      currentLodMinimalActive = shouldLodMinimal
      canvasElement.value.classList.toggle('canvas-container--lod-minimal', shouldLodMinimal)
    }

    const shouldLodUltra = s < LOD_THRESHOLD_ULTRA
    if (shouldLodUltra !== currentLodUltraActive) {
      currentLodUltraActive = shouldLodUltra
      canvasElement.value.classList.toggle('canvas-container--lod-ultra', shouldLodUltra)
    }
  }

  const setBodyCursor = (value) => {
    if (!document?.body) {
      return
    }

    if (value) {
      if (!previousCursor) {
        previousCursor = document.body.style.cursor || ''
      }
      document.body.style.cursor = value
      return
    }

    document.body.style.cursor = previousCursor || ''
    previousCursor = ''
  }
  
  const updateTransform = () => {
    if (transformFrame !== null) {
      return
    }

    transformFrame = requestAnimationFrame(() => {
      transformFrame = null
      applyTransformStyles()
    })    
  }
  
  const clampScale = (value) => {
    if (!Number.isFinite(value)) {
      return scale.value
    }
    return Math.max(MIN_SCALE, Math.min(MAX_SCALE, value))
  }

  const setScale = (value) => {
    const clamped = clampScale(value)
    scale.value = clamped
    hotScale = clamped
    updateTransform()
  }

  const setTranslation = (x, y) => {
    if (Number.isFinite(x)) { translateX.value = x; hotTranslateX = x }
    if (Number.isFinite(y)) { translateY.value = y; hotTranslateY = y }
    updateTransform()
  }

  const setTransform = ({ scale: nextScale, translateX: nextTx, translateY: nextTy } = {}) => {
    if (Number.isFinite(nextScale)) {
      const clamped = clampScale(nextScale)
      scale.value = clamped
      hotScale = clamped
    }
    if (Number.isFinite(nextTx)) { translateX.value = nextTx; hotTranslateX = nextTx }
    if (Number.isFinite(nextTy)) { translateY.value = nextTy; hotTranslateY = nextTy }
    updateTransform()
  }

  const resetTransform = () => {
    scale.value = 1; hotScale = 1
    translateX.value = 0; hotTranslateX = 0
    translateY.value = 0; hotTranslateY = 0
    updateTransform()
  }

  const hasScrollableParent = (element) => {
    if (typeof window === 'undefined' || !element) {
      return false
    }

    let current = element

    while (current && current !== document.body) {
      if (canvasElement.value && current === canvasElement.value) {
        break
      }

      const style = window.getComputedStyle(current)
      const overflowY = style?.overflowY || style?.overflow
      const overflow = style?.overflow
      const canScroll = current.scrollHeight > current.clientHeight

      if (
        canScroll &&
        [overflowY, overflow].some(value => value === 'auto' || value === 'scroll')
      ) {
        return true
      }

      current = current.parentElement
    }

    return false
  }

  const shouldIgnoreWheel = (target) => {
    if (!target || typeof target.closest !== 'function') {
      return false
    }

    if (target.closest(WHEEL_EXCLUDE_SELECTOR)) {
      return true
    }

    if (target.closest('.note-window')) {
      return true
    }

    return hasScrollableParent(target)
  }
	
  const handleWheel = (event) => {
    if (!canvasElement.value) return


    if (event.ctrlKey) {
      return
    }

    // Игнорируем если wheel над панелями или в области заметки
    if (
      event.target.closest('.ui-panel-left') ||
      event.target.closest('.ui-panel-right') ||
      shouldIgnoreWheel(event.target)
	) {
      return
    }

    event.preventDefault()

    enterHotMode()

    // ИСПРАВЛЕНО: Изменен коэффициент с 0.0005 на 0.0001 для плавного масштабирования ±1%
    const delta = -event.deltaY * 0.0001
    const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, hotScale + delta))

    // Зум относительно позиции мыши
    const rect = canvasElement.value.getBoundingClientRect()
    const mouseX = event.clientX - rect.left
    const mouseY = event.clientY - rect.top

    const scaleRatio = newScale / hotScale

    hotTranslateX = mouseX - (mouseX - hotTranslateX) * scaleRatio
    hotTranslateY = mouseY - (mouseY - hotTranslateY) * scaleRatio
    hotScale = newScale

    updateTransform()

    // Debounce синхронизация — если колёсико перестали крутить, через 150мс синхронизируем refs
    clearTimeout(wheelSyncTimer)
    wheelSyncTimer = setTimeout(() => {
      if (isHotMode && !isPanning) {
        syncHotToRefs()
      }
    }, 150)
  }
  const updatePinchState = () => {
    if (!canvasElement.value || activeTouchPointers.size !== 2) {
      pinchState = null
      return
    }

    const pointers = Array.from(activeTouchPointers.values())
    const [first, second] = pointers
    const dx = first.x - second.x
    const dy = first.y - second.y
    const distance = Math.hypot(dx, dy)

    if (distance === 0) {
      pinchState = null
      return
    }

    enterHotMode()

    const rect = canvasElement.value.getBoundingClientRect()
    const centerClientX = (first.x + second.x) / 2
    const centerClientY = (first.y + second.y) / 2
    const centerX = centerClientX - rect.left
    const centerY = centerClientY - rect.top

    const currentScale = hotScale
    const contentCenterX = (centerX - hotTranslateX) / currentScale
    const contentCenterY = (centerY - hotTranslateY) / currentScale

    pinchState = {
      initialDistance: distance,
      initialScale: currentScale,
      initialTranslateX: hotTranslateX,
      initialTranslateY: hotTranslateY,
      contentCenterX,
      contentCenterY,
      centerStartX: centerX,
      centerStartY: centerY
    }
  }

  const applyPinchTransform = () => {
    if (!canvasElement.value || !pinchState || activeTouchPointers.size !== 2) {
      return
    }

    const pointers = Array.from(activeTouchPointers.values())
    const [first, second] = pointers
    const dx = first.x - second.x
    const dy = first.y - second.y
    const distance = Math.hypot(dx, dy)

    if (distance === 0 || !Number.isFinite(distance)) {
      return
    }

    const distanceRatio = distance / pinchState.initialDistance
    const nextScale = clampScale(pinchState.initialScale * distanceRatio)

    const rect = canvasElement.value.getBoundingClientRect()
    const centerClientX = (first.x + second.x) / 2
    const centerClientY = (first.y + second.y) / 2
    const centerX = centerClientX - rect.left
    const centerY = centerClientY - rect.top

    const nextTranslateX = centerX - pinchState.contentCenterX * nextScale
    const nextTranslateY = centerY - pinchState.contentCenterY * nextScale

    hotScale = nextScale
    hotTranslateX = nextTranslateX
    hotTranslateY = nextTranslateY

    pinchState = {
      ...pinchState,
      initialDistance: distance,
      initialScale: nextScale,
      initialTranslateX: nextTranslateX,
      initialTranslateY: nextTranslateY,
      centerStartX: centerX,
      centerStartY: centerY,
      contentCenterX: (centerX - nextTranslateX) / nextScale,
      contentCenterY: (centerY - nextTranslateY) / nextScale
    }
    updateTransform()
  }

  // Обработчик нажатия клавиши Space
  const handleKeyDown = (event) => {
    // Игнорируем, если фокус на поле ввода
    const target = event.target
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    ) {
      return
    }

    if (event.code === 'Space' && !isSpaceDown) {
      event.preventDefault() // Блокируем прокрутку страницы
      isSpaceDown = true
      // Добавляем класс для курсора "grab"
      if (canvasElement.value) {
        canvasElement.value.classList.add(SPACE_READY_CLASS)
      }
    }
  }

  // Обработчик отпускания клавиши Space
  const handleKeyUp = (event) => {
    if (event.code === 'Space') {
      isSpaceDown = false
      // Убираем класс курсора
      if (canvasElement.value) {
        canvasElement.value.classList.remove(SPACE_READY_CLASS)
      }
      // Останавливаем панорамирование, если было запущено через Space
      if (spaceStartedPan) {
        stopPanning()
        spaceStartedPan = false
      }
    }
  }
  
  const handlePointerDown = (event) => {
    if (!canvasElement.value) return

    if (event.pointerType === 'touch') {
      if (!canvasElement.value.contains(event.target)) {
        return
      }
	  
      // Отключаем панорамирование, если активен режим размещения стикера
      if (canvasElement.value.classList.contains('canvas-container--sticker-placement')) {
        return
      }
 	  
	  
      activeTouchPointers.set(event.pointerId, { x: event.clientX, y: event.clientY })

      // ✅ ИСПРАВЛЕНИЕ: Для ОДНОГО пальца проверяем canPan
      if (activeTouchPointers.size === 1) {
        // Вызываем callback при любом одиночном touch на canvas
        if (options.onTouchStart) {
          options.onTouchStart(event)
        }
        // Проверяем canPan ТОЛЬКО для одного пальца
        if (canStartTouchPan(event)) {
          // Вызываем callback при touch на пустом месте (для снятия выделения)
          if (options.onEmptyTouchStart) {
            options.onEmptyTouchStart(event)
          }
          event.preventDefault()
          startPan(event)
        }
        return
      }

      // ✅ ИСПРАВЛЕНИЕ: Для ДВУХ и более пальцев — ВСЕГДА разрешаем pinch
      // НЕ проверяем canPan для многопальцевых жестов
      if (activeTouchPointers.size >= 3) {
        if (isPanning && panPointerType === 'touch') {
          stopPanning()
        }
        pinchState = null
        return
      }

      // Два пальца — обрабатываем pinch
      if (isPanning && panPointerType === 'touch') {
        stopPanning()
      }
  
      updatePinchState()
      event.preventDefault()    
      return
    }
    // Панорамирование по средней кнопке мыши (колесико) — fallback
    // button === 1 - средняя кнопка мыши
    if (event.button === 1 && event.pointerType !== 'touch') {
      if (!canStartMousePan(event)) {
        return
      }

      // Предотвращаем стандартное поведение браузера (автоскролл)
      event.preventDefault()
      event.stopPropagation()

      // Запускаем режим панорамирования
      startPan(event)
      return
    }

    // Панорамирование через Space + левая кнопка мыши
    if (event.pointerType !== 'touch' && event.button === 0 && isSpaceDown) {
      if (!canStartMousePan(event)) {
        return
      }

      event.preventDefault()
      event.stopPropagation()

      startPan(event)
      spaceStartedPan = true
    }
  }
  
  const handlePointerMove = (event) => {
    if (event.pointerType === 'touch') {
      if (!activeTouchPointers.has(event.pointerId)) {
        return
      }
      activeTouchPointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
       if (activeTouchPointers.size >= 3) {
        if (isPanning && panPointerType === 'touch' && panPointerId === event.pointerId) {
          stopPanning()
        }
        pinchState = null
        return
      }     
      if (activeTouchPointers.size >= 2) {
        event.preventDefault()
        if (!pinchState) {
          updatePinchState()
        }
        applyPinchTransform()
        return
      }

      if (isPanning && panPointerType === 'touch' && panPointerId === event.pointerId) {
        event.preventDefault()
        hotTranslateX = event.clientX - startX
        hotTranslateY = event.clientY - startY
        updateTransform()
      }
      return
    }
    if (!isPanning || panPointerId !== event.pointerId) return

    event.preventDefault()
    hotTranslateX = event.clientX - startX
    hotTranslateY = event.clientY - startY
    updateTransform()
  }
  
  const handlePointerUp = (event) => {
    if (event.pointerType === 'touch') {
      activeTouchPointers.delete(event.pointerId)
      if (isPanning && panPointerType === 'touch' && panPointerId === event.pointerId) {
        stopPanning()
      }
      if (activeTouchPointers.size < 2) {
        pinchState = null
        // Синхронизируем горячие значения при завершении pinch
        if (isHotMode && !isPanning) {
          syncHotToRefs()
        }
      } else {
        updatePinchState()
      }
      return
    }

    // При отпускании левой кнопки мыши — останавливаем панорамирование Space+LMB
    if (event.pointerType !== 'touch' && event.button === 0 && spaceStartedPan) {
      stopPanning()
      spaceStartedPan = false
      return
    }

    if (isPanning && panPointerId === event.pointerId) {
      stopPanning()
    }
  }

  // Предотвращаем стандартное поведение средней кнопки мыши (автоскролл)
  const handleMouseDown = (event) => {
    if (event.button === 1) {
      event.preventDefault()
      event.stopPropagation()
    }
  }

  const handleAuxClick = (event) => {
    if (event.button === 1) {
      event.preventDefault()
      event.stopPropagation()
    }
  }

  // Предотвращаем контекстное меню при панорамировании
  const handleContextMenu = (event) => {
    // Блокируем контекстное меню при панорамировании (средняя кнопка или Space+LMB)
    if (isPanning || spaceStartedPan) {
      event.preventDefault()
    }
  }
	
  onMounted(() => {
    if (!canvasElement.value) return

    window.addEventListener('wheel', handleWheel, { passive: false })
    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)
    window.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('auxclick', handleAuxClick)
    window.addEventListener('contextmenu', handleContextMenu)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    updateTransform()
  })
  
  onUnmounted(() => {
    window.removeEventListener('wheel', handleWheel)
    window.removeEventListener('pointerdown', handlePointerDown)
    window.removeEventListener('pointermove', handlePointerMove)
    window.removeEventListener('pointerup', handlePointerUp)
    window.removeEventListener('pointercancel', handlePointerUp)
    window.removeEventListener('mousedown', handleMouseDown)
    window.removeEventListener('auxclick', handleAuxClick)
    window.removeEventListener('contextmenu', handleContextMenu)
    window.removeEventListener('keydown', handleKeyDown)
    window.removeEventListener('keyup', handleKeyUp)
    setBodyCursor()
    clearTimeout(wheelSyncTimer)
    if (canvasElement.value) {
      canvasElement.value.classList.remove(PAN_CURSOR_CLASS)
      canvasElement.value.classList.remove(SPACE_READY_CLASS)
      canvasElement.value.classList.remove('canvas-container--lod')
      canvasElement.value.classList.remove('canvas-container--lod-deep')
      canvasElement.value.classList.remove('canvas-container--lod-minimal')
      canvasElement.value.classList.remove('canvas-container--lod-ultra')
    }
    if (transformFrame !== null) {
      cancelAnimationFrame(transformFrame)
      transformFrame = null
    }
  })
  
  return {
    scale,
    translateX,
    translateY,
    clampScale,
    setScale,
    setTranslation,
    setTransform,
    resetTransform,
    minScale: MIN_SCALE,
    maxScale: MAX_SCALE,
    isInteracting: computed(() => isHotMode)
  }
}
