# useCanvasConnections.js

> Соединения (линии) между карточками

## Общая информация

| Параметр | Значение |
|----------|----------|
| **Файл** | `src/composables/useCanvasConnections.js` |
| **Размер** | ~226 строк |
| **Создан** | Декабрь 2025 (рефакторинг CanvasBoard.vue) |
| **Зависимости** | connectionsStore, cardsStore |

## Назначение

Этот composable управляет созданием и редактированием линий 
соединения между карточками.

### Ключевые возможности:
- Рисование preview линии при создании
- Создание соединения между карточками
- Выделение и удаление соединений
- Control points для редактирования формы линии

## API

### Входные параметры

```javascript
useCanvasConnections({
  connectionsStore,   // Pinia store соединений
  cardsStore,         // Store карточек (для позиций)
  zoomScale,          // ref - текущий масштаб
  mousePosition,      // ref - позиция мыши
  screenToCanvas,     // (x, y) => {x, y} - конвертация координат
})
```

### Возвращаемые значения

```javascript
{
  // Состояние рисования
  connectionStart,          // ref - начальная точка {cardId, side}
  isDrawingLine,            // ref<boolean> - идёт ли рисование
  previewLine,              // ref - preview линия {from, to}
  previewLineWidth,         // computed - толщина preview
  
  // Выделение
  selectedConnectionIds,    // ref<Array> - выделенные соединения
  
  // Control points
  draggingControlPoint,     // ref - перетаскиваемая точка
  
  // Методы создания
  startConnection,          // (cardId, side) => void
  updatePreviewLine,        // (mousePos) => void
  finishConnection,         // (targetCardId, targetSide) => void
  cancelConnection,         // () => void
  
  // Обработчики
  handleLineClick,          // (event, connectionId) => void
  handleControlPointDoubleClick, // (event, connectionId, pointIndex) => void
  handleControlPointDragStart,   // (event, connectionId, pointIndex) => void
  handleControlPointDrag,        // (event) => void
  handleControlPointDragEnd,     // () => void
  
  // Утилиты
  createConnectionBetweenCards, // (fromId, toId, options) => Connection
  deleteSelectedConnections,    // () => void
}
```

## Структура соединения

```javascript
connection = {
  id: string,
  from: string,           // ID карточки-источника
  to: string,             // ID карточки-цели
  fromSide: Side,         // 'top' | 'right' | 'bottom' | 'left'
  toSide: Side,
  color: string,          // Цвет линии
  thickness: number,      // Толщина
  controlPoints: [        // Точки для изгиба линии
    { x, y },
    { x, y },
  ],
  highlightType: string,  // Тип подсветки
}
```

## Стороны карточки (Sides)

```
          ┌─────────────┐
          │    top      │
          ├─────────────┤
          │             │
   left   │   CARD      │  right
          │             │
          ├─────────────┤
          │   bottom    │
          └─────────────┘
```

## Алгоритм создания соединения

```
1. Наведение на край карточки
   └── Показать точку подключения
           │
2. mousedown на точке
   └── startConnection(cardId, side)
           │
3. mousemove
   └── updatePreviewLine(mousePos)
       └── Рисовать preview от start до курсора
           │
4. mouseup на точке другой карточки
   └── finishConnection(targetCardId, targetSide)
       └── Создать соединение в store
           │
   или mouseup на пустом месте
   └── cancelConnection()
       └── Очистить preview
```

## Preview линия

Пока пользователь тянет соединение, показывается preview:

```javascript
updatePreviewLine(mousePos) {
  if (!connectionStart.value) return
  
  const startCard = cardsStore.getById(connectionStart.value.cardId)
  const startPoint = getConnectionPoint(startCard, connectionStart.value.side)
  
  previewLine.value = {
    from: startPoint,
    to: mousePos,
    color: connectionsStore.defaultColor,
    thickness: connectionsStore.defaultLineThickness,
  }
}
```

## Control Points

Соединения могут иметь control points для создания изгибов:

