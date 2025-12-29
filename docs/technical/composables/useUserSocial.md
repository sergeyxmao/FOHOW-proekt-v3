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

```javascript
async function saveSocialInfo() {
  socialError.value = ''
  socialSuccess.value = ''
  savingSocial.value = true

  try {
    const response = await fetch(`${API_URL}/profile/social`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${authStore.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(socialForm.value)
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Ошибка сохранения')
    }

    const updatedUser = await response.json()

    // Обновляем данные
    Object.assign(user.value, updatedUser)
    authStore.user = updatedUser
    localStorage.setItem('user', JSON.stringify(updatedUser))

    socialSuccess.value = 'Социальные сети сохранены!'

    setTimeout(() => {
      socialSuccess.value = ''
    }, 3000)

  } catch (err) {
    socialError.value = err.message
  } finally {
    savingSocial.value = false
  }
}
```

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
- API endpoint: `PUT /profile/social`
