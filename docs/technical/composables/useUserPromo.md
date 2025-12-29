# useUserPromo.js

> Применение промокодов

## Общая информация

| Параметр | Значение |
|----------|----------|
| **Файл** | `src/composables/useUserPromo.js` |
| **Размер** | ~73 строки |
| **Создан** | Декабрь 2025 (рефакторинг UserProfile.vue) |
| **Зависимости** | authStore, subscriptionStore |

## Назначение

Composable для работы с промокодами:
- Ввод промокода
- Применение промокода
- Обработка ошибок и успешных применений

## API

### Входные параметры

```javascript
useUserPromo({
  authStore,         // Pinia store авторизации
  subscriptionStore  // Pinia store подписок
})
```

### Возвращаемые значения

```javascript
{
  // Состояние
  promoCodeInput,   // Ref<string> - введённый промокод
  promoError,       // Ref<string> - ошибка применения
  promoSuccess,     // Ref<string> - успешное сообщение
  applyingPromo,    // Ref<boolean> - процесс применения

  // Методы
  handleApplyPromo, // () => Promise<void> - применить промокод
  clearForm         // () => void - очистить форму
}
```

## Применение промокода

```javascript
async function handleApplyPromo() {
  promoError.value = ''
  promoSuccess.value = ''

  const code = promoCodeInput.value.trim()

  // Валидация
  if (!code) {
    promoError.value = 'Введите промокод'
    return
  }

  applyingPromo.value = true

  try {
    // Применяем промокод через authStore
    await authStore.applyPromoCode(code)

    promoSuccess.value = 'Промокод успешно применен!'
    promoCodeInput.value = ''

    // Обновляем план подписки
    await subscriptionStore.loadPlan()

    // Скрываем сообщение через 5 секунд
    setTimeout(() => {
      promoSuccess.value = ''
    }, 5000)

  } catch (err) {
    promoError.value = err.message || 'Ошибка применения промокода'
  } finally {
    applyingPromo.value = false
  }
}
```

## Очистка формы

```javascript
function clearForm() {
  promoCodeInput.value = ''
  promoError.value = ''
  promoSuccess.value = ''
}
```

## Использование в UserProfile.vue

```javascript
import { useUserPromo } from '@/composables/useUserPromo'

const {
  promoCodeInput,
  promoError,
  promoSuccess,
  applyingPromo,
  handleApplyPromo
} = useUserPromo({ authStore, subscriptionStore })

// В template
<div class="promo-section">
  <h3>Промокод</h3>

  <div class="promo-form">
    <input
      v-model="promoCodeInput"
      type="text"
      placeholder="Введите промокод"
      :disabled="applyingPromo"
    />

    <button
      @click="handleApplyPromo"
      :disabled="applyingPromo || !promoCodeInput.trim()"
    >
      {{ applyingPromo ? 'Применение...' : 'Применить' }}
    </button>
  </div>

  <div v-if="promoError" class="error-message">
    {{ promoError }}
  </div>

  <div v-if="promoSuccess" class="success-message">
    {{ promoSuccess }}
  </div>
</div>
```

## Стили сообщений

```css
.error-message {
  color: #f44336;
  background: #ffebee;
  padding: 8px 12px;
  border-radius: 4px;
  margin-top: 8px;
}

.success-message {
  color: #4caf50;
  background: #e8f5e9;
  padding: 8px 12px;
  border-radius: 4px;
  margin-top: 8px;
}
```

## Процесс применения

```
1. Пользователь вводит промокод
        │
        ▼
2. handleApplyPromo()
   - Валидация (не пустой)
   - applyingPromo = true
        │
        ▼
3. authStore.applyPromoCode(code)
   - Отправка на сервер
   - Обновление данных пользователя
        │
        ▼
4. subscriptionStore.loadPlan()
   - Обновление текущего плана
        │
        ▼
5. Показ сообщения об успехе
   - Автоскрытие через 5 секунд
```

## Связанные файлы

- `src/components/UserProfile.vue` — основной компонент профиля
- `src/stores/auth.js` — store авторизации (метод applyPromoCode)
- `src/stores/subscription.js` — store подписок
- API endpoint: `POST /promo/apply`
