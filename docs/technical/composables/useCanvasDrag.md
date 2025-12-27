# useCanvasDrag.js

> Drag & drop для всех объектов на холсте

## Общая информация

| Параметр | Значение |
|----------|----------|
| **Файл** | `src/composables/useCanvasDrag.js` |
| **Размер** | ~636 строк |
| **Создан** | Декабрь 2025 (рефакторинг CanvasBoard.vue) |
| **Зависимости** | stores (cards, stickers, images, history), guides |

## Назначение

Этот composable управляет перетаскиванием объектов на холсте.
Поддерживает одиночное и групповое перемещение с привязкой к направляющим.

### Ключевые возможности:
- Drag карточек (одиночных и групп)
- Drag стикеров
- Drag изображений
- Интеграция с guides (направляющими)
- Сохранение в историю для Undo
- Обновление связанных соединений

## API

### Входные параметры

```javascript
useCanvasDrag({
  cardsStore,           // Pinia store карточек
  stickersStore,        // Pinia store стикеров
  imagesStore,          // Pinia store изображений
  historyStore,         // Store истории для Undo
  zoomScale,            // ref - текущий масштаб
  screenToCanvas,       // (x, y) => {x, y} - конвертация координат
  activeGuides,         // ref - активные направляющие
  resetActiveGuides,    // () => void - сброс направляющих
  collectDragTargets,   // (id, event) => targets - сбор целей drag
  collectStickerDragTargets, // Для стикеров
  collectImageDragTargets,   // Для изображений
})
```

### Возвращаемые значения

```javascript
{
  // Состояние
  dragState,             // ref - текущее состояние drag
  isDragging,            // computed<boolean> - идёт ли drag
  suppressNextCardClick, // ref<boolean> - подавить следующий клик
  
  // Методы
  startDrag,            // (event, targets) => void
  handleDrag,           // (event) => void - throttled
  endDrag,              // () => void
  
  // Для изображений
  startImageDrag,       // ({ event, imageId, interactionType }) => void
}
```

## Структура dragState

```javascript
dragState = {
  // Начальная позиция мыши
  startX: number,
  startY: number,
  
  // Текущие смещения
  offsetX: number,
  offsetY: number,
  
  // Перетаскиваемые объекты
  cards: [
    { id, startX, startY }
  ],
  stickers: [
    { id, startX, startY }
  ],
  images: [
    { id, startX, startY }
  ],
  
  // Снимки соединений аватаров
  avatarConnectionSnapshots: Map,
  
  // Флаги
  hasMoved: boolean,      // Было ли реальное движение
  primaryCardId: string,  // Главная карточка (для guides)
}
```

## Алгоритм drag

```
1. mousedown на объекте
           │
2. startDrag() - инициализация
   ├── Собрать все выделенные объекты
   ├── Сохранить начальные позиции
   └── Сделать снимки соединений
           │
3. mousemove (throttled 16ms)
   ├── Вычислить смещение
   ├── Применить к screenToCanvas
   ├── Вычислить snap к guides
   ├── Обновить позиции объектов
   └── Показать активные guides
           │
4. mouseup
   ├── Сохранить в историю
   ├── Обновить соединения на сервере
   └── Очистить dragState
```

## Интеграция с Guides

При перемещении объекты "прилипают" к направляющим:

```javascript
// Вычисление snap
const { snapX, snapY, guides } = computeGuideSnap(
  primaryCardId,
  proposedX,
  proposedY
)

// Применение
card.x = snapX ?? proposedX
card.y = snapY ?? proposedY

// Отображение линий
activeGuides.value = guides
```

## Групповой drag

Когда выделено несколько объектов:

1. Все выделенные объекты собираются в `dragState.cards/stickers/images`
2. Смещение применяется ко всем одинаково
3. Guides вычисляются относительно "главного" объекта (который схватили)

```javascript
// Пример сбора целей
collectDragTargets(cardId, event) {
  const targets = { cards: [], stickers: [], images: [] }
  
  if (event.shiftKey || cardsStore.selectedIds.has(cardId)) {
    // Все выделенные
    targets.cards = cardsStore.selectedCards
    targets.stickers = stickersStore.selectedStickers
    targets.images = imagesStore.selectedImages
  } else {
    // Только один
    targets.cards = [cardsStore.getById(cardId)]
  }
  
  return targets
}
```

## Throttling

`handleDrag` вызывается с throttle 16ms (~60fps):

```javascript
const handleDrag = useThrottleFn(handleDragInternal, 16, true, false)
```

Это предотвращает:
- Избыточные перерисовки
- Лаги при быстром движении
- Перегрузку CPU

## Использование в CanvasBoard.vue

```javascript
import { useCanvasDrag } from '@/composables/useCanvasDrag'

const {
  dragState,
  isDragging,
  suppressNextCardClick,
  startDrag,
  handleDrag,
  endDrag,
  startImageDrag,
} = useCanvasDrag({
  cardsStore,
  stickersStore,
  imagesStore,
  historyStore,
  zoomScale,
  screenToCanvas,
  activeGuides,
  resetActiveGuides,
  collectDragTargets,
  collectStickerDragTargets,
  collectImageDragTargets,
})

// Обработка событий
const handlePointerDown = (event) => {
  // ... определение типа объекта
  startDrag(event, targets)
}

window.addEventListener('pointermove', handleDrag)
window.addEventListener('pointerup', endDrag)
```

## suppressNextCardClick

Флаг для предотвращения ложных кликов после drag:

```javascript
// После drag
endDrag() {
  if (dragState.value.hasMoved) {
    suppressNextCardClick.value = true
    setTimeout(() => {
      suppressNextCardClick.value = false
    }, 0)
  }
}

// При клике
handleCardClick(event, cardId) {
  if (suppressNextCardClick.value) {
    return // Игнорируем клик после drag
  }
  // ... обработка клика
}
```

## Связанные файлы

- `src/stores/cards.js` — позиции карточек
- `src/stores/stickers.js` — позиции стикеров
- `src/stores/images.js` — позиции изображений
- `src/stores/history.js` — Undo/Redo
- `src/composables/useAvatarConnections.js` — обновление соединений

## Отладка

### Объекты не перетаскиваются
1. Проверь что `startDrag` вызывается
2. Проверь `dragState.value` — не null ли
3. Проверь что событие не перехвачено другим обработчиком

### Объекты "прыгают"
1. Проверь `screenToCanvas` — корректно ли конвертирует координаты
2. Проверь `zoomScale` — актуальное ли значение
3. Проверь snap к guides — не слишком ли агрессивный

### Guides не показываются
1. Проверь `activeGuides.value`
2. Проверь что `computeGuideSnap` вызывается
3. Проверь рендеринг линий guides в template

### История не работает
1. Проверь что `historyStore.saveState()` вызывается в `endDrag`
2. Проверь что состояние изменилось (`hasMoved === true`)
