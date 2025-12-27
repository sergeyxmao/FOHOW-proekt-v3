# useImageResize.js

> Изменение размера изображений на холсте

## Общая информация

| Параметр | Значение |
|----------|----------|
| **Файл** | `src/composables/useImageResize.js` |
| **Размер** | ~369 строк |
| **Создан** | Декабрь 2025 (рефакторинг CanvasBoard.vue) |
| **Зависимости** | imagesStore, historyStore |

## Назначение

Этот composable реализует изменение размера изображений с помощью 
8 resize handles (4 угла + 4 стороны).

### Ключевые возможности:
- Resize за углы с сохранением пропорций
- Resize за стороны без сохранения пропорций
- Модификатор Shift для переключения режима
- Ограничения min/max размера
- Сохранение в историю для Undo

## API

### Входные параметры

```javascript
useImageResize({
  imagesStore,      // Pinia store изображений
  historyStore,     // Store истории для Undo
  zoomScale,        // ref - текущий масштаб
  screenToCanvas,   // (x, y) => {x, y} - конвертация координат
})
```

### Возвращаемые значения

```javascript
{
  // Состояние
  resizeState,      // ref<ResizeState|null> - текущее состояние resize
  isResizing,       // computed<boolean> - идёт ли resize
  
  // Методы
  startResize,      // (event, imageId, handle) => void
  handleResize,     // (event) => void - throttled
  endResize,        // () => void
  
  // Утилиты
  getResizeHandle,  // (x, y, image) => HandleType|null
}
```

## Структура resizeState

```javascript
resizeState = {
  imageId: string,           // ID изображения
  handle: HandleType,        // Тип handle ('nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w')
  
  // Начальные размеры
  initialWidth: number,
  initialHeight: number,
  initialX: number,
  initialY: number,
  
  // Aspect ratio
  aspectRatio: number,       // width / height
  keepAspectRatio: boolean,  // Сохранять ли пропорции
  
  // Начальная позиция мыши
  startX: number,
  startY: number,
}
```

## Типы handles

```
┌─────────────────────────────────────┐
│ nw          n           ne          │
│  ●──────────●──────────●            │
│  │                     │            │
│  │                     │            │
│ w●                     ●e           │
│  │                     │            │
│  │                     │            │
│  ●──────────●──────────●            │
│ sw          s           se          │
└─────────────────────────────────────┘
```

| Handle | Описание | Сохраняет пропорции |
|--------|----------|---------------------|
| `nw` | Северо-запад (угол) | Да (по умолчанию) |
| `n` | Север (сторона) | Нет |
| `ne` | Северо-восток (угол) | Да (по умолчанию) |
| `e` | Восток (сторона) | Нет |
| `se` | Юго-восток (угол) | Да (по умолчанию) |
| `s` | Юг (сторона) | Нет |
| `sw` | Юго-запад (угол) | Да (по умолчанию) |
| `w` | Запад (сторона) | Нет |

## Алгоритм resize

```
1. mousedown на handle
           │
2. startResize(event, imageId, handle)
   ├── Определить тип handle
   ├── Сохранить начальные размеры
   ├── Вычислить aspectRatio
   └── Определить режим пропорций
           │
3. mousemove (throttled 16ms)
   ├── Вычислить дельту движения
   ├── Применить дельту к размерам
   ├── Если keepAspectRatio - скорректировать
   ├── Применить min/max ограничения
   └── Обновить изображение
           │
4. mouseup
   ├── Сохранить в историю
   └── Очистить resizeState
```

## Логика изменения размера

### Угловые handles (сохранение пропорций)

```javascript
if (isCornerHandle(handle)) {
  // Вычисляем новый размер
  let newWidth = initialWidth + deltaX
  let newHeight = initialHeight + deltaY
  
  if (keepAspectRatio) {
    // Выбираем доминирующее изменение
    const widthRatio = newWidth / initialWidth
    const heightRatio = newHeight / initialHeight
    
    if (Math.abs(widthRatio - 1) > Math.abs(heightRatio - 1)) {
      // Ширина изменилась больше - подгоняем высоту
      newHeight = newWidth / aspectRatio
    } else {
      // Высота изменилась больше - подгоняем ширину
      newWidth = newHeight * aspectRatio
    }
  }
}
```

