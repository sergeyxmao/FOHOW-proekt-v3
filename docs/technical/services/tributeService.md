# tributeService.js

**Расположение**: `api/services/tributeService.js`

## Описание

Сервис для интеграции с платёжной системой Tribute (подписки через Telegram). 

Основные функции:
- Маппинг `product_id` от Tribute на `plan_id` в БД
- Проверка подписи webhook
- Обработка новых подписок
- Обработка продления подписок
- Обработка отмены/истечения подписок

## Константы

### TRIBUTE_PRODUCT_MAPPING

Маппинг Tribute `product_id` на `plan_id` в БД:

```javascript
const TRIBUTE_PRODUCT_MAPPING = {
  'sLc8': 6,  // Individual - 299₽/мес
  'sLe1': 7   // Premium - 499₽/мес
};
```

## Функции

### mapTributeProductToPlan(tributeProductId)

**Описание**: Определяет `plan_id` по `product_id` от Tribute.

**Параметры**:
- `tributeProductId` (string): Product ID от Tribute (sLc8, sLe1)

**Возвращает**: (number|null) - `plan_id` или null, если product_id неизвестен

**Пример**:
```javascript
mapTributeProductToPlan('sLc8') // → 6 (Individual)
mapTributeProductToPlan('sLe1') // → 7 (Premium)
mapTributeProductToPlan('unknown') // → null
```

---

### verifyTributeWebhook(payload, signature)

**Описание**: Проверяет подпись webhook от Tribute.

**Параметры**:
- `payload` (Object): Тело запроса webhook
- `signature` (string): Подпись из заголовка `X-Tribute-Signature`

**Возвращает**: (boolean) - true, если подпись верна, или если `TRIBUTE_WEBHOOK_SECRET` не установлен

**Алгоритм**:
1. Если `TRIBUTE_WEBHOOK_SECRET` не установлен → вернуть `true` (пропустить проверку)
2. Вычислить HMAC-SHA256 от `JSON.stringify(payload)` с использованием `TRIBUTE_WEBHOOK_SECRET`
3. Сравнить вычисленную подпись с `signature`

**Пример**:
```javascript
const isValid = verifyTributeWebhook(
  { event: 'subscription.created', data: {...} },
  'sha256_hash_from_header'
);
```

---

### handleNewSubscription(data)

**Описание**: Обрабатывает новую подписку от Tribute.

**Параметры**:
- `data` (Object): Данные от Tribute
  - `subscription_id` (string): ID подписки от Tribute
  - `telegram_user_id` (string): Telegram user ID
  - `product_id` (string): Product ID от Tribute (sLc8, sLe1)
  - `amount` (number): Сумма платежа
  - `currency` (string): Валюта (RUB, USD)
  - `period` (string): Период (month, year)

**Возвращает**: (Object)
- `{ success: true, userId, planId }` — при успехе
- `{ success: true, pending: true }` — если пользователь не найден (сохранено в pending)
- `{ success: false, error }` — при ошибке

**Алгоритм**:
1. Определить `plan_id` через `mapTributeProductToPlan(product_id)`
2. Найти пользователя по `telegram_chat_id = telegram_user_id`
3. Если пользователь не найден:
   - Сохранить в `pending_tribute_webhooks`
   - Вернуть `{ success: true, pending: true }`
4. Обновить `users`:
   ```sql
   UPDATE users
   SET plan_id = {plan_id},
       subscription_started_at = NOW(),
       subscription_expires_at = NOW() + INTERVAL '{period}',
       payment_method = 'tribute',
       auto_renew = TRUE
   WHERE id = {user_id}
   ```
5. Создать/обновить `tribute_subscriptions` (UPSERT по `tribute_subscription_id`)
6. Записать в `subscription_history`
7. Обновить блокировки досок: `boardLockService.recalcUserBoardLocks(user_id)`
8. Отправить email и Telegram уведомления

**Важно**: Все операции выполняются в транзакции (BEGIN → COMMIT / ROLLBACK).

---

