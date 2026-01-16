# Tribute Service

Сервис для интеграции с платёжной системой Tribute (Telegram подписки).

## Расположение

`api/services/tributeService.js`

## Зависимости

- `crypto` - для проверки подписи webhook
- `pool` из `../db.js` - для работы с PostgreSQL

## Маппинг продуктов

| Tribute product_id | plan_id | Название | Цена |
|--------------------|---------|----------|------|
| `sLc8` | 6 | Individual | 249₽/мес, 2490₽/год |
| `sLe1` | 7 | Premium | 399₽/мес, 3990₽/год |

## Функции

### `mapTributeProductToPlan(tributeProductId)`

Преобразует `product_id` от Tribute в `plan_id` базы данных.

**Параметры:**
- `tributeProductId` (string) - ID продукта от Tribute

**Возвращает:** `number | null` - ID тарифа или null если продукт неизвестен

---

### `verifyTributeWebhook(payload, signature)`

Проверяет HMAC-подпись webhook от Tribute.

**Параметры:**
- `payload` (Object) - тело запроса
- `signature` (string) - значение заголовка `x-tribute-signature`

**Возвращает:** `boolean` - true если подпись валидна или проверка пропущена

**Примечание:** Если `TRIBUTE_WEBHOOK_SECRET` не настроен, проверка пропускается.

---

### `handleNewSubscription(data)`

Обработка события создания новой подписки.

**Параметры:**
- `data` (Object) - данные от Tribute:
  - `subscription_id` (string) - ID подписки
  - `telegram_user_id` (number) - Telegram user ID
  - `product_id` (string) - ID продукта (sLc8 или sLe1)
  - `amount` (number) - сумма платежа
  - `currency` (string) - валюта (по умолчанию 'RUB')
  - `period` (string) - период ('month' или 'year')

**Алгоритм:**
1. Определить `plan_id` по `product_id`
2. Найти пользователя по `telegram_chat_id`
3. Если пользователь не найден — сохранить в `pending_tribute_webhooks`
4. Обновить `users.plan_id` и `subscription_expires_at`
5. Создать/обновить запись в `tribute_subscriptions`
6. Создать запись в `subscription_history`
7. **Получить актуальную стоимость из тарифного плана** (`price_monthly` или `price_yearly` в зависимости от `period`)
8. Отправить email и Telegram уведомления с **правильной суммой** (из тарифа, а не из webhook)

**Примечание:** Сумма `amount` из webhook **НЕ используется** для отображения в уведомлениях, т.к. Tribute может передавать некорректные значения (0 или годовую цену для месячных подписок). Вместо этого берётся актуальная цена из таблицы `subscription_plans` в зависимости от периода подписки.
```

---

### `handleSubscriptionRenewed(data)`

Обработка продления подписки (автопродление).

**Параметры:**
- `data` (Object):
  - `subscription_id` (string)
  - `amount` (number)
  - `currency` (string)
  - `period` (string)

**Алгоритм:**
1. Найти подписку в `tribute_subscriptions`
2. Продлить `subscription_expires_at` у пользователя
3. Обновить `tribute_subscriptions`
4. Создать запись в `subscription_history` с source='tribute_renewal'

---

### `handleSubscriptionCancelled(data)`

Обработка отмены/истечения подписки.

**Параметры:**
- `data` (Object):
  - `subscription_id` (string)

**Алгоритм:**
1. Найти подписку в `tribute_subscriptions`
2. Получить ID гостевого тарифа
3. Перевести пользователя на гостевой тариф
4. Обновить статус в `tribute_subscriptions` на 'cancelled'

## События от Tribute

| Событие | Обработчик |
|---------|------------|
| `subscription.created` | `handleNewSubscription` |
| `subscription.started` | `handleNewSubscription` |
| `subscription.renewed` | `handleSubscriptionRenewed` |
| `subscription.payment_received` | `handleSubscriptionRenewed` |
| `subscription.cancelled` | `handleSubscriptionCancelled` |
| `subscription.expired` | `handleSubscriptionCancelled` |
| `subscription.failed` | `handleSubscriptionCancelled` |

## Таблицы БД

### tribute_subscriptions

Хранит информацию о подписках Tribute:
- `user_id` - связь с users
- `telegram_user_id` - Telegram ID пользователя
- `tribute_subscription_id` - ID подписки в Tribute
- `plan_id` - текущий тариф
- `status` - статус (active, cancelled)
- `expires_at` - дата истечения
- `last_payment_at` - дата последнего платежа
- `tribute_product_id` - ID продукта Tribute
- `amount_paid` - сумма последнего платежа
- `currency` - валюта

### pending_tribute_webhooks

Хранит webhook'и, пришедшие до привязки Telegram:
- `telegram_user_id` - Telegram ID
- `tribute_subscription_id` - ID подписки
- `payload` - полный JSON webhook'а
- `processed` - обработан ли
- `processed_at` - когда обработан

## Пример использования

```javascript
import { handleNewSubscription } from './services/tributeService.js';

const data = {
  subscription_id: 'sub_abc123',
  telegram_user_id: 123456789,
  product_id: 'sLc8',
  amount: 249,
  currency: 'RUB',
  period: 'month'
};

const result = await handleNewSubscription(data);
console.log(result); // { success: true, userId: 42, planId: 6 }
```

## Уведомления о подписках

После успешной обработки webhook'а отправляются **два типа уведомлений**:

### 1. Email-уведомления

Отправляются через `sendSubscriptionEmail()` из `api/utils/email.js`.

**Типы:**
- `'new'` — Новая подписка
- `'renewed'` — Продление
- `'cancelled'` — Отмена

**Обработка ошибок:**
- Ошибки отправки **НЕ блокируют** основной процесс обработки webhook
- Все ошибки логируются с префиксом `❌ Не удалось отправить email:`
- Функция отправки обёрнута в `try/catch`

---

### 2. Telegram-уведомления

Отправляются через `sendTelegramMessage()` из `api/utils/telegramService.js`.

**Шаблоны:**
- `getSubscriptionActivatedMessage()` — Новая подписка
- `getSubscriptionRenewedMessage()` — Продление
- `getSubscriptionCancelledMessage()` — Отмена

**Условия отправки:**
- Отправка происходит **ПОСЛЕ** успешной отправки email
- Требуется наличие `telegram_chat_id` в таблице `users`
- Если `telegram_chat_id` не указан — пропускается без ошибок

**Обработка ошибок:**
- Ошибки отправки **НЕ блокируют** основной процесс
- Детальное логирование:
  - `✅ Telegram-уведомление отправлено: {chat_id}`
  - `❌ Не удалось отправить Telegram-уведомление: {error}`
  - `ℹ️ telegram_chat_id не указан, пропускаем отправку`

**Формат сообщений:**
- `parse_mode: 'Markdown'`
- Кнопки для быстрого перехода (inline_keyboard)
- Эмодзи для визуального выделения

**Примечание:**  
Все шаблоны находятся в `api/templates/telegramTemplates.js`. См. подробную документацию в `docs/technical/templates/telegramTemplates.md`.

- Ошибки отправки email **НЕ блокируют** основной процесс обработки webhook
- Все ошибки логируются с префиксом `❌ Не удалось отправить email:`
- Функция отправки обёрнута в `try/catch`

### Используемый сервис:

Функция `sendSubscriptionEmail()` из `api/utils/email.js`
