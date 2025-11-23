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

    <!-- Показываем основной контент ТОЛЬКО ЕСЛИ объект user существует и загружен -->
    <div v-if="user" class="profile-content">
      <!-- ============================================ -->
      <!-- Блок 1: Аватарка (верх страницы, по центру) -->
      <!-- ============================================ -->
      <div class="profile-avatar-section">
        <div class="avatar-wrapper">
          <img
            v-if="user.avatar_url"
            :key="avatarKey"
            :src="getAvatarUrl(user.avatar_url)"
            alt="Аватар"
            class="profile-avatar"
          >
          <div v-else class="profile-avatar-placeholder">
            {{ getInitials(user.username || user.email) }}
          </div>

          <!-- Значок верификации -->
          <div v-if="user.is_verified" class="verification-badge" title="Верифицированный пользователь">
            ⭐
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
            🗑️ Удалить фото
          </button>
        </div>
      </div>

      <!-- ============================================ -->
      <!-- Блок 2: Табы с информацией (4 кнопки в ряд) -->
      <!-- ============================================ -->
      <div class="tabs-container">
        <div class="tabs-buttons">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            :class="['tab-button', { active: activeTab === tab.id }]"
            @click="activeTab = tab.id"
          >
            <span class="tab-icon">{{ tab.icon }}</span>
            <span class="tab-label">{{ tab.label }}</span>
          </button>
        </div>

        <div class="tab-content">
          <!-- ===== TAB 1: Основная информация ===== -->
          <div v-if="activeTab === 'basic'" class="tab-panel">
            <div class="info-grid">
              <div class="info-item">
                <label>Email:</label>
                <span>{{ user.email }}</span>
              </div>

              <div class="info-item">
                <label>Имя пользователя:</label>
                <span>{{ user.username || 'Не указано' }}</span>
              </div>

              <div class="info-item">
                <label>Дата регистрации:</label>
                <span>{{ formatDate(user.created_at) }}</span>
              </div>

              <div class="info-item">
                <label>Текущий тариф:</label>
                <span class="plan-badge" :style="getPlanBadgeStyle()">
                  {{ subscriptionStore.currentPlan?.name || 'Не определен' }}
                </span>
              </div>

              <div class="info-item">
                <label>Начало подписки:</label>
                <span>{{ getStartDate() }}</span>
              </div>

              <div class="info-item">
                <label>Окончание подписки:</label>
                <span :class="getExpiryClass()">
                  {{ getExpiryDate() }}
                </span>
              </div>
            </div>
          </div>

          <!-- ===== TAB 2: Личная информация ===== -->
          <div v-if="activeTab === 'personal'" class="tab-panel">
            <form @submit.prevent="savePersonalInfo" class="info-form">
              <div class="form-group">
                <label for="full-name">Полное имя:</label>
                <input
                  id="full-name"
                  v-model="personalForm.full_name"
                  type="text"
                  placeholder="Введите полное имя"
                />
              </div>

              <div class="form-group">
                <label for="phone">Телефон:</label>
                <input
                  id="phone"
                  v-model="personalForm.phone"
                  type="tel"
                  placeholder="+7 (XXX) XXX-XX-XX"
                />
              </div>

              <div class="form-group">
                <label for="city">Город:</label>
                <input
                  id="city"
                  v-model="personalForm.city"
                  type="text"
                  placeholder="Введите город"
                />
              </div>

              <div class="form-group">
                <label for="country">Страна:</label>
                <input
                  id="country"
                  v-model="personalForm.country"
                  type="text"
                  placeholder="Введите страну"
                />
              </div>

              <div class="form-group">
                <label for="office">Представительство:</label>
                <input
                  id="office"
                  v-model="personalForm.office"
                  type="text"
                  placeholder="Название представительства"
                />
              </div>

              <div class="form-group">
                <label for="personal-id">Компьютерный номер:</label>
                <input
                  id="personal-id"
                  v-model="personalForm.personal_id"
                  type="text"
                  placeholder="Введите компьютерный номер"
                />
              </div>

              <div v-if="personalError" class="error-message">{{ personalError }}</div>
              <div v-if="personalSuccess" class="success-message">{{ personalSuccess }}</div>

              <button type="submit" class="btn-save" :disabled="savingPersonal">
                {{ savingPersonal ? 'Сохранение...' : '💾 Сохранить изменения' }}
              </button>
            </form>
          </div>

          <!-- ===== TAB 3: Соц. сети ===== -->
          <div v-if="activeTab === 'social'" class="tab-panel">
            <form @submit.prevent="saveSocialInfo" class="info-form">
              <div class="form-group">
                <label for="telegram">Telegram (@username):</label>
                <input
                  id="telegram"
                  v-model="socialForm.telegram_user"
                  type="text"
                  placeholder="@username"
                />
              </div>

              <div class="form-group">
                <label for="vk">VK (ссылка):</label>
                <input
                  id="vk"
                  v-model="socialForm.vk_profile"
                  type="text"
                  placeholder="vk.com/username"
                />
              </div>

              <div class="form-group">
                <label for="instagram">Instagram (@username):</label>
                <input
                  id="instagram"
                  v-model="socialForm.instagram_profile"
                  type="text"
                  placeholder="@username"
                />
              </div>

              <div class="form-group">
                <label for="website">Сайт (URL):</label>
                <input
                  id="website"
                  v-model="socialForm.website"
                  type="url"
                  placeholder="https://example.com"
                />
              </div>

              <div v-if="socialError" class="error-message">{{ socialError }}</div>
              <div v-if="socialSuccess" class="success-message">{{ socialSuccess }}</div>

              <button type="submit" class="btn-save" :disabled="savingSocial">
                {{ savingSocial ? 'Сохранение...' : '💾 Сохранить изменения' }}
              </button>
            </form>
          </div>

          <!-- ===== TAB 4: Лимиты / Используемые ресурсы ===== -->
          <div v-if="activeTab === 'limits'" class="tab-panel">
            <div class="limits-grid">
              <div class="limit-card">
                <div class="limit-card-header">
                  <span class="limit-icon">📋</span>
                  <span class="limit-title">Доски</span>
                </div>
                <div class="limit-card-body">
                  <div class="limit-stats">
                    <span class="limit-current">{{ getLimitInfo('boards').current }}</span>
                    <span class="limit-separator">/</span>
                    <span class="limit-max">{{ getLimitInfo('boards').maxDisplay }}</span>
                  </div>
                  <div class="progress-bar">
                    <div
                      class="progress-fill"
                      :style="{ width: getLimitInfo('boards').percentage + '%', backgroundColor: getLimitColor(getLimitInfo('boards').percentage) }"
                    ></div>
                  </div>
                </div>
              </div>

              <div class="limit-card">
                <div class="limit-card-header">
                  <span class="limit-icon">📝</span>
                  <span class="limit-title">Заметки</span>
                </div>
                <div class="limit-card-body">
                  <div class="limit-stats">
                    <span class="limit-current">{{ getLimitInfo('notes').current }}</span>
                    <span class="limit-separator">/</span>
                    <span class="limit-max">{{ getLimitInfo('notes').maxDisplay }}</span>
                  </div>
                  <div class="progress-bar">
                    <div
                      class="progress-fill"
                      :style="{ width: getLimitInfo('notes').percentage + '%', backgroundColor: getLimitColor(getLimitInfo('notes').percentage) }"
                    ></div>
                  </div>
                </div>
              </div>

              <div class="limit-card">
                <div class="limit-card-header">
                  <span class="limit-icon">💬</span>
                  <span class="limit-title">Комментарии</span>
                </div>
                <div class="limit-card-body">
                  <div class="limit-stats">
                    <span class="limit-current">{{ getLimitInfo('comments').current }}</span>
                    <span class="limit-separator">/</span>
                    <span class="limit-max">{{ getLimitInfo('comments').maxDisplay }}</span>
                  </div>
                  <div class="progress-bar">
                    <div
                      class="progress-fill"
                      :style="{ width: getLimitInfo('comments').percentage + '%', backgroundColor: getLimitColor(getLimitInfo('comments').percentage) }"
                    ></div>
                  </div>
                </div>
              </div>

              <div class="limit-card">
                <div class="limit-card-header">
                  <span class="limit-icon">🎨</span>
                  <span class="limit-title">Стикеры</span>
                </div>
                <div class="limit-card-body">
                  <div class="limit-stats">
                    <span class="limit-current">{{ getLimitInfo('stickers').current }}</span>
                    <span class="limit-separator">/</span>
                    <span class="limit-max">{{ getLimitInfo('stickers').maxDisplay }}</span>
                  </div>
                  <div class="progress-bar">
                    <div
                      class="progress-fill"
                      :style="{ width: getLimitInfo('stickers').percentage + '%', backgroundColor: getLimitColor(getLimitInfo('stickers').percentage) }"
                    ></div>
                  </div>
                </div>
              </div>

              <div class="limit-card">
                <div class="limit-card-header">
                  <span class="limit-icon">🎫</span>
                  <span class="limit-title">Карточки</span>
                </div>
                <div class="limit-card-body">
                  <div class="limit-stats">
                    <span class="limit-current">{{ getLimitInfo('cards').current }}</span>
                    <span class="limit-separator">/</span>
                    <span class="limit-max">{{ getLimitInfo('cards').maxDisplay }}</span>
                  </div>
                  <div class="progress-bar">
                    <div
                      class="progress-fill"
                      :style="{ width: getLimitInfo('cards').percentage + '%', backgroundColor: getLimitColor(getLimitInfo('cards').percentage) }"
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ============================================ -->
      <!-- Блок 3: Telegram интеграция -->
      <!-- ============================================ -->
      <div class="extra-section">
        <div class="section-header">
          <h3>Уведомления Telegram</h3>
        </div>
        <TelegramLinkWidget />
      </div>

      <!-- ============================================ -->
      <!-- Блок 4: Промокоды -->
      <!-- ============================================ -->
      <div class="extra-section">
        <div class="section-header">
          <h3>Промокод</h3>
        </div>
        <div class="promo-section">
          <div class="promo-input-group">
            <input
              v-model="promoCodeInput"
              type="text"
              placeholder="Введите промокод"
              class="promo-input"
              :disabled="applyingPromo"
            />
            <button
              class="btn-promo"
              @click="handleApplyPromo"
              :disabled="!promoCodeInput.trim() || applyingPromo"
            >
              {{ applyingPromo ? 'Применение...' : 'Применить' }}
            </button>
          </div>

          <div v-if="promoError" class="error-message">{{ promoError }}</div>
          <div v-if="promoSuccess" class="success-message">{{ promoSuccess }}</div>
        </div>
      </div>
    </div>

    <!-- Показываем заглушку, если user еще не загружен -->
    <div v-else class="loading">Загрузка профиля...</div>
  </div>

  <!-- Cropper -->
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
import { ref, reactive, onMounted, nextTick, onBeforeUnmount } from 'vue'
import { storeToRefs } from 'pinia'
import Cropper from 'cropperjs'
import 'cropperjs/dist/cropper.css'
import { useAuthStore } from '@/stores/auth'
import { useSubscriptionStore } from '@/stores/subscription'
import TelegramLinkWidget from '@/components/TelegramLinkWidget.vue'

