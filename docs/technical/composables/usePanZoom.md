# usePanZoom.js

> Панорамирование и масштабирование холста

## Общая информация

| Параметр | Значение |
|----------|----------|
| **Файл** | `src/composables/usePanZoom.js` |
| **Размер** | ~600 строк |
| **Создан** | Декабрь 2025 |
| **Зависимости** | Vue (ref, onMounted, onUnmounted) |

## Назначение

Этот composable управляет панорамированием (перемещением) и масштабированием холста.
Поддерживает мышь и тач-жесты.

### Ключевые возможности:
- Панорамирование средней кнопкой мыши (колёсико)
- Панорамирование комбинацией левая + правая кнопка мыши
- Панорамирование одним пальцем (touch)
- Масштабирование колёсиком мыши
- Pinch-to-zoom двумя пальцами (touch)
- Ограничение масштаба (1% - 500%)

## API

### Входные параметры

```javascript
usePanZoom(canvasElement)  // ref к DOM-элементу canvas-container
```

### Возвращаемые значения

```javascript
{
  // Реактивное состояние
  scale,          // ref<number> - текущий масштаб (1 = 100%)
  translateX,     // ref<number> - смещение по X
  translateY,     // ref<number> - смещение по Y

  // Константы
  minScale,       // 0.01 (1%)
  maxScale,       // 5 (500%)

  // Методы
  clampScale,     // (value) => number - ограничить масштаб
  setScale,       // (value) => void - установить масштаб
  setTranslation, // (x, y) => void - установить смещение
  setTransform,   // ({ scale, translateX, translateY }) => void
  resetTransform, // () => void - сбросить к начальному состоянию
}
```

## Способы панорамирования

### 1. Средняя кнопка мыши (fallback)
- Нажать колёсико мыши (button === 1)
- Перемещать мышь
- Отпустить колёсико

### 2. Левая + правая кнопка мыши (основной)
- Нажать левую кнопку (button === 0)
- Нажать правую кнопку (button === 2) — или наоборот
- Перемещать мышь
- Отпустить любую кнопку

> **Примечание:** Комбинация кнопок добавлена как альтернатива средней кнопке,
> т.к. многие мыши/браузеры некорректно обрабатывают нажатие колёсика.

### 3. Один палец (touch)
- Касание вне интерактивных элементов
- Перемещение пальца

## Переменные состояния

```javascript
// Основное состояние
let isPanning = false           // Активно ли панорамирование
let startX = 0                  // Начальная позиция X
let startY = 0                  // Начальная позиция Y
let panPointerId = null         // ID указателя для панорамирования
let panPointerType = null       // Тип указателя ('mouse' | 'touch')

// Touch-состояние
const activeTouchPointers = new Map()  // Активные касания
let pinchState = null                   // Состояние pinch-жеста

// Состояние для комбинации левая+правая кнопка
let leftButtonDown = false      // Левая кнопка нажата
let rightButtonDown = false     // Правая кнопка нажата
let bothButtonsPanStarted = false // Панорамирование запущено комбинацией
```

## CSS-класс панорамирования

При активном панорамировании на `canvasElement` добавляется класс:

```javascript
const PAN_CURSOR_CLASS = 'canvas-container--panning'
```

Стили для этого класса (в CanvasBoard.vue):

```css
.canvas-container--panning,
.canvas-container--panning .canvas-content,
.canvas-container--panning .svg-layer {
  cursor: grabbing !important;
}

.canvas-container--panning .canvas-content::after {
  content: '';
  position: absolute;
  inset: -10000px;
  background: rgba(0, 0, 0, 0.05);
  pointer-events: none;
  z-index: 9999;
}
```

## Исключённые элементы

Панорамирование не запускается при клике на:

```javascript
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
```

## Масштабирование колёсиком

```javascript
// Коэффициент масштабирования (±0.01% за единицу deltaY)
const delta = -event.deltaY * 0.0001
const newScale = clampScale(scale.value + delta)

// Зум относительно позиции курсора
const scaleRatio = newScale / scale.value
translateX.value = mouseX - (mouseX - translateX.value) * scaleRatio
translateY.value = mouseY - (mouseY - translateY.value) * scaleRatio
```

## Использование в CanvasBoard.vue

```javascript
import { usePanZoom } from '@/composables/usePanZoom'

const canvasContainer = ref(null)

const {
  scale,
  translateX,
  translateY,
  setTransform,
  resetTransform,
} = usePanZoom(canvasContainer)
```

```vue
<template>
  <div ref="canvasContainer" class="canvas-container">
    <div
      class="canvas-content"
      :style="{
        transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`
      }"
    >
      <!-- Содержимое холста -->
    </div>
  </div>
</template>
```

## Отладка

### Панорамирование не работает
1. Проверь что `canvasElement.value` не null
2. Проверь что клик внутри canvas-container
3. Проверь что элемент не в `PAN_EXCLUDE_SELECTOR`
4. Для комбо-кнопок: проверь что обе кнопки зарегистрированы

### Контекстное меню появляется
1. Проверь что `handleContextMenu` блокирует при `isPanning` или `bothButtonsPanStarted`
2. Проверь что `event.preventDefault()` вызывается в `handlePointerDown`

### Курсор не меняется
1. Проверь что класс `canvas-container--panning` добавляется
2. Проверь CSS-стили в CanvasBoard.vue

## Связанные файлы

- `src/components/Canvas/CanvasBoard.vue` — основной компонент холста
- `src/composables/useCanvasDrag.js` — перетаскивание объектов
- `src/composables/useCanvasSelection.js` — выделение объектов
