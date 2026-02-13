# Оптимизация производительности холста

## Описание

Оптимизация производительности интерактивного холста (canvas) при работе с большими структурами (90+ карточек). Основная проблема — падение FPS до 15-25 при pan (перемещение холста) и zoom (масштабирование) из-за излишних реактивных обновлений Vue.

## Проблема

При каждом событии `mousemove`/`wheel` (до 60 раз/сек) происходило:
1. Обновление Vue ref (`translateX.value`, `translateY.value`, `scale.value`)
2. Пересчёт computed `canvasContentStyle` в `CanvasBoard.vue`
3. Vue reconciliation проверял все дочерние компоненты Card
4. Watcher `zoomScale -> viewportStore.setZoomScale()` тригерил дополнительные обновления

При pan/zoom карточки **не меняются** — двигается только контейнер `.canvas-content`. Вся эта реактивность была лишней.

## Затронутые файлы

| Файл | Изменения |
|------|-----------|
| `src/composables/usePanZoom.js` | Hot mode (прямой DOM), debounce sync |
| `src/components/Canvas/CanvasBoard.vue` | CSS contain/will-change, freeze-класс, v-memo, режимы |
| `src/stores/performanceMode.js` | Pinia store для режимов (full/light/view) |
| `src/components/Canvas/Card.vue` | Поддержка performanceMode prop |
| `src/App.vue` | Кнопка переключения режима (desktop), хоткей M |
| `src/components/Layout/MobileToolbar.vue` | Кнопка переключения режима (mobile) |

## Архитектура оптимизации

### Слой 1: Hot Mode — прямой DOM при pan/zoom (реализован)

**Суть:** Во время активного pan или zoom значения transform пишутся напрямую в DOM-элемент `.canvas-content`, минуя Vue refs. Vue refs обновляются один раз при завершении действия.

#### Механизм

```
Событие mousemove/wheel
    ↓
enterHotMode()  — копируем текущие значения из refs в "горячие" переменные
    ↓
Обновляем hotTranslateX, hotTranslateY, hotScale (обычные let)
    ↓
requestAnimationFrame → applyTransformStyles() → прямой DOM: element.style.transform = ...
    ↓
Vue refs НЕ обновляются → НЕТ реактивных пересчётов → НЕТ reconciliation
    ↓
stopPanning() / debounce timeout → syncHotToRefs() → однократное обновление refs
```

#### Ключевые функции

- `enterHotMode()` — копирует текущие значения из Vue refs в горячие переменные, включает hot mode
- `syncHotToRefs()` — записывает финальные горячие значения обратно в Vue refs, выключает hot mode
- `applyTransformStyles()` — при `isHotMode=true` берёт значения из горячих переменных
- `wheelSyncTimer` — debounce 150мс для синхронизации после zoom колёсиком

#### Что обновляется по-разному

| Действие | Во время (hot) | По завершении |
|----------|---------------|---------------|
| Pan (мышь/touch) | hotTranslateX/Y → DOM | syncHotToRefs() в stopPanning() |
| Zoom (wheel) | hotScale, hotTranslateX/Y → DOM | syncHotToRefs() через debounce 150мс |
| Pinch (touch) | hotScale, hotTranslateX/Y → DOM | syncHotToRefs() при отпускании пальцев |
| Программный (fitToContent) | refs + hot → DOM | Немедленно через refs |

### Слой 1b: CSS оптимизации

- `will-change: transform` на `.canvas-content` — подсказка браузеру создать отдельный compositing layer
- `contain: layout style` на `.canvas-content` — браузер знает, что изменения внутри контейнера не влияют на внешний layout (без `paint` — см. "Известные проблемы")

### Слой 1c: Freeze-класс при взаимодействии

Класс `canvas-container--interacting` добавляется при:
- Активном pan/zoom (`isPanZoomInteracting`)
- Активном перетаскивании карточек (`isDraggingAnyRef`)

Эффекты freeze-класса:
- `pointer-events: none` на `.cards-container`, `.card`, `.line-hitbox`, `.note-window`
- `transition: none !important` и `animation: none !important` на `.card` и линиях
- Выбранная (перетаскиваемая) карточка `.card.selected` остаётся интерактивной

### Слой 1d: v-memo на компоненте Card

Директива `v-memo` с массивом зависимостей на компоненте `<Card>` предотвращает перепроверку (reconciliation) карточек при каждом рендере, если их данные не изменились.