const props = defineProps({
  isModernTheme: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close'])

const authStore = useAuthStore()
const subscriptionStore = useSubscriptionStore()
const { user } = storeToRefs(authStore)

const API_URL = import.meta.env.VITE_API_URL || 'https://interactive.marketingfohow.ru/api'

// Аватарка
const avatarKey = ref(0) // Ключ для принудительной перерисовки аватарки
const showCropper = ref(false)
const selectedImageUrl = ref('')
const cropperImage = ref(null)
let cropper = null
const uploadingAvatar = ref(false)

// Табы
const activeTab = ref('basic')
const tabs = [
  { id: 'basic', label: 'Основная информация', icon: 'ℹ️' },
  { id: 'personal', label: 'Личная информация', icon: '👤' },
  { id: 'social', label: 'Соц. сети', icon: '🌐' },
  { id: 'limits', label: 'Лимиты', icon: '📊' }
]

// Формы
const personalForm = reactive({
  full_name: '',
  phone: '',
  city: '',
  country: '',
  office: '',
  personal_id: ''
})

const socialForm = reactive({
  telegram_user: '',
  vk_profile: '',
  instagram_profile: '',
  website: ''
})

const personalError = ref('')
const personalSuccess = ref('')
const savingPersonal = ref(false)

const socialError = ref('')
const socialSuccess = ref('')
const savingSocial = ref(false)

// Промокод
const promoCodeInput = ref('')
const promoError = ref('')
const promoSuccess = ref('')
const applyingPromo = ref(false)

// Инициализация
onMounted(async () => {
  // Принудительно загружаем свежие данные пользователя и план подписки
  try {
    // Загружаем профиль пользователя с актуальными данными
    await authStore.fetchProfile()
    // Загружаем план подписки
    await subscriptionStore.loadPlan()
  } catch (error) {
    console.error('Ошибка при загрузке данных профиля:', error)
  }

  // Заполняем формы текущими данными
  if (user.value) {
    personalForm.full_name = user.value.full_name || ''
    personalForm.phone = user.value.phone || ''
    personalForm.city = user.value.city || ''
    personalForm.country = user.value.country || ''
    personalForm.office = user.value.office || ''
    personalForm.personal_id = user.value.personal_id || ''

    socialForm.telegram_user = user.value.telegram_user || ''
    socialForm.vk_profile = user.value.vk_profile || ''
    socialForm.instagram_profile = user.value.instagram_profile || ''
    socialForm.website = user.value.website || ''
  }
})

onBeforeUnmount(() => {
  cancelCrop()
})

// Форматирование даты
function formatDate(dateString) {
  if (!dateString) return 'Не указано'
  const date = new Date(dateString)
  return date.toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

// Получить URL аватара
function getAvatarUrl(url) {
  if (!url) return ''
  if (url.startsWith('http')) return url
  return `${API_URL.replace('/api', '')}${url}`
}

// Получить инициалы
function getInitials(name) {
  if (!name) return '?'
  const parts = name.split(' ')
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return name.substring(0, 2).toUpperCase()
}

// Стиль бейджа плана
function getPlanBadgeStyle() {
  return {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    padding: '4px 12px',
    borderRadius: '12px',
    fontWeight: '600',
    fontSize: '14px',
    display: 'inline-block'
  }
}

// Класс для даты окончания подписки
function getExpiryClass() {
  // Проверяем сначала user.subscription_expires_at, затем subscriptionStore
  const expiresAt = user.value?.subscription_expires_at || subscriptionStore.currentPlan?.expiresAt
  if (!expiresAt) return 'expiry-unlimited'

  const daysLeft = subscriptionStore.daysLeft

  if (daysLeft === null) return 'expiry-unlimited'
  if (daysLeft <= 0) return 'expiry-expired'
  if (daysLeft < 7) return 'expiry-warning'
  return 'expiry-active'
}

// Дата начала подписки
function getStartDate() {
  // Используем subscription_started_at, если есть, иначе created_at
  const startDate = user.value?.subscription_started_at || user.value?.created_at
  return formatDate(startDate)
}

// Дата окончания подписки
function getExpiryDate() {
  // Проверяем сначала user.subscription_expires_at, затем subscriptionStore
  const expiresAt = user.value?.subscription_expires_at || subscriptionStore.currentPlan?.expiresAt
  if (!expiresAt) return 'Бессрочно'
  return formatDate(expiresAt)
}

// Информация о лимитах
function getLimitInfo(resourceType) {
  const limitData = subscriptionStore.checkLimit(resourceType)
  const maxDisplay = limitData.max === -1 ? '∞' : limitData.max
  const percentage = limitData.max === -1 ? 0 : Math.min(100, Math.round((limitData.current / limitData.max) * 100))

  return {
    current: limitData.current,
    max: limitData.max,
    maxDisplay,
    percentage
  }
}

// Цвет прогресс-бара
function getLimitColor(percentage) {
  if (percentage < 70) return '#4caf50' // Зелёный
  if (percentage < 90) return '#ffc107' // Оранжевый
  return '#f44336' // Красный
}

// Сохранить личную информацию
async function savePersonalInfo() {
  personalError.value = ''
  personalSuccess.value = ''
  savingPersonal.value = true

  try {
    const profileData = {
      full_name: personalForm.full_name?.trim() || '',
      phone: personalForm.phone?.trim() || '',
      city: personalForm.city?.trim() || '',
      country: personalForm.country?.trim() || '',
      office: personalForm.office?.trim() || '',
      personal_id: personalForm.personal_id?.trim() || ''
    }

    await authStore.updateProfile(profileData)
    personalSuccess.value = 'Личная информация успешно обновлена!'

    setTimeout(() => {
      personalSuccess.value = ''
    }, 3000)
  } catch (err) {
    personalError.value = err.message || 'Произошла ошибка при сохранении'
  } finally {
    savingPersonal.value = false
  }
}

// Сохранить соц. сети
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

    await authStore.updateProfile(profileData)
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

// Применить промокод
async function handleApplyPromo() {
  promoError.value = ''
  promoSuccess.value = ''

  const code = promoCodeInput.value.trim()

  if (!code) {
    promoError.value = 'Введите промокод'
    return
  }

  applyingPromo.value = true

  try {
    await authStore.applyPromoCode(code)
    promoSuccess.value = 'Промокод успешно применен!'
    promoCodeInput.value = ''

    // Обновляем план подписки
    await subscriptionStore.loadPlan()

    setTimeout(() => {
      promoSuccess.value = ''
    }, 5000)
  } catch (err) {
    promoError.value = err.message || 'Ошибка применения промокода'
  } finally {
    applyingPromo.value = false
  }
}

// Загрузка аватара
async function handleAvatarChange(event) {
  const file = event.target.files[0]
  if (!file) return

  selectedImageUrl.value = URL.createObjectURL(file)
  showCropper.value = true

  await nextTick()

  if (cropper) {
    cropper.destroy()
  }

  cropper = new Cropper(cropperImage.value, {
    aspectRatio: 1,
    viewMode: 1,
    autoCropArea: 1,
    responsive: true,
    background: false
  })
}

// Отмена обрезки
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

// Подтверждение обрезки и загрузка
async function confirmCrop() {
  if (!cropper) return

  uploadingAvatar.value = true

  try {
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

      // ИСПРАВЛЕНИЕ БАГА: Обновляем аватар и увеличиваем ключ для перерисовки
      user.value.avatar_url = data.avatar_url
      authStore.user.avatar_url = data.avatar_url
      localStorage.setItem('user', JSON.stringify(authStore.user))

      // Увеличиваем ключ для принудительной перерисовки аватарки
      avatarKey.value++

      alert('Аватар успешно обновлен!')
      cancelCrop()
    }, 'image/jpeg', 0.95)
  } catch (err) {
    alert(err.message || 'Ошибка загрузки аватара')
  } finally {
    uploadingAvatar.value = false
  }
}

// Удаление аватара
async function handleAvatarDelete() {
  if (!confirm('Вы уверены, что хотите удалить аватар?')) return

  try {
    const response = await fetch(`${API_URL}/profile/avatar`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Ошибка удаления аватара')
    }

    // Обновляем аватар и увеличиваем ключ для перерисовки
    user.value.avatar_url = null
    authStore.user.avatar_url = null
    localStorage.setItem('user', JSON.stringify(authStore.user))

    avatarKey.value++

    alert('Аватар успешно удален!')
  } catch (err) {
    alert(err.message || 'Ошибка удаления аватара')
  }
}
</script>

<style scoped>
/* ========================================== */
/* ОСНОВНЫЕ ПЕРЕМЕННЫЕ */
/* ========================================== */
.user-profile {
  position: relative;
  max-width: 800px;
  width: min(800px, calc(100vw - 48px));
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

/* ========================================== */
/* HEADER */
/* ========================================== */
.profile-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
}

.profile-header h2 {
  margin: 0;
  color: var(--profile-text);
  font-size: 28px;
  font-weight: 700;
}

.close-btn {
  background: none;
  border: none;
  font-size: 30px;
  cursor: pointer;
  color: var(--profile-close-color);
  transition: color 0.2s ease;
}

.close-btn:hover {
  color: var(--profile-close-color-hover);
}

.loading {
  text-align: center;
  padding: 40px;
  color: var(--profile-muted);
}

/* ========================================== */
/* БЛОК 1: АВАТАРКА */
/* ========================================== */
.profile-avatar-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  padding: 30px;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%);
  border-radius: 20px;
  margin-bottom: 30px;
  border: 2px solid var(--profile-border);
}

