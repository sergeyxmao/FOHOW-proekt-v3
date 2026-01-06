# Subscription Store

> Документация Pinia store для управления тарифными планами и лимитами ресурсов

## Описание

Store `subscription.js` управляет состоянием тарифного плана пользователя, проверкой лимитов ресурсов и отслеживанием их использования.

## Расположение

`src/stores/subscription.js`

## State

```javascript
{
  currentPlan: null,      // Текущий тарифный план пользователя
  plans: [],              // Список всех доступных тарифных планов
  features: {},           // Возможности текущего плана
  usage: {},              // Использование ресурсов (от API)
  limits: {},             // Лимиты ресурсов
  loading: false,         // Флаг загрузки
  error: null             // Ошибки
}
```

## Getters

### `isDemo`
Проверяет, находится ли пользователь на демо-плане.
- **Тип:** `boolean`
- **Возвращает:** `true`, если `currentPlan.code_name === 'demo'`

### `isPro`
Проверяет, находится ли пользователь на Pro, Premium или Enterprise плане.
- **Тип:** `boolean`
- **Возвращает:** `true`, если план входит в список `['pro', 'enterprise', 'premium']`

### `daysLeft`
Возвращает количество дней до истечения подписки.
- **Тип:** `number | null`
- **Возвращает:** Количество дней или `null` для бессрочной подписки

### `isExpiring`
Проверяет, истекает ли подписка в ближайшие 7 дней.
- **Тип:** `boolean`
- **Возвращает:** `true`, если осталось меньше 7 дней

## Actions

### `loadPlan()`
Загрузка текущего тарифного плана пользователя из API.

**Возвращает:** `Promise<Object>` - данные о плане

**API endpoint:** `GET /api/user/plan`

**Использование:**
```javascript
await subscriptionStore.loadPlan()
```

**Поведение:**
- Загружает данные о тарифе и использовании ресурсов
- Проверяет истечение подписки с учётом grace-периода
- Если подписка истекла → устанавливает Guest-тариф
- Обновляет `currentPlan`, `features`, `usage`, `limits`

---

### `checkLimit(resourceType)`
Проверка лимита ресурса.

**Параметры:**
- `resourceType` (string) - Тип ресурса: `'boards'`, `'notes'`, `'stickers'`, `'comments'`, `'cards'`

**Возвращает:** `Object`
```javascript
{
  current: number,      // Текущее использование
  max: number,          // Максимальный лимит (-1 = безлимит)
  canCreate: boolean,   // Можно ли создавать новые
  percentage: number    // Процент использования (0-100)
}
```

**Использование:**
```javascript
const limit = subscriptionStore.checkLimit('cards')
console.log(`${limit.current} / ${limit.max}`) // "8 / 36"
```

#### Специальная логика для карточек

Для ресурса `'cards'` используется **динамический подсчёт по текущей открытой доске** вместо данных от API:

**Логика:**
1. Если доска не открыта (`!boardStore.isCurrentBoard`) → возвращает `current: 0`
2. Если доска открыта → считает карточки из `cardsStore.cards` текущей доски
3. Учитываются только типы: `'small'`, `'large'`, `'gold'`, `'avatar'`

**Пример поведения:**
- Пользователь открыл доску с 8 карточками → `checkLimit('cards')` вернёт `current: 8`
- Пользователь закрыл доску (перешёл на главную) → `checkLimit('cards')` вернёт `current: 0`
- Пользователь открыл другую доску с 19 карточками → `checkLimit('cards')` вернёт `current: 19`

**Зависимости:**
- `boardStore.isCurrentBoard` - проверка открыта ли доска
- `cardsStore.cards` - массив карточек текущей доски

**Важно:** Эта логика применяется только для `'cards'`. Остальные ресурсы используют данные от API из поля `usage`.

---

### `checkFeature(featureName)`
Проверка доступности функции в текущем тарифе.

**Параметры:**
- `featureName` (string) - Название функции (например, `'can_export_pdf'`)

**Возвращает:** `boolean`

**Использование:**
```javascript
if (subscriptionStore.checkFeature('can_export_pdf')) {
  // Экспорт доступен
}
```

**Особенности:**
- Администраторы (`role === 'admin'`) имеют доступ ко всем функциям
- Для `'can_use_images'`: если флаг не задан, разрешает доступ всем кроме Guest
- Поддерживает boolean, number и string значения

---

### `refreshUsage()`
Обновление статистики использования ресурсов.

**Возвращает:** `Promise<void>`

**Использование:**
```javascript
await subscriptionStore.refreshUsage()
```

**Поведение:** Перезагружает план через `loadPlan()`, что автоматически обновляет `usage`.

---

### `fetchPlans()`
Загрузка списка всех публичных тарифных планов.

**Возвращает:** `Promise<Array>` - массив тарифных планов

**API endpoint:** `GET /api/plans`

**Использование:**
```javascript
const plans = await subscriptionStore.fetchPlans()
```

---

### `getUpgradeMessage(featureName)`
Получить текст сообщения для апгрейда тарифа.

**Параметры:**
- `featureName` (string) - Название функции

**Возвращает:** `string` - текст сообщения

**Использование:**
```javascript
const message = subscriptionStore.getUpgradeMessage('can_export_pdf')
// "Перейдите на платный план для доступа к этой функции"
```

---

### `clear()`
Очистить данные хранилища.

**Использование:**
```javascript
subscriptionStore.clear()
```

## Связанные файлы

- `src/composables/useUserLimits.js` - composable для работы с лимитами
- `src/views/ProfileView.vue` - отображение информации о тарифе в профиле
- `api/routes/plans.js` - backend endpoint для получения данных о плане

## История изменений

- **2026-01-06**: Изменена логика подсчёта карточек - теперь считается по текущей открытой доске, а не максимум по всем доскам
- **2026-01-06**: Исправлен маппинг `cards → userLicenses` на `cards → cards`
- **2024-12**: Создан store для управления тарифными планами
