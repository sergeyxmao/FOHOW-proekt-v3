# Tribute API Routes

Маршруты для интеграции с платёжной системой Tribute.

## Расположение

`api/routes/tribute.js`

## Endpoints

### POST /api/webhook/tribute

Webhook endpoint для приёма уведомлений от Tribute.

**URL:** `https://interactive.marketingfohow.ru/api/webhook/tribute`

**Headers:**
- `x-tribute-signature` (optional) - HMAC-SHA256 подпись для верификации

**Body:**
```json
{
  "event": "subscription.created",
  "data": {
    "subscription_id": "sub_abc123",
    "telegram_user_id": 123456789,
    "product_id": "sLc8",
    "amount": 249,
    "currency": "RUB",
    "period": "month"
  }
}
```

**Поддерживаемые события:**
- `subscription.created` - новая подписка
- `subscription.started` - подписка активирована
- `subscription.renewed` - подписка продлена
- `subscription.payment_received` - платёж получен
- `subscription.cancelled` - подписка отменена
- `subscription.expired` - подписка истекла
- `subscription.failed` - платёж не прошёл

**Response (success):**
```json
{
  "success": true,
  "received": "subscription.created",
  "result": {
    "success": true,
    "userId": 42,
    "planId": 6
  }
}
```

**Response (error):**
```json
{
  "success": false,
  "error": "Internal server error"
}
```

**Примечание:** Endpoint всегда возвращает HTTP 200, даже при ошибках, чтобы Tribute не повторял запрос.

---

### GET /api/webhook/tribute/health

Проверка доступности webhook endpoint.

**Response:**
```json
{
  "status": "ok",
  "service": "tribute-webhook",
  "timestamp": "2024-01-15T12:00:00.000Z"
}
```

## Настройка в Tribute

1. Войти в панель управления Tribute
2. Перейти в раздел Webhooks
3. Добавить URL: `https://interactive.marketingfohow.ru/api/webhook/tribute`
4. Выбрать события для отправки
5. (Опционально) Настроить секрет для подписи

## Переменные окружения

```bash
# Опционально: секрет для проверки подписи webhook
TRIBUTE_WEBHOOK_SECRET=your_secret_here
```

## Логирование

Все входящие webhook'и логируются:
```
[Tribute Webhook] Получен запрос: { event: 'subscription.created', subscription_id: 'sub_abc123' }
```

Успешные операции:
```
✅ Подписка активирована для user_id=42, plan_id=6
```

Ошибки:
```
❌ Неизвестный product_id от Tribute: unknown_product
```

## Безопасность

1. **Проверка подписи** - если настроен `TRIBUTE_WEBHOOK_SECRET`, все запросы проверяются
2. **Валидация данных** - проверяется наличие обязательных полей
3. **Транзакции** - все операции с БД выполняются в транзакциях
4. **Не раскрытие ошибок** - в production режиме детали ошибок не возвращаются

## Тестирование

Проверить доступность:
```bash
curl https://interactive.marketingfohow.ru/api/webhook/tribute/health
```

Тестовый webhook:
```bash
curl -X POST https://interactive.marketingfohow.ru/api/webhook/tribute \
  -H "Content-Type: application/json" \
  -d '{
    "event": "subscription.created",
    "data": {
      "subscription_id": "test_123",
      "telegram_user_id": 123456789,
      "product_id": "sLc8",
      "amount": 249,
      "currency": "RUB",
      "period": "month"
    }
  }'
```
