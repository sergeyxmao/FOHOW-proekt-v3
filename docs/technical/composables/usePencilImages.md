# usePencilImages.js

> Управление временными изображениями в PencilOverlay

## Общая информация

| Параметр | Значение |
|----------|----------|
| **Файл** | `src/composables/usePencilImages.js` |
| **Размер** | ~298 строк |
| **Создан** | Декабрь 2025 (рефакторинг PencilOverlay.vue) |
| **Зависимости** | Vue refs, canvas API, utils/placedImages.js |

## Назначение

Этот composable управляет размещением, трансформацией и финализацией временных
изображений на canvas. Изображения можно добавлять через drag-and-drop, перемещать,
масштабировать и поворачивать перед окончательной отрисовкой на canvas.

### Ключевые возможности:
- Размещение изображений через drag-and-drop
- Перемещение и масштабирование изображений
- Поворот изображений (rotation)
- Финализация: отрисовка на canvas и удаление из списка
- Отмена размещения (Escape)
- Минимальный размер изображения: 24×24 px

## API

### Входные параметры

```javascript
usePencilImages({
  canvasContext,        // ref на 2D контекст canvas
  canvasWidth,          // ref<number> - ширина canvas
  canvasHeight,         // ref<number> - высота canvas
  canvasScale,          // ref<number> - масштаб canvas (DPI)
  getCanvasPoint,       // (event) => {x, y} - преобразование координат
  scheduleHistorySave,  // callback для сохранения в историю
})
```

### Возвращаемые значения

```javascript
{
  // Состояние
  placedImages,              // ref<Array> - массив размещённых изображений
  activeImageId,             // ref<string|null> - ID активного изображения
  imageTransformState,       // ref<Object|null> - состояние трансформации

  // Computed
  activePlacedImage,         // computed<Object|null> - активное изображение

  // Константы
  TEMP_IMAGE_MIN_SIZE,       // 24 px

  // Методы
  ensureImageElement,        // (src) => Promise<HTMLImageElement>
  updatePlacedImageRect,     // (imageId, updater) => void
  getPlacedImageStyle,       // (image) => Object - CSS стили
  drawPlacedImageOnCanvas,   // (image) => Promise<void>
  finalizeActiveImagePlacement, // () => Promise<void>
  cancelActiveImagePlacement,   // () => void
  beginImageTransform,       // (imageId, type, handle, event) => void
  applyImageTransform,       // (event) => void
  finishImageTransform,      // (event) => void
  addDroppedImage,           // (imageUrl, imageData, point) => Promise<void>
  resetImages,               // () => void
}
```

## Структура данных

### placedImage
```javascript
{
  id: string,           // Уникальный ID (UUID)
  src: string,          // URL изображения
  x: number,            // Координата X (px)
  y: number,            // Координата Y (px)
  width: number,        // Ширина (px)
  height: number,       // Высота (px)
  rotation: number      // Угол поворота (градусы, 0-360)
}
```

### imageTransformState
```javascript
{
  pointerId: number,    // ID указателя
  type: string,         // 'move' | 'resize'
  handle: string|null,  // 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  startPoint: {x, y},   // Начальная точка
  startRect: Object,    // Исходный прямоугольник
  captureTarget: HTMLElement | null,
  changed: boolean      // Были ли изменения
}
```

## Жизненный цикл изображения

### 1. Добавление через drag-and-drop
```
drop event → addDroppedImage(imageUrl, imageData, point)
    ↓
  ensureImageElement(imageUrl)
    ↓
  buildPlacedImage({ id, src, originalWidth, originalHeight, point, ... })
    ↓
  placedImages.value.push(image)
  activeImageId.value = image.id
```

### 2. Перемещение
```
pointerdown (на изображении) → beginImageTransform(imageId, 'move', null, event)
    ↓
pointermove → applyImageTransform(event)
    ↓
    movePlacedImage(startRect, dx, dy, canvasWidth, canvasHeight)
    ↓
pointerup → finishImageTransform(event)
```

### 3. Масштабирование
```
pointerdown (на handle) → beginImageTransform(imageId, 'resize', 'top-left', event)
    ↓
pointermove → applyImageTransform(event)
    ↓
    resizePlacedImage(startRect, handle, dx, dy, ...)
    ↓
pointerup → finishImageTransform(event)
```

### 4. Финализация
```
Пробел/Enter → finalizeActiveImagePlacement()
    ↓
  drawPlacedImageOnCanvas(image)
    ↓
    context.save()
    context.translate(x + width/2, y + height/2)
    context.rotate(rotation * PI/180)
    context.drawImage(element, ...)
    context.restore()
    ↓
  placedImages = placedImages.filter(img => img.id !== imageId)
  scheduleHistorySave(true)
```