```javascript
// Добавление control point (двойной клик на линии)
handleControlPointDoubleClick(event, connectionId) {
  const connection = connectionsStore.getById(connectionId)
  const clickPoint = screenToCanvas(event.clientX, event.clientY)
  
  // Найти ближайшую точку на линии
  const insertIndex = findBestInsertIndex(connection, clickPoint)
  
  // Вставить новую control point
  connection.controlPoints.splice(insertIndex, 0, clickPoint)
}

// Перетаскивание control point
handleControlPointDrag(event) {
  const { connectionId, pointIndex } = draggingControlPoint.value
  const newPos = screenToCanvas(event.clientX, event.clientY)
  
  connectionsStore.updateControlPoint(connectionId, pointIndex, newPos)
}
```

## Выделение соединений

```javascript
handleLineClick(event, connectionId) {
  if (event.ctrlKey || event.metaKey) {
    // Добавить к выделению
    if (selectedConnectionIds.value.includes(connectionId)) {
      selectedConnectionIds.value = selectedConnectionIds.value.filter(
        id => id !== connectionId
      )
    } else {
      selectedConnectionIds.value.push(connectionId)
    }
  } else {
    // Выделить только это соединение
    selectedConnectionIds.value = [connectionId]
  }
}
```

## Удаление соединений

```javascript
deleteSelectedConnections() {
  selectedConnectionIds.value.forEach(id => {
    connectionsStore.deleteConnection(id)
  })
  selectedConnectionIds.value = []
}
```

## Использование в CanvasBoard.vue

```javascript
import { useCanvasConnections } from '@/composables/useCanvasConnections'

const {
  connectionStart,
  isDrawingLine,
  previewLine,
  selectedConnectionIds,
  startConnection,
  updatePreviewLine,
  finishConnection,
  cancelConnection,
  handleLineClick,
  deleteSelectedConnections,
} = useCanvasConnections({
  connectionsStore,
  cardsStore,
  zoomScale,
  mousePosition,
  screenToCanvas,
})

// Начало соединения (клик на точке карточки)
const handleConnectionPointClick = (cardId, side) => {
  if (isDrawingLine.value) {
    // Завершаем соединение
    finishConnection(cardId, side)
  } else {
    // Начинаем соединение
    startConnection(cardId, side)
  }
}

// Обновление preview при движении мыши
watch(mousePosition, (pos) => {
  if (isDrawingLine.value) {
    updatePreviewLine(pos)
  }
})

// Отмена по Escape
const handleKeydown = (event) => {
  if (event.key === 'Escape' && isDrawingLine.value) {
    cancelConnection()
  }
  if (event.key === 'Delete' && selectedConnectionIds.value.length) {
    deleteSelectedConnections()
  }
}
```

## В template

```html
<!-- Соединения -->
<svg class="connections-layer">
  <!-- Существующие соединения -->
  <g
    v-for="conn in connections"
    :key="conn.id"
    :class="{ 'connection--selected': selectedConnectionIds.includes(conn.id) }"
    @click="(e) => handleLineClick(e, conn.id)"
  >
    <path :d="buildPath(conn)" />
    
    <!-- Control points -->
    <circle
      v-for="(point, index) in conn.controlPoints"
      :key="index"
      :cx="point.x"
      :cy="point.y"
      r="5"
      @mousedown="(e) => handleControlPointDragStart(e, conn.id, index)"
      @dblclick="(e) => handleControlPointDoubleClick(e, conn.id, index)"
    />
  </g>
  
  <!-- Preview линия -->
  <path
    v-if="previewLine"
    :d="buildPreviewPath(previewLine)"
    class="connection--preview"
  />
</svg>
```

## Связанные файлы

- `src/stores/connections.js` — хранение соединений
- `src/composables/useBezierCurves.js` — математика кривых
- `src/components/Canvas/Connection.vue` — UI компонент соединения

## Отладка

### Линии не рисуются
1. Проверь `connectionStart` — установлен ли
2. Проверь `previewLine` — есть ли данные
3. Проверь SVG layer — отрисовывается ли

### Соединение не создаётся
1. Проверь `finishConnection` — вызывается ли
2. Проверь что карточки разные (нельзя соединить карточку с собой)
3. Проверь `connectionsStore.addConnection`

### Control points не работают
1. Проверь `draggingControlPoint` — устанавливается ли
2. Проверь обработчики событий на circle элементах
3. Проверь z-index точек — кликабельны ли они
