# useUserAvatar.js

> Управление аватаром пользователя: загрузка, обрезка, удаление

## Общая информация

| Параметр | Значение |
|----------|----------|
| **Файл** | `src/composables/useUserAvatar.js` |
| **Размер** | ~245 строк |
| **Создан** | Декабрь 2025 (рефакторинг UserProfile.vue) |
| **Зависимости** | CropperJS, authStore |

## Назначение

Composable для полного цикла работы с аватаром пользователя:
- Загрузка изображения
- Обрезка с соотношением 1:1
- Отправка на сервер
- Удаление аватара
- Отображение инициалов при отсутствии аватара

## API

### Входные параметры

```javascript
useUserAvatar({
  user,       // Ref<User> - реактивный объект пользователя
  authStore,  // Pinia store авторизации
  API_URL     // String - базовый URL API
})
```

### Возвращаемые значения

```javascript
{
  // Состояние
  avatarKey,           // Ref<number> - ключ для принудительного обновления <img>
  showCropper,         // Ref<boolean> - показать модальное окно обрезки
  selectedImageUrl,    // Ref<string> - URL выбранного изображения
  cropperImage,        // Ref<HTMLElement> - ссылка на img элемент для Cropper
  uploadingAvatar,     // Ref<boolean> - процесс загрузки
  isAvatarEditMode,    // Ref<boolean> - режим редактирования аватара

  // Методы
  getAvatarUrl,              // (url) => string - полный URL аватара
  getInitials,               // (name) => string - инициалы из имени
  handleAvatarChange,        // (event) => void - обработка выбора файла
  cancelCrop,                // () => void - отмена обрезки
  confirmCrop,               // () => Promise<void> - подтверждение и загрузка
  handleAvatarDelete,        // () => Promise<void> - удаление аватара
  openAvatarEdit,            // () => void - открыть режим редактирования
  closeAvatarEdit,           // () => void - закрыть режим редактирования
  handleAvatarChangeAndClose, // (event) => Promise<void> - загрузить и закрыть
  handleAvatarDeleteAndClose, // () => Promise<void> - удалить и закрыть
  cleanup                     // () => void - очистка ресурсов
}
```

## Процесс загрузки аватара

```
1. Пользователь выбирает файл
        │
        ▼
2. handleAvatarChange()
   - Создаётся ObjectURL
   - Показывается Cropper
        │
        ▼
3. Пользователь обрезает изображение
        │
        ▼
4. confirmCrop()
   - Cropper создаёт canvas 400x400
   - Canvas конвертируется в Blob
   - Blob отправляется на сервер
        │
        ▼
5. Сервер возвращает avatar_url
   - Обновляется user.avatar_url
   - Увеличивается avatarKey для перерисовки
```

## Интеграция с CropperJS

```javascript
import Cropper from 'cropperjs'

cropper = new Cropper(cropperImage.value, {
  aspectRatio: 1,      // Квадратное соотношение
  viewMode: 1,         // Ограничить crop box областью изображения
  autoCropArea: 1,     // Автоматически занять всю область
  responsive: true,    // Адаптивность
  background: false    // Без клетчатого фона
})
```

## Формирование URL аватара

```javascript
function getAvatarUrl(avatarPath) {
  if (!avatarPath) return null

  // Если уже полный URL
  if (avatarPath.startsWith('http')) {
    return avatarPath
  }

  // Добавляем базовый URL
  const baseUrl = API_URL.replace('/api', '')
  return `${baseUrl}${avatarPath}`
}
```

## Генерация инициалов

```javascript
function getInitials(name) {
  if (!name) return '?'

  // Берём первые буквы первых двух слов
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }

  // Если одно слово - первые две буквы
  return name.substring(0, 2).toUpperCase()
}
```

## Очистка ресурсов

```javascript
function cleanup() {
  // Уничтожаем экземпляр Cropper
  if (cropper) {
    cropper.destroy()
    cropper = null
  }

  // Освобождаем ObjectURL
  if (selectedImageUrl.value) {
    URL.revokeObjectURL(selectedImageUrl.value)
    selectedImageUrl.value = ''
  }
}
```

## Использование в UserProfile.vue

```javascript
import { useUserAvatar } from '@/composables/useUserAvatar'

const {
  avatarKey,
  showCropper,
  handleAvatarChange,
  confirmCrop,
  cancelCrop,
  handleAvatarDelete,
  getAvatarUrl,
  getInitials,
  cleanup: cleanupAvatar
} = useUserAvatar({ user, authStore, API_URL })

// В template
<img
  v-if="user.avatar_url"
  :key="avatarKey"
  :src="getAvatarUrl(user.avatar_url)"
/>

<div v-else class="placeholder">
  {{ getInitials(user.username) }}
</div>

// При размонтировании
onBeforeUnmount(() => {
  cleanupAvatar()
})
```

## Связанные файлы

- `src/components/UserProfile.vue` — основной компонент профиля
- `src/stores/auth.js` — store авторизации
- API endpoint: `POST /profile/avatar`, `DELETE /profile/avatar`