.avatar-wrapper {
  position: relative;
  display: inline-block;
  flex-shrink: 0;
}

.verification-badge {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 32px;
  height: 32px;
  background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%);
  border-radius: 50%;
  border: 3px solid #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  z-index: 10;
}

.user-profile--modern .verification-badge {
  border-color: rgba(17, 24, 39, 0.95);
}

.profile-avatar,
.profile-avatar-placeholder {
  width: 150px;
  height: 150px;
  border-radius: 50%;
  object-fit: cover;
  border: 4px solid transparent;
  background: linear-gradient(white, white) padding-box,
              linear-gradient(135deg, #667eea 0%, #764ba2 100%) border-box;
  box-shadow: 0 8px 24px rgba(102, 126, 234, 0.3);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.profile-avatar:hover,
.profile-avatar-placeholder:hover {
  transform: scale(1.05);
  box-shadow: 0 12px 32px rgba(102, 126, 234, 0.4);
}

.profile-avatar-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  font-size: 48px;
  font-weight: 700;
}

.avatar-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: center;
}

.btn-upload,
.btn-remove {
  padding: 12px 24px;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  border: none;
  text-align: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.btn-upload {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  display: inline-block;
}

.btn-upload:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(102, 126, 234, 0.4);
}

.btn-remove {
  background: #f44336;
  color: white;
}

