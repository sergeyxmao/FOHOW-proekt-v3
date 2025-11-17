<template>
  <div class="images-moderation">
    <div class="moderation-header">
      <h2>Модерация изображений</h2>
      <button @click="loadImages" class="refresh-button" :disabled="adminStore.isLoading">
        Обновить
      </button>
    </div>

    <!-- Индикатор загрузки -->
    <div v-if="adminStore.isLoading" class="loading">
      <div class="spinner"></div>
      <p>Загрузка изображений...</p>
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
          <img :src="getImageUrl(image.url)" :alt="image.original_name" />
        </div>

        <!-- Информация об изображении -->
        <div class="image-info">
          <h3 class="image-name">{{ image.original_name }}</h3>
          <div class="image-meta">
            <p><strong>Автор:</strong> {{ image.user_email || 'Неизвестен' }}</p>
            <p><strong>Дата загрузки:</strong> {{ formatDate(image.created_at) }}</p>
            <p v-if="image.size"><strong>Размер:</strong> {{ formatFileSize(image.size) }}</p>
            <p v-if="image.width && image.height">
              <strong>Разрешение:</strong> {{ image.width }}x{{ image.height }}
            </p>
          </div>
        </div>

        <!-- Кнопки действий -->
        <div class="image-actions">
          <button
            @click="handleApprove(image.id)"
            class="approve-button"
            :disabled="processingId === image.id"
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

        <!-- Индикатор обработки -->
        <div v-if="processingId === image.id" class="processing-overlay">
          <div class="spinner-small"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useAdminStore } from '../../stores/admin'

const adminStore = useAdminStore()
const processingId = ref(null)

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
 * Одобрить изображение
 */
async function handleApprove(imageId) {
  if (!confirm('Вы уверены, что хотите одобрить это изображение и добавить его в общую библиотеку?')) {
    return
  }

  processingId.value = imageId
  try {
    await adminStore.approveImage(imageId)
  } catch (err) {
    console.error('[MODERATION] Ошибка одобрения изображения:', err)
    alert('Ошибка при одобрении изображения: ' + err.message)
  } finally {
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

// Загрузить изображения при монтировании
onMounted(() => {
  loadImages()
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
}

.moderation-header h2 {
  margin: 0;
  font-size: 24px;
  color: #333;
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
  width: 100%;
  height: 250px;
  background: #e0e0e0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.image-preview img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
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
  gap: 10px;
  padding: 15px;
  border-top: 1px solid #e0e0e0;
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
