# Auth Store

> Документация Pinia store для управления аутентификацией и авторизацией

## Описание

Store `auth.js` управляет состоянием аутентификации пользователя, включая регистрацию, вход, выход и управление профилем.

## Расположение

`src/stores/auth.js`

## State

```javascript
{
  user: null,              // Объект пользователя
  token: null,             // JWT токен
  isAuthenticated: false,  // Флаг аутентификации
  isLoadingProfile: true   // Флаг загрузки профиля
}
```

## Getters

### `maxCardsPerBoard`
Возвращает максимальное количество карточек на доске согласно тарифному плану.
- **Тип:** `number`
- **Значение:** `-1` (безлимит) если план не определен

### `planName`
Возвращает название текущего тарифного плана.
- **Тип:** `string`
- **Значение по умолчанию:** `"Не определен"`

### `hasCardsLimit`
Проверяет, есть ли лимит на количество карточек.
- **Тип:** `boolean`

## Actions

### `loadUser()`
Быстрая загрузка данных пользователя из JWT токена (без запроса к серверу).

**Использование:**
```javascript
authStore.loadUser()
```

### `init()`
Инициализация store при загрузке приложения. Проверяет наличие токена в localStorage, загружает кэшированные данные пользователя и запрашивает свежий профиль.

**Использование:**
```javascript
await authStore.init()
```

---

### `register(email, password, verificationCode, verificationToken)`

Регистрация нового пользователя.

**Параметры:**
- `email` (string) - Email пользователя
- `password` (string) - Пароль (минимум 6 символов)
- `verificationCode` (string) - Проверочный код (антибот)
- `verificationToken` (string) - Токен проверочного кода

**Возвращает:**
```javascript
{
  success: boolean,
  requiresLogin: boolean,
  message?: string
}
```

**Поведение:**

1. **Регистрация с последующим входом** (текущий сценарий):
   - Backend создает пользователя с `email_verified = false`
   - Backend возвращает `{ success: true, requiresLogin: true }`
   - Store возвращает объект с `requiresLogin: true`
   - Компонент должен переключить пользователя на форму входа

2. **Регистрация с автоматическим входом** (будущий сценарий):
   - Backend возвращает `{ token: "...", user: {...} }`
   - Store вызывает `finalizeAuthentication()`
   - Store возвращает `{ success: true, requiresLogin: false }`
   - Пользователь автоматически входит в систему

**Пример использования:**
```javascript
try {
  const result = await authStore.register(
    'user@example.com',
    'password123',
    '1234',
    'token-abc'
  )

  if (result.requiresLogin) {
    // Показать сообщение и переключить на форму входа
    console.log(result.message)
  }
} catch (error) {
  console.error('Ошибка регистрации:', error.message)
}
```

**Связанные файлы:**
- `src/components/RegisterForm.vue` - компонент регистрации
- `api/routes/auth.js:122` - backend роут `/api/register`

**История изменений:**
- **2026-01-02**: Исправлена логика для корректной обработки `requiresLogin` (не вызывается `finalizeAuthentication` при отсутствии токена)
- **2024-12**: Создан метод регистрации

---

### `login(email, password, verificationCode, verificationToken)`

Вход пользователя в систему.

**Параметры:**
- `email` (string) - Email пользователя
- `password` (string) - Пароль
- `verificationCode` (string) - Проверочный код (антибот)
- `verificationToken` (string) - Токен проверочного кода

**Возвращает:**
```javascript
{
  requiresVerification: boolean,
  email?: string
}
```

**Поведение:**

1. **Email не верифицирован:**
   - Backend генерирует 6-значный код
   - Backend отправляет код на email
   - Backend возвращает `{ requiresVerification: true, email: "..." }`
   - Store сохраняет email в `localStorage.verificationEmail`
   - Компонент должен перенаправить на страницу `/verify-email`

2. **Email верифицирован:**
   - Backend возвращает JWT токен
   - Store вызывает `finalizeAuthentication()`
   - Пользователь входит в систему