Зависимости v-memo включают все реактивные свойства карточки, от которых зависит рендер `Card.vue`: позиция, размеры, текст, PV, баланс, стили, значки и т.д.

### Слой 2: Три режима работы (реализован)

Три режима производительности с ручным переключением. Режим не сохраняется между сессиями — всегда стартуем в "Полный".

#### Режимы

| Функция | Полный | Лёгкий | Просмотр |
|---------|--------|--------|----------|
| CSS анимации (пульсация, dash) | да | нет | нет |
| CSS transitions | да | нет | нет |
| drop-shadow на линиях | да | нет | нет |
| Фоновая сетка | да | нет | нет |
| Анимация баланса (JS watchers) | да | нет | нет |
| Редактирование заголовка (dblclick) | да | да | нет |
| Редактирование PV | да | да | нет |
| Кнопка удаления | да | да | нет |
| Кнопка заметки | да | да | нет |
| Drag карточек | да | да | нет |
| Engine recalc | да | да | нет |
| Pan/zoom | да | да | да |
| Отображение карточек и данных | да | да | да |

#### Store

`src/stores/performanceMode.js` — Pinia store с режимом и computed-геттерами:
- `mode` — ref('full'), текущий режим
- `isFull`, `isLight`, `isView` — computed-флаги
- `animationsEnabled`, `editingEnabled`, `dragEnabled`, `controlsVisible`, `gridVisible`, `shadowsEnabled`
- `cycleMode()` — циклическое переключение: full → light → view → full
- `setMode(mode)` — установка конкретного режима

#### UI

- Desktop: кнопка `.mode-floating-button` в нижней панели `App.vue`
- Mobile: кнопка `.mode-button` в `MobileToolbar.vue`
- Хоткей: `M` — циклическое переключение (не срабатывает в текстовых полях)

#### CSS-классы на canvas-container

- `canvas-container--mode-light` — отключает анимации, transitions, shadows
- `canvas-container--mode-view` — наследует от light + отключает интерактивность, скрывает контролы

### Запланированные слои (3-4)

- **Слой 3:** Оптимизация линий соединений — canvas-рендеринг вместо SVG
- **Слой 4:** Web Worker для расчётов Engine

## Возвращаемый API usePanZoom

Добавлено новое свойство:

```js
return {
  // ... существующие свойства (scale, translateX, translateY, etc.)
  isInteracting: computed(() => isHotMode) // readonly, true во время активного pan/zoom
}
```

## Результат

- Pan/zoom работает плавно (55-60 FPS) на структурах до 150 карточек
- Drag карточки ускоряется за счёт freeze остальных карточек
- Существующая функциональность не нарушена (drag, selection, connections, touch/pinch)
- Все изменения обратно совместимы

## Известные проблемы и решения

### contain: paint обрезает контент

**Проблема:** `contain: layout style paint` на `.canvas-content` создаёт paint containment — браузер обрезает всё содержимое, выходящее за границы элемента (аналогично `overflow: hidden`). На холсте видна прямоугольная область с другим оттенком фона, всё за ней обрезано.

**Решение:** Убрано `paint` из `contain`. Оставлено `contain: layout style` — сохраняет оптимизацию layout/style recalculation без обрезки визуального содержимого.

### Масштаб обновляется рывками при zoom

**Проблема:** В hot mode Vue ref `scale` не обновляется до завершения действия (debounce 150мс). Цепочка `scale ref → watcher → viewportStore → zoomPercentage computed → шаблон` замирает, потом прыгает.

**Решение:** В `applyTransformStyles()` добавлено прямое обновление DOM-элемента масштаба (`.zoom-floating-button__value` и `[data-zoom-display]`) во время hot mode, минуя Vue реактивность. Элементы:
- Desktop: `<span class="zoom-floating-button__value">` в `App.vue`
- Mobile: `<span data-zoom-display>` в `MobileToolbar.vue`

## История изменений

| Дата | Изменение |
|------|-----------|
| 2026-02-13 | Слой 1: Hot mode, CSS оптимизации, v-memo, freeze-класс |
| 2026-02-13 | Фикс: убран contain: paint (обрезка контента), прямое DOM-обновление масштаба |
| 2026-02-13 | Слой 2: Три режима работы (Полный/Лёгкий/Просмотр), store, кнопки, хоткей M |
