# Board Save/Load — Формат данных и сериализация

## Обзор

Доска (board) сохраняется в PostgreSQL в поле `boards.content` (тип JSONB). Фронтенд собирает состояние из всех Pinia-сторов через функцию `getCanvasState()` в `src/App.vue` и отправляет JSON на бэкенд через `PUT /api/boards/:id`.

## Поток сохранения

1. Пользователь нажимает "Сохранить" или срабатывает автосохранение
2. `getCanvasState()` собирает данные из сторов: `cardsStore`, `connectionsStore`, `stickersStore`, `imagesStore`, `canvasStore`
3. JSON отправляется на `PUT /api/boards/:id`
4. Бэкенд валидирует и записывает в `boards.content` (JSONB)

## Поток загрузки

1. Фронтенд запрашивает `GET /api/boards/:id`
2. Получает JSON с полным состоянием доски
3. Данные распределяются по сторам:
   - Карточки → `cardsStore.loadCards()` (нормализация через `normalizedCard`)
   - Соединения → `connectionsStore`
   - Стикеры → `stickersStore`
   - Изображения → `imagesStore`

## Формат JSON `content`

```json
{
  "version": 1,
  "background": "#ffffff",
  "zoom": 1,
  "objects": [ /* карточки (cards) */ ],
  "connections": [ /* соединения между карточками */ ],
  "userCardConnections": [ /* соединения между user_card */ ],
  "stickers": [ /* стикеры */ ],
  "images": [ /* изображения */ ]
}
```

## Поля карточки (тип license: large/small/gold)

### Базовые поля

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | string | Уникальный идентификатор |
| `x` | number | Позиция X на канвасе |
| `y` | number | Позиция Y на канвасе |
| `width` | number | Ширина карточки |
| `height` | number | Высота карточки |
| `text` | string | Имя партнёра / ID лицензии |
| `fill` | string | Цвет заливки |
| `stroke` | string | Цвет обводки |
| `strokeWidth` | number | Толщина обводки |
| `headerBg` | string | Цвет фона заголовка |
| `colorIndex` | number | Индекс цветовой схемы |
| `type` | string | Тип карточки: `large`, `small`, `gold` |
| `bodyHTML` | string | HTML содержимое тела |
| `bodyGradient` | string | CSS-градиент тела |
| `pv` | string | Значение PV (напр. `"330/330pv"`) |

### Строковые значения

| Поле | Тип | Описание |
|------|-----|----------|
| `balance` | string | Баланс (напр. `"0 / 0"`) |
| `activePv` | string | Active PV строка (напр. `"0 / 0"`) |
| `cycle` | string | Номер цикла |
| `coinFill` | string | Цвет заливки монеты |
| `previousPvLeft` | number | Остаток PV с предыдущего периода |

### Бейджи

| Поле | Тип | Описание |
|------|-----|----------|
| `showSlfBadge` | boolean | Показывать бейдж SLF |
| `showFendouBadge` | boolean | Показывать бейдж Fendou |
| `rankBadge` | string\|null | Ранговый бейдж |

### Расчёты структуры

| Поле | Тип | Описание |
|------|-----|----------|
| `calculated` | object | Расчёты: `{ L, R, total, cycles, stage, toNext }` |
| `calculatedIsFull` | boolean | Флаг заполненности расчёта |
| `total` | number | Общая сумма |
| `stage` | number | Текущий этап |
| `toNext` | number | До следующего этапа |

### Active-PV состояние

`activePvState` — это **основное поле состояния Active-PV**. При загрузке доски функция `getStateFromCard()` в `src/utils/activePv.js` проверяет его первым. Если `activePvState` присутствует, из него восстанавливаются все производные значения. Если отсутствует — состояние восстанавливается из `activePvManual`/`activePvLocal`/`activePv`.

| Поле | Тип | Описание |
|------|-----|----------|
| `activePvState` | object | Сериализованное состояние Active-PV: `{ activePv: {left, right}, activePacks, localBalance: {left, right}, balance: {left, right}, cycles }` |
| `activePvManual` | object | Ручные значения: `{ left, right, total }` |
| `activePvLocal` | object | Локальные значения: `{ left, right, total }` |
| `activePvAggregated` | object | Агрегированные значения: `{ left, right, total, remainderLeft, remainderRight }` |
| `activePvLocalBalance` | object | Локальный баланс: `{ left, right, total }` |
| `activePvBalance` | object | Баланс: `{ left, right }` |
| `activePvPacks` | number | Количество паков Active-PV |
| `activePvCycles` | number | Количество циклов Active-PV |

### Ручное переопределение баланса и циклов

