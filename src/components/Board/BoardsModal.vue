<template>
  <Teleport to="body">
    <!-- Основное модальное окно -->
    <Transition name="modal">
      <div v-if="isOpen" class="modal-overlay" @click="close">
        <div class="modal-content" @click.stop>
          <button class="modal-close" @click="close">✕</button>
          
          <div class="boards-container">
            <div class="boards-header">
              <h2>📋 Мои структуры</h2>
              <button class="btn-create" @click="createNewBoard">
                ➕ Создать структуру
              </button>
            </div>
  
            <UsageLimitBar
              v-if="subscriptionStore.currentPlan"
              resourceType="boards"
              label="Доски"
            />

            <div v-if="loading" class="loading">
              <div class="spinner"></div>
              <p>Загрузка структур...</p>
            </div>

            <div v-if="error" class="error-message">
              ❌ {{ error }}
            </div>

            <div v-else-if="boards.length === 0" class="empty-state">
              <div class="empty-icon">🎨</div>
              <h3>У вас пока нет структур</h3>
              <p>Создайте первую структуру, чтобы начать работу</p>
              <button class="btn-create-big" @click="createNewBoard">
                ➕ Создать первую структуру
              </button>
            </div>

            <div v-else class="boards-grid">
              <div
                v-for="board in boards"
                :key="board.id"
                class="board-card"
                :class="{
                  'soft-locked': board.lock_status === 'soft_lock',
                  'hard-locked': board.lock_status === 'hard_lock'
                }"
                @click="openBoard(board)"
              >
                <!-- Оверлей для Soft Lock -->
                <div v-if="board.lock_status === 'soft_lock'" class="lock-overlay soft-lock-overlay">
                  <div class="lock-overlay-content">
                    <span class="lock-timer-icon">⏱️</span>
                    <span class="lock-timer-text">Блокировка через {{ board.daysUntilBlock }} дн.</span>
                    <button class="lock-info-btn" @click.stop="showLockInfoModal(board)" title="Подробнее">?</button>
                  </div>
                </div>

                <!-- Оверлей для Hard Lock -->
                <div v-if="board.lock_status === 'hard_lock'" class="lock-overlay hard-lock-overlay">
                  <div class="lock-overlay-content">
                    <span class="lock-icon">🔒</span>
                    <span class="lock-timer-text">Удаление через {{ board.daysUntilDelete }} дн.</span>
                    <button class="lock-info-btn" @click.stop="showLockInfoModal(board)" title="Подробнее">?</button>
                  </div>
                </div>

                <div class="board-thumbnail">
                  <img
                    v-if="board.thumbnail_url && !failedThumbnails.has(board.id)"
                    :src="getThumbnailUrl(board.thumbnail_url)"
                    alt="Preview"
                    class="board-thumb-image"
                    @error="handleThumbnailError(board.id)"
                  >
                  <div v-else class="board-placeholder">🎨</div>
                </div>

                <div class="board-info">
                  <h3>{{ board.name }}</h3>
                  <p class="board-meta">📅 {{ formatDate(board.updated_at) }}</p>
                  <div class="board-stats">
                    <span class="stat">📦 {{ board.object_count }} объектов</span>
                  </div>
                </div>

                <div class="board-actions" @click.stop>
                  <button class="btn-menu" @click="toggleMenu(board.id)">⋯</button>
                  <transition name="dropdown">
                    <div v-if="activeMenu === board.id" class="dropdown-menu">
                      <button @click="openBoard(board)">📂 Открыть</button>
                      <button @click="renameBoard(board)">✏️ Переименовать</button>
                      <FeatureGate feature="can_duplicate_boards" displayMode="hide" :showUpgrade="false">
                        <button @click="duplicateBoard(board.id)">📋 Дублировать</button>
                      </FeatureGate>
                      <button @click="deleteBoard(board.id)" class="danger">🗑️ Удалить</button>
                    </div>
                  </transition>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Модальное окно для заблокированной доски (Hard Lock) -->
    <Transition name="modal-fade">
      <div v-if="showLockedModal" class="locked-modal-overlay" @click="showLockedModal = false">
        <div class="locked-modal-content" @click.stop>
          <button class="locked-modal-close" @click="showLockedModal = false">✕</button>

          <div class="locked-modal-icon">🔒</div>
          <h2>Доска заблокирована</h2>
          <p class="locked-modal-message">{{ lockedMessage }}</p>

          <div class="locked-modal-actions">
            <button class="btn-upgrade" @click="goToPayment">
              Продлить тариф
            </button>
            <button class="btn-cancel" @click="showLockedModal = false">
              Закрыть
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Модальное окно с информацией о лимите тарифа -->
    <Transition name="modal-fade">
      <div v-if="showLockInfoModalVisible" class="locked-modal-overlay" @click="showLockInfoModalVisible = false">
        <div class="locked-modal-content lock-info-modal" @click.stop>
          <button class="locked-modal-close" @click="showLockInfoModalVisible = false">✕</button>

          <div class="locked-modal-icon">{{ selectedBoardForInfo?.lock_status === 'soft_lock' ? '⏱️' : '🔒' }}</div>
          <h2>Лимит тарифного плана</h2>

          <div class="lock-info-details">
            <p v-if="selectedBoardForInfo?.lock_status === 'soft_lock'" class="locked-modal-message">
              Ваша подписка истекла. Эта доска превышает лимит бесплатного тарифа.
              <br><br>
              <strong>Сейчас она доступна только для чтения (Soft Lock).</strong>
              <br><br>
              Через <strong>{{ selectedBoardForInfo?.daysUntilBlock }} дней</strong> она будет заблокирована полностью,
              а затем удалена.
            </p>
            <p v-else class="locked-modal-message">
              Эта доска полностью заблокирована (Hard Lock) и недоступна для просмотра.
              <br><br>
              Через <strong>{{ selectedBoardForInfo?.daysUntilDelete }} дней</strong> она будет автоматически удалена.
            </p>

            <div class="lock-info-tip">
              <strong>Чтобы сохранить доску:</strong>
              <ul>
                <li>Продлите подписку</li>
                <li>Или удалите другие доски, чтобы освободить место</li>
              </ul>
            </div>
          </div>

          <div class="locked-modal-actions">
            <button class="btn-upgrade" @click="goToPayment">
              Продлить подписку
            </button>
            <button class="btn-cancel" @click="showLockInfoModalVisible = false">
              Закрыть
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { useAuthStore } from '../../stores/auth'
import { useUserStore } from '@/stores/user'
import { useSubscriptionStore } from '@/stores/subscription'
import { useNotificationsStore } from '@/stores/notifications'
import FeatureGate from '@/components/FeatureGate.vue'
import UsageLimitBar from '@/components/UsageLimitBar.vue'

