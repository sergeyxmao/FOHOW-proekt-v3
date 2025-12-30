# Stores

Pinia stores для управления глобальным состоянием приложения.

## Структура

| Store | Назначение |
|-------|------------|
| `auth.js` | Аутентификация и данные пользователя |
| `boards.js` | Доски и их содержимое |
| `stickers.js` | Стикеры на досках |
| `images.js` | Библиотека изображений |
| `sidePanels.js` | Состояние боковых панелей |
| `subscription.js` | Подписка и тарифы |
| `userComments.js` | Комментарии пользователя |
| `notes.js` | Заметки |
| `favorites.js` | Избранное |
| `notifications.js` | Уведомления |
| `verification.js` | Верификация |

## Использование
```javascript
import { useAuthStore } from '@/stores/auth'
import { useBoardsStore } from '@/stores/boards'

const authStore = useAuthStore()
const boardsStore = useBoardsStore()

// Доступ к состоянию
console.log(authStore.user)
console.log(boardsStore.currentBoard)

// Вызов действий
await authStore.login(credentials)
await boardsStore.fetchBoard(boardId)
```

## Персистентность

Некоторые stores используют `pinia-plugin-persistedstate` для сохранения в localStorage.
