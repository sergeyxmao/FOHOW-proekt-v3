# API Тарифных планов (Plans API)

**Файл**: `api/routes/plans.js`

## Описание

Модуль `plans.js` предоставляет API-эндпоинты для работы с тарифными планами:
- Получение информации о текущем тарифе пользователя
- Получение списка публичных тарифных планов
- Обработка webhook от платежной системы Tribute

## Маршруты

### 1. GET /api/user/plan

**Описание**: Получить подробную информацию о тарифном плане текущего пользователя.

**Требования**:
- Аутентификация: JWT token (middleware `authenticateToken`)

**Ответ** (200 OK):
```json
{
  "user": {
    "id": 123,
    "username": "ivan_petrov",
    "email": "ivan@example.com",
    "subscriptionStartedAt": "2025-01-01T00:00:00.000Z",
    "subscriptionExpiresAt": "2026-01-01T00:00:00.000Z",
    "gracePeriodUntil": null
  },
  "plan": {
    "id": 6,
    "name": "Individual",
    "code_name": "individual",
    "priceMonthly": 299
  },
  "features": {
    "max_boards": 50,
    "max_notes": 1000,
    "max_stickers": 500,
    "max_comments": -1,
    "max_licenses": 100
  },
  "usage": {
    "boards": {
      "current": 12,
      "limit": 50
    },
    "notes": {
      "current": 234,
      "limit": 1000
    },
    "stickers": {
      "current": 89,
      "limit": 500
    },
    "userComments": {
      "current": 45,
      "limit": -1
    },
    "cards": {
      "current": 23,
      "limit": 100
    }
  }
}
```

**Ошибки**:
- `404` – Пользователь или тарифный план не найден
- `500` – Ошибка сервера

---

### 2. GET /api/plans

**Описание**: Получить список публичных тарифных планов, доступных для подписки.

**Требования**: Нет (публичный endpoint)

**Ответ** (200 OK):
```json
{
  "plans": [
    {
      "id": 5,
      "name": "Guest",
      "code_name": "guest",
      "description": "Бесплатный тариф с ограничениями",
      "price_monthly": 0,
      "price_yearly": 0,
      "features": {
        "max_boards": 3,
        "max_notes": 50,
        "max_stickers": 20,
        "max_comments": 10,
        "max_licenses": 10
      },
      "display_order": 1,
      "is_public": true,
      "created_at": "2025-01-01T00:00:00.000Z",
      "updated_at": "2025-01-01T00:00:00.000Z"
    },
    {
      "id": 6,
      "name": "Individual",
      "code_name": "individual",
      "description": "Для личного использования",
      "price_monthly": 299,
      "price_yearly": 2990,
      "features": {
        "max_boards": 50,
        "max_notes": 1000,
        "max_stickers": 500,
        "max_comments": -1,
        "max_licenses": 100
      },
      "display_order": 2,
      "is_public": true,
      "created_at": "2025-01-01T00:00:00.000Z",
      "updated_at": "2025-01-01T00:00:00.000Z"
    }
  ]
}
```

**Ошибки**:
- `500` – Ошибка сервера

---

## Связанные файлы

- **api/routes/tribute.js** – Маршруты для webhook Tribute
- **api/services/tributeService.js** – Бизнес-логика обработки платежей
- **api/middleware/auth.js** – Middleware аутентификации

## База данных

### Таблица `subscription_plans`

| Поле            | Тип      | Описание                              |
|-----------------|----------|---------------------------------------|
| id              | SERIAL   | ID тарифа (PK)                        |
| name            | VARCHAR  | Название тарифа                       |
| code_name       | VARCHAR  | Код тарифа (guest, individual, premium)|
| description     | TEXT     | Описание тарифа                       |
| price_monthly   | INTEGER  | Цена за месяц (в рублях)              |
| price_yearly    | INTEGER  | Цена за год (в рублях)                |
| features        | JSONB    | Список фич тарифа                     |
| display_order   | INTEGER  | Порядок отображения                   |
| is_public       | BOOLEAN  | Виден ли пользователям                |
| created_at      | TIMESTAMP| Дата создания                         |
| updated_at      | TIMESTAMP| Дата последнего обновления            |

### Таблица `users` (связанные поля)

| Поле                      | Тип       | Описание                          |
|---------------------------|-----------|-----------------------------------|
| plan_id                   | INTEGER   | FK → subscription_plans.id        |
| subscription_started_at   | TIMESTAMP | Дата начала подписки              |
| subscription_expires_at   | TIMESTAMP | Дата окончания подписки           |
| grace_period_until        | TIMESTAMP | Льготный период после истечения   |
| payment_method            | VARCHAR   | Способ оплаты (tribute, yookassa и др.) |
| auto_renew                | BOOLEAN   | Автопродление подписки            |

---

## Примечания

1. **Лимит `-1`** означает "неограниченно" (например, `max_comments: -1`).
2. **Подсчет usage** происходит в реальном времени через SQL-запросы к таблицам `boards`, `notes`, `stickers`, `user_comments`.
3. **cards_count** подсчитывает максимальное количество карточек на одной доске (объекты типа `small`, `large`, `gold`, `avatar`).

## История изменений

- **2026-01-19**: Создана документация API `/api/user/plan` и `/api/plans`