### Боковые handles (одна ось)

```javascript
if (handle === 'n' || handle === 's') {
  // Только высота
  newHeight = initialHeight + deltaY
  newWidth = initialWidth // Не меняется
}

if (handle === 'e' || handle === 'w') {
  // Только ширина
  newWidth = initialWidth + deltaX
  newHeight = initialHeight // Не меняется
}
```

## Модификатор Shift

Shift переключает режим сохранения пропорций:

```javascript
handleResize(event) {
  const keepAspectRatio = event.shiftKey
    ? !resizeState.value.defaultKeepAspectRatio  // Инвертируем
    : resizeState.value.defaultKeepAspectRatio   // По умолчанию
  
  // Применяем
  applyResize(keepAspectRatio)
}
```

| Handle | Без Shift | С Shift |
|--------|-----------|---------|
| Угловой | Пропорционально | Свободно |
| Боковой | Свободно | Пропорционально |

## Ограничения размера

```javascript
const MIN_WIDTH = 20
const MIN_HEIGHT = 20
const MAX_WIDTH = 5000
const MAX_HEIGHT = 5000

function clampSize(width, height) {
  return {
    width: Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, width)),
    height: Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, height)),
  }
}
```

## Обновление позиции при resize

При resize за верхние и левые handles нужно корректировать позицию:

```javascript
if (handle.includes('n')) {
  // Верхний край - смещаем Y
  image.y = initialY - (newHeight - initialHeight)
}

if (handle.includes('w')) {
  // Левый край - смещаем X
  image.x = initialX - (newWidth - initialWidth)
}
```

## Использование в CanvasBoard.vue

```javascript
import { useImageResize } from '@/composables/useImageResize'

const {
  resizeState,
  isResizing,
  startResize,
  handleResize,
  endResize,
  getResizeHandle,
} = useImageResize({
  imagesStore,
  historyStore,
  zoomScale,
  screenToCanvas,
})

// Определение типа взаимодействия
const handleImageMouseDown = (event, imageId) => {
  const handle = getResizeHandle(event.clientX, event.clientY, image)
  
  if (handle) {
    startResize(event, imageId, handle)
  } else {
    // Обычный drag
    startDrag(event, imageId)
  }
}

window.addEventListener('pointermove', (event) => {
  if (isResizing.value) {
    handleResize(event)
  }
})

window.addEventListener('pointerup', () => {
  if (isResizing.value) {
    endResize()
  }
})
```

## Курсор при наведении

```javascript
const getCursorForHandle = (handle) => {
  const cursors = {
    'nw': 'nwse-resize',
    'n': 'ns-resize',
    'ne': 'nesw-resize',
    'e': 'ew-resize',
    'se': 'nwse-resize',
    's': 'ns-resize',
    'sw': 'nesw-resize',
    'w': 'ew-resize',
  }
  return cursors[handle] || 'default'
}
```

## Связанные файлы

- `src/stores/images.js` — данные изображений
- `src/stores/history.js` — Undo/Redo
- `src/composables/useCanvasImageRenderer.js` — отрисовка handles

## Отладка

### Resize не работает
1. Проверь `getResizeHandle` — определяется ли handle
2. Проверь `resizeState.value` — не null ли
3. Проверь что изображение не заблокировано (`locked: true`)

### Пропорции не сохраняются
1. Проверь `aspectRatio` — правильно ли вычислен
2. Проверь `keepAspectRatio` — правильное ли значение
3. Проверь логику в `applyResize`

### Изображение "прыгает"
1. Проверь конвертацию координат `screenToCanvas`
2. Проверь корректировку позиции для nw/n/ne/w handles
3. Проверь `zoomScale` — актуален ли
