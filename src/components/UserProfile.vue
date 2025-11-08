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
        <!-- Аватар -->
        <div class="profile-avatar-section">
          <div class="avatar-wrapper">
            <img
              v-if="user.avatar_url"
              :src="getAvatarUrl(user.avatar_url)"
              alt="Аватар"
              class="profile-avatar"
            >
            <div v-else class="profile-avatar-placeholder">
              {{ getInitials(user.username || user.email) }}
            </div>
          </div>
          <div class="avatar-actions">
            <label class="btn-upload">
              <input
                type="file"
                accept="image/*"
                @change="handleAvatarChange"
                style="display: none"
              >
              📷 Загрузить фото
            </label>
            <button
              v-if="user.avatar_url"
              class="btn-remove"
              @click="handleAvatarDelete"
            >
              🗑️ Удалить
            </button>
          </div>
        </div>
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

        <div class="form-divider">
          <span>Личная информация</span>
        </div>

        <div class="profile-field">
          <label>Полное имя:</label>
          <span>{{ user.full_name || 'Не указано' }}</span>
        </div>

        <div class="profile-field">
          <label>Комп. номер:</label>
          <span>{{ user.personal_id || 'Не указано' }}</span>
        </div>

        <div class="profile-field">
          <label>Телефон:</label>
          <span>{{ user.phone || 'Не указано' }}</span>
        </div>

        <div class="profile-field">
          <label>Страна:</label>
          <span>{{ user.country || 'Не указано' }}</span>
        </div>

        <div class="profile-field">
          <label>Город:</label>
          <span>{{ user.city || 'Не указано' }}</span>
        </div>

        <div class="profile-field">
          <label>Представительство:</label>
          <span>{{ user.office || 'Не указано' }}</span>
        </div>

        <div class="form-divider">
          <span>Социальные сети и контакты</span>
        </div>

        <div class="profile-field">
          <label>Telegram (пользователь):</label>
          <span>{{ user.telegram_user || 'Не указано' }}</span>
        </div>

        <div class="profile-field">
          <label>Telegram (канал):</label>
          <span>{{ user.telegram_channel || 'Не указано' }}</span>
        </div>

        <div class="profile-field">
          <label>WhatsApp:</label>
          <span>{{ user.whatsapp_contact || 'Не указано' }}</span>
        </div>

        <div class="profile-field">
          <label>ВКонтакте:</label>
          <span>{{ user.vk_profile || 'Не указано' }}</span>
        </div>

        <div class="profile-field">
          <label>Одноклассники:</label>
          <span>{{ user.ok_profile || 'Не указано' }}</span>
        </div>

        <div class="profile-field">
          <label>Instagram:</label>
          <span>{{ user.instagram_profile || 'Не указано' }}</span>
        </div>

        <div class="profile-actions">
          <button class="btn-primary" @click="startEdit">
            Редактировать профиль
          </button>
          <button class="btn-danger" @click="showDeleteConfirm = true">
            Удалить аккаунт
          </button>
        </div>
      </div>

      <!-- Форма редактирования -->
      <form v-else class="profile-edit" @submit.prevent="saveProfile">
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
              autocomplete="new-password"
              readonly
              @focus="$event.target.removeAttribute('readonly')"
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
              autocomplete="new-password"
              readonly
              @focus="$event.target.removeAttribute('readonly')"
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
              autocomplete="new-password"
              readonly
              @focus="$event.target.removeAttribute('readonly')"
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

        <div class="form-divider">
          <span>Личная информация</span>
        </div>

        <div class="form-group">
          <label for="profile-full-name">Полное имя:</label>
          <input
            id="profile-full-name"
            v-model="editForm.full_name"
            type="text"
            placeholder="Введите полное имя"
          />
        </div>

        <div class="form-group">
          <label for="profile-personal-id">Комп. номер:</label>
          <input
            id="profile-personal-id"
            v-model="editForm.personal_id"
            type="text"
            placeholder="Введите компьютерный номер"
          />
        </div>

        <div class="form-group">
          <label for="profile-phone">Телефон:</label>
          <input
            id="profile-phone"
            v-model="editForm.phone"
            type="tel"
            placeholder="Введите телефон"
          />
        </div>

        <div class="form-group">
          <label for="profile-country">Страна:</label>
          <input
            id="profile-country"
            v-model="editForm.country"
            type="text"
            placeholder="Введите страну"
          />
        </div>

        <div class="form-group">
          <label for="profile-city">Город:</label>
          <input
            id="profile-city"
            v-model="editForm.city"
            type="text"
            placeholder="Введите город"
          />
        </div>

        <div class="form-group">
          <label for="profile-office">Представительство:</label>
          <input
            id="profile-office"
            v-model="editForm.office"
            type="text"
            placeholder="Введите представительство"
          />
        </div>

        <div class="form-divider">
          <span>Социальные сети и контакты</span>
        </div>

        <div class="form-group">
          <label for="profile-telegram-user">Telegram (пользователь):</label>
          <input
            id="profile-telegram-user"
            v-model="editForm.telegram_user"
            type="text"
            placeholder="@username"
          />
        </div>

        <div class="form-group">
          <label for="profile-telegram-channel">Telegram (канал):</label>
          <input
            id="profile-telegram-channel"
            v-model="editForm.telegram_channel"
            type="text"
            placeholder="@channel"
          />
        </div>

        <div class="form-group">
          <label for="profile-whatsapp">WhatsApp:</label>
          <input
            id="profile-whatsapp"
            v-model="editForm.whatsapp_contact"
            type="text"
            placeholder="+7 (XXX) XXX-XX-XX"
          />
        </div>

        <div class="form-group">
          <label for="profile-vk">ВКонтакте:</label>
          <input
            id="profile-vk"
            v-model="editForm.vk_profile"
            type="text"
            placeholder="vk.com/username"
          />
        </div>

        <div class="form-group">
          <label for="profile-ok">Одноклассники:</label>
          <input
            id="profile-ok"
            v-model="editForm.ok_profile"
            type="text"
            placeholder="ok.ru/profile"
          />
        </div>

        <div class="form-group">
          <label for="profile-instagram">Instagram:</label>
          <input
            id="profile-instagram"
            v-model="editForm.instagram_profile"
            type="text"
            placeholder="@username"
          />
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

  <transition name="fade">
    <div
      v-if="showCropper"
      class="cropper-overlay"
    >
      <div class="cropper-modal">
        <div class="cropper-header">
          <h3>Обрезка аватара</h3>
          <button type="button" class="cropper-close" @click="cancelCrop">×</button>
        </div>
        <div class="cropper-body">
          <img
            v-if="selectedImageUrl"
            :src="selectedImageUrl"
            ref="cropperImage"
            alt="Предпросмотр аватара"
            class="cropper-image"
          >
        </div>
        <div class="cropper-footer">
          <button type="button" class="btn-secondary" @click="cancelCrop">
            Отмена
          </button>
          <button
            type="button"
            class="btn-primary"
            :disabled="uploadingAvatar"
            @click="confirmCrop"
          >
            {{ uploadingAvatar ? 'Загрузка...' : 'Сохранить' }}
          </button>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { ref, reactive, onMounted, watch, nextTick, onBeforeUnmount } from 'vue'
