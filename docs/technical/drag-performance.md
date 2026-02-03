# Оптимизация производительности при перетаскивании

## Описание

Оптимизации для плавного перетаскивания карточек при большом количестве элементов (95+).

## Проблема

При перетаскивании карточек на доске с 95 лицензиями происходили сильные тормоза:

1. `Engine.recalc()` вызывался ~60 раз в секунду во время drag (через watch на `engineInput`)
2. CSS transitions создавали очередь анимаций при каждом пикселе движения
3. `updateStageSize()` вызывался ~60 раз в секунду, вызывая Forced Reflow в браузере
4. При 95 карточках это давало ~5700 пересчётов в секунду

## Решение

### Engine.recalc

- Во время drag (`dragState !== null`) пересчёт баланса отключается
- После отпускания карточки (`endDrag`) выполняется один пересчёт
- Это снижает нагрузку с ~5700 до 1 вызова за операцию drag

### CSS Transitions

- При активном drag добавляется класс `cards-container--dragging`
- Этот класс отключает все CSS transitions на карточках
- После завершения drag класс убирается, transitions восстанавливаются

### updateStageSize

- Функция `updateStageSize()` читает `clientWidth/clientHeight` → вызывает Forced Reflow
- Во время drag функция НЕ вызывается (убрана из `handleDragInternal`)
- После завершения drag вызывается один раз в `endDrag`
- Это устраняет Forced Reflow во время перетаскивания (~60 вызовов/сек → 1 вызов)

### connectionPaths (линии связей)

- Computed `connectionPaths` пересчитывался при каждом движении карточки
- Включал итерацию по всем connections и два `.find()` по массиву cards для каждой
- Теперь во время drag используется кэш `cachedConnectionPaths`
- Обновляются только линии, связанные с перетаскиваемыми карточками (`draggedCardIds`)
- Статичные линии берутся из кэша без пересчёта геометрии
- Это снижает нагрузку Commit/Scripting на ~30-50% при drag

## Расположение файлов

- Основной файл: `src/components/Canvas/CanvasBoard.vue`
- Composable для drag: `src/composables/useCanvasDrag.js`
- Компонент карточки: `src/components/Canvas/Card.vue`

## Технические детали

### Refs и computed

```javascript
// Ref для отслеживания состояния drag
const isDraggingAnyRef = ref(false);
provide('isDraggingAny', isDraggingAnyRef);

// Computed для определения состояния drag
const isDraggingAny = computed(() => dragState.value !== null);

// Синхронизация с ref для provide
watch(isDraggingAny, (value) => {
  isDraggingAnyRef.value = value;
}, { immediate: true });
```

### Watch на engineInput

```javascript
watch(engineInput, (state) => {
  // Пропускаем пересчёт во время перетаскивания
  if (isDraggingAnyRef.value) {
    return;
  }
  // ... остальной код пересчёта
}, { immediate: true });
```

### Принудительный пересчёт после drag

```javascript
watch(dragState, (newState, oldState) => {
  // Если drag завершился
  if (oldState !== null && newState === null) {
    nextTick(() => {
      const state = engineInput.value;
      if (state.cards.length) {
        const { result, meta } = Engine.recalc(state);
        cardsStore.applyCalculationResults({ result, meta });
        applyActivePvPropagation(null, { triggerAnimation: true });
      }
    });
  }
});
```

### CSS для отключения transitions

```css
/* Отключение CSS transitions при перетаскивании */
.cards-container--dragging .card,
.cards-container--dragging .card * {
  transition: none !important;
  animation: none !important;
}

.cards-container--dragging .card:active {
  transition: none !important;
}
```

### updateStageSize в useCanvasDrag.js

```javascript
// В handleDragInternal — НЕ вызываем updateStageSize
// (закомментировано для оптимизации производительности)

// В endDrag — вызываем один раз после завершения drag
const endDrag = async (event) => {
  // ... логика сохранения ...

  // Обновляем размер холста один раз после завершения drag
  if (updateStageSize) {
    updateStageSize()
  }

  dragState.value = null
  // ... очистка listeners ...
}
```

### connectionPaths с кэшированием

```javascript
// Кэш для линий во время drag
const cachedConnectionPaths = ref([]);
const draggedCardIds = ref(new Set());

// Обновляем список перетаскиваемых карточек
watch(dragState, (state) => {
  if (state && state.cards) {
    draggedCardIds.value = new Set(state.cards.map(c => c.id));
  } else {
    draggedCardIds.value = new Set();
  }
}, { immediate: true });

const connectionPaths = computed(() => {
  // Во время drag используем кэш для статичных линий
  if (isDraggingAnyRef.value && cachedConnectionPaths.value.length > 0) {
    return cachedConnectionPaths.value.map(cached => {
      const connection = connections.value.find(c => c.id === cached.id);
      if (!connection) return null;

      // Пересчитываем только линии перетаскиваемых карточек
      if (draggedCardIds.value.has(connection.from) ||
          draggedCardIds.value.has(connection.to)) {
        // ... пересчёт геометрии ...
      }
      return cached; // Статичные линии из кэша
    }).filter(Boolean);
  }

  // Обычный расчёт + сохранение в кэш
  const result = connections.value.map(/* ... */).filter(Boolean);
  if (!isDraggingAnyRef.value) {
    cachedConnectionPaths.value = result;
  }
  return result;
});
```

## Ожидаемый эффект

- Снижение нагрузки CPU на ~90% при перетаскивании
- Устранение Forced Reflow во время drag (снижение Rendering на ~30-50%)
- Снижение нагрузки Commit/Scripting на ~30-50% (кэширование connectionPaths)
- Плавное движение карточек при любом количестве элементов
- Баланс (L/R) обновляется мгновенно после отпускания карточки
- Карточка мгновенно следует за курсором без задержек анимации
- Размер холста корректно обновляется после перемещения элементов
- Линии перетаскиваемой карточки обновляются в реальном времени

## История изменений

- 2025-02-03: Добавлена оптимизация connectionPaths (кэширование линий во время drag)
- 2025-02-03: Добавлена оптимизация updateStageSize (устранение Forced Reflow)
- 2025-02-03: Добавлена оптимизация drag performance (Engine.recalc, CSS transitions)
