<template>
  <div class="images-moderation">
    <!-- Верхняя панель с заголовком и статистикой -->
    <div class="moderation-header">
      <div class="header-content">
        <h2>Модерация изображений</h2>
        <div class="stats-block">
          <div class="stat-item">
            <span class="stat-label">В очереди:</span>
            <span class="stat-value">{{ pendingCount }}</span>
          </div>
        </div>
      </div>
      <button @click="loadImages" class="refresh-button" :disabled="adminStore.isLoading">
        Обновить
      </button>
    </div>

    <!-- Индикатор загрузки -->
    <div v-if="adminStore.isLoading" class="loading">
      <div class="spinner"></div>
      <p>Загрузка изображений...</p>
    </div>

    <!-- Состояние ошибки -->
    <div v-else-if="adminStore.error" class="error-state">
      <div class="error-icon">⚠️</div>
      <p class="error-message">{{ adminStore.error }}</p>
      <button @click="handleRetry" class="retry-button">
        Повторить
      </button>
    </div>

    <!-- Пустое состояние -->
    <div v-else-if="!adminStore.pendingImages || adminStore.pendingImages.length === 0" class="empty-state">
      <p>Нет изображений, ожидающих модерации</p>
    </div>

    <!-- Список изображений -->
    <div v-else class="images-grid">
      <div v-for="image in adminStore.pendingImages" :key="image.id" class="image-card">
        <!-- Превью изображения -->
        <div class="image-preview">
          <img :src="getImageUrl(image.previewUrl)" :alt="image.original_name" />
        </div>

        <!-- Информация об изображении -->
        <div class="image-info">
          <h3 class="image-name">{{ image.original_name }}</h3>
          <div class="image-meta">
            <p v-if="image.user_full_name">
              <strong>ФИО:</strong> {{ image.user_full_name }}
            </p>
            <p v-if="image.user_personal_id">
              <strong>Компьютерный номер:</strong> {{ image.user_personal_id }}
            </p>
            <p v-if="!image.user_full_name && !image.user_personal_id">
              <strong>Автор:</strong> Неизвестен
            </p>
            <p><strong>Дата заявки:</strong> {{ formatDate(image.share_requested_at) }}</p>
            <p v-if="image.file_size"><strong>Размер:</strong> {{ formatFileSize(image.file_size) }}</p>
            <p v-if="image.width && image.height">
              <strong>Разрешение:</strong> {{ image.width }}x{{ image.height }}
            </p>
          </div>
        </div>

        <!-- Выбор папки и кнопки действий -->
        <div class="image-actions">
          <div class="folder-select-wrapper">
            <label :for="`folder-select-${image.id}`" class="folder-label">
              Папка:
            </label>
            <select
              :id="`folder-select-${image.id}`"
              v-model="selectedFolders[image.id]"
              class="folder-select"
              :disabled="processingId === image.id"
            >
              <option value="" disabled>Выберите папку</option>
              <option
                v-for="folder in adminStore.sharedFolders"
                :key="folder.id"
                :value="folder.id"
              >
                {{ folder.name }}
              </option>
            </select>
          </div>

          <div class="action-buttons">
            <button
              @click="handleApprove(image.id)"
              class="approve-button"
              :disabled="processingId === image.id || !selectedFolders[image.id]"
              :title="!selectedFolders[image.id] ? 'Выберите папку для одобрения' : ''"
            >
              ✓ Одобрить
            </button>
            <button
              @click="handleReject(image.id)"
              class="reject-button"
              :disabled="processingId === image.id"
            >
              ✗ Отклонить
            </button>
          </div>
        </div>

        <!-- Индикатор обработки -->
        <div v-if="processingId === image.id" class="processing-overlay">
          <div class="spinner-small"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAdminStore } from '../../stores/admin'
import { useNotificationsStore } from '../../stores/notifications'

const adminStore = useAdminStore()
const notificationsStore = useNotificationsStore()
const processingId = ref(null)
const selectedFolders = ref({})

/**
 * Вычисляемое свойство для количества изображений в очереди
 */
const pendingCount = computed(() => {
  return adminStore.pendingImagesTotal || adminStore.pendingImages?.length || 0
})

/**
 * Загрузить список изображений на модерации
 */
async function loadImages() {
  try {
    await adminStore.fetchPendingImages()
  } catch (err) {
    console.error('[MODERATION] Ошибка загрузки изображений:', err)
  }
}

