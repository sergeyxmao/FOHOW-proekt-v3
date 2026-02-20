# Управление пользователями (Admin)

## Обзор

Административные функции управления пользователями: удаление, блокировка/разблокировка, сброс пароля.

## API эндпоинты

### DELETE /api/admin/users/:userId — Удаление пользователя

**Авторизация:** Bearer Token + Admin role

**Body:** `{ "confirm": true }`

**Каскадный порядок удаления:**

| Шаг | Таблица | Условие |
|-----|---------|---------|
| 1 | notes | board_id IN (boards WHERE owner_id) |
| 2 | stickers | board_id IN (boards WHERE owner_id) |
| 3 | board_anchors | board_id IN (boards WHERE owner_id) |
| 4 | user_comments | board_id IN (boards WHERE owner_id) |
| 5 | boards | owner_id = userId |
| 6 | board_folders | owner_id = userId |
| 7 | favorites | user_id = userId |
| 8 | image_favorites | user_id = userId |
| 9 | image_library | user_id = userId |
| 10 | subscription_history | user_id = userId |
| 11 | promo_code_usages | user_id = userId |
| 12 | active_sessions | user_id = userId |
| 13 | telegram_link_codes | user_id = userId |
| 14 | demo_trials | user_id = userId |
| 15 | user_verifications | user_id = userId |
| 16 | image_rename_audit | user_id = userId |
| 17 | verified_emails | email = user.email |
| 18 | email_verification_codes | email = user.email |
| 19 | password_resets | email = user.email |
| 20 | fogrup_notifications | user_id OR from_user_id |
| 21 | fogrup_chat_participants | user_id = userId |
| 22 | users | id = userId |

Каждый DELETE обёрнут в try-catch — если таблица не существует (`42P01`), ошибка игнорируется. Все операции в одной транзакции.

**Защита:** нельзя удалить собственный аккаунт.

---

### POST /api/admin/users/:userId/block — Блокировка пользователя

**Авторизация:** Bearer Token + Admin role

**Body:** `{ "reason": "Текст причины (опционально)" }`

**Логика:**
1. Проверяет, что userId ≠ текущий админ
2. Проверяет, что пользователь существует и не заблокирован
3. Генерирует 6-значный код разблокировки
4. Устанавливает: `is_blocked = true`, `block_code`, `blocked_at`, `blocked_reason`
5. Завершает все активные сессии пользователя
6. Возвращает код разблокировки

**Ответ:** `{ success: true, block_code: "123456", message: "..." }`

---

### POST /api/admin/users/:userId/unblock — Разблокировка (admin)

**Авторизация:** Bearer Token + Admin role

**Логика:** Сбрасывает `is_blocked`, `block_code`, `blocked_at`, `blocked_reason` в NULL.

**Ответ:** `{ success: true, message: "..." }`

---

### POST /api/unblock — Разблокировка по коду (пользователь)

**Авторизация:** Без аутентификации

**Body:** `{ "email": "user@example.com", "code": "123456" }`

**Rate limit:** 5 попыток / 15 минут

**Логика:**
1. Находит пользователя по email
2. Проверяет `is_blocked = true`
3. Сравнивает `block_code` с введённым кодом
4. При совпадении — разблокирует аккаунт
5. При несовпадении — возвращает 400

**Ответ:** `{ success: true, message: "Аккаунт разблокирован. Теперь вы можете войти." }`

---

### POST /api/admin/users/:userId/reset-password — Сброс пароля

**Авторизация:** Bearer Token + Admin role

**Логика:**
1. Проверяет, что userId ≠ текущий админ
2. Генерирует случайный пароль (10 символов, без спутывающих символов: `ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789`)
3. Хеширует через bcrypt (10 раундов)
4. Обновляет `password` и `admin_temp_password` (открытый текст для отображения админу)
5. Завершает все активные сессии

**Ответ:** `{ success: true, tempPassword: "xK7mNp2qRs", message: "..." }`

