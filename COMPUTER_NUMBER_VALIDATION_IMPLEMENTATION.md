# Реализация валидации Компьютерного номера и Представительства

## Описание задачи

Реализовать логику автоматической подстановки префикса из поля "Представительство" в поле "Компьютерный номер" с валидацией обоих полей.

### Текущее поведение:
- Компьютерный номер: полностью свободный ввод (например: RUY00240926666)
- Представительство: полностью свободный ввод (например: RUY68)

### Требуемое поведение:

#### Поле "Представительство":
- Формат: 3 буквы (английские) + 2-3 цифры
- Примеры: RUY00, RUY68, ABC123
- Валидация: ошибка если не соответствует формату

#### Поле "Компьютерный номер":
- Первая часть: автоматически подставляется значение из "Представительства"
- Вторая часть: ровно 9 цифр для редактирования пользователем
- Полный формат: {представительство}{9 цифр}
- Пример: RUY68240926666 (где RUY68 - префикс, 240926666 - 9 цифр)

## Технические требования

### Frontend (src/components/UserProfile.vue)

1. **Валидация поля "Представительство" (office)**
   - Паттерн: ^[A-Z]{3}\d{2,3}$
   - Сообщение об ошибке: "Представительство должно быть в формате: 3 английские буквы + 2-3 цифры (например: RUY68)"
   - Валидация происходит при изменении поля

2. **Автоматическое форматирование "Компьютерного номера"**
   - Computed property для вычисления префикса из office
   - При изменении office автоматически обновляется personal_id
   - Первые символы в personal_id всегда = значению office
   - Пользователь может редактировать только последние 9 цифр

3. **Компонент разделения номера**
   - Визуально разделить префикс от редактируемой части
   - Отключить редактирование первой части (префикса)

### Backend (API валидация)

1. **Endpoint обновления профиля**
   - При получении личной информации валидировать формат office
   - При получении personal_id проверять что первая часть соответствует office
   - Возвращать ошибку если валидация не пройдена

2. **Функции валидации (server.js или validator.js)**
```javascript
function validateOffice(office) {
  // Проверка формата: 3 буквы + 2-3 цифры
  const pattern = /^[A-Z]{3}\d{2,3}$/;
  return pattern.test(office);
}

function validatePersonalId(personalId, office) {
  // Проверка что personalId содержит правильный префикс
  // и 9 цифр после префикса
  if (!personalId.startsWith(office)) return false;
  
  const suffix = personalId.substring(office.length);
  const suffixPattern = /^\d{9}$/;
  
  return suffixPattern.test(suffix);
}
```

## Изменения в коде

### 1. Изменить шаблон поля "Представительство"

```html
<div class="form-group">
  <label for="office">Представительство:</label>
  <input
    id="office"
    v-model="personalForm.office"
    type="text"
    placeholder="RUY68"
    @input="validateOffice"
    :class="{ 'input-error': officeError }"
  />
  <div v-if="officeError" class="error-text">{{ officeError }}</div>
</div>
```

### 2. Изменить поле "Компьютерный номер"

```html
<div class="form-group">
  <label for="personal-id-input">
    Компьютерный номер:
    <span v-if="user.is_verified" class="verified-icon" title="Верифицирован">⭐</span>
  </label>
  <div class="personal-id-input-container">
    <span class="personal-id-prefix">{{ personalForm.office }}</span>
    <input
      id="personal-id-input"
      v-model="personalIdSuffix"
      type="text"
      placeholder="9 цифр"
      maxlength="9"
      @input="updatePersonalId"
      :class="{ 'input-error': personalIdError }"
    />
  </div>
  <div v-if="personalIdError" class="error-text">{{ personalIdError }}</div>
  <p class="hint-text">Введите 9 цифр после автоматического префикса</p>
</div>
```

### 3. Добавить data свойства

```javascript
const officeError = ref('')
const personalIdError = ref('')
const personalIdSuffix = ref('') // для хранения последних 9 цифр
```

### 4. Добавить методы валидации

```javascript
function validateOffice() {
  const office = personalForm.office.trim().toUpperCase()
  const pattern = /^[A-Z]{3}\d{2,3}$/
  
  if (!office) {
    officeError.value = ''
    return true
  }
  
  if (!pattern.test(office)) {
    officeError.value = 'Представительство должно быть в формате: 3 английские буквы + 2-3 цифры (например: RUY68)'
    return false
  }
  
  officeError.value = ''
  // Обновляем personal_id при изменении office
  updatePersonalId()
  return true
}

function updatePersonalId() {
  const office = personalForm.office.trim().toUpperCase()
  
  // Проверяем что последний ввод содержит только цифры
  const suffix = personalIdSuffix.value.replace(/\D/g, '')
  
  if (suffix.length > 9) {
    personalIdSuffix.value = suffix.slice(0, 9)
    return
  }
  
  personalForm.personal_id = office + suffix
  
  // Проверяем длину
  if (suffix.length === 9) {
    personalIdError.value = ''
  } else if (suffix.length > 0) {
    personalIdError.value = `Введено ${suffix.length}/9 цифр`
  }
}
```

### 5. Добавить стили

```css
.personal-id-input-container {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border: 2px solid var(--profile-input-border);
  border-radius: 12px;
  background: var(--profile-input-bg);
  transition: all 0.3s ease;
}

.personal-id-prefix {
  font-weight: 700;
  color: #667eea;
  font-size: 16px;
  min-width: max-content;
  padding: 0 4px;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
  border-radius: 6px;
  padding: 4px 8px;
}

.personal-id-input-container input {
  flex: 1;
  border: none;
  background: transparent;
  color: var(--profile-text);
  font-size: 16px;
  padding: 0;
}

.personal-id-input-container input:focus {
  outline: none;
}

.personal-id-input-container.input-error {
  border-color: #f44336;
}

.hint-text {
  font-size: 13px;
  color: var(--profile-muted);
  margin: 6px 0 0;
}

.error-text {
  color: #f44336;
  font-size: 13px;
  margin-top: 6px;
}
```

## Testing

### Тест-кейсы для валидации "Представительства":
1. ✓ RUY68 - должно пройти
2. ✓ ABC123 - должно пройти
3. ✗ RUY6 - ошибка (только 1 цифра)
4. ✗ RUY6888 - ошибка (4 цифры)
5. ✗ RUY - ошибка (нет цифр)
6. ✗ RU68 - ошибка (только 2 буквы)
7. ✗ RUYA68 - ошибка (4 буквы)
8. ✗ ruy68 - ошибка (строчные буквы)

### Тест-кейсы для валидации "Компьютерного номера":
1. ✓ Если office = RUY68, то personal_id = RUY68 + 9 цифр = RUY68240926666
2. ✓ При изменении office с RUY68 на ABC12, personal_id должен начинаться с ABC12
3. ✓ Пользователь может вводить только 9 цифр в поле суффикса
4. ✗ Если в суффиксе введены буквы, они должны быть отфильтрованы
5. ✓ Если суффикс < 9 цифр, показать "Введено X/9 цифр"

## Файлы для изменения

1. `src/components/UserProfile.vue` - основной компонент
2. `api/server.js` или `api/validators.js` - backend валидация
3. Возможно нужно обновить модель базы данных для хранения личной информации

## Дополнительные замечания

- Убедиться что валидация работает как на клиенте, так и на сервере
- После ввода 9 цифр в суффикс, показать полный компьютерный номер зеленым цветом
- Если личная информация верифицирована, не позволить менять personal_id (показать предупреждение)
- При сохранении, отправить на сервер оба поля: office и personal_id для двойной проверки
