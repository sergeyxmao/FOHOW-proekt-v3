# Интеграция платёжной системы Продамус (Prodamus)

## Описание

Платёжная система Продамус (prodamus.ru) обрабатывает платежи за подписки FoBoard. Интеграция использует готовые платёжные ссылки с GET-параметрами и webhook для автоматической активации подписок.

Предыдущая платёжная система Tribute была полностью удалена и заменена на Продамус (12 февраля 2026).

---

## Расположение файлов

### Backend
| Файл | Назначение |
|------|-----------|
| `api/routes/prodamus.js` | Роуты: webhook, создание ссылок на оплату |
| `api/services/prodamusService.js` | Бизнес-логика: верификация подписи, обработка webhook, активация подписки |
| `api/utils/emailService.js` | Отправка email-уведомлений о подписке |
| `api/templates/telegramTemplates.js` | Шаблоны Telegram-уведомлений |
| `api/templates/emailTemplates.js` | HTML-шаблоны email-уведомлений |

### Frontend
| Файл | Назначение |
|------|-----------|
| `src/composables/useUserTariffs.js` | Логика оплаты: `handleUpgrade()` вызывает API для получения ссылки |
| `src/views/PaymentSuccessPage.vue` | Страница успешной оплаты |
| `src/views/PaymentFailPage.vue` | Страница неудачной оплаты |

### Конфигурация
| Файл | Назначение |
|------|-----------|
| `api/.env` | Переменные окружения (ссылки, секретный ключ) |

---

## Архитектура

### Поток оплаты

1. Пользователь нажимает "Перейти на тариф"
2. Frontend → POST /api/payments/create-link { planId: 6|7 }
3. Backend → Формирует URL: готовая_ссылка + ?_param_user_id=ID&customer_email=EMAIL
4. Frontend → window.location.href = paymentUrl (редирект на Продамус)
5. Продамус → Пользователь оплачивает (СБП, карта и т.д.)
6. Продамус → POST /api/webhook/prodamus (Content-Type: application/x-www-form-urlencoded)
7. Backend → Верификация подписи → Активация подписки → Email + Telegram уведомления
8. Продамус → Редирект на /payment-success или /payment-fail

### Маппинг тарифов

| Plan ID | Тариф | Цена | Платёжная ссылка (env) |
|---------|-------|------|----------------------|
| 6 | Индивидуальный | 299 ₽/мес | `PRODAMUS_LINK_INDIVIDUAL` |
| 7 | Премиум | 499 ₽/мес | `PRODAMUS_LINK_PREMIUM` |

---

## Настройка переменных окружения

### api/.env

```
PRODAMUS_LINK_INDIVIDUAL=https://payform.ru/hqaEqyT/
PRODAMUS_LINK_PREMIUM=https://payform.ru/nkaEqBZ/
PRODAMUS_SECRET_KEY=<секретный_ключ_из_кабинета_продамус>
```

### Где взять секретный ключ

1. Зайти в кабинет Продамуса → foboard.payform.ru
2. Настройки → Уведомления → Секретный ключ для подписи
3. Скопировать и вставить в `PRODAMUS_SECRET_KEY`

---

## Настройка Продамуса (кабинет foboard.payform.ru)

### Webhook (URL-уведомления)

| Параметр | Staging | Production |
|----------|---------|-----------|
| URL для уведомлений | `https://1508.marketingfohow.ru/api/webhook/prodamus` | `https://interactive.marketingfohow.ru/api/webhook/prodamus` |
| Success URL | `https://1508.marketingfohow.ru/payment-success` | `https://interactive.marketingfohow.ru/payment-success` |
| Fail URL | `https://1508.marketingfohow.ru/payment-fail` | `https://interactive.marketingfohow.ru/payment-fail` |

---

## API эндпоинты

### POST /api/payments/create-link

Создание ссылки на оплату. Требует авторизации.

**Request:** `{ "planId": 6 }`

