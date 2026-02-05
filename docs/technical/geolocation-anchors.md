# Геолокационные якоря (Anchors)

## Описание функции

Геолокационные якоря (anchors) — это точки на доске, которые позволяют пользователям отмечать ключевые места и добавлять к ним описания. Якоря используются для:

- Маркировки важных мест на карте/доске
- Добавления географических ориентиров
- Создания точек интереса с описаниями

## Расположение файлов

| Файл | Назначение |
|------|------------|
| `src/stores/anchors.js` | Pinia store для управления состоянием якорей |
| `api/routes/anchors.js` | API маршруты для CRUD операций с якорями |
| `src/components/Canvas/CanvasBoard.vue` | Компонент доски, обрабатывающий размещение якорей |
| `src/components/Canvas/AnchorPoint.vue` | Компонент отображения отдельного якоря |

## Как работает добавление точки

### Последовательность действий

1. **Активация режима размещения**
   - Пользователь нажимает кнопку в `DiscussionMenu`
   - Вызывается `boardStore.setPlacementMode('anchor')`
   - Курсор меняется на специальный (crosshair)

2. **Клик по доске**
   - Пользователь кликает на желаемое место
   - Срабатывает обработчик `handleStageClick` в `CanvasBoard.vue`
   - Проверяется, что `placementMode.value === 'anchor'`

3. **Создание якоря**
   - Координаты клика преобразуются в координаты canvas через `screenToCanvas()`
   - Вызывается `anchorsStore.createAnchor(boardId, { pos_x, pos_y, description })`
   - Store отправляет POST-запрос на сервер

4. **Завершение**
   - Режим размещения сбрасывается: `boardStore.setPlacementMode(null)`
   - Открывается панель якорей: `sidePanelsStore.openAnchors()`
   - Запускается редактирование нового якоря: `boardStore.requestAnchorEdit(id)`

### Защита от двойного создания

В обработчике `handleStageClick` реализована защита от повторного вызова с помощью флага `_anchorCreating`:

```javascript
let _anchorCreating = false;

const handleStageClick = async (event) => {
  if (placementMode.value === 'anchor') {
    if (_anchorCreating) {
      return; // Предотвращаем повторный вызов
    }
    _anchorCreating = true;

    try {
      // ... создание якоря ...
    } finally {
      _anchorCreating = false;
    }
  }
};
```

## Структура базы данных

### Таблица `board_anchors`

| Колонка | Тип | Описание |
|---------|-----|----------|
| `id` | UUID | Первичный ключ |
| `board_id` | UUID | Внешний ключ на таблицу boards |
| `user_id` | UUID | Внешний ключ на таблицу users |
| `pos_x` | INTEGER | Координата X на доске |
| `pos_y` | INTEGER | Координата Y на доске |
| `description` | TEXT | Описание точки |
| `created_at` | TIMESTAMP | Дата создания |
| `updated_at` | TIMESTAMP | Дата последнего обновления |

## API эндпоинты

### Получение якорей доски
```
GET /api/boards/:boardId/anchors
```
Возвращает массив всех якорей для указанной доски.

### Создание якоря
```
POST /api/boards/:boardId/anchors
Body: { pos_x: number, pos_y: number, description: string }
```
Создает новый якорь на доске.

### Обновление якоря
```
PUT /api/anchors/:anchorId
Body: { pos_x?: number, pos_y?: number, description?: string }
```
Обновляет данные якоря.

### Удаление якоря
```
DELETE /api/anchors/:anchorId
```
Удаляет якорь.

## События и обработчики

### В шаблоне CanvasBoard.vue

```html
<div class="canvas-container"
  @pointerdown="handleStageClick"
  @touchstart.capture="handleMobileTouchStart">
```

- `@pointerdown` — основной обработчик для десктопа (работает для mouse и touch)
- `@touchstart.capture` — обработчик для мобильных устройств

## История изменений

### 2026-02-05
- **Исправлено**: Дублирование геоточек при добавлении на доску
  - Удален обработчик `@mousedown="handleStageClick"` с элементов `.canvas-container` и `.svg-layer`
  - Оставлен только `@pointerdown="handleStageClick"` (pointerdown покрывает и mouse, и touch события)
  - Добавлена защита от повторного вызова через флаг `_anchorCreating`
  - Причина проблемы: браузер генерировал и `mousedown`, и `pointerdown` при одном клике, что приводило к двум POST-запросам
