# useUserTariffs.js

> Управление тарифными планами

## Общая информация

| Параметр | Значение |
|----------|----------|
| **Файл** | `src/composables/useUserTariffs.js` |
| **Размер** | ~180 строк |
| **Создан** | Декабрь 2025 (рефакторинг UserProfile.vue) |
| **Зависимости** | subscriptionStore, authStore, notificationsStore |

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
  handleUpgrade         // (plan) => Promise<void> - переход на тариф через Продамус
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
  'max_comments': (value) => value === -1 ? '∞ Безлимитные комментарии' : `💬 До ${value} комментариев`,

  // Специальные форматтеры
  'can_export_png_formats': (value) => {
    if (Array.isArray(value) && value.length > 0) {
      return `🖼️ Скачать доску (структуру) как изображение: ${value.join(', ')}`
    }
    return '🖼️ Скачать доску (структуру) как изображение'
  },

  // Булевы функции (статические метки)
  'can_export_html': '🌐 Поделиться доской (структурой) как веб‑страницей',
  'can_invite_drawing': '✏️ Режим рисования',
  'can_duplicate_boards': '📋 Дублирование досок',
  'can_use_images': '🖼️ Изображения'
}
```

## Разделение функций

```javascript
// Основные функции (показываются сразу)
const primaryFeatures = ['max_boards', 'max_licenses', 'max_notes', 'max_stickers']

// Дополнительные функции (показываются при раскрытии)
const secondaryFeatures = [
  'max_comments',
  'can_export_png_formats',
  'can_export_html',
  'can_invite_drawing',
  'can_use_images',
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

## Поведение `handleUpgrade`

Функция `handleUpgrade` вызывается при клике на кнопку "Выбрать тариф".

Логика:
1. Отправляет POST-запрос на `/api/payments/create-link` с `{ planId: plan.id }`
2. Получает `paymentUrl` — подписанную ссылку на платёжную страницу Продамуса
3. Перенаправляет пользователя на страницу оплаты (`window.location.href`)
4. При ошибке показывает уведомление через `notificationsStore`

Используемые зависимости:
- `authStore.token` — JWT-токен для Authorization header
- `notificationsStore.addNotification()` — показ ошибок
- `VITE_API_URL` — базовый URL API (fallback: `https://interactive.marketingfohow.ru/api`)

## Связанные файлы

- `src/components/UserProfile.vue` — основной компонент профиля
- `src/views/PricingPage.vue` — публичная страница тарифов (использует getPrimaryFeatures, getSecondaryFeatures, togglePlanExpanded, isPlanExpanded)
- `src/views/PaymentSuccessPage.vue` — страница успешной оплаты
- `src/views/PaymentFailPage.vue` — страница неудачной оплаты
- `src/stores/subscription.js` — store подписок
- `src/stores/auth.js` — store авторизации
- `src/stores/notifications.js` — store уведомлений
- `api/routes/prodamus.js` — бэкенд: создание ссылки на оплату
- `api/services/prodamusService.js` — бэкенд: сервис Продамуса
- API endpoint: `GET /plans`, `POST /api/payments/create-link`
