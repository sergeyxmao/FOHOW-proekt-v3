# Swagger / OpenAPI Documentation

## Описание

Проект использует [Swagger (OpenAPI 3.0)](https://swagger.io/specification/) для автоматической документации API. Интерактивная документация доступна через Swagger UI и защищена авторизацией — только пользователи с ролью `admin` могут просматривать её.

Используемые пакеты:
- `@fastify/swagger` — генерация OpenAPI-спецификации из JSON Schema роутов
- `@fastify/swagger-ui` — интерактивный UI для просмотра и тестирования эндпоинтов

## Как открыть Swagger UI

### URL

| Среда | URL |
|---|---|
| Production | `https://interactive.marketingfohow.ru/api/docs?token=YOUR_JWT_TOKEN` |
| Staging | `https://1508.marketingfohow.ru/api/docs?token=YOUR_JWT_TOKEN` |
| Local | `http://localhost:4000/api/docs?token=YOUR_JWT_TOKEN` |

### Авторизация

Swagger UI доступен **только администраторам**. Передайте JWT-токен одним из способов:

1. **Query-параметр** (рекомендуется для браузера):
   ```
   /api/docs?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

2. **Заголовок Authorization** (для программного доступа):
   ```
   Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

### OpenAPI JSON-спецификация

```
GET /api/docs/json?token=YOUR_JWT_TOKEN
```

Возвращает полную OpenAPI 3.0 спецификацию в формате JSON. Можно использовать для:
- Импорта в Postman
- Генерации клиентских SDK
- Интеграции с FoChat или внешними сервисами

## Расположение файлов

| Файл | Назначение |
|---|---|
| `api/server.js` | Регистрация плагинов swagger/swagger-ui, защита /api/docs, OpenAPI конфигурация (info, servers, tags, securitySchemes) |
| `api/routes/auth.js` | Schema для 8 эндпоинтов авторизации |
| `api/routes/profile.js` | Schema для 9 эндпоинтов профиля |
| `api/routes/users.js` | Schema для 6 эндпоинтов управления пользователями |

## Как добавить документацию к новому эндпоинту

Для документирования эндпоинта в Fastify достаточно добавить объект `schema` в опции роута. Шаблон:

```javascript
app.post('/api/example', {
  schema: {
    // Группировка в Swagger UI
    tags: ['TagName'],
    // Краткое описание (1 строка)
    summary: 'Краткое описание эндпоинта',
    // Подробное описание (опционально)
    description: 'Подробное описание логики, ограничений и особенностей.',
    // Для защищённых эндпоинтов
    security: [{ bearerAuth: [] }],
    // Schema тела запроса (для POST/PUT/PATCH)
    body: {
      type: 'object',
      required: ['field1'],
      properties: {
        field1: { type: 'string', description: 'Описание поля' },
        field2: { type: 'integer', nullable: true }
      }
    },
    // Schema URL-параметров (для :param в URL)
    params: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', description: 'ID ресурса' }
      }
    },
    // Schema query-строки (для ?key=value)
    querystring: {
      type: 'object',
      properties: {
        page: { type: 'integer', default: 1 },
        limit: { type: 'integer', default: 20 }
      }
    },
    // Schema ответов
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: { type: 'object' }
        }
      },
      400: {
        type: 'object',
        properties: { error: { type: 'string' } }
      },
      401: {
        type: 'object',
        properties: { error: { type: 'string' } }
      },
      500: {
        type: 'object',
        properties: { error: { type: 'string' } }
      }
    }
  },
  // Middleware (если нужны)
  preHandler: [authenticateToken]
}, async (req, reply) => {
  // Обработчик
});
```

### Доступные теги

| Тег | Описание |
|---|---|
| Auth | Регистрация, авторизация, сброс пароля |
| Profile | Профиль пользователя, аватар, приватность |
| Users | Управление пользователями, блокировка, настройки |
| Boards | Структуры (доски) |
| Board Folders | Папки для структур |
| Board Partners | Партнёры на досках |
| Stickers | Стикеры на досках |
| Notes | Заметки к карточкам |
| Comments | Комментарии пользователей |
| Anchors | Якоря на досках |
| Images | Библиотека изображений |
| Partners | Поиск и просмотр партнёров |
| Relationships | Связи между пользователями |
| Favorites | Избранные пользователи |
| Chats | Чат (FoGrup) |
| Notifications | Уведомления |
| Telegram | Привязка Telegram |
| Plans | Тарифные планы |
| Promo | Промокоды |
| Verification | Верификация пользователей |
| Tribute | Платежи Tribute |
| Admin | Админ-панель |
| System | Здоровье системы |

## Фазы внедрения

### Фаза 1 (текущая) — Auth + Profile + Users
- `api/routes/auth.js` — 8 эндпоинтов
- `api/routes/profile.js` — 9 эндпоинтов
- `api/routes/users.js` — 6 эндпоинтов
- `api/server.js` — health эндпоинт
- **Итого: 24 эндпоинта задокументированы**

### Фаза 2 (планируется) — Boards, Images, Promo и остальные
- `api/routes/boards.js` — 8 эндпоинтов
- `api/routes/boardFolders.js` — 8 эндпоинтов
- `api/routes/boardPartners.js` — 2 эндпоинта
- `api/routes/stickers.js` — 4 эндпоинта
- `api/routes/notes.js` — 2 эндпоинта
- `api/routes/comments.js` — 4 эндпоинта
- `api/routes/anchors.js` — 4 эндпоинта
- `api/routes/images/` — 10 эндпоинтов
- `api/routes/partners.js` — 2 эндпоинта
- `api/routes/relationships.js` — 4 эндпоинта
- `api/routes/favorites.js` — 3 эндпоинта
- `api/routes/chats.js` — 6 эндпоинтов
- `api/routes/notifications.js` — 2 эндпоинта
- `api/routes/telegram.js` — 4 эндпоинта
- `api/routes/plans.js` — 2 эндпоинта
- `api/routes/promo.js` — 1 эндпоинт
- `api/routes/verification.js` — 5 эндпоинтов
- `api/routes/tribute.js` — 2 эндпоинта
- `api/routes/discussion.js` — 1 эндпоинт

### Фаза 3 (планируется) — Admin
- `api/routes/admin/users.js` — 7 эндпоинтов
- `api/routes/admin/stats.js` — 3 эндпоинта
- `api/routes/admin/images.js` — 9 эндпоинтов
- `api/routes/admin/verifications.js` — 4 эндпоинта
- `api/routes/admin/exports.js` — 3 эндпоинта
- `api/routes/admin/transactions.js` — 1 эндпоинт

## Экспорт OpenAPI JSON для внешней интеграции

Для экспорта спецификации (например, для FoChat):

```bash
# Через curl с авторизацией
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  https://interactive.marketingfohow.ru/api/docs/json \
  -o openapi.json

# Или через query-параметр
curl "https://interactive.marketingfohow.ru/api/docs/json?token=YOUR_ADMIN_TOKEN" \
  -o openapi.json
```

Полученный `openapi.json` можно:
- Импортировать в **Postman** (Import → File → openapi.json)
- Использовать для генерации SDK через [OpenAPI Generator](https://openapi-generator.tech/)
- Подключить к внешним API-шлюзам

## Известные проблемы и решения

### CSP (Content Security Policy) блокирует Swagger UI

**Проблема:** `@fastify/helmet` по умолчанию запрещает inline-скрипты и стили, которые использует Swagger UI.

**Решение:** Helmet настроен с кастомной CSP, разрешающей `'unsafe-inline'` для `scriptSrc` и `styleSrc`. Это необходимо для работы Swagger UI. Настройка находится в `api/server.js` при регистрации helmet.

```javascript
await app.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https:"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      fontSrc: ["'self'", "https:", "data:"]
    }
  }
});
```

### Защита /api/docs блокирует подресурсы

**Проблема:** Хук `onRequest` для проверки admin-токена может блокировать внутренние ресурсы Swagger UI (json, static, css, js), из-за чего UI не загружается.

**Решение:** Хук защищает **только** корневой путь `/api/docs` (без подпутей). Все подресурсы (`/api/docs/json`, `/api/docs/static/*`, и т.д.) пропускаются без проверки токена:

```javascript
const cleanUrl = request.url.split('?')[0].replace(/\/+$/, '');
if (cleanUrl !== '/api/docs') return; // пропускаем все подресурсы
```

Спецификация `/api/docs/json` доступна без токена. Это безопасно, т.к. она содержит только структуру API (описание эндпоинтов), но не данные.

### Swagger UI не находит спецификацию

**Проблема:** Если в URL есть `?token=...`, Swagger UI может неправильно вычислить относительный путь к JSON-спецификации.

**Решение:** В конфигурации `swaggerUi` указан абсолютный URL спецификации:

```javascript
uiConfig: {
  url: '/api/docs/json'
}
```
