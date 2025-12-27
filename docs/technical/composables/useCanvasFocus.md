# useCanvasFocus.js

> Фокусировка/центрирование viewport на объектах

## Общая информация

| Параметр | Значение |
|----------|----------|
| **Файл** | `src/composables/useCanvasFocus.js` |
| **Размер** | ~180 строк |
| **Создан** | Декабрь 2025 (рефакторинг CanvasBoard.vue) |
| **Зависимости** | stores (cards, stickers, anchors), usePanZoom |

## Назначение

Этот composable реализует плавное перемещение viewport к конкретному 
объекту на холсте.

### Ключевые возможности:
- Центрирование на карточке
- Центрирование на стикере
- Центрирование на якоре (anchor)
- Анимированное перемещение
- Поиск потомков в дереве карточек

## API

### Входные параметры

```javascript
useCanvasFocus({
  cardsStore,           // Pinia store карточек
  stickersStore,        // Store стикеров
  anchorsStore,         // Store якорей
  connectionsStore,     // Store соединений (для getBranchDescendants)
  zoomScale,            // ref - текущий масштаб
  zoomTranslateX,       // ref - смещение X
  zoomTranslateY,       // ref - смещение Y
  canvasContainerRef,   // ref на DOM контейнер
  setZoom,              // Функция из usePanZoom
  panTo,                // Функция из usePanZoom
  findCardById,         // (cardId) => Card
})
```

### Возвращаемые значения

```javascript
{
  // Методы фокусировки
  focusCardOnCanvas,       // (cardId) => void
  focusStickerOnCanvas,    // (stickerId) => void
  focusAnchorOnCanvas,     // (anchorId) => void
  
  // Утилиты для дерева
  getBranchDescendants,    // (cardId, filter) => Card[]
}
```

## Алгоритм фокусировки

```
1. Получить объект по ID
           │
2. Вычислить центр объекта
   center = {
     x: object.x + object.width / 2,
     y: object.y + object.height / 2
   }
           │
3. Вычислить размеры viewport
   viewport = {
     width: container.clientWidth,
     height: container.clientHeight
   }
           │
4. Вычислить целевую позицию
   targetTranslate = {
     x: viewport.width / 2 - center.x * zoomScale,
     y: viewport.height / 2 - center.y * zoomScale
   }
           │
5. Анимированно переместить viewport
   panTo(targetTranslate.x, targetTranslate.y, { animate: true })
```

## Фокус на карточке

```javascript
focusCardOnCanvas(cardId) {
  const card = findCardById(cardId)
  if (!card) return
  
  // Вычисляем центр карточки
  const centerX = card.x + card.width / 2
  const centerY = card.y + card.height / 2
  
  // Вычисляем размеры viewport
  const containerRect = canvasContainerRef.value.getBoundingClientRect()
  const viewportWidth = containerRect.width
  const viewportHeight = containerRect.height
  
  // Вычисляем целевое смещение
  const targetX = viewportWidth / 2 - centerX * zoomScale.value
  const targetY = viewportHeight / 2 - centerY * zoomScale.value
  
  // Анимированное перемещение
  panTo(targetX, targetY, {
    animate: true,
    duration: 300,
  })
}
```

## Фокус на стикере

```javascript
focusStickerOnCanvas(stickerId) {
  const sticker = stickersStore.stickers.find(s => s.id === stickerId)
  if (!sticker) return
  
  // Размеры стикера (примерные, т.к. стикер не имеет фиксированного размера)
  const STICKER_WIDTH = 200
  const STICKER_HEIGHT = 150
  
  const centerX = sticker.pos_x + STICKER_WIDTH / 2
  const centerY = sticker.pos_y + STICKER_HEIGHT / 2
  
  // ... аналогично focusCardOnCanvas
}
```

## Фокус на якоре

```javascript
focusAnchorOnCanvas(anchorId) {
  const anchor = anchorsStore.anchors.find(a => a.id === anchorId)
  if (!anchor) return
  
  // Якорь - это точка, центр = сама точка
  const centerX = anchor.x
  const centerY = anchor.y
  
  // ... аналогично focusCardOnCanvas
}
```

## Поиск потомков в дереве

Функция `getBranchDescendants` находит все карточки, 
связанные с указанной через соединения:

```javascript
getBranchDescendants(startCardId, branchFilter = null) {
  const descendants = []
  const visited = new Set()
  const queue = [startCardId]
  
  while (queue.length > 0) {
    const cardId = queue.shift()
    
    if (visited.has(cardId)) continue
    visited.add(cardId)
    
    // Найти все соединения, исходящие из этой карточки
    const outgoingConnections = connectionsStore.connections.filter(
      conn => conn.from === cardId
    )
    
    outgoingConnections.forEach(conn => {
      // Применить фильтр (если указан)
      if (branchFilter && conn.fromSide !== branchFilter) return
      
      const childCard = findCardById(conn.to)
      if (childCard && !visited.has(conn.to)) {
        descendants.push(childCard)
        queue.push(conn.to)
      }
    })
  }
  
  return descendants
}
```

### Использование getBranchDescendants

```javascript
// Найти всех потомков карточки
const allDescendants = getBranchDescendants(cardId)

// Найти потомков только по левой ветке
const leftBranchDescendants = getBranchDescendants(cardId, 'left')

// Найти потомков только по правой ветке
const rightBranchDescendants = getBranchDescendants(cardId, 'right')
```

## Использование в CanvasBoard.vue

```javascript
import { useCanvasFocus } from '@/composables/useCanvasFocus'

const {
  focusCardOnCanvas,
  focusStickerOnCanvas,
  focusAnchorOnCanvas,
  getBranchDescendants,
} = useCanvasFocus({
  cardsStore,
  stickersStore,
  anchorsStore,
  connectionsStore,
  zoomScale,
  zoomTranslateX,
  zoomTranslateY,
  canvasContainerRef,
  setZoom,
  panTo,
  findCardById: (id) => cardsStore.cards.find(c => c.id === id),
})

// Обработка события из списка карточек
const handleCardListClick = (cardId) => {
  focusCardOnCanvas(cardId)
  cardsStore.selectCard(cardId)
}

// Обработка события из списка стикеров
const handleStickerListClick = (stickerId) => {
  focusStickerOnCanvas(stickerId)
  stickersStore.selectSticker(stickerId)
}
```

## Интеграция с событиями

```javascript
// Глобальное событие для фокуса на карточке
window.addEventListener('canvas:focus-card', (event) => {
  focusCardOnCanvas(event.detail.cardId)
})

// Событие для фокуса на стикере
window.addEventListener('canvas:focus-sticker', (event) => {
  focusStickerOnCanvas(event.detail.stickerId)
})
```

## Связанные файлы

- `src/composables/usePanZoom.js` — функции panTo, setZoom
- `src/stores/cards.js` — данные карточек
- `src/stores/stickers.js` — данные стикеров
- `src/stores/anchors.js` — данные якорей
- `src/components/Board/BoardsList.vue` — список досок (вызывает focus)

## Отладка

### Фокус не работает
1. Проверь что объект существует (`findCardById` не возвращает null)
2. Проверь `canvasContainerRef` — не null ли
3. Проверь функцию `panTo` — вызывается ли

### Объект не в центре после фокуса
1. Проверь вычисление центра объекта
2. Проверь `zoomScale` — актуально ли значение
3. Проверь размеры viewport — правильны ли

### Анимация не плавная
1. Проверь параметр `animate: true` в `panTo`
2. Проверь CSS transitions в контейнере
3. Возможно конфликт с другими анимациями
