# useNoteWindows.js

> Управление окнами заметок карточек

## Общая информация

| Параметр | Значение |
|----------|----------|
| **Файл** | `src/composables/useNoteWindows.js` |
| **Размер** | ~170 строк |
| **Создан** | Декабрь 2025 (рефакторинг CanvasBoard.vue) |
| **Зависимости** | cardsStore, notesStore, historyStore |

## Назначение

Этот composable управляет плавающими окнами заметок, которые 
привязаны к карточкам.

### Ключевые возможности:
- Открытие/закрытие окна заметки
- Синхронизация позиции окна с карточкой
- Регистрация ref-ов окон для управления
- Сохранение в историю для Undo

## API

### Входные параметры

```javascript
useNoteWindows({
  cardsStore,           // Pinia store карточек
  notesStore,           // Store заметок
  historyStore,         // Store истории для Undo
  zoomScale,            // ref - текущий масштаб
  zoomTranslateX,       // ref - смещение X
  zoomTranslateY,       // ref - смещение Y
  canvasContainerRef,   // ref на DOM контейнер
  findCardById,         // (cardId) => Card
  getCardElementRect,   // (cardId) => DOMRect
})
```

### Возвращаемые значения

```javascript
{
  // Регистрация окон
  noteWindowRefs,           // Map<cardId, ComponentInstance>
  handleNoteWindowRegister, // (cardId, instance) => void
  
  // Операции с заметками
  ensureCardNote,           // (card) => void - создать заметку если нет
  openNoteForCard,          // (card, options) => void
  closeNoteForCard,         // (card, options) => void
  handleNoteWindowClose,    // (cardId) => void
  
  // Синхронизация
  syncNoteWindowWithCard,   // (cardId, options) => void
  syncAllNoteWindows,       // () => void
}
```

## Структура заметки

```javascript
note = {
  cardId: string,       // ID карточки-владельца
  content: string,      // Текст заметки
  visible: boolean,     // Открыта ли заметка
  position: {           // Позиция окна (опционально)
    x: number,
    y: number,
  },
}
```

## Регистрация окон

Каждое окно заметки регистрирует себя при монтировании:

```javascript
// В NoteWindow.vue
onMounted(() => {
  emit('register', props.cardId, getCurrentInstance())
})

// В composable
handleNoteWindowRegister(cardId, instance) {
  noteWindowRefs.set(cardId, instance)
}

// При размонтировании
onBeforeUnmount(() => {
  noteWindowRefs.delete(props.cardId)
})
```

Это позволяет:
- Вызывать методы окна напрямую
- Синхронизировать позиции
- Управлять фокусом

## Открытие заметки

```javascript
openNoteForCard(card, options = {}) {
  const { saveToHistory = true } = options
  
  // Создать заметку если нет
  ensureCardNote(card)
  
  // Сохранить состояние для Undo
  if (saveToHistory) {
    historyStore.saveState()
  }
  
  // Показать окно
  card.note.visible = true
  
  // Синхронизировать позицию
  nextTick(() => {
    syncNoteWindowWithCard(card.id)
  })
}
```

## Закрытие заметки

```javascript
closeNoteForCard(card, options = {}) {
  const { saveToHistory = true } = options
  
  if (!card.note) return
  
  if (saveToHistory) {
    historyStore.saveState()
  }
  
  card.note.visible = false
}
```

## Синхронизация позиции

Окно заметки должно "следовать" за карточкой при:
- Перемещении карточки
- Изменении зума
- Прокрутке холста

```javascript
syncNoteWindowWithCard(cardId, options = {}) {
  const card = findCardById(cardId)
  if (!card || !card.note?.visible) return
  
  const windowInstance = noteWindowRefs.get(cardId)
  if (!windowInstance) return
  
  // Получить позицию карточки на экране
  const cardRect = getCardElementRect(cardId)
  if (!cardRect) return
  
  // Вычислить позицию окна
  // Окно располагается справа от карточки с отступом
  const OFFSET_X = 20
  const OFFSET_Y = 0
  
  const windowX = cardRect.right + OFFSET_X
  const windowY = cardRect.top + OFFSET_Y
  
  // Установить позицию
  windowInstance.setPosition(windowX, windowY)
}

// Синхронизация всех открытых окон
syncAllNoteWindows() {
  cardsStore.cards.forEach(card => {
    if (card.note?.visible) {
      syncNoteWindowWithCard(card.id)
    }
  })
}
```