### 5. Отмена
```
Escape → cancelActiveImagePlacement()
    ↓
  placedImages = placedImages.filter(img => img.id !== imageId)
  activeImageId = null
```

## Использование в PencilOverlay.vue

```javascript
import { usePencilImages } from '@/composables/usePencilImages'

const {
  placedImages,
  activeImageId,
  activePlacedImage,
  getPlacedImageStyle,
  finalizeActiveImagePlacement,
  cancelActiveImagePlacement,
  beginImageTransform,
  applyImageTransform,
  finishImageTransform,
  addDroppedImage,
  TEMP_IMAGE_MIN_SIZE
} = usePencilImages({
  canvasContext,
  canvasWidth,
  canvasHeight,
  canvasScale,
  getCanvasPoint,
  scheduleHistorySave
})

// Drag-and-drop изображения
const handleDrop = async (event) => {
  const imageUrl = event.dataTransfer.getData('text/uri-list')
  const imageData = JSON.parse(event.dataTransfer.getData('application/json'))
  const point = getCanvasPoint(event)

  await addDroppedImage(imageUrl, imageData, point)
}

// Перемещение изображения
const handleImagePointerDown = (imageId, event) => {
  beginImageTransform(imageId, 'move', null, event)
}

// Масштабирование (handle)
const handleResizeHandlePointerDown = (imageId, handle, event) => {
  beginImageTransform(imageId, 'resize', handle, event)
}

// Финализация
const handleKeyDown = (event) => {
  if (event.key === ' ' || event.key === 'Enter') {
    await finalizeActiveImagePlacement()
  } else if (event.key === 'Escape') {
    cancelActiveImagePlacement()
  }
}
```

## Вспомогательные утилиты

### buildPlacedImage
```javascript
import { buildPlacedImage } from '@/utils/placedImages.js'

const image = buildPlacedImage({
  id: 'uuid-123',
  src: 'https://example.com/image.jpg',
  originalWidth: 800,
  originalHeight: 600,
  point: { x: 100, y: 100 },
  canvasWidth: 1024,
  canvasHeight: 768
})
// → { id, src, x, y, width, height, rotation: 0 }
```

### movePlacedImage
```javascript
import { movePlacedImage } from '@/utils/placedImages.js'

const newRect = movePlacedImage(
  currentRect,
  dx,  // смещение X
  dy,  // смещение Y
  canvasWidth,
  canvasHeight
)
// Ограничивает область границами canvas
```

### resizePlacedImage
```javascript
import { resizePlacedImage } from '@/utils/placedImages.js'

const newRect = resizePlacedImage(
  currentRect,
  handle,  // 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  dx,
  dy,
  canvasWidth,
  canvasHeight,
  TEMP_IMAGE_MIN_SIZE
)
// Ограничивает минимальный размер и границы canvas
```

## CSS стили для отображения

```javascript
const getPlacedImageStyle = (image) => {
  const displayScale = canvasScale.value || 1

  return {
    width: `${image.width / displayScale}px`,
    height: `${image.height / displayScale}px`,
    transform: `
      translate(${image.x / displayScale}px, ${image.y / displayScale}px)
      rotate(${image.rotation}deg)
    `,
    transformOrigin: 'top left'
  }
}
```

## Отрисовка на canvas с поворотом

```javascript
const drawPlacedImageOnCanvas = async (image) => {
  const element = await ensureImageElement(image.src)

  context.save()
  // Перемещаем origin в центр изображения
  context.translate(image.x + image.width / 2, image.y + image.height / 2)
  // Поворачиваем canvas
  context.rotate((image.rotation * Math.PI) / 180)
  // Рисуем изображение относительно центра
  context.drawImage(
    element,
    -image.width / 2,
    -image.height / 2,
    image.width,
    image.height
  )
  context.restore()

  scheduleHistorySave(true)
}
```

## Особенности

### Pointer Capture
При начале трансформации захватывается указатель:
```javascript
beginImageTransform:
  if (event.currentTarget.setPointerCapture) {
    event.currentTarget.setPointerCapture(event.pointerId)
  }

finishImageTransform:
  if (captureTarget.releasePointerCapture) {
    captureTarget.releasePointerCapture(event.pointerId)
  }
```

### Загрузка изображения
```javascript
const ensureImageElement = (src) => new Promise((resolve, reject) => {
  const element = new Image()
  element.crossOrigin = 'anonymous'
  element.onload = () => resolve(element)
  element.onerror = (error) => reject(error)
  element.src = src
})
```

### UUID генерация
```javascript
const draftId = crypto?.randomUUID
  ? crypto.randomUUID()
  : `temp-${Date.now()}`
```

## Связанные файлы

- `src/components/Overlay/PencilOverlay.vue` — основной компонент
- `src/utils/placedImages.js` — утилиты для размещения изображений
- `src/composables/usePencilHistory.js` — сохранение в историю
