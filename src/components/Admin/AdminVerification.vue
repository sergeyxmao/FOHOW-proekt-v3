<template>
  <div class="verification-moderation">
    <!-- Верхняя панель с заголовком и статистикой -->
    <div class="moderation-header">
      <div class="header-content">
        <h2>Модерация верификации</h2>

        <!-- Переключатель табов -->
        <div class="tabs-switcher">
          <button
            :class="['tab-btn', { active: activeTab === 'pending' }]"
            @click="switchTab('pending')"
          >
            В очереди ({{ pendingCount }})
          </button>
          <button
            :class="['tab-btn', { active: activeTab === 'archive' }]"
            @click="switchTab('archive')"
          >
            Архив ({{ archiveVerifications.length }})
          </button>
        </div>
      </div>
      <button
        @click="activeTab === 'pending' ? loadVerifications() : loadArchive()"
        class="refresh-button"
        :disabled="adminStore.isLoadingVerifications || archiveLoading"
      >
        Обновить
      </button>
    </div>

    <!-- Контент для "В очереди" -->
    <div v-if="activeTab === 'pending'">
      <!-- Индикатор загрузки -->
      <div v-if="adminStore.isLoadingVerifications" class="loading">
        <div class="spinner"></div>
        <p>Загрузка заявок...</p>
      </div>

      <!-- Состояние ошибки -->
      <div v-else-if="adminStore.error" class="error-state">
        <div class="error-icon">!</div>
        <p class="error-message">{{ adminStore.error }}</p>
        <button @click="handleRetry" class="retry-button">
          Повторить
        </button>
      </div>

      <!-- Пустое состояние -->
      <div v-else-if="!adminStore.pendingVerifications || adminStore.pendingVerifications.length === 0" class="empty-state">
        <p>Сейчас нет заявок на верификацию</p>
      </div>

      <!-- Список заявок -->
      <div v-else class="verifications-grid">
      <div v-for="verification in adminStore.pendingVerifications" :key="verification.id" class="verification-card">
        <!-- Информация о пользователе -->
        <div class="user-info">
          <h3 class="user-name">{{ verification.full_name }}</h3>
          <div class="user-meta">
            <p>
              <strong>Компьютерный номер:</strong> {{ verification.personal_id || 'Не указан' }}
            </p>
            <p>
              <strong>Email:</strong> {{ verification.email }}
            </p>
            <p v-if="verification.username">
              <strong>Логин:</strong> {{ verification.username }}
            </p>
            <p>
              <strong>Дата заявки:</strong> {{ formatDate(verification.submitted_at) }}
            </p>
          </div>
        </div>

        <!-- Скриншоты -->
        <div class="screenshots-section">
          <h4>Скриншоты верификации:</h4>
          <div class="screenshots-grid">
            <div class="screenshot-wrapper" @click="openScreenshotPreview(verification, 1)">
              <img
                v-if="getScreenshotUrl(verification.screenshot_1_path)"
                :src="getScreenshotUrl(verification.screenshot_1_path)"
                alt="Скриншот 1"
                class="screenshot-thumb"
              />
              <div v-else class="screenshot-placeholder">
                <span v-if="screenshotErrors[verification.screenshot_1_path]">Ошибка загрузки</span>
                <span v-else>Загрузка...</span>
              </div>
              <span class="screenshot-label">Скриншот 1</span>
            </div>
            <div class="screenshot-wrapper" @click="openScreenshotPreview(verification, 2)">
              <img
                v-if="getScreenshotUrl(verification.screenshot_2_path)"
                :src="getScreenshotUrl(verification.screenshot_2_path)"
                alt="Скриншот 2"
                class="screenshot-thumb"
              />
              <div v-else class="screenshot-placeholder">
                <span v-if="screenshotErrors[verification.screenshot_2_path]">Ошибка загрузки</span>
                <span v-else>Загрузка...</span>
              </div>
              <span class="screenshot-label">Скриншот 2</span>
            </div>
          </div>
        </div>

        <!-- Кнопки действий -->
        <div class="verification-actions">
          <button
            @click="handleApprove(verification.id)"
            class="approve-button"
            :disabled="processingId === verification.id"
          >
            Одобрить
          </button>
          <button
            @click="openRejectModal(verification)"
            class="reject-button"
            :disabled="processingId === verification.id"
          >
            Отклонить
          </button>
        </div>

        <!-- Индикатор обработки -->
        <div v-if="processingId === verification.id" class="processing-overlay">
          <div class="spinner-small"></div>
        </div>
      </div>
    </div>
    </div>

    <!-- Контент для "Архив" -->
    <div v-if="activeTab === 'archive'">
      <!-- Индикатор загрузки -->
      <div v-if="archiveLoading" class="loading">
        <div class="spinner"></div>
        <p>Загрузка архива...</p>
      </div>

      <!-- Состояние ошибки -->
      <div v-else-if="archiveError" class="error-state">
        <div class="error-icon">!</div>
        <p class="error-message">{{ archiveError }}</p>
        <button @click="loadArchive" class="retry-button">
          Повторить
        </button>
      </div>

      <!-- Пустое состояние -->
      <div v-else-if="archiveVerifications.length === 0" class="empty-state">
        <p>Архив пуст</p>
      </div>

      <!-- Список заявок из архива -->
      <div v-else class="verifications-grid">
        <div v-for="verification in archiveVerifications" :key="verification.id" class="verification-card archive-card">
          <!-- Статус заявки -->
          <div class="archive-status-badge" :class="`status-${verification.status}`">
            {{ verification.status === 'approved' ? 'Одобрено' : 'Отклонено' }}
          </div>

          <!-- Информация о заявке -->
          <div class="user-info">
            <h3 class="user-name">{{ verification.full_name }}</h3>
            <div class="user-meta">
              <p><strong>Компьютерный номер:</strong> {{ verification.personal_id || 'Не указан' }}</p>
              <p><strong>Email:</strong> {{ verification.email }}</p>
              <p v-if="verification.username"><strong>Username:</strong> {{ verification.username }}</p>
              <p><strong>Дата подачи:</strong> {{ formatDate(verification.submitted_at) }}</p>
              <p><strong>Обработана:</strong> {{ formatDate(verification.processed_at) }}</p>
              <p v-if="verification.processed_by_username">
                <strong>Обработал:</strong> {{ verification.processed_by_username }}
              </p>

              <!-- Причина отклонения -->
              <div v-if="verification.status === 'rejected' && verification.rejection_reason" class="rejection-block">
                <strong>Причина отклонения:</strong>
                <p>{{ verification.rejection_reason }}</p>
              </div>
            </div>
          </div>

          <!-- Скриншоты (миниатюры) -->
          <div v-if="verification.screenshot_1_path" class="screenshots-section">
            <h4>Скриншоты:</h4>
            <div class="screenshots-grid-mini">
              <img
                :src="getScreenshotUrl(verification.screenshot_1_path)"
                alt="Скриншот 1"
                class="screenshot-preview-small"
                @click="openArchiveScreenshotPreview(getScreenshotUrl(verification.screenshot_1_path))"
              />
              <img
                v-if="verification.screenshot_2_path"
                :src="getScreenshotUrl(verification.screenshot_2_path)"
                alt="Скриншот 2"
                class="screenshot-preview-small"
                @click="openArchiveScreenshotPreview(getScreenshotUrl(verification.screenshot_2_path))"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Модальное окно для просмотра скриншота -->
    <div v-if="selectedScreenshot" class="modal-overlay" @click="closeScreenshotPreview">
      <div class="modal-content" @click.stop>
        <button class="modal-close" @click="closeScreenshotPreview" title="Закрыть">x</button>

        <div class="modal-image-wrapper">
          <img
            :src="selectedScreenshot.url"
            :alt="selectedScreenshot.label"
            class="modal-image"
          />
        </div>

        <div class="modal-info">
          <h3 class="modal-title">{{ selectedScreenshot.label }}</h3>
          <p><strong>Пользователь:</strong> {{ selectedScreenshot.verification.full_name }}</p>
          <p><strong>Компьютерный номер:</strong> {{ selectedScreenshot.verification.personal_id || 'Не указан' }}</p>
        </div>
      </div>
    </div>

    <!-- Модальное окно для отклонения -->
    <div v-if="rejectModal.visible" class="modal-overlay" @click="closeRejectModal">
      <div class="modal-content reject-modal" @click.stop>
        <button class="modal-close" @click="closeRejectModal" title="Закрыть">x</button>

        <h3>Отклонение заявки</h3>
        <p class="reject-description">
          Укажите причину отклонения заявки на верификацию для пользователя
          <strong>{{ rejectModal.verification?.full_name }}</strong>
        </p>

        <textarea
          v-model="rejectModal.reason"
          placeholder="Введите причину отклонения..."
          class="reject-textarea"
          rows="4"
          maxlength="500"
        ></textarea>

        <div class="reject-actions">
          <button @click="closeRejectModal" class="cancel-button">
            Отмена
          </button>
          <button
            @click="handleReject"
            class="confirm-reject-button"
            :disabled="!rejectModal.reason.trim() || processingId !== null"
          >
            Отклонить
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useAdminStore } from '../../stores/admin'
import { useAuthStore } from '../../stores/auth'
import { useNotificationsStore } from '../../stores/notifications'

