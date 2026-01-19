# Настройка Tribute Webhook

## Краткое описание

Tribute webhook уже реализован в проекте. Эта инструкция поможет проверить его работу и настроить в панели Tribute.

## Реализованные функции

✅ Webhook endpoint: `POST /api/webhook/tribute`  
✅ Проверка подписи (HMAC-SHA256)  
✅ Обработка новых подписок (`subscription.created`)  
✅ Обработка продления (`subscription.renewed`)  
✅ Обработка отмены (`subscription.cancelled`)  
✅ Автоматическое обновление тарифа в `users.plan_id`  
✅ Обновление блокировок досок (`BoardLockService`)  
✅ Email и Telegram уведомления  
✅ Отложенная обработка (`pending_tribute_webhooks`)  

---

## 🛠️ Настройка на сервере

### 1. Добавить переменную окружения

Редактируем файл `.env` на сервере:

```bash
cd /home/f/fohowru/interactive.marketingfohow.ru/api
nano .env
```

Добавляем:

```env
# Tribute Payment System
TRIBUTE_WEBHOOK_SECRET=your_secret_from_tribute_dashboard
```

**Примечание**: Секрет можно получить в панели Tribute (раздел Webhooks).

### 2. Перезапустить API

```bash
pm2 restart api
pm2 logs api --lines 50
```

Проверьте, что в логах есть:
```
✅ Tribute routes registered
```

---

## 📡 Настройка в панели Tribute

### 1. Webhook URL

Укажите в настройках Tribute:

```
https://interactive.marketingfohow.ru/api/webhook/tribute
```

### 2. Подписываемые события

Включите следующие события:

- ✅ `subscription.created`
- ✅ `subscription.started`
- ✅ `subscription.renewed`
- ✅ `subscription.payment_received`
- ✅ `subscription.cancelled`
- ✅ `subscription.expired`
- ✅ `subscription.failed`

### 3. Webhook Secret

Скопируйте секрет из панели Tribute и добавьте его в `.env` (см. шаг 1).

---

## ✅ Проверка работы webhook

### 1. Health Check

Проверьте, что endpoint доступен:

```bash
curl https://interactive.marketingfohow.ru/api/webhook/tribute/health
```

**Ожидаемый ответ**:
```json
{
  "status": "ok",
  "service": "tribute-webhook",
  "timestamp": "2026-01-19T13:00:00.000Z"
}
```

### 2. Тестовый webhook (на локальном сервере)

Проверьте логику обработки webhook:

```bash
curl -X POST https://interactive.marketingfohow.ru/api/webhook/tribute \
  -H "Content-Type: application/json" \
  -d '{
    "event": "subscription.created",
    "data": {
      "subscription_id": "test_sub_123",
      "telegram_user_id": "YOUR_TELEGRAM_CHAT_ID",
      "product_id": "sLc8",
      "amount": 249,
      "currency": "RUB",
      "period": "month"
    }
  }'
```

**Примечание**: Замените `YOUR_TELEGRAM_CHAT_ID` на реальный `telegram_chat_id` из БД.

### 3. Проверка в БД

Подключитесь к PostgreSQL:

```bash
psql -h HOST -U USER -d DATABASE
```

Проверьте подписку пользователя:

```sql
-- Проверить тариф пользователя
SELECT 
  u.id, 
  u.email, 
  u.telegram_chat_id, 
  u.plan_id, 
  sp.name as plan_name,
  u.subscription_started_at,
  u.subscription_expires_at,
  u.payment_method
FROM users u
LEFT JOIN subscription_plans sp ON u.plan_id = sp.id
WHERE u.telegram_chat_id = 'YOUR_TELEGRAM_CHAT_ID';
```

**Ожидаемый результат**:
- `plan_id` → `6` (Individual) или `7` (Premium)
- `subscription_expires_at` → через 1 месяц/год
- `payment_method` → `tribute`

