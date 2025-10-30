<template>
  <div
    :class="[
      'user-profile',
      { 'user-profile--modern': props.isModernTheme }
    ]"
  >
    <div class="profile-header">
      <h2>Мой профиль</h2>
      <button class="close-btn" @click="$emit('close')">×</button>
    </div>

    <div v-if="loading" class="loading">Загрузка...</div>

    <div v-else class="profile-content">
      <!-- Информация о профиле -->
      <div v-if="!editMode" class="profile-view">
        <div class="profile-field">
          <label>Email:</label>
          <span>{{ user.email }}</span>
        </div>
        
        <div class="profile-field">
          <label>Имя пользователя:</label>
          <span>{{ user.username || 'Не указано' }}</span>
        </div>
        
        <div class="profile-field">
          <label>Дата регистрации:</label>
          <span>{{ formatDate(user.created_at) }}</span>
        </div>

        <div class="profile-actions">
          <button class="btn-primary" @click="editMode = true">
            Редактировать профиль
          </button>
          <button class="btn-danger" @click="showDeleteConfirm = true">
            Удалить аккаунт
          </button>
        </div>
      </div>

      <!-- Форма редактирования -->
      <form v-else class="profile-edit" @submit.prevent="handleUpdate">
        <div class="form-group">
          <label>Имя пользователя:</label>
          <input
            v-model="editForm.username"
            type="text"
            placeholder="Введите имя пользователя"
          />
        </div>

        <div class="form-group">
          <label>Email:</label>
          <input
            v-model="editForm.email"
            type="email"
            required
          />
        </div>

        <div class="form-divider">
          <span>Изменить пароль (необязательно)</span>
        </div>

<div class="form-group">
  <label>Текущий пароль:</label>
  <div class="password-input">
    <input
      v-model="editForm.currentPassword"
      :type="passwordVisibility.current ? 'text' : 'password'"
      placeholder="Оставьте пустым, если не меняете пароль"
      autocomplete="off"
      @paste.prevent
      @drop.prevent
    />
    <button
      v-if="editForm.currentPassword"
      type="button"
      class="password-toggle"
      @click="togglePasswordVisibility('current')"
    >
      {{ passwordVisibility.current ? 'Скрыть' : 'Показать' }}
    </button>
  </div>
  <small class="field-hint">Требуется только если меняете пароль</small>
</div>

<div class="form-group">
  <label>Новый пароль:</label>
  <div class="password-input">
    <input
      v-model="editForm.newPassword"
      :type="passwordVisibility.new ? 'text' : 'password'"
      placeholder="Оставьте пустым, если не меняете"
      minlength="6"
      autocomplete="off"
      @paste.prevent
      @drop.prevent
    />
    <button
      v-if="editForm.newPassword"
      type="button"
      class="password-toggle"
      @click="togglePasswordVisibility('new')"
    >
      {{ passwordVisibility.new ? 'Скрыть' : 'Показать' }}
    </button>
  </div>
  <small class="field-hint">Минимум 6 символов</small>
</div>

<div class="form-group">
  <label>Повторите новый пароль:</label>
  <div class="password-input">
    <input
      v-model="editForm.confirmPassword"
      :type="passwordVisibility.confirm ? 'text' : 'password'"
      placeholder="Повторите новый пароль"
      minlength="6"
      autocomplete="off"
      @paste.prevent
      @drop.prevent
    />
    <button
      v-if="editForm.confirmPassword"
      type="button"
      class="password-toggle"
      @click="togglePasswordVisibility('confirm')"
    >
      {{ passwordVisibility.confirm ? 'Скрыть' : 'Показать' }}
    </button>
  </div>
