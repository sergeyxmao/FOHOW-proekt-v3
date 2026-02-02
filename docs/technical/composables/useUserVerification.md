# useUserVerification.js

> Верификация пользователя: статус, отправка запросов, история

## Общая информация

| Параметр | Значение |
|----------|----------|
| **Файл** | `src/composables/useUserVerification.js` |
| **Размер** | ~455 строк |
| **Создан** | Декабрь 2025 (рефакторинг UserProfile.vue) |
| **Зависимости** | authStore, personalForm |

## Назначение

Composable для управления процессом верификации пользователя:
- Проверка статуса верификации
- Отправка заявки на верификацию
- История заявок
- Cooldown между повторными заявками
- Отмена заявки

## Константы

```javascript
const VERIFICATION_COOLDOWN_MS = 60 * 60 * 1000  // 1 час между заявками
const VERIFICATION_CHECK_INTERVAL = 30000         // Проверка каждые 30 секунд
```

## API

### Входные параметры

```javascript
useUserVerification({
  user,         // Ref<User> - реактивный объект пользователя
  authStore,    // Pinia store авторизации
  API_URL,      // String - базовый URL API
  personalForm  // Ref<Object> - форма персональных данных (для personal_id)
})
```

### Возвращаемые значения

```javascript
{
  // Состояние
  verificationStatus,      // Ref<Object> - текущий статус верификации
  showVerificationModal,   // Ref<boolean> - показать модальное окно
  verificationForm,        // Ref<Object> - форма заявки
  verificationError,       // Ref<string> - ошибка
  submittingVerification,  // Ref<boolean> - отправка в процессе
  cancellingVerification,  // Ref<boolean> - отмена в процессе
  verificationHistory,     // Ref<Array> - история заявок
  loadingHistory,          // Ref<boolean> - загрузка истории
  showHistory,             // Ref<boolean> - показать историю
  cooldownTimeRemaining,   // Ref<number> - оставшееся время cooldown (мс)

  // Computed
  canSubmitVerification,    // Computed<boolean> - можно ли отправить заявку
  cooldownMessage,          // Computed<string> - сообщение о cooldown
  verificationBlockReason,  // Computed<string|null> - причина блокировки кнопки

  // Методы
  loadVerificationStatus,  // () => Promise<void> - загрузить статус
  loadVerificationHistory, // () => Promise<void> - загрузить историю
  openHistory,             // () => void
  closeHistory,            // () => void
  getStatusLabel,          // (status) => string - человекочитаемый статус
  getStatusClass,          // (status) => string - CSS класс для статуса
  openVerificationModal,   // () => void
  closeVerificationModal,  // () => void
  submitVerification,      // () => Promise<void> - отправить заявку
  cancelVerification,      // () => Promise<void> - отменить заявку
  startVerificationCheck,  // () => void - запустить периодическую проверку
  cleanup                  // () => void - очистка таймеров
}
```

## Форма верификации

```javascript
verificationForm = {
  full_name: '',      // обязательное
  referral_link: ''   // обязательное
}
```

### Валидация referral_link

- Поле `referral_link` обязательно.
- Ссылка должна:
  - начинаться с `http://www.fohow`
  - содержать параметр `id=`
  - иметь длину не более 60 символов

Пример корректной ссылки:

```
http://www.fohow.plus/clientRegProm?id=2891936
```

## Статусы верификации

| Статус | Описание | CSS класс |
|--------|----------|-----------|
| `none` | Нет заявки | — |
| `pending` | На рассмотрении | `status--pending` |
| `approved` | Одобрено | `status--approved` |
| `rejected` | Отклонено | `status--rejected` |
| `cancelled` | Отменено | `status--cancelled` |

## Процесс верификации

```
1. Пользователь открывает модальное окно
        │
        ▼
2. canSubmitVerification проверяет:
   - Есть personal_id
   - Номер валиден (офис + 9 цифр)
   - Нет активной заявки
   - Нет несохранённых изменений номера
   - Прошёл cooldown
        │
        ▼
3. Пользователь заполняет форму и отправляет
        │
        ▼
4. submitVerification()
   - Отправка FormData на сервер
   - Установка cooldown
        │
        ▼
5. Периодическая проверка статуса
   - startVerificationCheck() каждые 30 сек
        │
        ▼
6. При изменении статуса:
   - approved → user.is_verified = true
   - rejected → можно отправить повторно
```

## Проверка несохранённых изменений

Кнопка "Верифицировать" блокируется, если номер в форме отличается от сохранённого в БД. Это предотвращает отправку заявки со старым номером.

```javascript
// В canSubmitVerification
const savedPersonalId = user.value?.personal_id || ''
const formPersonalId = personalForm.personal_id?.trim() || ''
if (formPersonalId !== savedPersonalId) return false
```

## verificationBlockReason

Computed-свойство, которое возвращает причину блокировки кнопки для отображения пользователю:

```javascript
const verificationBlockReason = computed(() => {
  if (verificationStatus.hasPendingRequest) return null  // Свой UI

  if (!personalForm.personal_id?.trim()) {
    return 'Введите компьютерный номер'
  }

  // Проверка валидности формата номера
  const personalId = personalForm.personal_id.trim()
  const office = personalForm.office?.trim().toUpperCase() || ''
  if (!/^[A-Z]{3}\d{2,3}$/.test(office)) {
    return 'Некорректный формат представительства'
  }
  if (!personalId.startsWith(office)) {
    return 'Номер должен начинаться с представительства'
  }
  const suffix = personalId.slice(office.length)
  if (!/^\d{9}$/.test(suffix)) {
    const digitCount = suffix.replace(/\D/g, '').length
    return `Введите 9 цифр после префикса (сейчас ${digitCount}/9)`
  }

  const savedPersonalId = user.value?.personal_id || ''
  if (personalId !== savedPersonalId) {
    return 'Сначала сохраните изменения'
  }

  if (verificationStatus.cooldownUntil) {
    // Кулдаун показывается через cooldownMessage
    return null
  }

  return null
})
```

## Cooldown механизм

```javascript
// Проверка cooldown
const canSubmitVerification = computed(() => {
  // Если есть активная заявка - нельзя
  if (verificationStatus.value?.hasPendingRequest) {
    return false
  }

  // Если нет personal_id - нельзя
  if (!personalForm.personal_id?.trim()) {
    return false
  }

  // Если номер невалиден (должен быть офис + 9 цифр) - нельзя
  const personalId = personalForm.personal_id.trim()
  const office = personalForm.office?.trim().toUpperCase() || ''
  if (!/^[A-Z]{3}\d{2,3}$/.test(office)) return false
  if (!personalId.startsWith(office)) return false
  const suffix = personalId.slice(office.length)
  if (!/^\d{9}$/.test(suffix)) return false

  // Если есть несохранённые изменения - нельзя
  const savedPersonalId = user.value?.personal_id || ''
  if (personalId !== savedPersonalId) {
    return false
  }

  // Проверяем время последней заявки
  const lastRequest = verificationStatus.value?.lastRequestTime
  if (lastRequest) {
    const elapsed = Date.now() - new Date(lastRequest).getTime()
    if (elapsed < VERIFICATION_COOLDOWN_MS) {
      return false
    }
  }

  return true
})

// Форматирование оставшегося времени
const cooldownMessage = computed(() => {
  if (cooldownTimeRemaining.value <= 0) return ''

  const minutes = Math.ceil(cooldownTimeRemaining.value / 60000)
  return `Повторная заявка возможна через ${minutes} мин`
})
```

## Отправка заявки

```javascript
async function submitVerification() {
  if (!canSubmitVerification.value) return

  submittingVerification.value = true
  verificationError.value = ''

  try {
    const formData = new FormData()
    formData.append('personal_id', personalForm.value.personal_id)
    formData.append('full_name', verificationForm.value.full_name.trim())
    formData.append('referral_link', verificationForm.value.referral_link.trim())

    const response = await fetch(`${API_URL}/verification/submit`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      },
      body: formData
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message)
    }

    // Обновляем статус
    await loadVerificationStatus()
    closeVerificationModal()

  } catch (err) {
    verificationError.value = err.message
  } finally {
    submittingVerification.value = false
  }
}
```

## Периодическая проверка

```javascript
let checkInterval = null

function startVerificationCheck() {
  // Останавливаем предыдущий интервал
  if (checkInterval) {
    clearInterval(checkInterval)
  }

  // Только если есть pending заявка
  if (!verificationStatus.value?.hasPendingRequest) {
    return
  }

  checkInterval = setInterval(async () => {
    await loadVerificationStatus()

    // Если статус изменился - останавливаем
    if (!verificationStatus.value?.hasPendingRequest) {
      clearInterval(checkInterval)
      checkInterval = null
    }
  }, VERIFICATION_CHECK_INTERVAL)
}

function cleanup() {
  if (checkInterval) {
    clearInterval(checkInterval)
    checkInterval = null
  }
}
```

## Использование в UserProfile.vue

```javascript
import { useUserVerification } from '@/composables/useUserVerification'

const {
  verificationStatus,
  canSubmitVerification,
  cooldownMessage,
  verificationBlockReason,
  submitVerification,
  cancelVerification,
  startVerificationCheck,
  cleanup: cleanupVerification
} = useUserVerification({ user, authStore, API_URL, personalForm })

// Запуск проверки при монтировании
onMounted(() => {
  loadVerificationStatus()
  startVerificationCheck()
})

// Очистка при размонтировании
onBeforeUnmount(() => {
  cleanupVerification()
})
```

## Связанные файлы

- `src/components/UserProfile.vue` — основной компонент профиля
- `src/stores/auth.js` — store авторизации
- API endpoints:
  - `GET /verification/status`
  - `POST /verification/submit`
  - `POST /verification/cancel`
  - `GET /verification/history`

## История изменений

| Дата | Изменение |
|------|-----------|
| 2025-02-02 | Исправлен баг жадного regex при подсчёте цифр: заменено извлечение офиса через `match(/^[A-Z]{3}\d{2,3}/)` на использование `personalForm.office` |
| Декабрь 2025 | Создание composable (рефакторинг UserProfile.vue) |
