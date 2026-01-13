# Telegram API Routes

Маршруты для интеграции с Telegram (привязка аккаунта, уведомления).

## Расположение

`api/routes/telegram.js`

## Endpoints

### POST /api/user/telegram/generate-code

Генерация одноразового кода для привязки Telegram.

**Требует авторизации:** Да

**Response:**
```json
{
  "success": true,
  "code": "ABC123",
  "expiresAt": "2024-01-15T12:15:00.000Z",
  "botUsername": "fohow_bot"
}
```

**Примечание:** Код действителен 15 минут.

---

### GET /api/user/telegram/check-link-status

Проверка статуса привязки Telegram (polling).

**Требует авторизации:** Да

**Response (привязан):**
```json
{
  "success": true,
  "linked": true,
  "telegram": {
    "chat_id": "123456789",
    "username": "user_name"
  }
}
```

**Response (не привязан):**
```json
{
  "success": true,
  "linked": false,
  "telegram": null
}
```

---

### POST /api/user/connect-telegram

Привязка Telegram к аккаунту (используется ботом).

**Требует авторизации:** Да

**Body:**
```json
{
  "telegram_chat_id": "123456789",
  "telegram_username": "user_name"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Telegram успешно привязан к аккаунту",
  "telegram": {
    "chat_id": "123456789",
    "username": "user_name"
  }
}
```

**Интеграция с Tribute:**
После успешной привязки автоматически обрабатываются отложенные webhook от Tribute
(`pending_tribute_webhooks`), если пользователь оплатил подписку до привязки Telegram.

---

### POST /api/user/telegram/unlink

Отключение Telegram от аккаунта.

**Требует авторизации:** Да

**Response:**
```json
{
  "success": true,
  "message": "Telegram успешно отключен от аккаунта"
}
```

**Примечание:** После отключения пользователю отправляется уведомление в Telegram.

## Таблицы БД

### telegram_link_codes

Хранит одноразовые коды для привязки:
- `user_id` - ID пользователя
- `code` - 6-символьный код
- `expires_at` - срок действия
- `used` - использован ли код

## Интеграция с Tribute Payment

При привязке Telegram через `/api/user/connect-telegram` автоматически
вызывается `processPendingTributeWebhooks(chatId)` для обработки
отложенных платёжных webhook.

Это позволяет активировать подписку, если пользователь:
1. Оплатил подписку через Tribute в Telegram
2. Получил webhook от Tribute (сохранён в `pending_tribute_webhooks`)
3. Затем привязал Telegram к аккаунту на сайте

## Связанные файлы

- `api/bot/telegramBot.js` - Telegram бот для обработки команд
- `api/services/processPendingTributeWebhooks.js` - обработка отложенных webhook
