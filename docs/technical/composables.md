# Composables — Детальное описание

> Composables — это переиспользуемые функции с реактивным состоянием.
> Они содержат бизнес-логику, вынесенную из компонентов.

## Обзор архитектуры

```
CanvasBoard.vue (оркестратор, 3092 строки)
        │
        ├── useCanvasImageRenderer ──→ Рендеринг изображений
        ├── useAvatarConnections ────→ Avatar-соединения
        ├── useCanvasDrag ───────────→ Drag & drop
        ├── useActivePv ─────────────→ Active PV логика
        ├── useCanvasSelection ──────→ Выделение рамкой
        ├── useImageResize ──────────→ Resize изображений
        ├── useCanvasConnections ────→ Соединения карточек
        ├── useCanvasFocus ──────────→ Фокусировка
        ├── useNoteWindows ──────────→ Окна заметок
        ├── useCanvasContextMenus ───→ Контекстные меню
        └── usePanZoom ──────────────→ Зум и pan
```

---

## useCanvasImageRenderer.js (~700 строк)

### Назначение
Рендеринг изображений на HTML Canvas с оптимизацией производительности.

### Основные функции

| Функция | Описание |
|---------|----------|
| `renderAllImages()` | Отрисовка всех видимых изображений |
| `renderAllImagesForExport(bounds)` | Отрисовка для экспорта в PNG |
| `scheduleRender()` | Планирование перерисовки (debounced) |
| `invalidateImageCache(imageId)` | Сброс кэша конкретного изображения |
| `loadImage(dataUrl)` | Загрузка изображения с кэшированием |

### Оптимизации
- **LRU Cache** — кэширование загруженных изображений (лимит 120)
- **Offscreen Canvas** — предварительный рендеринг для быстрой отрисовки
- **Viewport Virtualization** — рендеринг только видимых изображений
- **Overscan** — дополнительная область 800px для плавного скролла

### Входные зависимости
```javascript
useCanvasImageRenderer({
  imagesStore,
  canvasContainerRef,
  zoomScale,
  zoomTranslateX,
  zoomTranslateY,
  selectedImageIds,
  resizeState,
})
```

---

## useAvatarConnections.js (~688 строк)

### Назначение
Управление соединениями между аватарами (особый тип визуальных связей).

### Основные функции

| Функция | Описание |
|---------|----------|
| `handleAvatarConnectionPointClick(data)` | Начало/завершение рисования соединения |
| `handleAvatarLineClick(event, connectionId)` | Выделение соединения |
| `handleAvatarLineDoubleClick(event, connectionId)` | Добавление control point |
| `handleAvatarContextMenu(event, avatarId)` | Контекстное меню аватара |
| `startAvatarAnimation(avatarId)` | Запуск анимации пульсации |

### Состояние
```javascript
{
  avatarConnectionStart,      // Начальная точка соединения
  selectedAvatarConnectionIds, // Выделенные соединения
  avatarContextMenu,          // Данные контекстного меню
  avatarContextMenuPosition,  // Позиция меню
  animatedAvatarIds,          // ID аватаров с анимацией
}
```

---

## useCanvasDrag.js (~636 строк)

### Назначение
Drag & drop для всех объектов на холсте.

### Основные функции

| Функция | Описание |
|---------|----------|
| `startDrag(event, targets)` | Начало перетаскивания |
| `handleDrag(event)` | Обработка движения (throttled 16ms) |
| `endDrag()` | Завершение перетаскивания |

### Поддерживаемые объекты
- Карточки (одиночные и группы)
- Стикеры
- Изображения

### Интеграции
- **Guides** — привязка к направляющим при перемещении
- **History** — сохранение состояния для Undo
- **Avatar Connections** — обновление соединений при перемещении

### Входные зависимости
```javascript
useCanvasDrag({
  cardsStore,
  stickersStore,
  imagesStore,
  historyStore,
  zoomScale,
  screenToCanvas,
  activeGuides,
  resetActiveGuides,
  collectDragTargets,
})
```

---

## useActivePv.js (~450 строк)

### Назначение
Логика Active PV (Product Volume) — визуализация распространения баланса по дереву карточек.

### Основные функции

| Функция | Описание |
|---------|----------|
| `handleActivePvButtonClick(event)` | Обработка клика на кнопку PV |
| `applyActivePvPropagation(cardId, options)` | Применение распространения |
| `animateBalancePropagation(cardId, side)` | Анимация "волны" по соединениям |
| `highlightActivePvChange(cardId)` | Подсветка изменённой карточки |
| `cancelAllActiveAnimations()` | Отмена всех анимаций |

### Анимации
- Подсветка карточки (flash) — 650ms
- Волна по соединениям — последовательная анимация
- CSS классы для визуальных эффектов

---

## useCanvasSelection.js (~373 строки)

### Назначение
Выделение объектов прямоугольной рамкой (rectangular/marquee selection).

### Основные функции

| Функция | Описание |
|---------|----------|
| `startSelection(event)` | Начало выделения |
| `updateSelection(event)` | Обновление рамки при движении мыши |
| `endSelection()` | Завершение, применение выделения |
| `clearSelection()` | Сброс выделения |

