# useUserPrivacy.js

> Управление настройками конфиденциальности

## Общая информация

| Параметр | Значение |
|----------|----------|
| **Файл** | `src/composables/useUserPrivacy.js` |
| **Размер** | ~114 строк |
| **Создан** | Декабрь 2025 (рефакторинг UserProfile.vue) |
| **Зависимости** | authStore |

## Назначение

Composable для управления настройками видимости полей профиля для поиска:
- Какие поля видны другим пользователям при поиске
- Toggle для каждого поля
- Сохранение настроек на сервере

## API

### Входные параметры

```javascript
useUserPrivacy({
  user,       // Ref<User> - реактивный объект пользователя
  authStore,  // Pinia store авторизации
  API_URL     // String - базовый URL API
})
```

### Возвращаемые значения

```javascript
{
  // Состояние
  privacySettings,   // Ref<Object> - настройки видимости полей
  privacyError,      // Ref<string> - ошибка сохранения
  privacySuccess,    // Ref<string> - успешное сообщение
  savingPrivacy,     // Ref<boolean> - процесс сохранения

  // Методы
  togglePrivacy,        // (field) => void - переключить настройку
  savePrivacySettings,  // () => Promise<void> - сохранить настройки
  initializeSettings    // () => void - инициализировать из user
}
```

## Структура настроек

```javascript
const privacySettings = ref({
  username: false,          // Видимость имени пользователя
  full_name: false,         // Видимость полного имени
  phone: false,             // Видимость телефона
  city: false,              // Видимость города
  country: false,           // Видимость страны
  office: false,            // Видимость представительства
  personal_id: false,       // Видимость компьютерного номера
  telegram_user: false,     // Видимость Telegram
  vk_profile: false,        // Видимость VK
  instagram_profile: false, // Видимость Instagram
  website: false            // Видимость сайта
})
```

## Переключение настройки

```javascript
function togglePrivacy(field) {
  privacySettings.value[field] = !privacySettings.value[field]
}
```

## Сохранение настроек

```javascript
async function savePrivacySettings() {
  privacyError.value = ''
  privacySuccess.value = ''
  savingPrivacy.value = true

  try {
    const response = await fetch(`${API_URL}/profile/privacy`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${authStore.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        search_settings: privacySettings.value
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Ошибка сохранения настроек')
    }

    const result = await response.json()

    // Обновляем search_settings в user
    if (user.value) {
      user.value.search_settings = result.search_settings
    }

    privacySuccess.value = 'Настройки конфиденциальности сохранены!'

    setTimeout(() => {
      privacySuccess.value = ''
    }, 3000)

  } catch (err) {
    privacyError.value = err.message || 'Произошла ошибка при сохранении'
  } finally {
    savingPrivacy.value = false
  }
}
```

## Инициализация настроек

```javascript
function initializeSettings() {
  if (user.value && user.value.search_settings) {
    privacySettings.value = {
      username: user.value.search_settings.username || false,
      full_name: user.value.search_settings.full_name || false,
      phone: user.value.search_settings.phone || false,
      city: user.value.search_settings.city || false,
      country: user.value.search_settings.country || false,
      office: user.value.search_settings.office || false,
      personal_id: user.value.search_settings.personal_id || false,
      telegram_user: user.value.search_settings.telegram_user || false,
      vk_profile: user.value.search_settings.vk_profile || false,
      instagram_profile: user.value.search_settings.instagram_profile || false,
      website: user.value.search_settings.website || false
    }
  }
}
```

## Использование в UserProfile.vue

```javascript
import { useUserPrivacy } from '@/composables/useUserPrivacy'

const {
  privacySettings,
  privacyError,
  privacySuccess,
  savingPrivacy,
  togglePrivacy,
  savePrivacySettings,
  initializeSettings: initializePrivacySettings
} = useUserPrivacy({ user, authStore, API_URL })

// Инициализация при монтировании
onMounted(() => {
  initializePrivacySettings()
})

// В template
<div class="privacy-settings">
  <div v-for="(value, field) in privacySettings" :key="field" class="privacy-item">
    <label>
      <input
        type="checkbox"
        :checked="value"
        @change="togglePrivacy(field)"
      />
      {{ getFieldLabel(field) }}
    </label>
  </div>

  <button @click="savePrivacySettings" :disabled="savingPrivacy">
    {{ savingPrivacy ? 'Сохранение...' : 'Сохранить настройки' }}
  </button>
</div>

<div v-if="privacyError" class="error">{{ privacyError }}</div>
<div v-if="privacySuccess" class="success">{{ privacySuccess }}</div>
```

## Связанные файлы

- `src/components/UserProfile.vue` — основной компонент профиля
- `src/stores/auth.js` — store авторизации
- API endpoint: `PUT /profile/privacy`
