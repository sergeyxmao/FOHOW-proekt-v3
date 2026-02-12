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

### Авторизация (cookie-based)

Swagger UI доступен **только администраторам**. Используется механизм cookie для корректной работы:

1. **Первый вход** — откройте URL с токеном в query:
   ```
   /api/docs?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
   Сервер проверит токен, установит HttpOnly-cookie `swagger_token` и перенаправит на чистый `/api/docs/`.

2. **Повторные визиты** — cookie действует 24 часа, повторно вводить токен не нужно.

3. **Заголовок Authorization** (для программного доступа, curl):
   ```
   Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

**Почему cookie, а не query-параметр?**
`@fastify/swagger-ui` внутренне вызывает `resolveUrl('./json')` на основе текущего URL браузера. Если в URL есть `?token=...`, относительный путь к JSON-спецификации вычисляется некорректно и Swagger UI не загружается. Cookie позволяет убрать токен из URL.

### Доступ через админ-панель

Swagger UI также доступен из админ-панели через вкладку **«Swagger API»** (между «Логи» и «ER-диаграмма»).

При переходе на вкладку Swagger UI загружается в iframe с автоматической подстановкой JWT-токена из `authStore`. Файл: `src/views/AdminPanel.vue`.

| Среда | URL |
|---|---|
| Production | `https://interactive.marketingfohow.ru/admin?tab=swagger` |
| Staging | `https://1508.marketingfohow.ru/admin?tab=swagger` |
| Local | `http://localhost:4000/admin?tab=swagger` |

### OpenAPI JSON-спецификация

```
GET /api/docs/json
```

Спецификация доступна без токена (защищается только корневая страница `/api/docs`). Это безопасно — она содержит только описание эндпоинтов, но не данные.

Можно использовать для:
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
| `api/routes/boards.js` | Schema для 8 эндпоинтов досок |
| `api/routes/boardFolders.js` | Schema для 8 эндпоинтов папок досок |
| `api/routes/boardPartners.js` | Schema для 2 эндпоинтов партнёров на досках |
| `api/routes/stickers.js` | Schema для 4 эндпоинтов стикеров |
| `api/routes/notes.js` | Schema для 2 эндпоинтов заметок |
| `api/routes/comments.js` | Schema для 4 эндпоинтов комментариев |
| `api/routes/anchors.js` | Schema для 4 эндпоинтов якорей |
| `api/routes/discussion.js` | Schema для 1 эндпоинта счётчиков обсуждений |
| `api/routes/images/myLibrary.js` | Schema для 7 эндпоинтов библиотеки изображений |
| `api/routes/images/shared.js` | Schema для 2 эндпоинтов публичных изображений |
| `api/routes/images/proxy.js` | Schema для 1 эндпоинта прокси изображений |
| `api/routes/partners.js` | Schema для 2 эндпоинтов партнёров |
| `api/routes/relationships.js` | Schema для 4 эндпоинтов связей |
| `api/routes/favorites.js` | Schema для 3 эндпоинтов избранного |
| `api/routes/chats.js` | Schema для 6 эндпоинтов чатов |
| `api/routes/notifications.js` | Schema для 2 эндпоинтов уведомлений |
| `api/routes/telegram.js` | Schema для 4 эндпоинтов Telegram |
| `api/routes/plans.js` | Schema для 2 эндпоинтов тарифных планов |
| `api/routes/promo.js` | Schema для 1 эндпоинта промокодов |
| `api/routes/verification.js` | Schema для 5 эндпоинтов верификации |
| `api/routes/admin/users.js` | Schema для 7 эндпоинтов управления пользователями (admin) |
| `api/routes/admin/stats.js` | Schema для 3 эндпоинтов статистики (admin) |
| `api/routes/admin/images.js` | Schema для 11 эндпоинтов модерации изображений (admin) |
| `api/routes/admin/verifications.js` | Schema для 4 эндпоинтов верификации (admin) |
| `api/routes/admin/exports.js` | Schema для 3 эндпоинтов экспорта (admin) |
| `api/routes/admin/transactions.js` | Schema для 1 эндпоинта транзакций (admin) |
| `src/views/AdminPanel.vue` | Вкладка «Swagger API» с iframe для встроенного доступа к Swagger UI |

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
    // ВАЖНО: объекты без явных properties ОБЯЗАНЫ иметь additionalProperties: true
    // иначе Fastify вырежет все поля при сериализации (см. раздел ниже)
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: { type: 'object', additionalProperties: true }
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
| Admin | Админ-панель |
| System | Здоровье системы |

## Фазы внедрения

### Фаза 1 (завершена) — Auth + Profile + Users
- `api/routes/auth.js` — 8 эндпоинтов
- `api/routes/profile.js` — 9 эндпоинтов
- `api/routes/users.js` — 6 эндпоинтов
- `api/server.js` — health эндпоинт
- **Итого: 24 эндпоинта задокументированы**

