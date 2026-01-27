# Деплой Staging-окружения на Beget VPS

## Общая информация

- **Домен**: 1508.marketingfohow.ru
- **Сервер**: VPS Beget (fmjqwlosuh)
- **База данных**: Внешний PostgreSQL (oshifotkleeshuln.beget.app)
- **API порт**: 4000
- **Telegram бот**: @FOHOWtest_bot (7677459325)

---

## 1. Подготовка сервера

### 1.1 Установка зависимостей

```bash
# Node.js 20.x + pnpm
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
npm install -g pnpm

# Nginx
apt install -y nginx

# Certbot для SSL
apt install -y certbot python3-certbot-nginx

# Git
apt install -y git
1.2 Клонирование репозитория
bash
cd /var/www
git clone https://github.com/sergeyxmao/FOHOW-proekt-v3.git
cd FOHOW-proekt-v3
2. Настройка Backend (API)
2.1 Создание .env
bash
nano /var/www/FOHOW-proekt-v3/api/.env
Содержимое:

text
NODE_ENV=staging
PORT=4000

# PostgreSQL (внешний сервер Beget)
DB_HOST=oshifotkleeshuln.beget.app
DB_PORT=5432
DB_NAME=default_db
DB_USER=cloud_user
DB_PASSWORD=<пароль>

# JWT
JWT_SECRET=<генерировать: openssl rand -base64 32>

# Frontend URL
FRONTEND_URL=https://1508.marketingfohow.ru

# SMTP (Beget)
SMTP_HOST=smtp.beget.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=noreply@marketingfohow.ru
SMTP_PASS=<пароль>
EMAIL_FROM=noreply@marketingfohow.ru

# Telegram бот для staging (отдельный!)
TELEGRAM_BOT_TOKEN=7677459325:AAGfjA0mJhXfNUerWnbQmgaaxJcvcb6NjIc
TELEGRAM_CHAT_ID=300732358

# Яндекс API
YANDEX_VISION_API_KEY=<ключ>
YANDEX_VISION_FOLDER_ID=<folder_id>
YANDEX_DISK_TOKEN=<токен>
YANDEX_DISK_BASE_DIR=/FOHOW-Interactive-Board

# Tribute Payment
TRIBUTE_API_KEY=<ключ>
2.2 Установка зависимостей
bash
cd /var/www/FOHOW-proekt-v3/api
pnpm install
2.3 Создание systemd-сервиса
bash
nano /etc/systemd/system/fohow-api-staging.service
Содержимое:

text
[Unit]
Description=FOHOW Interactive Board API (Staging)
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/var/www/FOHOW-proekt-v3/api
Environment=NODE_ENV=staging
ExecStart=/usr/bin/pnpm start
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
Запуск:

bash
systemctl daemon-reload
systemctl enable fohow-api-staging.service
systemctl start fohow-api-staging.service
systemctl status fohow-api-staging.service
3. Настройка Frontend
3.1 Создание .env.staging
bash
nano /var/www/FOHOW-proekt-v3/.env.staging
Содержимое:

text
VITE_API_URL=https://1508.marketingfohow.ru/api
3.2 Билд проекта
bash
cd /var/www/FOHOW-proekt-v3
pnpm install
pnpm build:staging
4. Настройка Nginx
4.1 Создание конфига
bash
nano /etc/nginx/sites-available/staging
Содержимое:

text
server {
    listen 80;
    client_max_body_size 16m;
    server_name 1508.marketingfohow.ru;
    root /var/www/FOHOW-proekt-v3/dist;
    index index.html;

    location /uploads/ {
        alias /var/www/FOHOW-proekt-v3/api/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    location /api/ {
        proxy_pass http://127.0.0.1:4000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
4.2 Активация конфига
bash
ln -s /etc/nginx/sites-available/staging /etc/nginx/sites-enabled/staging
nginx -t
systemctl reload nginx
5. Установка SSL-сертификата
bash
certbot --nginx -d 1508.marketingfohow.ru
Важно:

Указать email для уведомлений

Согласиться с ToS (Y)

Certbot автоматически настроит HTTPS и редирект

6. Проверка работоспособности
6.1 API
bash
curl https://1508.marketingfohow.ru/api/health
6.2 Frontend
Открыть в браузере: https://1508.marketingfohow.ru

6.3 Логи API
bash
journalctl -u fohow-api-staging.service -n 50 -f
7. Обновление staging
7.1 Обновление кода
bash
cd /var/www/FOHOW-proekt-v3
git pull origin main
7.2 Обновление Backend
bash
cd /var/www/FOHOW-proekt-v3/api
pnpm install
systemctl restart fohow-api-staging.service
7.3 Обновление Frontend
bash
cd /var/www/FOHOW-proekt-v3
pnpm install
pnpm build:staging
8. Важные отличия staging от production
Параметр	Staging	Production
Домен	1508.marketingfohow.ru	interactive.marketingfohow.ru
API порт	4000	3000
Telegram бот	@FOHOWtest_bot	@FOHOW_bot
БД	default_db (shared)	fohow_production (отдельная)
NODE_ENV	staging	production
9. Решение проблем
Ошибка 500 при certbot
Причина: API не запущен или падает
Решение:

bash
systemctl status fohow-api-staging.service
journalctl -u fohow-api-staging.service -n 50
Telegram bot conflict
Причина: Два бота с одним токеном
Решение: Создать отдельного бота для staging через @BotFather

API не стартует
Проверить:

.env существует и заполнен

БД доступна: psql -h oshifotkleeshuln.beget.app -U cloud_user -d default_db

Порт 4000 свободен: netstat -tuln | grep 4000

10. Контакты и ссылки
Репозиторий: https://github.com/sergeyxmao/FOHOW-proekt-v3

Документация: /var/www/FOHOW-proekt-v3/docs/technical/

Adminer (БД): https://oshifotkleeshuln.beget.app/adminer/

text

Сохрани (Ctrl+O, Enter, Ctrl+X).

**Готово!** Теперь есть полная инструкция по деплою staging.
