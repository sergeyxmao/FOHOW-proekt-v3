# Sticker.vue

## Описание
Компонент желтого стикера (заметки) на интерактивной доске. Поддерживает создание, редактирование, перемещение и удаление стикеров.

## Расположение
`src/components/Canvas/Sticker.vue`

## Props

| Prop | Тип | Обязательный | Описание |
|------|-----|--------------|----------|
| `sticker` | Object | Да | Объект стикера с полями: `id`, `pos_x`, `pos_y`, `color`, `content`, `z_index`, `selected` |
| `isAnimated` | Boolean | Нет | Флаг для анимации (например, при изменении PV) |

## Emits

| Событие | Параметры | Описание |
|---------|-----------|----------|
| `sticker-click` | `(event, stickerId)` | Клик по стикеру (для выделения) |
| `start-drag` | `(event, stickerId)` | Начало перетаскивания стикера |

## Публичный API (defineExpose)

### `closeEditing()`
Программно закрывает режим редактирования стикера.

**Использование:**
```javascript
const stickerComponent = stickerRefs.value.get(stickerId);
if (stickerComponent) {
  stickerComponent.closeEditing();
}
```

### `startEditing()`
Программно открывает режим редактирования стикера и устанавливает фокус на textarea.

**Использование:**
```javascript
const stickerComponent = stickerRefs.value.get(stickerId);
if (stickerComponent && typeof stickerComponent.startEditing === 'function') {
  stickerComponent.startEditing();
}
```

**Примечание:** Этот метод используется в `CanvasBoard.vue` при создании нового стикера, чтобы автоматически открыть поле ввода без использования синтетических событий `dblclick`.

## Основные функции

### Режим редактирования

#### Вход в режим редактирования
- **Двойной клик** по стикеру (`@dblclick="handleDoubleClick"`)
- **Двойной тап на мобильных** — ручное определение в `handlePointerDown` (два тапа за 400мс), т.к. `dblclick` не работает с `touch-action: none` на canvas-контейнере
- **Программный вызов** `startEditing()` (например, при создании нового стикера)

#### Выход из режима редактирования
- **Клик вне стикера** - сохраняет изменения
- **Клавиша Esc** - отменяет изменения и восстанавливает оригинальный текст
- **Программный вызов** `closeEditing()`

#### Защита от ложных срабатываний
Компонент использует `editingStartTime` для защиты от преждевременного закрытия поля ввода:

```javascript
const editingStartTime = ref(0);

// При открытии редактирования запоминаем время
watch(isEditing, (newValue) => {
  if (newValue) {
    editingStartTime.value = performance.now();
    // ...
  }
});

// В handleClickOutside игнорируем клики в первые 300мс
const handleClickOutside = (event) => {
  if (performance.now() - editingStartTime.value < 300) return;
  // ...
};
```

Это предотвращает закрытие поля ввода от:
- Синтетических событий при создании стикера
- "Эха" кликов, которые всплывают после открытия редактирования
- Случайных кликов пользователя сразу после открытия

### Перетаскивание
Стикеры перетаскиваются через систему `handlePointerDown/Move/Up`. Во время редактирования перетаскивание отключено.

При клике на фон стикера во время редактирования:
- Фокус возвращается на textarea
- Поле ввода не закрывается

### Удаление
Кнопка удаления появляется при наведении на стикер (`.sticker__delete--visible`). При клике показывается confirm диалог.

## Стили и классы

### Основные классы
- `.sticker` - базовый класс стикера
- `.sticker--editing` - стикер в режиме редактирования (z-index: 99999)
- `.sticker--selected` - выделенный стикер (синяя обводка)
- `.sticker--dragging` - стикер в процессе перетаскивания
- `.is-animated` - анимация стикера (при изменении PV)

### Z-Index
- Обычные стикеры: `z_index` (минимум 10000, всегда поверх изображений)
- Стикер в режиме редактирования: 99999
- Стикер при перетаскивании: 99999