/**
 * Загрузить список папок
 */
async function loadFolders() {
  try {
    await adminStore.fetchSharedFolders()
  } catch (err) {
    console.error('[MODERATION] Ошибка загрузки папок:', err)
  }
}

/**
 * Обработать повторную попытку загрузки при ошибке
 */
async function handleRetry() {
  adminStore.clearError()
  await loadImages()
}

/**
 * Одобрить изображение
 */
async function handleApprove(imageId) {
  const folderId = selectedFolders.value[imageId]

  // Проверить, что для данной картинки выбран shared_folder_id
  if (!folderId) {
    // Если папка не выбрана - показать уведомление
    notificationsStore.addNotification({
      message: 'Выберите папку общей библиотеки',
      type: 'error',
      duration: 4000
    })
    return
  }

  // Заблокировать элементы управления для этой картинки
  processingId.value = imageId

  try {
    // Отправить запрос на одобрение
    await adminStore.approveImage(imageId, folderId)

    // Удаляем выбор папки после успешного одобрения
    delete selectedFolders.value[imageId]

    // При успешном ответе backend - показать уведомление
    notificationsStore.addNotification({
      message: 'Изображение одобрено и добавлено в общую библиотеку',
      type: 'success',
      duration: 5000
    })
  } catch (err) {
    console.error('[MODERATION] Ошибка одобрения изображения:', err)

    // При ошибке - показать уведомление об ошибке (без технических подробностей)
    notificationsStore.addNotification({
      message: 'Не удалось одобрить изображение. Попробуйте позже',
      type: 'error',
      duration: 5000
    })
  } finally {
    // Разблокировать элементы управления
    processingId.value = null
  }
}

/**
 * Отклонить изображение
 */
async function handleReject(imageId) {
  if (!confirm('Вы уверены, что хотите отклонить и удалить это изображение?')) {
    return
  }

  processingId.value = imageId
  try {
    await adminStore.rejectImage(imageId)
  } catch (err) {
    console.error('[MODERATION] Ошибка отклонения изображения:', err)
    alert('Ошибка при отклонении изображения: ' + err.message)
  } finally {
    processingId.value = null
  }
}

/**
 * Получить полный URL изображения
 */
function getImageUrl(url) {
  if (url.startsWith('http')) {
    return url
  }
  const API_URL = import.meta.env.VITE_API_URL || 'https://interactive.marketingfohow.ru/api'
  return `${API_URL.replace('/api', '')}${url}`
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
 * Форматировать размер файла
 */
function formatFileSize(bytes) {
  if (!bytes) return 'Неизвестно'
  const kb = bytes / 1024
  if (kb < 1024) {
    return `${kb.toFixed(2)} KB`
  }
  const mb = kb / 1024
  return `${mb.toFixed(2)} MB`
}

// Загрузить изображения и папки при монтировании
onMounted(async () => {
  await Promise.all([
    loadImages(),
    loadFolders()
  ])
})
</script>

<style scoped>
.images-moderation {
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
  font-size: 48px;
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

.images-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 20px;
  margin-top: 20px;
}

.image-card {
  position: relative;
  background: #f9f9f9;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s, box-shadow 0.3s;
}

.image-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.image-preview {
  width: 120px;
  height: 120px;
  background: #e0e0e0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  margin: 0 auto;
  border-radius: 8px 8px 0 0;
}

.image-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.image-info {
  padding: 15px;
}

.image-name {
  margin: 0 0 10px 0;
  font-size: 16px;
  color: #333;
  font-weight: 600;
  word-break: break-word;
}

.image-meta {
  font-size: 13px;
  color: #666;
}

.image-meta p {
  margin: 5px 0;
}

.image-meta strong {
  color: #333;
}

.image-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 15px;
  border-top: 1px solid #e0e0e0;
}

.folder-select-wrapper {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.folder-label {
  font-size: 13px;
  font-weight: 600;
  color: #333;
}

.folder-select {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 5px;
  font-size: 14px;
  background: white;
  cursor: pointer;
  transition: border-color 0.3s;
}

.folder-select:hover:not(:disabled) {
  border-color: #6c63ff;
}

.folder-select:disabled {
  background: #f5f5f5;
  cursor: not-allowed;
}

.action-buttons {
  display: flex;
  gap: 10px;
}

.approve-button,
.reject-button {
  flex: 1;
  padding: 10px 15px;
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
</style>