### Состояние
```javascript
{
  isSelecting,        // boolean — идёт ли выделение
  selectionRect,      // { x, y, width, height } — рамка
  selectedCardIds,    // Set — выделенные карточки
  selectedStickerIds, // Set — выделенные стикеры
  selectedImageIds,   // Set — выделенные изображения
}
```

### Логика выделения
- Проверка пересечения bounding box объекта с рамкой
- Поддержка Shift для добавления к существующему выделению

---

## useImageResize.js (~369 строк)

### Назначение
Изменение размера изображений на холсте.

### Основные функции

| Функция | Описание |
|---------|----------|
| `startResize(event, imageId, handle)` | Начало resize |
| `handleResize(event)` | Обработка движения (throttled) |
| `endResize()` | Завершение resize |

### Handles (8 направлений)
```
[nw] ─── [n] ─── [ne]
  │               │
 [w]     img     [e]
  │               │
[sw] ─── [s] ─── [se]
```

### Модификаторы
- **Shift** — переключение режима сохранения пропорций
- **По умолчанию** — углы сохраняют пропорции, стороны — нет

---

## useCanvasConnections.js (~226 строк)

### Назначение
Соединения (линии) между карточками.

### Основные функции

| Функция | Описание |
|---------|----------|
| `startConnection(cardId, side)` | Начало рисования соединения |
| `updatePreviewLine(mousePos)` | Обновление preview линии |
| `finishConnection(targetCardId, side)` | Завершение соединения |
| `cancelConnection()` | Отмена рисования |
| `handleLineClick(event, connectionId)` | Выделение соединения |
| `handleControlPointDrag(event)` | Перетаскивание control point |

### Состояние
```javascript
{
  connectionStart,       // { cardId, side } — начало
  isDrawingLine,         // boolean
  previewLine,           // { from, to } — preview
  selectedConnectionIds, // выделенные соединения
  draggingControlPoint,  // перетаскиваемая точка
}
```

---

## useCanvasFocus.js (~180 строк)

### Назначение
Центрирование viewport на конкретном объекте.

### Основные функции

| Функция | Описание |
|---------|----------|
| `focusCardOnCanvas(cardId)` | Центрировать на карточке |
| `focusStickerOnCanvas(stickerId)` | Центрировать на стикере |
| `focusAnchorOnCanvas(anchorId)` | Центрировать на якоре |
| `getBranchDescendants(cardId, filter)` | Получить потомков в дереве |

### Логика
1. Найти объект по ID
2. Вычислить его центр
3. Анимированно переместить viewport

---

## useNoteWindows.js (~170 строк)

### Назначение
Управление окнами заметок (notes) для карточек.

### Основные функции

| Функция | Описание |
|---------|----------|
| `openNoteForCard(card, options)` | Открыть окно заметки |
| `closeNoteForCard(card, options)` | Закрыть окно |
| `syncNoteWindowWithCard(cardId)` | Синхронизировать позицию |
| `syncAllNoteWindows()` | Синхронизировать все окна |
| `handleNoteWindowRegister(cardId, instance)` | Регистрация ref окна |

### Позиционирование
- Окно заметки привязано к карточке
- При перемещении карточки — окно следует
- При зуме — позиция пересчитывается

---

## useCanvasContextMenus.js (~151 строка)

### Назначение
Контекстные меню (правый клик) для объектов холста.

### Основные функции

| Функция | Описание |
|---------|----------|
| `showImageContextMenu(event, imageId)` | Меню для изображения |
| `showStageContextMenu(event)` | Меню для пустого холста |
| `closeContextMenus()` | Закрыть все меню |
| `handleClickOutside(event)` | Закрытие при клике вне |

### Состояние
```javascript
{
  imageContextMenu,         // { imageId } или null
  imageContextMenuPosition, // { x, y }
  stageContextMenu,         // boolean
  stageContextMenuPosition, // { x, y }
}
```

---

## usePanZoom.js (существовал ранее)

### Назначение
Зум и панорамирование холста.

### Основные функции

| Функция | Описание |
|---------|----------|
| `handleWheel(event)` | Зум колёсиком мыши |
| `handlePanStart(event)` | Начало перетаскивания холста |
| `handlePanMove(event)` | Движение при pan |
| `handlePanEnd()` | Завершение pan |
| `setZoom(scale, centerX, centerY)` | Установить зум программно |
| `resetZoom()` | Сброс к 100% |
| `fitToContent()` | Вписать содержимое в viewport |

### Возвращаемые значения
```javascript
{
  zoomScale,      // ref — текущий масштаб (0.1 - 3.0)
  zoomTranslateX, // ref — смещение X
  zoomTranslateY, // ref — смещение Y
  isPanning,      // ref — идёт ли pan
  // ... функции
}
```

---

## Паттерн использования composables

```javascript
// В компоненте (например CanvasBoard.vue)
import { useCanvasDrag } from '@/composables/useCanvasDrag'
import { useCanvasSelection } from '@/composables/useCanvasSelection'

// Инициализация с зависимостями
const {
  dragState,
  startDrag,
  handleDrag,
  endDrag,
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
})

const {
  isSelecting,
  selectionRect,
  startSelection,
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

// Использование в template
<div @mousedown="handlePointerDown">
  <div v-if="isSelecting" :style="selectionRectStyle" />
</div>
```