.btn-remove:hover {
  background: #da190b;
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(244, 67, 54, 0.4);
}

/* ========================================== */
/* БЛОК 2: ТАБЫ */
/* ========================================== */
.tabs-container {
  margin-bottom: 30px;
}

.tabs-buttons {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 24px;
}

.tab-button {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px 12px;
  border: 2px solid var(--profile-border);
  border-radius: 16px;
  background: var(--profile-input-bg);
  color: var(--profile-text);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.tab-button:hover {
  border-color: #667eea;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.2);
}

.tab-button.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-color: transparent;
  box-shadow: 0 6px 16px rgba(102, 126, 234, 0.4);
}

.tab-icon {
  font-size: 24px;
}

.tab-label {
  text-align: center;
  line-height: 1.3;
}

.tab-content {
  background: var(--profile-control-bg);
  border-radius: 16px;
  padding: 24px;
  min-height: 300px;
}

.tab-panel {
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ========================================== */
/* TAB 1: ОСНОВНАЯ ИНФОРМАЦИЯ */
/* ========================================== */
.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.info-item label {
  font-weight: 600;
  color: var(--profile-muted);
  font-size: 14px;
}

.info-item span {
  font-size: 16px;
  color: var(--profile-text);
  font-weight: 500;
}

.plan-badge {
  display: inline-block !important;
}

.expiry-unlimited {
  color: #4caf50;
  font-weight: 600;
}

.expiry-active {
  color: #4caf50;
}

.expiry-warning {
  color: #ff9800;
  font-weight: 600;
}

.expiry-expired {
  color: #f44336;
  font-weight: 600;
}

/* ========================================== */
/* TAB 2 & 3: ФОРМЫ */
/* ========================================== */
.info-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  font-weight: 600;
  font-size: 14px;
  color: var(--profile-muted);
}