</div>

        <div v-if="error" class="error-message">{{ error }}</div>
        <div v-if="success" class="success-message">{{ success }}</div>

        <div class="form-actions">
          <button type="submit" class="btn-primary" :disabled="updating">
            {{ updating ? 'Сохранение...' : 'Сохранить изменения' }}
          </button>
          <button type="button" class="btn-secondary" @click="cancelEdit">
            Отмена
          </button>
        </div>
      </form>
    </div>

    <!-- Подтверждение удаления -->
    <div v-if="showDeleteConfirm" class="modal-overlay" @click.self="showDeleteConfirm = false">
      <div class="delete-confirm">
        <button class="delete-confirm__close" @click="showDeleteConfirm = false">×</button>        
        <h3>⚠️ Удаление аккаунта</h3>
        <p>Вы уверены? Это действие необратимо!</p>
        
        <div class="form-group">
          <label>Введите пароль для подтверждения:</label>
          <div class="password-input">
            <input
              v-model="deletePassword"
              :type="passwordVisibility.delete ? 'text' : 'password'"
              placeholder="Ваш пароль"
              autocomplete="current-password"
              @paste.prevent
              @drop.prevent
            />
            <button
              type="button"
              class="password-toggle"
              @click="togglePasswordVisibility('delete')"
            >
              {{ passwordVisibility.delete ? 'Скрыть' : 'Показать' }}
            </button>
          </div>
        </div>

        <div v-if="deleteError" class="error-message">{{ deleteError }}</div>

        <div class="form-actions">
          <button class="btn-danger" :disabled="deleting" @click="handleDelete">
            {{ deleting ? 'Удаление...' : 'Удалить аккаунт' }}
          </button>
          <button class="btn-secondary" @click="showDeleteConfirm = false">
            Отмена
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
const props = defineProps({
  isModernTheme: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close'])

const authStore = useAuthStore()
const API_URL = import.meta.env.VITE_API_URL || 'https://interactive.marketingfohow.ru/api'

const user = ref({})
const loading = ref(true)
const editMode = ref(false)
const editForm = ref({
  username: '',
  email: '',
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const error = ref('')
const success = ref('')
const updating = ref(false)

const showDeleteConfirm = ref(false)
const deletePassword = ref('')
const deleteError = ref('')
const deleting = ref(false)
const passwordVisibility = reactive({
  current: false,
  new: false,
  confirm: false,
  delete: false
})

function togglePasswordVisibility(field) {
  passwordVisibility[field] = !passwordVisibility[field]
}

watch(showDeleteConfirm, (visible) => {
  if (!visible) {
    deletePassword.value = ''
    deleteError.value = ''
    passwordVisibility.delete = false
  }
})

async function loadProfile() {
  loading.value = true
  try {
    const response = await fetch(`${API_URL}/profile`, {
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Ошибка загрузки профиля')
    }

    user.value = data.user
    editForm.value.username = data.user.username || ''
    editForm.value.email = data.user.email
    editForm.value.currentPassword = ''
    editForm.value.newPassword = ''
    editForm.value.confirmPassword = ''    
  } catch (err) {
    console.error('Ошибка загрузки профиля:', err)
  } finally {
    loading.value = false
  }
}

async function handleUpdate() {
  error.value = ''
  success.value = ''
  updating.value = true

  try {
    const trimmedUsername = editForm.value.username?.trim() || ''
    const trimmedEmail = editForm.value.email?.trim() || ''

    if (!trimmedEmail) {
      throw new Error('Укажите корректный email')
    }

    // Проверяем, нужно ли менять пароль
    const isChangingPassword = editForm.value.newPassword || editForm.value.confirmPassword || editForm.value.currentPassword

    if (isChangingPassword) {
      // Если хотя бы одно поле пароля заполнено - требуем все
      if (!editForm.value.currentPassword) {
        throw new Error('Введите текущий пароль')
      }
      if (!editForm.value.newPassword) {
        throw new Error('Введите новый пароль')
      }
      if (!editForm.value.confirmPassword) {
        throw new Error('Повторите новый пароль')
      }
      if (editForm.value.newPassword !== editForm.value.confirmPassword) {
        throw new Error('Новые пароли не совпадают')
      }
    }
    
    const body = {
      email: trimmedEmail
    }
    
    if (trimmedUsername) {
      body.username = trimmedUsername
    }

    // Добавляем пароли ТОЛЬКО если реально меняем пароль
    if (isChangingPassword && editForm.value.newPassword && editForm.value.currentPassword) {
      body.currentPassword = editForm.value.currentPassword
      body.newPassword = editForm.value.newPassword
    }

    const response = await fetch(`${API_URL}/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authStore.token}`
      },
      body: JSON.stringify(body)
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Ошибка обновления профиля')
    }

    user.value = data.user
    authStore.user = data.user
    success.value = 'Профиль успешно обновлён!'
    
    setTimeout(() => {
      editMode.value = false
      editForm.value.currentPassword = ''
      editForm.value.newPassword = ''
      editForm.value.confirmPassword = ''
      passwordVisibility.current = false
      passwordVisibility.new = false
      passwordVisibility.confirm = false      
    }, 1500)
  } catch (err) {
    error.value = err.message
  } finally {
    updating.value = false
  }
}

function cancelEdit() {
  editMode.value = false
  editForm.value.username = user.value.username || ''
  editForm.value.email = user.value.email
  editForm.value.currentPassword = ''
  editForm.value.newPassword = ''
  editForm.value.confirmPassword = ''  
  error.value = ''
  success.value = ''
  passwordVisibility.current = false
  passwordVisibility.new = false
  passwordVisibility.confirm = false  
}

async function handleDelete() {
  deleteError.value = ''
  
  if (!deletePassword.value) {
    deleteError.value = 'Введите пароль'
    return
  }

  deleting.value = true

  try {
    const response = await fetch(`${API_URL}/profile`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authStore.token}`
      },
      body: JSON.stringify({ password: deletePassword.value })
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Ошибка удаления аккаунта')
    }
    showDeleteConfirm.value = false
    alert('Аккаунт успешно удалён')
    authStore.logout()
    emit('close')
  } catch (err) {
    deleteError.value = err.message
  } finally {
    deleting.value = false
  }
}

function formatDate(dateString) {
  if (!dateString) return 'Неизвестно'
  const date = new Date(dateString)
  return date.toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

onMounted(() => {
  loadProfile()
})
</script>

<style scoped>
.user-profile {
  position: relative;
  max-width: 600px;
  width: min(600px, calc(100vw - 48px));
  max-height: min(92vh, 720px);
  overflow-y: auto;
  border-radius: 24px;
  padding: 40px 40px 32px;
  box-sizing: border-box;
  background: var(--profile-bg);
  color: var(--profile-text);
  box-shadow: var(--profile-shadow);
  transition: background 0.3s ease, color 0.3s ease, box-shadow 0.3s ease;
  --profile-bg: #ffffff;
  --profile-shadow: 0 32px 64px rgba(15, 23, 42, 0.18);
  --profile-text: #111827;
  --profile-muted: #666666;
  --profile-border: #d1d5db;
  --profile-input-bg: #ffffff;
  --profile-input-border: #d1d5db;
  --profile-input-placeholder: #94a3b8;
  --profile-control-bg: #f1f5f9;
  --profile-control-bg-hover: #e2e8f0;
  --profile-control-text: #2563eb;
  --profile-control-text-hover: #1d4ed8;
  --profile-divider: #e5e7eb;
  --profile-overlay: rgba(0, 0, 0, 0.5);
  --profile-modal-bg: #ffffff;
  --profile-modal-shadow: 0 24px 48px rgba(15, 23, 42, 0.16);
  --profile-error-text: #f44336;
  --profile-error-bg: #ffebee;
  --profile-success-text: #4caf50;
  --profile-success-bg: #e8f5e9;
  --profile-secondary-bg: #f5f5f5;
  --profile-secondary-bg-hover: #e0e0e0;
  --profile-secondary-text: #333333;
  --profile-close-color: #999999;
  --profile-close-color-hover: #333333;
}

.user-profile--modern {
  --profile-bg: rgba(17, 24, 39, 0.95);
  --profile-shadow: 0 40px 70px rgba(2, 6, 23, 0.65);
  --profile-text: #e2e8f0;
  --profile-muted: rgba(148, 163, 184, 0.9);
  --profile-border: rgba(148, 163, 184, 0.35);
  --profile-input-bg: rgba(15, 23, 42, 0.9);
  --profile-input-border: rgba(148, 163, 184, 0.4);
  --profile-input-placeholder: rgba(148, 163, 184, 0.7);
  --profile-control-bg: rgba(30, 41, 59, 0.85);
  --profile-control-bg-hover: rgba(51, 65, 85, 0.95);
  --profile-control-text: #38bdf8;
  --profile-control-text-hover: #0ea5e9;
  --profile-divider: rgba(148, 163, 184, 0.24);
  --profile-overlay: rgba(4, 10, 24, 0.72);
  --profile-modal-bg: rgba(17, 24, 39, 0.96);
  --profile-modal-shadow: 0 30px 60px rgba(2, 6, 23, 0.6);
  --profile-error-text: #fca5a5;
  --profile-error-bg: rgba(239, 68, 68, 0.18);
  --profile-success-text: #86efac;
  --profile-success-bg: rgba(34, 197, 94, 0.18);
  --profile-secondary-bg: rgba(148, 163, 184, 0.16);
  --profile-secondary-bg-hover: rgba(148, 163, 184, 0.24);
  --profile-secondary-text: #e2e8f0;
  --profile-close-color: rgba(226, 232, 240, 0.6);
  --profile-close-color-hover: #e2e8f0;  
}

.profile-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
}

.profile-header h2 {
  margin: 0;
  color: var(--profile-text);
}

.close-btn,
.delete-confirm__close {
  background: none;
  border: none;
  font-size: 30px;
  cursor: pointer;
  color: var(--profile-close-color);
  transition: color 0.2s ease;
}

.close-btn:hover,
.delete-confirm__close:hover {
  color: var(--profile-close-color-hover);
}

.loading {
  text-align: center;
  padding: 40px;
  color: var(--profile-muted);
}

.profile-view {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.profile-field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.profile-field label {
  font-weight: 600;
  color: var(--profile-muted);
  font-size: 14px;
}

.profile-field span {
  font-size: 16px;
  color: var(--profile-text);
}

.profile-actions {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

.profile-edit {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.form-group label {
  font-weight: 600;
  font-size: 14px;
  color: var(--profile-muted);  
}

.form-group input {
  padding: 10px;
  border: 1px solid var(--profile-input-border);
  border-radius: 5px;
  font-size: 14px;
  background: var(--profile-input-bg);
  color: var(--profile-text);
  transition: border-color 0.2s ease, background 0.2s ease, color 0.2s ease;
}

.form-group input::placeholder {
  color: var(--profile-input-placeholder);  
}
.password-input {
  display: flex;
  align-items: center;
  gap: 8px;
}

.password-input input {
  flex: 1;
}

.password-toggle {
  border: none;
  background: var(--profile-control-bg);
  color: var(--profile-control-text);
  padding: 8px 12px;
  border-radius: 5px;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.2s ease, color 0.2s ease;
}

.password-toggle:hover {
  background: var(--profile-control-bg-hover);
  color: var(--profile-control-text-hover);
}

.form-divider {
  margin: 10px 0;
  padding: 10px 0;
  border-top: 1px solid var(--profile-divider);
  color: var(--profile-muted);
  font-size: 14px;
  font-weight: 600;
}

.form-actions {
  display: flex;
  gap: 10px;
  margin-top: 10px;
}

.btn-primary,
.btn-secondary,
.btn-danger {
  padding: 12px 20px;
  border: none;
  border-radius: 5px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease;
}

.btn-primary {
  background: #4caf50;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #45a049;
}

.btn-primary:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.btn-secondary {
  background: var(--profile-secondary-bg);
  color: var(--profile-secondary-text);
}

.btn-secondary:hover {
  background: var(--profile-secondary-bg-hover);
}

.btn-danger {
  background: #f44336;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: #da190b;
}

.error-message {
  color: #f44336;
  font-size: 14px;
  padding: 10px;
  background: var(--profile-error-bg);
  border-radius: 5px;
}

.success-message {
  color: var(--profile-success-text);
  font-size: 14px;
  padding: 10px;
  background: var(--profile-success-bg);
  border-radius: 5px;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--profile-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10001;
  padding: 24px;  
}

.delete-confirm {
  position: relative;
  background: var(--profile-modal-bg);
  padding: 36px 30px 30px;
  border-radius: 18px;
  max-width: 400px;
  width: min(400px, calc(100vw - 48px));
  box-shadow: var(--profile-modal-shadow);
  color: var(--profile-text);
}

.delete-confirm__close {
  position: absolute;
  top: 12px;
  right: 12px;
  line-height: 1;
}

.delete-confirm h3 {
  margin: 0 0 15px 0;
  color: #f44336;
}

.delete-confirm p {
  margin: 0 0 20px 0;
  color: var(--profile-muted);
}
.field-hint {
  display: block;
  font-size: 12px;
  color: var(--profile-muted);
  margin-top: 3px;
}
</style>
