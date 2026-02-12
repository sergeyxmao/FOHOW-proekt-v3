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

Создание подписанной ссылки на платёжную страницу.

- **Аутентификация:** Bearer JWT
- **Тело запроса:** `{ planId: 6 | 7 }`
- **Ответ:** `{ paymentUrl: "https://foboard.payform.ru?..." }`

## Алгоритм HMAC SHA-256 подписи

Продамус использует собственный алгоритм подписи:

1. Все значения объекта приводятся к строкам
2. Объект рекурсивно сортируется по ключам (аналог PHP `ksort()`)
3. Результат сериализуется в JSON (`JSON.stringify`)
4. Вычисляется HMAC-SHA256 от JSON с секретным ключом
5. Результат — hex-строка

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

## Формат ссылки на оплату

```
https://foboard.payform.ru?
  do=link&
  products[0][name]=Доступ к платформе FoBoard, тариф "Индивидуальный", подписка на 30 дней&
  products[0][price]=299&
  products[0][quantity]=1&
  products[0][sku]=plan_6&
  customer_email=user@example.com&
  order_id=FB-123-6-1707753600000&
  urlReturn=https://1508.marketingfohow.ru/pricing&
  urlSuccess=https://1508.marketingfohow.ru/payment-success&
  urlNotification=https://1508.marketingfohow.ru/api/webhook/prodamus&
  _param_user_id=123&
  payment_method=AC&
  available_payment_methods=AC|SBP|sbol|tpay&
  signature=abc123...
```

## Маппинг тарифов

| plan_id | Название | Цена | SKU |
|---------|----------|------|-----|
| 6 | Индивидуальный | 299 руб/мес | plan_6 |
| 7 | Премиум | 499 руб/мес | plan_7 |

## Переменные окружения

| Переменная | Описание | Пример |
|-----------|----------|--------|
| `PRODAMUS_SECRET_KEY` | Секретный ключ для HMAC подписи | `abc123...` |
| `PRODAMUS_PAYFORM_URL` | URL платёжной формы | `https://foboard.payform.ru` |
| `PRODAMUS_SUCCESS_URL` | URL после успешной оплаты | `https://1508.marketingfohow.ru/payment-success` |
| `PRODAMUS_FAIL_URL` | URL после неудачной оплаты | `https://1508.marketingfohow.ru/payment-fail` |
| `PRODAMUS_WEBHOOK_URL` | URL для webhook-уведомлений | `https://1508.marketingfohow.ru/api/webhook/prodamus` |
| `PRODAMUS_RETURN_URL` | URL для кнопки "Вернуться" | `https://1508.marketingfohow.ru/pricing` |

## Поток оплаты

```
Пользователь → Кнопка "Выбрать тариф"
  → POST /api/payments/create-link { planId }
  → Получает paymentUrl
  → Редирект на foboard.payform.ru
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
