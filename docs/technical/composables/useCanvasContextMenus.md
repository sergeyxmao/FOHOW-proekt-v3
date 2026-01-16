# useCanvasContextMenus.js

> Контекстные меню для объектов холста

## Общая информация

| Параметр | Значение |
|----------|----------|
| **Файл** | `src/composables/useCanvasContextMenus.js` |
| **Размер** | ~151 строка |
| **Создан** | Декабрь 2025 (рефакторинг CanvasBoard.vue) |
| **Зависимости** | imagesStore |

## Назначение

Этот composable управляет контекстными меню (правый клик) 
для изображений и пустого холста.

### Ключевые возможности:
- Контекстное меню для изображений
- Контекстное меню для пустого холста
- Позиционирование меню
- Закрытие при клике вне

## API

### Входные параметры

```javascript
useCanvasContextMenus({
  imagesStore,   // Pinia store изображений
})
```

### Возвращаемые значения

```javascript
{
  // Меню изображения
  imageContextMenu,           // ref<{ imageId } | null>
  imageContextMenuPosition,   // ref<{ x, y }>
  
  // Меню холста
  stageContextMenu,           // ref<boolean>
  stageContextMenuPosition,   // ref<{ x, y }>
  
  // Методы
  showImageContextMenu,       // (event, imageId) => void
  showStageContextMenu,       // (event) => void
  closeContextMenus,          // () => void
  handleClickOutside,         // (event) => void
}
```

## Структура состояния

```javascript
// Меню изображения
imageContextMenu = {
  imageId: string,   // ID изображения
}

imageContextMenuPosition = {
  x: number,         // Screen X
  y: number,         // Screen Y
}

// Меню холста
stageContextMenu = true | false

stageContextMenuPosition = {
  x: number,
  y: number,
}
```

## Показ контекстного меню

### Меню изображения

```javascript
showImageContextMenu(event, imageId) {
  // Предотвратить стандартное меню браузера
  event.preventDefault()
  event.stopPropagation()
  
  // Закрыть другие меню
  stageContextMenu.value = false
  
  // Установить данные меню
  imageContextMenu.value = { imageId }
  imageContextMenuPosition.value = {
    x: event.clientX,
    y: event.clientY,
  }
}
```

### Меню холста

```javascript
showStageContextMenu(event) {
  event.preventDefault()
  event.stopPropagation()
  
  // Закрыть другие меню
  imageContextMenu.value = null
  
  // Показать меню холста
  stageContextMenu.value = true
  stageContextMenuPosition.value = {
    x: event.clientX,
    y: event.clientY,
  }
}
```

## Закрытие меню

```javascript
closeContextMenus() {
  imageContextMenu.value = null
  stageContextMenu.value = false
}

// Закрытие при клике вне меню
handleClickOutside(event) {
  const isInsideImageMenu = event.target.closest('.image-context-menu')
  const isInsideStageMenu = event.target.closest('.stage-context-menu')
  
  if (!isInsideImageMenu && !isInsideStageMenu) {
    closeContextMenus()
  }
}
```

## Использование в CanvasBoard.vue

```javascript
import { useCanvasContextMenus } from '@/composables/useCanvasContextMenus'

const {
  imageContextMenu,
  imageContextMenuPosition,
  stageContextMenu,
  stageContextMenuPosition,
  showImageContextMenu,
  showStageContextMenu,
  closeContextMenus,
  handleClickOutside,
} = useCanvasContextMenus({
  imagesStore,
})

// Обработка правого клика на изображении
const handleImageContextMenu = (event, imageId) => {
  showImageContextMenu(event, imageId)
}

// Обработка правого клика на пустом холсте
const handleStageContextMenu = (event) => {
  // Проверяем что клик не на объекте
  if (isClickOnEmpty(event)) {
    showStageContextMenu(event)
  }
}

// Закрытие при клике
onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  document.addEventListener('contextmenu', handleClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('contextmenu', handleClickOutside)
})
```

## В template

