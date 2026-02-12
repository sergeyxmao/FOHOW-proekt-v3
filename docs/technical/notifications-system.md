# Система уведомлений (Email + Telegram)

## Описание

Система уведомлений FOHOW Interactive Board состоит из двух независимых каналов:

- **Email** — SMTP-уведомления (подтверждение email, сброс пароля, подписки, безопасность)
- **Telegram** — уведомления через Telegram Bot API (подписки, верификация, административные)

Каждый канал имеет одинаковую архитектуру: **сервис** (логика отправки) + **шаблоны** (HTML/текст).

## Расположение файлов

```
api/
├── utils/
│   ├── emailService.js        — SMTP-транспорт, sendEmail() + обёртки для каждого типа письма
│   └── telegramService.js     — Telegram Bot API, sendTelegramMessage()
├── templates/
│   ├── emailTemplates.js      — Все HTML-шаблоны email-уведомлений
│   └── telegramTemplates.js   — Все текстовые шаблоны Telegram-уведомлений
```

## Email-шаблоны

| Функция | Описание | Параметры | Статус |
|---|---|---|---|
| `getVerificationCodeTemplate` | Код подтверждения email (6 цифр) | `{ code }` | Активен |
| `getPasswordResetTemplate` | Ссылка для сброса пароля | `{ resetUrl }` | Активен |
| `getPasswordChangedTemplate` | Уведомление о смене пароля | `{ formattedDate, locationString? }` | Активен |
| `getSubscriptionEventTemplate` | События подписки (new/renewed/cancelled/promo) | `{ eventType, userName, planName, amount, currency, startDate, expiresDate, promoCode? }` | Активен |
| `getWelcomeTemplate` | Приветственное письмо | `{ userName, demoDays, dashboardUrl }` | Подготовлен |
| `getSubscriptionExpiringTemplate` | Подписка скоро истекает | `{ userName, daysLeft, expirationDate, renewUrl }` | Подготовлен |
| `getSubscriptionExpiredTemplate` | Подписка истекла | `{ userName, pricingUrl }` | Подготовлен |
| `getVerificationApprovedTemplate` | Верификация одобрена | `{ userName, personalId, profileUrl }` | Активен |
| `getVerificationRevokedTemplate` | Верификация отозвана | `{ userName, profileUrl }` | Активен |
| `getVerificationAutoRejectedTemplate` | Автоотклонение заявки | `{ userName, personalId, profileUrl }` | Активен |
| `getVerificationRejectedTemplate` | Отклонение заявки администратором | `{ userName, rejectionReason, profileUrl }` | Активен |

Каждая функция-шаблон возвращает объект `{ subject, html }` (кроме старых шаблонов подписок, которые возвращают только HTML-строку).

## Email-обёртки (emailService.js)

| Функция | Описание | Вызывается в |
|---|---|---|
| `sendVerificationEmail(email, code)` | Отправка кода подтверждения | `routes/auth.js` |
| `sendPasswordResetEmail(email, token)` | Отправка ссылки сброса пароля | `routes/auth.js` |
| `sendPasswordChangedEmail(email, data)` | Уведомление о смене пароля | `routes/profile.js` |
| `sendSubscriptionEmail(email, eventType, data)` | Уведомление о событии подписки | `routes/promo.js` |
| `sendWelcomeEmail(email, userName)` | Приветственное письмо | Не подключена |
| `sendEmail(to, subject, html, text?, options?)` | Универсальная функция отправки | Используется обёртками и напрямую |
| `sendTestEmail(to)` | Тестовое письмо | Утилита |
| `checkEmailConfig()` | Проверка конфигурации | Утилита |

## Как добавить новый email-шаблон

1. Создать функцию-шаблон в `api/templates/emailTemplates.js`:
   ```javascript
   function getMyNewTemplate({ param1, param2 }) {
     const subject = 'Тема письма — FOHOW';
     const html = `<!DOCTYPE html>...`;
     return { subject, html };
   }
   ```
2. Добавить функцию в блок `export { ... }` в том же файле
3. Создать обёртку в `api/utils/emailService.js`:
   ```javascript
   import { getMyNewTemplate } from '../templates/emailTemplates.js';

   export async function sendMyNewEmail(email, data) {
     const { subject, html } = getMyNewTemplate(data);
     return await sendEmail(email, subject, html);
   }
   ```
4. Добавить обёртку в `export default { ... }` в том же файле
5. Вызвать в нужном роуте/сервисе:
   ```javascript
   import { sendMyNewEmail } from '../utils/emailService.js';
   await sendMyNewEmail(userEmail, { param1, param2 });
   ```

## Как добавить новый Telegram-шаблон

1. Создать функцию-шаблон в `api/templates/telegramTemplates.js`
2. Экспортировать функцию
3. Импортировать в нужном роуте/сервисе и вызвать через `sendTelegramMessage(chatId, message)`

## Переменные окружения (.env)

### Email
| Переменная | Описание | Пример |
|---|---|---|
| `EMAIL_HOST` | SMTP-сервер | `smtp.yandex.ru` |
| `EMAIL_PORT` | Порт SMTP | `465` |
| `EMAIL_USER` | Логин SMTP | `user@yandex.ru` |
| `EMAIL_PASSWORD` | Пароль SMTP | `***` |
| `EMAIL_FROM` | Адрес отправителя | `FOHOW <user@yandex.ru>` |

### Telegram
| Переменная | Описание |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Токен Telegram-бота |

### Общие
| Переменная | Описание | Пример |
|---|---|---|
| `FRONTEND_URL` | URL фронтенда (для ссылок в письмах) | `https://interactive.marketingfohow.ru` |

## История изменений

- **2026-02-05**: Рефакторинг — объединение всех email-шаблонов в `emailTemplates.js`, удаление `email.js`, переход на единый `emailService.js`. Перенесены шаблоны: верификация email, сброс пароля, события подписки (new/renewed/cancelled/promo), смена пароля.
