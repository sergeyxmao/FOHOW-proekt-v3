# CanvasBoard.vue

> Главный компонент Canvas — интерактивная доска для работы с карточками и соединениями

## Общая информация

| Параметр | Значение |
|----------|----------|
| **Файл** | `src/components/Canvas/CanvasBoard.vue` |
| **Размер** | ~3130 строк |
| **Тип** | Vue 3 SFC (Single File Component) |
| **Зависимости** | Pinia stores, composables, Konva.js |

## Назначение

CanvasBoard.vue — это центральный компонент приложения, который предоставляет:
- Интерактивную Canvas доску для размещения карточек
- Рисование соединений между карточками
- Управление user-card линиями (партнёрские связи)
- Pan & Zoom функциональность
- Экспорт в PNG/PDF

## Структура стилей

### Два блока `<style>`

Компонент использует **два отдельных блока стилей**:

1. **`<style scoped>`** (строки 2636-3087)
   - Основные стили компонента
   - Изолированы через scoped атрибут
   - Применяются только к элементам этого компонента

2. **`<style>` без scoped** (строки 3088+)
   - SVG-стили для user-card линий
   - Глобальные стили для динамических элементов
   - Необходимы для корректной работы анимаций

### Почему два блока?

Vue scoped styles добавляют уникальные атрибуты (`data-v-xxx`) к элементам, но динамически созданные SVG элементы (через JavaScript) не получают эти атрибуты. Поэтому стили для user-card линий вынесены в отдельный unscoped блок.

## User-card линии

### Классы стилей

```css
/* Базовый стиль линии */
.user-card-line {
  fill: none;
  stroke: var(--line-color, #5D8BF4);
  stroke-width: var(--line-width, 5px);
  /* ... */
}

/* Анимированная линия */
.user-card-line--animated {
  stroke-dasharray: 16 12;
  animation: userCardLineFlow 2s linear infinite;
  /* ... */
}

/* Выделенная линия */
.user-card-line.selected {
  stroke: #5D8BF4 !important;
  stroke-width: calc(var(--line-width, 5px) + 2px) !important;
  /* ... */
}
```

### Анимация потока

```css
@keyframes userCardLineFlow {
  0% {
    stroke-dashoffset: 0;
    stroke: var(--line-animation-color, var(--line-color, #5D8BF4));
  }
  50% {
    stroke: rgba(var(--line-animation-rgb, 93, 139, 244), 0.9);
  }
  100% {
    stroke-dashoffset: -32;
    stroke: var(--line-animation-color, var(--line-color, #5D8BF4));
  }
}
```

Анимация создаёт эффект "бегущих штрихов" вдоль линии, имитируя поток данных между партнёрами.

## Обработка событий мыши

### Кнопки мыши

Компонент обрабатывает события мыши с учётом разных кнопок:

| Кнопка | `event.button` | Назначение |
|--------|----------------|------------|
| Левая | 0 | Выделение, перетаскивание, клики |
| Средняя (колесико) | 1 | Панорамирование холста |
| Правая | 2 | Контекстное меню |

### Игнорирование средней кнопки мыши

Обработчики событий в компоненте **явно игнорируют** среднюю кнопку мыши (`event.button === 1`), чтобы не блокировать панорамирование холста, которое обрабатывается в composable `usePanZoom`.

Следующие обработчики содержат проверку на среднюю кнопку:

1. **`handlePointerDown`** — обрабатывает pointerdown для выделения и рисования линий
2. **`handleStageMouseDown`** — обрабатывает клики по изображениям на заднем плане
3. **`handleStageClick`** — обрабатывает клики по canvas для размещения объектов

```javascript
// Пример проверки в начале функции
if (event.button === 1) {
  return; // Игнорируем среднюю кнопку — используется для панорамирования
}
```

## Связанные файлы

- `src/composables/useUserCardConnections.js` — логика соединений user-card
- `docs/technical/composables/useUserCardConnections.md` — документация composable
- `src/composables/usePanZoom.js` — логика панорамирования и масштабирования
- `src/stores/connections.js` — хранение соединений

