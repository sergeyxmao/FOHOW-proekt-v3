# useActivePv.js

> Логика Active PV и анимации распространения баланса

## Общая информация

| Параметр | Значение |
|----------|----------|
| **Файл** | `src/composables/useActivePv.js` |
| **Размер** | ~450 строк |
| **Создан** | Декабрь 2025 (рефакторинг CanvasBoard.vue) |
| **Зависимости** | cardsStore, connectionsStore, viewSettingsStore |

## Назначение

Этот composable реализует визуализацию распространения PV (Product Volume) 
по дереву карточек в MLM-структуре.

### Ключевые возможности:
- Подсветка карточки при изменении PV
- Анимация "волны" по соединениям
- Распространение баланса вверх/вниз по дереву
- Отображение активного PV на карточках

## Константы

```javascript
const ACTIVE_PV_FLASH_MS = 650  // Длительность подсветки карточки (мс)
```

## API

### Входные параметры

```javascript
useActivePv({
  cardsStore,           // Pinia store карточек
  connectionsStore,     // Store соединений
  viewSettingsStore,    // Store настроек отображения
  getCardElement,       // (cardId) => HTMLElement
  getConnectionElement, // (connectionId) => SVGElement
})
```

### Возвращаемые значения

```javascript
{
  // Состояние
  activeAnimationTimers,    // Map - активные таймеры анимаций
  
  // Методы
  updateActivePvDatasets,   // (payload) => void - обновить data-атрибуты
  cancelAllActiveAnimations, // () => void - отменить все анимации
  highlightActivePvChange,  // (cardId) => void - подсветить карточку
  animateBalancePropagation, // (cardId, side) => void - анимация волны
  applyActivePvPropagation, // (cardId, options) => void - применить распространение
  handleActivePvButtonClick, // (event) => void - обработчик клика на кнопку PV
}
```

## Концепция Active PV

В MLM-структуре PV (Product Volume) распространяется по дереву:
- **Вверх** — от дочерних к родительским карточкам
- **Вниз** — от родительских к дочерним

```
      [Родитель]
         │ PV↑
    ┌────┴────┐
    │         │
[Ребёнок1] [Ребёнок2]
    │ PV↑
[Внук]
```

## Алгоритм анимации

### 1. Подсветка карточки

```javascript
highlightActivePvChange(cardId) {
  const element = getCardElement(cardId)
  element.classList.add('card--pv-flash')
  
  setTimeout(() => {
    element.classList.remove('card--pv-flash')
  }, ACTIVE_PV_FLASH_MS)
}
```

### 2. Волна по соединениям

```
Время 0ms:     [Карточка 1] ─────── [Карточка 2]
                   ⬤ flash

Время 200ms:   [Карточка 1] ══════ [Карточка 2]
                              ↑ линия анимируется

Время 400ms:   [Карточка 1] ─────── [Карточка 2]
                                        ⬤ flash
```

```javascript
animateBalancePropagation(changedCardId, changedSide) {
  // 1. Найти все связанные карточки
  const connectedCards = findConnectedCards(changedCardId, changedSide)
  
  // 2. Для каждой связи - запустить анимацию с задержкой
  connectedCards.forEach((target, index) => {
    const delay = index * 200
    
    setTimeout(() => {
      // Анимировать линию
      animateConnection(target.connectionId)
      
      // Подсветить целевую карточку
      setTimeout(() => {
        highlightActivePvChange(target.cardId)
      }, 200)
    }, delay)
  })
}
```

## Data-атрибуты

Для CSS-анимаций используются data-атрибуты:

```javascript
updateActivePvDatasets({ cardId, isActive, pvValue }) {
  const element = getCardElement(cardId)
  element.dataset.activePv = isActive ? 'true' : 'false'
  element.dataset.pvValue = pvValue
}
```

```html
<!-- В DOM -->
<div class="card" data-active-pv="true" data-pv-value="150">
```

```css
/* CSS для подсветки */
.card[data-active-pv="true"] {
  box-shadow: 0 0 20px rgba(93, 139, 244, 0.5);
}

.card--pv-flash {
  animation: pv-flash 0.65s ease-out;
}

@keyframes pv-flash {
  0% { background-color: rgba(93, 139, 244, 0.3); }
  100% { background-color: transparent; }
}
```

## Обработка клика на кнопку PV

```javascript
handleActivePvButtonClick(event) {
  const cardId = event.target.dataset.cardId
  const card = cardsStore.getById(cardId)
  
  // 1. Переключить состояние active PV
  card.activePv = !card.activePv
  
  // 2. Если активировали - запустить распространение
  if (card.activePv) {
    applyActivePvPropagation(cardId, {
      animate: true,
      direction: 'both' // вверх и вниз
    })
  }
  
  // 3. Обновить визуальное состояние
  updateActivePvDatasets({ cardId, isActive: card.activePv })
}
```

## Управление таймерами

Для предотвращения утечек памяти все таймеры отслеживаются:

```javascript
const activeAnimationTimers = new Map()

// При запуске анимации
const timerId = setTimeout(callback, delay)
activeAnimationTimers.set(cardId, timerId)

// При отмене
cancelAllActiveAnimations() {
  activeAnimationTimers.forEach((timerId) => {
    clearTimeout(timerId)
  })
  activeAnimationTimers.clear()
}
```

## Использование в CanvasBoard.vue

```javascript
import { useActivePv } from '@/composables/useActivePv'

const {
  updateActivePvDatasets,
  cancelAllActiveAnimations,
  highlightActivePvChange,
  animateBalancePropagation,
  applyActivePvPropagation,
  handleActivePvButtonClick,
} = useActivePv({
  cardsStore,
  connectionsStore,
  viewSettingsStore,
  getCardElement: (id) => document.querySelector(`[data-card-id="${id}"]`),
  getConnectionElement: (id) => document.querySelector(`[data-connection-id="${id}"]`),
})

// При изменении PV карточки
watch(() => cardsStore.pvChanges, (changes) => {
  changes.forEach(({ cardId, side }) => {
    animateBalancePropagation(cardId, side)
  })
})

// При размонтировании
onBeforeUnmount(() => {
  cancelAllActiveAnimations()
})
```

## Связанные файлы

- `src/stores/cards.js` — данные PV карточек
- `src/stores/connections.js` — связи между карточками
- `src/components/Canvas/Card.vue` — UI карточки с кнопкой PV

## Отладка

### Анимация не запускается
1. Проверь `viewSettingsStore.isAnimationEnabled`
2. Проверь что `getCardElement` возвращает элемент
3. Проверь CSS классы анимации

### Волна идёт не туда
1. Проверь `connectionsStore.connections` — правильные ли связи
2. Проверь `changedSide` — корректная ли сторона
3. Проверь порядок карточек в `findConnectedCards`

### Таймеры не очищаются
1. Проверь что `cancelAllActiveAnimations` вызывается в `onBeforeUnmount`
2. Проверь `activeAnimationTimers.size` — не растёт ли бесконечно
