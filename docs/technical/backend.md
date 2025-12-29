# Архитектура Backend API

> Документация по структуре серверной части приложения

## Структура файлов

```
api/
├── server.js                 # Главный файл (~220 строк) - инициализация, плагины, запуск
├── db.js                     # Подключение к PostgreSQL
├── socket.js                 # WebSocket конфигурация
│
├── routes/                   # API маршруты
│   ├── auth.js              # Авторизация, регистрация (~500 строк)
│   ├── profile.js           # Профиль пользователя (~400 строк)
│   ├── boards.js            # Доски (~350 строк)
│   ├── plans.js             # Тарифные планы (~120 строк)
│   ├── telegram.js          # Telegram интеграция (~180 строк)
│   ├── stickers.js          # Стикеры CRUD (~220 строк)
│   ├── notes.js             # Заметки CRUD (~115 строк)
│   ├── comments.js          # Личные комментарии (~175 строк)
│   ├── boardPartners.js     # Партнёры на досках (~280 строк)
│   ├── admin/               # Админ-панель (модульная структура)
│   │   ├── index.js         # Агрегатор модулей (~40 строк)
│   │   ├── users.js         # Управление пользователями (~350 строк)
│   │   ├── stats.js         # Статистика и мониторинг (~140 строк)
│   │   ├── transactions.js  # История транзакций (~90 строк)
│   │   ├── images.js        # Модерация изображений (~1100 строк)
│   │   ├── verifications.js # Модерация верификации (~230 строк)
│   │   └── exports.js       # Экспорт пользователей в CSV (~210 строк)
│   ├── images.js            # Работа с изображениями
│   ├── anchors.js           # Якорные точки
│   ├── verification.js      # Верификация пользователей
│   ├── promo.js             # Промокоды
│   ├── partners.js          # Партнёры
│   ├── relationships.js     # Связи пользователей
│   ├── users.js             # Пользователи
│   ├── notifications.js     # Уведомления
│   ├── chats.js             # Чаты
│   ├── favorites.js         # Избранное
│   ├── boardFolders.js      # Папки досок
│   └── discussion.js        # Обсуждения
│
├── services/                 # Бизнес-логика
│   ├── emailVerificationService.js  # Redis верификация кодов (~130 строк)
│   ├── verificationService.js       # Верификация пользователей
│   ├── yandexDiskService.js         # Yandex.Disk API
│   └── sharedFoldersSync.js         # Синхронизация папок
│
├── middleware/               # Промежуточные обработчики
│   ├── auth.js              # authenticateToken
│   ├── checkAdmin.js        # Проверка админа
│   ├── checkFeature.js      # Проверка фичей тарифа
│   └── checkUsageLimit.js   # Проверка лимитов
│
├── utils/                    # Утилиты
│   ├── email.js             # Отправка email
│   ├── emailService.js      # Email сервис
│   └── telegramService.js   # Telegram уведомления
│
├── bot/                      # Telegram бот
│   └── telegramBot.js
│
├── cron/                     # Периодические задачи
│   └── tasks.js
│
└── templates/                # Шаблоны
    ├── emailTemplates.js
    └── telegramTemplates.js
```

---

## API Маршруты

### Аутентификация (`routes/auth.js`)

| Метод | Endpoint | Описание |
|-------|----------|----------|
| POST | `/api/verification-code` | Генерация антибот-кода |
| POST | `/api/register` | Регистрация пользователя |
| POST | `/api/login` | Авторизация |
| POST | `/api/logout` | Выход из системы |
| POST | `/api/verify-email` | Подтверждение email |
| POST | `/api/resend-verification-code` | Повторная отправка кода |
| POST | `/api/forgot-password` | Запрос сброса пароля |
| POST | `/api/reset-password` | Установка нового пароля |

### Профиль (`routes/profile.js`)

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/profile` | Получить профиль |
| PUT | `/api/profile` | Обновить профиль |
| PUT | `/api/profile/privacy` | Настройки приватности |
| DELETE | `/api/profile` | Удалить аккаунт |
| POST | `/api/profile/avatar` | Загрузить аватар |
| DELETE | `/api/profile/avatar` | Удалить аватар |
| GET | `/api/users/search-by-personal-id/:id` | Поиск по номеру |
| GET | `/api/users/by-personal-id/:id` | Проверка номера |

### Доски (`routes/boards.js`)

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/boards` | Список досок |
| GET | `/api/boards/:id` | Получить доску |
| POST | `/api/boards` | Создать доску |
| PUT | `/api/boards/:id` | Обновить доску |
| DELETE | `/api/boards/:id` | Удалить доску |
| POST | `/api/boards/:id/duplicate` | Дублировать |
| POST | `/api/boards/:id/thumbnail` | Миниатюра |

### Тарифы (`routes/plans.js`)

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/user/plan` | Тариф пользователя |
| GET | `/api/plans` | Список тарифов |

### Telegram (`routes/telegram.js`)

| Метод | Endpoint | Описание |
|-------|----------|----------|
| POST | `/api/user/telegram/generate-code` | Код привязки |
| GET | `/api/user/telegram/check-link-status` | Статус привязки |
| POST | `/api/user/connect-telegram` | Привязать Telegram |
| GET | `/api/user/telegram-status` | Статус Telegram |

### Стикеры (`routes/stickers.js`)

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/boards/:boardId/stickers` | Получить стикеры доски |
| POST | `/api/boards/:boardId/stickers` | Создать стикер |
| PUT | `/api/stickers/:stickerId` | Обновить стикер |
| DELETE | `/api/stickers/:stickerId` | Удалить стикер |

