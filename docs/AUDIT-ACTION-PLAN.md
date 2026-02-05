# План действий по результатам аудита FOHOW Interactive Board

## Дата: 05.02.2026

---

## Фаза 1: Критичные исправления безопасности

> Приоритет: **НЕМЕДЛЕННО** — уязвимости, которые могут привести к компрометации данных.

### 1.1 Убрать хардкодированный JWT secret fallback

**Файл**: `api/socket.js:4`

**Текущий код**:
```js
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
```

**Исправление**: Убрать fallback. Если `JWT_SECRET` не задан — бросать ошибку при старте.

```js
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}
```

---

### 1.2 Исправить SQL-инъекцию в checkUsageLimit

**Файл**: `api/middleware/checkUsageLimit.js:32`

**Текущий код**:
```js
`SELECT sp.features->'${limitFeatureName}' as limit, ...`
```

**Исправление**: Использовать whitelist допустимых значений:

```js
const ALLOWED_FEATURES = ['max_boards', 'max_stickers', 'max_notes', 'max_comments', 'max_licenses'];
if (!ALLOWED_FEATURES.includes(limitFeatureName)) {
  return reply.code(400).send({ error: 'Invalid feature name' });
}
```

---

### 1.3 Исправить SQL-инъекцию в admin routes

**Файлы**: `api/routes/admin/stats.js:91`, `api/routes/admin/users.js:36`

**Проблема**: Динамическое построение `whereClause` через конкатенацию строк.

**Исправление**: Переписать с использованием параметризованных запросов:
```js
const conditions = [];
const values = [];
if (filter.role) {
  values.push(filter.role);
  conditions.push(`u.role = $${values.length}`);
}
const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
```

---

### 1.4 Унифицировать JWT payload field

**Файлы**: `api/middleware/auth.js:21` (использует `decoded.userId`), `api/socket.js:24` (использует `decoded.id`)

**Исправление**: Привести к единому полю. Проверить, какое поле используется при генерации токена в `auth.js`, и использовать его везде.

---

## Фаза 2: Исправления багов

> Приоритет: **В ТЕЧЕНИЕ 1-2 ДНЕЙ**

### 2.1 Исправить расписание cron-задач

**Файл**: `api/cron/tasks.js:758,766`

**Проблема**: Задачи `sendExpirationNotifications` и `processExpiredSubscriptions` обе запланированы на `0 9 * * *`.

**Исправление**: Перенести `processExpiredSubscriptions` на `0 1 * * *` как указано в комментарии.

---

### 2.2 Исправить баг guestPlanId

**Файл**: `api/cron/tasks.js:557`

**Проблема**: Переменная `guestPlanId` не определена; должно быть `guestPlan.id`.

**Исправление**: Заменить `guestPlanId` на `guestPlan.id`.

---

### 2.3 Исправить URL в Telegram-шаблонах

**Файл**: `api/templates/telegramTemplates.js`

| Строка | Текущий URL | Исправленный URL |
|--------|------------|-----------------|
| 119 | `https://fohow.ru/dashboard` | `https://interactive.marketingfohow.ru/boards` |
| 162 | `https://fohow.ru/tutorials` | Удалить или заменить на актуальный URL |
| 166 | `https://t.me/fohow_support` | `https://t.me/FOHOWadmin` (используется везде в остальных местах) |

---

### 2.4 Исправить yandexDiskService

**Файл**: `api/services/yandexDiskService.js`

- **Строка 444**: `checkPathExists` — `response.ok` не существует, `makeYandexDiskRequest` возвращает parsed JSON. Заменить на проверку, что ответ получен (не null).
- **Строка 464-469**: `listFolderContents` — аналогичная проблема. Использовать результат `makeYandexDiskRequest` напрямую.

---

### 2.5 Дополнить .env.example

**Файл**: `api/.env.example`

Добавить отсутствующие переменные:
```
# Яндекс.Диск
YANDEX_DISK_TOKEN=your_yandex_disk_oauth_token
YANDEX_DISK_BASE_DIR=/fohow-interactive

# Redis (если используется)
REDIS_URL=redis://localhost:6379
```

---

