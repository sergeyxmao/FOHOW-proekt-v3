# Админ-панель: Вкладка "Уведомления"

## Обзор

Вкладка **Уведомления** в админ-панели предоставляет визуальный просмотр всех шаблонов уведомлений, отправляемых системой через Telegram и Email.

**URL:** `/admin?tab=notifications`

## Компонент

**Файл:** `src/components/Admin/AdminNotifications.vue`

## Функциональность

### Переключатель каналов
- **Telegram** — 11 шаблонов с превью в стиле Telegram (пузырь сообщения + inline-кнопки)
- **Email** — 14 шаблонов с превью в стиле email-письма (header + content + footer)

### Карточки шаблонов
Каждая карточка содержит:
- **Название** шаблона
- **Триггер** — событие, вызывающее отправку
- **Параметры** — переменные, подставляемые в шаблон
- **Визуальное превью** с примерами данных

## Шаблоны Telegram

| # | Название | Триггер | Файл-источник |
|---|----------|---------|---------------|
| 1 | Приветствие | Регистрация нового пользователя | `api/templates/telegramTemplates.js:119` |
| 2 | Подписка истекает | Cron: ежедневно 09:00 МСК | `api/templates/telegramTemplates.js:38` |
| 3 | Подписка истекла | Cron: ежедневно 01:00 МСК | `api/templates/telegramTemplates.js:72` |
| 4 | Подписка активирована | Оплата через Tribute | `api/templates/telegramTemplates.js:180` |
| 5 | Подписка продлена | Автопродление через Tribute | `api/templates/telegramTemplates.js:320` |
| 6 | Подписка отменена | Отмена подписки | `api/templates/telegramTemplates.js:363` |
| 7 | Промокод применён | Активация промокода | `api/templates/telegramTemplates.js:277` |
| 8 | Верификация одобрена | Одобрение администратором | `api/templates/telegramTemplates.js:404` |
| 9 | Верификация снята | Изменение номера | `api/templates/telegramTemplates.js:432` |
| 10 | Верификация авто-отклонена | Дубликат номера | `api/templates/telegramTemplates.js:457` |
| 11 | Telegram отключён | Отвязка Telegram | `api/templates/telegramTemplates.js:483` |

## Шаблоны Email

| # | Название | Триггер | Файл-источник |
|---|----------|---------|---------------|
| 1 | Приветствие | Регистрация | `api/templates/emailTemplates.js:220` |
| 2 | Код подтверждения | Подтверждение email | `api/templates/emailTemplates.js:619` |
| 3 | Сброс пароля | Запрос восстановления | `api/templates/emailTemplates.js:696` |
| 4 | Пароль изменён | Смена пароля | `api/templates/emailTemplates.js:1206` |
| 5 | Подписка истекает | Cron: ежедневно 09:00 МСК | `api/templates/emailTemplates.js:34` |
| 6 | Подписка истекла | Cron: ежедневно 01:00 МСК | `api/templates/emailTemplates.js:125` |
| 7 | Подписка активирована | Оплата через Tribute | `api/templates/emailTemplates.js:783` (eventType='new') |
| 8 | Подписка продлена | Автопродление | `api/templates/emailTemplates.js:783` (eventType='renewed') |
| 9 | Подписка отменена | Отмена подписки | `api/templates/emailTemplates.js:783` (eventType='cancelled') |
| 10 | Промокод применён | Активация промокода | `api/templates/emailTemplates.js:783` (eventType='promo') |
| 11 | Верификация одобрена | Одобрение администратором | `api/templates/emailTemplates.js:328` |
| 12 | Верификация снята | Изменение номера | `api/templates/emailTemplates.js:399` |
| 13 | Верификация авто-отклонена | Дубликат номера | `api/templates/emailTemplates.js:466` |
| 14 | Верификация отклонена (админ) | Отклонение администратором | `api/templates/emailTemplates.js:541` |

## Файлы шаблонов

- **Telegram:** `api/templates/telegramTemplates.js` — текстовые шаблоны с Markdown-разметкой
- **Email:** `api/templates/emailTemplates.js` — HTML-шаблоны с inline-стилями

## Сервисы отправки

- **Telegram:** `api/utils/telegramService.js` — отправка через Telegram Bot API
- **Email:** `api/utils/emailService.js` — отправка через SMTP (Nodemailer)

## Связанные файлы

- `api/cron/tasks.js` — cron-задачи (уведомления о подписках)
- `api/services/verificationService.js` — уведомления о верификации
- `api/services/tributeService.js` — уведомления о платежах
- `api/bot/telegramBot.js` — Telegram бот (команда /start)
- `api/routes/telegram.js` — отвязка Telegram
- `api/routes/auth.js` — регистрация, сброс пароля