### Заметки (`routes/notes.js`)

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/boards/:boardId/notes` | Получить заметки доски |
| POST | `/api/notes` | Создать/обновить/удалить заметку (UPSERT) |

### Комментарии (`routes/comments.js`)

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/comments` | Получить комментарии пользователя |
| POST | `/api/comments` | Создать комментарий |
| PUT | `/api/comments/:commentId` | Обновить комментарий |
| DELETE | `/api/comments/:commentId` | Удалить комментарий |

### Партнёры на досках (`routes/boardPartners.js`)

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/boards/:boardId/avatar-partners` | Партнёры по аватарам |
| GET | `/api/boards/:boardId/partners` | Партнёры по карточкам |

### Админ-панель (`routes/admin/`)

Модульная структура админ-панели для управления платформой.

#### Пользователи (`admin/users.js`)

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/admin/users` | Список пользователей с пагинацией |
| GET | `/api/admin/users/:userId` | Детали пользователя |
| PATCH | `/api/admin/users/:userId/role` | Изменить роль |
| PATCH | `/api/admin/users/:userId/plan` | Изменить тарифный план |
| DELETE | `/api/admin/users/:userId` | Удалить пользователя |
| DELETE | `/api/admin/sessions/:sessionId` | Завершить сессию |
| DELETE | `/api/admin/users/:userId/sessions` | Завершить все сессии |

#### Статистика (`admin/stats.js`)

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/admin/stats` | Общая статистика системы |
| GET | `/api/admin/logs` | Системные логи |
| GET | `/api/admin/subscription-plans` | Список тарифных планов |

#### Транзакции (`admin/transactions.js`)

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/admin/transactions` | История транзакций |

#### Изображения (`admin/images.js`)

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/admin/shared-folders` | Список папок общей библиотеки |
| POST | `/api/admin/shared-folders` | Создать папку |
| PATCH | `/api/admin/shared-folders/:id` | Переименовать папку |
| DELETE | `/api/admin/shared-folders/:id` | Удалить папку |
| GET | `/api/admin/images/pending` | Изображения на модерации |
| POST | `/api/admin/images/:id/approve` | Одобрить изображение |
| POST | `/api/admin/images/:id/reject` | Отклонить изображение |
| POST | `/api/admin/images/upload-shared` | Загрузить в общую библиотеку |
| POST | `/api/admin/images/:id/move-to-folder` | Переместить в папку |
| PATCH | `/api/admin/images/:id/rename` | Переименовать изображение |
| DELETE | `/api/admin/images/:id` | Удалить изображение |

#### Верификация (`admin/verifications.js`)

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/admin/screenshot-proxy` | Прокси для скриншотов |
| GET | `/api/admin/verifications/pending` | Заявки на верификацию |
| POST | `/api/admin/verifications/:id/approve` | Одобрить заявку |
| POST | `/api/admin/verifications/:id/reject` | Отклонить заявку |
| GET | `/api/admin/verifications/archive` | Архив верификации |

#### Экспорт (`admin/exports.js`)

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/admin/export/verified-users` | Экспорт верифицированных |
| GET | `/api/admin/export/non-verified-users` | Экспорт не верифицированных |
| GET | `/api/admin/export/users-by-plan/:planId` | Экспорт по тарифу |

---

## Паттерн регистрации роутов

Все новые роуты следуют единому паттерну:

```javascript
// api/routes/example.js
import { pool } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

export function registerExampleRoutes(app) {

  app.get('/api/example', {
    preHandler: [authenticateToken]
  }, async (req, reply) => {
    // логика
    return reply.send({ data });
  });

}
```

Регистрация в `server.js`:
```javascript
import { registerExampleRoutes } from './routes/example.js';
registerExampleRoutes(app);
```

---

## Сервисы

### emailVerificationService.js

Управление проверочными кодами через Redis:

```javascript
import {
  createVerificationSession,  // создать сессию с кодом
  validateVerificationCode    // проверить код
} from './services/emailVerificationService.js';
```

- TTL: 5 минут
- Макс. попыток: 5
- Блокировка: 5 минут

---

## Middleware

### authenticateToken
Проверка JWT токена в заголовке Authorization.

### checkFeature(feature, value)
Проверка доступа к функции по тарифу.

### checkUsageLimit(resource, limit)
Проверка лимитов использования.

---

## Как добавить новый роут

1. Создать файл `api/routes/myroute.js`
2. Экспортировать функцию `registerMyRoutes(app)`
3. Импортировать в `server.js`
4. Вызвать `registerMyRoutes(app)`
5. Обновить эту документацию

---

## Тестирование

```bash
# Проверка синтаксиса
cd /var/www/FOHOW-proekt-v3/api
node --check server.js

# Перезапуск сервера
systemctl restart fohow-api

# Проверка логов
journalctl -u fohow-api -n 50

# Проверка API
curl -s http://localhost:4000/api/health
curl -s http://localhost:4000/api/plans | head -100
```