## Фаза 3: Безопасность

> Приоритет: **В ТЕЧЕНИЕ 1 НЕДЕЛИ**

### 3.1 Добавить rate limiting

Установить `@fastify/rate-limit` и применить к:

| Эндпоинт | Лимит |
|----------|-------|
| `POST /api/login` | 5 запросов / 15 мин на IP |
| `POST /api/register` | 3 запроса / 15 мин на IP |
| `POST /api/verification-code` | 3 запроса / 5 мин на email |
| `POST /api/resend-verification-code` | 3 запроса / 5 мин на email |
| `POST /api/forgot-password` | 3 запроса / 15 мин на email |
| `POST /api/verify-email` | 5 запросов / 5 мин на email |

---

### 3.2 Ограничить CORS

**Файл**: `api/server.js:75`

```js
// Вместо
app.register(cors, { origin: true });

// Использовать
app.register(cors, {
  origin: [
    'https://interactive.marketingfohow.ru',
    'https://1508.marketingfohow.ru',
    process.env.NODE_ENV === 'development' ? 'http://localhost:5173' : null
  ].filter(Boolean),
  credentials: true
});
```

---

### 3.3 Валидация MIME-типа при загрузке

В `api/routes/images/myLibrary.js` и `api/routes/admin/images.js`:

```js
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
  return reply.code(400).send({ error: 'Недопустимый формат файла' });
}
```

---

### 3.4 Удалить тестовый эндпоинт

**Файл**: `api/routes/auth.js:111`

Удалить `GET /api/test-auth` — не должен существовать в production.

---

### 3.5 Не экспортировать секретный токен

**Файл**: `api/services/yandexDiskService.js:501`

Убрать `YANDEX_DISK_TOKEN` из экспорта. Токен не должен быть доступен за пределами модуля.

---

## Фаза 4: Стабильность и надёжность

> Приоритет: **В ТЕЧЕНИЕ 2 НЕДЕЛЬ**

### 4.1 Защита cron-задач от параллельного запуска

Использовать PostgreSQL advisory locks:

```js
async function withAdvisoryLock(lockId, fn) {
  const client = await pool.connect();
  try {
    const { rows } = await client.query('SELECT pg_try_advisory_lock($1)', [lockId]);
    if (!rows[0].pg_try_advisory_lock) {
      console.log(`[CRON] Lock ${lockId} занят, пропускаем`);
      return;
    }
    await fn(client);
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [lockId]);
    client.release();
  }
}
```

---

### 4.2 Retry-логика для Telegram-сервиса

В `api/utils/telegramService.js` добавить экспоненциальный retry:

```js
async function withRetry(fn, maxRetries = 3, baseDelay = 1000) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}
```

---

### 4.3 Добавить cron для очистки telegram_link_codes

В `api/cron/tasks.js`:

```js
cron.schedule('0 * * * *', async () => {
  try {
    await pool.query('DELETE FROM telegram_link_codes WHERE expires_at < NOW() OR used = true');
  } catch (error) {
    console.error('Ошибка очистки telegram_link_codes:', error);
  }
});
```

---

### 4.4 Проверить CASCADE DELETE

Выполнить SQL-запрос для проверки:
```sql
SELECT
  tc.table_name AS child_table,
  kcu.column_name AS child_column,
  ccu.table_name AS parent_table,
  ccu.column_name AS parent_column,
  rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY child_table;
```

Если `delete_rule` = `NO ACTION` для таблиц `cards`, `stickers`, `notes`, `connections` — добавить миграцию с `ON DELETE CASCADE`.

---

### 4.5 Заменить SELECT * на конкретные поля

| Файл | Строка | Рекомендация |
|------|--------|-------------|
| `api/routes/profile.js:141` | `SELECT * FROM users WHERE id = $1` | Указать нужные поля |
| `api/routes/boards.js:117` | `SELECT * FROM boards WHERE id = $1` | Указать нужные поля |
| `api/routes/auth.js:254` | `SELECT * FROM users WHERE email = $1` | Исключить password из выборки |
| `api/routes/users.js:14` | `SELECT * FROM users WHERE id = $1` | Указать нужные поля |

