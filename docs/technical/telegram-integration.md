# Интеграция с Telegram

Интеграция с Telegram для уведомлений и привязки аккаунта пользователя.

## Расположение файлов

| Файл | Описание |
|------|----------|
| `api/routes/telegram.js` | API маршруты для привязки/отвязки Telegram |
| `api/bot/telegramBot.js` | Telegram бот для обработки команд |
| `api/templates/telegramTemplates.js` | Шаблоны сообщений для бота |

## Как использовать

### Пошаговая инструкция привязки Telegram

1. **Пользователь в личном кабинете** нажимает "Привязать Telegram"
2. **Система генерирует код** — 6-символьный код (буквы и цифры), действителен 15 минут
3. **Пользователь открывает бота** по ссылке `t.me/{TELEGRAM_BOT_USERNAME}`
4. **Пользователь отправляет код** боту командой `/start {КОД}` или просто код
5. **Бот проверяет код** в таблице `telegram_link_codes`:
   - Код существует
   - Код не истёк (`expires_at > NOW()`)
   - Код не использован (`used = false`)
6. **При успешной проверке** бот:
   - Обновляет `users.telegram_chat_id` и `users.telegram_user`
   - Помечает код как использованный (`used = true`)
   - Отправляет подтверждение пользователю
7. **Фронтенд опрашивает** `/api/user/telegram/check-link-status` и обновляет UI

## Технические детали

### Таблица telegram_link_codes

```sql
CREATE TABLE telegram_link_codes (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  code VARCHAR(10) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

| Поле | Тип | Описание |
|------|-----|----------|
| `user_id` | INTEGER | ID пользователя, запросившего код |
| `code` | VARCHAR(10) | 6-символьный код привязки |
| `expires_at` | TIMESTAMPTZ | Время истечения срока действия |
| `used` | BOOLEAN | Флаг использования кода |

### Процесс генерации кода

```javascript
// Генерация 6-символьного кода
const code = Math.random().toString(36).substring(2, 8).toUpperCase();

// Вставка с вычислением expires_at в SQL (timezone-безопасно)
const result = await pool.query(
  `INSERT INTO telegram_link_codes (user_id, code, expires_at)
   VALUES ($1, $2, NOW() + INTERVAL '15 minutes')
   RETURNING expires_at`,
  [userId, code]
);
```

### Проверка кода в боте

```sql
SELECT user_id FROM telegram_link_codes
WHERE code = $1
  AND expires_at > NOW()
  AND used = false;
```

### Timezone-безопасность

**Важно:** Время истечения кода (`expires_at`) вычисляется **на стороне PostgreSQL** с использованием `NOW() + INTERVAL '15 minutes'`.

Это гарантирует корректную работу независимо от timezone сервера:
- PostgreSQL `NOW()` возвращает время в UTC
- Сравнение `expires_at > NOW()` в боте также использует UTC
- Нет рассинхронизации между JavaScript Date и PostgreSQL timestamp

**Неправильно (до исправления):**
```javascript
// JavaScript Date создаёт время в локальной timezone сервера
const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
// На сервере в Москве (+3) это даст время на 3 часа вперёд относительно UTC
```

**Правильно (после исправления):**
```javascript
// SQL NOW() гарантирует UTC-время
VALUES ($1, $2, NOW() + INTERVAL '15 minutes')
```

## Настройки

### Переменные окружения

| Переменная | Описание | Пример |
|------------|----------|--------|
| `TELEGRAM_BOT_TOKEN` | Токен Telegram бота от @BotFather | `123456:ABC-DEF1234...` |
| `TELEGRAM_BOT_USERNAME` | Username бота (без @) | `fohow_bot` |

### Получение токена бота

1. Откройте @BotFather в Telegram
2. Отправьте `/newbot` для создания нового бота
3. Следуйте инструкциям, выберите имя и username
4. Скопируйте полученный токен в `TELEGRAM_BOT_TOKEN`

## Связанная документация

- [API Routes: Telegram](./routes/telegram.md) — детальное описание API endpoints
- [Шаблоны Telegram](./templates/telegramTemplates.md) — шаблоны сообщений бота

## История изменений

| Дата | Изменение |
|------|-----------|
| 2025-02-02 | Исправлен timezone-баг в генерации кода: `expires_at` теперь вычисляется в SQL (`NOW() + INTERVAL`) вместо JavaScript Date |
