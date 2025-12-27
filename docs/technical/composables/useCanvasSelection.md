# useCanvasSelection.js

> Выделение объектов прямоугольной рамкой (marquee selection)

## Общая информация

| Параметр | Значение |
|----------|----------|
| **Файл** | `src/composables/useCanvasSelection.js` |
| **Размер** | ~373 строки |
| **Создан** | Декабрь 2025 (рефакторинг CanvasBoard.vue) |
| **Зависимости** | stores (cards, stickers, images) |

## Назначение

Этот composable реализует выделение нескольких объектов рамкой.
Пользователь кликает на пустом месте холста и тянет — появляется рамка,
все объекты внутри выделяются.

### Ключевые возможности:
- Рисование рамки выделения
- Выделение карточек, стикеров, изображений
- Поддержка Shift для добавления к выделению
- Подсчёт выделенных объектов

## API

### Входные параметры

```javascript
useCanvasSelection({
  cardsStore,           // Pinia store карточек
  stickersStore,        // Store стикеров
  imagesStore,          // Store изображений
  canvasContainerRef,   // ref на DOM контейнер холста
  zoomScale,            // ref - текущий масштаб
  zoomTranslateX,       // ref - смещение X
  zoomTranslateY,       // ref - смещение Y
})
```

### Возвращаемые значения

```javascript
{
  // Состояние
  isSelecting,              // ref<boolean> - идёт ли выделение
  selectionRect,            // ref<Rect|null> - координаты рамки
  selectionCursorPosition,  // ref - текущая позиция курсора
  
  // Computed
  selectedObjectsCount,     // computed<number> - количество выделенных
  
  // Методы
  startSelection,           // (event) => void - начать выделение
  updateSelection,          // (event) => void - обновить рамку
  endSelection,             // () => void - завершить выделение
  clearSelection,           // () => void - сбросить выделение
  clearObjectSelections,    // (options) => void - сбросить с опциями
  applySelectionFromRect,   // (rect) => void - применить выделение
  
  // Утилиты
  createSelectionBaseState, // () => State - создать начальное состояние
}
```

## Структура selectionRect

```javascript
selectionRect = {
  // Координаты в canvas space
  x: number,      // Левый край
  y: number,      // Верхний край
  width: number,  // Ширина
  height: number, // Высота
  
  // Исходная точка (для рисования в любом направлении)
  startX: number,
  startY: number,
}
```

## Алгоритм выделения

```
1. mousedown на пустом месте холста
           │
2. startSelection(event)
   ├── Сохранить начальную точку
   ├── Если нет Shift - сбросить текущее выделение
   └── Сохранить базовое состояние (для Shift)
           │
3. mousemove
   ├── Вычислить текущую позицию
   ├── Обновить selectionRect
   └── Отрисовать рамку
           │
4. mouseup
   ├── Вычислить финальный rect
   ├── Найти объекты внутри rect
   ├── Применить выделение
   └── Очистить selectionRect
```

## Определение объектов в рамке

```javascript
applySelectionFromRect(rect) {
  // Проверка карточек
  cardsStore.cards.forEach(card => {
    if (isRectIntersecting(rect, getCardBounds(card))) {
      cardsStore.selectCard(card.id)
    }
  })
  
  // Проверка стикеров
  stickersStore.stickers.forEach(sticker => {
    if (isRectIntersecting(rect, getStickerBounds(sticker))) {
      stickersStore.selectSticker(sticker.id)
    }
  })
  
  // Проверка изображений
  imagesStore.images.forEach(image => {
    if (isRectIntersecting(rect, getImageBounds(image))) {
      imagesStore.selectImage(image.id)
    }
  })
}

// Проверка пересечения прямоугольников
function isRectIntersecting(rect1, rect2) {
  return !(
    rect1.right < rect2.left ||
    rect1.left > rect2.right ||
    rect1.bottom < rect2.top ||
    rect1.top > rect2.bottom
  )
}
```

## Поддержка Shift

При зажатом Shift новые объекты **добавляются** к существующему выделению:

