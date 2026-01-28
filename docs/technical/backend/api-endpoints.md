# API Endpoints

> Документация backend API endpoints

## Аутентификация

Все защищенные endpoints требуют JWT токен в заголовке:
```
Authorization: Bearer <token>
```

---

## POST /api/register

**Описание:** Регистрация нового пользователя

**Авторизация:** Не требуется

**Метод:** POST

**URL:** `/api/register`

### Request Body

```json
{
  "email": "user@example.com",
  "password": "password123",
  "verificationCode": "1234",
  "verificationToken": "token-abc-123"
}
```

**Поля:**
- `email` (string, required) - Email пользователя
- `password` (string, required) - Пароль (минимум 6 символов)
- `verificationCode` (string, optional) - Проверочный код (антибот)
- `verificationToken` (string, optional) - Токен проверочного кода

### Response Schema

#### Успешная регистрация (новый пользователь)

**Код ответа:** `200 OK`

```json
{
  "success": true,
  "message": "Вы зарегистрировались. Войдите под своими данными.",
  "requiresLogin": true
}
```

#### Успешная регистрация (повторная регистрация с неверифицированным email)

**Код ответа:** `200 OK`

```json
{
  "success": true,
  "message": "Вы зарегистрировались. Войдите под своими данными.",
  "requiresLogin": true
}
```

**Примечание:** Если пользователь с таким email уже существует, но его email НЕ верифицирован, система разрешает обновить пароль и повторно зарегистрироваться.

### Коды ошибок

#### 400 Bad Request - Отсутствуют обязательные поля

```json
{
  "error": "Email и пароль обязательны"
}
```

#### 400 Bad Request - Email уже существует

```json
{
  "error": "Данный аккаунт уже есть в системе. Войдите в него или, если вы забыли пароль, нажмите \"Восстановить пароль\".",
  "field": "email",
  "accountExists": true
}
```

**Условия:**
- Email существует в таблице `verified_emails` (постоянное хранилище)
- ИЛИ пользователь с таким email существует И его `email_verified = true`

#### 500 Internal Server Error

```json
{
  "error": "Ошибка сервера"
}
```

### Поведение

1. **Проверка в `verified_emails`:**
   - Если email найден в постоянном хранилище → ошибка 400 (аккаунт уже существует)

2. **Проверка в `users`:**
   - Если пользователь НЕ найден → создать нового пользователя
   - Если найден И `email_verified = true` → ошибка 400 (аккаунт уже существует)
   - Если найден И `email_verified = false` → обновить пароль пользователя

3. **Создание пользователя:**
   - `email_verified` устанавливается в `FALSE`
   - `plan_id` устанавливается в `NULL` (тариф будет назначен после верификации email)
   - `search_settings` устанавливаются в значения по умолчанию (все поля скрыты)

4. **Ответ клиенту:**
   - `{ success: true, requiresLogin: true }`
   - Клиент должен перенаправить пользователя на форму входа

### Примечания

- После регистрации пользователь **НЕ получает JWT токен**
- Для завершения регистрации пользователь должен **войти** под своими данными
- При попытке входа с неверифицированным email система:
  1. Генерирует 6-значный код
  2. Отправляет код на email
  3. Возвращает `{ requiresVerification: true }`
  4. Клиент перенаправляет на страницу `/verify-email`
- Повторный вызов `POST /api/verify-email` идемпотентен: повторная проверка не создаёт второй демо-тариф и не изменяет персональный номер пользователя.

### Связанные endpoints

- `POST /api/login` - Вход в систему
- `POST /api/verify-email` - Подтверждение email и активация аккаунта
- `POST /api/resend-verification-code` - Повторная отправка кода

### Связанные файлы

- `api/routes/auth.js:122` - реализация endpoint
- `src/stores/auth.js` - frontend store (метод `register()`)
- `src/components/RegisterForm.vue` - компонент регистрации

### История изменений

- **2026-01-02**: Добавлена документация для роута `/api/register`
- **2024-12**: Создан endpoint регистрации с проверкой на дубликаты

---

## POST /api/login

**Описание:** Вход пользователя в систему

**Авторизация:** Не требуется

**Метод:** POST

**URL:** `/api/login`

