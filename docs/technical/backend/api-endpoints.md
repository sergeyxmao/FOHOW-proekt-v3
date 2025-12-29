# API Endpoints

> Документация backend API endpoints

## Аутентификация

Все защищенные endpoints требуют JWT токен в заголовке:
```
Authorization: Bearer <token>
```

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
    "avatar_url": "https://example.com/avatar.jpg",
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

### Связанные файлы

- `api/server.js:743` - реализация endpoint
- `src/composables/useUserSocial.js` - frontend composable для управления социальными сетями
- `src/stores/auth.js` - store авторизации

### История изменений

- **2024-12-29**: Добавлено поле `website` в response schema
- **2024-12**: Создан endpoint для получения профиля пользователя
