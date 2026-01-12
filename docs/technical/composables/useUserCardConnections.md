# useUserCardConnections.js

> Управление соединениями между user_card (партнёрами) с анимациями

## Общая информация

| Параметр | Значение |
|----------|----------|
| **Файл** | `src/composables/useUserCardConnections.js` |
| **Размер** | ~688 строк |
| **Создан** | Декабрь 2025 (рефакторинг CanvasBoard.vue) |
| **Зависимости** | connectionsStore, viewSettingsStore, useBezierCurves |

## Назначение

Этот composable управляет специальным типом соединений — линиями между user_card (партнёрами).
User cards — это визуальные представления партнёров в MLM-структуре.

### Ключевые возможности:
- Рисование Bezier-кривых между user_card (партнёрами)
- Анимация пульсации соединений
- Контекстное меню user_card
- Модальное окно для ввода номера user_card
- Выделение и редактирование соединений

## API

### Входные параметры

```javascript
useUserCardConnections({
  connectionsStore,    // Pinia store с соединениями
  viewSettingsStore,   // Store настроек отображения
  cardsStore,          // Store карточек (для позиций)
  zoomScale,           // ref - текущий масштаб
  screenToCanvas,      // (x, y) => {x, y} - конвертация координат
  buildBezierPath,     // Функция из useBezierCurves
  getAvatarConnectionPoint, // Функция из useBezierCurves
})
```

### Возвращаемые значения

```javascript
{
  // Состояние рисования
  avatarConnectionStart,       // ref - начальная точка {avatarId, pointIndex}
  isDrawingAvatarConnection,   // computed - идёт ли рисование
  
  // Выделение
  selectedAvatarConnectionIds, // ref<Array> - выделенные соединения
  
  // Контекстное меню
  avatarContextMenu,           // ref - {avatarId} или null
  avatarContextMenuPosition,   // ref - {x, y}
  
  // Модальное окно номера
  avatarNumberModalVisible,    // ref<boolean>
  avatarNumberModalAvatarId,   // ref - ID user_card
  avatarNumberModalCurrentId,  // ref - текущий номер
  
  // Анимации
  animatedAvatarIds,           // ref<Set> - аватары с анимацией
  animatedAvatarConnectionIds, // ref<Set> - соединения с анимацией
  
  // Обработчики событий
  handleAvatarConnectionPointClick, // Клик на точку соединения
  handleAvatarLineClick,            // Клик на линию
  handleAvatarLineDoubleClick,      // Двойной клик на линию
  handleAvatarContextMenu,          // Правый клик на аватар
  handleAvatarDoubleClick,          // Двойной клик на аватар
  handleAvatarNumberApply,          // Применение номера
  
  // Анимации
  startAvatarAnimation,        // Запуск анимации
  stopAvatarAnimation,         // Остановка анимации
  
  // Утилиты
  collectAvatarConnectionSnapshots, // Снимки для drag
  closeAvatarContextMenu,      // Закрыть меню
}
```

## Состояния соединения

```
┌─────────────────┐
│     IDLE        │ ← Начальное состояние
└────────┬────────┘
         │ Клик на точку user_card
         ▼
┌─────────────────┐
│    DRAWING      │ ← Рисуется preview линия
└────────┬────────┘
         │ Клик на другую точку
         ▼
┌─────────────────┐
│   CONNECTED     │ ← Соединение создано
└─────────────────┘
```

## Анимации

### Пульсация соединений

Когда активируется анимация:
1. ID добавляется в `animatedAvatarConnectionIds`
2. CSS класс применяется к SVG path
3. Через `animationDuration` анимация останавливается

```javascript
// Запуск анимации для user_card и его соединений
startAvatarAnimation(avatarId)

// Остановка всех анимаций
stopAvatarAnimation()
```

### CSS анимация

```css
.avatar-connection--animated {
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { stroke-opacity: 1; }
  50% { stroke-opacity: 0.5; }
}
```

## Контекстное меню user_card

При правом клике на аватар:

```javascript
handleAvatarContextMenu(event, avatarId)
// Устанавливает:
// - avatarContextMenu = { avatarId }
// - avatarContextMenuPosition = { x, y }
```

Меню закрывается при:
- Клике вне меню
- Выборе пункта меню
- Нажатии Escape

## Модальное окно номера

Позволяет назначить аватару числовой идентификатор:

```javascript
// Открытие (двойной клик на аватар)
handleAvatarDoubleClick(event, avatarId)

// Применение номера
handleAvatarNumberApply({ avatarId, userData })
```

## Bezier-кривые

Соединения рисуются как кубические кривые Безье:

```
Start Point ──── Control Point 1
                      │
                      │
              Control Point 2 ──── End Point
```