### Request Body

```json
{
  "email": "user@example.com",
  "password": "password123",
  "verificationCode": "1234",
  "verificationToken": "token-abc-123"
}
```

**Поля:**
- `email` (string, required) - Email пользователя
- `password` (string, required) - Пароль
- `verificationCode` (string, optional) - Проверочный код (антибот)
- `verificationToken` (string, optional) - Токен проверочного кода

### Response Schema

#### Успешный вход (email верифицирован, есть тариф)

**Код ответа:** `200 OK`

```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 76,
    "email": "user@example.com",
    "email_verified": true,
    "plan_id": 1,
    "role": "user",
    ...
  }
}
```

#### Успешный вход (email верифицирован, нет тарифа)

**Код ответа:** `200 OK`

**Примечание:** Начиная с 2026-01-02, система корректно обрабатывает пользователей без назначенного тарифа (`plan_id = NULL`). Проверка лимита сессий пропускается.

```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 76,
    "email": "user@example.com",
    "email_verified": true,
    "plan_id": null,
    "role": "user",
    ...
  }
}
```

#### Email не верифицирован (требуется верификация)

**Код ответа:** `200 OK`

```json
{
  "requiresVerification": true,
  "email": "user@example.com",
  "message": "На ваш email отправлен код подтверждения. Введите его для завершения входа."
}
```

**Поведение:**
- Backend генерирует 6-значный код
- Сохраняет код в таблице `email_verification_codes`
- Отправляет код на email через сервис email
- Клиент должен перенаправить пользователя на страницу `/verify-email`

### Коды ошибок

#### 400 Bad Request - Отсутствуют обязательные поля

```json
{
  "error": "Email и пароль обязательны"
}
```

#### 401 Unauthorized - Неверные credentials

```json
{
  "error": "Неверный email или пароль"
}
```

#### 500 Internal Server Error

```json
{
  "error": "Ошибка сервера. Попробуйте позже"
}
```

В режиме разработки (`NODE_ENV=development`) возвращается детальное сообщение:

```json
{
  "error": "Ошибка сервера: <детальное описание>"
}
```

### Поведение

1. **Проверка пользователя:**
   - Поиск в БД по email
   - Если не найден → ошибка 401

2. **Проверка пароля:**
   - Сравнение bcrypt хэша
   - Если не совпадает → ошибка 401

3. **Проверка email_verified:**
   - Если `false` → генерация и отправка кода, возврат `{ requiresVerification: true }`
   - Если `true` → продолжение с шага 4

4. **Проверка тарифа и управление сессиями:**
   - **Если `plan_id = NULL`:**
     - Лог: `"У пользователя нет тарифа (plan_id = NULL). Пропускаем проверку лимита сессий."`
     - Проверка лимита сессий пропускается
     - Создаётся новая сессия без удаления старых
   - **Если `plan_id != NULL`:**
     - Загрузка `session_limit` из таблицы `subscription_plans`
     - Если лимит установлен и не админ → проверка количества активных сессий
     - Если превышен → удаление самой старой сессии

5. **Создание токена:**
   - Генерация JWT токена с полями: `userId`, `email`, `role`
   - Срок действия: 7 дней

6. **Создание сессии:**
   - Вставка записи в таблицу `active_sessions`
   - Сохранение: `user_id`, `token_signature`, `ip_address`, `user_agent`, `expires_at`

### Примечания

- При входе проверяется лимит сессий только для пользователей с назначенным тарифом
- Администраторы (`role = 'admin'`) освобождены от лимита сессий
- Старая сессия удаляется автоматически если превышен лимит (FIFO)
- Код верификации email действителен 10 минут
- Токен JWT действителен 7 дней

### Связанные endpoints

- `POST /api/register` - Регистрация нового пользователя
- `POST /api/verify-email` - Подтверждение email и активация аккаунта
- `POST /api/resend-verification-code` - Повторная отправка кода
- `POST /api/logout` - Выход из системы

### Связанные файлы

- `api/routes/auth.js:228` - реализация endpoint
- `src/stores/auth.js` - frontend store (метод `login()`)
- `src/components/LoginForm.vue` - компонент входа

### История изменений

