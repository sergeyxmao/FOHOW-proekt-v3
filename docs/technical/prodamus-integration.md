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

Алгоритм:

1. Все значения рекурсивно приводятся к строкам (`strval`)
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

### Верификация webhook

Подпись приходит в HTTP-заголовке `Sign`. Сравнение через `crypto.timingSafeEqual()` для защиты от timing-атак.

## Формат данных webhook

```json
{
  "order_id": "FB-123-6-1707753600000",
  "order_num": "12345",
  "sum": "299.00",
  "customer_email": "user@example.com",
  "customer_phone": "+79001234567",
  "payment_type": "AC",
  "payment_status": "success",
  "payment_init": "manual",
  "products": {
    "0": {
      "name": "Доступ к платформе FoBoard...",
      "price": "299.00",
      "quantity": "1",
      "sku": "plan_6"
    }
  },
  "_param_user_id": "123"
}
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