.form-group input {
  padding: 12px 16px;
  border: 2px solid var(--profile-input-border);
  border-radius: 12px;
  font-size: 15px;
  background: var(--profile-input-bg);
  color: var(--profile-text);
  transition: all 0.3s ease;
}

.form-group input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.1);
}

.form-group input::placeholder {
  color: var(--profile-input-placeholder);
}

.btn-save {
  padding: 14px 24px;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.btn-save:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(102, 126, 234, 0.4);
}

.btn-save:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

/* ========================================== */
/* TAB 4: ЛИМИТЫ */
/* ========================================== */
.limits-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
}

.limit-card {
  background: var(--profile-input-bg);
  border: 2px solid var(--profile-border);
  border-radius: 16px;
  padding: 20px;
  transition: all 0.3s ease;
}

.limit-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.1);
  border-color: #667eea;
}

.limit-card-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}

.limit-icon {
  font-size: 28px;
}

.limit-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--profile-text);
}

.limit-card-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.limit-stats {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-size: 24px;
  font-weight: 700;
}

.limit-current {
  color: #667eea;
}

.limit-separator {
  color: var(--profile-muted);
  font-size: 18px;
}

.limit-max {
  color: var(--profile-muted);
  font-size: 18px;
}

.progress-bar {
  width: 100%;
  height: 12px;
  background: var(--profile-border);
  border-radius: 6px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 6px;
  transition: width 0.5s ease, background-color 0.3s ease;
  animation: fillBar 1s ease-out;
}

