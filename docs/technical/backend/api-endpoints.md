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