## handlePvChanged

Обрабатывает событие изменения PV при клике на синюю монетку в карточке.

**Поведение:**
- Анимирует линии вверх по цепочке через `animateBalancePropagation(cardId)`
- Анимирует карточки (user_card И license) вверх по цепочке через `startUserCardSelectionAnimation(cardId)`
- Проверяет настройку `isUserCardAnimationEnabled` перед запуском анимации карточек

**История изменений:**
- 2026-01-12: Добавлена анимация карточек при клике на монетку. Теперь анимируются не только линии, но и сами карточки (включая лицензии) вверх по цепочке.

## История изменений

### 2026-01-25: Удаление проверки boardId в режиме рисования

**Проблема:** При добавлении изображения через drag-and-drop из библиотеки в режиме рисования срабатывала проверка `if (!boardStore.currentBoardId)`, которая блокировала добавление изображения, если доска не была создана или открыта. В консоли появлялось сообщение "Не удалось добавить изображение: boardId не определён".

**Причина:** В функции `handleImageDrop` (строка ~2183) была избыточная проверка наличия `boardStore.currentBoardId`, которая не требовалась для добавления изображения на canvas. Метод `imagesStore.addImage()` не использует `boardId` и может корректно работать без привязки к конкретной доске.

**Решение:**
- Удалена проверка `if (!boardStore.currentBoardId)` и блок `return` из функции `handleImageDrop`
- Режим рисования теперь позволяет добавлять изображения без необходимости создания доски
- Поведение placement mode (добавление изображений через клик, строка ~1578) осталось без изменений — там проверки `currentBoardId` никогда не было

**Поведение после исправления:**
- Пользователи могут добавлять изображения на canvas в режиме рисования без предварительного создания или открытия доски
- Функция "просто порисовать" работает корректно, не требуя сохранения или привязки к конкретной доске

**Файлы:**
- `src/components/Canvas/CanvasBoard.vue:2183-2186` — удалена проверка boardId
- `docs/technical/components/Canvas/CanvasBoard.md` — обновлена документация

**Коммит:** `fix: remove board check for drawing mode image drops`

### 2026-01-25: Исправление конфликта pan и selection на реальных устройствах

**Проблема:** На реальных мобильных телефонах при включении режима выделения активны были ОБЕ функции одновременно — pan (перемещение холста) и выделение рамкой. В эмуляторе ПК работало корректно, на телефоне — нет.

**Причина:** `usePanZoom.js` не знал о состоянии `isSelectionMode` из mobile store и продолжал запускать pan через `canStartTouchPan()` независимо от режима выделения.

**Решение:**
- Добавлен второй параметр `options` в `usePanZoom(canvasElement, options?)`
- В `options` добавлено свойство `canPan` (функция или ref), которое проверяется в `canStartTouchPan()`
- В CanvasBoard.vue передается опция: `canPan: () => !isMobileMode.value || !isSelectionMode.value`

**Поведение после исправления:**
- **Desktop версия:** Без изменений
- **Mobile + режим выделения OFF:** Pan одним пальцем работает, выделение отключено
- **Mobile + режим выделения ON:** Pan одним пальцем отключен, выделение работает; pinch-zoom двумя пальцами работает

**Файлы:**
- `src/composables/usePanZoom.js:1-3` — добавлен параметр options
- `src/composables/usePanZoom.js:78-97` — добавлена проверка canPan в canStartTouchPan
- `src/components/Canvas/CanvasBoard.vue:135-147` — передана опция canPan
- `docs/technical/composables/usePanZoom.md` — обновлена документация

### 2026-01-25: Режим выделения для мобильной версии

**Проблема:** В мобильной версии при зажатии пальца на пустой области холста активировалась функция выделения объектов рамкой, что конфликтовало с перемещением холста (pan). Пользователи не могли нормально перемещать холст одним пальцем.