import Cropper from 'cropperjs'
import 'cropperjs/dist/cropper.css'
import { useAuthStore } from '@/stores/auth'

const props = defineProps({
  isModernTheme: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close'])

const authStore = useAuthStore()
// Cropper.js
const showCropper = ref(false)
const selectedImageUrl = ref('')
const cropperImage = ref(null)
let cropper = null
const API_URL = import.meta.env.VITE_API_URL || 'https://interactive.marketingfohow.ru/api'

const user = ref({})
const loading = ref(true)
const editMode = ref(false)
const editForm = ref({
  username: '',
  email: '',
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
  // Новые поля профиля
  country: '',
  city: '',
  office: '',
  personal_id: '',
  phone: '',
  full_name: '',
  telegram_user: '',
  telegram_channel: '',
  vk_profile: '',
  ok_profile: '',
  instagram_profile: '',
  whatsapp_contact: ''
})

const error = ref('')
const success = ref('')
const updating = ref(false)

const showDeleteConfirm = ref(false)
const deletePassword = ref('')
const deleteError = ref('')
const deleting = ref(false)
const uploadingAvatar = ref(false)
const originalAvatarType = ref('')
const originalAvatarName = ref('')
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
    // Копируем новые поля профиля
    editForm.value.country = data.user.country || ''
    editForm.value.city = data.user.city || ''
    editForm.value.office = data.user.office || ''
    editForm.value.personal_id = data.user.personal_id || ''
    editForm.value.phone = data.user.phone || ''
    editForm.value.full_name = data.user.full_name || ''
    editForm.value.telegram_user = data.user.telegram_user || ''
    editForm.value.telegram_channel = data.user.telegram_channel || ''
    editForm.value.vk_profile = data.user.vk_profile || ''
    editForm.value.ok_profile = data.user.ok_profile || ''
    editForm.value.instagram_profile = data.user.instagram_profile || ''
    editForm.value.whatsapp_contact = data.user.whatsapp_contact || ''
  } catch (err) {
    console.error('Ошибка загрузки профиля:', err)
  } finally {
    loading.value = false
  }
}

