# API обновления профиля пользователя

## PUT /api/profile

Обновление данных профиля текущего авторизованного пользователя.

### Расположение файлов

- **Backend**: `api/routes/profile.js` — обработчик PUT `/api/profile`
- **Store**: `src/stores/auth.js` — Pinia-стор с методом обновления профиля
- **Компонент**: `src/components/UserProfile.vue` — UI формы профиля

### Аутентификация

Требуется JWT-токен (`authenticateToken` middleware).

### Обрабатываемые поля

| Поле | Тип | Описание |
|------|-----|----------|
| `username` | string | Имя пользователя |
| `email` | string | Email |
| `currentPassword` | string | Текущий пароль (обязателен при смене пароля) |
| `newPassword` | string | Новый пароль |
| `country` | string | Страна |
| `city` | string | Город |
| `office` | string | Представительство (формат: 3 буквы + 2-3 цифры, например RUY68) |
| `personal_id` | string | Компьютерный номер (начинается с представительства + 9 цифр) |
| `phone` | string | Телефон |
| `full_name` | string | Полное имя |
| `telegram_user` | string | Telegram-аккаунт |
| `telegram_channel` | string | Telegram-канал |
| `vk_profile` | string | Профиль ВКонтакте |
| `ok_profile` | string | Профиль Одноклассники |
| `instagram_profile` | string | Профиль Instagram |
| `whatsapp_contact` | string | Контакт WhatsApp |
| `website` | string | Веб-сайт |
| `ui_preferences` | object | Пользовательские настройки UI (animationColor, isAnimationEnabled, lineColor, lineThickness, backgroundGradient) |

### Валидации

- **email** — проверка уникальности среди других пользователей
- **username** — проверка уникальности среди других пользователей
- **personal_id** — формат (представительство + 9 цифр), уникальность, проверка верификации у других пользователей
- **office** — формат (3 английские буквы + 2-3 цифры)
- **password** — при смене проверяется текущий пароль через bcrypt

### Побочные эффекты

- **Снятие верификации**: при изменении `office` или `personal_id` у верифицированного пользователя автоматически снимается статус верификации (`is_verified = FALSE`)
- **Уведомление при снятии верификации**: отправляется Telegram-сообщение и Email
- **Уведомление при смене пароля**: отправляется Email и Telegram-сообщение с информацией о времени, IP-адресе и геолокации

### Защита пароля

Пароль защищён от случайного обнуления двумя механизмами:
1. SELECT-запрос перед обновлением включает поле `password`, чтобы `user.password` содержал текущий хеш
2. В UPDATE-запросе используется `COALESCE($3, password)` — если значение NULL, сохраняется текущий пароль

### История изменений

- **2026-02-06** — Исправлен баг с NULL password при сохранении соц. сетей. Поле `password` добавлено в SELECT-запрос, в UPDATE добавлена защита через COALESCE.