---

## Фаза 5: Фронтенд улучшения

> Приоритет: **В ТЕЧЕНИЕ 1 МЕСЯЦА**

### 5.1 Добавить обработку 404

В `src/router/index.js`:

```js
{
  path: '/:pathMatch(.*)*',
  name: 'not-found',
  component: () => import('../views/NotFound.vue')
}
```

---

### 5.2 Внедрить lazy loading

```js
const routes = [
  {
    path: '/',
    name: 'home',
    component: HomeView,  // Главная — без lazy loading
  },
  {
    path: '/boards',
    name: 'boards',
    component: () => import('../components/Board/BoardsList.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/admin',
    name: 'admin',
    component: () => import('../views/AdminPanel.vue'),
    meta: { requiresAuth: true, requiresAdmin: true }
  },
  // ...
]
```

---

### 5.3 Убрать отладочные логи

Удалить `console.log` из:
- `src/router/index.js:55,71,76,81`
- Все отладочные `console.log` в stores и composables

---

### 5.4 Удалить файл-пример

Удалить `src/stores/drawing.usage.example.js` — это файл с примерами использования, не нужен в production.

---

## Фаза 6: Рефакторинг (backlog)

> Приоритет: **Планировать в спринты**

### 6.1 Разбиение крупных файлов

| Файл | Строки | Действие |
|------|--------|---------|
| `UserProfile.vue` | 4 223 | Разбить на: ProfileInfo, ProfileSecurity, ProfileTelegram, ProfileSubscription, ProfileAvatar |
| `CanvasBoard.vue` | 3 552 | Вынести логику в composables: useCanvasEvents, useCanvasMenu, useCanvasKeyboard |
| `useProjectActions.js` | 2 043 | Разбить на: useProjectExport, useProjectBoard, useProjectCards, useProjectStickers |
| `PencilOverlay.vue` | 2 239 | Разбить на sub-компоненты инструментов |
| `admin/images.js` | 1 620 | Разбить на: imageUpload, imageModeration, imageManagement |
| `admin.js` (store) | 1 210 | Разбить на: adminUsers, adminVerification, adminImages |

### 6.2 Унификация route-стиля

Привести все route-функции к единому стилю:
```js
// Единый стиль:
export function registerXxxRoutes(app) { ... }

// Вместо:
export function registerFavoriteRoutes(app, pool, authenticateToken) { ... }
```

### 6.3 Утилитарный модуль

Создать `api/utils/formatUtils.js` и вынести:
- `getDaysWord()` (дублируется в 3 файлах)
- `formatDate()` (дублируется в шаблонах)

### 6.4 Документация

- Создать OpenAPI/Swagger спецификацию
- Документировать все крон-задачи
- Создать ER-диаграмму базы данных
- Добавить CONTRIBUTING.md
- Документировать Yandex.Disk интеграцию

---

## Чеклист для проверки (SQL-запросы)

Следующие запросы нужно выполнить на продакшн/стейджинг БД для завершения аудита:

```sql
-- 1. Проверить индексы
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- 2. Проверить CASCADE правила
SELECT tc.table_name, kcu.column_name, ccu.table_name as ref_table, rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public';

-- 3. Проверить таблицу subscription_plans
SELECT id, code, name, price, features FROM subscription_plans ORDER BY id;

-- 4. Проверить неиспользуемые telegram_link_codes
SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE used = true) as used,
       COUNT(*) FILTER (WHERE expires_at < NOW()) as expired
FROM telegram_link_codes;

-- 5. Размер таблиц
SELECT relname, pg_size_pretty(pg_total_relation_size(relid))
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(relid) DESC;
```

---

## Резюме по фазам

| Фаза | Описание | Задач | Приоритет |
|------|---------|-------|-----------|
| 1 | Критичные исправления безопасности | 4 | Немедленно |
| 2 | Исправления багов | 5 | 1-2 дня |
| 3 | Безопасность | 5 | 1 неделя |
| 4 | Стабильность и надёжность | 5 | 2 недели |
| 5 | Фронтенд улучшения | 4 | 1 месяц |
| 6 | Рефакторинг | 4 | Backlog |