## Интеграция с CanvasBoard.vue

### Регистрация ref
```javascript
// В CanvasBoard.vue
const stickerRefs = ref(new Map());

const handleStickerRefRegister = (stickerId, stickerComponent) => {
  if (stickerComponent) {
    stickerRefs.value.set(stickerId, stickerComponent);
  } else {
    stickerRefs.value.delete(stickerId);
  }
};
```

### Создание нового стикера с автоматическим редактированием
```javascript
// В CanvasBoard.vue (примерно строка 1600)
const newSticker = await stickersStore.addSticker(boardStore.currentBoardId, {
  pos_x: Math.round(x),
  pos_y: Math.round(y),
  color: '#FFFF88',
});

if (!newSticker) {
  stickersStore.disablePlacementMode();
  return;
}

clearObjectSelections();
stickersStore.selectSticker(newSticker.id);
stickersStore.disablePlacementMode();

await nextTick();

// Используем прямой вызов метода вместо синтетического dblclick
const stickerComponent = stickerRefs.value.get(newSticker.id);
if (stickerComponent && typeof stickerComponent.startEditing === 'function') {
  stickerComponent.startEditing();
}
```

### Закрытие всех стикеров
```javascript
// В CanvasBoard.vue
stickerRefs.value.forEach((stickerComponent) => {
  if (stickerComponent && typeof stickerComponent.closeEditing === 'function') {
    stickerComponent.closeEditing();
  }
});
```

## Store (Pinia)
Компонент использует `useStickersStore`:
- `updateSticker(id, data)` - сохранение изменений
- `deleteSticker(id)` - удаление стикера
- `selectSticker(id)` - выделение стикера

## Особенности реализации

### Обработка blur с задержкой
Вместо немедленного закрытия при потере фокуса, компонент использует `handleBlur` с проверкой:

```javascript
const handleBlur = () => {
  setTimeout(() => {
    // Проверяем, находится ли новый activeElement внутри стикера
    if (isEditing.value && stickerRef.value && !stickerRef.value.contains(document.activeElement)) {
      saveChanges();
    }
  }, 0);
};
```

Это позволяет кликать на фон стикера без закрытия поля ввода.

### Предотвращение потери фокуса при клике на фон
```javascript
const handlePointerDown = (e) => {
  if (isEditing.value) {
    if (!e.target.classList.contains('sticker__textarea')) {
      e.preventDefault(); // Предотвращаем потерю фокуса
      e.stopPropagation();
      // Возвращаем фокус на textarea
      const textarea = e.currentTarget.querySelector('.sticker__textarea');
      if (textarea) {
        textarea.focus();
      }
    }
    return;
  }
  // ...
};
```

## История изменений

### 2026-02-17: Исправлен двойной тап на мобильных
- Добавлено ручное определение двойного тапа в `handlePointerDown` (два тапа за 400мс вызывают `handleDoubleClick`)
- Причина: `touch-action: none` на canvas-контейнере блокирует генерацию нативного `dblclick` из touch-событий

### 2026-01-13: Улучшена система открытия редактирования
- Добавлен метод `startEditing()` в публичный API
- Добавлена защита от ложных срабатываний через `editingStartTime`
- Увеличена задержка в `watch(isEditing)` с 100мс до 300мс
- В `CanvasBoard.vue` заменен синтетический `dblclick` на прямой вызов метода
- Улучшен `handleClickOutside` с проверкой времени

### Предыдущие изменения
- Исправлена потеря фокуса при клике на фон стикера
- Добавлен умный обработчик `handleBlur`
- Добавлена анимация при изменении PV

## Связанные файлы
- `src/components/Canvas/CanvasBoard.vue` - родительский компонент
- `src/stores/stickers.js` - Pinia store для стикеров
- `docs/technical/composables/useCanvasSelection.md` - выделение объектов