@keyframes fillBar {
  from {
    width: 0;
  }
}

/* ========================================== */
/* БЛОК 3 & 4: ДОПОЛНИТЕЛЬНЫЕ СЕКЦИИ */
/* ========================================== */
.extra-section {
  margin-bottom: 24px;
  padding: 24px;
  background: var(--profile-control-bg);
  border-radius: 16px;
  border: 2px solid var(--profile-border);
}

.section-header h3 {
  margin: 0 0 16px 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--profile-text);
}

.promo-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.promo-input-group {
  display: flex;
  gap: 12px;
  align-items: center;
}

.promo-input {
  flex: 1;
  padding: 12px 16px;
  border: 2px solid var(--profile-input-border);
  border-radius: 12px;
  font-size: 15px;
  background: var(--profile-input-bg);
  color: var(--profile-text);
  transition: all 0.3s ease;
}

.promo-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.1);
}

.promo-input::placeholder {
  color: var(--profile-input-placeholder);
}

.promo-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-promo {
  padding: 12px 24px;
  border: none;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  transition: all 0.3s ease;
  white-space: nowrap;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.btn-promo:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(102, 126, 234, 0.4);
}

.btn-promo:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

/* ========================================== */
/* СООБЩЕНИЯ */
/* ========================================== */
.error-message {
  color: var(--profile-error-text);
  font-size: 14px;
  padding: 12px 16px;
  background: var(--profile-error-bg);
  border-radius: 12px;
  font-weight: 500;
}

