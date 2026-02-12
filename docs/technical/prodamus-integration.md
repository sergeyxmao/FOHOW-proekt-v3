# Интеграция с платёжной системой Продамус (Prodamus)

## Описание

Продамус — платёжная система для приёма онлайн-платежей. Используется для оплаты тарифных планов «Индивидуальный» (plan_id=6, 299 руб/мес) и «Премиум» (plan_id=7, 499 руб/мес).

## Расположение файлов

| Файл | Назначение |
|------|-----------|
| `api/routes/prodamus.js` | Роуты: webhook и создание ссылки на оплату |
| `api/services/prodamusService.js` | Сервис: подпись, верификация, обработка webhook |
| `src/composables/useUserTariffs.js` | Фронтенд: инициация оплаты |
| `src/views/PaymentSuccessPage.vue` | Страница успешной оплаты |
| `src/views/PaymentFailPage.vue` | Страница неудачной оплаты |

## API-эндпоинты

### POST /api/webhook/prodamus

Приём webhook-уведомлений от Продамуса.

- **Аутентификация:** нет (публичный)
- **Верификация:** HMAC SHA-256 подпись в заголовке `Sign`
- **Content-Type:** `application/x-www-form-urlencoded` или `multipart/form-data`
- **Ответ:** всегда `200 { success: true }` при валидной подписи (требование Продамуса)

### POST /api/payments/create-link

Возвращает готовую ссылку Продамуса с GET-параметрами пользователя.

- **Аутентификация:** Bearer JWT
- **Тело запроса:** `{ planId: 6 | 7 }`
- **Ответ:** `{ paymentUrl: "https://payform.ru/hqaEqyT/?_param_user_id=123&customer_email=user@example.com" }`

## Формирование платёжной ссылки

Используются **готовые ссылки Продамуса** (настроены в личном кабинете Продамуса с указанием товара, цены, success/fail URL, webhook URL). К ссылке добавляются GET-параметры для идентификации пользователя:

```
https://payform.ru/hqaEqyT/?_param_user_id=123&customer_email=user@example.com
```

### Маппинг plan_id → ссылка

| plan_id | Название | Цена | Ссылка Продамуса | Переменная окружения |
|---------|----------|------|-----------------|---------------------|
| 6 | Индивидуальный | 299 руб/мес | `https://payform.ru/hqaEqyT/` | `PRODAMUS_LINK_INDIVIDUAL` |
| 7 | Премиум | 499 руб/мес | `https://payform.ru/nkaEqBZ/` | `PRODAMUS_LINK_PREMIUM` |

### GET-параметры ссылки

| Параметр | Описание | Пример |
|----------|----------|--------|
| `_param_user_id` | ID пользователя (передаётся в webhook) | `123` |
| `customer_email` | Email пользователя (предзаполнение формы) | `user@example.com` |

### Реализация в коде

```javascript
// api/routes/prodamus.js
const PRODAMUS_LINKS = {
  6: process.env.PRODAMUS_LINK_INDIVIDUAL || 'https://payform.ru/hqaEqyT/',
  7: process.env.PRODAMUS_LINK_PREMIUM || 'https://payform.ru/nkaEqBZ/'
};

const baseUrl = PRODAMUS_LINKS[planId];
const params = new URLSearchParams({
  _param_user_id: String(userId),
  customer_email: userEmail
});
const paymentUrl = `${baseUrl}?${params.toString()}`;
```

## Алгоритм HMAC SHA-256 подписи (только для webhook)

HMAC-подпись используется **только для верификации webhook** от Продамуса. Для формирования платёжных ссылок подпись не нужна — используются готовые ссылки.

