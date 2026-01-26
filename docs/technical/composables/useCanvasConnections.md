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

## "Магнитное" соединение линий (2026-01-26)

### Описание функциональности

При рисовании соединительной линии между карточками пользователю не нужно точно попадать в маленькую точку соединения (connection-point). Вместо этого, при отпускании пальца/мыши вблизи карточки, соединение автоматически создаётся к ближайшей стороне этой карточки.

### Константы

```javascript
const DESKTOP_SNAP_MARGIN = 30 // Отступ для захвата карточки на ПК (px)
const MOBILE_SNAP_MARGIN = 50  // Увеличенный отступ для мобильных (px)
```

### Новые функции

```javascript
// Поиск карточки под точкой с учётом "магнитного" отступа
findCardAtPoint(pointX, pointY, {
  isMobile: boolean,      // Использовать увеличенный отступ
  excludeCardId: string   // Исключить карточку из поиска
}) => Card | null

// Определение ближайшей стороны карточки
getClosestSide(card, pointX, pointY) => 'top' | 'right' | 'bottom' | 'left'

// Попытка создать "магнитное" соединение при pointerup
tryMagneticConnection(pointX, pointY, isMobile) => boolean
```

### Алгоритм магнитного соединения

```
1. Пользователь начинает рисовать линию (pointerdown на connection-point)
   └── startDrawingLine(cardId, side)
           │
2. Пользователь отпускает палец/мышь (pointerup)
   ├── Если на connection-point
   │   └── endDrawingLine(cardId, side) — точное соединение
   │
   └── Если НЕ на connection-point
       └── tryMagneticConnection(x, y, isMobile)
           │
           ├── Ищем карточку в зоне захвата (findCardAtPoint)
           │   └── Зона: 30px на ПК, 50px на мобильных
           │
           ├── Если карточка найдена (и это не исходная карточка)
           │   ├── Определяем ближайшую сторону (getClosestSide)
           │   └── endDrawingLine(targetCardId, closestSide)
           │
           └── Если карточка НЕ найдена
               └── cancelDrawing()
```

### Приоритет точного клика

Клик непосредственно по connection-point имеет приоритет над магнитным соединением:
- В `handlePointerUp` проверяется `event.target.closest('.connection-point')`
- Если клик на connection-point — пропускаем обработку (уже обработано в `handlePointerDown`)

### Использование в CanvasBoard.vue

```javascript
// Обработчик pointerup добавляется когда начинается рисование линии
watch(isDrawingLine, (isActive) => {
  if (isActive) {
    window.addEventListener('pointerup', handlePointerUp);
  } else {
    window.removeEventListener('pointerup', handlePointerUp);
  }
});

// Обработчик
const handlePointerUp = (event) => {
  if (!isDrawingLine.value) return;

  // Пропускаем если клик на connection-point
  if (event.target.closest('.connection-point')) return;

  const canvasPos = screenToCanvas(event.clientX, event.clientY);
  tryMagneticConnection(canvasPos.x, canvasPos.y, isMobileMode.value);
};
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

## ИСПРАВЛЕННАЯ ПРОБЛЕМА: isDrawingLine сбрасывается между кликами (2026-01-10)

### Описание проблемы

При попытке создать соединение между двумя карточками происходило следующее:
- **Клик 1** (point1): `startDrawingLine` → `isDrawingLine=true` ✓
- **Клик 2** (point2): **СНОВА** `startDrawingLine` (вместо `endDrawingLine`) ❌
- `connectionsStore.connections` оставался пустым
- Логи показывали 2x "Начало рисования линии" с разными cardId/side

### Причина

Проблема была в **порядке срабатывания обработчиков событий** в `CanvasBoard.vue`:

1. `handleStageClick` (строка 1487) висит на `@mousedown` корневого `.canvas-container` (строка 2290)
2. `handlePointerDown` (строка 1262) висит на `@pointerdown` того же `.canvas-container`
3. При клике на connection-point оба обработчика срабатывают:
   - **СНАЧАЛА** `handleStageClick` (mousedown)
   - **ЗАТЕМ** `handlePointerDown` (pointerdown)

**Flow проблемы:**
```
Клик на connection-point карточки B (второй клик)
    ↓
1. handleStageClick срабатывает ПЕРВЫМ
   - НЕ проверяет, что клик на connection-point
   - Доходит до строки 1644: cancelDrawing()
   - isDrawingLine.value = false ❌
   - connectionStart.value = null ❌
    ↓
2. handlePointerDown срабатывает вторым
   - event.stopPropagation() (не помогает, т.к. оба на одном элементе)
   - Проверяет: !isDrawingLine.value → true (уже сброшен!)
   - СНОВА вызывает startDrawingLine() ❌
```

**Почему stopPropagation не помогал:**
`event.stopPropagation()` в `handlePointerDown` останавливает всплытие события вверх по DOM-дереву, но не влияет на другие обработчики **того же элемента**. Поскольку оба обработчика висят на `.canvas-container`, они оба срабатывают.

### Решение

**Файл:** `src/components/Canvas/CanvasBoard.vue:1644`

**До:**
```javascript
selectedConnectionIds.value = [];
cancelDrawing();
```

**После:**
```javascript
// Не отменяем рисование, если кликнули на connection-point
const isConnectionPoint = event.target.closest('.connection-point');
if (!isConnectionPoint) {
  selectedConnectionIds.value = [];
  cancelDrawing();
}
```

Теперь `handleStageClick` проверяет, был ли клик на connection-point, и **НЕ** вызывает `cancelDrawing()` в этом случае, сохраняя состояние `isDrawingLine=true`.

### Проверка исправления

**Тест-кейс:**
1. Открыть доску с двумя лицензиями
2. Кликнуть на левую connection-point первой лицензии
   - ✓ Появляется оранжевая пунктирная preview line
   - ✓ Консоль: "Начало рисования линии: {cardId: ..., side: 'left'}"
3. Кликнуть на правую connection-point второй лицензии
   - ✓ Линия создаётся и становится постоянной
   - ✓ Консоль: "Создано соединение: cardA -> cardB"
   - ✓ Vue DevTools: `connectionsStore.connections` содержит новое соединение
   - ✓ SVG слой: отображается путь линии

**Debug логи для отладки:**
```javascript
// CanvasBoard.vue - в начале handlePointerDown
console.log('🔵 pointerDown', {
  isDrawingLine: isDrawingLine.value,
  target: event.target.className,
  isConnectionPoint: !!event.target.closest('.connection-point')
});

// CanvasBoard.vue - в начале handleStageClick
console.log('🟡 stageClick', {
  isDrawingLine: isDrawingLine.value,
  target: event.target.className,
  isConnectionPoint: !!event.target.closest('.connection-point')
});
```
