# Tribute Webhook API

**Файл**: `api/routes/tribute.js`  
**Сервис**: `api/services/tributeService.js`

## Описание

Модуль для интеграции с платёжной системой [Tribute](https://tribute.so) для обработки подписок через Telegram.

Tribute отправляет webhook-уведомления о событиях подписок:
- Новая подписка
- Продление подписки
- Отмена подписки
- Истечение подписки

## Маршруты

### 1. POST /api/webhook/tribute

**Описание**: Принимает webhook от Tribute при событиях подписки.

**Требования**: Нет (публичный endpoint)

**Headers**:
```http
Content-Type: application/json
X-Tribute-Signature: sha256_hash_of_payload
```

**Тело запроса** (примеры):

#### Новая подписка
```json
{
  "event": "subscription.created",
  "data": {
    "subscription_id": "sub_abc123",
    "telegram_user_id": "123456789",
    "product_id": "sLc8",
    "amount": 249,
    "currency": "RUB",
    "period": "month"
  }
}
```

#### Продление подписки
```json
{
  "event": "subscription.renewed",
  "data": {
    "subscription_id": "sub_abc123",
    "amount": 249,
    "currency": "RUB",
    "period": "month"
  }
}
```

#### Отмена подписки
```json
{
  "event": "subscription.cancelled",
  "data": {
    "subscription_id": "sub_abc123"
  }
}
```

**Ответ** (200 OK):
```json
{
  "success": true,
  "received": "subscription.created",
  "result": {
    "success": true,
    "userId": 123,
    "planId": 6
  }
}
```

**Ошибки**:
- `403 Forbidden` — Неверная подпись webhook
- `400 Bad Request` — Некорректный формат payload
- `200 OK` (с `success: false`) — Ошибка обработки (не блокирует повторные запросы)

---

### 2. GET /api/webhook/tribute/health

**Описание**: Health check для проверки доступности webhook endpoint.

**Требования**: Нет (публичный endpoint)

**Ответ** (200 OK):
```json
{
  "status": "ok",
  "service": "tribute-webhook",
  "timestamp": "2026-01-19T13:00:00.000Z"
}
```

---

## Обрабатываемые события

### subscription.created / subscription.started
**Логика** (`handleNewSubscription`):
1. Проверить `product_id` и определить `plan_id` (маппинг в `TRIBUTE_PRODUCT_MAPPING`)
2. Найти пользователя по `telegram_user_id` → `telegram_chat_id`
3. Если пользователь не найден — сохранить в `pending_tribute_webhooks`
4. Обновить `users`:
   - `plan_id` → соответствующий тариф
   - `subscription_started_at` → NOW()
   - `subscription_expires_at` → NOW() + INTERVAL (1 month или 1 year)
   - `payment_method` → 'tribute'
   - `auto_renew` → TRUE
5. Создать/обновить запись в `tribute_subscriptions`
6. Записать в `subscription_history`
7. Обновить блокировки досок (`boardLockService.recalcUserBoardLocks`)
8. Отправить email и Telegram уведомления

### subscription.renewed / subscription.payment_received
**Логика** (`handleSubscriptionRenewed`):
1. Найти подписку по `subscription_id` в `tribute_subscriptions`
2. Продлить `subscription_expires_at` в `users` на 1 месяц/год
3. Обновить `last_payment_at` и `amount_paid` в `tribute_subscriptions`
4. Записать в `subscription_history`
5. Обновить блокировки досок
6. Отправить email и Telegram уведомления

### subscription.cancelled / subscription.expired / subscription.failed
**Логика** (`handleSubscriptionCancelled`):
1. Найти подписку по `subscription_id` в `tribute_subscriptions`
2. Перевести пользователя на гостевой тариф:
   - `plan_id` → 5 (guest)
   - `auto_renew` → FALSE
3. Обновить статус в `tribute_subscriptions` → 'cancelled'
4. Обновить блокировки досок
5. Отправить email и Telegram уведомления

---

## Маппинг Tribute Product ID → Plan ID

**Определено в**: `api/services/tributeService.js → TRIBUTE_PRODUCT_MAPPING`

| Tribute Product ID | Plan ID | Название  | Цена (месяц/год) |
|--------------------|---------|-----------|------------------|
| `sLc8`             | 6       | Individual| 249₽ / 2490₽    |
| `sLe1`             | 7       | Premium   | 399₽ / 3990₽    |

---

## База данных

### Таблица `tribute_subscriptions`

| Поле                     | Тип       | Описание                              |
|--------------------------|-----------|---------------------------------------|
| id                       | SERIAL    | ID (PK)                               |
| user_id                  | INTEGER   | FK → users.id                         |
| telegram_user_id         | VARCHAR   | ID пользователя в Telegram            |
| tribute_subscription_id  | VARCHAR   | ID подписки от Tribute (UNIQUE)       |
| plan_id                  | INTEGER   | FK → subscription_plans.id            |
| status                   | VARCHAR   | active / cancelled / expired          |
| expires_at               | TIMESTAMP | Дата окончания подписки               |
| last_payment_at          | TIMESTAMP | Дата последнего платежа               |
| tribute_product_id       | VARCHAR   | Product ID от Tribute (sLc8, sLe1)    |
| amount_paid              | INTEGER   | Сумма платежа                         |
| currency                 | VARCHAR   | Валюта (RUB, USD)                     |
| created_at               | TIMESTAMP | Дата создания записи                  |
| updated_at               | TIMESTAMP | Дата последнего обновления            |

### Таблица `pending_tribute_webhooks`

| Поле                     | Тип       | Описание                              |
|--------------------------|-----------|---------------------------------------|
| id                       | SERIAL    | ID (PK)                               |
| telegram_user_id         | VARCHAR   | ID пользователя в Telegram            |
| tribute_subscription_id  | VARCHAR   | ID подписки от Tribute                |
| payload                  | JSONB     | Полный payload от webhook             |
| created_at               | TIMESTAMP | Дата создания записи                  |
| processed                | BOOLEAN   | Обработан ли webhook                  |

**Назначение**: Сохранять webhook'и для пользователей, которые ещё не зарегистрированы в системе. Когда пользователь зарегистрируется и привяжет `telegram_chat_id`, система обработает отложенные webhook'и.

### Таблица `subscription_history`

| Поле           | Тип       | Описание                              |
|----------------|-----------|---------------------------------------|
| id             | SERIAL    | ID (PK)                               |
| user_id        | INTEGER   | FK → users.id                         |
| plan_id        | INTEGER   | FK → subscription_plans.id            |
| start_date     | TIMESTAMP | Дата начала периода подписки          |
| end_date       | TIMESTAMP | Дата окончания периода подписки       |
| source         | VARCHAR   | Источник (tribute, yookassa, ...)     |
| amount_paid    | INTEGER   | Сумма платежа                         |
| currency       | VARCHAR   | Валюта                                |
| transaction_id | VARCHAR   | ID транзакции                         |
| created_at     | TIMESTAMP | Дата создания записи                  |

---

## Настройки окружения

Добавить в `.env` на сервере:

```env
# Tribute Payment System
TRIBUTE_WEBHOOK_SECRET=your_webhook_secret_from_tribute
```

**Примечание**: Если `TRIBUTE_WEBHOOK_SECRET` не указан, проверка подписи пропускается (не рекомендуется для продакшена).

---

## Проверка подписи

**Функция**: `verifyTributeWebhook(payload, signature)` в `tributeService.js`

```javascript
const computedSignature = crypto
  .createHmac('sha256', process.env.TRIBUTE_WEBHOOK_SECRET)
  .update(JSON.stringify(payload))
  .digest('hex');

return computedSignature === signature;
```

**Заголовок от Tribute**:
```http
X-Tribute-Signature: sha256_hash
```

---

## Уведомления

### Email

**Функция**: `sendSubscriptionEmail(email, eventType, data)` в `utils/email.js`

**Типы событий**:
- `new` — новая подписка
- `renewed` — продление подписки
- `cancelled` — отмена подписки

### Telegram

**Функция**: `sendTelegramMessage(chatId, text, options)` в `utils/telegramService.js`

**Шаблоны сообщений**: `api/templates/telegramTemplates.js`
- `getSubscriptionActivatedMessage()`
- `getSubscriptionRenewedMessage()`
- `getSubscriptionCancelledMessage()`

---

## Тестирование webhook

### 1. Health check
```bash
curl https://interactive.marketingfohow.ru/api/webhook/tribute/health
```

### 2. Тестовый webhook (новая подписка)
```bash
curl -X POST https://interactive.marketingfohow.ru/api/webhook/tribute \
  -H "Content-Type: application/json" \
  -H "X-Tribute-Signature: test_signature" \
  -d '{
    "event": "subscription.created",
    "data": {
      "subscription_id": "test_sub_123",
      "telegram_user_id": "123456789",
      "product_id": "sLc8",
      "amount": 249,
      "currency": "RUB",
      "period": "month"
    }
  }'
```

### 3. SQL-проверка

```sql
-- Проверить подписку пользователя
SELECT u.id, u.email, u.telegram_chat_id, u.plan_id, 
       sp.name as plan_name, u.subscription_expires_at
FROM users u
LEFT JOIN subscription_plans sp ON u.plan_id = sp.id
WHERE u.telegram_chat_id = '123456789';

-- Проверить запись в tribute_subscriptions
SELECT * FROM tribute_subscriptions 
WHERE telegram_user_id = '123456789'
ORDER BY created_at DESC;

-- Проверить историю подписок
SELECT * FROM subscription_history 
WHERE user_id = (SELECT id FROM users WHERE telegram_chat_id = '123456789')
ORDER BY created_at DESC;
```

---

## Связанные файлы

- **api/routes/tribute.js** — Маршруты webhook
- **api/services/tributeService.js** — Бизнес-логика обработки
- **api/services/boardLockService.js** — Обновление блокировок досок
- **api/utils/email.js** — Отправка email-уведомлений
- **api/utils/telegramService.js** — Отправка Telegram-уведомлений
- **api/templates/telegramTemplates.js** — Шаблоны Telegram-сообщений

---

## Примечания

1. **Всегда возвращаем 200 OK**: Даже при ошибках обработки, чтобы Tribute не повторял запрос бесконечно.
2. **Pending webhooks**: Если пользователь с `telegram_chat_id` не найден, webhook сохраняется в `pending_tribute_webhooks` для последующей обработки.
3. **BoardLockService**: После изменения тарифа автоматически пересчитываются блокировки досок пользователя.
4. **Транзакции**: Все операции с БД выполняются в рамках транзакции (BEGIN → COMMIT / ROLLBACK).

---

## История изменений

- **2026-01-19**: Создана документация Tribute webhook API
