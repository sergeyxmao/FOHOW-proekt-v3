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
│   ├── admin.js             # Админ-панель
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