**Пример использования:**
```javascript
try {
  const result = await authStore.login(
    'user@example.com',
    'password123',
    '1234',
    'token-abc'
  )

  if (result.requiresVerification) {
    // Перенаправить на страницу верификации email
    router.push('/verify-email')
  } else {
    // Перенаправить в кабинет
    router.push('/dashboard')
  }
} catch (error) {
  console.error('Ошибка входа:', error.message)
}
```

**Связанные файлы:**
- `src/components/LoginForm.vue` - компонент входа
- `api/routes/auth.js:228` - backend роут `/api/login`

---

### `finalizeAuthentication(token, fallbackUser)`

Завершение аутентификации: сохранение токена и загрузка профиля пользователя.

**Параметры:**
- `token` (string) - JWT токен
- `fallbackUser` (object) - Резервные данные пользователя (если профиль не удалось загрузить)

**Использование:**
```javascript
await authStore.finalizeAuthentication(token, user)
```

**ВАЖНО:** Этот метод НЕ должен вызываться напрямую из компонентов. Он используется внутри методов `login()` и `register()`.

---

### `logout()`

Выход пользователя из системы.

**Поведение:**
- Отправляет запрос на сервер для удаления сессии (игнорирует ошибки сети)
- Очищает state (`user`, `token`, `isAuthenticated`)
- Удаляет данные из localStorage (`token`, `user`)
- Очищает личные комментарии пользователя

**Использование:**
```javascript
await authStore.logout()
router.push('/login')
```

---

### `fetchProfile()`

Загрузка актуальных данных профиля с сервера.

**Возвращает:**
- `Promise<Object>` - Объект пользователя

**Использование:**
```javascript
try {
  const user = await authStore.fetchProfile()
  console.log('Профиль обновлен:', user)
} catch (error) {
  console.error('Ошибка загрузки профиля:', error.message)
}
```

**ВАЖНО:** Метод обновляет поле `is_verified` и другие данные профиля.

---

### `updateProfile(profileData)`

Обновление данных профиля пользователя.

**Параметры:**
- `profileData` (object) - Объект с обновляемыми полями

**Возвращает:**
- `Promise<Object>` - Обновленный объект пользователя

**Пример:**
```javascript
await authStore.updateProfile({
  full_name: 'Иван Иванов',
  phone: '+79991234567',
  city: 'Москва'
})
```

---

### `applyPromoCode(code)`

Применение промокода.

**Параметры:**
- `code` (string) - Промокод

**Возвращает:**
- `Promise<Object>` - Результат применения промокода

**Пример:**
```javascript
try {
  const result = await authStore.applyPromoCode('SUMMER2024')
  console.log('Промокод применен:', result)
} catch (error) {
  console.error('Ошибка применения промокода:', error.message)
}
```

## API Endpoints

Все методы используют следующую базовую URL:
```javascript
const API_URL = import.meta.env.VITE_API_URL || 'https://interactive.marketingfohow.ru/api'
```

### Используемые endpoints:
- `POST /api/register` - Регистрация
- `POST /api/login` - Вход
- `POST /api/logout` - Выход
- `GET /api/profile` - Получение профиля
- `PUT /api/profile` - Обновление профиля
- `POST /api/promo/apply` - Применение промокода

## Связанные файлы

- `src/components/LoginForm.vue` - Компонент входа
- `src/components/RegisterForm.vue` - Компонент регистрации
- `src/views/EmailVerification.vue` - Страница верификации email
- `api/routes/auth.js` - Backend роуты аутентификации
- `api/middleware/auth.js` - Middleware для проверки JWT токена

## История изменений

- **2026-01-02**: Исправлена логика метода `register()` для корректной обработки сценария с `requiresLogin`
- **2024-12**: Добавлены методы управления профилем и промокодами
- **2024-12**: Создан store с базовыми методами аутентификации