**Причина:** Функция `handlePointerDown` всегда запускала выделение (`startSelection`) при долгом нажатии на пустую область, независимо от режима (мобильный/десктопный). На десктопе это работает корректно, так как pan выполняется средней кнопкой мыши или колесиком, а выделение — левой кнопкой. На мобильных устройствах оба действия выполняются одним пальцем.

**Решение:**
- Добавлена проверка режима выделения в `handlePointerDown` (строка ~1321):
  ```javascript
  // В мобильном режиме выделение работает только если включен isSelectionMode
  if (isMobileMode.value && !isSelectionMode.value) {
    return; // Не начинаем выделение, позволяем работать pan
  }
  ```
- Добавлено состояние `isSelectionMode` в mobile store
- Добавлена кнопка переключения режима выделения в MobileHeader

**Поведение:**
- **Desktop версия:** Без изменений, выделение работает как обычно
- **Mobile версия с выключенным режимом выделения (по умолчанию):**
  - Долгое нажатие на пустую область → перемещение холста (pan)
  - Выделение рамкой отключено
- **Mobile версия с включенным режимом выделения:**
  - Долгое нажатие на пустую область → выделение рамкой
  - Pan работает только жестом с двумя пальцами

**Файлы:**
- `src/components/Canvas/CanvasBoard.vue:1321-1324`
- `src/stores/mobile.js`
- `src/components/Layout/MobileHeader.vue`
- `docs/technical/stores/mobile.md`

**Коммит:** `feat: add selection mode toggle for mobile version`

### 2026-01-16: Исправление контекстного меню для изображений

**Проблема:** При правом клике (ПКМ) на изображении на холсте контекстное меню не появлялось. В консоли браузера появлялась ошибка `Uncaught TypeError: A is not a function`.

**Причина:** В строке 2575 обработчик `@contextmenu` неправильно деструктурировал объект, передаваемый из `CanvasImage.vue`. Компонент `CanvasImage` эмитит объект `{ event, imageId }`, но обработчик пытался деструктурировать его непосредственно в параметрах стрелочной функции: `({ event, imageId }) => handleImageContextMenu(event, imageId)`. Vue emit передает объект как первый параметр целиком, поэтому деструктуризация приводила к тому, что в функцию `handleImageContextMenu` первым параметром попадал весь объект вместо DOM события.

**Решение:**
- Изменен обработчик с `@contextmenu="({ event, imageId }) => handleImageContextMenu(event, imageId)"` на `@contextmenu="(payload) => handleImageContextMenu(payload.event, payload.imageId)"`
- Обновлена документация `useCanvasContextMenus.md` с добавлением раздела "Обработка emit событий с объектами", объясняющего правильный способ обработки кастомных emit событий

**Файлы:**
- `src/components/Canvas/CanvasBoard.vue:2575`
- `docs/technical/composables/useCanvasContextMenus.md`

**Коммит:** `fix: correct image context menu event handler emit payload`

### 2026-01-12: Анимация карточек при клике на монетку в лицензии

**Проблема:** При клике на синюю монетку в карточке лицензии анимировались только линии, но не анимировались карточки партнёров (user_card) и лицензии вверх по цепочке.

**Причина:** В `handlePvChanged` вызывался только `animateBalancePropagation(cardId)`, который анимировал только линии. Функция `startUserCardSelectionAnimation` не вызывалась.

**Решение:**
- В `handlePvChanged` добавлен вызов `startUserCardSelectionAnimation(cardId)` с проверкой настройки `isUserCardAnimationEnabled`
- Теперь поведение идентично клику на user_card

**Коммит:** `fix: add card animation when clicking coin in license card`

### 2026-01-12: Исправление блокировки панорамирования средней кнопкой мыши

**Проблема:** При клике средней кнопкой мыши (колесико) на холст панорамирование срабатывало очень редко. В консоли были видны множественные события `pointerDown`, но панорамирование блокировалось.

