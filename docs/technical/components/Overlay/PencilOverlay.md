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
- Добавлять текстовые надписи
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
- `.pencil-overlay__tools-bar` — нижняя панель инструментов (карандаш, маркер, ластик, выделение, текст, изображения)
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

## Инструмент "Текст"

Инструмент "Текст" позволяет добавлять текстовые надписи на canvas.

### Использование

1. Нажать кнопку "Aa" в панели инструментов
2. Выбрать "Выбрать текст" или настроить параметры:
   - **Цвет** — цвет текста (по умолчанию: чёрный)
   - **Размер** — размер шрифта от 16 до 72px (по умолчанию: 24px)
3. Кликнуть на холст — появится поле ввода
4. Ввести текст
5. Нажать **Enter** или кликнуть вне поля — текст рисуется на canvas
6. Нажать **Escape** — отмена ввода

### Технические детали

**Переменные состояния:**
```javascript
const textInputRef = ref(null);      // Ссылка на input элемент
const textColor = ref('#000000');    // Цвет текста
const textSize = ref(24);            // Размер шрифта
const isTypingText = ref(false);     // Флаг активного ввода
const textInputPosition = ref(null); // Позиция {x, y} в координатах canvas
const textInputReady = ref(false);   // Защита от преждевременного blur
```

**Ключевые функции:**
- `startTextInput(point)` — инициализирует поле ввода в точке клика
- `commitText()` — рисует текст на canvas и закрывает поле ввода
- `cancelText()` — отменяет ввод без рисования

**Интеграция с историей:**
- Перед рисованием текста вызывается `scheduleHistorySave()`
- Undo/Redo работает корректно для текстовых надписей

**CSS классы:**
- `.pencil-overlay__board--text` — курсор `text` при активном инструменте
- `.pencil-overlay__text-input` — поле ввода с пунктирной рамкой

### Защита от преждевременного blur

При появлении input элемента может происходить преждевременный blur из-за других событий (pointerup, click). Для защиты используется флаг `textInputReady`:
- Устанавливается в `true` через 100ms после focus()
- `commitText()` игнорирует вызовы пока `textInputReady === false`

## История изменений

### 2026-02-02: Добавлен инструмент "Текст"

**Функциональность:**
- Новая кнопка "Aa" в панели инструментов
- Настройки: цвет и размер шрифта (16-72px)
- Клик на canvas создаёт поле ввода в точке клика
- Enter/blur подтверждает текст, Escape отменяет
- Полная интеграция с системой Undo/Redo

**Файлы:**
- `src/components/Overlay/PencilOverlay.vue` — реализация инструмента
- `docs/technical/components/Overlay/PencilOverlay.md` — документация

### 2026-01-26: Исправление системы undo/redo для инструментов рисования

**Проблема:** При рисовании карандашом, маркером или ластиком кнопка "Отмена" (undo) оставалась неактивной (disabled). Ctrl+Z не работал после рисования линий. При этом другие действия (добавление картинки, перемещение выделения) корректно сохранялись в историю.

**Техническая причина:**
- `usePencilDrawing` инициализировался с `scheduleHistorySave: null`
- После инициализации `usePencilHistory` функция `scheduleHistorySave` не передавалась обратно в `usePencilDrawing`
- В `finishStroke()` проверка `if (hasStrokeChanges.value && scheduleHistorySave)` всегда возвращала `false`, потому что `scheduleHistorySave` оставался `null`

**Решение:**
- В `usePencilDrawing.js` добавлен ref `scheduleHistorySaveRef` и метод `setScheduleHistorySave(fn)` для установки функции после инициализации
- В `PencilOverlay.vue` добавлен вызов `setScheduleHistorySave(scheduleHistorySave)` после инициализации `usePencilHistory`
- Это решает проблему циклической зависимости между composables

**Поведение после исправления:**
- После рисования линии кнопка "Отмена" становится активной
- Ctrl+Z корректно отменяет нарисованные штрихи
- Ctrl+Shift+Z / Ctrl+Y повторяет отменённые действия
- Работает для всех инструментов: brush (карандаш), marker (маркер), eraser (ластик)

**Файлы:**
- `src/composables/usePencilDrawing.js` — добавлен `scheduleHistorySaveRef` и `setScheduleHistorySave()`
- `src/components/Overlay/PencilOverlay.vue` — добавлен вызов `setScheduleHistorySave()`
- `docs/technical/components/Overlay/PencilOverlay.md` — обновлена документация

**Коммит:** `fix: undo/redo not working for pencil drawing tools`

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
