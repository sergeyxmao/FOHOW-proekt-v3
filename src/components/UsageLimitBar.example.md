# UsageLimitBar - Примеры использования

Компонент для отображения прогресс-бара использования лимитов ресурсов в системе подписок.

## Основные возможности

- Автоматическое получение данных о лимитах из subscription store
- Цветовая индикация: 🟢 Зелёный (0-70%), 🟡 Жёлтый (70-90%), 🔴 Красный (90-100%)
- Поддержка безлимитных тарифов
- Предупреждение при достижении лимита
- Адаптивный дизайн
- Поддержка темной темы

## Props

| Prop | Тип | Обязательный | По умолчанию | Описание |
|------|-----|--------------|--------------|----------|
| `resourceType` | String | Да | - | Тип ресурса: 'boards', 'notes', 'stickers', 'comments', 'cards' |
| `label` | String | Нет | auto | Название ресурса для отображения |
| `showDetails` | Boolean | Нет | true | Показывать заголовок с деталями |

## Примеры использования

### 1. Базовое использование

```vue
<template>
  <UsageLimitBar resourceType="boards" />
</template>

<script setup>
import UsageLimitBar from '@/components/UsageLimitBar.vue'
</script>
```

**Результат:** Отобразит "Доски: 5 / 10 (50%)" + зелёный прогресс-бар

### 2. С кастомным названием

```vue
<template>
  <UsageLimitBar
    resourceType="boards"
    label="Мои доски"
  />
</template>
```

**Результат:** Отобразит "Мои доски: 5 / 10 (50%)" + прогресс-бар

### 3. Без деталей (только прогресс-бар)

```vue
<template>
  <UsageLimitBar
    resourceType="notes"
    :showDetails="false"
  />
</template>
```

**Результат:** Отобразит только прогресс-бар без заголовка

### 4. Все типы ресурсов

```vue
<template>
  <div class="limits-dashboard">
    <h2>Использование ресурсов</h2>

    <UsageLimitBar resourceType="boards" label="Доски" />
    <UsageLimitBar resourceType="notes" label="Заметки" />
    <UsageLimitBar resourceType="stickers" label="Стикеры" />
    <UsageLimitBar resourceType="comments" label="Комментарии" />
    <UsageLimitBar resourceType="cards" label="Карточки" />
  </div>
</template>

<script setup>
import UsageLimitBar from '@/components/UsageLimitBar.vue'
</script>

<style scoped>
.limits-dashboard {
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

h2 {
  margin-bottom: 8px;
  font-size: 20px;
  font-weight: 700;
}
</style>
```

## Визуальные состояния

### Безлимитный тариф
Когда `max === -1`:
```
Доски: Безлимит
[✓ Безлимит]
```

### Нормальное использование (< 70%)
Когда использование меньше 70%:
```
Доски: 5 / 10 (50%)
[🟢▓▓▓▓▓░░░░░] - Зелёный прогресс-бар
```

### Высокое использование (70-90%)
Когда использование между 70% и 90%:
```
Заметки: 40 / 50 (80%)
[🟡▓▓▓▓▓▓▓▓░░] - Жёлтый прогресс-бар
```

### Критическое использование (90-100%)
Когда использование больше 90%:
```
Карточки: 48 / 50 (96%)
[🔴▓▓▓▓▓▓▓▓▓▓] - Красный прогресс-бар
```

### Лимит достигнут (100%)
Когда лимит полностью использован:
```
Стикеры: 20 / 20 (100%)
[🔴▓▓▓▓▓▓▓▓▓▓] - Красный прогресс-бар
[⚠️ Лимит достигнут. Обновите тариф]
```

## Интеграция с subscription store

Компонент автоматически:
1. Подключается к `useSubscriptionStore()`
2. Загружает план при монтировании (если данных нет)
3. Вызывает `subscriptionStore.checkLimit(resourceType)` для получения актуальных данных
4. Реактивно обновляется при изменении данных в store

## Пример интеграции в страницу настроек

```vue
<template>
  <div class="settings-page">
    <section class="subscription-section">
      <h2>Тарифный план</h2>
      <p class="plan-name">{{ currentPlan }}</p>

      <h3>Использование ресурсов</h3>
      <div class="limits-grid">
        <UsageLimitBar resourceType="boards" />
        <UsageLimitBar resourceType="notes" />
        <UsageLimitBar resourceType="cards" />
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import UsageLimitBar from '@/components/UsageLimitBar.vue'
import { useSubscriptionStore } from '@/stores/subscription'

const subscriptionStore = useSubscriptionStore()

const currentPlan = computed(() => {
  return subscriptionStore.currentPlan?.name || 'Загрузка...'
})
</script>

<style scoped>
.settings-page {
  max-width: 800px;
  margin: 0 auto;
  padding: 32px;
}

.subscription-section {
  background: white;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

h2 {
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 16px;
}

h3 {
  font-size: 18px;
  font-weight: 600;
  margin: 24px 0 16px;
}

.plan-name {
  font-size: 16px;
  color: #667eea;
  font-weight: 600;
  margin-bottom: 8px;
}

.limits-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
}

@media (max-width: 640px) {
  .settings-page {
    padding: 16px;
  }

  .limits-grid {
    grid-template-columns: 1fr;
  }
}
</style>
```

## Технические детали

### Дефолтные названия ресурсов

```javascript
const defaultLabels = {
  boards: 'Доски',
  notes: 'Заметки',
  stickers: 'Стикеры',
  comments: 'Комментарии',
  cards: 'Карточки'
}
```

### Цветовая схема

```javascript
// Зелёный: 0-70%
progressColor = '#4caf50'

// Жёлтый: 70-90%
progressColor = '#ffc107'

// Красный: 90-100%
progressColor = '#f44336'
```

## Требования

- Vue 3
- Pinia store с `useSubscriptionStore`
- Store должен реализовывать метод `checkLimit(resourceType)` который возвращает:
  ```javascript
  {
    current: Number,  // Текущее использование
    max: Number,      // Максимальный лимит (-1 для безлимита)
    canCreate: Boolean,
    percentage: Number // Процент использования
  }
  ```