Продамус использует собственный алгоритм подписи ([документация](https://help.prodamus.ru)).

### Эталонный PHP-класс от Продамуса

```php
class Hmac {
    static function create($data, $key, $algo = 'sha256') {
        $data = (array) $data;
        array_walk_recursive($data, function(&$v){ $v = strval($v); });
        self::_sort($data);
        $data = json_encode($data, JSON_UNESCAPED_UNICODE);
        return hash_hmac($algo, $data, $key);
    }
    static private function _sort(&$data) {
        ksort($data, SORT_REGULAR);
        foreach ($data as &$arr)
            is_array($arr) && self::_sort($arr);
    }
}
```

### Наша реализация на Node.js

#### createSignature(data, secretKey)

Алгоритм:

1. Все значения рекурсивно приводятся к строкам (`deepSortByKeys` → `String()`)
2. Рекурсивная сортировка по ключам (аналог PHP `ksort()`)
3. Сериализация в JSON (`JSON.stringify` — по умолчанию не эскейпит Unicode, как `JSON_UNESCAPED_UNICODE`)
4. HMAC-SHA256 от JSON с секретным ключом → hex

```javascript
function createSignature(data, secretKey) {
  const sorted = deepSortByKeys(data)
  const json = JSON.stringify(sorted)
  return crypto.createHmac('sha256', secretKey).update(json).digest('hex')
}
```

#### verifySignature(data, receivedSignature, secretKey) — верификация webhook

Подпись приходит в HTTP-заголовке `Sign`. Процесс верификации:

1. **Берём сырое тело запроса** (`__rawBody`) — сохраняется в content-type parser (`server.js`)
2. **Парсим через `phpParseStr()`** — аналог PHP `parse_str()`:
   - Поддерживает вложенные ключи: `products[0][name]=X` → `{ products: { '0': { name: 'X' } } }`
   - `+` декодируется как пробел (поведение PHP)
   - HTML-сущности (`&quot;`) **НЕ** декодируются (поведение PHP `parse_str`)
3. **Приводим все значения к строкам** через `deepStringify()`
4. **Рекурсивно сортируем** по ключам через `deepSortByKeys()`
5. **`JSON.stringify` → HMAC-SHA256 → hex**
6. **Сравниваем** через `crypto.timingSafeEqual()` для защиты от timing-атак

**Почему нельзя использовать `URLSearchParams`?**

`URLSearchParams` создаёт плоские ключи (`products[0][name]` как один ключ), а PHP `parse_str()` создаёт вложенную структуру. Продамус подписывает данные после PHP `parse_str()`, поэтому мы должны парсить так же.

**Почему `__rawBody`?**

Fastify парсит тело запроса в content-type parser. Для верификации нужно сырое тело (до парсинга), чтобы парсить его через `phpParseStr()` и получить идентичную PHP структуру. `__rawBody` сохраняется в parser и удаляется перед передачей данных в `processWebhook()`.

#### phpParseStr(rawBody)

Нативная JS-реализация PHP `parse_str()`:

```javascript
// Вход: 'products[0][name]=Test&products[0][price]=299'
// Выход: { products: { '0': { name: 'Test', price: '299' } } }
function phpParseStr(rawBody) {
  // Для каждой пары key=value:
  // 1. Разбираем ключ: products[0][name] → ['products', '0', 'name']
  // 2. Декодируем: '+' → пробел, %XX → символ
  // 3. Записываем во вложенную структуру
}
```

**Критичное отличие от `decodeURIComponent`**: PHP `parse_str()` НЕ декодирует HTML-сущности. Так, `%26quot%3B` (URL-encoded `&quot;`) декодируется как `&quot;` (строка из 6 символов), а НЕ как `"` (кавычка).

#### deepStringify(obj)

Рекурсивное приведение всех значений к строкам (аналог PHP `strval`).

## Формат данных webhook

Продамус отправляет webhook в формате `application/x-www-form-urlencoded`. После парсинга через `phpParseStr()` данные имеют вложенную структуру:

```json
{
  "date": "2026-02-12T15:51:02+03:00",
  "order_id": "41410995",
  "order_num": "LL-41410995-68097",
  "sum": "299.00",
  "customer_email": "user@example.com",
  "customer_phone": "+79001234567",
  "payment_type": "AC",
  "payment_status": "success",
  "payment_init": "manual",
  "products": {
    "0": {
      "name": "Подписка FoBoard — тариф &quot;Индивидуальный&quot;, 30 дней",
      "price": "299.00",
      "quantity": "1",
      "sku": "plan_6"
    }
  },
  "_param_user_id": "123"
}
```

**Примечание:** HTML-сущности (`&quot;`) в значениях сохраняются как есть — это поведение PHP `parse_str()`.

### Парсинг products в processWebhook

`processWebhook` поддерживает products в нескольких форматах:
1. **Массив** `[{ name, sku, ... }]` — из JSON
2. **Объект с числовыми ключами** `{ '0': { name, sku, ... } }` — из `phpParseStr()`
3. **Плоские ключи** `data['products[0][sku]']` — из `URLSearchParams` (fallback)
```

## Переменные окружения

| Переменная | Описание | Пример |
|-----------|----------|--------|
| `PRODAMUS_SECRET_KEY` | Секретный ключ для HMAC подписи webhook | `abc123...` |
| `PRODAMUS_LINK_INDIVIDUAL` | Готовая ссылка для плана Индивидуальный | `https://payform.ru/hqaEqyT/` |
| `PRODAMUS_LINK_PREMIUM` | Готовая ссылка для плана Премиум | `https://payform.ru/nkaEqBZ/` |

## Поток оплаты

```
Пользователь → Кнопка "Выбрать тариф"
  → POST /api/payments/create-link { planId }
  → Получает paymentUrl (готовая ссылка + GET-параметры)
  → Редирект на payform.ru
  → Оплата на стороне Продамуса
  → Продамус → POST /api/webhook/prodamus (Sign: HMAC)
    → Верификация подписи
    → Запись в prodamus_payments
    → Активация подписки (UPDATE users, INSERT subscription_history)
    → Пересчёт блокировок досок (boardLockService)
    → Уведомления (email + Telegram)
  → Продамус → Редирект на /payment-success
  → authStore.fetchProfile() → обновление данных подписки
```

## Таблица БД: prodamus_payments

| Колонка | Тип | Описание |
|---------|-----|----------|
| id | integer | PK |
| user_id | integer | FK → users.id |
| plan_id | integer | FK → subscription_plans.id |
| order_id | varchar | Внутренний ID заказа (FB-userId-planId-timestamp) |
| prodamus_order_id | varchar | ID заказа в системе Продамуса |
| amount | numeric | Сумма платежа |
| currency | varchar | Валюта (RUB) |
| payment_status | varchar | Статус: success, fail, pending |
| payment_type | varchar | Тип оплаты (AC, SBP, sbol, tpay) |
| payment_init | varchar | Инициатор платежа |
| customer_email | varchar | Email покупателя |
| customer_phone | varchar | Телефон покупателя |
| prodamus_data | jsonb | Полные данные webhook |
| created_at | timestamp | Дата создания записи |

## Связанные компоненты

- Активация подписки: аналогичный паттерн в `api/routes/promo.js` (промокоды)
- Блокировка досок: `api/services/boardLockService.js`
- Уведомления: `api/utils/emailService.js`, `api/utils/telegramService.js`
- Крон-задача блокировки просроченных подписок: `api/cron/tasks.js` → `blockExpiredSubscriptions`