- **2026-01-02**: Исправлена обработка пользователей без тарифа (`plan_id = NULL`) - проверка лимита сессий пропускается, вход разрешён
- **2024-12**: Создан endpoint входа с проверкой email верификации и управлением сессиями

---

## GET /api/profile

**Описание:** Получение данных профиля текущего пользователя

**Авторизация:** Требуется JWT токен

**Метод:** GET

**URL:** `/api/profile`

### Response Schema

```json
{
  "user": {
    "id": number,
    "email": string,
    "username": string,
    "avatar_url": string | null,
    "created_at": string (ISO 8601),
    "updated_at": string (ISO 8601),

    // Персональная информация
    "country": string | null,
    "city": string | null,
    "office": string | null,
    "personal_id": string | null,
    "phone": string | null,
    "full_name": string | null,

    // Социальные сети
    "telegram_user": string | null,
    "telegram_channel": string | null,
    "vk_profile": string | null,
    "ok_profile": string | null,
    "instagram_profile": string | null,
    "whatsapp_contact": string | null,
    "website": string | null,  // URL веб-сайта пользователя

    // Настройки
    "visibility_settings": object | null,
    "search_settings": object | null,
    "ui_preferences": object | null,

    // Подписка
    "subscription_started_at": string (ISO 8601) | null,
    "subscription_expires_at": string (ISO 8601) | null,
    "grace_period_until": string (ISO 8601) | null,

    // Верификация
    "is_verified": boolean,
    "verified_at": string (ISO 8601) | null,

    // План подписки
    "plan": {
      "id": number,
      "name": string,
      "features": object
    } | null
  }
}
```

### Пример ответа

```json
{
  "user": {
    "id": 3,
    "email": "user@example.com",
    "username": "johndoe",
    "avatar_url": "/api/avatar/3?v=1704369600000",
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-12-29T14:20:00Z",
    "country": "Россия",
    "city": "Москва",
    "office": "Офис №5",
    "personal_id": "ABC123",
    "phone": "+79991234567",
    "full_name": "Иван Иванов",
    "telegram_user": "@johndoe",
    "telegram_channel": "@mychannel",
    "vk_profile": "vk.com/johndoe",
    "ok_profile": "ok.ru/johndoe",
    "instagram_profile": "@johndoe",
    "whatsapp_contact": "+79991234567",
    "website": "https://interactive.marketingfohow.ru/",
    "visibility_settings": {
      "show_phone": true,
      "show_email": false
    },
    "search_settings": {
      "allow_search": true
    },
    "ui_preferences": {
      "theme": "light"
    },
    "subscription_started_at": "2024-01-01T00:00:00Z",
    "subscription_expires_at": "2025-01-01T00:00:00Z",
    "grace_period_until": null,
    "is_verified": true,
    "verified_at": "2024-01-20T12:00:00Z",
    "plan": {
      "id": 1,
      "name": "Premium",
      "features": {
        "max_structures": 10,
        "custom_domain": true
      }
    }
  }
}
```

### Коды ответов

- `200 OK` - Успешное получение профиля
- `401 Unauthorized` - Отсутствует или невалидный JWT токен
- `404 Not Found` - Пользователь не найден
- `500 Internal Server Error` - Ошибка сервера

### Примечания

- Поле `website` было добавлено для поддержки URL веб-сайта пользователя (декабрь 2024)
- Все поля социальных сетей опциональны и могут быть `null`
- План подписки (`plan`) может быть `null` если пользователь не имеет активного плана

#### Формат avatar_url (версионирование для cache busting)

**Формат возвращаемого URL:** `/api/avatar/:userId?v=:timestamp`

**Формат хранения в БД:** `preview_url|yandexPath|timestamp`

**Описание:**
- В базе данных `avatar_url` хранится в формате: `preview_url|yandexPath|timestamp`
  - `preview_url` - публичная ссылка на Яндекс.Диск (не используется после внедрения proxy)
  - `yandexPath` - путь к файлу на Яндекс.Диске для proxy-роута
  - `timestamp` - метка времени обновления аватара (Date.now())