## Автоматическое создание заметки

```javascript
ensureCardNote(card) {
  if (!card.note) {
    card.note = {
      cardId: card.id,
      content: '',
      visible: false,
      position: null,
    }
  }
}
```

## Использование в CanvasBoard.vue

```javascript
import { useNoteWindows } from '@/composables/useNoteWindows'

const {
  noteWindowRefs,
  handleNoteWindowRegister,
  openNoteForCard,
  closeNoteForCard,
  handleNoteWindowClose,
  syncNoteWindowWithCard,
  syncAllNoteWindows,
} = useNoteWindows({
  cardsStore,
  notesStore,
  historyStore,
  zoomScale,
  zoomTranslateX,
  zoomTranslateY,
  canvasContainerRef,
  findCardById: (id) => cardsStore.cards.find(c => c.id === id),
  getCardElementRect,
})

// Обработка клика на кнопку заметки карточки
const handleAddNoteClick = (cardId) => {
  const card = findCardById(cardId)
  if (card.note?.visible) {
    closeNoteForCard(card)
  } else {
    openNoteForCard(card)
  }
}

// Синхронизация при изменении viewport
watch([zoomScale, zoomTranslateX, zoomTranslateY], () => {
  syncAllNoteWindows()
})

// Синхронизация при перемещении карточки
const afterCardDrag = (cardId) => {
  syncNoteWindowWithCard(cardId)
}
```

## В template

```html
<!-- Окна заметок -->
<NoteWindow
  v-for="card in cardsWithVisibleNotes"
  :key="`note-${card.id}`"
  :card-id="card.id"
  :content="card.note.content"
  @register="handleNoteWindowRegister"
  @close="handleNoteWindowClose"
  @update:content="(content) => updateNoteContent(card.id, content)"
/>
```

## Computed для карточек с заметками

```javascript
const cardsWithVisibleNotes = computed(() => {
  return cardsStore.cards.filter(card => card.note?.visible)
})
```

## Функция увеличения (Zoom/Magnify)

NoteWindow имеет встроенную функцию увеличения для удобного чтения на десктопе.

### Поведение
- Кнопка с иконкой лупы (🔎/🔍) расположена в header между кнопкой закрытия (×) и цветными точками
- При нажатии окно пропорционально увеличивается, заполняя экран от верхнего меню (70px сверху) до шкалы масштаба (60px снизу)
- Повторное нажатие возвращает окно к исходному размеру и позиции
- В увеличенном режиме перетаскивание и ресайз отключены
- При закрытии окна увеличенный режим автоматически сбрасывается

### Реализация
- `isZoomed` (ref) — состояние увеличения
- `toggleZoom()` — переключение режима
- `noteStyle` (computed) — в увеличенном режиме вычисляет размеры пропорционально соотношению сторон окна
- CSS `transition` обеспечивает плавную анимацию перехода (0.3s ease)

## Связанные файлы

- `src/stores/cards.js` — данные карточек и заметок
- `src/stores/notes.js` — отдельный store заметок (если используется)
- `src/components/Canvas/NoteWindow.vue` — UI компонент окна

## Отладка

### Окно не открывается
1. Проверь `card.note` — создано ли
2. Проверь `card.note.visible` — устанавливается ли в true
3. Проверь условие рендеринга в template

### Окно не следует за карточкой
1. Проверь `noteWindowRefs.get(cardId)` — зарегистрировано ли окно
2. Проверь `getCardElementRect` — возвращает ли rect
3. Проверь вызов `syncNoteWindowWithCard` после drag

### Окно в неправильной позиции
1. Проверь `zoomScale`, `zoomTranslateX`, `zoomTranslateY`
2. Проверь вычисление позиции (OFFSET_X, OFFSET_Y)
3. Проверь что карточка видима на экране