**Очистка:** Когда пользователь сам меняет пароль через профиль (`PUT /api/profile`), поле `admin_temp_password` автоматически очищается (устанавливается в NULL).

---

## Проверка блокировки при логине

**Файл:** `api/routes/auth.js`, эндпоинт `POST /api/login`

После проверки пароля и перед проверкой `email_verified` добавлена проверка:

```javascript
if (user.is_blocked) {
  return reply.code(403).send({
    error: 'Ваш аккаунт временно заблокирован...',
    blocked: true,
    email: email
  });
}
```

Фронтенд обрабатывает ответ с `blocked: true` — показывает форму ввода кода разблокировки.

### Проверка блокировки в authenticateToken middleware

**Файл:** `api/middleware/auth.js`

Проверка `is_blocked` добавлена непосредственно в middleware аутентификации. Это значит, что заблокированный пользователь не сможет выполнить **ни один** API-запрос, даже если у него есть валидный JWT-токен.

При блокировке возвращается 403 с `blocked: true`. Глобальный перехватчик fetch (`src/utils/apiFetch.js`) отлавливает этот ответ и генерирует событие `session_forced_logout` с причиной `account_blocked`, что вызывает:
1. Автосохранение несохранённых изменений
2. Принудительный logout
3. Показ модального окна "Аккаунт заблокирован"

### Очистка admin_temp_password

Временный пароль (установленный при сбросе) очищается автоматически при смене пароля пользователем:
- Через профиль (`PUT /api/profile`) — `admin_temp_password = NULL` в UPDATE-запросе
- Через восстановление пароля (`POST /api/reset-password`) — `admin_temp_password = NULL` при обновлении пароля

---

## Поля в таблице users

| Поле | Тип | Описание |
|------|-----|----------|
| is_blocked | BOOLEAN | Статус блокировки |
| block_code | VARCHAR(6) | 6-значный код разблокировки |
| blocked_at | TIMESTAMP | Дата/время блокировки |
| blocked_reason | TEXT | Причина блокировки (заметка админа) |
| admin_temp_password | VARCHAR(20) | Временный пароль (открытый текст, для отображения админу) |

---

## Frontend

### Админ-панель (AdminUsers.vue)

В деталях пользователя отображаются:
- Статус блокировки (красный фон)
- Причина блокировки
- Код разблокировки (моноширинный шрифт, синий цвет)
- Дата блокировки
- Временный пароль (жёлтый фон)

Кнопки действий:
- **Сбросить пароль** — генерирует временный пароль
- **Заблокировать** / **Разблокировать** — переключение состояния
- **Завершить сессии**
- **Удалить пользователя**

### Форма входа (LoginForm.vue)

При получении `blocked: true` от `/api/login`:
1. Показывается форма разблокировки
2. Пользователь вводит 6-значный код
3. POST `/api/unblock` с email и кодом
4. При успехе — возврат к форме входа через 2 секунды

---

## Затронутые файлы

| Файл | Изменения |
|------|-----------|
| `api/routes/admin/users.js` | Каскадный DELETE, block/unblock/reset-password, новые поля в GET details |
| `api/routes/auth.js` | Проверка is_blocked при логине, POST /api/unblock |
| `api/routes/profile.js` | Очистка admin_temp_password при смене пароля |
| `src/components/Admin/AdminUsers.vue` | Инфо-строки, кнопки, модалка блокировки |
| `src/stores/admin.js` | Методы blockUser, unblockUser, resetUserPassword |
| `src/components/LoginForm.vue` | Форма разблокировки по коду |
| `src/stores/auth.js` | Проброс флага blocked через ошибку |
| `api/middleware/auth.js` | Проверка is_blocked в middleware аутентификации |
| `src/utils/apiFetch.js` | Обработка 403 blocked в глобальном перехватчике fetch |
| `src/components/Common/SessionExpiredModal.vue` | Поддержка причины account_blocked |

---

## История изменений

- **2026-02-20** — Создание документа. Реализация каскадного удаления, блокировки/разблокировки, сброса пароля.