**Response (200):** `{ "paymentUrl": "https://payform.ru/hqaEqyT/?_param_user_id=105&customer_email=user@example.com" }`

**Ошибки:** 400 — Недопустимый тариф, 401 — Не авторизован

### POST /api/webhook/prodamus

Webhook от Продамуса. Вызывается автоматически после оплаты.

**Заголовки:** Content-Type: application/x-www-form-urlencoded, Sign: \<HMAC-SHA256\>

**Response:** 200 — Обработан, 400 — Невалидная подпись

---

## Верификация подписи webhook

### Алгоритм

1. Берём сырое тело запроса (__rawBody) — URL-encoded строку
2. Парсим через phpParseStr() — аналог PHP parse_str()
   - Декодируем %5B → [, %5D → ] в ключах ПЕРЕД разбором
   - products[0][name] → { products: [ { name: "..." } ] } (массив, не объект!)
   - + в значениях → пробел
   - &amp;quot; остаётся как &amp;quot; (НЕ декодируется в ")
3. Приводим ВСЕ значения к строкам рекурсивно (deepStringify)
4. Рекурсивная сортировка по ключам (deepSortByKeys)
5. JSON.stringify() — JS не экранирует Unicode (как PHP JSON_UNESCAPED_UNICODE)
6. HMAC-SHA256(json, secretKey)
7. Сравнение через crypto.timingSafeEqual

### Частые ошибки при реализации

1. URLSearchParams парсит products[0][name] как плоский ключ — нельзя использовать
2. Скобки приходят URL-encoded (%5B, %5D) — нужно декодировать ключ перед разбором
3. PHP создаёт массив для [0], JS по умолчанию создаёт объект {"0": ...} — разный JSON!
4. + в значениях — ломает даты (+03:00 → пробел03:00)
5. HTML entities (&amp;quot;) НЕ должны декодироваться в кавычки

### Сохранение __rawBody

В api/server.js настроен кастомный content-type парсер, который сохраняет оригинальное тело запроса в поле `__rawBody`. Это поле удаляется перед передачей в processWebhook.

---

## Определение userId и planId

### userId
1. `_param_user_id` — GET-параметр (не пробрасывается Продамусом в webhook)
2. Fallback: `customer_email` → поиск в таблице users по email

### planId
1. `products[0].sku` — если указан (не используется)
2. `order_id` формата `FB-{userId}-{planId}-{timestamp}` (не используется)
3. Fallback по сумме: ≤299₽ → plan 6, ≤499₽ → plan 7

---

## Уведомления

### Email
Функция: `sendSubscriptionEmail(email, eventType, data)`
Допустимые eventType: 'new', 'renewed', 'cancelled', 'promo'
⚠️ НЕ использовать 'new_subscription' — вызовет ошибку!

### Telegram
Функция: `getSubscriptionActivatedMessage(userName, planName, amount, currency, expiresDate)`
Отправляется если у пользователя привязан telegram_chat_id.

---

## Чек-лист деплоя на новый сервер

1. Настроить переменные в api/.env (PRODAMUS_LINK_*, PRODAMUS_SECRET_KEY)
2. В кабинете Продамуса обновить URL для уведомлений, Success URL, Fail URL
3. Тест: curl с невалидной подписью → ожидать 400 Invalid signature
4. Тестовый платёж через интерфейс → проверить логи, активацию, уведомления

---

## Логирование

Префикс: `[PRODAMUS]`
Команда для мониторинга: `journalctl -u fohow-api -f | grep PRODAMUS`

---

## История изменений

| Дата | Изменение |
|------|-----------|
| 2026-02-12 | Полная миграция с Tribute на Prodamus |
| 2026-02-12 | Реализация PHP-совместимой верификации подписи (phpParseStr) |
| 2026-02-12 | Fallback определения planId по сумме платежа |
| 2026-02-12 | Боевые ссылки: Индивидуальный hqaEqyT, Премиум nkaEqBZ |
