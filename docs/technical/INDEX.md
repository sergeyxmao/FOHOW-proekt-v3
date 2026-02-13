# Техническая карта проекта

> **Этот файл — точка входа для ИИ-программистов.**
> Сначала прочитай его полностью, затем переходи к нужным разделам.

## Структура репозитория

```
FOHOW-proekt-v3/
├── src/                      # Frontend (Vue 3 + Composition API)
│   ├── components/           # Vue компоненты
│   │   ├── Canvas/           # Холст и его элементы
│   │   ├── Panels/           # Боковые панели
│   │   ├── Admin/            # Админ-панель
│   │   ├── Images/           # Работа с изображениями
│   │   └── ...
│   ├── composables/          # Переиспользуемая логика (хуки)
│   ├── stores/               # Pinia stores (состояние)
│   ├── views/                # Страницы (роуты)
│   ├── router/               # Vue Router
│   ├── locales/              # i18n переводы
│   └── services/             # API сервисы
│
├── api/                      # Backend (Node.js + Fastify)
│   ├── server.js             # Точка входа, middleware, cron jobs
│   ├── routes/               # API endpoints
│   │   ├── auth.js           # Авторизация
│   │   ├── boards.js         # Доски
│   │   ├── cards.js          # Карточки
│   │   ├── images.js         # Изображения
│   │   ├── admin.js          # Админ API
│   │   └── ...
│   └── services/             # Бизнес-логика
│
├── dist/                     # Production build (генерируется)
├── docs/                     # Документация
└── package.json              # Зависимости frontend
```

---

## Ключевые файлы Frontend

### Canvas (Холст) — Главная функциональность

| Файл | Строк | Назначение |
|------|-------|------------|
| `src/components/Canvas/CanvasBoard.vue` | ~3092 | **Оркестратор холста** — координирует все composables |
| `src/components/Canvas/Card.vue` | ~1950 | Компонент карточки |
| `src/components/Canvas/Sticker.vue` | — | Компонент стикера |
| `src/components/Canvas/Connection.vue` | — | Компонент соединения |

### Composables (Переиспользуемая логика)

#### Созданы при рефакторинге CanvasBoard.vue:

| Файл | Строк | Назначение |
|------|-------|------------|
| `useCanvasImageRenderer.js` | ~700 | Рендеринг изображений на Canvas2D, LRU кэширование, виртуализация viewport, экспорт PNG |
| `useAvatarConnections.js` | ~688 | Avatar-соединения (Bezier curves), анимации пульсации, контекстное меню аватаров, модальное окно номера |
| `useCanvasDrag.js` | ~636 | Drag & drop карточек/стикеров/изображений, интеграция с guides, групповое перемещение |
| `useActivePv.js` | ~450 | Логика Active PV, анимации распространения баланса по дереву, подсветка карточек |
| `useCanvasSelection.js` | ~373 | Rectangular selection (выделение рамкой), мульти-выделение объектов |
| `useImageResize.js` | ~369 | Resize изображений (8 handles), сохранение пропорций (Shift), min/max ограничения |
| `useCanvasConnections.js` | ~226 | Соединения между карточками, preview линия, control points для кривых |
| `useCanvasFocus.js` | ~180 | Центрирование viewport на карточке/стикере/якоре с анимацией |
| `useNoteWindows.js` | ~170 | Окна заметок карточек — открытие, закрытие, синхронизация позиции |
| `useCanvasContextMenus.js` | ~151 | Контекстные меню для изображений и пустого холста |

#### Существовавшие ранее:

| Файл | Назначение |
|------|------------|
| `usePanZoom.js` | Зум колёсиком, pan (перетаскивание холста), границы зума |
| `useBezierCurves.js` | Математика кривых Безье для соединений |
| `useKeyboardShortcuts.js` | Горячие клавиши (Delete, Ctrl+Z, Ctrl+C и др.) |
| `useImageProxy.js` | Проксирование изображений через backend |
| `useMobileUIScaleGesture.js` | Pinch-to-zoom на мобильных |
| `useProjectActions.js` | Действия проекта (сохранение, экспорт, шаринг) |

### Stores (Состояние приложения)

| Файл | Назначение |
|------|------------|
| `stores/auth.js` | Авторизация, токен, текущий пользователь |
| `stores/board.js` | Текущая доска, режимы работы |
| `stores/cards.js` | Карточки на холсте (CRUD, выделение) |
| `stores/connections.js` | Соединения между карточками |
| `stores/images.js` | Изображения на холсте |
| `stores/stickers.js` | Стикеры (заметки) |
| `stores/anchors.js` | Якорные точки |
| `stores/history.js` | Undo/Redo история |
| `stores/viewport.js` | Состояние viewport (зум, позиция) |
| `stores/viewSettings.js` | Настройки отображения (сетка, фон, цвета) |
| `stores/notes.js` | Заметки к карточкам |
| `stores/admin.js` | Состояние админ-панели |