async function saveProfile() {
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

    // Формируем данные профиля для отправки
    const profileData = {
      email: trimmedEmail
    }

    if (trimmedUsername) {
      profileData.username = trimmedUsername
    }

    // Добавляем новые поля профиля
    profileData.country = editForm.value.country?.trim() || ''
    profileData.city = editForm.value.city?.trim() || ''
    profileData.office = editForm.value.office?.trim() || ''
    profileData.personal_id = editForm.value.personal_id?.trim() || ''
    profileData.phone = editForm.value.phone?.trim() || ''
    profileData.full_name = editForm.value.full_name?.trim() || ''
    profileData.telegram_user = editForm.value.telegram_user?.trim() || ''
    profileData.telegram_channel = editForm.value.telegram_channel?.trim() || ''
    profileData.vk_profile = editForm.value.vk_profile?.trim() || ''
    profileData.ok_profile = editForm.value.ok_profile?.trim() || ''
    profileData.instagram_profile = editForm.value.instagram_profile?.trim() || ''
    profileData.whatsapp_contact = editForm.value.whatsapp_contact?.trim() || ''

    // Добавляем пароли ТОЛЬКО если реально меняем пароль
    if (isChangingPassword && editForm.value.newPassword && editForm.value.currentPassword) {
      profileData.currentPassword = editForm.value.currentPassword
      profileData.newPassword = editForm.value.newPassword
    }

    // Вызываем экшен authStore.updateProfile
    const updatedUser = await authStore.updateProfile(profileData)

    // Обновляем локальные данные
    user.value = updatedUser
    editForm.value.username = updatedUser.username || ''
    editForm.value.email = updatedUser.email || ''

    success.value = 'Профиль успешно обновлён!'

    // Переключаем обратно в режим просмотра после успешного сохранения
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
    // Обработка ошибок, включая "Личный номер уже используется" и другие
    error.value = err.message || 'Произошла ошибка при сохранении профиля'
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
  // Восстанавливаем новые поля профиля
  editForm.value.country = user.value.country || ''
  editForm.value.city = user.value.city || ''
  editForm.value.office = user.value.office || ''
  editForm.value.personal_id = user.value.personal_id || ''
  editForm.value.phone = user.value.phone || ''
  editForm.value.full_name = user.value.full_name || ''
  editForm.value.telegram_user = user.value.telegram_user || ''
  editForm.value.telegram_channel = user.value.telegram_channel || ''
  editForm.value.vk_profile = user.value.vk_profile || ''
  editForm.value.ok_profile = user.value.ok_profile || ''
  editForm.value.instagram_profile = user.value.instagram_profile || ''
  editForm.value.whatsapp_contact = user.value.whatsapp_contact || ''
  error.value = ''
  success.value = ''
  passwordVisibility.current = false
  passwordVisibility.new = false
  passwordVisibility.confirm = false
}
function startEdit() {
  editMode.value = true
  editForm.value.username = user.value.username || ''
  editForm.value.email = user.value.email
  editForm.value.currentPassword = ''
  editForm.value.newPassword = ''
  editForm.value.confirmPassword = ''
  // Копируем новые поля профиля
  editForm.value.country = user.value.country || ''
  editForm.value.city = user.value.city || ''
  editForm.value.office = user.value.office || ''
  editForm.value.personal_id = user.value.personal_id || ''
  editForm.value.phone = user.value.phone || ''
  editForm.value.full_name = user.value.full_name || ''
  editForm.value.telegram_user = user.value.telegram_user || ''
  editForm.value.telegram_channel = user.value.telegram_channel || ''
  editForm.value.vk_profile = user.value.vk_profile || ''
  editForm.value.ok_profile = user.value.ok_profile || ''
  editForm.value.instagram_profile = user.value.instagram_profile || ''
  editForm.value.whatsapp_contact = user.value.whatsapp_contact || ''
  passwordVisibility.current = false
  passwordVisibility.new = false
  passwordVisibility.confirm = false
  error.value = ''
  success.value = ''
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

function getAvatarUrl(url) {
  if (!url) return ''
  if (url.startsWith('http')) return url
  return `${API_URL.replace('/api', '')}${url}`
}

function getInitials(name) {
  if (!name) return '?'
  const parts = name.split(' ')
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return name.substring(0, 2).toUpperCase()
}

async function handleAvatarChange(event) {
  const file = event.target.files[0]
  if (!file) return

  // Показываем cropper вместо прямой загрузки
  selectedImageUrl.value = URL.createObjectURL(file)
  showCropper.value = true

  // Ждём рендеринга и инициализируем cropper
  await nextTick()
  
  if (cropper) {
    cropper.destroy()
  }
  
  cropper = new Cropper(cropperImage.value, {
    aspectRatio: 1, // квадрат
    viewMode: 1,
    autoCropArea: 1,
    responsive: true,
    background: false
  })
}

function cancelCrop() {
  if (cropper) {
    cropper.destroy()
    cropper = null
  }
  if (selectedImageUrl.value) {
    URL.revokeObjectURL(selectedImageUrl.value)
    selectedImageUrl.value = ''
  }
  showCropper.value = false
}

async function confirmCrop() {
  if (!cropper) return

  uploadingAvatar.value = true

  try {
    // Получаем обрезанное изображение как Blob
    const canvas = cropper.getCroppedCanvas({
      width: 400,
      height: 400,
      imageSmoothingQuality: 'high'
    })

    canvas.toBlob(async (blob) => {
      if (!blob) {
        throw new Error('Ошибка создания изображения')
      }

      const formData = new FormData()
      formData.append('avatar', blob, 'avatar.jpg')

      const response = await fetch(`${API_URL}/profile/avatar`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authStore.token}`
        },
        body: formData
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка загрузки')
      }

      // Обновляем аватар
      user.value.avatar_url = data.avatar_url
      authStore.user.avatar_url = data.avatar_url
      localStorage.setItem('user', JSON.stringify(authStore.user))

      success.value = 'Аватар обновлён!'
      setTimeout(() => success.value = '', 3000)

      cancelCrop()
    }, 'image/jpeg', 0.95)
  } catch (err) {
    error.value = err.message
  } finally {
    uploadingAvatar.value = false
  }
}

onMounted(() => {
  loadProfile()
})

onBeforeUnmount(() => {
  cancelCrop()
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
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.cropper-overlay {
  position: fixed;
  inset: 0;
  background: var(--profile-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 24px;
  box-sizing: border-box;
}

.cropper-modal {
  background: var(--profile-modal-bg);
  color: var(--profile-text);
  padding: 24px;
  border-radius: 20px;
  width: min(520px, 100%);
  box-shadow: var(--profile-modal-shadow);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.cropper-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.cropper-header h3 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}

.cropper-close {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 24px;
  line-height: 1;
  color: var(--profile-close-color);
  transition: color 0.2s ease;
}

.cropper-close:hover {
  color: var(--profile-close-color-hover);
}

.cropper-body {
  position: relative;
  width: 100%;
  max-height: 420px;
  overflow: hidden;
  border-radius: 16px;
  background: var(--profile-control-bg);
}

.cropper-image {
  display: block;
  max-width: 100%;
  width: 100%;
}

.cropper-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

@media (max-width: 480px) {
  .cropper-modal {
    padding: 20px;
    gap: 12px;
  }

  .cropper-header h3 {
    font-size: 18px;
  }

  .cropper-body {
    max-height: 320px;
  }
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

.profile-avatar-section {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 20px;
  background: var(--profile-control-bg);
  border-radius: 12px;
  margin-bottom: 20px;
}

.avatar-wrapper {
  flex-shrink: 0;
}

.profile-avatar,
.profile-avatar-placeholder {
  width: 100px;
  height: 100px;
  border-radius: 50%;
  object-fit: cover;
  border: 3px solid var(--profile-border);
}

.profile-avatar-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  font-size: 36px;
  font-weight: 700;
}

.avatar-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.btn-upload,
.btn-remove {
  padding: 10px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
  text-align: center;
}

.btn-upload {
  background: #2196F3;
  color: white;
  display: inline-block;
}

.btn-upload:hover {
  background: #1976D2;
}

.btn-remove {
  background: var(--profile-secondary-bg);
  color: var(--profile-secondary-text);
}

.btn-remove:hover {
  background: #f44336;
  color: white;
}
</style>
