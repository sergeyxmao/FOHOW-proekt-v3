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

- `will-change: transform` + `backface-visibility: hidden` на `.canvas-container--panning .canvas-content` — GPU compositing layer **только во время панорамирования**. Постоянный `will-change` вызывал моргание при зуме < 10% (огромная GPU-текстура не помещалась в видеопамять)
- `contain: layout style` на `.canvas-content` — браузер знает, что изменения внутри контейнера не влияют на внешний layout (без `paint` — см. "Известные проблемы")
- `contain: layout style` на `.card` — изоляция каждой карточки от соседних
- `contain: layout style` на `.svg-layer` — изоляция SVG-слоя от карточек

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

**Важно:** Все CSS правила для режимов Light/View используют `:deep()` для проникновения через scoped CSS в дочерние компоненты (Card.vue, SVG линии).

### Слой 3: LOD (Level of Detail) при зуме (реализован)

При zoom < 35% карточки автоматически переключаются на упрощённый рендер через CSS, уменьшая количество видимых DOM-элементов с ~50 до ~6 на карточку.

#### Почему CSS, а не v-if

LOD управляется через CSS-класс `canvas-container--lod` на контейнере, а НЕ через `v-if` в `Card.vue`:

1. Во время hot mode (Слой 1) Vue refs не обновляются → computed/v-if не сработает
2. CSS-класс обновляется из `applyTransformStyles()` — прямой DOM, работает каждый кадр
3. `display: none` убирает элементы из layout без пересоздания DOM (быстрее v-if)

#### Механизм

```
applyTransformStyles()  (вызывается каждый кадр через rAF)
    ↓
Читаем текущий scale (hot или ref)
    ↓
scale < 0.35 ?  →  canvas-container.classList.add('canvas-container--lod')
scale ≥ 0.35 ?  →  canvas-container.classList.remove('canvas-container--lod')
    ↓
CSS правила скрывают элементы с классом .card-lod-hide
CSS правила показывают элементы с классом .card-lod-summary
```

#### Пороги

Три уровня LOD, управляемые константами в `usePanZoom.js`:

| Порог | Константа | CSS-класс | Что скрывается |
|-------|-----------|-----------|----------------|
| < 35% | `LOD_THRESHOLD = 0.35` | `canvas-container--lod` | PV числа, close btn, controls, badges, bodyHTML, cycle, connection points |
| < 20% | `LOD_THRESHOLD_DEEP = 0.20` | `canvas-container--lod-deep` | + баланс, актив-заказы (появляется компактная сводка L/R) |
| < 15% | `LOD_THRESHOLD_MINIMAL = 0.15` | `canvas-container--lod-minimal` | + аватарка |

#### CSS-классы на элементах Card.vue

- `.card-lod-hide` — скрывается при zoom < 35%: PV числа, кнопка закрытия, цикл/этап, bodyHTML, контролы, бейджи, точки соединения, active-pv-hidden
- `.card-lod-hide-deep` — скрывается при zoom < 20%: баланс, актив-заказы
- `.card-lod-hide-minimal` — скрывается при zoom < 15%: аватар
- `.card-lod-summary` — компактная строка баланса L/R, видна ТОЛЬКО при zoom < 20%

#### Что видно в LOD

| Элемент | 100-35% | 35-20% | 20-15% | < 15% |
|---------|:-------:|:------:|:------:|:-----:|
| Заголовок (имя) | да | да | да | да |
| Монетка (жёлтый/синий круг) | да | да | да | да |
| PV числа (330/330pv) | да | нет | нет | нет |
| Баланс | да | да | нет | нет |
| Актив-заказы | да | да | нет | нет |
| Компактный баланс L/R | нет | нет | да | да |
| Аватар (большие карточки) | да | да | да | нет |
| Цикл/этап | да | нет | нет | нет |
| Кнопки, бейджи, точки | да | нет | нет | нет |

#### CSS правила (CanvasBoard.vue)

Все правила используют `:deep()` для проникновения через scoped CSS в дочерние компоненты (Card.vue):

```css
.canvas-container--lod :deep(.card-lod-hide) { display: none !important; }
.canvas-container--lod :deep(.card-body) { padding: 10px !important; gap: 4px !important; }
.canvas-container--lod :deep(.card-header) { padding: 8px 12px !important; min-height: 32px !important; }
.canvas-container--lod :deep(.card), :deep(.line), :deep(.line-group) { animation: none !important; transition: none !important; }
:deep(.card-lod-summary) { display: none !important; }
.canvas-container--lod :deep(.card-lod-summary) { display: flex !important; }
```

**Важно:** Не использовать `overflow: hidden` на `.card` в LOD — это обрезает аватарку на больших/gold карточках.

#### Совместимость

- **Hot mode (Слой 1):** LOD-класс обновляется в `applyTransformStyles()`, которая работает в hot mode — переключение происходит мгновенно при прокрутке колёсиком
- **Режимы (Слой 2):** LOD работает во всех режимах. В "Просмотр" кнопки итак скрыты через mode-view CSS
- **Программный зум (fitToContent):** LOD обновляется через `updateTransform()` → `applyTransformStyles()`

### Запланированные слои (4-5)

- **Слой 4:** Оптимизация линий соединений — canvas-рендеринг вместо SVG
- **Слой 5:** Web Worker для расчётов Engine

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
| 2026-02-13 | Слой 3: LOD (Level of Detail) — упрощённый рендер при zoom < 35% |
| 2026-02-14 | Фикс: :deep() для LOD/Light/View CSS (scoped style penetration), убран overflow:hidden (обрезка аватарки) |