- Клиенту возвращается URL вида: `/api/avatar/3?v=1704369600000`
  - Параметр `?v=timestamp` обеспечивает cache busting при обновлении аватара
  - Браузер интерпретирует изменение query parameter как новый ресурс
  - Старые кэшированные версии автоматически становятся неактуальными

- Backend-роут `/api/avatar/:userId` игнорирует параметр `?v=...`
  - Параметр используется только для управления кэшем браузера
  - Backend извлекает `yandexPath` из БД и проксирует изображение с Яндекс.Диска

**Обратная совместимость:**
- Для старых записей без timestamp используется fallback на `Date.now()`
- Это обеспечивает корректную работу с данными, созданными до внедрения версионирования

**Helper-функция:**
- `api/utils/avatarUtils.js::getAvatarUrl(userId, avatarData)` - преобразует данные из БД в клиентский URL

### Связанные файлы

- `api/server.js:743` - реализация endpoint
- `src/composables/useUserSocial.js` - frontend composable для управления социальными сетями
- `src/stores/auth.js` - store авторизации

### История изменений

- **2026-01-04**: Добавлено версионирование avatar_url для решения проблемы кэширования браузера
- **2024-12-29**: Добавлено поле `website` в response schema
- **2024-12**: Создан endpoint для получения профиля пользователя

---

## GET /api/user/plan

**Описание:** Получение информации о тарифном плане пользователя и статистике использования ресурсов

**Авторизация:** Требуется JWT токен

**Метод:** GET

**URL:** `/api/user/plan`

### Response Schema

```json
{
  "user": {
    "id": number,
    "username": string,
    "email": string,
    "subscriptionStartedAt": string (ISO 8601) | null,
    "subscriptionExpiresAt": string (ISO 8601) | null,
    "gracePeriodUntil": string (ISO 8601) | null
  },
  "plan": {
    "id": number,
    "name": string,
    "code_name": string,
    "priceMonthly": number
  },
  "features": object,
  "usage": {
    "boards": {
      "current": number,
      "limit": number | -1
    },
    "notes": {
      "current": number,
      "limit": number | -1
    },
    "stickers": {
      "current": number,
      "limit": number | -1
    },
    "userComments": {
      "current": number,
      "limit": number | -1
    },
    "cards": {
      "current": number,
      "limit": number | -1
    }
  }
}
```

### Пример ответа

```json
{
  "user": {
    "id": 123,
    "username": "johndoe",
    "email": "user@example.com",
    "subscriptionStartedAt": "2024-01-01T00:00:00Z",
    "subscriptionExpiresAt": "2025-01-01T00:00:00Z",
    "gracePeriodUntil": null
  },
  "plan": {
    "id": 1,
    "name": "Demo",
    "code_name": "demo",
    "priceMonthly": 0
  },
  "features": {
    "max_boards": 3,
    "max_notes": 100,
    "max_stickers": 50,
    "max_comments": 50,
    "max_licenses": 36
  },
  "usage": {
    "boards": {
      "current": 3,
      "limit": 3
    },
    "notes": {
      "current": 45,
      "limit": 100
    },
    "stickers": {
      "current": 12,
      "limit": 50
    },
    "userComments": {
      "current": 8,
      "limit": 50
    },
    "cards": {
      "current": 8,
      "limit": 36
    }
  }
}
```

### Коды ответов

- `200 OK` - Успешное получение информации о тарифе
- `401 Unauthorized` - Отсутствует или невалидный JWT токен
- `404 Not Found` - Пользователь или тарифный план не найден
- `500 Internal Server Error` - Ошибка сервера

### Логика подсчёта ресурсов

#### boards
Общее количество досок пользователя:
```sql
SELECT COUNT(*) FROM boards WHERE owner_id = u.id
```

#### notes
Общее количество заметок на всех досках пользователя:
```sql
SELECT COUNT(*) FROM notes n JOIN boards b ON n.board_id = b.id WHERE b.owner_id = u.id
```

#### stickers
Общее количество стикеров на всех досках пользователя:
```sql
SELECT COUNT(*) FROM stickers s JOIN boards b ON s.board_id = b.id WHERE b.owner_id = u.id
```

#### userComments
Общее количество комментариев пользователя:
```sql
SELECT COUNT(*) FROM user_comments WHERE user_id = u.id
```