Функция `buildBezierPath` создаёт SVG path:
```javascript
const path = buildBezierPath(startPoint, endPoint, controlPoints)
// Возвращает: "M 100 100 C 150 100, 150 200, 200 200"
```

## Использование в CanvasBoard.vue

```javascript
import { useUserCardConnections } from '@/composables/useUserCardConnections'
import { useBezierCurves } from '@/composables/useBezierCurves'

const { buildBezierPath, getAvatarConnectionPoint } = useBezierCurves()

const {
  avatarConnectionStart,
  selectedAvatarConnectionIds,
  avatarContextMenu,
  avatarContextMenuPosition,
  handleAvatarConnectionPointClick,
  handleAvatarLineClick,
  handleAvatarContextMenu,
  animatedAvatarConnectionIds,
} = useUserCardConnections({
  connectionsStore,
  viewSettingsStore,
  cardsStore,
  zoomScale,
  screenToCanvas,
  buildBezierPath,
  getAvatarConnectionPoint,
})
```

## В template

```html
<!-- Соединения -->
<svg class="avatar-connections-layer">
  <path
    v-for="conn in userCardConnections"
    :key="conn.id"
    :d="buildBezierPath(conn)"
    :class="{ 
      'avatar-connection--selected': selectedAvatarConnectionIds.includes(conn.id),
      'avatar-connection--animated': animatedAvatarConnectionIds.has(conn.id)
    }"
    @click="(e) => handleAvatarLineClick(e, conn.id)"
    @contextmenu="(e) => handleAvatarContextMenu(e, conn.avatarId)"
  />
</svg>

<!-- Контекстное меню -->
<AvatarContextMenu
  v-if="avatarContextMenu"
  :avatar-id="avatarContextMenu.avatarId"
  :position="avatarContextMenuPosition"
  @close="closeAvatarContextMenu"
/>
```

## Связанные файлы

- `src/composables/useBezierCurves.js` — математика кривых
- `src/stores/connections.js` — хранение соединений
- `src/components/Canvas/AvatarContextMenu.vue` — UI меню

## Поиск родительских карточек

### findNextUserCardUp(userCardId, visited)

**Назначение:** Поиск следующей родительской карточки в иерархии (движение вверх по цепочке).

**Параметры:**
- `userCardId` - ID текущей карточки (user_card или license)
- `visited` - Set посещённых карточек (предотвращает циклы)

**Возвращает:**
- `{ connectionId, nextUserCardId }` - соединение и ID следующей карточки
- `null` - если путь вверх не найден

**Типы карточек:**
- Обрабатывает карточки типа `user_card` (партнёры)
- Обрабатывает карточки типа `license` (лицензии)
- Позволяет анимации проходить через смешанные цепочки

**Логика:**
- Ищет соединения, где **другая точка = 1** (верхняя точка родителя)
- **Текущая точка** может быть любой (1-10)
- Это позволяет находить родителей независимо от того, от какой точки идёт соединение

**Примеры:**
```
UserCard A (точка 6) → UserCard B (точка 1): найдёт B как родителя A ✅
License C (точка 6) → UserCard A (точка 1): найдёт A как родителя C ✅
UserCard A (точка 6) → License RUY (точка 1): найдёт RUY как родителя A ✅
UserCard A (точка 1) → UserCard B (точка 6): НЕ найдёт (движение вниз) ❌
```

**История изменений:**
- **2026-01-12**: Расширена поддержка типа `license`. Теперь функция не останавливается на лицензиях, а продолжает поиск вверх по цепочке.
  - Было: `card.type === 'user_card'`
  - Стало: `card.type === 'user_card' || card.type === 'license'`
  - Причина: при клике на монетку в лицензии анимация должна проходить через всю цепочку, включая лицензии
- **2026-01-11**: Исправлен фильтр для поддержки соединений от любых точек (не только от точки 1)
  - Было: `currentPointIndex === 1 && otherPointIndex !== 1`
  - Стало: `otherPointIndex === 1 && currentPointIndex !== 1`
  - Причина: пользователи соединяют карточки от любых точек (боковых, нижних), а не только от верхней

## Отладка

### Линии не рисуются
1. Проверь `connectionsStore.userCardConnections`
2. Проверь что `buildBezierPath` возвращает валидный path
3. Проверь SVG layer в DOM

### Анимация не работает
1. Проверь `animatedAvatarConnectionIds.has(id)`
2. Проверь CSS классы на path элементе
3. Проверь `viewSettingsStore.isAnimationEnabled`

### Контекстное меню не появляется
1. Проверь что `event.preventDefault()` вызывается
2. Проверь позиционирование меню
3. Проверь z-index меню
