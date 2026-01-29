# Verification API

API для верификации партнёров FOHOW через персональную реферальную ссылку.

## Общая информация

- **Базовый префикс:** `/api/verification`
- **Авторизация:** JWT (Bearer Token)
- **Роли:**
  - пользователь
  - администратор (для модерации)

## POST /api/verification/submit

**Описание:** Отправка заявки на верификацию пользователем.

**Тип запроса:** `multipart/form-data`

### Поля запроса

| Поле | Тип | Обязательное | Описание |
| --- | --- | --- | --- |
| `full_name` | string | ✅ | Полное ФИО пользователя |
| `referral_link` | string | ✅ | Персональная реферальная ссылка FOHOW |

### Правила валидации referral_link

- обязательное поле
- должно начинаться с `http://www.fohow`
- должно содержать `id=`
- максимальная длина — 60 символов

**Пример корректной ссылки:**
`http://www.fohow.plus/clientRegProm?id=2891936`

### Пример ответа (200)

```json
{
  "success": true,
  "message": "Заявка на верификацию отправлена"
}
```

### Возможные ошибки

- `400` — ошибка валидации
- `401` — не авторизован
- `409` — заявка уже существует

## GET /api/verification/status

**Описание:** Получить текущий статус верификации пользователя.

### Пример ответа

```json
{
  "status": "pending",
  "hasPendingRequest": true,
  "lastRequestTime": "2025-01-27T08:42:00Z"
}
```

## GET /api/verification/history

**Описание:** История заявок на верификацию пользователя.

### Пример элемента истории

```json
{
  "id": 12,
  "full_name": "Иванов Иван Иванович",
  "referral_link": "http://www.fohow.plus/clientRegProm?id=2891936",
  "status": "approved",
  "submitted_at": "2025-01-25T10:12:00Z",
  "processed_at": "2025-01-26T09:30:00Z"
}
```

## POST /api/verification/cancel

**Описание:** Отмена пользователем активной заявки на верификацию.

## Административные endpoints

Без углубления в детали реализации:

- `GET /api/admin/verifications/pending`
- `POST /api/admin/verifications/:id/approve`
- `POST /api/admin/verifications/:id/reject`
- `GET /api/admin/verifications/archive`

### Примечания для админских запросов

- администратор видит `referral_link`
- скриншоты не используются
