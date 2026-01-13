# useUserTariffs.js

> Управление тарифными планами

## Общая информация

| Параметр | Значение |
|----------|----------|
| **Файл** | `src/composables/useUserTariffs.js` |
| **Размер** | ~180 строк |
| **Создан** | Декабрь 2025 (рефакторинг UserProfile.vue) |
| **Зависимости** | subscriptionStore |

## Назначение

Composable для отображения и управления тарифными планами:
- Загрузка доступных тарифов
- Форматирование функций тарифа
- Раскрытие/скрытие деталей тарифа
- Переход на другой тариф

## API

### Входные параметры

```javascript
useUserTariffs({
  subscriptionStore  // Pinia store подписок
})
```

### Возвращаемые значения

```javascript
{
  // Состояние
  loadingPlans,              // Ref<boolean> - загрузка тарифов
  availablePlans,            // Ref<Array> - доступные тарифы
  expandedPlanIds,           // Ref<Array> - ID раскрытых карточек
  showCurrentTariffFeatures, // Ref<boolean> - показать функции текущего тарифа

  // Данные
  featureLabels,       // Object - маппинг ключей функций на метки
  primaryFeatures,     // Array - основные функции (первые 4)
  secondaryFeatures,   // Array - дополнительные функции

  // Методы
  formatFeature,        // (key, value) => string - форматировать функцию
  getPrimaryFeatures,   // (features) => Array - основные функции
  getSecondaryFeatures, // (features) => Array - дополнительные функции
  togglePlanExpanded,   // (planId) => void - раскрыть/скрыть карточку
  isPlanExpanded,       // (planId) => boolean - проверка раскрытия
  loadAvailablePlans,   // () => Promise<void> - загрузить тарифы
  handleUpgrade         // (plan) => void - переход на тариф
}
```

## Форматирование функций

```javascript
const featureLabels = {
  // Лимиты (принимают значение)
  'max_boards': (value) => value === -1 ? '∞ Безлимитные доски' : `📊 До ${value} досок`,
  'max_notes': (value) => value === -1 ? '∞ Безлимитные заметки' : `📝 До ${value} заметок`,
  'max_stickers': (value) => value === -1 ? '∞ Безлимитные стикеры' : `🎨 До ${value} стикеров`,
  'max_licenses': (value) => value === -1 ? '∞ Безлимитные лицензии' : `🗂️ До ${value} лицензий`,
  'max_cards_per_board': (value) => value === -1 ? '∞ Безлимитные лицензии' : `🗂️ До ${value} лицензий на доске`,
  'max_comments': (value) => value === -1 ? '∞ Безлимитные комментарии' : `💬 До ${value} комментариев`,

  // Булевы функции (статические метки)
  'can_export_pdf': '📄 Экспорт в PDF',
  'can_export_png': '🖼️ Экспорт в PNG',
  'can_export_png_bw': '⬛ Экспорт PNG (Ч/Б)',
  'can_export_svg': '🌐 Экспорт в HTML',
  'can_invite_drawing': '✏️ Режим рисования',
  'can_duplicate_boards': '📋 Дублирование досок',

  // Специальные форматтеры
  'can_export_png_formats': (value) => {
    if (Array.isArray(value) && value.length > 0) {
      return `📏 Форматы PNG: ${value.join(', ')}`
    }
    return '📏 Экспорт в разных форматах'
  }
}
```

## Разделение функций

```javascript
// Основные функции (показываются сразу)
const primaryFeatures = ['max_boards', 'max_licenses', 'max_notes', 'max_stickers']

// Дополнительные функции (показываются при раскрытии)
const secondaryFeatures = [
  'max_comments',
  'can_export_pdf',
  'can_export_png',
  'can_export_png_formats',
  'can_export_png_bw',
  'can_export_svg',
  'can_invite_drawing',
  'can_duplicate_boards'
]
```

## Получение функций

```javascript
function getPrimaryFeatures(features) {
  if (!features) return []

  return Object.entries(features)
    .filter(([key]) => primaryFeatures.includes(key))
    .map(([key, value]) => ({
      key,
      label: formatFeature(key, value),
      available: typeof value === 'boolean' ? value : true
    }))
    .filter(f => f.label !== null)
    .sort((a, b) => primaryFeatures.indexOf(a.key) - primaryFeatures.indexOf(b.key))
}

function getSecondaryFeatures(features) {
  if (!features) return []

  return Object.entries(features)
    .filter(([key]) => secondaryFeatures.includes(key))
    .map(([key, value]) => ({
      key,
      label: formatFeature(key, value),
      available: typeof value === 'boolean' ? value : true
    }))
    .filter(f => f.label !== null)
    .sort((a, b) => secondaryFeatures.indexOf(a.key) - secondaryFeatures.indexOf(b.key))
}
```