### Фаза 2 (завершена) — Boards, Images, Promo и остальные
- `api/routes/boards.js` — 8 эндпоинтов
- `api/routes/boardFolders.js` — 8 эндпоинтов
- `api/routes/boardPartners.js` — 2 эндпоинта
- `api/routes/stickers.js` — 4 эндпоинта
- `api/routes/notes.js` — 2 эндпоинта
- `api/routes/comments.js` — 4 эндпоинта
- `api/routes/anchors.js` — 4 эндпоинта
- `api/routes/discussion.js` — 1 эндпоинт
- `api/routes/images/myLibrary.js` — 7 эндпоинтов
- `api/routes/images/shared.js` — 2 эндпоинта
- `api/routes/images/proxy.js` — 1 эндпоинт
- `api/routes/partners.js` — 2 эндпоинта
- `api/routes/relationships.js` — 4 эндпоинта
- `api/routes/favorites.js` — 3 эндпоинта
- `api/routes/chats.js` — 6 эндпоинтов
- `api/routes/notifications.js` — 2 эндпоинта
- `api/routes/telegram.js` — 4 эндпоинта
- `api/routes/plans.js` — 2 эндпоинта
- `api/routes/promo.js` — 1 эндпоинт
- `api/routes/verification.js` — 5 эндпоинтов
- **Итого: ~72 эндпоинта задокументированы**

### Фаза 3 (завершена) — Admin
- `api/routes/admin/users.js` — 7 эндпоинтов
- `api/routes/admin/stats.js` — 3 эндпоинта
- `api/routes/admin/images.js` — 11 эндпоинтов
- `api/routes/admin/verifications.js` — 4 эндпоинта
- `api/routes/admin/exports.js` — 3 эндпоинта
- `api/routes/admin/transactions.js` — 1 эндпоинт
- **Итого: 29 эндпоинтов задокументированы**

### Общий итог: ~125 эндпоинтов задокументированы (100% API)

## Экспорт OpenAPI JSON для внешней интеграции

Для экспорта спецификации (например, для FoChat):

```bash
# JSON-спецификация доступна без авторизации
curl https://interactive.marketingfohow.ru/api/docs/json -o openapi.json
```

Полученный `openapi.json` можно:
- Импортировать в **Postman** (Import → File → openapi.json)
- Использовать для генерации SDK через [OpenAPI Generator](https://openapi-generator.tech/)
- Подключить к внешним API-шлюзам

## Известные проблемы и решения

### CSP (Content Security Policy) блокирует Swagger UI

**Проблема:** `@fastify/helmet` по умолчанию запрещает inline-скрипты и стили, которые использует Swagger UI.

**Решение:** Helmet настроен с кастомной CSP, разрешающей `'unsafe-inline'` для `scriptSrc` и `styleSrc`. Настройка в `api/server.js`:

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

### resolveUrl('./json') ломается при ?token= в URL

**Проблема:** `@fastify/swagger-ui` в `swagger-initializer.js` всегда вызывает `resolveUrl('./json')`, который берёт текущий URL браузера и приклеивает `./json`. Если URL содержит `?token=JWT`, относительный путь вычисляется некорректно и спецификация не загружается. Параметр `url` в `uiConfig` перезаписывается плагином.

**Решение:** Cookie-аутентификация. При первом заходе с `?token=JWT` сервер:
1. Проверяет токен
2. Ставит HttpOnly cookie `swagger_token`
3. Делает redirect на чистый `/api/docs/`

Без `?token=` в URL `resolveUrl('./json')` корректно разрешается в `/api/docs/json`.

### Response schema сериализация: пустые объекты вместо данных

**Проблема:** Fastify использует response schema для сериализации ответа через `fast-json-stringify`. Когда объект в response schema описан как `{ type: 'object' }` без `properties` и без `additionalProperties: true`, сериализатор удаляет все поля из объекта и возвращает `{}`.

Например, PostgreSQL возвращает `{id: 5, name: "Структура", owner_id: 1}`, но API отдает `{}`.

**Корневая причина:** `fast-json-stringify` при `type: 'object'` без `properties` и `additionalProperties` считает, что объект не должен содержать полей, и вырезает их при сериализации.

**Решение:** Для всех объектов в response schema, у которых не перечислены явные `properties`, **ОБЯЗАТЕЛЬНО** добавлять `additionalProperties: true`.

**Неправильно:**
```javascript
response: {
  200: {
    type: 'object',
    properties: {
      board: { type: 'object' }                    // Вернёт {}
      note: { type: 'object', properties: {} }     // Вернёт {}
      data: { type: 'object', nullable: true }     // Вернёт null или {}
    }
  }
}
```

**Правильно:**
```javascript
response: {
  200: {
    type: 'object',
    properties: {
      board: { type: 'object', additionalProperties: true }                    // Вернёт все поля
      note: { type: 'object', additionalProperties: true }                     // Вернёт все поля
      data: { type: 'object', nullable: true, additionalProperties: true }     // Вернёт все поля или null
    }
  }
}
```

**Альтернатива:** Вместо `additionalProperties: true` можно перечислить все поля объекта в `properties` — тогда сериализатор пропустит только описанные поля (строгая типизация).

**Важно:** НЕ добавлять `additionalProperties: true` в `body`, `params` или `querystring` schema — там это ослабит валидацию входных данных. Исправление касается ТОЛЬКО `response` schema.

### Защита /api/docs блокирует подресурсы

**Проблема:** Хук `onRequest` может блокировать внутренние ресурсы Swagger UI (json, static, css, js).

**Решение:** Хук защищает **только** корневой путь `/api/docs` (без подпутей):

```javascript
const cleanUrl = request.url.split('?')[0].replace(/\/+$/, '');
if (cleanUrl !== '/api/docs') return;
```
