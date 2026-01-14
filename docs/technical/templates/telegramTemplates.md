# Telegram Templates — Шаблоны Telegram-уведомлений

## Расположение

`api/templates/telegramTemplates.js`

## Назначение

Текстовые шаблоны для формирования Telegram-уведомлений с единым стилем и структурой.

## Функции

### Уведомления о подписках

#### `getSubscriptionActivatedMessage(userName, planName, amount, currency, expiresDate, boardsUrl)`

Шаблон для уведомления об активации новой подписки.

**Параметры:**
- `userName` (string) — Имя пользователя
- `planName` (string) — Название тарифа (Premium, Individual)
- `amount` (number) — Сумма оплаты
- `currency` (string) — Валюта (RUB)
- `expiresDate` (string) — Дата окончания в формате "DD Month YYYY" (например, "14 января 2026 г.")
- `boardsUrl` (string) — URL к доскам (по умолчанию: `https://interactive.marketingfohow.ru/boards`)

**Возвращает:**
```javascript
{
  text: string,           // Markdown-текст сообщения
  parse_mode: 'Markdown',
  disable_web_page_preview: true,
  reply_markup: {         // Кнопка "Начать работу"
    inline_keyboard: [[...]]
  }
}