const adminStore = useAdminStore()
const authStore = useAuthStore()
const notificationsStore = useNotificationsStore()
const processingId = ref(null)
const selectedScreenshot = ref(null)
const screenshotCache = ref({})
const screenshotErrors = ref({})
const screenshotLoading = ref({})

const rejectModal = ref({
  visible: false,
  verification: null,
  reason: ''
})

// Переменные для архива
const activeTab = ref('pending') // 'pending' или 'archive'
const archiveVerifications = ref([])
const archiveLoading = ref(false)
const archiveError = ref(null)

const API_URL = import.meta.env.VITE_API_URL || 'https://interactive.marketingfohow.ru/api'

/**
 * Вычисляемое свойство для количества заявок в очереди
 */
const pendingCount = computed(() => {
  return adminStore.pendingVerificationsTotal || adminStore.pendingVerifications?.length || 0
})

/**
 * Получить URL скриншота для отображения
 */
function getScreenshotUrl(path) {
  if (!path) return ''

  if (!screenshotCache.value[path] && !screenshotErrors.value[path] && !screenshotLoading.value[path]) {
    loadScreenshot(path)
  }

  return screenshotCache.value[path] || ''
}

/**
 * Загрузить скриншот через админ-прокси с авторизацией
 */
async function loadScreenshot(path) {
  if (!path || screenshotCache.value[path] || screenshotLoading.value[path]) return

  screenshotLoading.value = { ...screenshotLoading.value, [path]: true }

  try {
    const token = authStore.token

    if (!token) {
      throw new Error('Требуется авторизация администратора')
    }

    const response = await fetch(`${API_URL}/admin/screenshot-proxy?path=${encodeURIComponent(path)}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })

    if (!response.ok) {
      throw new Error('Не удалось загрузить скриншот')
    }

    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)

    screenshotCache.value = { ...screenshotCache.value, [path]: objectUrl }
  } catch (error) {
    console.error('[VERIFICATION] Ошибка загрузки скриншота:', error)
    screenshotErrors.value = { ...screenshotErrors.value, [path]: true }
  } finally {
    const { [path]: _removed, ...rest } = screenshotLoading.value
    screenshotLoading.value = rest
  }
}

/**
 * Предзагрузить все скриншоты в очереди
 */
async function preloadScreenshots(verifications = []) {
  const paths = []

  verifications.forEach((verification) => {
    if (verification.screenshot_1_path) paths.push(verification.screenshot_1_path)
    if (verification.screenshot_2_path) paths.push(verification.screenshot_2_path)
  })

  await Promise.all(paths.map(loadScreenshot))
}

/**
 * Загрузить список заявок на верификацию
 */
async function loadVerifications() {
  try {
    await adminStore.fetchPendingVerifications()
    await preloadScreenshots(adminStore.pendingVerifications || [])    
  } catch (err) {
    console.error('[VERIFICATION] Ошибка загрузки заявок:', err)
  }
}

/**
 * Обработать повторную попытку загрузки при ошибке
 */
async function handleRetry() {
  adminStore.clearError()
  await loadVerifications()
}

/**
 * Открыть модальное окно с скриншотом
 */
function openScreenshotPreview(verification, screenshotNumber) {
  const path = screenshotNumber === 1 ? verification.screenshot_1_path : verification.screenshot_2_path
  loadScreenshot(path).then(() => {
    selectedScreenshot.value = {
      url: getScreenshotUrl(path),
      label: `Скриншот ${screenshotNumber}`,
      verification
    }
  })
}

/**
 * Закрыть модальное окно с скриншотом
 */
function closeScreenshotPreview() {
  selectedScreenshot.value = null
}

/**
 * Открыть модальное окно отклонения
 */
function openRejectModal(verification) {
  rejectModal.value = {
    visible: true,
    verification,
    reason: ''
  }
}

/**
 * Закрыть модальное окно отклонения
 */
function closeRejectModal() {
  rejectModal.value = {
    visible: false,
    verification: null,
    reason: ''
  }
}

/**
 * Одобрить заявку на верификацию
 */
async function handleApprove(verificationId) {
  if (!confirm('Одобрить заявку на верификацию? Пользователь получит статус верифицированного.')) {
    return
  }

  processingId.value = verificationId

  try {
    await adminStore.approveVerification(verificationId)

    notificationsStore.addNotification({
      message: 'Заявка одобрена. Пользователь верифицирован.',
      type: 'success',
      duration: 5000
    })
  } catch (err) {
    console.error('[VERIFICATION] Ошибка одобрения заявки:', err)

    let errorMessage = 'Не удалось одобрить заявку. Попробуйте позже'

    if (err.code === 'UNAUTHORIZED') {
      errorMessage = 'Сессия истекла. Выполняется выход из системы...'
    } else if (err.code === 'FORBIDDEN') {
      errorMessage = err.message || 'Недостаточно прав для выполнения этого действия'
    } else if (err.message) {
      errorMessage = err.message
    }

    notificationsStore.addNotification({
      message: errorMessage,
      type: 'error',
      duration: 5000
    })
  } finally {
    processingId.value = null
  }
}

/**
 * Отклонить заявку на верификацию
 */
async function handleReject() {
  const verification = rejectModal.value.verification
  const reason = rejectModal.value.reason.trim()

  if (!verification || !reason) {
    return
  }

  processingId.value = verification.id

  try {
    await adminStore.rejectVerification(verification.id, reason)

    closeRejectModal()

    notificationsStore.addNotification({
      message: 'Заявка отклонена. Пользователь получит уведомление.',
      type: 'success',
      duration: 5000
    })
  } catch (err) {
    console.error('[VERIFICATION] Ошибка отклонения заявки:', err)

    let errorMessage = 'Не удалось отклонить заявку. Попробуйте позже'

    if (err.code === 'UNAUTHORIZED') {
      errorMessage = 'Сессия истекла. Выполняется выход из системы...'
    } else if (err.code === 'FORBIDDEN') {
      errorMessage = err.message || 'Недостаточно прав для выполнения этого действия'
    } else if (err.message) {
      errorMessage = err.message
    }

    notificationsStore.addNotification({
      message: errorMessage,
      type: 'error',
      duration: 5000
    })
  } finally {
    processingId.value = null
  }
}

/**
 * Форматировать дату
 */
function formatDate(dateString) {
  if (!dateString) return 'Неизвестно'
  const date = new Date(dateString)
  return date.toLocaleString('ru-RU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

/**
 * Загрузка архива верификации
 */
async function loadArchive() {
  archiveLoading.value = true
  archiveError.value = null

  try {
    const token = authStore.token

    const response = await fetch(`${API_URL}/admin/verifications/archive`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    if (!response.ok) {
      throw new Error('Ошибка загрузки архива')
    }

    const data = await response.json()
    archiveVerifications.value = data.items || []

    // Предзагрузка скриншотов для архива
    await preloadScreenshots(archiveVerifications.value)
  } catch (err) {
    console.error('[ADMIN VERIFICATION] Ошибка загрузки архива:', err)
    archiveError.value = err.message || 'Не удалось загрузить архив'
  } finally {
    archiveLoading.value = false
  }
}

/**
 * Переключение табов
 */
function switchTab(tab) {
  activeTab.value = tab
  if (tab === 'archive' && archiveVerifications.value.length === 0) {
    loadArchive()
  }
}

/**
 * Открыть скриншот в модальном окне (для архива)
 */
function openArchiveScreenshotPreview(url) {
  if (!url) return
  selectedScreenshot.value = {
    url,
    label: 'Скриншот',
    verification: { full_name: '', personal_id: '' }
  }
}

// Загрузить заявки при монтировании
onMounted(async () => {
  await loadVerifications()
})

onBeforeUnmount(() => {
  Object.values(screenshotCache.value).forEach((url) => URL.revokeObjectURL(url))
})  
</script>

<style scoped>
.verification-moderation {
  padding: 20px;
}

.moderation-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  gap: 20px;
}

.header-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.moderation-header h2 {
  margin: 0;
  font-size: 24px;
  color: #333;
}

.stats-block {
  display: flex;
  gap: 20px;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 15px;
  background: #f0f0f0;
  border-radius: 5px;
}

.stat-label {
  font-size: 14px;
  color: #666;
  font-weight: 500;
}

.stat-value {
  font-size: 18px;
  font-weight: 700;
  color: #6c63ff;
}

.refresh-button {
  padding: 10px 20px;
  background: #6c63ff;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.3s;
}

.refresh-button:hover:not(:disabled) {
  background: #5a52d5;
}

.refresh-button:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
}

.spinner {
  width: 50px;
  height: 50px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #6c63ff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 20px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #666;
  font-size: 18px;
}

.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  background: #fff3f3;
  border: 2px solid #ffcccc;
  border-radius: 8px;
  margin: 20px 0;
}

.error-icon {
  width: 48px;
  height: 48px;
  background: #ff4444;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: bold;
  margin-bottom: 15px;
}

.error-message {
  color: #d32f2f;
  font-size: 16px;
  margin-bottom: 20px;
  text-align: center;
  max-width: 600px;
}

.retry-button {
  padding: 12px 30px;
  background: #6c63ff;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  transition: background 0.3s;
}

.retry-button:hover {
  background: #5a52d5;
}

.verifications-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 20px;
  margin-top: 20px;
}

.verification-card {
  position: relative;
  background: #f9f9f9;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s, box-shadow 0.3s;
}

.verification-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.user-info {
  padding: 20px;
  border-bottom: 1px solid #e0e0e0;
}

.user-name {
  margin: 0 0 15px 0;
  font-size: 18px;
  color: #333;
  font-weight: 600;
}

.user-meta {
  font-size: 14px;
  color: #666;
}

.user-meta p {
  margin: 8px 0;
}

.user-meta strong {
  color: #333;
}

.screenshots-section {
  padding: 15px 20px;
  background: #fff;
}

.screenshots-section h4 {
  margin: 0 0 15px 0;
  font-size: 14px;
  color: #666;
  font-weight: 600;
}

.screenshots-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
}

.screenshot-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  transition: opacity 0.3s;
}

.screenshot-wrapper:hover {
  opacity: 0.8;
}

.screenshot-thumb {
  width: 100%;
  height: 120px;
  object-fit: cover;
  border-radius: 8px;
  background: #e0e0e0;
}
.screenshot-placeholder {
  width: 100%;
  height: 120px;
  border-radius: 8px;
  background: #f3f3f3;
  border: 1px dashed #d0d0d0;
  color: #777;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 10px;
}

.screenshot-label {
  font-size: 12px;
  color: #666;
}

.verification-actions {
  display: flex;
  gap: 10px;
  padding: 15px 20px;
  border-top: 1px solid #e0e0e0;
}

.approve-button,
.reject-button {
  flex: 1;
  padding: 12px 15px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  transition: all 0.3s;
}

.approve-button {
  background: #4caf50;
  color: white;
}

.approve-button:hover:not(:disabled) {
  background: #45a049;
}

.reject-button {
  background: #f44336;
  color: white;
}

.reject-button:hover:not(:disabled) {
  background: #da190b;
}

.approve-button:disabled,
.reject-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.processing-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
}

.spinner-small {
  width: 30px;
  height: 30px;
  border: 3px solid #f3f3f3;
  border-top: 3px solid #6c63ff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

/* Модальное окно */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal-content {
  background: white;
  border-radius: 12px;
  max-width: 90vw;
  max-height: 90vh;
  overflow: auto;
  position: relative;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
}

.modal-close {
  position: absolute;
  top: 15px;
  right: 15px;
  width: 40px;
  height: 40px;
  background: rgba(0, 0, 0, 0.5);
  color: white;
  border: none;
  border-radius: 50%;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.3s;
  z-index: 10;
}

.modal-close:hover {
  background: rgba(0, 0, 0, 0.7);
}

.modal-image-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f5;
  min-height: 400px;
  max-height: 70vh;
  padding: 20px;
}

.modal-image {
  max-width: 100%;
  max-height: 70vh;
  object-fit: contain;
  border-radius: 8px;
}

.modal-info {
  padding: 25px;
  border-top: 1px solid #e0e0e0;
}

.modal-title {
  margin: 0 0 15px 0;
  font-size: 20px;
  color: #333;
  font-weight: 600;
}

.modal-info p {
  margin: 10px 0;
  font-size: 15px;
  color: #666;
}

.modal-info strong {
  color: #333;
}

/* Модальное окно отклонения */
.reject-modal {
  max-width: 500px;
  padding: 30px;
}

.reject-modal h3 {
  margin: 0 0 15px 0;
  font-size: 20px;
  color: #333;
}

.reject-description {
  margin: 0 0 20px 0;
  color: #666;
  font-size: 14px;
  line-height: 1.5;
}

.reject-textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 5px;
  font-size: 14px;
  resize: vertical;
  min-height: 100px;
  margin-bottom: 20px;
  font-family: inherit;
}

.reject-textarea:focus {
  outline: none;
  border-color: #6c63ff;
  box-shadow: 0 0 0 3px rgba(108, 99, 255, 0.1);
}

.reject-actions {
  display: flex;
  gap: 15px;
  justify-content: flex-end;
}

.cancel-button {
  padding: 10px 20px;
  background: #e0e0e0;
  color: #333;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: background 0.3s;
}

.cancel-button:hover {
  background: #d0d0d0;
}

.confirm-reject-button {
  padding: 10px 20px;
  background: #f44336;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  transition: background 0.3s;
}

.confirm-reject-button:hover:not(:disabled) {
  background: #da190b;
}

.confirm-reject-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Адаптивность */
@media (max-width: 768px) {
  .verifications-grid {
    grid-template-columns: 1fr;
  }

  .modal-content {
    max-width: 95vw;
    max-height: 95vh;
  }

  .modal-image-wrapper {
    min-height: 300px;
    max-height: 60vh;
  }

  .modal-image {
    max-height: 60vh;
  }

  .reject-modal {
    padding: 20px;
  }

  .tabs-switcher {
    flex-direction: column;
  }
}

/* Переключатель табов */
.tabs-switcher {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.tab-btn {
  padding: 8px 16px;
  background: #f5f5f5;
  color: #666;
  border: 2px solid transparent;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.tab-btn:hover {
  background: #e0e0e0;
}

.tab-btn.active {
  background: #6c63ff;
  color: white;
  border-color: #6c63ff;
}

/* Карточка архива */
.archive-card {
  position: relative;
}

.archive-status-badge {
  position: absolute;
  top: 16px;
  right: 16px;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 700;
  z-index: 10;
}

.archive-status-badge.status-approved {
  background: rgba(76, 175, 80, 0.2);
  color: #4CAF50;
  border: 1px solid rgba(76, 175, 80, 0.5);
}

.archive-status-badge.status-rejected {
  background: rgba(244, 67, 54, 0.2);
  color: #f44336;
  border: 1px solid rgba(244, 67, 54, 0.5);
}

/* Блок причины отклонения */
.rejection-block {
  margin-top: 12px;
  padding: 12px;
  background: rgba(244, 67, 54, 0.1);
  border-radius: 8px;
  border-left: 3px solid #f44336;
}

.rejection-block strong {
  display: block;
  margin-bottom: 6px;
  color: #f44336;
  font-size: 14px;
}

.rejection-block p {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: #333;
}

/* Сетка миниатюр скриншотов */
.screenshots-grid-mini {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.screenshot-preview-small {
  width: 100%;
  height: 120px;
  object-fit: cover;
  border-radius: 8px;
  border: 2px solid #e0e0e0;
  cursor: pointer;
  transition: all 0.2s;
}

.screenshot-preview-small:hover {
  border-color: #6c63ff;
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(108, 99, 255, 0.3);
}
</style>