### Крупные компоненты

| Файл | Строк | Назначение |
|------|-------|------------|
| `components/UserProfile.vue` | ~5197 | Профиль пользователя, настройки, подписка |
| `components/Board/BoardsList.vue` | ~1787 | Список досок пользователя |
| `components/Overlay/PencilOverlay.vue` | ~2065 | Режим рисования |
| `components/Panels/RightPanel.vue` | ~1319 | Правая панель инструментов |
| `components/Admin/AdminPanel.vue` | — | Админ-панель |

---

## Ключевые файлы Backend

| Файл | Строк | Назначение |
|------|-------|------------|
| `api/server.js` | ~3027 | Инициализация Fastify, middleware, cron jobs, WebSocket |
| `api/routes/admin.js` | ~2831 | Админ API (пользователи, модерация, статистика) |
| `api/routes/images.js` | ~1646 | Загрузка/удаление изображений, интеграция Yandex.Disk |
| `api/routes/boards.js` | — | CRUD досок |
| `api/routes/auth.js` | — | Регистрация, логин, верификация email |
| `api/routes/cards.js` | — | CRUD карточек |
| `api/routes/stickers.js` | — | CRUD стикеров |

---

## База данных (PostgreSQL)

### Подключение
Конфигурация в `api/.env`:
```
DATABASE_URL=postgresql://user:pass@host:5432/dbname
```

### Основные таблицы

| Таблица | Назначение |
|---------|------------|
| `users` | Пользователи |
| `boards` | Доски |
| `subscriptions` | Подписки пользователей |
| `images` | Метаданные изображений |
| `shared_images` | Общая библиотека изображений |
| `notes` | Заметки к карточкам |
| `user_sessions` | Сессии пользователей |

Подробная схема: [database.md](database.md)

---

## API Endpoints

Базовый URL: `/api/`

| Метод | Endpoint | Назначение |
|-------|----------|------------|
| POST | `/auth/register` | Регистрация |
| POST | `/auth/login` | Вход |
| GET | `/boards` | Список досок |
| POST | `/boards` | Создать доску |
| GET | `/boards/:id` | Получить доску с содержимым |
| PUT | `/boards/:id` | Сохранить доску |
| DELETE | `/boards/:id` | Удалить доску |
| POST | `/boards/:id/stickers` | Добавить стикер |
| POST | `/images/upload` | Загрузить изображение |
| GET | `/admin/users` | Список пользователей (admin) |

Полный список: [api-endpoints.md](api-endpoints.md)

---

## Деплой

```bash
# SSH на сервер
ssh root@<server-ip>

# Перейти в проект
cd /var/www/FOHOW-proekt-v3

# Обновить код
git pull

# Собрать frontend
npm run build

# Перезапустить backend
systemctl restart fohow-api

# Проверить статус
systemctl status fohow-api
```

---

## Частые задачи

### Forced Logout Flow

Подробная документация по механизму принудительного выхода с автосохранением:
[FORCED_LOGOUT_FLOW.md](FORCED_LOGOUT_FLOW.md)

### Reset Password Flow

Краткое описание поведения оверлея сброса пароля и редиректа после успеха:
[routes/reset-password.md](routes/reset-password.md)

### Image Favorites & Board Images Tab

Система избранных изображений, вкладка «На доске», загрузка превью через прокси, фокусировка:
[image-favorites.md](image-favorites.md)

### Pencil Mode Image Controls

Управление изображениями в режиме рисования — handles, pinch-to-zoom, desktop vs mobile:
[pencil-mode-image-controls.md](pencil-mode-image-controls.md)

### Board Save/Load

Формат данных доски, сериализация карточек, поля Active-PV:
[board-save-load.md](board-save-load.md)

### HTML Export

Экспорт схем в HTML-файлы — интерактивность, touch support, watermark, pinch-zoom:
[html-export.md](html-export.md)

### Menu Tooltips

Всплывающие подсказки (ⓘ) в пунктах выпадающих меню верхней панели:
[menu-tooltips.md](menu-tooltips.md)

---

### Добавить новый composable
1. Создать файл в `src/composables/useXxx.js`
2. Экспортировать функцию `export function useXxx(options) { ... }`
3. Импортировать и вызвать в компоненте
4. Обновить этот INDEX.md

### Добавить новый API endpoint
1. Найти или создать файл в `api/routes/`
2. Добавить роут через `fastify.get/post/put/delete`
3. Перезапустить сервер: `systemctl restart fohow-api`

### Добавить новую таблицу в БД
1. Подключиться к БД через SQL-клиент
2. Выполнить CREATE TABLE
3. Обновить [database.md](database.md)

---

## Важные замечания

1. **CanvasBoard.vue** — оркестратор, вся логика в composables
2. **Stores** — единственный источник правды для данных
3. **Backend** — stateless, всё состояние в PostgreSQL
4. **Изображения** — хранятся на Yandex.Disk, в БД только метаданные
