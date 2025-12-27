# useCanvasImageRenderer.js

> Рендеринг изображений на HTML Canvas с оптимизацией производительности

## Общая информация

| Параметр | Значение |
|----------|----------|
| **Файл** | `src/composables/useCanvasImageRenderer.js` |
| **Размер** | ~700 строк |
| **Создан** | Декабрь 2025 (рефакторинг CanvasBoard.vue) |
| **Зависимости** | imagesStore, viewport refs |

## Назначение

Этот composable отвечает за отрисовку всех изображений на холсте. 
Использует HTML Canvas API для производительного рендеринга большого количества изображений.

### Ключевые возможности:
- LRU кэширование загруженных изображений
- Offscreen canvas для предварительного рендеринга
- Виртуализация viewport (рендеринг только видимых)
- Экспорт в PNG
- Отрисовка selection border, resize handles, lock icons

## Константы

```javascript
const IMAGE_CACHE_LIMIT = 120        // Макс. изображений в кэше
const OFFSCREEN_CACHE_LIMIT = 80     // Макс. offscreen canvas в кэше
const IMAGE_VIRTUALIZATION_OVERSCAN = 800  // Дополнительная область рендеринга (px)
```

## API

### Входные параметры

```javascript
useCanvasImageRenderer({
  imagesStore,        // Pinia store с изображениями
  canvasContainerRef, // ref на DOM элемент контейнера
  zoomScale,          // ref - текущий масштаб
  zoomTranslateX,     // ref - смещение по X
  zoomTranslateY,     // ref - смещение по Y
  selectedImageIds,   // ref<Set> - выделенные изображения
  resizeState,        // ref - состояние resize (из useImageResize)
})
```

### Возвращаемые значения

```javascript
{
  // Методы рендеринга
  renderAllImages,              // () => Promise<void> - отрисовать все изображения
  renderAllImagesForExport,     // (bounds) => Promise<void> - для экспорта PNG
  scheduleRender,               // () => void - запланировать перерисовку

  // Кэширование
  invalidateImageCache,         // (imageId) => void - сбросить кэш изображения
  
  // Экспорт
  handlePngExportRenderAllImages, // (event) => void - обработчик события экспорта
  handlePngExportRenderComplete,  // () => void - завершение экспорта
  
  // Утилиты
  getVisibleCanvasRect,         // () => Rect - видимая область холста
  isImageWithinViewport,        // (imageObj, rect) => boolean - проверка видимости
}
```

## Внутренние функции

### Кэширование

| Функция | Описание |
|---------|----------|
| `createLruCache(limit)` | Создание LRU кэша с заданным лимитом |
| `loadImage(dataUrl)` | Загрузка изображения с кэшированием |
| `getImageVersion(imageObj)` | Получение версии для инвалидации |
| `createOffscreenCanvas(imageObj, img)` | Создание offscreen canvas |
| `getRenderableImage(imageObj)` | Получение готового к отрисовке изображения |

### Отрисовка

| Функция | Описание |
|---------|----------|
| `drawImageObject(ctx, imageObj)` | Отрисовка одного изображения |
| `drawImagePlaceholder(ctx, imageObj)` | Placeholder пока грузится |
| `drawSelectionBorder(ctx, imageObj)` | Рамка выделения |
| `drawResizeHandles(ctx, imageObj)` | 8 точек для resize |
| `drawRotationHandle(ctx, imageObj)` | Точка для вращения |
| `drawLockedBorder(ctx, imageObj)` | Рамка заблокированного |
| `drawLockIcon(ctx, imageObj)` | Иконка замка |
| `drawImageSelection(ctx, imageObj)` | Полная отрисовка выделения |

## Алгоритм рендеринга

```
1. Получить видимую область viewport
           │
2. Добавить overscan (800px с каждой стороны)
           │
3. Отфильтровать изображения по видимости
           │
4. Для каждого видимого изображения:
   ├── Проверить кэш
   ├── Если нет в кэше → загрузить
   ├── Отрисовать на canvas
   └── Если выделено → отрисовать selection
           │
5. Если идёт resize → отрисовать handles
```

## LRU Cache

**LRU (Least Recently Used)** — стратегия вытеснения из кэша.
Когда кэш полон, удаляется наименее недавно использованный элемент.

```javascript
// Структура кэша
{
  get(key),      // Получить элемент (перемещает в конец)
  set(key, value), // Добавить элемент
  delete(key),   // Удалить элемент
  clear(),       // Очистить кэш
  has(key),      // Проверить наличие
}
```

## Оптимизации производительности

### 1. Виртуализация
Рендерятся только изображения в видимой области + overscan.
Это критично при большом количестве изображений.

### 2. Offscreen Canvas
Изображения предварительно рендерятся на невидимый canvas.
При отрисовке копируется готовый результат — быстрее чем рендер с нуля.

### 3. Throttled rendering
`scheduleRender()` использует requestAnimationFrame для группировки перерисовок.

### 4. Версионирование
Каждое изображение имеет версию. При изменении версия инкрементируется,
кэш инвалидируется только для изменённого изображения.

## Использование в CanvasBoard.vue

```javascript
import { useCanvasImageRenderer } from '@/composables/useCanvasImageRenderer'

const {
  renderAllImages,
  scheduleRender,
  invalidateImageCache,
  handlePngExportRenderAllImages,
} = useCanvasImageRenderer({
  imagesStore,
  canvasContainerRef,
  zoomScale,
  zoomTranslateX,
  zoomTranslateY,
  selectedImageIds: computed(() => imagesStore.selectedIds),
  resizeState,
})

// Вызов при изменении viewport
watch([zoomScale, zoomTranslateX, zoomTranslateY], () => {
  scheduleRender()
})

// Экспорт в PNG
window.addEventListener('png-export:render-images', handlePngExportRenderAllImages)
```

## Связанные файлы

- `src/stores/images.js` — store с данными изображений
- `src/composables/useImageResize.js` — resize изображений
- `src/composables/useCanvasSelection.js` — выделение изображений

## Отладка

### Изображения не отображаются
1. Проверь `imagesStore.images` — есть ли данные
2. Проверь консоль на ошибки загрузки
3. Проверь `getVisibleCanvasRect()` — корректная ли область

### Мерцание при зуме
1. Проверь работу кэша — `imageCache.has(key)`
2. Возможно слишком частые вызовы render — проверь throttling

### Проблемы с памятью
1. Уменьши `IMAGE_CACHE_LIMIT`
2. Проверь что `invalidateImageCache` вызывается при удалении
