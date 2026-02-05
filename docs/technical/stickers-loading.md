# Загрузка стикеров

## Описание функции

Стикеры загружаются на доску двумя способами:

1. **loadStickers (из JSON)** — быстрая загрузка из сохраненного контента доски
2. **fetchStickers (из API/БД)** — актуальная загрузка из базы данных

Оба механизма работают вместе для обеспечения быстрого отображения и актуальности данных.

## Расположение файлов

| Файл | Назначение |
|------|------------|
| `src/stores/stickers.js` | Pinia store с методами `loadStickers` и `fetchStickers` |
| `src/App.vue` | Вызов `loadStickers` при открытии доски (из JSON) |
| `src/components/Canvas/CanvasBoard.vue` | Вызов `fetchStickers` в watcher на смену доски |

## Механизмы загрузки

### 1. loadStickers (из JSON контента доски)

Вызывается в `App.vue` при открытии доски из сохраненного JSON-контента:

```javascript
// App.vue → loadBoard()
const loadBoard = async (boardId) => {
  const board = await boardsStore.fetchBoard(boardId)
  const content = JSON.parse(board.content || '{}')

  // Загрузка стикеров из JSON
  if (content.stickers) {
    stickersStore.loadStickers(content.stickers)
  }
}
```

**Особенности:**
- Быстрая загрузка (данные уже в JSON)
- Может содержать устаревшие данные
- Не содержит стикеры, добавленные после последнего сохранения доски

### 2. fetchStickers (из API/БД)

Вызывается в `CanvasBoard.vue` при монтировании и смене доски:

```javascript
// CanvasBoard.vue → onMounted
if (boardStore.currentBoardId) {
  stickersStore.fetchStickers(boardStore.currentBoardId)
}

// CanvasBoard.vue → watch на boardStore.currentBoardId
watch(() => boardStore.currentBoardId, (newBoardId, oldBoardId) => {
  if (!newBoardId) {
    anchorsStore.reset();
    stickersStore.clearStickers();
    return;
  }

  loadAnchorsForBoard(newBoardId);
  stickersStore.fetchStickers(newBoardId).catch(err => {
    console.error('Ошибка загрузки стикеров при смене доски:', err);
  });
}, { immediate: true });
```

**Особенности:**
- Загрузка из БД через API
- Всегда актуальные данные
- Полностью перезаписывает массив `stickers.value`

## Порядок загрузки при открытии доски

1. **App.vue loadBoard()** → вызывает `stickersStore.loadStickers(stickersData)`
   - Стикеры из JSON появляются на canvas

2. **CanvasBoard.vue watcher** → вызывает `stickersStore.fetchStickers(boardId)`
   - Актуальные стикеры из БД перезаписывают данные из JSON

Дублирования не происходит, так как `fetchStickers` полностью заменяет массив `stickers.value`.

## Методы store

### loadStickers(stickersData)

```javascript
// src/stores/stickers.js
loadStickers(stickersData) {
  if (Array.isArray(stickersData)) {
    stickers.value = stickersData
  }
}
```

Синхронная загрузка из массива (обычно из JSON).

### fetchStickers(boardId)

```javascript
// src/stores/stickers.js
async fetchStickers(boardId) {
  const response = await fetch(`/api/boards/${boardId}/stickers`)
  const data = await response.json()
  stickers.value = data
}
```

Асинхронная загрузка из API.

### clearStickers()

```javascript
// src/stores/stickers.js
clearStickers() {
  stickers.value = []
}
```

Очистка стикеров при смене доски или размонтировании.

## Жизненный цикл стикеров

```
Открытие доски:
┌─────────────────────────────────────────────────────────────────┐
│ App.vue loadBoard()                                             │
│   ├── loadStickers(fromJSON) → стикеры появляются быстро        │
│   └── ...                                                       │
│                                                                 │
│ CanvasBoard.vue                                                 │
│   ├── onMounted / watcher                                       │
│   │     └── fetchStickers(boardId) → актуальные из БД           │
│   └── ...                                                       │
└─────────────────────────────────────────────────────────────────┘

Смена доски (без перезагрузки страницы):
┌─────────────────────────────────────────────────────────────────┐
│ CanvasBoard.vue watcher(boardStore.currentBoardId)              │
│   ├── if (!newBoardId) clearStickers()                          │
│   └── fetchStickers(newBoardId) → стикеры новой доски из БД     │
└─────────────────────────────────────────────────────────────────┘

Закрытие доски / размонтирование:
┌─────────────────────────────────────────────────────────────────┐
│ CanvasBoard.vue onBeforeUnmount()                               │
│   └── clearStickers()                                           │
└─────────────────────────────────────────────────────────────────┘
```

## API эндпоинт

### Получение стикеров доски

```
GET /api/boards/:boardId/stickers
```

Возвращает массив всех стикеров указанной доски из базы данных.

## История изменений

### 2026-02-05
- **Добавлено**: Загрузка стикеров из БД при смене доски
  - Добавлен вызов `stickersStore.fetchStickers(newBoardId)` в watcher на `boardStore.currentBoardId`
  - Добавлен вызов `stickersStore.clearStickers()` при сбросе доски (`!newBoardId`)
  - Причина проблемы: при переключении досок без перезагрузки страницы стикеры не загружались, так как `onMounted` не вызывается повторно
