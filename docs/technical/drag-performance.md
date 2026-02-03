# Оптимизация производительности при перетаскивании

## Описание

Оптимизации для плавного перетаскивания карточек при большом количестве элементов (95+).

## Проблема

При перетаскивании карточек на доске с 95 лицензиями происходили сильные тормоза:

1. `Engine.recalc()` вызывался ~60 раз в секунду во время drag (через watch на `engineInput`)
2. CSS transitions создавали очередь анимаций при каждом пикселе движения
3. При 95 карточках это давало ~5700 пересчётов в секунду

## Решение

### Engine.recalc

- Во время drag (`dragState !== null`) пересчёт баланса отключается
- После отпускания карточки (`endDrag`) выполняется один пересчёт
- Это снижает нагрузку с ~5700 до 1 вызова за операцию drag

### CSS Transitions

- При активном drag добавляется класс `cards-container--dragging`
- Этот класс отключает все CSS transitions на карточках
- После завершения drag класс убирается, transitions восстанавливаются

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

## Ожидаемый эффект

- Снижение нагрузки CPU на ~90% при перетаскивании
- Плавное движение карточек при любом количестве элементов
- Баланс (L/R) обновляется мгновенно после отпускания карточки
- Карточка мгновенно следует за курсором без задержек анимации

## История изменений

- 2025-02-03: Добавлена оптимизация drag performance