## Раскрытие карточек

```javascript
function togglePlanExpanded(planId) {
  const index = expandedPlanIds.value.indexOf(planId)
  if (index === -1) {
    expandedPlanIds.value.push(planId)
  } else {
    expandedPlanIds.value.splice(index, 1)
  }
}

function isPlanExpanded(planId) {
  return expandedPlanIds.value.includes(planId)
}
```

## Загрузка тарифов

```javascript
async function loadAvailablePlans() {
  loadingPlans.value = true
  try {
    await subscriptionStore.fetchPlans()

    // Фильтруем - исключаем текущий тариф
    availablePlans.value = subscriptionStore.plans.filter(
      plan => plan.code_name !== subscriptionStore.currentPlan?.code_name
    )
  } catch (err) {
    console.error('Ошибка загрузки тарифов:', err)
    availablePlans.value = []
  } finally {
    loadingPlans.value = false
  }
}
```

## Использование в UserProfile.vue

```javascript
import { useUserTariffs } from '@/composables/useUserTariffs'

const {
  loadingPlans,
  availablePlans,
  getPrimaryFeatures,
  getSecondaryFeatures,
  togglePlanExpanded,
  isPlanExpanded,
  loadAvailablePlans,
  handleUpgrade
} = useUserTariffs({ subscriptionStore })

// Загрузка при переключении на вкладку
watch(activeTab, (newTab) => {
  if (newTab === 'tariffs' && availablePlans.value.length === 0) {
    loadAvailablePlans()
  }
})

// В template
<div v-for="plan in availablePlans" :key="plan.id" class="plan-card">
  <h3>{{ plan.name }}</h3>
  <p>{{ plan.price }} ₽/мес</p>

  <!-- Основные функции -->
  <ul class="primary-features">
    <li v-for="feature in getPrimaryFeatures(plan.features)" :key="feature.key">
      {{ feature.label }}
    </li>
  </ul>

  <!-- Кнопка раскрытия -->
  <button @click="togglePlanExpanded(plan.id)">
    {{ isPlanExpanded(plan.id) ? 'Скрыть' : 'Подробнее' }}
  </button>

  <!-- Дополнительные функции -->
  <ul v-if="isPlanExpanded(plan.id)" class="secondary-features">
    <li v-for="feature in getSecondaryFeatures(plan.features)" :key="feature.key">
      {{ feature.label }}
    </li>
  </ul>

  <button @click="handleUpgrade(plan)">Выбрать тариф</button>
</div>
```

## Интеграция с Tribute Payment

Функция `handleUpgrade` открывает страницу оплаты Tribute для выбранного тарифа.

### Маппинг тарифов на Tribute product_id

```javascript
const TRIBUTE_PRODUCTS = {
  'premium': 'Le1',      // Premium - 399₽/мес
  'individual': 'Lc8'    // Individual - 249₽/мес
}
```

> **ВАЖНО:** Для веб-ссылок (web.tribute.tg) НЕ нужен префикс 's'.
> В backend (`tributeService.js`) используется формат с префиксом 's' (`sLe1`, `sLc8`)
> для обработки webhook'ов от Tribute — это разные форматы!

### Формат URL

```
https://web.tribute.tg/s/{product_id}
```

Примеры:
- Premium: `https://web.tribute.tg/s/Le1`
- Individual: `https://web.tribute.tg/s/Lc8`

### Поведение

1. При клике на кнопку "Выбрать тариф" вызывается `handleUpgrade(plan)`
2. Функция ищет `plan.code_name` в маппинге `TRIBUTE_PRODUCTS`
3. Если найден — открывает ссылку Tribute в новой вкладке
4. Если не найден — показывает alert с сообщением об ошибке

### Обработка webhook

После оплаты Tribute отправляет webhook на `/api/webhook/tribute`, который:
- Обновляет `users.plan_id` и `subscription_expires_at`
- Создаёт запись в `subscription_history`
- Активирует подписку автоматически

См. также: `api/services/tributeService.js`

## Связанные файлы

- `src/components/UserProfile.vue` — основной компонент профиля
- `src/views/PricingPage.vue` — публичная страница тарифов
- `src/stores/subscription.js` — store подписок
- `api/services/tributeService.js` — backend обработка Tribute webhook
- API endpoint: `GET /plans`
