# useUserLimits.js

> Управление лимитами ресурсов пользователя

## Общая информация

| Параметр | Значение |
|----------|----------|
| **Файл** | `src/composables/useUserLimits.js` |
| **Размер** | ~96 строк |
| **Создан** | Декабрь 2025 (рефакторинг UserProfile.vue) |
| **Зависимости** | subscriptionStore, imageService |

## Назначение

Composable для отображения лимитов ресурсов:
- Лимиты подписки (доски, заметки, стикеры)
- Статистика библиотеки изображений
- Цветовая индикация прогресса

## API

### Входные параметры

```javascript
useUserLimits({
  subscriptionStore  // Pinia store подписок
})
```

### Возвращаемые значения

```javascript
{
  // Состояние
  imageLibraryStats,   // Ref<Object> - статистика библиотеки изображений
  imageStatsError,     // Ref<string> - ошибка загрузки статистики

  // Методы
  getLimitInfo,           // (resourceType) => Object - информация о лимите
  getImageLimitInfo,      // (resourceKey) => Object - лимит изображений
  getLimitColor,          // (percentage) => string - цвет прогресс-бара
  loadImageLibraryStats   // () => Promise<void> - загрузить статистику
}
```

## Получение информации о лимите

```javascript
function getLimitInfo(resourceType) {
  const limitData = subscriptionStore.checkLimit(resourceType)

  const maxDisplay = limitData.max === -1 ? '∞' : limitData.max

  const percentage = limitData.max === -1
    ? 0
    : Math.min(100, Math.round((limitData.current / limitData.max) * 100))

  return {
    current: limitData.current,
    max: limitData.max,
    maxDisplay,
    percentage
  }
}
```

## Лимиты изображений

```javascript
function getImageLimitInfo(resourceKey) {
  const usage = imageLibraryStats.value?.usage || {}
  const limits = imageLibraryStats.value?.limits || {}

  const currentRaw = Number(usage[resourceKey] ?? 0)
  const limitRaw = limits[resourceKey]
  const isUnlimited = limitRaw === -1

  // Форматирование для storageMB
  const currentDisplay = resourceKey === 'storageMB'
    ? `${currentRaw.toFixed(2)} МБ`
    : currentRaw

  const maxDisplay = isUnlimited
    ? '∞'
    : resourceKey === 'storageMB'
      ? `${Number(limitRaw ?? 0)} МБ`
      : Number(limitRaw ?? 0)

  const percentage = (!isUnlimited && Number(limitRaw) > 0)
    ? Math.min(100, Math.round((currentRaw / Number(limitRaw)) * 100))
    : 0

  return { currentDisplay, maxDisplay, percentage }
}
```

## Цветовая индикация

```javascript
function getLimitColor(percentage) {
  if (percentage < 70) return '#4caf50'  // Зелёный - всё ок
  if (percentage < 90) return '#ffc107'  // Оранжевый - приближается к лимиту
  return '#f44336'                        // Красный - почти исчерпан
}
```

Визуализация:

```
0%                    70%                90%               100%
├──────────────────────┼─────────────────┼──────────────────┤
│      Зелёный         │    Оранжевый    │     Красный      │
│      #4caf50         │    #ffc107      │     #f44336      │
└──────────────────────┴─────────────────┴──────────────────┘
```

## Загрузка статистики изображений

```javascript
import { getMyStats } from '@/services/imageService'

async function loadImageLibraryStats() {
  try {
    imageStatsError.value = ''
    imageLibraryStats.value = await getMyStats()
  } catch (error) {
    console.error('Ошибка загрузки лимитов библиотеки изображений:', error)
    imageStatsError.value = error.message || 'Не удалось загрузить лимиты'
  }
}
```

## Структура imageLibraryStats

```javascript
{
  usage: {
    imagesCount: 42,      // Количество изображений
    storageMB: 156.78     // Использовано МБ
  },
  limits: {
    imagesCount: 100,     // Лимит изображений (-1 = безлимит)
    storageMB: 500        // Лимит МБ (-1 = безлимит)
  }
}
```

## Использование в UserProfile.vue

```javascript
import { useUserLimits } from '@/composables/useUserLimits'

const {
  imageLibraryStats,
  imageStatsError,
  getLimitInfo,
  getImageLimitInfo,
  getLimitColor,
  loadImageLibraryStats
} = useUserLimits({ subscriptionStore })

// Загрузка при монтировании
onMounted(() => {
  loadImageLibraryStats()
})

// В template
<div class="limit-item">
  <span>Доски: {{ getLimitInfo('boards').current }} / {{ getLimitInfo('boards').maxDisplay }}</span>
  <div class="progress-bar">
    <div
      class="progress-fill"
      :style="{
        width: getLimitInfo('boards').percentage + '%',
        backgroundColor: getLimitColor(getLimitInfo('boards').percentage)
      }"
    />
  </div>
</div>

<div class="limit-item">
  <span>Изображения: {{ getImageLimitInfo('imagesCount').currentDisplay }} / {{ getImageLimitInfo('imagesCount').maxDisplay }}</span>
  <div class="progress-bar">
    <div
      class="progress-fill"
      :style="{
        width: getImageLimitInfo('imagesCount').percentage + '%',
        backgroundColor: getLimitColor(getImageLimitInfo('imagesCount').percentage)
      }"
    />
  </div>
</div>
```

## Связанные файлы

- `src/components/UserProfile.vue` — основной компонент профиля
- `src/stores/subscription.js` — store подписок
- `src/services/imageService.js` — сервис изображений
- API endpoint: `GET /images/stats`
