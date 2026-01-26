# usePencilDrawing.js

> Управление инструментами рисования в PencilOverlay

## Общая информация

| Параметр | Значение |
|----------|----------|
| **Файл** | `src/composables/usePencilDrawing.js` |
| **Размер** | ~205 строк |
| **Создан** | Декабрь 2025 (рефакторинг PencilOverlay.vue) |
| **Зависимости** | Vue refs, canvas API |

## Назначение

Этот composable управляет инструментами рисования на canvas: кисть (brush),
маркер (marker) и ластик (eraser). Поддерживает настройку размера, цвета и
прозрачности инструментов.

### Ключевые возможности:
- Три инструмента: brush, marker, eraser
- Настройка размера и цвета для каждого инструмента
- Регулировка прозрачности маркера (1-100%)
- Превью ластика при наведении
- Сохранение в историю после завершения штриха
- Масштабирование размеров с учётом DPI canvas

## API

### Входные параметры

```javascript
usePencilDrawing({
  canvasContext,        // ref на 2D контекст canvas
  canvasScale,          // ref<number> - масштаб canvas (DPI)
  scheduleHistorySave,  // callback для сохранения в историю
})
```

### Возвращаемые значения

```javascript
{
  // Состояние инструментов
  currentTool,          // ref<string> - 'brush' | 'marker' | 'eraser' | 'selection'
  brushColor,           // ref<string> - HEX цвет (#ff4757)
  brushSize,            // ref<number> - размер кисти (px)
  markerSize,           // ref<number> - размер маркера (px)
  markerOpacity,        // ref<number> - прозрачность маркера (0-1)
  eraserSize,           // ref<number> - размер ластика (px)
  isDrawing,            // ref<boolean> - идёт ли рисование
  activePointerId,      // ref<number|null> - ID указателя
  pointerPosition,      // ref<Object|null> - {x, y} для превью

  // Computed
  markerOpacityPercent,  // computed<number> - прозрачность в % (1-100)
  isDrawingToolActive,   // computed<boolean> - brush/marker/eraser
  isSelectionToolActive, // computed<boolean> - selection
  showEraserPreview,     // computed<boolean> - показывать превью ластика

  // Константы
  ERASER_MIN_SIZE,      // 4 px
  ERASER_MAX_SIZE,      // 80 px
  MARKER_MIN_SIZE,      // 30 px
  MARKER_MAX_SIZE,      // 100 px

  // Методы
  hexToRgba,            // (hex, alpha) => string
  startStroke,          // (point) => void
  continueStroke,       // (point) => void
  finishStroke,         // () => void - сохранение в историю
  updatePointerPreview, // (point) => void
  clearPointerPreview,  // () => void
  setScheduleHistorySave, // (fn) => void - установка callback'а после инициализации
}
```

## Инструменты

### 1. Brush (Кисть)
```javascript
currentTool.value = 'brush'
brushColor.value = '#ff4757'  // HEX цвет
brushSize.value = 4           // px (без ограничений)
```

**Canvas настройки:**
```javascript
context.globalCompositeOperation = 'source-over'
context.strokeStyle = brushColor
context.lineWidth = brushSize * canvasScale
context.lineCap = 'round'
context.lineJoin = 'round'
```

### 2. Marker (Маркер)
```javascript
currentTool.value = 'marker'
brushColor.value = '#ff4757'       // Базовый цвет
markerSize.value = 60              // px (30-100)
markerOpacity.value = 0.01         // 0-1 (1% по умолчанию)
```

**Canvas настройки:**
```javascript
context.globalCompositeOperation = 'source-over'
context.strokeStyle = hexToRgba(brushColor, markerOpacity)
context.lineWidth = markerSize * canvasScale
context.lineCap = 'round'
context.lineJoin = 'round'
```

**Функция конвертации цвета:**
```javascript
const hexToRgba = (hex, alpha) => {
  // #ff4757 → rgba(255, 71, 87, 0.01)
  // Поддержка #RGB и #RRGGBB форматов
  // Возвращает rgba(0, 0, 0, alpha) при ошибке
}
```

### 3. Eraser (Ластик)
```javascript
currentTool.value = 'eraser'
eraserSize.value = 24  // px (4-80)
```

**Canvas настройки:**
```javascript
context.globalCompositeOperation = 'destination-out'
context.strokeStyle = 'rgba(0, 0, 0, 1)'
context.lineWidth = eraserSize * canvasScale
context.lineCap = 'round'
context.lineJoin = 'round'
```

**Превью при наведении:**
```javascript
// При currentTool === 'eraser' и pointerPosition !== null
// Отображается круг размером eraserSize
showEraserPreview.value === true
pointerPosition.value = { x: 123, y: 456 }
```

