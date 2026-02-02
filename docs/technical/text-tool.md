# Инструмент "Текст" (Text Tool)

## Описание

Инструмент для добавления текстовых надписей на canvas в режиме рисования (PencilOverlay).

## Расположение файлов

- Основной файл: `src/components/Overlay/PencilOverlay.vue`
- Документация компонента: `docs/technical/components/Overlay/PencilOverlay.md`

## Как использовать

1. Открыть режим рисования (кнопка карандаша на доске)
2. Нажать кнопку "Aa" в панели инструментов
3. Настроить цвет и размер в выпадающем меню (опционально)
4. Кликнуть на canvas — появится поле ввода
5. Ввести текст и нажать **Enter**
6. В режиме превью можно:
   - **Перетащить текст** в нужное место (тянуть за центр рамки)
   - **Изменить размер** за угловые маркеры (пропорционально)
7. **Enter** или клик вне рамки — текст вклеивается на canvas
8. **Escape** — отмена на любом этапе

## Режимы работы

```
idle → typing → preview → commit (canvas)
  ↑       ↓        ↓
  └── Escape ──────┘
```

| Режим | Описание |
|-------|----------|
| `idle` | Инструмент выбран, ожидание клика на canvas |
| `typing` | Поле ввода открыто, пользователь вводит текст |
| `preview` | Текст отображается в рамке с маркерами для перемещения/масштабирования |

## Технические детали

### Переменные состояния

```javascript
const textMode = ref('idle');      // 'idle' | 'typing' | 'preview'
const textValue = ref('');         // Введённый текст
const textPosition = ref({ x: 0, y: 0 }); // Позиция в координатах canvas
const textScale = ref(1);          // Масштаб (0.5 - 3.0)
const textColor = ref('#000000');  // Цвет текста
const textSize = ref(24);          // Базовый размер шрифта (px)

const isDraggingText = ref(false); // Флаг перетаскивания
const isResizingText = ref(false); // Флаг масштабирования
```

### Ключевые функции

| Функция | Описание |
|---------|----------|
| `startTextInput(point)` | Начать ввод текста (idle → typing) |
| `enterTextPreview()` | Перейти в режим превью (typing → preview) |
| `commitText()` | Отрисовать текст на canvas (preview → idle) |
| `cancelText()` | Отменить ввод (любой режим → idle) |
| `startDragText(event)` | Начать перетаскивание текста |
| `startResizeText(corner, event)` | Начать масштабирование |

### CSS классы

| Класс | Описание |
|-------|----------|
| `.pencil-overlay__board--text` | Курсор `text` при активном инструменте |
| `.pencil-overlay__text-input` | Поле ввода с яркой синей рамкой |
| `.pencil-overlay__text-preview` | Контейнер превью с перетаскиванием |
| `.pencil-overlay__text-preview-content` | Текст внутри превью |
| `.pencil-overlay__resize-handle` | Угловые маркеры масштабирования |
| `.pencil-overlay__resize-handle--nw/ne/sw/se` | Позиционирование маркеров |

### Интеграция с историей

- Перед отрисовкой текста вызывается `scheduleHistorySave()`
- Undo/Redo работает корректно для текстовых надписей
- При отмене (Undo) текст полностью удаляется с canvas

## Настройки

| Параметр | Диапазон | По умолчанию |
|----------|----------|--------------|
| Цвет текста | любой (color picker) | #000000 |
| Размер шрифта | 16-72px | 24px |
| Масштаб в превью | 0.5x - 3.0x | 1.0x |

## Пропорциональное масштабирование

Масштабирование работает по диагонали:
- Тянем за угловой маркер
- Delta = среднее от deltaX и deltaY
- Новый масштаб = начальный масштаб + delta / 100
- Ограничение: 0.5 ≤ scale ≤ 3.0

```javascript
const delta = (deltaX + deltaY) / 2;
textScale.value = Math.max(0.5, Math.min(3, resizeStartScale + delta / 100));
```

## История изменений

### 2026-02-02: Добавлен режим превью

- Три режима работы: idle → typing → preview
- Перетаскивание текста за центр рамки
- Пропорциональное масштабирование за угловые маркеры (0.5x - 3x)
- Улучшенный дизайн рамок (яркая синяя рамка, белый фон, тень)
- Enter в превью → текст рисуется на canvas
- Escape в любом режиме → отмена

### 2026-02-02: Создание инструмента

- Базовая реализация текстового ввода
- Настройки: цвет и размер шрифта
- Интеграция с Undo/Redo

## См. также

- [PencilOverlay](./components/Overlay/PencilOverlay.md)
- [usePencilHistory](./composables/usePencilHistory.md)
- [usePencilDrawing](./composables/usePencilDrawing.md)
