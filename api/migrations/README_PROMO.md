# Миграции для системы промокодов

## Описание

Файл миграции `004_create_promo_codes_tables.sql` создает необходимые таблицы для работы с промокодами:

1. **promo_codes** - таблица промокодов
2. **promo_code_usages** - таблица использований промокодов
3. **subscription_history** - таблица истории подписок

## Применение миграции

Подключитесь к базе данных PostgreSQL и выполните:

```bash
psql -h localhost -U your_user -d your_database -f api/migrations/004_create_promo_codes_tables.sql
```

Или используйте свой инструмент миграций.

## Структура таблиц

### promo_codes

| Поле              | Тип        | Описание                                                 |
|-------------------|------------|----------------------------------------------------------|
| id                | SERIAL     | Первичный ключ                                           |
| code              | VARCHAR(50)| Уникальный код промокода                                 |
| is_active         | BOOLEAN    | Флаг активности промокода                                |
| start_date        | TIMESTAMP  | Дата начала действия                                     |
| end_date          | TIMESTAMP  | Дата окончания действия                                  |
| max_uses_total    | INTEGER    | Макс. использований (NULL = безлимит)                    |
| current_uses      | INTEGER    | Текущее количество использований                         |
| max_uses_per_user | INTEGER    | Макс. использований на пользователя                      |
| duration_days     | INTEGER    | Длительность подписки в днях                             |
| target_plan_id    | INTEGER    | ID тарифного плана (FK → subscription_plans)             |

### promo_code_usages

| Поле           | Тип       | Описание                                   |
|----------------|-----------|--------------------------------------------|
| id             | SERIAL    | Первичный ключ                             |
| promo_code_id  | INTEGER   | ID промокода (FK → promo_codes)            |
| user_id        | INTEGER   | ID пользователя (FK → users)               |
| used_at        | TIMESTAMP | Дата и время использования                 |

### subscription_history

| Поле       | Тип        | Описание                                        |
|------------|------------|-------------------------------------------------|
| id         | SERIAL     | Первичный ключ                                  |
| user_id    | INTEGER    | ID пользователя (FK → users)                    |
| plan_id    | INTEGER    | ID тарифного плана (FK → subscription_plans)    |
| action     | VARCHAR(50)| Тип действия (promo_code_applied, etc.)        |
| expires_at | TIMESTAMP  | Дата истечения подписки после действия          |
| details    | JSONB      | Дополнительные данные в формате JSON            |
| created_at | TIMESTAMP  | Дата создания записи                            |

## Пример создания промокода

```sql
-- Вставить тестовый промокод
INSERT INTO promo_codes (
  code,
  is_active,
  start_date,
  end_date,
  max_uses_total,
  duration_days,
  target_plan_id
) VALUES (
  'WELCOME2024',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP + INTERVAL '30 days',
  100,  -- Максимум 100 использований
  30,   -- Подписка на 30 дней
  2     -- ID тарифного плана (нужно заменить на реальный ID)
);
```

## API Эндпоинт

### POST /api/promo/apply

Применить промокод для текущего пользователя.

**Заголовки:**
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

**Тело запроса:**
```json
{
  "code": "WELCOME2024"
}
```

**Успешный ответ (200 OK):**
```json
{
  "success": true,
  "message": "Промокод успешно применен",
  "subscription": {
    "planId": 2,
    "planName": "Премиум",
    "features": {
      "max_boards": 50,
      "max_cards_per_board": 500,
      "can_duplicate_boards": true
    },
    "expiresAt": "2025-01-15T12:00:00.000Z",
    "durationDays": 30
  }
}
```

**Ошибки:**

- `400 Bad Request` - Некорректные данные, промокод уже использован, истек срок действия
- `404 Not Found` - Промокод не найден
- `401 Unauthorized` - Отсутствует токен авторизации
- `500 Internal Server Error` - Ошибка сервера

## Безопасность

- Все операции выполняются в транзакции PostgreSQL
- Используется блокировка строк (`FOR UPDATE`) для предотвращения race conditions
- Промокод может быть использован пользователем только один раз
- Автоматический откат транзакции при любой ошибке