#### cards (лицензии и аватары)

**ВАЖНО:** Лимит `max_licenses` — это лимит **на одну доску**, а не на все доски пользователя.

Подсчёт возвращает **максимальное количество** карточек среди всех досок пользователя:
```sql
(
  SELECT COALESCE(MAX(card_count), 0)
  FROM (
    SELECT COUNT(*) as card_count
    FROM boards b,
         jsonb_array_elements(COALESCE(b.content->'objects', '[]'::jsonb)) obj
    WHERE b.owner_id = u.id
      AND obj->>'type' IN ('small', 'large', 'gold', 'avatar')
    GROUP BY b.id
  ) as board_cards
) as cards_count
```

**Учитываемые типы карточек:**
- `small` - малая лицензия
- `large` - большая лицензия
- `gold` - золотая лицензия
- `avatar` - аватар

**Пример:**
Если у пользователя 3 доски с количеством карточек: 2, 2, 8, то `usage.cards.current = 8`

### Примечания

- Значение `-1` в поле `limit` означает отсутствие ограничения
- Карточки хранятся в JSONB-поле `boards.content->objects`
- Подсчёт карточек учитывает только типы: `small`, `large`, `gold`, `avatar`
- Лимит карточек применяется к одной доске, а не ко всем доскам пользователя

### Связанные файлы

- `api/routes/plans.js:17` - реализация endpoint
- `src/stores/subscription.js` - frontend store для управления подпиской
- `src/views/ProfileView.vue` - отображение информации о тарифе в профиле

### История изменений

- **2026-01-06**: Исправлен подсчёт карточек - теперь считает из `boards.content->objects` и возвращает максимальное значение среди досок, а не сумму
- **2024-12**: Создан endpoint для получения информации о тарифном плане пользователя

---

## PATCH /api/admin/users/:userId/plan

**Описание:** Изменение тарифного плана пользователя администратором

**Авторизация:** Требуется JWT токен администратора (`role = 'admin'`)

**Метод:** PATCH

**URL:** `/api/admin/users/:userId/plan`

### Request Parameters

**URL параметры:**
- `userId` (number, required) - ID пользователя

**Body:**
```json
{
  "planId": 5,
  "duration": 30,
  "source": "admin_manual"
}
```

**Поля:**
- `planId` (number, required) - ID тарифного плана из таблицы `subscription_plans`
- `duration` (number, optional) - Длительность подписки в днях (по умолчанию: 30). **Игнорируется для тарифа "Гостевой"**
- `source` (string, optional) - Источник изменения (по умолчанию: `'admin_manual'`)

### Response Schema

#### Успешное изменение тарифа (не "Гостевой")

**Код ответа:** `200 OK`

```json
{
  "success": true,
  "message": "Тарифный план изменен на \"Демо\"",
  "user": {
    "id": 77,
    "email": "user@example.com",
    "username": "johndoe"
  },
  "plan": {
    "id": 1,
    "name": "Демо",
    "code_name": "demo"
  },
  "subscription": {
    "startDate": "2026-01-09T10:30:00.000Z",
    "endDate": "2026-02-08T10:30:00.000Z",
    "duration": 30,
    "isPermanent": false
  }
}
```

#### Успешное изменение тарифа на "Гостевой" (бесрочный)

**Код ответа:** `200 OK`

```json
{
  "success": true,
  "message": "Тарифный план изменен на \"Гостевой\"",
  "user": {
    "id": 77,
    "email": "user@example.com",
    "username": "johndoe"
  },
  "plan": {
    "id": 5,
    "name": "Гостевой",
    "code_name": "guest"
  },
  "subscription": {
    "startDate": "2026-01-09T10:30:00.000Z",
    "endDate": null,
    "duration": "unlimited",
    "isPermanent": true
  }
}
```

**Примечание:** Для тарифа "Гостевой" (`code_name = 'guest'`) поле `endDate` всегда `null` (бесрочная подписка), а параметр `duration` игнорируется.

#### Успешное изменение с разблокировкой досок

**Код ответа:** `200 OK`