**Причина:** Обработчики событий (`handlePointerDown`, `handleStageMouseDown`, `handleStageClick`) не игнорировали среднюю кнопку мыши (`event.button === 1`). Они срабатывали раньше, чем composable `usePanZoom` мог перехватить событие, и инициировали выделение или другие действия.

**Решение:**
- Добавлена проверка `if (event.button === 1) { return; }` в начало функций:
  - `handlePointerDown`
  - `handleStageMouseDown`
- Убраны debug-логи из `handlePointerDown` и `handleStageClick`

**Коммит:** `fix: allow canvas panning with middle mouse button`

### 2026-01-11: Исправление анимации user-card линий

**Проблема:** Класс `.user-card-line--animated` не применялся к SVG `<path>` элементам, анимация не работала.

**Причина:** Vue scoped styles блокировали стили для динамически созданных SVG элементов.

**Решение:**
- Вырезаны стили `.user-card-line*` из `<style scoped>` блока
- Создан отдельный `<style>` блок БЕЗ scoped атрибута
- Перенесены туда стили user-card линий и анимации

**Коммит:** `fix: move user-card-line styles out of scoped for animation to work`

## Отладка

### Анимация линий не работает

1. Проверь DevTools → Elements → найди `<path class="user-card-line">`
2. Проверь что класс `.user-card-line--animated` применяется
3. Убедись что стили находятся в **unscoped** блоке `<style>`
4. Проверь `viewSettingsStore.isAnimationEnabled`

### Стили не применяются к SVG

Vue scoped styles не работают с динамически созданными элементами. Перемести стили в unscoped блок.

## Мобильная версия

### Стили для мобильных устройств

В мобильной версии холст (`#canvas`) использует специальные отступы для корректного отображения между фиксированными панелями `MobileHeader` и `MobileToolbar`.

**App.vue (строки 1852-1858):**
```css
.app--mobile #canvas {
  padding-top: calc(56px + env(safe-area-inset-top, 0));
  padding-bottom: calc(56px + env(safe-area-inset-bottom, 0));
  height: 100vh;
  box-sizing: border-box;
}
```

**Назначение:**
- `padding-top`: Отступ для `MobileHeader` (56px) + safe-area iOS
- `padding-bottom`: Отступ для `MobileToolbar` (56px) + safe-area iOS
- `env(safe-area-inset-*)`: CSS функция для учета вырезов экрана на iOS (notch)

**Требования:**
- В `index.html` должен быть `viewport-fit=cover` в meta viewport
- `MobileHeader` и `MobileToolbar` используют `position: fixed` с учетом safe-area
- Изменения в высоте панелей требуют синхронного обновления padding в App.vue

### Safe-area поддержка

Для корректной работы на iOS устройствах с вырезами экрана (iPhone X и новее):

1. **index.html:**
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
```

2. **MobileHeader.vue:**
```css
.mobile-header {
  top: env(safe-area-inset-top, 0);
  padding-left: calc(8px + env(safe-area-inset-left, 0));
  padding-right: calc(8px + env(safe-area-inset-right, 0));
}
```

3. **MobileToolbar.vue:**
```css
.mobile-toolbar {
  bottom: env(safe-area-inset-bottom, 0);
  padding-left: calc(8px + env(safe-area-inset-left, 0));
  padding-right: calc(8px + env(safe-area-inset-right, 0));
}
```

## Best Practices

1. **Scoped стили для статических элементов**
   - Используй `<style scoped>` для обычных HTML элементов
   - Изоляция стилей предотвращает конфликты

2. **Unscoped стили для динамических SVG**
   - Используй `<style>` без scoped для SVG элементов
   - Добавляй чёткие селекторы (`.user-card-line`) чтобы избежать конфликтов

3. **CSS переменные для кастомизации**
   - Используй `var(--line-color)` для настраиваемых параметров
   - Позволяет менять цвета/размеры без изменения CSS

4. **Safe-area для мобильных**
   - Всегда используй `env(safe-area-inset-*)` для мобильных панелей
   - Синхронизируй значения padding между панелями и контейнером холста