const props = defineProps({
  isOpen: {
    type: Boolean,
    required: true
  }
})

const emit = defineEmits(['close', 'open-board'])

const authStore = useAuthStore()
const userStore = useUserStore()
const subscriptionStore = useSubscriptionStore()
const notificationsStore = useNotificationsStore()
const boards = ref([])
const loading = ref(false)
const error = ref('')
const activeMenu = ref(null)
const showLockedModal = ref(false)
const lockedMessage = ref('')
const showLockInfoModalVisible = ref(false)
const selectedBoardForInfo = ref(null)
const failedThumbnails = ref(new Set())

const API_URL = import.meta.env.VITE_API_URL || 'https://interactive.marketingfohow.ru/api'

// Обработчик ошибки загрузки миниатюры
const handleThumbnailError = (boardId) => {
  failedThumbnails.value = new Set([...failedThumbnails.value, boardId])
}

// Функция для формирования полного URL миниатюры
const getThumbnailUrl = (thumbnailUrl) => {
  if (!thumbnailUrl) return ''
  // Если URL уже полный (начинается с http:// или https://), возвращаем как есть
  if (thumbnailUrl.startsWith('http://') || thumbnailUrl.startsWith('https://')) {
    return thumbnailUrl
  }
  // Иначе добавляем базовый URL API
  // Убираем '/api' из конца API_URL, так как thumbnail_url начинается с '/'
  const baseUrl = API_URL.replace(/\/api$/, '')
  return `${baseUrl}${thumbnailUrl}`
}

watch(() => props.isOpen, async (newVal) => {
  if (newVal) {
    // Загружаем план подписки перед показом модалки
    try {
      await subscriptionStore.loadPlan()
    } catch (error) {
      console.error('Ошибка загрузки плана подписки:', error)
    }
    loadBoards()
  }
})

function handleBoardsRefresh() {
  loadBoards()
}

function handleUpgradeClick() {
  notificationsStore.addNotification({
    type: 'info',
    message: 'Достигнут лимит на вашем тарифе.',
    actionText: 'Улучшить тариф',
    onAction: () => {
      window.location.href = '/pricing'
    }
  })
}

onMounted(() => {
  window.addEventListener('boards:refresh', handleBoardsRefresh)
  // Загружаем информацию о тарифе пользователя через subscription store
  subscriptionStore.loadPlan().catch(console.error)
})