## Жизненный цикл штриха

```
pointerdown → startStroke(point)
    ↓
    context.beginPath()
    context.moveTo(point.x, point.y)
    isDrawing = true
    ↓
pointermove → continueStroke(point)  [N раз]
    ↓
    context.lineTo(point.x, point.y)
    context.stroke()
    hasStrokeChanges = true
    ↓
pointerup → finishStroke()
    ↓
    context.closePath()
    isDrawing = false
    if (hasStrokeChanges) {
      scheduleHistorySave(true)
    }
```

## Использование в PencilOverlay.vue

```javascript
import { usePencilDrawing } from '@/composables/usePencilDrawing'

const {
  currentTool,
  brushColor,
  brushSize,
  markerSize,
  markerOpacity,
  eraserSize,
  isDrawing,
  isDrawingToolActive,
  showEraserPreview,
  startStroke,
  continueStroke,
  finishStroke,
  updatePointerPreview,
  clearPointerPreview,
  ERASER_MIN_SIZE,
  ERASER_MAX_SIZE,
  MARKER_MIN_SIZE,
  MARKER_MAX_SIZE
} = usePencilDrawing({
  canvasContext,
  canvasScale,
  scheduleHistorySave
})

// Начало рисования
const handlePointerDown = (event) => {
  const point = getCanvasPoint(event)

  if (isDrawingToolActive.value) {
    startStroke(point)
  }
}

// Продолжение рисования
const handlePointerMove = (event) => {
  const point = getCanvasPoint(event)

  if (isDrawing.value) {
    continueStroke(point)
  }

  updatePointerPreview(point)
}

// Завершение рисования
const handlePointerUp = () => {
  finishStroke()
}

// Смена инструмента
const selectTool = (tool) => {
  currentTool.value = tool  // 'brush' | 'marker' | 'eraser' | 'selection'
}
```

## Особенности

### Масштабирование DPI
Размеры инструментов умножаются на `canvasScale` для поддержки
высокого разрешения:
```javascript
// Если canvas 2048×1536, а отображается 1024×768
// canvasScale = 2
const lineWidth = brushSize * canvasScale  // 4 * 2 = 8
```

### Сохранение в историю
История сохраняется только если были изменения:
```javascript
hasStrokeChanges = false  // при startStroke
hasStrokeChanges = true   // при continueStroke

finishStroke():
  if (hasStrokeChanges) {
    scheduleHistorySave(true)
  }
```

### Отложенная установка scheduleHistorySave
Из-за циклической зависимости между composables, `scheduleHistorySave` может быть
установлен после инициализации через метод `setScheduleHistorySave()`:

```javascript
// В PencilOverlay.vue
const { setScheduleHistorySave, ... } = usePencilDrawing({
  canvasContext,
  canvasScale,
  scheduleHistorySave: null  // Изначально null
})

const { scheduleHistorySave, ... } = usePencilHistory({ ... })

// Устанавливаем после инициализации history
setScheduleHistorySave(scheduleHistorySave)
```

Внутри composable `scheduleHistorySave` хранится как ref для возможности обновления:
```javascript
const scheduleHistorySaveRef = ref(initialScheduleHistorySave)

const setScheduleHistorySave = (fn) => {
  scheduleHistorySaveRef.value = fn
}

// В finishStroke():
if (hasStrokeChanges.value && scheduleHistorySaveRef.value) {
  scheduleHistorySaveRef.value(true)
}
```

### Ограничения размеров
```javascript
// Ластик: 4-80 px
ERASER_MIN_SIZE = 4
ERASER_MAX_SIZE = 80

// Маркер: 30-100 px
MARKER_MIN_SIZE = 30
MARKER_MAX_SIZE = 100

// Кисть: без ограничений
```

### Превью ластика
Превью отображается только для ластика:
```javascript
updatePointerPreview(point):
  if (currentTool === 'eraser') {
    pointerPosition.value = point
  } else {
    pointerPosition.value = null
  }
```

## История изменений

### 2026-01-26: Исправление undo/redo для инструментов рисования

**Проблема:** `scheduleHistorySave` передавался как `null` при инициализации и никогда не обновлялся, из-за чего `finishStroke()` не сохранял штрихи в историю.

**Решение:**
- Добавлен `scheduleHistorySaveRef` — ref для хранения callback'а
- Добавлен метод `setScheduleHistorySave(fn)` для установки callback'а после инициализации
- В `finishStroke()` теперь используется `scheduleHistorySaveRef.value`

## Связанные файлы

- `src/components/Overlay/PencilOverlay.vue` — основной компонент
- `src/composables/usePencilHistory.js` — сохранение в историю
- `src/composables/usePencilSelection.js` — инструмент выделения
