# useUserSocial.js

> Управление социальными сетями пользователя

## Общая информация

| Параметр | Значение |
|----------|----------|
| **Файл** | `src/composables/useUserSocial.js` |
| **Размер** | ~77 строк |
| **Создан** | Декабрь 2025 (рефакторинг UserProfile.vue) |
| **Зависимости** | authStore |

## Назначение

Composable для управления ссылками на социальные сети пользователя:
- Telegram
- VK
- Instagram
- Личный сайт

## API

### Входные параметры

```javascript
useUserSocial({
  user,       // Ref<User> - реактивный объект пользователя
  authStore   // Pinia store авторизации
})
```

### Возвращаемые значения

```javascript
{
  // Состояние
  socialForm,      // Ref<Object> - форма социальных сетей
  socialError,     // Ref<string> - ошибка сохранения
  socialSuccess,   // Ref<string> - успешное сообщение
  savingSocial,    // Ref<boolean> - процесс сохранения

  // Методы
  saveSocialInfo,   // () => Promise<void> - сохранить данные
  initializeForm    // () => void - инициализировать форму
}
```

## Структура формы

```javascript
const socialForm = ref({
  telegram_user: '',
  vk_profile: '',
  instagram_profile: '',
  website: ''
})
```

## Сохранение данных

Функция `saveSocialInfo` отправляет данные на сервер через `authStore.updateProfile()` и синхронизирует форму с ответом сервера:

```javascript
async function saveSocialInfo() {
  socialError.value = ''
  socialSuccess.value = ''
  savingSocial.value = true

  try {
    const profileData = {
      telegram_user: socialForm.telegram_user?.trim() || '',
      vk_profile: socialForm.vk_profile?.trim() || '',
      instagram_profile: socialForm.instagram_profile?.trim() || '',
      website: socialForm.website?.trim() || ''
    }

    const updatedUser = await authStore.updateProfile(profileData)

    // ВАЖНО: Синхронизируем форму с данными из ответа сервера
    if (updatedUser) {
      if (user?.value) {
        user.value = { ...user.value, ...updatedUser }
      }

      // Обновляем все поля формы из ответа сервера
      socialForm.telegram_user = updatedUser.telegram_user || ''
      socialForm.vk_profile = updatedUser.vk_profile || ''
      socialForm.instagram_profile = updatedUser.instagram_profile || ''
      socialForm.website = updatedUser.website || ''
    }

    socialSuccess.value = 'Социальные сети успешно обновлены!'

    setTimeout(() => {
      socialSuccess.value = ''
    }, 3000)

  } catch (err) {
    socialError.value = err.message || 'Произошла ошибка при сохранении'
  } finally {
    savingSocial.value = false
  }
}
```

### Почему важно обновлять форму после сохранения

После успешного ответа от сервера необходимо:
1. Обновить `user.value` — для синхронизации с authStore
2. Обновить все поля `socialForm` — чтобы UI отображал актуальные данные, включая `website`

Без этой синхронизации поле "Сайт (URL)" может показывать пустое или старое значение после сохранения.

## Инициализация формы

```javascript
function initializeForm() {
  if (!user.value) return

  socialForm.value = {
    telegram_user: user.value.telegram_user || '',
    vk_profile: user.value.vk_profile || '',
    instagram_profile: user.value.instagram_profile || '',
    website: user.value.website || ''
  }
}
```

## Использование в UserProfile.vue

```javascript
import { useUserSocial } from '@/composables/useUserSocial'

const {
  socialForm,
  socialError,
  socialSuccess,
  savingSocial,
  saveSocialInfo,
  initializeForm: initializeSocialForm
} = useUserSocial({ user, authStore })

// Инициализация при монтировании
onMounted(() => {
  initializeSocialForm()
})

// В template
<form @submit.prevent="saveSocialInfo">
  <input v-model="socialForm.telegram_user" placeholder="@username" />
  <input v-model="socialForm.vk_profile" placeholder="vk.com/..." />
  <input v-model="socialForm.instagram_profile" placeholder="@instagram" />
  <input v-model="socialForm.website" placeholder="https://..." />

  <button type="submit" :disabled="savingSocial">
    {{ savingSocial ? 'Сохранение...' : 'Сохранить' }}
  </button>
</form>

<div v-if="socialError" class="error">{{ socialError }}</div>
<div v-if="socialSuccess" class="success">{{ socialSuccess }}</div>
```

## Связанные файлы

- `src/components/UserProfile.vue` — основной компонент профиля
- `src/stores/auth.js` — store авторизации
- API endpoints:
  - `PUT /api/profile` — обновление профиля (включая социальные сети)
  - `GET /api/profile` — получение профиля (включая поле `website`)