.success-message {
  color: var(--profile-success-text);
  font-size: 14px;
  padding: 12px 16px;
  background: var(--profile-success-bg);
  border-radius: 12px;
  font-weight: 500;
}

/* ========================================== */
/* CROPPER MODAL */
/* ========================================== */
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

.btn-primary,
.btn-secondary {
  padding: 12px 20px;
  border: none;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(102, 126, 234, 0.4);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.btn-secondary {
  background: var(--profile-secondary-bg);
  color: var(--profile-secondary-text);
}

.btn-secondary:hover {
  background: var(--profile-secondary-bg-hover);
}

/* ========================================== */
/* RESPONSIVE */
/* ========================================== */
@media (max-width: 768px) {
  .user-profile {
    padding: 24px 20px;
  }

  .profile-header h2 {
    font-size: 24px;
  }

  .tabs-buttons {
    grid-template-columns: repeat(2, 1fr);
  }

  .tab-button {
    padding: 12px 8px;
    font-size: 13px;
  }

  .tab-icon {
    font-size: 20px;
  }

  .info-grid {
    grid-template-columns: 1fr;
  }

  .limits-grid {
    grid-template-columns: 1fr;
  }

  .promo-input-group {
    flex-direction: column;
    align-items: stretch;
  }

  .btn-promo {
    width: 100%;
  }
}

@media (max-width: 480px) {
  .profile-avatar,
  .profile-avatar-placeholder {
    width: 120px;
    height: 120px;
  }

  .profile-avatar-placeholder {
    font-size: 36px;
  }

  .avatar-actions {
    flex-direction: column;
    width: 100%;
  }

  .btn-upload,
  .btn-remove {
    width: 100%;
  }

  .tab-content {
    padding: 16px;
  }

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
</style>