```html
<!-- Контекстное меню изображения -->
<ImageContextMenu
  v-if="imageContextMenu"
  :image-id="imageContextMenu.imageId"
  :position="imageContextMenuPosition"
  @close="closeContextMenus"
  @delete="handleDeleteImage"
  @duplicate="handleDuplicateImage"
  @bring-to-front="handleBringToFront"
  @send-to-back="handleSendToBack"
  @lock="handleLockImage"
/>

<!-- Контекстное меню холста -->
<StageContextMenu
  v-if="stageContextMenu"
  :position="stageContextMenuPosition"
  @close="closeContextMenus"
  @paste="handlePaste"
  @add-card="handleAddCard"
  @add-sticker="handleAddSticker"
/>

<!-- CanvasImage компонент -->
<CanvasImage
  v-for="image in sortedImages"
  :key="image.id"
  :image="image"
  @contextmenu="(payload) => handleImageContextMenu(payload.event, payload.imageId)"
/>
```

## Обработка emit событий с объектами

**ВАЖНО:** При обработке кастомных emit событий, которые передают объект, нужно учитывать, что Vue передает весь объект как первый параметр.

### Неправильно (вызывает ошибку)

```javascript
// CanvasImage.vue эмитит объект
emit('contextmenu', { event, imageId: props.image.id })

// CanvasBoard.vue - НЕПРАВИЛЬНАЯ обработка
@contextmenu="({ event, imageId }) => handleImageContextMenu(event, imageId)"
// ❌ Деструктуризация происходит неправильно!
// В handleImageContextMenu первым параметром придет весь объект { event, imageId }
```

**Ошибка:** `TypeError: A is not a function` - потому что `event` на самом деле содержит объект, а не DOM событие.

### Правильно

```javascript
// CanvasImage.vue эмитит объект (без изменений)
emit('contextmenu', { event, imageId: props.image.id })

// CanvasBoard.vue - ПРАВИЛЬНАЯ обработка
@contextmenu="(payload) => handleImageContextMenu(payload.event, payload.imageId)"
// ✅ Получаем весь объект как payload, затем извлекаем нужные свойства
```

### Почему так?

Vue emit всегда передает аргументы в том виде, как они были переданы в `emit()`. Если вы передаете один объект, он приходит как первый параметр целиком. Деструктуризация в параметрах обработчика не работает с Vue emit.

**Альтернативный способ (если можно изменить emit):**

```javascript
// CanvasImage.vue - передать отдельные параметры
emit('contextmenu', event, imageId)  // два отдельных параметра

// CanvasBoard.vue - принять отдельные параметры
@contextmenu="handleImageContextMenu"  // функция получит (event, imageId)
```

Но в нашем случае мы сохраняем передачу объекта для единообразия с другими компонентами.

## Пункты меню изображения

| Пункт | Действие |
|-------|----------|
| Дублировать | Создать копию изображения |
| Удалить | Удалить изображение |
| На передний план | Увеличить z-index |
| На задний план | Уменьшить z-index |
| Заблокировать | Запретить перемещение/resize |
| Разблокировать | Разрешить перемещение |

## Пункты меню холста

| Пункт | Действие |
|-------|----------|
| Вставить | Вставить из буфера обмена |
| Добавить карточку | Создать карточку в позиции клика |
| Добавить стикер | Создать стикер в позиции клика |
| Выбрать все | Выделить все объекты |

## Позиционирование меню

Меню позиционируется абсолютно относительно viewport:

```css
.context-menu {
  position: fixed;
  z-index: 10000;
}
```

```javascript
// Корректировка если меню выходит за экран
const adjustPosition = (x, y, menuWidth, menuHeight) => {
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  
  // Если выходит справа
  if (x + menuWidth > viewportWidth) {
    x = viewportWidth - menuWidth - 10
  }
  
  // Если выходит снизу
  if (y + menuHeight > viewportHeight) {
    y = viewportHeight - menuHeight - 10
  }
  
  return { x, y }
}
```

## Закрытие по Escape

```javascript
const handleKeydown = (event) => {
  if (event.key === 'Escape') {
    closeContextMenus()
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})
```

## Связанные файлы

- `src/stores/images.js` — операции с изображениями
- `src/components/Canvas/ImageContextMenu.vue` — UI меню изображения
- `src/components/Canvas/StageContextMenu.vue` — UI меню холста

## Отладка

### Меню не появляется
1. Проверь `event.preventDefault()` — вызывается ли
2. Проверь значения `imageContextMenu` / `stageContextMenu`
3. Проверь условие рендеринга в template

### Меню в неправильной позиции
1. Проверь `event.clientX`, `event.clientY`
2. Проверь CSS `position: fixed`
3. Проверь нет ли transform на родителе

### Меню не закрывается
1. Проверь `handleClickOutside` — зарегистрирован ли listener
2. Проверь `.closest()` — правильный ли селектор
3. Проверь что клик не на самом меню
