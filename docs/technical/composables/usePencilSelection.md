# usePencilSelection.js

> Управление выделением области на canvas в PencilOverlay

## Общая информация

| Параметр | Значение |
|----------|----------|
| **Файл** | `src/composables/usePencilSelection.js` |
| **Размер** | ~367 строк |
| **Создан** | Декабрь 2025 (рефакторинг PencilOverlay.vue) |
| **Зависимости** | Vue refs, canvas API |

## Назначение

Этот composable управляет выделением прямоугольной области на canvas и перемещением
выделенной области. Поддерживает создание рамки выделения, захват и перемещение
выделенного контента.

### Ключевые возможности:
- Создание прямоугольного выделения мышью
- Захват imageData выделенной области
- Перемещение выделенного контента
- Отмена выделения (Escape)
- Автоматическое ограничение области границами canvas
- Сохранение в историю при изменениях

## API

### Входные параметры

```javascript
usePencilSelection({
  canvasContext,        // ref на 2D контекст canvas
  canvasWidth,          // ref<number> - ширина canvas
  canvasHeight,         // ref<number> - высота canvas
  scheduleHistorySave,  // callback для сохранения в историю
})
```

### Возвращаемые значения

```javascript
{
  // Состояние
  selectionRect,              // ref<Object|null> - {x, y, width, height}
  isCreatingSelection,        // ref<boolean> - создаётся ли выделение
  isMovingSelection,          // ref<boolean> - перемещается ли выделение
  selectionPointerId,         // ref<number|null> - ID указателя
  activeSelection,            // ref<Object|null> - {rect, imageData}

  // Методы
  isPointInsideRect,          // (point, rect) => boolean
  resetSelectionInteraction,  // () => void
  cancelSelection,            // () => void - отмена с восстановлением
  beginSelectionCreation,     // (point, pointerId) => void
  updateSelectionCreation,    // (point) => void
  finalizeSelectionCreation,  // () => void - захват imageData
  beginSelectionMove,         // (point, pointerId) => void
  updateSelectionMove,        // (point) => void
  finishSelectionMove,        // () => void - сохранение в историю
}
```

## Структура данных

### selectionRect
```javascript
{
  x: number,      // координата X (px)
  y: number,      // координата Y (px)
  width: number,  // ширина (px)
  height: number  // высота (px)
}
```

### activeSelection
```javascript
{
  rect: {x, y, width, height},  // прямоугольник выделения
  imageData: ImageData           // захваченные пиксели
}
```

## Жизненный цикл выделения

### 1. Создание выделения
```
pointerdown → beginSelectionCreation()
    ↓
pointermove → updateSelectionCreation()  // обновление рамки
    ↓
pointerup → finalizeSelectionCreation()  // захват imageData
```

### 2. Перемещение выделения
```
pointerdown (внутри рамки) → beginSelectionMove()
    ↓
pointermove → updateSelectionMove()  // перемещение
    ↓
pointerup → finishSelectionMove()  // сохранение в историю
```

### 3. Отмена
```
Escape → cancelSelection()  // восстановление исходного состояния
```

## Использование в PencilOverlay.vue

```javascript
import { usePencilSelection } from '@/composables/usePencilSelection'

const {
  selectionRect,
  isCreatingSelection,
  isMovingSelection,
  activeSelection,
  isPointInsideRect,
  beginSelectionCreation,
  updateSelectionCreation,
  finalizeSelectionCreation,
  beginSelectionMove,
  updateSelectionMove,
  finishSelectionMove,
  cancelSelection
} = usePencilSelection({
  canvasContext,
  canvasWidth,
  canvasHeight,
  scheduleHistorySave
})

// Создание выделения
const handlePointerDown = (event) => {
  const point = getCanvasPoint(event)

  if (currentTool === 'selection') {
    if (isPointInsideRect(point, selectionRect.value)) {
      beginSelectionMove(point, event.pointerId)
    } else {
      beginSelectionCreation(point, event.pointerId)
    }
  }
}

// Горячие клавиши
if (key === 'Escape' && activeSelection.value) {
  cancelSelection()
}
```

## Алгоритм нормализации прямоугольника

```javascript
// Поддержка перетаскивания в любом направлении
const normalizeSelectionRect = (start, current) => {
  // Ограничение координат границами canvas
  const clampedStart = {
    x: clamp(start.x, 0, canvasWidth),
    y: clamp(start.y, 0, canvasHeight)
  }

  const clampedCurrent = {
    x: clamp(current.x, 0, canvasWidth),
    y: clamp(current.y, 0, canvasHeight)
  }

  // Преобразование в {x, y, width, height}
  const left = Math.min(clampedStart.x, clampedCurrent.x)
  const top = Math.min(clampedStart.y, clampedCurrent.y)
  const right = Math.max(clampedStart.x, clampedCurrent.x)
  const bottom = Math.max(clampedStart.y, clampedCurrent.y)

  return { x: left, y: top, width: right - left, height: bottom - top }
}
```

## Особенности

### Минимальный размер выделения
Выделение должно быть >= 2×2 пикселя, иначе оно отменяется:
```javascript
if (!rect || rect.width < 2 || rect.height < 2) {
  selectionRect.value = null
  return
}
```

### Захват imageData
При завершении создания выделения захватываются пиксели:
```javascript
const imageData = context.getImageData(
  rect.x,
  rect.y,
  rect.width,
  rect.height
)
```

### Перемещение с ограничением
При перемещении область не выходит за границы canvas:
```javascript
const maxX = Math.max(0, canvasWidth - rectWidth)
const maxY = Math.max(0, canvasHeight - rectHeight)
const targetX = clamp(initialX + dx, 0, maxX)
const targetY = clamp(initialY + dy, 0, maxY)
```

### Восстановление при отмене
При нажатии Escape восстанавливается исходное состояние:
```javascript
// Восстановление базового слоя
context.putImageData(baseImageData, 0, 0)
// Восстановление выделения в исходную позицию
context.putImageData(imageData, initialRect.x, initialRect.y)
```

## Связанные файлы

- `src/components/Overlay/PencilOverlay.vue` — основной компонент
- `src/composables/usePencilHistory.js` — сохранение в историю
- `src/composables/usePencilDrawing.js` — инструменты рисования