Проверить запись в `tribute_subscriptions`:

```sql
SELECT * FROM tribute_subscriptions 
WHERE telegram_user_id = 'YOUR_TELEGRAM_CHAT_ID'
ORDER BY created_at DESC;
```

Проверить историю подписок:

```sql
SELECT * FROM subscription_history 
WHERE user_id = (SELECT id FROM users WHERE telegram_chat_id = 'YOUR_TELEGRAM_CHAT_ID')
ORDER BY created_at DESC;
```

### 4. Проверка логов

Смотрим логи API:

```bash
pm2 logs api --lines 100 | grep -i tribute
```

**Ожидаемые сообщения**:
```
[Tribute Webhook] 📩 Получен запрос: subscription.created
[Tribute] 🆕 Новая подписка: subscription_id=..., telegram_user_id=...
✅ Подписка активирована для user_id=..., plan_id=6
[Tribute] Блокировки обновлены для user_id=...
✅ Telegram-уведомление о новой подписке отправлено
```

---

## 🐞 Решение проблем

### Проблема: 400 Bad Request

**Причина**: Некорректный формат payload от Tribute.

**Решение**:
1. Проверьте логи: `pm2 logs api --lines 100`
2. Убедитесь, что Tribute отправляет `event` и `data` в payload.

### Проблема: 403 Forbidden (Invalid signature)

**Причина**: Неверный `TRIBUTE_WEBHOOK_SECRET`.

**Решение**:
1. Проверьте секрет в панели Tribute.
2. Обновите значение в `.env`.
3. Перезапустите API: `pm2 restart api`.

### Проблема: Подписка сохраняется в pending

**Причина**: Пользователь с `telegram_chat_id` не найден в БД.

**Решение**:
1. Проверьте, что пользователь привязал Telegram в профиле.
2. Проверьте таблицу `pending_tribute_webhooks`:
   ```sql
   SELECT * FROM pending_tribute_webhooks 
   WHERE processed = FALSE
   ORDER BY created_at DESC;
   ```
3. После привязки Telegram система автоматически обработает отложенные webhook'и.

### Проблема: plan_id не меняется с 5 на 6

**Причина**: 
- Webhook не приходит от Tribute
- `telegram_chat_id` не совпадает с `telegram_user_id` в payload

**Решение**:
1. Проверьте логи API: `pm2 logs api --lines 200 | grep -i tribute`
2. Проверьте в панели Tribute, что webhook отправлен успешно (200 OK).
3. Проверьте, что `telegram_user_id` в payload соответствует `telegram_chat_id` в `users`:
   ```sql
   SELECT id, email, telegram_chat_id FROM users 
   WHERE telegram_chat_id = 'YOUR_TELEGRAM_USER_ID';
   ```

---

## 📚 Документация

- **[docs/technical/api/routes/tribute.md](./technical/api/routes/tribute.md)** — Полное описание Tribute webhook API
- **[docs/technical/services/tributeService.md](./technical/services/tributeService.md)** — Бизнес-логика `tributeService.js`
- **[docs/technical/api/routes/plans.md](./technical/api/routes/plans.md)** — API тарифных планов

---

## 🎯 Резюме

✅ **Webhook уже реализован**: `POST /api/webhook/tribute`  
✅ **Логика обработки готова**: новая подписка, продление, отмена  
✅ **Автоматическое обновление `plan_id`**: с 5 (guest) → 6 (individual) или 7 (premium)  
✅ **Обновление блокировок**: `BoardLockService` пересчитывает доступные доски  
✅ **Уведомления**: Email и Telegram  

**Настройка занимает менее 5 минут:**
1. Добавить `TRIBUTE_WEBHOOK_SECRET` в `.env`
2. Перезапустить API (`pm2 restart api`)
3. Указать webhook URL в панели Tribute

---

**Дата**: 2026-01-19  
**Автор**: FOHOW Dev Team  
