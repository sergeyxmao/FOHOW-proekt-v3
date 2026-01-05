# Router (src/router/index.js)

## Описание

Файл конфигурации Vue Router для приложения. Определяет маршруты и защиту авторизации.

## Маршруты

| Путь | Имя | Компонент | Meta | Описание |
|------|-----|-----------|------|----------|
| `/` | home | HomeView | — | Главная страница с холстом |
| `/boards` | boards | BoardsList | requiresAuth | Список структур пользователя |
| `/board/:id` | board | HomeView | requiresAuth | Открытие конкретной доски |
| `/pricing` | pricing | PricingPage | layout: public | Страница тарифов |
| `/verify-email` | verify-email | EmailVerification | layout: public | Подтверждение email |
| `/admin` | admin | AdminPanel (lazy) | requiresAuth, requiresAdmin | Админ-панель |

## Импорты компонентов

**Статические импорты** (загружаются сразу):
- `HomeView` — главная страница
- `PricingPage` — тарифы
- `EmailVerification` — верификация email
- `BoardsList` — список структур

**Динамические импорты** (lazy loading):
- `AdminPanel` — админ-панель (загружается только при переходе)

### Почему BoardsList импортируется статически

BoardsList использует статический импорт для корректного применения CSS-стилей при первом рендеринге. При динамическом импорте стили могут загружаться с задержкой, что приводит к визуальным артефактам (сжатый layout, отсутствие grid).

## Защита маршрутов

### beforeEach guard

```js
router.beforeEach(async (to, from, next) => {
  // 1. Проверка токена для requiresAuth
  if (to.meta.requiresAuth && !token) {
    next('/') // редирект на главную
    return
  }

  // 2. Проверка роли для requiresAdmin
  if (to.meta.requiresAdmin) {
    await authStore.loadUser()
    if (authStore.user?.role !== 'admin') {
      next('/boards') // редирект на доски
      return
    }
  }

  next()
})
```

## Meta-поля

| Поле | Тип | Описание |
|------|-----|----------|
| `requiresAuth` | boolean | Требуется авторизация |
| `requiresAdmin` | boolean | Требуется роль admin |
| `layout` | string | Тип layout (public, admin) |

## Связанные файлы

- `src/stores/auth.js` — авторизация пользователя
- `src/components/Board/BoardsList.vue` — компонент списка структур
- `src/views/HomeView.vue` — главная страница
- `src/views/AdminPanel.vue` — админ-панель

## История изменений

| Дата | Изменение |
|------|-----------|
| 2026-01-05 | Заменён динамический импорт BoardsList на статический для исправления проблемы с CSS |
