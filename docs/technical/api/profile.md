# Profile API

API для управления профилем пользователя.

## Содержание
- [GET /api/profile](#get-apiprofile) - Получение данных профиля
- [PUT /api/profile](#put-apiprofile) - Обновление профиля

---

## GET /api/profile

**Описание:** Получение данных профиля текущего пользователя

**Авторизация:** Требуется JWT токен

**Метод:** GET

**URL:** `/api/profile`

См. [api-endpoints.md](../backend/api-endpoints.md#get-apiprofile) для полного описания.

---

## PUT /api/profile

**Описание:** Обновление данных профиля текущего пользователя

**Авторизация:** Требуется JWT токен

**Метод:** PUT

**URL:** `/api/profile`

### Request Body

```json
{
  // Учетные данные
  "username": string (optional),
  "email": string (optional),
  "currentPassword": string (required if changing password),
  "newPassword": string (optional),

  // Персональная информация
  "country": string (optional),
  "city": string (optional),
  "office": string (optional),
  "personal_id": string (optional),
  "phone": string (optional),
  "full_name": string (optional),

  // Социальные сети
  "telegram_user": string (optional),
  "telegram_channel": string (optional),
  "vk_profile": string (optional),
  "ok_profile": string (optional),
  "instagram_profile": string (optional),
  "whatsapp_contact": string (optional),
  "website": string (optional),

  // UI Preferences
  "ui_preferences": {
    "animationColor": string (optional),
    "isAnimationEnabled": boolean (optional),
    "lineColor": string (optional),
    "lineThickness": number (1-20, optional),
    "backgroundGradient": string (optional)
  } (optional)
}
```

### Валидация полей

#### office
- **Формат:** 3 английские буквы + 2-3 цифры (например: `RUY68`)
- **Когда проверяется:** ТОЛЬКО если пользователь ИЗМЕНЯЕТ значение
- **Пример валидных значений:** `RUY68`, `ABC12`, `XYZ123`

#### personal_id
- **Формат:** Должен начинаться с `office` и содержать 9 цифр (например: `RUY68000000000`)
- **Когда проверяется:** ТОЛЬКО если пользователь ИЗМЕНЯЕТ значение
- **Зависимость:** Валидируется с учетом текущего или нового значения `office`
- **Пример валидных значений:** `RUY68000000001`, `ABC12000000099`

#### ui_preferences
- **Поля:**
  - `animationColor` - цвет анимации (строка, HEX формат)
  - `isAnimationEnabled` - включена ли анимация (boolean)
  - `lineColor` - цвет линий (строка, HEX формат)
  - `lineThickness` - толщина линий (number, 1-20)
  - `backgroundGradient` - цвет фона (строка, HEX формат)
- **Валидация:** НЕ требует валидации `office` или `personal_id`
- **Обработка:** Разрешенные поля объединяются с существующими настройками

### Логика валидации (важно!) 🆕

**До исправления (баг):**
```javascript
// НЕПРАВИЛЬНО: Валидация запускалась даже при обновлении только UI preferences
if (targetPersonalId) {  // targetPersonalId всегда = currentPersonalId || normalizedPersonalId
  validatePersonalId(...)  // Валидация срабатывала всегда!
}
```

**После исправления:**
```javascript
// ПРАВИЛЬНО: Валидация запускается ТОЛЬКО если пользователь ИЗМЕНЯЕТ значение
if (normalizedPersonalId && normalizedPersonalId !== currentPersonalId) {
  validatePersonalId(...)  // Валидация только при изменении!
}
```

**Примеры:**

1. **Обновление UI preferences** - валидация НЕ запускается:
```json
PUT /api/profile
{
  "ui_preferences": {
    "lineColor": "#ff0000"
  }
}
→ 200 OK (без валидации office/personal_id)
```

2. **Обновление personal_id с невалидным значением** - валидация запускается:
```json
PUT /api/profile
{
  "personal_id": "INVALID"
}
→ 400 Bad Request
{
  "error": "Компьютерный номер должен начинаться с представительства и содержать 9 цифр",
  "field": "personal_id"
}
```

3. **Обновление personal_id на то же значение** - валидация НЕ запускается:
```json
PUT /api/profile
{
  "personal_id": "RUY68000000001"  // Уже в БД
}
→ 200 OK (без валидации, т.к. значение не изменилось)
```

### Верификация пользователя

**Отзыв верификации:**
Верификация (`is_verified`) отзывается, если изменяются критические поля:
- `personal_id`
- `office`

**Логика:**
```javascript
if (normalizedPersonalId && normalizedPersonalId !== currentPersonalId) {
  verificationRevoked = true;
}
if (normalizedOffice && normalizedOffice !== currentOffice) {
  verificationRevoked = true;
}

if (verificationRevoked && user.is_verified) {
  // Установить is_verified = FALSE и verified_at = NULL
}
```

**Примечание:** Обновление UI preferences, социальных сетей и других некритических полей НЕ влияет на верификацию.

### Response Schema

```json
{
  "user": {
    // Полная информация о пользователе (см. GET /api/profile)
  }
}
```

### Коды ответов

- `200 OK` - Профиль успешно обновлен
- `400 Bad Request` - Ошибка валидации полей
  - Невалидный формат `office`
  - Невалидный формат `personal_id`
  - Некорректные данные
- `401 Unauthorized` - Отсутствует или невалидный JWT токен
- `403 Forbidden` - Неверный текущий пароль (при смене пароля)
- `404 Not Found` - Пользователь не найден
- `409 Conflict` - Email или username уже используется
- `500 Internal Server Error` - Ошибка сервера

### Примеры использования

#### Обновление UI preferences
```javascript
const response = await fetch('/api/profile', {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    ui_preferences: {
      lineColor: '#ff0000',
      lineThickness: 10
    }
  })
});

// → 200 OK (валидация office/personal_id НЕ запускается)
```

#### Обновление personal_id
```javascript
const response = await fetch('/api/profile', {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    personal_id: 'RUY68000000001'
  })
});

// → 200 OK или 400 Bad Request (валидация запускается, т.к. значение изменилось)
```

#### Обновление office и personal_id одновременно
```javascript
const response = await fetch('/api/profile', {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    office: 'ABC12',
    personal_id: 'ABC12000000001'
  })
});

// → 200 OK (валидация personal_id учитывает новое значение office)
// → is_verified будет сброшено, т.к. изменились критические поля
```

### История изменений

#### 2026-01-10: Исправлена валидация при обновлении UI preferences
**Проблема:**
- Валидация `personal_id` и `office` срабатывала даже при обновлении только `ui_preferences`
- Условие `if (targetPersonalId)` проверяло наличие значения в БД, а не изменение пользователем
- Результат: `PUT /api/profile {ui_preferences: {lineColor: '#ff0000'}}` → 400 "Компьютерный номер..."

**Решение:**
- Изменена логика валидации: проверяется не наличие значения, а **изменение** пользователем
- `office`: валидация ТОЛЬКО если `normalizedOffice && normalizedOffice !== currentOffice`
- `personal_id`: валидация ТОЛЬКО если `normalizedPersonalId && normalizedPersonalId !== currentPersonalId`

**Результат:**
- `PUT {ui_preferences: {...}}` → 200 OK без валидации
- `PUT {personal_id: 'INVALID'}` → 400 Bad Request (валидация запускается)
- Сохранена обратная совместимость

**Commit:** `fix(api): skip personalId validation for UI preferences updates`

---

## См. также

- [Backend API Endpoints](../backend/api-endpoints.md)
- [Authentication](../backend/api-endpoints.md#post-apilogin)
- [Verification System](../backend/verification.md)