### handleSubscriptionRenewed(data)

**Описание**: Обрабатывает продление подписки от Tribute.

**Параметры**:
- `data` (Object): Данные от Tribute
  - `subscription_id` (string): ID подписки от Tribute
  - `amount` (number): Сумма платежа
  - `currency` (string): Валюта
  - `period` (string): Период (month, year)

**Возвращает**: (Object)
- `{ success: true, userId }` — при успехе
- `{ success: false, error }` — при ошибке

**Алгоритм**:
1. Найти подписку по `subscription_id` в `tribute_subscriptions`
2. Продлить `subscription_expires_at` в `users` на 1 month/year
3. Обновить `tribute_subscriptions`:
   - `expires_at = NOW() + INTERVAL '{period}'`
   - `last_payment_at = NOW()`
   - `status = 'active'`
   - `amount_paid = {amount}`
4. Записать в `subscription_history` с `source = 'tribute_renewal'`
5. Обновить блокировки досок
6. Отправить email и Telegram уведомления

---

### handleSubscriptionCancelled(data)

**Описание**: Обрабатывает отмену/истечение подписки.

**Параметры**:
- `data` (Object): Данные от Tribute
  - `subscription_id` (string): ID подписки от Tribute

**Возвращает**: (Object)
- `{ success: true, userId, guestPlanId }` — при успехе
- `{ success: false, error }` — при ошибке

**Алгоритм**:
1. Найти подписку по `subscription_id` в `tribute_subscriptions`
2. Получить ID гостевого тарифа (`code_name = 'guest'`)
3. Перевести пользователя на гостевой тариф:
   ```sql
   UPDATE users
   SET plan_id = {guest_plan_id},
       auto_renew = FALSE
   WHERE id = {user_id}
   ```
4. Обновить `tribute_subscriptions`:
   - `status = 'cancelled'`
5. Обновить блокировки досок
6. Отправить email и Telegram уведомления

---

## Зависимости

- **api/db.js** — Пул соединений PostgreSQL
- **api/utils/email.js** — `sendSubscriptionEmail()`
- **api/utils/telegramService.js** — `sendTelegramMessage()`
- **api/services/boardLockService.js** — `recalcUserBoardLocks()`
- **api/templates/telegramTemplates.js** — Шаблоны Telegram-сообщений

## Переменные окружения

```env
TRIBUTE_WEBHOOK_SECRET=your_webhook_secret_from_tribute
FRONTEND_URL=https://interactive.marketingfohow.ru
```

## Логирование

Все операции логируются с префиксом `[Tribute]`:

```javascript
console.log(`[Tribute] 🆕 Новая подписка: subscription_id=${subscription_id}, telegram_user_id=${telegram_user_id}`)
console.log(`[Tribute] 🔄 Продление подписки: subscription_id=${subscription_id}`)
console.log(`[Tribute] ❌ Отмена подписки: subscription_id=${subscription_id}`)
console.log(`[Tribute] Блокировки обновлены для user_id=${user_id}: unlocked=${unlocked}, softLocked=${softLocked}`)
```

## Примечания

1. **Отложенные webhook'и** (`pending_tribute_webhooks`):
   - Если пользователь ещё не зарегистрирован в системе (нет `telegram_chat_id` в `users`), webhook сохраняется.
   - После регистрации пользователя система должна обработать отложенные платежи.

2. **Email/Telegram уведомления**:
   - Отправка уведомлений не блокирует основной процесс.
   - Ошибки отправки логируются, но не приводят к ROLLBACK транзакции.

3. **BoardLockService**:
   - После любого изменения тарифа вызывается `recalcUserBoardLocks()` для пересчета блокировок досок.
   - Это критично для корректной работы системы ограничений.

4. **Цены в уведомлениях**:
   - Для годовой подписки используется `price_yearly`, для месячной — `price_monthly`.
   - Не полагаться на `amount` из Tribute payload, так как он может быть некорректным.

---

## История изменений

- **2026-01-19**: Создана документация tributeService.js