```javascript
startSelection(event) {
  if (event.shiftKey) {
    // Сохраняем текущее выделение как базу
    selectionBaseSelection.value = {
      cardIds: new Set(cardsStore.selectedIds),
      stickerIds: new Set(stickersStore.selectedIds),
      imageIds: new Set(imagesStore.selectedIds),
    }
  } else {
    // Сбрасываем выделение
    clearObjectSelections()
    selectionBaseSelection.value = createSelectionBaseState()
  }
}

applySelectionFromRect(rect) {
  // Начинаем с базового выделения
  const selectedCardIds = new Set(selectionBaseSelection.value.cardIds)
  
  // Добавляем объекты из рамки
  cardsStore.cards.forEach(card => {
    if (isRectIntersecting(rect, getCardBounds(card))) {
      selectedCardIds.add(card.id)
    }
  })
  
  // Применяем
  cardsStore.setSelectedIds(selectedCardIds)
}
```

## Конвертация координат

Рамка рисуется в screen space, но объекты находятся в canvas space:

```javascript
updateSelection(event) {
  const screenX = event.clientX
  const screenY = event.clientY
  
  // Конвертация в canvas coordinates
  const canvasPos = screenToCanvas(screenX, screenY)
  
  selectionRect.value = {
    x: Math.min(startX, canvasPos.x),
    y: Math.min(startY, canvasPos.y),
    width: Math.abs(canvasPos.x - startX),
    height: Math.abs(canvasPos.y - startY),
  }
}

function screenToCanvas(screenX, screenY) {
  const rect = canvasContainerRef.value.getBoundingClientRect()
  return {
    x: (screenX - rect.left - zoomTranslateX.value) / zoomScale.value,
    y: (screenY - rect.top - zoomTranslateY.value) / zoomScale.value,
  }
}
```

## Использование в CanvasBoard.vue

```javascript
import { useCanvasSelection } from '@/composables/useCanvasSelection'

const {
  isSelecting,
  selectionRect,
  selectedObjectsCount,
  startSelection,
  updateSelection,
  endSelection,
  clearSelection,
} = useCanvasSelection({
  cardsStore,
  stickersStore,
  imagesStore,
  canvasContainerRef,
  zoomScale,
  zoomTranslateX,
  zoomTranslateY,
})

// Обработка событий
const handleStageMouseDown = (event) => {
  if (isClickOnEmpty(event)) {
    startSelection(event)
  }
}

window.addEventListener('pointermove', (event) => {
  if (isSelecting.value) {
    updateSelection(event)
  }
})

window.addEventListener('pointerup', () => {
  if (isSelecting.value) {
    endSelection()
  }
})
```

## В template

```html
<!-- Рамка выделения -->
<div
  v-if="isSelecting && selectionRect"
  class="selection-box"
  :style="{
    left: `${selectionRect.x * zoomScale + zoomTranslateX}px`,
    top: `${selectionRect.y * zoomScale + zoomTranslateY}px`,
    width: `${selectionRect.width * zoomScale}px`,
    height: `${selectionRect.height * zoomScale}px`,
  }"
>
  <!-- Счётчик выделенных -->
  <span class="selection-counter">
    {{ selectedObjectsCount }}
  </span>
</div>
```

```css
.selection-box {
  position: absolute;
  border: 2px dashed #4a90d9;
  background: rgba(74, 144, 217, 0.1);
  pointer-events: none;
  z-index: 1000;
}

.selection-counter {
  position: absolute;
  bottom: -24px;
  left: 50%;
  transform: translateX(-50%);
  background: #4a90d9;
  color: white;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
}
```

## Связанные файлы

- `src/stores/cards.js` — выделение карточек
- `src/stores/stickers.js` — выделение стикеров
- `src/stores/images.js` — выделение изображений

## Отладка

### Рамка не появляется
1. Проверь `isSelecting.value` — true ли
2. Проверь `selectionRect.value` — не null ли
3. Проверь CSS — visible ли элемент

### Объекты не выделяются
1. Проверь `applySelectionFromRect` — вызывается ли
2. Проверь `isRectIntersecting` — правильно ли вычисляет
3. Проверь bounds объектов — корректны ли координаты

### Выделение сбрасывается при Shift
1. Проверь `event.shiftKey` — распознаётся ли
2. Проверь `selectionBaseSelection` — сохраняется ли
3. Проверь порядок вызовов в `applySelectionFromRect`