onBeforeUnmount(() => {
  window.removeEventListener('boards:refresh', handleBoardsRefresh)
})

async function loadBoards() {
  loading.value = true
  error.value = ''
  failedThumbnails.value = new Set()

  try {
    const response = await fetch(`${API_URL}/boards`, {
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    })
    
    if (!response.ok) {
      throw new Error('Ошибка загрузки структур')
    }
    
    const data = await response.json()
    boards.value = data.boards
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

async function createNewBoard() {
  error.value = ''

  try {
    const response = await fetch(`${API_URL}/boards`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name: 'Новая структура' })
    })

    // Если ответ сервера НЕ успешный (статус 4xx или 5xx)
    if (!response.ok) {
      const errorData = await response.json()
      // Передаем ошибку с сервера в блок catch
      throw errorData
    }

    // Этот код выполнится только при успешном создании
    const data = await response.json()
    // Обновляем статистику использования
    await subscriptionStore.refreshUsage()
    emit('open-board', data.board.id)
    close()

  } catch (err) {
    // Здесь мы ловим ВСЕ ошибки: и сетевые, и те, что пришли с сервера

    // Если это ошибка о превышении лимита
    if (err.code === 'USAGE_LIMIT_REACHED') {
      notificationsStore.addNotification({
        type: 'error',
        message: err.error || 'Достигнут лимит на вашем тарифе.',
        actionText: 'Улучшить тариф',
        onAction: () => {
          // Переход на страницу тарифов
          window.location.href = '/pricing'
        }
      })
    } else {
      // Для всех остальных ошибок показываем красную плашку
      error.value = err.error || 'Произошла неизвестная ошибка при создании структуры.'
    }
  }
}

function showLockInfoModal(board) {
  selectedBoardForInfo.value = board
  showLockInfoModalVisible.value = true
}

function openBoard(board) {
  // Если передан только ID (из меню), найдем доску
  const boardData = typeof board === 'object' ? board : boards.value.find(b => b.id === board)

  if (!boardData) {
    return
  }

  const lockStatus = boardData.lock_status || 'active'

  // Hard Lock - доска полностью недоступна
  if (lockStatus === 'hard_lock') {
    lockedMessage.value = `Эта доска полностью заблокирована. Через ${boardData.daysUntilDelete || 0} дней она будет автоматически удалена. Продлите подписку для восстановления доступа.`
    showLockedModal.value = true
    return
  }

  // Soft Lock или Active - открываем доску (для soft_lock будет readonly режим на стороне редактора)
  emit('open-board', boardData.id)
  close()
}

function calculateDaysUntilDeletion(lockedAt) {
  if (!lockedAt) return 14 // По умолчанию 14 дней

  const lockDate = new Date(lockedAt)
  const deletionDate = new Date(lockDate)
  deletionDate.setDate(deletionDate.getDate() + 14) // 14 дней с момента блокировки

  const now = new Date()
  const diffTime = deletionDate - now
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  return Math.max(0, diffDays)
}

function goToPayment() {
  showLockedModal.value = false
  showLockInfoModalVisible.value = false
  close()
  window.location.href = '/pricing'
}

function close() {
  emit('close')
}

function toggleMenu(id) {
  activeMenu.value = activeMenu.value === id ? null : id
}

async function renameBoard(board) {
  const newName = prompt('Введите новое название:', board.name)
  if (!newName || newName === board.name) return

  try {
    const response = await fetch(`${API_URL}/boards/${board.id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${authStore.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name: newName })
    })

    if (!response.ok) {
      const errorData = await response.json()
      if (errorData.code === 'USAGE_LIMIT_REACHED' || errorData.upgradeRequired) {
        console.log('🚫 Rename limit reached, showing notification...')
        notificationsStore.addNotification({
          type: 'error',
          message: errorData.error || 'Достигнут лимит на вашем тарифе.',
          actionText: 'Улучшить тариф',
          onAction: () => {
            window.location.href = '/pricing'
          }
        })
        activeMenu.value = null
        return
      }
      throw new Error('Ошибка переименования')
    }

    await loadBoards()
    activeMenu.value = null
  } catch (err) {
    error.value = err.message
  }
}

async function duplicateBoard(id) {
  if (!confirm('Создать копию структуры?')) return

  // Проверяем лимит досок ПЕРЕД запросом через subscription store
  const limitInfo = subscriptionStore.checkLimit('boards')

  if (!limitInfo.canCreate) {
    console.log('⚠️ Cannot duplicate: limit reached! Showing notification...')
    notificationsStore.addNotification({
      type: 'error',
      message: 'Достигнут лимит создания досок на вашем тарифе.',
      actionText: 'Улучшить тариф',
      onAction: () => {
        window.location.href = '/pricing'
      }
    })
    return
  }

  try {
    const response = await fetch(`${API_URL}/boards/${id}/duplicate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    })

    if (!response.ok) {
      const errorData = await response.json()
      if (errorData.code === 'USAGE_LIMIT_REACHED' || errorData.upgradeRequired) {
        console.log('🚫 Duplicate limit reached, showing notification...')
        notificationsStore.addNotification({
          type: 'error',
          message: errorData.error || 'Достигнут лимит на вашем тарифе.',
          actionText: 'Улучшить тариф',
          onAction: () => {
            window.location.href = '/pricing'
          }
        })
        activeMenu.value = null
        return
      }
      throw new Error('Ошибка дублирования')
    }

    const data = await response.json()
    // Обновляем статистику использования
    await subscriptionStore.refreshUsage()
    await loadBoards()
    activeMenu.value = null
  } catch (err) {
    error.value = err.message
  }
}

