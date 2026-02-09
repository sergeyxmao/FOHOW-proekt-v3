# Управление изображениями в режиме рисования (Pencil Mode)

## Обзор

Документ описывает систему управления изображениями в режиме рисования (PencilOverlay), включая изменения размера и масштабирования.

## Файлы

- **[src/components/Overlay/PencilOverlay.vue](../../src/components/Overlay/PencilOverlay.vue)** — основной компонент режима рисования
- **[src/composables/usePencilImages.js](../../src/composables/usePencilImages.js)** — composable для управления изображениями
- **[src/composables/useCanvasImageRenderer.js](../../src/composables/useCanvasImageRenderer.js)** — рендеринг изображений на обычном canvas

## Режимы управления

### Десктоп (mouse/pen)

**Изменение размера через handles (точки по краям):**
- 8 точек по углам и серединам сторон
- Размер: 20px × 20px (увеличено с 12px для удобства)
- Цвет: синий (#0f62fe) с белой обводкой
- Курсор меняется в зависимости от типа handle (resize cursors)

**Перемещение:**
- Клик и перетаскивание по области изображения

### Мобильные устройства (touch)

**Масштабирование:**
- **Pinch-to-zoom** (жест двумя пальцами)
- Расстояние между пальцами определяет масштаб
- Масштабирование происходит относительно центра изображения

**Перемещение:**
- Перетаскивание одним пальцем

**Handles скрыты на мобильных:**
```css
@media (pointer: coarse) {
  .pencil-overlay__image-handle {
    display: none;
  }
}
```

## Реализация pinch-zoom для изображений

### Структура данных

```javascript
// usePencilImages.js
const activeImagePointers = new Map()  // Отслеживание активных touch-поинтеров
const isImagePinching = ref(false)     // Флаг активного pinch-жеста
let imagePinchState = null             // Состояние pinch (начальные параметры)
```

### Состояние pinch

```javascript
imagePinchState = {
  initialDistance: number,  // Начальное расстояние между пальцами
  initialWidth: number,     // Начальная ширина изображения
  initialHeight: number,    // Начальная высота изображения
  initialX: number,         // Начальная X координата
  initialY: number          // Начальная Y координата
}
```

### Алгоритм

1. **Начало трансформации** (`beginImageTransform`):
   - Регистрируется touch-pointer
   - При втором пальце активируется pinch-режим
   - Сохраняется начальное состояние изображения

2. **Движение** (`applyImageTransform`):
   - Обновляются координаты поинтеров
   - Вычисляется текущее расстояние между пальцами
   - Масштаб = текущее расстояние / начальное расстояние
   - Изображение масштабируется от центра

3. **Завершение** (`finishImageTransform`):
   - Pointer удаляется из трекинга
   - При <2 пальцах pinch-режим сбрасывается

## Размеры handles

### Режим рисования (PencilOverlay)

- **Десктоп**: 20px × 20px
- **Мобильные**: скрыты (display: none)
- Позиция: top/left смещены на -10px (половина размера handle)

### Обычный canvas (CanvasBoard)

- **Размер**: 16px × 16px (увеличено с 8px)
- Применяется ко всем платформам
- Позиция: смещение на -8px (половина размера handle)

## Ограничения

- **Минимальный размер изображения**: 24px × 24px (константа `TEMP_IMAGE_MIN_SIZE`)
- Масштабирование сохраняет пропорции изображения
- Изображение не может выходить за границы canvas

## События

### PencilOverlay.vue

```vue
<div
  class="pencil-overlay__image-wrapper"
  @pointerdown.stop.prevent="beginImageTransform(image.id, 'move', null, $event)"
  @pointermove.stop.prevent="applyImageTransform"
  @pointerup.stop.prevent="finishImageTransform"
  @pointerleave.stop.prevent="finishImageTransform"
  @pointercancel.stop.prevent="finishImageTransform"
>
```

- `.stop.prevent` — предотвращает всплытие и действия по умолчанию
- `touch-action: none` — отключает стандартные touch-жесты браузера

## Связанные composables

- **[usePencilZoom.js](../../src/composables/usePencilZoom.js)** — pinch-zoom для всего canvas
- **[usePencilImages.js](../../src/composables/usePencilImages.js)** — управление изображениями
- **[useCanvasImageRenderer.js](../../src/composables/useCanvasImageRenderer.js)** — рендеринг изображений

## История изменений

### 2026-02-09
- Увеличен размер handles для десктопа (PencilOverlay: 12px → 20px, CanvasBoard: 8px → 16px)
- Handles скрыты на мобильных устройствах через media query
- Реализован pinch-to-zoom для масштабирования изображений на мобильных
- Добавлен обработчик `pointerleave` для корректного завершения трансформации
