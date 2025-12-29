# useUserPersonalInfo.js

> Управление персональными данными пользователя

## Общая информация

| Параметр | Значение |
|----------|----------|
| **Файл** | `src/composables/useUserPersonalInfo.js` |
| **Размер** | ~441 строк |
| **Создан** | Декабрь 2025 (рефакторинг UserProfile.vue) |
| **Зависимости** | authStore, verificationStatus |

## Назначение

Composable для управления персональными данными:
- Редактирование профиля (имя, телефон, город и т.д.)
- Валидация представительства (office)
- Управление компьютерным номером (personal_id)
- Интеграция с верификацией

## API

### Входные параметры

```javascript
useUserPersonalInfo({
  user,               // Ref<User> - реактивный объект пользователя
  authStore,          // Pinia store авторизации
  verificationStatus, // Ref<Object> - статус верификации (для блокировки personal_id)
  cancelVerification, // () => Promise<void> - функция отмены верификации
  loadVerificationStatus // () => Promise<void> - функция загрузки статуса
})
```

### Возвращаемые значения

```javascript
{
  // Состояние
  personalForm,         // Ref<Object> - форма персональных данных
  personalError,        // Ref<string> - ошибка сохранения
  personalSuccess,      // Ref<string> - успешное сообщение
  savingPersonal,       // Ref<boolean> - процесс сохранения
  officeError,          // Ref<string> - ошибка валидации office
  personalIdEditable,   // Ref<boolean> - можно ли редактировать personal_id

  // Методы
  validateOffice,       // () => void - валидация представительства
  savePersonalInfo,     // () => Promise<void> - сохранить данные
  updatePersonalId,     // (value) => void - обновить компьютерный номер
  initializeForm        // () => void - инициализировать форму из user
}
```

## Структура формы

```javascript
const personalForm = ref({
  username: '',
  full_name: '',
  phone: '',
  city: '',
  country: '',
  office: '',
  personal_id: ''
})
```

## Валидация представительства

Формат представительства: 2-3 буквы + число (например, RUY68, CN123)

```javascript
function validateOffice() {
  const office = personalForm.value.office?.trim()

  if (!office) {
    officeError.value = ''
    return true
  }

  // Паттерн: 2-3 буквы + число
  const pattern = /^[A-Za-z]{2,3}\d+$/

  if (!pattern.test(office)) {
    officeError.value = 'Формат: 2-3 буквы + число (например, RUY68)'
    return false
  }

  officeError.value = ''
  return true
}
```

## Управление personal_id

Компьютерный номер блокируется в следующих случаях:
1. Пользователь уже верифицирован
2. Есть активная заявка на верификацию

```javascript
const personalIdEditable = computed(() => {
  // Если верифицирован - нельзя менять
  if (user.value?.is_verified) {
    return false
  }

  // Если есть pending заявка - нельзя менять
  if (verificationStatus.value?.hasPendingRequest) {
    return false
  }

  return true
})

async function updatePersonalId(value) {
  if (!personalIdEditable.value) return

  // Если была заявка - предложить отменить
  if (verificationStatus.value?.hasPendingRequest) {
    const confirm = window.confirm(
      'У вас есть активная заявка на верификацию. ' +
      'Для изменения компьютерного номера её нужно отменить. Отменить?'
    )

    if (confirm) {
      await cancelVerification()
      await loadVerificationStatus()
    } else {
      return
    }
  }

  personalForm.value.personal_id = value
}
```

## Сохранение данных

```javascript
async function savePersonalInfo() {
  // Валидация
  if (!validateOffice()) {
    return
  }

  personalError.value = ''
  personalSuccess.value = ''
  savingPersonal.value = true

  try {
    const response = await fetch(`${API_URL}/profile`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${authStore.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(personalForm.value)
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Ошибка сохранения')
    }

    const updatedUser = await response.json()

    // Обновляем данные в store
    Object.assign(user.value, updatedUser)
    authStore.user = updatedUser
    localStorage.setItem('user', JSON.stringify(updatedUser))

    personalSuccess.value = 'Данные успешно сохранены!'

    setTimeout(() => {
      personalSuccess.value = ''
    }, 3000)

  } catch (err) {
    personalError.value = err.message
  } finally {
    savingPersonal.value = false
  }
}
```

## Инициализация формы

```javascript
function initializeForm() {
  if (!user.value) return

  personalForm.value = {
    username: user.value.username || '',
    full_name: user.value.full_name || '',
    phone: user.value.phone || '',
    city: user.value.city || '',
    country: user.value.country || '',
    office: user.value.office || '',
    personal_id: user.value.personal_id || ''
  }
}
```

## Использование в UserProfile.vue

```javascript
import { useUserPersonalInfo } from '@/composables/useUserPersonalInfo'

const {
  personalForm,
  personalError,
  personalSuccess,
  savingPersonal,
  officeError,
  personalIdEditable,
  validateOffice,
  savePersonalInfo,
  updatePersonalId,
  initializeForm
} = useUserPersonalInfo({
  user,
  authStore,
  verificationStatus,
  cancelVerification,
  loadVerificationStatus
})

// Инициализация при монтировании
onMounted(() => {
  initializeForm()
})

// В template
<input
  v-model="personalForm.office"
  @input="validateOffice"
  :class="{ 'input-error': officeError }"
/>
<span v-if="officeError" class="error">{{ officeError }}</span>

<input
  v-model="personalForm.personal_id"
  :disabled="!personalIdEditable"
  @input="updatePersonalId($event.target.value)"
/>
```

## Связанные файлы

- `src/components/UserProfile.vue` — основной компонент профиля
- `src/stores/auth.js` — store авторизации
- `src/composables/useUserVerification.js` — верификация (для блокировки personal_id)
- API endpoint: `PUT /profile`
