# usePencilZoom.js

> Управление зумом и панорамированием в PencilOverlay

## Общая информация

| Параметр | Значение |
|----------|----------|
| **Файл** | `src/composables/usePencilZoom.js` |
| **Размер** | ~200 строк |
| **Создан** | Декабрь 2025 (рефакторинг PencilOverlay.vue) |
| **Зависимости** | Vue refs, DOM events |

## Назначение

Этот composable управляет зумом и панорамированием (перемещением) canvas в режиме
рисования. Поддерживает зум колесом мыши относительно курсора и панорамирование
перетаскиванием.

### Ключевые возможности:
- Зум колесом мыши (10% шаг)
- Зум относительно позиции курсора
- Панорамирование при зуме > 1
- Автоматический сброс pan при выходе из зума
- Диапазон зума: 1.0 - 4.0 (100% - 400%)
- Pointer capture для плавного pan

## API

### Входные параметры

```javascript
usePencilZoom({
  isReady,  // ref<boolean> - готов ли canvas (optional)
})
```

### Возвращаемые значения

```javascript
{
  // Состояние зума
  zoomScale,        // ref<number> - текущий масштаб (1.0 - 4.0)
  minZoomScale,     // ref<number> - минимальный масштаб (1.0)

  // Состояние панорамирования
  panOffset,        // ref<{x, y}> - смещение в пикселях
  isPanning,        // ref<boolean> - идёт ли панорамирование
  panPointerId,     // ref<number|null> - ID указателя

  // Computed
  isZoomedIn,       // computed<boolean> - zoomScale > minZoomScale

  // Методы
  clampZoom,        // (value) => number
  handleBoardWheel, // (event) => void - обработка колеса
  beginPan,         // (event) => void
  updatePan,        // (event) => void
  finishPan,        // (event) => void
  resetPan,         // () => void
  resetZoom,        // () => void - сброс зума и pan
}
```

## Константы

```javascript
const MAX_ZOOM = 4        // Максимальный зум: 400%
const ZOOM_STEP = 0.1     // Шаг зума: 10%
```

## Использование в PencilOverlay.vue

```javascript
import { usePencilZoom } from '@/composables/usePencilZoom'

const {
  zoomScale,
  panOffset,
  isPanning,
  isZoomedIn,
  handleBoardWheel,
  beginPan,
  updatePan,
  finishPan,
  resetZoom
} = usePencilZoom({
  isReady: canvasReady
})

// Зум колесом мыши
const handleWheel = (event) => {
  if (currentTool.value === 'pan') {
    handleBoardWheel(event)
  }
}

// Панорамирование
const handlePointerDown = (event) => {
  if (isZoomedIn.value && currentTool.value === 'pan') {
    beginPan(event)
  }
}

// CSS transform для canvas
const canvasTransform = computed(() => ({
  transform: `
    translate(${panOffset.value.x}px, ${panOffset.value.y}px)
    scale(${zoomScale.value})
  `,
  transformOrigin: 'top left'
}))
```

## Зум колесом мыши

### Алгоритм зума относительно курсора

```javascript
handleBoardWheel(event):
  1. Определяем направление зума:
     zoomIn = event.deltaY < 0

  2. Вычисляем новый масштаб:
     factor = zoomIn ? 1.1 : 1/1.1
     updatedScale = clamp(currentScale * factor, minZoomScale, MAX_ZOOM)

  3. Находим позицию курсора относительно board:
     rect = boardElement.getBoundingClientRect()
     pointerOffsetX = event.clientX - rect.left
     pointerOffsetY = event.clientY - rect.top

  4. Вычисляем локальные координаты (в системе canvas):
     localX = pointerOffsetX / currentScale
     localY = pointerOffsetY / currentScale

  5. Корректируем pan чтобы курсор оставался на той же точке:
     scaleDifference = currentScale - updatedScale
     panOffset.x = currentPan.x + scaleDifference * localX
     panOffset.y = currentPan.y + scaleDifference * localY

  6. Применяем новый масштаб:
     zoomScale.value = updatedScale
```