```json
{
  "success": true,
  "message": "Тарифный план изменен на \"Premium\"",
  "user": { ... },
  "plan": { ... },
  "subscription": { ... },
  "boardsUnlocked": {
    "count": 5,
    "message": "Разблокировано досок: 5"
  }
}
```

**Примечание:** Если у пользователя были заблокированные доски (`boards_locked = true`), они автоматически разблокируются при смене тарифа.

### Коды ошибок

#### 400 Bad Request - Не указан planId

```json
{
  "error": "Не указан ID тарифного плана"
}
```

#### 404 Not Found - Тариф не найден

```json
{
  "error": "Тарифный план не найден"
}
```

#### 404 Not Found - Пользователь не найден

```json
{
  "error": "Пользователь не найден"
}
```

#### 401 Unauthorized - Нет JWT токена

```json
{
  "error": "Требуется авторизация"
}
```

#### 403 Forbidden - Пользователь не администратор

```json
{
  "error": "Доступ запрещен"
}
```

#### 500 Internal Server Error

```json
{
  "error": "Ошибка сервера"
}
```

### Поведение

1. **Проверка тарифного плана:**
   - Загрузка плана по `planId` из таблицы `subscription_plans`
   - Если не найден → ошибка 404

2. **Вычисление срока действия подписки:**
   - **Для тарифа "Гостевой" (`code_name = 'guest'`):**
     - `subscription_expires_at = NULL` (бесрочная подписка)
     - Параметр `duration` игнорируется
     - В логе: `"Тариф "Гостевой" - устанавливаем бесрочную подписку (subscription_expires_at = NULL)"`
   - **Для остальных тарифов (`demo`, `individual`, `premium`):**
     - `subscription_expires_at = NOW() + duration дней`
     - По умолчанию `duration = 30`
     - В логе: `"Тариф "Демо" - устанавливаем срок действия: 30 дней"`

3. **Обновление пользователя (транзакция):**
   - `UPDATE users SET plan_id, subscription_expires_at, subscription_started_at`
   - `subscription_started_at` устанавливается в текущее время

4. **Разблокировка досок (если были заблокированы):**
   - Проверка флага `boards_locked` в таблице `users`
   - Если `true`:
     - Сброс флагов: `boards_locked = FALSE`, `boards_locked_at = NULL`
     - Разблокировка всех досок: `UPDATE boards SET is_locked = FALSE WHERE owner_id = userId`
     - Подсчёт количества разблокированных досок
     - Добавление информации в ответ: `boardsUnlocked.count`

5. **Запись в историю подписок:**
   - Вставка записи в таблицу `subscription_history`
   - Для "Гостевого" тарифа: `end_date = NULL`
   - Для остальных тарифов: `end_date = NOW() + duration дней`
   - `source` = `'admin_manual'` (по умолчанию) или значение из параметра

6. **Логирование:**
   - Запись в console: `[ADMIN] Тарифный план изменен: user_id=77, plan=Гостевой, duration=бесрочно, admin_id=1`
   - Для обычных тарифов: `duration=30 дней`

### Примечания

- **ВАЖНО:** Тариф "Гостевой" всегда имеет бесрочную подписку (`subscription_expires_at = NULL`)
- При смене тарифа автоматически разблокируются доски (если были заблокированы)
- В истории подписок создаётся запись с `amount_paid = 0.00`, `currency = 'RUB'`
- Операция выполняется в транзакции для обеспечения целостности данных
- Администраторы могут менять тариф любому пользователю через админ-панель

### Связанные endpoint'ы

- `GET /api/admin/users` - Список всех пользователей
- `GET /api/admin/users/:userId` - Детальная информация о пользователе
- `GET /api/user/plan` - Получение информации о тарифе текущего пользователя

### Связанные файлы

- `api/routes/admin/users.js:210` - реализация endpoint
- `api/cron/tasks.js:487` - автоматическая смена на "Гостевой" (при истечении демо)
- `src/stores/subscription.js` - frontend store для управления подпиской
- `src/views/admin/UsersView.vue` - админ-панель управления пользователями

### История изменений

- **2026-01-09**: Исправлена логика для тарифа "Гостевой" - теперь устанавливается `subscription_expires_at = NULL` (бесрочная подписка)
- **2024-12**: Создан endpoint для изменения тарифного плана администратором
