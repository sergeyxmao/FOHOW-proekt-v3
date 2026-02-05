# Панель "Сообщения стикеров"

## Описание функции

Панель "Сообщения стикеров" (StickerMessages) — это боковая панель, отображающая список всех стикеров текущей доски. Панель позволяет:

- Просматривать все стикеры доски в списке
- Редактировать содержимое стикеров
- Удалять стикеры
- Искать по тексту стикеров
- Фокусироваться на стикере на доске (центрировать вид)

## Расположение файлов

| Файл | Назначение |
|------|------------|
| `src/components/Panels/StickerMessages.vue` | Основной компонент панели |
| `src/stores/stickers.js` | Pinia store для управления стикерами |

## Как работает

### Отображение стикеров

```javascript
// Все стикеры доски (включая пустые)
const messagesStickers = computed(() => {
  return [...stickersStore.stickers]
})

// Фильтрация по поисковому запросу
const filteredMessages = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) {
    return messagesStickers.value
  }
  return messagesStickers.value.filter(sticker =>
    sticker.content?.toLowerCase().includes(query)
  )
})
```

### Обработка пустых стикеров

Пустые стикеры (без текста) отображаются с placeholder-текстом "Пустой стикер" и особым стилем (серый курсивный текст):

```javascript
const getPreview = (content) => {
  if (!content || !content.trim()) return 'Пустой стикер'
  const text = content.trim()
  if (text.length <= 100) return text
  return text.substring(0, 100) + '...'
}
```

### Фокусировка на стикере

При клике на стикер в панели происходит центрирование вида на этом стикере на доске:

```javascript
const handleStickerClick = (sticker, event) => {
  if (event.target.closest('.sticker-message-item__actions')) {
    return // Игнорируем клик по кнопкам действий
  }
  stickersStore.requestFocusOnSticker(sticker.id)
}
```

### Редактирование стикера

1. Пользователь нажимает кнопку редактирования
2. Текст стикера загружается в textarea
3. Можно сохранить или отменить изменения
4. Пустой текст разрешен (стикер можно "очистить")

```javascript
const handleSaveEdit = async (stickerId) => {
  try {
    await stickersStore.updateSticker(stickerId, {
      content: editingContent.value
    })
    editingStickerId.value = null
    editingContent.value = ''
  } catch (error) {
    console.error('Ошибка обновления стикера:', error)
    alert('Не удалось обновить стикер')
  }
}
```

## Зависимости

| Модуль | Использование |
|--------|---------------|
| `useStickersStore` | Получение списка стикеров, обновление, удаление, фокусировка |
| Vue Composition API | `computed`, `ref`, `onMounted` |

## Props компонента

| Prop | Тип | По умолчанию | Описание |
|------|-----|--------------|----------|
| `isModernTheme` | Boolean | `false` | Включает темную тему оформления |

## Структура элемента списка

Каждый стикер в списке отображает:

- **Автор** (`author_username`) — имя пользователя, создавшего стикер
- **Превью контента** — первые 100 символов текста или "Пустой стикер"
- **Дата создания** (`created_at`) — форматированная дата
- **Цвет** — левая граница и фон в цвете стикера
- **Кнопки действий** — редактирование и удаление

## Стили

### Обычная тема
- Светлый фон
- Темный текст
- Цветная граница слева (цвет стикера)

### Modern Theme (темная тема)
- Темный фон с полупрозрачностью
- Светлый текст
- Адаптированные цвета элементов управления

### Стиль пустых стикеров
```css
.sticker-message-item__content--empty {
  color: #9ca3af;
  font-style: italic;
}

.sticker-messages--modern .sticker-message-item__content--empty {
  color: #64748b;
}
```

## История изменений

### 2026-02-05
- **Добавлено**: Отображение пустых стикеров в панели
  - Убрана фильтрация стикеров по наличию content
  - Пустые стикеры показывают placeholder "Пустой стикер"
  - Разрешено сохранение стикера с пустым текстом
  - Добавлен специальный стиль для пустых стикеров (серый курсив)
