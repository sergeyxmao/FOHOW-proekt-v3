import { ref, computed, watch } from 'vue'

/**
 * Composable для рендеринга изображений на Canvas
 * Включает кэширование, lazy rendering и виртуализацию
 */
export function useCanvasImageRenderer(options) {
  const {
    imagesStore,
    imagesCanvasRef,
    zoomScale,
    zoomTranslateX,
    zoomTranslateY,
    canvasContainerRef,
    screenToCanvas,
    stageConfig,
    images
  } = options

  // === Константы ===
  const IMAGE_CACHE_LIMIT = 120
  const OFFSCREEN_CACHE_LIMIT = 80
  const IMAGE_VIRTUALIZATION_OVERSCAN = 800

  // === LRU Cache ===
  const createLruCache = (limit) => {
    const map = new Map()

    const touch = (key, value) => {
      map.delete(key)
      map.set(key, value)
    }

    return {
      get(key) {
        const value = map.get(key)
        if (value !== undefined) {
          touch(key, value)
        }
        return value
      },
      set(key, value) {
        touch(key, value)
        if (map.size > limit) {
          const oldestKey = map.keys().next().value
          map.delete(oldestKey)
        }
      },
      delete(key) {
        return map.delete(key)
      },
      clear() {
        map.clear()
      }
    }
  }

  // === State ===
  const imageCache = createLruCache(IMAGE_CACHE_LIMIT) // key: dataUrl, value: { img: HTMLImageElement, loading: Promise, error: boolean }
  const offscreenCache = createLruCache(OFFSCREEN_CACHE_LIMIT) // key: imageId, value: offscreenCanvas
  const imageVersions = new Map() // key: imageId, value: version string

  // Оптимизация производительности: Lazy rendering с requestAnimationFrame
  let needsRedraw = false
  let renderScheduled = false

  // === Вспомогательные функции ===

  /**
   * Получение версии изображения для проверки изменений
   * @param {Object} imageObj - Объект изображения
   * @param {string} source - Источник изображения ('primary' или 'preview')
   * @returns {string} - Версия изображения
   */
  const getImageVersion = (imageObj, source = 'primary') => {
    const dataUrl = typeof imageObj.dataUrl === 'string' ? imageObj.dataUrl : ''
    return `${imageObj.x}-${imageObj.y}-${imageObj.width}-${imageObj.height}-${imageObj.rotation || 0}-${imageObj.opacity || 1}-${dataUrl.substring(0, 50)}-${source}`
  }

  /**
   * Инвалидация кэша изображения при изменении
   * @param {string} imageId - ID изображения
   */
  const invalidateImageCache = (imageId) => {
    offscreenCache.delete(imageId)
    console.log('🔄 Кэш изображения инвалидирован:', imageId)
  }

  /**
   * Создание оффскрин canvas для изображения
   * @param {Object} imageObj - Объект изображения
   * @param {HTMLImageElement} img - Загруженное изображение
   * @returns {HTMLCanvasElement} - Offscreen canvas с отрисованным изображением
   */
  const createOffscreenCanvas = (imageObj, img) => {
    const offscreenCanvas = document.createElement('canvas')
    offscreenCanvas.width = imageObj.width
    offscreenCanvas.height = imageObj.height

    const ctx = offscreenCanvas.getContext('2d', { alpha: true, willReadFrequently: false })

    if (!ctx) {
      return null
    }

    ctx.save()

    // Переместить точку отсчета в центр
    ctx.translate(offscreenCanvas.width / 2, offscreenCanvas.height / 2)

    // Применить поворот
    ctx.rotate((imageObj.rotation || 0) * Math.PI / 180)

    // Применить прозрачность
    ctx.globalAlpha = imageObj.opacity !== undefined ? imageObj.opacity : 1

    // Нарисовать изображение
    ctx.drawImage(
      img,
      -offscreenCanvas.width / 2,
      -offscreenCanvas.height / 2,
      offscreenCanvas.width,
      offscreenCanvas.height
    )

    ctx.restore()

    return offscreenCanvas
  }

  /**
   * Загрузка и кэширование изображения
   * @param {string} dataUrl - URL изображения
   * @returns {Promise<HTMLImageElement>}
   */
  const loadImage = (dataUrl) => {
    if (!dataUrl) {
      return Promise.reject(new Error('Empty image url'))
    }
    const cached = imageCache.get(dataUrl)

    if (cached) {
      if (cached.img && !cached.error) {
        return Promise.resolve(cached.img)
      }

      if (cached.loading) {
        return cached.loading
      }

      if (cached.error) {
        imageCache.delete(dataUrl)
      }
    }

    const loadingPromise = new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'

      img.onload = () => {
        imageCache.set(dataUrl, { img, loading: null, error: false })
        console.log('✅ Изображение загружено:', dataUrl.substring(0, 50) + '...')
        resolve(img)
      }

      img.onerror = (error) => {
        imageCache.set(dataUrl, { img: null, loading: null, error: true })
        console.error('❌ Ошибка загрузки изображения:', error)
        reject(new Error('Failed to load image'))
      }

      img.src = dataUrl
    })

    imageCache.set(dataUrl, { img: null, loading: loadingPromise, error: false })

    return loadingPromise
  }

  /**
   * Получение изображения для рендеринга (с приоритетом preview)
   */
  const getRenderableImage = async (imageObj) => {
    const primaryUrl = imageObj.dataUrl
    const previewUrl = imageObj.previewDataUrl && imageObj.previewDataUrl !== primaryUrl
      ? imageObj.previewDataUrl
      : null

    const cachedPrimary = primaryUrl ? imageCache.get(primaryUrl) : null
    if (cachedPrimary?.img && !cachedPrimary.error) {
      return { img: cachedPrimary.img, source: 'primary' }
    }

    const cachedPreview = previewUrl ? imageCache.get(previewUrl) : null
    if (cachedPreview?.img && !cachedPreview.error) {
      if (primaryUrl && (!cachedPrimary || cachedPrimary.error || cachedPrimary.loading)) {
        loadImage(primaryUrl)
          .then(() => scheduleRender())
          .catch(() => {})
      }
      return { img: cachedPreview.img, source: 'preview' }
    }

    if (previewUrl) {
      try {
        const previewImg = await loadImage(previewUrl)
        if (primaryUrl) {
          loadImage(primaryUrl)
            .then(() => scheduleRender())
            .catch(() => {})
        }
        return { img: previewImg, source: 'preview' }
      } catch (error) {
        console.warn('⚠️ Не удалось загрузить превью, используем основной URL', error)
      }
    }

    const img = await loadImage(primaryUrl)
    return { img, source: 'primary' }
  }

  // === Функции отрисовки ===

  /**
   * Отрисовка одного изображения на canvas с использованием оффскрин кэширования
   */
  const drawImageObject = async (ctx, imageObj) => {
    try {
      const { img, source } = await getRenderableImage(imageObj)
      const currentVersion = getImageVersion(imageObj, source)
      const cachedVersion = imageVersions.get(imageObj.id)

      let offscreenCanvas = null

      // Проверяем, нужно ли обновить кэш
      if (cachedVersion !== currentVersion) {
        // Версия изменилась - создаем новый offscreen canvas
        offscreenCanvas = createOffscreenCanvas(imageObj, img)

        if (offscreenCanvas) {
          offscreenCache.set(imageObj.id, offscreenCanvas)
          imageVersions.set(imageObj.id, currentVersion)
          console.log('✨ Создан offscreen кэш для изображения:', imageObj.id)
        }
      } else {
        // Версия не изменилась - используем кэш
        offscreenCanvas = offscreenCache.get(imageObj.id)
      }

      ctx.save()

      // Если есть offscreen canvas, копируем из него
      if (offscreenCanvas) {
        ctx.drawImage(
          offscreenCanvas,
          imageObj.x,
          imageObj.y,
          imageObj.width,
          imageObj.height
        )
      } else {
        // Fallback: рисуем напрямую без кэша (для старых браузеров или ошибок)
        ctx.translate(
          imageObj.x + imageObj.width / 2,
          imageObj.y + imageObj.height / 2
        )

        ctx.rotate((imageObj.rotation || 0) * Math.PI / 180)
        ctx.globalAlpha = imageObj.opacity !== undefined ? imageObj.opacity : 1

        ctx.drawImage(
          img,
          -imageObj.width / 2,
          -imageObj.height / 2,
          imageObj.width,
          imageObj.height
        )
      }

      ctx.restore()
    } catch (error) {
      // Отрисовываем placeholder при ошибке
      drawImagePlaceholder(ctx, imageObj)
    }
  }

  /**
   * Отрисовка placeholder для изображения с ошибкой
   */
  const drawImagePlaceholder = (ctx, imageObj) => {
    ctx.save()

    ctx.translate(
      imageObj.x + imageObj.width / 2,
      imageObj.y + imageObj.height / 2
    )

    ctx.rotate((imageObj.rotation || 0) * Math.PI / 180)

    // Рисуем прямоугольник с ошибкой
    ctx.fillStyle = '#f3f4f6'
    ctx.strokeStyle = '#ef4444'
    ctx.lineWidth = 2

    ctx.fillRect(
      -imageObj.width / 2,
      -imageObj.height / 2,
      imageObj.width,
      imageObj.height
    )

    ctx.strokeRect(
      -imageObj.width / 2,
      -imageObj.height / 2,
      imageObj.width,
      imageObj.height
    )

    // Рисуем крестик
    ctx.strokeStyle = '#ef4444'
    ctx.lineWidth = 3
    ctx.beginPath()

    const iconSize = Math.min(imageObj.width, imageObj.height) * 0.3
    ctx.moveTo(-iconSize / 2, -iconSize / 2)
    ctx.lineTo(iconSize / 2, iconSize / 2)
    ctx.moveTo(iconSize / 2, -iconSize / 2)
    ctx.lineTo(-iconSize / 2, iconSize / 2)

    ctx.stroke()

    // Добавляем текст "Error"
    ctx.fillStyle = '#ef4444'
    ctx.font = '14px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('Error', 0, iconSize / 2 + 20)

    ctx.restore()
  }

  /**
   * Отрисовка рамки выделения для изображения
   */
  const drawSelectionBorder = (ctx, imageObj) => {
    ctx.save()

    // Переместить точку отсчета в центр изображения
    ctx.translate(
      imageObj.x + imageObj.width / 2,
      imageObj.y + imageObj.height / 2
    )

    // Применить поворот
    ctx.rotate((imageObj.rotation || 0) * Math.PI / 180)

    // Рисуем рамку выделения
    ctx.strokeStyle = '#007bff' // Синий цвет
    ctx.lineWidth = 2
    ctx.strokeRect(
      -imageObj.width / 2,
      -imageObj.height / 2,
      imageObj.width,
      imageObj.height
    )

    ctx.restore()
  }

  /**
   * Отрисовка ручек изменения размера
   */
  const drawResizeHandles = (ctx, imageObj) => {
    ctx.save()

    // Переместить точку отсчета в центр изображения
    ctx.translate(
      imageObj.x + imageObj.width / 2,
      imageObj.y + imageObj.height / 2
    )

    // Применить поворот
    ctx.rotate((imageObj.rotation || 0) * Math.PI / 180)

    const halfWidth = imageObj.width / 2
    const halfHeight = imageObj.height / 2
    const handleSize = 8
    const halfHandleSize = handleSize / 2

    // Позиции 8 ручек (относительно центра изображения)
    const handles = [
      // 4 угла
      { x: -halfWidth, y: -halfHeight },           // Верхний левый
      { x: halfWidth, y: -halfHeight },            // Верхний правый
      { x: halfWidth, y: halfHeight },             // Нижний правый
      { x: -halfWidth, y: halfHeight },            // Нижний левый
      // 4 середины сторон
      { x: 0, y: -halfHeight },                    // Середина верха
      { x: 0, y: halfHeight },                     // Середина низа
      { x: -halfWidth, y: 0 },                     // Середина слева
      { x: halfWidth, y: 0 }                       // Середина справа
    ]

    // Рисуем каждую ручку
    handles.forEach(handle => {
      // Белый квадрат
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(
        handle.x - halfHandleSize,
        handle.y - halfHandleSize,
        handleSize,
        handleSize
      )

      // Синяя обводка
      ctx.strokeStyle = '#007bff'
      ctx.lineWidth = 2
      ctx.strokeRect(
        handle.x - halfHandleSize,
        handle.y - halfHandleSize,
        handleSize,
        handleSize
      )
    })

    ctx.restore()
  }

  /**
   * Отрисовка ручки поворота
   */
  const drawRotationHandle = (ctx, imageObj) => {
    ctx.save()

    // Переместить точку отсчета в центр изображения
    ctx.translate(
      imageObj.x + imageObj.width / 2,
      imageObj.y + imageObj.height / 2
    )

    // Применить поворот
    ctx.rotate((imageObj.rotation || 0) * Math.PI / 180)

    const halfHeight = imageObj.height / 2
    const handleDistance = 20 // Расстояние от верхней стороны
    const handleRadius = 5 // Радиус круга (диаметр 10px)

    // Позиция ручки поворота (над центром верхней стороны)
    const handleX = 0
    const handleY = -halfHeight - handleDistance

    // Рисуем линию, соединяющую ручку с верхней стороной
    ctx.strokeStyle = '#007bff'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(0, -halfHeight)
    ctx.lineTo(handleX, handleY)
    ctx.stroke()

    // Рисуем круг (ручка поворота)
    // Белый круг
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(handleX, handleY, handleRadius, 0, 2 * Math.PI)
    ctx.fill()

    // Синяя обводка
    ctx.strokeStyle = '#007bff'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(handleX, handleY, handleRadius, 0, 2 * Math.PI)
    ctx.stroke()

    ctx.restore()
  }

  /**
   * Отрисовка серой рамки для заблокированного объекта
   */
  const drawLockedBorder = (ctx, imageObj) => {
    ctx.save()

    // Переместить точку отсчета в центр изображения
    ctx.translate(
      imageObj.x + imageObj.width / 2,
      imageObj.y + imageObj.height / 2
    )

    // Применить поворот
    ctx.rotate((imageObj.rotation || 0) * Math.PI / 180)

    // Рисуем серую рамку для заблокированного объекта
    ctx.strokeStyle = '#808080' // Серый цвет
    ctx.lineWidth = 2
    ctx.strokeRect(
      -imageObj.width / 2,
      -imageObj.height / 2,
      imageObj.width,
      imageObj.height
    )

    ctx.restore()
  }

  /**
   * Отрисовка иконки замка для заблокированного объекта
   */
  const drawLockIcon = (ctx, imageObj) => {
    ctx.save()

    // Переместить точку отсчета в центр изображения
    ctx.translate(
      imageObj.x + imageObj.width / 2,
      imageObj.y + imageObj.height / 2
    )

    // Применить поворот
    ctx.rotate((imageObj.rotation || 0) * Math.PI / 180)

    // Позиция иконки замка в правом верхнем углу
    const iconX = imageObj.width / 2 - 20 // 20px от правого края
    const iconY = -imageObj.height / 2 + 5 // 5px от верхнего края
    const iconSize = 16

    // Рисуем фон для иконки (полупрозрачный белый)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
    ctx.fillRect(iconX - 2, iconY - 2, iconSize + 4, iconSize + 4)

    // Рисуем рамку вокруг фона
    ctx.strokeStyle = '#808080'
    ctx.lineWidth = 1
    ctx.strokeRect(iconX - 2, iconY - 2, iconSize + 4, iconSize + 4)

    // Рисуем иконку замка
    ctx.fillStyle = '#808080' // Серый цвет
    ctx.strokeStyle = '#808080'
    ctx.lineWidth = 1.5

    // Дужка замка (верхняя часть)
    const lockCenterX = iconX + iconSize / 2
    const lockCenterY = iconY + iconSize / 2
    const lockWidth = iconSize * 0.6
    const lockHeight = iconSize * 0.7
    const shackleHeight = iconSize * 0.35

    ctx.beginPath()
    ctx.arc(
      lockCenterX,
      lockCenterY - lockHeight / 2 + shackleHeight / 2,
      lockWidth / 2,
      Math.PI,
      0,
      false
    )
    ctx.stroke()

    // Тело замка (нижняя часть)
    ctx.fillRect(
      lockCenterX - lockWidth / 2,
      lockCenterY - lockHeight / 2 + shackleHeight,
      lockWidth,
      lockHeight - shackleHeight
    )

    // Замочная скважина
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(
      lockCenterX,
      lockCenterY + shackleHeight / 4,
      iconSize * 0.12,
      0,
      2 * Math.PI
    )
    ctx.fill()

    ctx.restore()
  }

  /**
   * Отрисовка выделения изображения (рамка + ручки)
   */
  const drawImageSelection = (ctx, imageObj) => {
    if (!imageObj.isSelected) {
      return
    }

    // Если объект заблокирован, показываем только серую рамку и иконку замка
    if (imageObj.isLocked) {
      drawLockedBorder(ctx, imageObj)
      drawLockIcon(ctx, imageObj)
      return
    }

    // Обычное выделение с ручками
    drawSelectionBorder(ctx, imageObj)
    drawResizeHandles(ctx, imageObj)
    drawRotationHandle(ctx, imageObj)
  }

  // === Виртуализация ===

  /**
   * Получение видимой области canvas в координатах canvas
   */
  const getVisibleCanvasRect = () => {
    if (!canvasContainerRef.value) {
      return null
    }

    const rect = canvasContainerRef.value.getBoundingClientRect()
    const topLeft = screenToCanvas(rect.left, rect.top)
    const bottomRight = screenToCanvas(rect.right, rect.bottom)
    const overscan = IMAGE_VIRTUALIZATION_OVERSCAN / (zoomScale.value || 1)

    return {
      left: Math.min(topLeft.x, bottomRight.x) - overscan,
      right: Math.max(topLeft.x, bottomRight.x) + overscan,
      top: Math.min(topLeft.y, bottomRight.y) - overscan,
      bottom: Math.max(topLeft.y, bottomRight.y) + overscan
    }
  }

  /**
   * Проверка, находится ли изображение в видимой области
   */
  const isImageWithinViewport = (imageObj, viewportRect) => {
    if (!viewportRect) {
      return true
    }

    const imageLeft = imageObj.x
    const imageRight = imageObj.x + imageObj.width
    const imageTop = imageObj.y
    const imageBottom = imageObj.y + imageObj.height

    return (
      imageRight >= viewportRect.left &&
      imageLeft <= viewportRect.right &&
      imageBottom >= viewportRect.top &&
      imageTop <= viewportRect.bottom
    )
  }

  // === Основные функции рендеринга ===

  /**
   * Рендеринг всех изображений на canvas
   */
  const renderAllImages = async () => {
    if (!imagesCanvasRef.value) {
      return
    }

    const canvas = imagesCanvasRef.value
    const ctx = canvas.getContext('2d', { alpha: true, willReadFrequently: false })

    if (!ctx) {
      return
    }

    // Устанавливаем размеры canvas
    canvas.width = stageConfig.value.width
    canvas.height = stageConfig.value.height

    // Очищаем canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const visibleRect = getVisibleCanvasRect()

    // Сортируем изображения по zIndex (от меньшего к большему)
    const sortedImages = [...images.value].sort((a, b) => {
      const zIndexA = a.zIndex !== undefined ? a.zIndex : 0
      const zIndexB = b.zIndex !== undefined ? b.zIndex : 0
      return zIndexA - zIndexB
    })

    const visibleImages = visibleRect
      ? sortedImages.filter((image) => isImageWithinViewport(image, visibleRect))
      : sortedImages

    // Отрисовываем изображения
    for (const image of visibleImages) {
      await drawImageObject(ctx, image)
    }

    // Отрисовываем выделение поверх всех изображений
    for (const image of visibleImages) {
      drawImageSelection(ctx, image)
    }

    // Сбрасываем флаг перерисовки
    needsRedraw = false
  }

  /**
   * Рендеринг ВСЕХ изображений на canvas для экспорта PNG
   * В отличие от renderAllImages, эта функция не фильтрует по viewport
   * и рендерит абсолютно все изображения
   */
  const renderAllImagesForExport = async (exportBounds) => {
    if (!imagesCanvasRef.value) {
      return
    }

    const canvas = imagesCanvasRef.value
    const ctx = canvas.getContext('2d', { alpha: true, willReadFrequently: false })

    if (!ctx) {
      return
    }

    // Расширяем размеры canvas для экспорта всего контента
    const newWidth = Math.max(stageConfig.value.width, exportBounds?.contentWidth || 0, exportBounds?.maxX || 0)
    const newHeight = Math.max(stageConfig.value.height, exportBounds?.contentHeight || 0, exportBounds?.maxY || 0)

    canvas.width = newWidth
    canvas.height = newHeight

    // Очищаем canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Сортируем изображения по zIndex (от меньшего к большему)
    const sortedImages = [...images.value].sort((a, b) => {
      const zIndexA = a.zIndex !== undefined ? a.zIndex : 0
      const zIndexB = b.zIndex !== undefined ? b.zIndex : 0
      return zIndexA - zIndexB
    })

    // Отрисовываем ВСЕ изображения (без фильтрации по viewport)
    for (const image of sortedImages) {
      await drawImageObject(ctx, image)
    }

    // Не отрисовываем выделение при экспорте
  }

  /**
   * Обработчик события для рендеринга всех изображений при экспорте PNG
   */
  const handlePngExportRenderAllImages = async (event) => {
    const exportBounds = event.detail
    console.log('Получено событие png-export-render-all-images, начинаем рендеринг изображений...', exportBounds)
    await renderAllImagesForExport(exportBounds)
    console.log('Рендеринг изображений завершён, отправляем событие png-export-images-rendered')
    // Отправляем событие о завершении рендеринга
    window.dispatchEvent(new CustomEvent('png-export-images-rendered'))
  }

  /**
   * Обработчик события завершения экспорта PNG - восстанавливает обычный рендеринг
   */
  const handlePngExportRenderComplete = () => {
    // Восстанавливаем размеры canvas
    if (imagesCanvasRef.value) {
      imagesCanvasRef.value.width = stageConfig.value.width
      imagesCanvasRef.value.height = stageConfig.value.height
    }
    // Перерисовываем изображения в viewport режиме
    scheduleRender()
  }

  /**
   * Планирование рендеринга с использованием requestAnimationFrame (Lazy rendering)
   * Гарантирует, что рендеринг будет выполнен только один раз за frame
   */
  const scheduleRender = () => {
    // Устанавливаем флаг необходимости перерисовки
    needsRedraw = true

    // Если рендеринг уже запланирован, не планируем снова
    if (renderScheduled) {
      return
    }

    renderScheduled = true

    // Планируем рендеринг на следующий frame
    requestAnimationFrame(() => {
      renderScheduled = false

      // Проверяем флаг перед рендерингом
      if (needsRedraw) {
        renderAllImages()
      }
    })
  }

  // === Watchers ===

  // Следим за изменениями images и планируем перерисовку
  watch(images, () => {
    scheduleRender()
  }, { deep: true })

  // Следим за изменениями zoom и планируем перерисовку
  watch([zoomScale, zoomTranslateX, zoomTranslateY], () => {
    scheduleRender()
  })

  // Следим за изменениями размеров stage и планируем перерисовку
  watch(stageConfig, () => {
    scheduleRender()
  }, { deep: true })

  return {
    // Кэши (для отладки или внешнего доступа)
    imageCache,
    offscreenCache,

    // Методы для внешнего использования
    invalidateImageCache,
    renderAllImages,
    renderAllImagesForExport,
    scheduleRender,
    handlePngExportRenderAllImages,
    handlePngExportRenderComplete,
    getVisibleCanvasRect,
    isImageWithinViewport
  }
}
