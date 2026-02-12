# Удаление платёжной системы Tribute

**Дата:** 2026-02-12
**Причина:** Платёжная система Tribute выведена из эксплуатации. Замена на Продамус.

## Удалённые файлы

### Бэкенд
- `api/routes/tribute.js` — роуты webhook Tribute (POST /api/webhook/tribute, GET /api/webhook/tribute/health)
- `api/services/tributeService.js` — сервис обработки платежей Tribute (верификация, активация, продление, отмена подписок)
- `api/services/processPendingTributeWebhooks.js` — обработка отложенных webhook для пользователей без привязки Telegram

### Документация
- `docs/TRIBUTE_WEBHOOK_SETUP.md`
- `docs/technical/api/routes/tribute.md`
- `docs/technical/routes/tribute.md`
- `docs/technical/services/tributeService.md`
- `docs/technical/tasks/tribute_webhook_finalization.md`

## Удалённые таблицы БД

| Таблица | Описание |
|---------|----------|
| `tribute_subscriptions` | Подписки Tribute (связь с users и subscription_plans) |
| `pending_tribute_webhooks` | Отложенные webhook от Tribute, ожидающие привязки Telegram |

Таблицы удалены вручную владельцем проекта до начала зачистки кода.

## Изменения в коде

### `api/server.js`
- Убран импорт `registerTributeRoutes`
- Убран swagger-тег `Tribute`
- Убрана регистрация роутов `registerTributeRoutes(app)`

### `api/bot/telegramBot.js`
- Убран импорт `processPendingTributeWebhooks`
- Убран блок обработки отложенных Tribute webhook после привязки Telegram

### `api/routes/telegram.js`
- Убран блок динамического импорта и вызова `processPendingTributeWebhooks` в эндпоинте `connect-telegram`

### `api/.env.example`
- Убраны переменные `TRIBUTE_API_KEY` и `TRIBUTE_WEBHOOK_SECRET`

### `src/composables/useUserTariffs.js`
- Убрана константа `TRIBUTE_PRODUCTS` с маппингом product ID
- Функция `handleUpgrade` заменена на заглушку с сообщением: «Оплата временно недоступна. Скоро будет подключена новая платёжная система.»

### `src/components/Admin/AdminNotifications.vue`
- Триггеры уведомлений изменены: «Оплата через Tribute» → «Оплата подписки», «Автоматическое продление через Tribute» → «Автоматическое продление подписки»

## Обновлённая документация

- `docs/technical/swagger-api.md` — убран тег Tribute и ссылки на эндпоинты
- `docs/technical/notifications-system.md` — убрана ссылка на tributeService.js
- `docs/technical/admin-notifications.md` — обновлены триггеры уведомлений
- `docs/technical/routes/telegram.md` — убраны разделы об интеграции с Tribute
- `docs/technical/composables/useUserTariffs.md` — убран раздел интеграции с Tribute
- `docs/technical/api/routes/plans.md` — убраны перекрёстные ссылки на Tribute
- `docs/AUDIT-REPORT.md` — убраны данные аудита Tribute
- `docs/technical/er-diagram.html`, `docs/er-diagram.html`, `public/er-diagram.html` — убраны таблицы из диаграммы

## Что НЕ затронуто

- Система промокодов (`api/routes/promo.js`)
- Таблицы подписок (`subscription_plans`, `subscription_history`)
- Крон-задача `blockExpiredSubscriptions`
- Шаблоны уведомлений о подписках (остаются для новой платёжной системы)
