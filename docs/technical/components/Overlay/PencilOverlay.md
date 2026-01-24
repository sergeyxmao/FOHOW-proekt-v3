# PencilOverlay

Компонент полноэкранного режима рисования поверх доски.

## Расположение

```
src/components/Overlay/PencilOverlay.vue
```

## Описание

`PencilOverlay` — полноэкранный overlay для режима рисования, который позволяет пользователю:
- Рисовать карандашом и маркером
- Стирать ластиком
- Выделять и перемещать области
- Добавлять изображения
- Отменять/повторять действия (undo/redo)
- Масштабировать и панорамировать холст

## Props

| Prop | Тип | По умолчанию | Описание |
|------|-----|--------------|----------|
| `snapshot` | `String` | required | Base64-снимок доски для фона |
| `bounds` | `Object` | required | Границы области рисования (top, left, width, height) |
| `isModernTheme` | `Boolean` | `false` | Флаг тёмной темы интерфейса |

## Events

| Event | Payload | Описание |
|-------|---------|----------|
| `close` | `{ image: string \| null }` | Закрытие режима с экспортированным изображением |

## Composables

- **`usePencilHistory`** — история действий (undo/redo)
- **`usePencilSelection`** — выделение областей
- **`usePencilDrawing`** — рисование кистью, маркером, ластиком
- **`usePencilImages`** — работа с изображениями
- **`usePencilZoom`** — масштабирование и панорамирование

## Стили

### Основные классы

- `.pencil-overlay` — основной контейнер, фиксированное позиционирование на весь экран
- `.pencil-overlay__tools-bar` — нижняя панель инструментов (карандаш, маркер, ластик, выделение, изображения)
- `.pencil-overlay__undo-redo-bar` — верхняя панель с кнопками отмены/повтора
- `.pencil-overlay__undo-redo-btn` — кнопки undo/redo (квадратные 44x44px с иконками)
- `.pencil-overlay__tool-btn` — кнопки инструментов
- `.pencil-overlay__close-button` — кнопка закрытия

### Поддержка тем

Кнопки undo/redo поддерживают светлую и тёмную тему:

```css
/* Светлая тема */
.pencil-overlay__undo-redo-btn {
  background: rgba(255, 255, 255, 0.95);
  border-color: rgba(0, 0, 0, 0.08);
  color: #111827;
}

/* Тёмная тема (--modern) */
.pencil-overlay__undo-redo-btn--modern {
  background: rgba(28, 38, 58, 0.95);
  border-color: rgba(255, 255, 255, 0.1);
  color: #e5f3ff;
}
```

### Адаптивность

На экранах `max-width: 480px`:
- Размер кнопок undo/redo уменьшается с 44px до 40px
- Размер иконок уменьшается с 20px до 18px

## Автодобавление изображений

При клике на изображение в панели `ImagesPanel` (когда `placementTarget="drawing"`):
1. Панель автоматически закрывается
2. Изображение добавляется в центр холста как перемещаемый слой
3. Изображение остаётся выделенным (активным) для перемещения и масштабирования

Логика реализована в watcher'е `isImagesPanelOpen`:
- Отслеживает закрытие панели
- Проверяет наличие `stickersStore.pendingImageData`
- Использует `addDroppedImage()` для добавления как перемещаемого объекта

## История изменений

### 2026-01-24
- Добавлено автодобавление изображений при закрытии панели ImagesPanel в режиме рисования
- Изображения добавляются как перемещаемые объекты (с выделением) через `addDroppedImage()`
- Кнопки undo/redo переделаны на квадратные (44x44px) только с иконками
- Исправлена поддержка тёмной темы для кнопок undo/redo
- Стили унифицированы с MobileHeader (backdrop-filter, border-radius: 12px)

## См. также

- [MobileHeader](../Layout/MobileHeader.md)
- [usePencilHistory](../../composables/usePencilHistory.md)
- [usePencilDrawing](../../composables/usePencilDrawing.md)