async function deleteBoard(id) {
  if (!confirm('Удалить структуру? Это действие нельзя отменить.')) return

  try {
    const response = await fetch(`${API_URL}/boards/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    })

    if (!response.ok) throw new Error('Ошибка удаления')

    // Обновляем статистику использования
    await subscriptionStore.refreshUsage()
    await loadBoards()
    activeMenu.value = null
  } catch (err) {
    error.value = err.message
  }
}

function formatDate(dateString) {
  const date = new Date(dateString)
  const now = new Date()
  const diff = now - date
  
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  
  if (minutes < 1) return 'только что'
  if (minutes < 60) return `${minutes} мин. назад`
  if (hours < 24) return `${hours} ч. назад`
  if (days === 1) return 'вчера'
  if (days < 7) return `${days} дн. назад`
  
  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  })
}
</script>

<style scoped>
/* Стили остаются без изменений */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999; /* Уменьшаем z-index основного модала */
}

.modal-content {
  background: white;
  border-radius: 20px;
  max-width: 1200px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
  position: relative;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
}

.modal-close {
  position: absolute;
  top: 20px;
  right: 20px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background: #f5f5f5;
  font-size: 20px;
  cursor: pointer;
  transition: all 0.2s;
  z-index: 1;
}

.modal-close:hover {
  background: #e0e0e0;
  transform: rotate(90deg);
}

.boards-container {
  padding: 40px;
}

.boards-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
}

.boards-header h2 {
  font-size: 28px;
  font-weight: 700;
  margin: 0;
}

.btn-create {
  padding: 12px 24px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s;
  position: relative;
  overflow: hidden;
}

.btn-create::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.3);
  transform: translate(-50%, -50%);
  transition: width 0.6s, height 0.6s;
}

.btn-create:active::before {
  width: 300px;
  height: 300px;
}

.btn-create:hover {
  transform: translateY(-2px);
}

.loading {
  text-align: center;
  padding: 60px 20px;
}

.spinner {
  width: 50px;
  height: 50px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 20px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-message {
  background: #ffebee;
  color: #c62828;
  padding: 20px;
  border-radius: 12px;
  text-align: center;
  margin-bottom: 20px;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
}

.empty-icon {
  font-size: 80px;
  margin-bottom: 20px;
}

.empty-state h3 {
  font-size: 20px;
  margin-bottom: 10px;
}

.empty-state p {
  color: #666;
  margin-bottom: 30px;
}

.btn-create-big {
  padding: 16px 32px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
}

.boards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}

.board-card {
  background: white;
  border: 2px solid #f0f0f0;
  border-radius: 16px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
}

.board-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0,0,0,0.1);
  border-color: #667eea;
}

.board-thumbnail {
  width: 100%;
  height: 160px;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
}

.board-placeholder {
  font-size: 50px;
  opacity: 0.3;
}

.board-thumb-image {
  width: min(100%, 200px);
  height: 120px;
  object-fit: cover;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.05);
  display: block;
}

.board-info {
  padding: 16px;
}

.board-info h3 {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 8px 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.board-meta {
  font-size: 13px;
  color: #666;
  margin: 0 0 8px 0;
}

.board-stats {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.stat {
  font-size: 11px;
  padding: 4px 8px;
  background: #f0f0f0;
  border-radius: 6px;
  color: #666;
}

.board-actions {
  position: absolute;
  top: 12px;
  right: 12px;
}

.btn-menu {
  background: rgba(255,255,255,0.9);
  border: none;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  font-size: 18px;
  cursor: pointer;
  backdrop-filter: blur(10px);
}

.dropdown-menu {
  position: absolute;
  top: 40px;
  right: 0;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.15);
  overflow: hidden;
  z-index: 10;
  min-width: 180px;
}

.dropdown-menu button {
  display: block;
  width: 100%;
  padding: 12px 16px;
  text-align: left;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 14px;
}

.dropdown-menu button:hover {
  background: #f5f5f5;
}

.dropdown-menu button.danger {
  color: #f44336;
}

/* Стили для заблокированных досок - Soft Lock */
.board-card.soft-locked {
  position: relative;
}

.board-card.soft-locked .board-thumbnail {
  filter: grayscale(30%);
}

/* Стили для заблокированных досок - Hard Lock */
.board-card.hard-locked {
  position: relative;
}

.board-card.hard-locked .board-thumbnail {
  filter: grayscale(70%);
  opacity: 0.6;
}

/* Оверлей для блокировок */
.lock-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 160px; /* Высота thumbnail */
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 5;
  border-radius: 16px 16px 0 0;
}

.soft-lock-overlay {
  background: linear-gradient(180deg, rgba(255, 152, 0, 0.85) 0%, rgba(255, 152, 0, 0.7) 100%);
}

.hard-lock-overlay {
  background: linear-gradient(180deg, rgba(244, 67, 54, 0.9) 0%, rgba(244, 67, 54, 0.75) 100%);
}

.lock-overlay-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: white;
  text-align: center;
  padding: 16px;
}

.lock-timer-icon {
  font-size: 32px;
}

.lock-icon {
  font-size: 32px;
}

.lock-timer-text {
  font-size: 14px;
  font-weight: 600;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.lock-info-btn {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 2px solid white;
  background: transparent;
  color: white;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 4px;
}

.lock-info-btn:hover {
  background: white;
  color: #ff9800;
}

.hard-lock-overlay .lock-info-btn:hover {
  color: #f44336;
}

/* Стили для модального окна заблокированной доски */
.locked-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10001; /* Выше чем основное модальное окно досок */
}

.locked-modal-content {
  background: white;
  border-radius: 24px;
  padding: 40px;
  max-width: 500px;
  width: 90%;
  position: relative;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  text-align: center;
}

.locked-modal-close {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: #f5f5f5;
  font-size: 18px;
  cursor: pointer;
  transition: all 0.2s;
}

.locked-modal-close:hover {
  background: #e0e0e0;
  transform: rotate(90deg);
}

.locked-modal-icon {
  font-size: 64px;
  margin-bottom: 20px;
}

.locked-modal-content h2 {
  font-size: 24px;
  font-weight: 700;
  margin: 0 0 16px 0;
  color: #333;
}

.locked-modal-message {
  font-size: 16px;
  line-height: 1.6;
  color: #666;
  margin: 0 0 32px 0;
}

.locked-modal-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.btn-upgrade {
  padding: 14px 28px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.btn-upgrade:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
}

.btn-cancel {
  padding: 14px 28px;
  background: #f5f5f5;
  color: #666;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-cancel:hover {
  background: #e0e0e0;
}

/* Стили для информационного модального окна о блокировке */
.lock-info-modal {
  max-width: 520px;
}

.lock-info-details {
  text-align: left;
  margin-bottom: 24px;
}

.lock-info-tip {
  background: #f5f5f5;
  border-radius: 12px;
  padding: 16px;
  margin-top: 16px;
}

.lock-info-tip strong {
  display: block;
  margin-bottom: 8px;
  color: #333;
}

.lock-info-tip ul {
  margin: 0;
  padding-left: 20px;
  color: #666;
}

.lock-info-tip li {
  margin: 4px 0;
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .modal-content {
  animation: scaleIn 0.3s ease;
}

.modal-leave-active .modal-content {
  animation: scaleIn 0.3s ease reverse;
}

/* Анимация для модального окна заблокированной доски */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.3s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-enter-active .locked-modal-content {
  animation: scaleIn 0.3s ease;
}

.modal-fade-leave-active .locked-modal-content {
  animation: scaleIn 0.3s ease reverse;
}

@keyframes scaleIn {
  from {
    transform: scale(0.9);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

/* Анимация для dropdown */
.dropdown-enter-active {
  animation: slideDown 0.2s ease;
}

.dropdown-leave-active {
  animation: slideDown 0.2s ease reverse;
}
</style>