### Пример

```
Было:
  zoomScale = 1.0
  panOffset = {x: 0, y: 0}
  курсор на (512, 384) в viewport

Колесо вверх (zoom in):
  updatedScale = 1.1
  localX = 512 / 1.0 = 512
  localY = 384 / 1.0 = 384
  scaleDifference = 1.0 - 1.1 = -0.1
  panOffset.x = 0 + (-0.1) * 512 = -51.2
  panOffset.y = 0 + (-0.1) * 384 = -38.4

Стало:
  zoomScale = 1.1
  panOffset = {x: -51.2, y: -38.4}
  курсор всё ещё на той же точке canvas
```

## Панорамирование

### Жизненный цикл

```
pointerdown → beginPan(event)
    ↓
    if (!isZoomedIn) return
    setPointerCapture(event.pointerId)
    isPanning = true
    panStartPoint = {x: event.clientX, y: event.clientY}
    panInitialOffset = {...panOffset}
    ↓
pointermove → updatePan(event)
    ↓
    if (!isPanning) return
    deltaX = event.clientX - panStartPoint.x
    deltaY = event.clientY - panStartPoint.y
    panOffset.x = panInitialOffset.x + deltaX
    panOffset.y = panInitialOffset.y + deltaY
    ↓
pointerup → finishPan(event)
    ↓
    releasePointerCapture(event.pointerId)
    isPanning = false
```

### Ограничения

- Панорамирование доступно только при `isZoomedIn === true`
- При `zoomScale <= minZoomScale` автоматически вызывается `resetPan()`

## Watcher для автосброса pan

```javascript
watch(isZoomedIn, (zoomed) => {
  if (!zoomed) {
    resetPan()  // Сброс при выходе из зума
  }
})
```

## Pointer Capture

Для плавного панорамирования используется Pointer Events API:

```javascript
beginPan(event):
  boardElement.setPointerCapture(event.pointerId)
  // Теперь все pointermove/pointerup будут приходить на boardElement
  // даже если курсор вне его границ

finishPan(event):
  boardElement.releasePointerCapture(event.pointerId)
```

## CSS трансформация canvas

```vue
<template>
  <div class="pencil-board" @wheel="handleBoardWheel">
    <canvas
      :style="{
        transform: `
          translate(${panOffset.x}px, ${panOffset.y}px)
          scale(${zoomScale})
        `,
        transformOrigin: 'top left'
      }"
    />
  </div>
</template>
```

## Ограничение зума

```javascript
const clampZoom = (value) => {
  const MIN_ZOOM = minZoomScale.value || 1
  return Math.min(Math.max(value, MIN_ZOOM), MAX_ZOOM)
}
```

## Сброс состояния

```javascript
// Сброс только pan
resetPan():
  panOffset.value = {x: 0, y: 0}
  isPanning.value = false
  panPointerId.value = null
  panStartPoint.value = null
  panInitialOffset.value = {x: 0, y: 0}

// Сброс зума и pan
resetZoom():
  zoomScale.value = 1
  minZoomScale.value = 1
  resetPan()
```

## Особенности

### Проверка isReady

Если передан параметр `isReady`, зум не сработает пока canvas не готов:
```javascript
handleBoardWheel(event):
  if (isReady && !isReady.value) {
    return
  }
  // ... зум
```

### Округление масштаба

Масштаб округляется до 4 знаков после запятой:
```javascript
zoomScale.value = Number.parseFloat(updatedScale.toFixed(4))
```

### Предотвращение стандартного поведения

```javascript
handleBoardWheel(event):
  event.preventDefault()  // Предотвращаем прокрутку страницы
```

## Связанные файлы

- `src/components/Overlay/PencilOverlay.vue` — основной компонент
- `src/composables/usePencilDrawing.js` — инструменты рисования
- `src/composables/usePencilSelection.js` — выделение области
