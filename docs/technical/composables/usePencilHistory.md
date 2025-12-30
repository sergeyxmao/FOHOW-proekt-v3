# usePencilHistory.js

> Управление историей рисования (undo/redo) в PencilOverlay

## Общая информация

| Параметр | Значение |
|----------|----------|
| **Файл** | `src/composables/usePencilHistory.js` |
| **Размер** | ~230 строк |
| **Создан** | Декабрь 2025 (рефакторинг PencilOverlay.vue) |
| **Зависимости** | Vue refs, canvas API |

## Назначение

Этот composable управляет историей изменений на canvas, позволяя
пользователю отменять (Ctrl+Z) и повторять (Ctrl+Y/Ctrl+Shift+Z) действия.

### Ключевые возможности:
- Сохранение снимков canvas в историю
- Откат к предыдущему состоянию (undo)
- Повтор отменённого действия (redo)
- Ограничение размера истории (MAX_HISTORY_LENGTH = 50)
- Дебаунс сохранения для оптимизации

## API

### Входные параметры

```javascript
usePencilHistory({
  drawingCanvasRef,   // ref на DOM элемент canvas
  canvasContext,      // ref на 2D контекст canvas
  canvasWidth,        // ref<number> - ширина canvas
  canvasHeight,       // ref<number> - высота canvas
  onBeforeApply,      // callback перед применением снимка
})
```

### Возвращаемые значения

```javascript
{
  // Состояние
  historyEntries,       // ref<Array> - массив снимков
  historyIndex,         // ref<number> - текущий индекс
  isApplyingHistory,    // ref<boolean> - применяется ли снимок

  // Computed
  canUndo,              // computed<boolean> - можно ли отменить
  canRedo,              // computed<boolean> - можно ли повторить

  // Методы
  captureCanvasData,    // () => string|null - захват canvas как dataURL
  scheduleHistorySave,  // (explicit?) => void - запланировать сохранение
  flushPendingHistorySave, // () => void - принудительное сохранение
  resetHistory,         // () => void - сброс истории
  undo,                 // () => void - отмена
  redo,                 // () => void - повтор
}
```

## Структура снимка

```javascript
snapshot = {
  canvas: string  // Data URL изображения canvas (PNG)
}
```

## Использование в PencilOverlay.vue

```javascript
import { usePencilHistory } from '@/composables/usePencilHistory'

const {
  canUndo,
  canRedo,
  scheduleHistorySave,
  resetHistory,
  undo,
  redo
} = usePencilHistory({
  drawingCanvasRef,
  canvasContext,
  canvasWidth,
  canvasHeight,
  onBeforeApply: () => cancelSelection()
})

// После каждого штриха
const finishStroke = () => {
  // ... код рисования
  scheduleHistorySave(true)
}

// Горячие клавиши
if (isModifier && key === 'z') {
  event.shiftKey ? redo() : undo()
}
```

## Связанные файлы

- `src/components/Overlay/PencilOverlay.vue` — основной компонент
- `src/composables/usePencilSelection.js` — использует onBeforeApply
