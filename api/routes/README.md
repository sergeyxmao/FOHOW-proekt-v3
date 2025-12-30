# API Routes

Fastify маршруты бэкенда.

## Структура

### Корневые роуты
| Файл | Endpoints | Назначение |
|------|-----------|------------|
| `auth.js` | /api/register, /api/login, ... | Аутентификация |
| `profile.js` | /api/profile/* | Профиль пользователя |
| `boards.js` | /api/boards/* | CRUD досок |
| `stickers.js` | /api/stickers/* | Стикеры |
| `notes.js` | /api/notes/* | Заметки |
| `comments.js` | /api/comments/* | Комментарии |
| `plans.js` | /api/plans/* | Тарифные планы |
| `telegram.js` | /api/telegram/* | Интеграция Telegram |
| `verification.js` | /api/verification/* | Верификация |
| `promo.js` | /api/promo/* | Промокоды |
| `users.js` | /api/users/* | Пользователи |
| `partners.js` | /api/partners/* | Партнёры |
| `boardPartners.js` | /api/boards/:id/partners | Партнёры на доске |
| `boardFolders.js` | /api/board-folders/* | Папки досок |
| `favorites.js` | /api/favorites/* | Избранное |
| `chats.js` | /api/chats/* | Чаты |
| `discussion.js` | /api/discussion/* | Обсуждения |
| `relationships.js` | /api/relationships/* | Связи |
| `anchors.js` | /api/anchors/* | Якоря |
| `notifications.js` | /api/notifications/* | Уведомления |

### Модульные роуты

#### admin/ — Админ-панель
| Файл | Назначение |
|------|------------|
| `index.js` | Агрегатор модулей |
| `users.js` | Управление пользователями |
| `stats.js` | Статистика |
| `transactions.js` | Транзакции |
| `images.js` | Модерация изображений |
| `verifications.js` | Модерация верификации |
| `exports.js` | Экспорт в CSV |

#### images/ — Библиотека изображений
| Файл | Назначение |
|------|------------|
| `index.js` | Агрегатор модулей |
| `myLibrary.js` | Личная библиотека |
| `shared.js` | Общая библиотека |
| `proxy.js` | Прокси изображений |

## Middleware

Все защищённые роуты используют:
- `authenticateToken` — проверка JWT
- `requireAdmin` — только для админов
- `checkUsageLimit` — проверка лимитов тарифа