| Поле | Тип | Описание |
|------|-----|----------|
| `balanceManualOverride` | object\|null | Ручное переопределение автоматически рассчитанного баланса: `{ left, right }`. Если задано — отображается вместо автоматического баланса. Логика отображения в `Card.vue`: `balanceDisplay = manualBalanceOverride ?? calculatedBalanceDisplay` |
| `manualAdjustments` | object\|null | Разница (offset) между ручным и автоматическим балансом: `{ left, right }`. При изменении автоматического баланса watcher пересчитывает `balanceManualOverride` с сохранением этого offset |
| `cyclesManualOverride` | object\|null | Ручное переопределение автоматически рассчитанного значения циклов: `{ cycles }`. Если задано — отображается вместо автоматического значения |

## Поля карточки (тип user_card)

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | string | Уникальный идентификатор |
| `type` | string | Всегда `"user_card"` |
| `x` | number | Позиция X |
| `y` | number | Позиция Y |
| `size` | number | Размер карточки |
| `diameter` | number | Диаметр аватара |
| `personalId` | string | Personal ID партнёра |
| `userId` | number | ID пользователя |
| `avatarUrl` | string | URL аватара |
| `username` | string | Имя пользователя |
| `stroke` | string | Цвет обводки |
| `strokeWidth` | number | Толщина обводки |
| `created_at` | string | Дата создания |

## Поля соединения (connection)

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | string | Уникальный идентификатор |
| `from` | string | ID карточки-источника |
| `to` | string | ID карточки-назначения |
| `fromSide` | string | Сторона источника |
| `toSide` | string | Сторона назначения |
| `color` | string | Цвет линии |
| `thickness` | number | Толщина линии |
| `highlightType` | string | Тип подсветки |
| `animationDuration` | number | Длительность анимации |

## Поля стикера (sticker)

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | string | Уникальный идентификатор |
| `pos_x` | number | Позиция X |
| `pos_y` | number | Позиция Y |
| `color` | string | Цвет стикера |
| `content` | string | Текстовое содержимое |

## Заметки (notes)

Заметки (notes) **не сохраняются** в составе карточки в `content`. Они хранятся отдельно в таблице `notes` базы данных.

## Ключевые файлы

| Файл | Назначение |
|------|------------|
| `src/App.vue` → `getCanvasState()` | Сериализация состояния для сохранения |
| `src/stores/cards.js` → `loadCards()` | Нормализация и загрузка карточек |
| `src/utils/activePv.js` → `getStateFromCard()` | Восстановление Active-PV из сохранённых данных |
| `src/utils/activePv.js` → `buildUpdatePayload()` | Формирование Active-PV полей для обновления карточки |
| `src/utils/activePv.js` → `serializeState()` | Сериализация Active-PV состояния |

## История изменений

### 2025-02-10: Исправление потери данных Active-PV при сохранении

**Проблема:** Функция `getCanvasState()` в `src/App.vue` при сериализации карточек включала только 15 базовых полей (id, x, y, width, height, text, fill, stroke, strokeWidth, headerBg, colorIndex, type, bodyHTML, bodyGradient, pv), полностью пропуская поля Active-PV, баланса, расчётов и визуальных состояний. После сохранения и повторной загрузки доски все введённые значения сбрасывались к нулям.

**Решение:** Расширена сериализация карточек в `getCanvasState()` — добавлены 21 недостающее поле:
- Строковые значения: `balance`, `activePv`, `cycle`, `coinFill`, `previousPvLeft`
- Бейджи: `showSlfBadge`, `showFendouBadge`, `rankBadge`
- Расчёты: `calculated`, `calculatedIsFull`, `total`, `stage`, `toNext`
- Active-PV: `activePvState`, `activePvManual`, `activePvLocal`, `activePvAggregated`, `activePvLocalBalance`, `activePvBalance`, `activePvPacks`, `activePvCycles`

**Затронутые файлы:** `src/App.vue` (функция `getCanvasState()`, строки 722-770)

### 2025-02-10: Сохранение ручного переопределения баланса

**Проблема:** Поля `balanceManualOverride` и `manualAdjustments` не включались в сериализацию `getCanvasState()` и не восстанавливались при загрузке в `normalizedCard`. Ручной баланс, введённый пользователем, сбрасывался к автоматическому (0/0) после перезагрузки.

**Решение:** Добавлены 2 поля в сериализацию (`src/App.vue`) и нормализацию (`src/stores/cards.js`): `balanceManualOverride`, `manualAdjustments`.

**Затронутые файлы:** `src/App.vue`, `src/stores/cards.js`

### 2025-02-10: Сохранение ручного переопределения циклов

**Проблема:** Поле `cyclesManualOverride` не включалось в сериализацию и нормализацию. Ручное значение цикла сбрасывалось к автоматическому (0) после перезагрузки.

**Решение:** Добавлено поле `cyclesManualOverride` в сериализацию (`src/App.vue`) и нормализацию (`src/stores/cards.js`).

**Затронутые файлы:** `src/App.vue`, `src/stores/cards.js`
