# usePanZoom.js

> Панорамирование и масштабирование холста

## Общая информация

| Параметр | Значение |
|----------|----------|
| **Файл** | `src/composables/usePanZoom.js` |
| **Размер** | ~630 строк |
| **Создан** | Декабрь 2025 |
| **Зависимости** | Vue (ref, onMounted, onUnmounted) |

## Назначение

Этот composable управляет панорамированием (перемещением) и масштабированием холста.
Поддерживает мышь и тач-жесты.

### Ключевые возможности:
- Панорамирование клавишей Space + левая кнопка мыши (основной способ)
- Панорамирование средней кнопкой мыши (fallback)
- Панорамирование одним пальцем (touch)
- Масштабирование колёсиком мыши
- Pinch-to-zoom двумя пальцами (touch)
- Ограничение масштаба (1% - 500%)

## API

### Входные параметры

```javascript
usePanZoom(canvasElement, options?)
// canvasElement - ref к DOM-элементу canvas-container
// options - опциональный объект конфигурации
```

#### Параметр options

| Свойство | Тип | Описание |
|----------|-----|----------|
| `canPan` | `Function \| Ref<Boolean> \| Boolean` | Функция или значение, определяющее разрешено ли панорамирование одним пальцем (touch). Если `false` — pan одним пальцем блокируется. **Pinch-zoom двумя пальцами работает всегда, независимо от этого параметра.** |

**Пример использования:**
```javascript
// Блокировать pan одним пальцем в мобильном режиме рисования,
// но разрешить pinch-zoom (масштабирование двумя пальцами)
usePanZoom(canvasContainerRef, {
  canPan: () => !isMobileMode.value || !isSelectionMode.value
})
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

### 1. Space + левая кнопка мыши (основной)
- Зажать клавишу **Space** — курсор меняется на `grab` (открытая рука)
- Зажать **левую кнопку мыши** — курсор меняется на `grabbing` (закрытая рука)
- Перемещать мышь — холст панорамируется
- Отпустить левую кнопку мыши или Space — панорамирование прекращается

> **Примечание:** При вводе текста в input/textarea клавиша Space работает нормально (набор текста).

### 2. Средняя кнопка мыши (fallback)
- Нажать колёсико мыши (button === 1)
- Перемещать мышь
- Отпустить колёсико

> **Примечание:** Многие мыши/браузеры некорректно обрабатывают нажатие колёсика,
> поэтому рекомендуется использовать Space + LMB.

### 3. Один палец (touch)
- Касание вне интерактивных элементов
- Перемещение пальца

## Горячие клавиши

| Клавиша | Действие |
|---------|----------|
| **Space** | Удерживать для режима панорамирования (курсор `grab`) |
| **Space + LMB** | Панорамирование холста |

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

// Состояние для Space + левая кнопка мыши
let isSpaceDown = false         // Клавиша Space нажата
let spaceStartedPan = false     // Панорамирование запущено через Space+LMB
```

## CSS-классы

### Готовность к панорамированию (Space зажат)

```javascript
const SPACE_READY_CLASS = 'canvas-container--space-ready'
```

```css
/* Курсор "открытая рука" при зажатом Space */
.canvas-container--space-ready,
.canvas-container--space-ready .canvas-content,
.canvas-container--space-ready .cards-container,
.canvas-container--space-ready .svg-layer {
  cursor: grab !important;
}
```

### Активное панорамирование

```javascript
const PAN_CURSOR_CLASS = 'canvas-container--panning'
```

```css
/* Курсор "закрытая рука" при активном панорамировании */
.canvas-container--panning,
.canvas-container--panning .canvas-content,
.canvas-container--panning .cards-container,
.canvas-container--panning .svg-layer {
  cursor: grabbing !important;
}

/* Затемнение холста для визуальной обратной связи */
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
} = usePanZoom(canvasContainer, {
  // В мобильном режиме с включенным режимом выделения блокируем pan одним пальцем
  // Pinch-zoom будет работать всегда
  canPan: () => !isMobileMode.value || !isSelectionMode.value
})
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
4. Для Space+LMB: проверь что фокус не на input/textarea

### Курсор не меняется на grab при Space
1. Проверь что класс `canvas-container--space-ready` добавляется
2. Проверь что фокус не на поле ввода (input/textarea)
3. Проверь CSS-стили в CanvasBoard.vue

### Курсор не меняется на grabbing
1. Проверь что класс `canvas-container--panning` добавляется
2. Проверь CSS-стили в CanvasBoard.vue

### Space вызывает прокрутку страницы
1. Проверь что `event.preventDefault()` вызывается в `handleKeyDown`
2. Убедись что фокус не на элементе, требующем Space (кнопка, input)

## Связанные файлы

- `src/components/Canvas/CanvasBoard.vue` — основной компонент холста
- `src/composables/useCanvasDrag.js` — перетаскивание объектов
- `src/composables/useCanvasSelection.js` — выделение объектов
