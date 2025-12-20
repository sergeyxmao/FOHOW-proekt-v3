# Техническая документация проекта FOHOW Interactive Board

**Дата составления:** 14 декабря 2025  
**Версия:** 2.0 (после миграции на облачную БД)  
**Проект:** FOHOW Interactive Board (FOHOW-proekt-v3)

---

## 📋 Оглавление

1. [Обзор проекта](#обзор-проекта)
2. [Инфраструктура](#инфраструктура)
3. [Архитектура приложения](#архитектура-приложения)
4. [База данных](#база-данных)
5. [Конфигурация окружения](#конфигурация-окружения)
6. [Развертывание и CI/CD](#развертывание-и-cicd)
7. [Сервисы и интеграции](#сервисы-и-интеграции)
8. [Миграция на облачную БД](#миграция-на-облачную-бд)
9. [Мониторинг и логи](#мониторинг-и-логи)
10. [Резервное копирование](#резервное-копирование)
11. [Устранение неполадок](#устранение-неполадок)

---

## Обзор проекта

### Назначение
FOHOW Interactive Board — веб-приложение для интерактивного управления бизнес-структурами, досками планирования и визуализации отношений между партнерами сети FOHOW.

### Основные функции
- Создание и редактирование интерактивных досок
- Управление пользователями и подписками (Demo, Guest, Individual, Premium)
- Система верификации пользователей
- Библиотека изображений с модерацией
- Интеграция с Telegram ботом
- Хранение файлов на Яндекс.Диске
- Система уведомлений по email

### Технологический стек

**Frontend:**
- Vue.js 3
- Pinia (state management)
- Vite (build tool)

**Backend:**
- Node.js 20.x
- Fastify (web framework)
- PostgreSQL 16.4 (облачная БД на Beget)
- Redis (кеширование и сессии)

**Инфраструктура:**
- Nginx (reverse proxy, SSL termination)
- Ubuntu 22.04 LTS
- PM2 через systemd (process management)
- GitHub (version control)
- Beget Cloud Database (PostgreSQL)

---

## Инфраструктура

### Серверная информация

**Основной сервер (приложение):**
```
IP: 217.114.5.69
Домен: interactive.marketingfohow.ru
Хостинг: beget.com (VPS)
ОС: Ubuntu 22.04.5 LTS
CPU: 2 ядра (Standard 3+ GHz)
RAM: 2 ГБ
Диск: 30 ГБ NVMe
Канал: 250 Мбит/сек
Стоимость: 22₽/день
```

**Облачная БД PostgreSQL:**
```
Провайдер: Beget Cloud Database
Host: oshifotkleeshuln.beget.app
Port: 5432
Database: default_db
Тип: PostgreSQL 16.4
Конфигурация: 2 ядра / 2 ГБ RAM / 20 ГБ NVMe
Регион: Россия, Санкт-Петербург
Private IP: 10.19.0.1
Стоимость: 29₽/день
Статус: ✅ Активна (с 14.12.2025)
```

### Сетевая конфигурация

**DNS:**
- A-запись: interactive.marketingfohow.ru → 217.114.5.69

**Файрволл и доступы:**
- Белый список IP для облачной БД: 217.114.5.69
- SSL/TLS: Let's Encrypt (автоматическое обновление)
- HTTPS: обязателен (редирект с HTTP)

---

## Архитектура приложения

### Структура проекта

```
/var/www/FOHOW-proekt-v3/
├── api/                          # Backend (Node.js + Fastify)
│   ├── server.js                 # Точка входа сервера
│   ├── .env                      # Конфигурация (БД, ключи, токены)
│   ├── routes/                   # API маршруты
│   ├── middleware/               # Middleware (аутентификация и т.д.)
│   ├── services/                 # Бизнес-логика
│   ├── uploads/                  # Загружаемые файлы (аватары, превью)
│   ├── node_modules/             # Зависимости backend
│   └── package.json
│
├── src/                          # Frontend (Vue.js 3)
│   ├── main.js                   # Точка входа приложения
│   ├── App.vue                   # Корневой компонент
│   ├── router/                   # Vue Router конфигурация
│   ├── stores/                   # Pinia stores
│   ├── components/               # Vue компоненты
│   ├── views/                    # Страницы
│   └── assets/                   # Статические ресурсы
│
├── dist/                         # Собранный frontend (production build)
│   ├── index.html
│   ├── assets/                   # JS, CSS, шрифты, изображения
│   └── ...
│
├── node_modules/                 # Зависимости frontend
├── package.json                  # Frontend зависимости и скрипты
├── vite.config.js                # Конфигурация Vite
└── README.md
```

### Потоки данных

```
[Пользователь] 
    ↓ HTTPS
[Nginx :443]
    ↓ proxy_pass для /api/*
    ├─→ [Node.js API :4000] → [PostgreSQL Cloud :5432]
    │                        → [Redis :6379]
    │                        → [Yandex.Disk API]
    │                        → [Telegram Bot API]
    │                        → [SMTP beget.com :465]
    │
    └─→ [Static Files /dist]
        [Static Files /uploads]
```

---

## База данных

### ⚠️ ВАЖНО: Миграция на облачную БД (14.12.2025)

**Старая конфигурация (до 14.12.2025):**
- БД располагалась локально на сервере приложения
- Host: localhost
- User: fohow_user
- Database: fohow

**Текущая конфигурация (после 14.12.2025):**
- БД перенесена на облачный PostgreSQL Beget
- Host: oshifotkleeshuln.beget.app
- User: cloud_user
- Database: default_db
- Локальная PostgreSQL остановлена и отключена

### Данные подключения к облачной БД

```env
DB_HOST=oshifotkleeshuln.beget.app
DB_PORT=5432
DB_USER=cloud_user
DB_PASSWORD=N8opTL86!KnL
DB_NAME=default_db
```

**Для подключения через psql:**
```bash
PGPASSWORD='N8opTL86!KnL' psql -h oshifotkleeshuln.beget.app -p 5432 -U cloud_user -d default_db
```

**Connection string (Node.js):**
```javascript
const connectionString = "postgresql://cloud_user:N8opTL86!KnL@oshifotkleeshuln.beget.app:5432/default_db"
```

### Структура базы данных

**Основные таблицы (31 таблица):**

```sql
-- Пользователи и аутентификация
users                    -- Пользователи системы
user_verifications       -- Коды верификации email
password_resets          -- Токены сброса пароля
active_sessions          -- Активные сессии пользователей
demo_trials              -- Демо-периоды пользователей

-- Подписки
subscription_plans       -- Тарифные планы (Demo, Guest, Individual, Premium)
subscription_history     -- История подписок
promo_codes              -- Промокоды
promo_code_usages        -- Использование промокодов

-- Доски и контент
boards                   -- Интерактивные доски
board_folders            -- Папки для организации досок
board_anchors            -- Якорные точки на досках
stickers                 -- Стикеры на досках
notes                    -- Заметки на досках
relationships            -- Связи между элементами

-- Библиотека изображений
image_library            -- Общая библиотека изображений
user_comments            -- Комментарии модераторов к изображениям

-- Телеграм интеграция
telegram_link_codes      -- Коды привязки Telegram аккаунтов
fogrup_notifications     -- Уведомления FoGrup
fogrup_messages          -- Сообщения FoGrup

-- Логи и мониторинг
system_logs              -- Системные логи (720 KB - самая большая таблица)
```

**Текущий объем данных:**
```
Общий размер БД: 14 MB
Пользователи: 23
Доски: 13+
Логи: 1863 записей
```

### Индексы и оптимизация

**Количество индексов:** 102  
**Количество триггеров:** 12  
**Количество функций:** 11

**Ключевые индексы:**
```sql
-- Примеры (полный список в миграционном дампе)
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_boards_user_id ON boards(user_id);
CREATE INDEX idx_system_logs_created_at ON system_logs(created_at);
-- ... и другие
```

---

## Конфигурация окружения

### Файл .env (Backend)

**Расположение:** `/var/www/FOHOW-proekt-v3/api/.env`

**Актуальная конфигурация (после миграции БД):**

```env
# Секретный ключ для JWT
JWT_SECRET=1a93ee177258f1ffef51a2886b30756c8ad57f8f79f91432ff230027fc012f1c

# ============================================
# БАЗА ДАННЫХ PostgreSQL (ОБЛАЧНАЯ BEGET)
# ============================================
DB_USER=cloud_user
DB_HOST=oshifotkleeshuln.beget.app
DB_NAME=default_db
DB_PASSWORD=N8opTL86!KnL
DB_PORT=5432

# Порт, на котором будет работать API
PORT=4000

# ============================================
# EMAIL НАСТРОЙКИ ДЛЯ ОТПРАВКИ (BEGET)
# ============================================
EMAIL_HOST=smtp.beget.com
EMAIL_PORT=465
EMAIL_USER=noreply@marketingfohow.ru
EMAIL_PASSWORD=lenaXMAO80_beg
EMAIL_FROM=FOHOW <noreply@marketingfohow.ru>

# ============================================
# TELEGRAM BOT
# ============================================
TELEGRAM_BOT_TOKEN=8508930461:AAE-eoYVEdIrABoXhlfK-s0ujkBW_xdgZ9Y
TELEGRAM_BOT_USERNAME=fohow_Interactive_bot
TELEGRAM_NOTIFICATIONS_ENABLED=true

# ============================================
# ЯНДЕКС.ДИСК ДЛЯ БИБЛИОТЕКИ ИЗОБРАЖЕНИЙ
# ============================================
YANDEX_DISK_TOKEN=y0__xDUs4PfARjjzzsg-buQmhXTG8ZXhQYDIO9Er8zP4DDgFEE8-Q
YANDEX_DISK_BASE_DIR=/FOHOW_Boards

# ============================================
# URL ФРОНТЕНДА ДЛЯ EMAIL-ССЫЛОК
# ============================================
FRONTEND_URL=https://interactive.marketingfohow.ru
```

### Переменные окружения systemd

**Файл:** `/etc/systemd/system/fohow-api.service`

```ini
[Service]
Environment=PORT=4000
Environment=NODE_ENV=production
```

---

## Развертывание и CI/CD

### GitHub репозиторий

```
URL: https://github.com/sergeyxmao/FOHOW-proekt-v3
Ветка: main (production)
```

### Автоматическое развертывание

**Webhook сервер:**
- Сервис: `webhook.service`
- Скрипт: `/root/webhook-server.js`
- Порт: внутренний (обрабатывает GitHub webhooks)
- Действия при push в main:
  1. `git pull origin main`
  2. `pnpm install` (если изменился package.json)
  3. `pnpm run build` (для frontend)
  4. `systemctl restart fohow-api`

**⚠️ ВАЖНО:** Изменения в БД (миграции) webhook НЕ выполняет автоматически. Миграции БД требуют ручного выполнения администратором.

### Ручное развертывание

**Обновление кода:**
```bash
cd /var/www/FOHOW-proekt-v3
git pull origin main
```

**Установка зависимостей:**
```bash
# Frontend
pnpm install

# Backend
cd api
pnpm install
cd ..
```

**Сборка frontend:**
```bash
pnpm run build
```

**Перезапуск API:**
```bash
sudo systemctl restart fohow-api
```

**Применение миграций БД (если есть):**
```bash
# Подключение к облачной БД
PGPASSWORD='N8opTL86!KnL' psql -h oshifotkleeshuln.beget.app -p 5432 -U cloud_user -d default_db

# Выполнение SQL-скрипта
\i /path/to/migration.sql

# Или через командную строку
PGPASSWORD='N8opTL86!KnL' psql -h oshifotkleeshuln.beget.app -p 5432 -U cloud_user -d default_db -f migration.sql
```

---

## Сервисы и интеграции

### Systemd сервисы

**1. fohow-api.service (Node.js API)**

Файл: `/etc/systemd/system/fohow-api.service`

```ini
[Unit]
Description=FOHOW Interactive Board API
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/var/www/FOHOW-proekt-v3/api
ExecStart=/usr/bin/pnpm start
Restart=always
Environment=PORT=4000
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

**Команды:**
```bash
# Статус
sudo systemctl status fohow-api

# Перезапуск
sudo systemctl restart fohow-api

# Логи (live)
sudo journalctl -u fohow-api -f

# Логи за последний час
sudo journalctl -u fohow-api --since "1 hour ago"
```

**2. webhook.service (GitHub Webhook)**

Файл: `/etc/systemd/system/webhook.service`

```ini
[Unit]
Description=GitHub Webhook Server for FOHOW
After=network.target

[Service]
Type=simple
User=root
ExecStart=/usr/bin/node /root/webhook-server.js
Restart=always

[Install]
WantedBy=multi-user.target
```

**3. nginx.service (Web Server)**

```bash
# Проверка конфигурации
sudo nginx -t

# Перезапуск
sudo systemctl restart nginx

# Логи доступа
sudo tail -f /var/log/nginx/access.log

# Логи ошибок
sudo tail -f /var/log/nginx/error.log
```

**4. redis-server.service (Кеширование)**

```bash
# Статус
sudo systemctl status redis-server

# Подключение к Redis CLI
redis-cli

# Очистка кеша (осторожно!)
redis-cli FLUSHDB
```

**5. postgresql.service (ОСТАНОВЛЕН после миграции)**

⚠️ **ВНИМАНИЕ:** Локальная PostgreSQL остановлена и отключена с 14.12.2025. Все данные теперь в облачной БД.

```bash
# Статус (должен быть inactive)
sudo systemctl status postgresql

# НЕ запускать! БД теперь облачная
# sudo systemctl start postgresql  # ❌ НЕ ДЕЛАТЬ
```

### Nginx конфигурация

**Файл:** `/etc/nginx/sites-enabled/fohow`

```nginx
server {
    server_name interactive.marketingfohow.ru;
    root /var/www/FOHOW-proekt-v3/dist;
    index index.html;

    # Загружаемые файлы (аватары, превью)
    location /uploads/ {
        alias /var/www/FOHOW-proekt-v3/api/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
        autoindex off;
    }

    # Проксирование API запросов
    location /api/ {
        proxy_pass http://127.0.0.1:4000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket support (если используется)
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Кеширование статических ресурсов
    location ~* ^/assets/.*\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # SSL (автоматически добавлено Certbot)
    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/interactive.marketingfohow.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/interactive.marketingfohow.ru/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
}

# HTTP → HTTPS redirect
server {
    if ($host = interactive.marketingfohow.ru) {
        return 301 https://$host$request_uri;
    }

    listen 80;
    server_name interactive.marketingfohow.ru;
    return 404;
}
```

### Внешние интеграции

**1. Яндекс.Диск (Облачное хранилище)**

```javascript
// Конфигурация
YANDEX_DISK_TOKEN=y0__xDUs4PfARjjzzsg-buQmhXTG8ZXhQYDIO9Er8zP4DDgFEE8-Q
YANDEX_DISK_BASE_DIR=/FOHOW_Boards

// Структура папок
/FOHOW_Boards/
  ├── SHARED/           // Общая библиотека изображений
  │   └── pending/      // Изображения на модерации
  └── users/            // Персональные папки пользователей
```

**Назначение:**
- Хранение библиотеки общих изображений
- Хранение пользовательских файлов досок
- Модерация загружаемых изображений

**2. Telegram Bot API**

```javascript
// Конфигурация
TELEGRAM_BOT_TOKEN=8508930461:AAE-eoYVEdIrABoXhlfK-s0ujkBW_xdgZ9Y
TELEGRAM_BOT_USERNAME=fohow_Interactive_bot
TELEGRAM_NOTIFICATIONS_ENABLED=true
```

**Функции:**
- Уведомления пользователей
- Привязка Telegram аккаунтов
- FoGrup сообщения

**3. Email (SMTP Beget)**

```javascript
// Конфигурация
EMAIL_HOST=smtp.beget.com
EMAIL_PORT=465
EMAIL_USER=noreply@marketingfohow.ru
EMAIL_PASSWORD=lenaXMAO80_beg
EMAIL_FROM=FOHOW <noreply@marketingfohow.ru>
```

**Использование:**
- Верификация email при регистрации
- Сброс пароля
- Уведомления о подписках
- Системные уведомления

---

## Миграция на облачную БД

### История миграции

**Дата:** 14 декабря 2025  
**Причина:** Улучшение администрирования, масштабируемости и надежности  
**Статус:** ✅ Успешно завершена

### Что изменилось

**ДО миграции:**
```env
DB_HOST=localhost
DB_USER=fohow_user
DB_NAME=fohow
DB_PASSWORD=fohow_pass
```

**ПОСЛЕ миграции:**
```env
DB_HOST=oshifotkleeshuln.beget.app
DB_USER=cloud_user
DB_NAME=default_db
DB_PASSWORD=N8opTL86!KnL
```

### Процесс миграции

1. **Создана облачная БД на Beget:**
   - PostgreSQL 16.4
   - 2 ядра / 2 ГБ RAM / 20 ГБ NVMe
   - Регион: Санкт-Петербург

2. **Остановлены сервисы:**
   ```bash
   sudo systemctl stop fohow-api
   sudo systemctl stop webhook
   ```

3. **Создан дамп локальной БД:**
   ```bash
   sudo -u postgres pg_dump fohow > /tmp/fohow_backup_20251214_133242.sql
   ```
   Размер дампа: 544 KB

4. **Добавлен IP сервера в белый список БД:**
   - IP: 217.114.5.69

5. **Импортированы данные:**
   ```bash
   PGPASSWORD='N8opTL86!KnL' psql -h oshifotkleeshuln.beget.app -p 5432 \
     -U cloud_user -d default_db < /tmp/fohow_backup_20251214_133242.sql
   ```

6. **Обновлен .env файл:**
   - Изменены параметры подключения к БД

7. **Перезапущены сервисы:**
   ```bash
   sudo systemctl start fohow-api
   sudo systemctl start webhook
   ```

8. **Проверка работы:**
   - ✅ Вход в систему
   - ✅ Создание досок
   - ✅ Все данные на месте (23 пользователя, 13 досок)

9. **Остановлена локальная PostgreSQL:**
   ```bash
   sudo systemctl stop postgresql
   sudo systemctl disable postgresql
   ```

### Данные миграции

```
Перенесено:
- Таблиц: 31
- Пользователей: 23
- Досок: 13
- Индексов: 102
- Триггеров: 12
- Функций: 11
- Общий объем: 14 MB

Время простоя: ~15 минут
Потеря данных: 0%
```

### Проверка целостности данных

```sql
-- До миграции (localhost)
SELECT COUNT(*) FROM users;   -- 23
SELECT COUNT(*) FROM boards;  -- 13

-- После миграции (облачная БД)
SELECT COUNT(*) FROM users;   -- 23 ✅
SELECT COUNT(*) FROM boards;  -- 13 ✅

-- Новая доска после миграции
SELECT * FROM boards WHERE name = 'test sql';
-- ID: 194, created_at: 2025-12-14 16:52:12 ✅
```

### Преимущества облачной БД

1. **Удобство администрирования:**
   - Веб-интерфейс Beget для управления
   - Готовые примеры подключения
   - Мониторинг в реальном времени

2. **Надежность:**
   - Профессиональное резервное копирование
   - Автоматические бэкапы
   - Отказоустойчивая инфраструктура

3. **Производительность:**
   - Выделенные ресурсы для БД
   - Нет конкуренции с приложением
   - SSD NVMe хранилище

4. **Масштабируемость:**
   - Легкое увеличение ресурсов (за 2 минуты)
   - Независимое масштабирование БД и приложения
   - Готовность к 10,000+ пользователей

5. **Безопасность:**
   - Белый список IP-адресов
   - SSL/TLS шифрование
   - Изолированная сеть

---

## Мониторинг и логи

### Логи приложения

**Systemd журналы (journalctl):**

```bash
# API логи (live)
sudo journalctl -u fohow-api -f

# API логи за последний час
sudo journalctl -u fohow-api --since "1 hour ago"

# API логи с фильтрацией по ошибкам
sudo journalctl -u fohow-api -p err

# Webhook логи
sudo journalctl -u webhook -f
```

**Nginx логи:**

```bash
# Логи доступа
sudo tail -f /var/log/nginx/access.log

# Логи ошибок
sudo tail -f /var/log/nginx/error.log

# Поиск ошибок 5xx
sudo grep " 50[0-9] " /var/log/nginx/access.log
```

**Системные логи в БД:**

```sql
-- Последние 100 логов
SELECT * FROM system_logs ORDER BY created_at DESC LIMIT 100;

-- Логи ошибок
SELECT * FROM system_logs WHERE level = 'error' ORDER BY created_at DESC LIMIT 50;

-- Логи за последний день
SELECT * FROM system_logs WHERE created_at > NOW() - INTERVAL '1 day';
```

### Мониторинг облачной БД

**Панель Beget Cloud:**
- URL: https://beget.com/ru/cloud/database
- Разделы:
  - Статистика (CPU, память, запросы)
  - Мониторинг (графики нагрузки)
  - Backup (резервные копии)

**Проверка подключения:**

```bash
# Быстрая проверка
PGPASSWORD='N8opTL86!KnL' psql -h oshifotkleeshuln.beget.app -p 5432 \
  -U cloud_user -d default_db -c "SELECT version();"

# Проверка активных соединений
PGPASSWORD='N8opTL86!KnL' psql -h oshifotkleeshuln.beget.app -p 5432 \
  -U cloud_user -d default_db -c "SELECT COUNT(*) FROM pg_stat_activity;"
```

### Крон-задачи

**Автоматические задачи в приложении:**

```javascript
// Инициализация в server.js
✅ Задача 1: Уведомления о истечении подписок (ежедневно 09:00 МСК)
✅ Задача 2: Блокировка истекших подписок (ежедневно 01:00 МСК)
✅ Задача 3: Очистка старых сессий (каждый час)
✅ Задача 4: Закрытие демо-периодов (ежедневно 02:00 МСК)
✅ Задача 5: Смена тарифа с Демо на Гостевой (ежедневно 02:30 МСК)
✅ Задача 6: Блокировка досок при окончании платной подписки (ежедневно 01:00 МСК)
✅ Задача 7: Удаление заблокированных досок через 14 дней (ежедневно 03:00 МСК)
✅ Задача 8: Очистка устаревших кодов подтверждения email (каждый час)
```

**Системные крон-задачи:**

```bash
# Просмотр крон-задач
crontab -l

# Редактирование
crontab -e
```

---

## Резервное копирование

### Автоматические бэкапы

**Облачная БД (Beget):**
- Настройка: Панель Beget → Cloud Database → FOHOW → Backup
- Рекомендуемая частота: Ежедневно
- Хранение: По умолчанию Beget
- Восстановление: Через панель управления

**Локальные файлы (uploads):**

Создание бэкапа:
```bash
# Ручной бэкап папки uploads
tar -czvf /root/backups/uploads_backup_$(date +%Y%m%d).tar.gz \
  /var/www/FOHOW-proekt-v3/api/uploads

# Добавить в cron (ежедневно в 03:00)
0 3 * * * tar -czvf /root/backups/uploads_backup_$(date +\%Y\%m\%d).tar.gz /var/www/FOHOW-proekt-v3/api/uploads
```

### Ручные бэкапы

**База данных:**

```bash
# Создание дампа облачной БД
PGPASSWORD='N8opTL86!KnL' pg_dump -h oshifotkleeshuln.beget.app -p 5432 \
  -U cloud_user -d default_db > /root/backups/fohow_backup_$(date +%Y%m%d).sql

# Создание сжатого дампа
PGPASSWORD='N8opTL86!KnL' pg_dump -h oshifotkleeshuln.beget.app -p 5432 \
  -U cloud_user -d default_db | gzip > /root/backups/fohow_backup_$(date +%Y%m%d).sql.gz
```

**Код приложения (Git):**

```bash
cd /var/www/FOHOW-proekt-v3

# Проверка изменений
git status

# Коммит изменений
git add .
git commit -m "Описание изменений"
git push origin main
```

### Восстановление

**База данных из бэкапа:**

```bash
# Восстановление из SQL дампа
PGPASSWORD='N8opTL86!KnL' psql -h oshifotkleeshuln.beget.app -p 5432 \
  -U cloud_user -d default_db < /root/backups/fohow_backup_20251214.sql

# Восстановление из сжатого дампа
gunzip -c /root/backups/fohow_backup_20251214.sql.gz | \
  PGPASSWORD='N8opTL86!KnL' psql -h oshifotkleeshuln.beget.app -p 5432 \
  -U cloud_user -d default_db
```

**Файлы uploads:**

```bash
# Распаковка бэкапа
tar -xzvf /root/backups/uploads_backup_20251214.tar.gz -C /
```

---

## Устранение неполадок

### Проблемы с подключением к БД

**Симптомы:**
- Ошибки "connection refused"
- Таймауты при запросах к БД
- API не запускается

**Диагностика:**

```bash
# 1. Проверка доступности облачной БД
ping oshifotkleeshuln.beget.app

# 2. Проверка подключения к БД
PGPASSWORD='N8opTL86!KnL' psql -h oshifotkleeshuln.beget.app -p 5432 \
  -U cloud_user -d default_db -c "SELECT 1;"

# 3. Проверка IP в белом списке
# Убедитесь, что 217.114.5.69 добавлен в белый список в панели Beget

# 4. Проверка .env файла
cat /var/www/FOHOW-proekt-v3/api/.env | grep DB_
```

**Решение:**
- Проверить белый список IP в панели Beget
- Проверить данные подключения в .env
- Проверить статус облачной БД в панели Beget
- Перезапустить API: `sudo systemctl restart fohow-api`

### API не запускается

**Диагностика:**

```bash
# Статус сервиса
sudo systemctl status fohow-api

# Логи с ошибками
sudo journalctl -u fohow-api -p err --since "10 minutes ago"

# Проверка процесса
ps aux | grep node

# Проверка порта
netstat -tlnp | grep :4000
```

**Частые причины:**
1. Порт 4000 занят
2. Ошибки в .env файле
3. Отсутствующие зависимости (pnpm install)
4. Проблемы с БД

**Решение:**

```bash
# Остановить все Node.js процессы
pkill -9 node

# Переустановить зависимости
cd /var/www/FOHOW-proekt-v3/api
pnpm install

# Перезапустить сервис
sudo systemctl restart fohow-api

# Проверить логи
sudo journalctl -u fohow-api -f
```

### Frontend не загружается

**Симптомы:**
- Белая страница
- 404 ошибки на статические файлы
- ERR_CONNECTION_REFUSED

**Диагностика:**

```bash
# Проверка Nginx
sudo systemctl status nginx
sudo nginx -t

# Проверка SSL сертификата
sudo certbot certificates

# Проверка файлов
ls -la /var/www/FOHOW-proekt-v3/dist/
```

**Решение:**

```bash
# Пересборка frontend
cd /var/www/FOHOW-proekt-v3
pnpm run build

# Проверка прав доступа
sudo chown -R www-data:www-data /var/www/FOHOW-proekt-v3/dist

# Перезапуск Nginx
sudo systemctl restart nginx
```

### Медленные запросы к БД

**Диагностика:**

```sql
-- Активные долгие запросы
SELECT pid, now() - pg_stat_activity.query_start AS duration, query
FROM pg_stat_activity
WHERE state = 'active' AND now() - pg_stat_activity.query_start > interval '5 seconds'
ORDER BY duration DESC;

-- Статистика по таблицам
SELECT schemaname, tablename,
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
       n_tup_ins, n_tup_upd, n_tup_del
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

**Решение:**
- Добавить индексы на часто запрашиваемые поля
- Оптимизировать запросы
- Увеличить ресурсы облачной БД в панели Beget

### SSL сертификат истек

**Проверка:**

```bash
# Информация о сертификате
sudo certbot certificates

# Срок действия
openssl x509 -enddate -noout -in /etc/letsencrypt/live/interactive.marketingfohow.ru/fullchain.pem
```

**Обновление:**

```bash
# Автоматическое обновление
sudo certbot renew

# Тестовое обновление
sudo certbot renew --dry-run

# Принудительное обновление
sudo certbot renew --force-renewal
```

---

## Полезные команды

### Быстрая диагностика

```bash
# Статус всех ключевых сервисов
sudo systemctl status nginx fohow-api webhook redis-server

# Проверка подключения к облачной БД
PGPASSWORD='N8opTL86!KnL' psql -h oshifotkleeshuln.beget.app -p 5432 \
  -U cloud_user -d default_db -c "SELECT COUNT(*) FROM users;"

# Проверка работы API
curl http://127.0.0.1:4000/api/health

# Логи за последние 10 минут
sudo journalctl -u fohow-api --since "10 minutes ago"

# Использование диска
df -h

# Использование памяти
free -h

# Нагрузка CPU
top -bn1 | head -20
```

### Экстренный перезапуск

```bash
# Полный перезапуск всех сервисов
sudo systemctl restart nginx
sudo systemctl restart fohow-api
sudo systemctl restart webhook
sudo systemctl restart redis-server

# Проверка статуса после перезапуска
sudo systemctl status nginx fohow-api webhook redis-server
```

---

## Контакты и поддержка

**Администратор сервера:** Сергей  
**Хостинг:** Beget.com  
**GitHub:** https://github.com/sergeyxmao/FOHOW-proekt-v3  
**Домен:** interactive.marketingfohow.ru  

**Панель управления Beget:**
- Основная панель: https://beget.com/ru/my
- Облачная БД: https://beget.com/ru/cloud/database
- VPS сервер: https://beget.com/ru/cloud/vps

---

## Changelog

### Версия 2.0 (14.12.2025)
- ✅ Миграция БД на облачный PostgreSQL Beget
- ✅ Обновлены данные подключения к БД
- ✅ Остановлена локальная PostgreSQL
- ✅ Добавлены инструкции по работе с облачной БД
- ✅ Обновлена документация по мониторингу и бэкапам

### Версия 1.0 (04.11.2025)
- Первоначальная документация сервера
- Описание инфраструктуры и сервисов
- План восстановления (Disaster Recovery)

---

**Документ актуален на:** 14 декабря 2025
