<template>
  <!-- 
    Один Teleport для управления обоими модальными окнами.
    Это правильный подход, чтобы избежать вложенности.
  -->
  <Teleport to="body">
    <!-- Основное модальное окно -->
    <Transition name="modal">
      <div v-if="isOpen" class="modal-overlay" @click="close">
        <div class="modal-content" @click.stop>
          <button class="modal-close" @click="close">✕</button>
          
          <div class="boards-container">
            <div class="boards-header">
              <h2>📋 Мои структуры</h2>
              <FeatureGate feature="max_boards">
                <button class="btn-create" @click="createNewBoard">
                  ➕ Создать структуру
                </button>
              </FeatureGate>
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

            <!-- ШАГ 1: Блок ошибки исправлен и теперь использует "error" -->
            <div v-if="error" class="error-message">
              ❌ {{ error }}
            </div>

            <div v-else-if="boards.length === 0" class="empty-state">
              <div class="empty-icon">🎨</div>
              <h3>У вас пока нет структур</h3>
              <p>Создайте первую структуру, чтобы начать работу</p>
              <FeatureGate feature="max_boards">
                <button class="btn-create-big" @click="createNewBoard">
                  ➕ Создать первую структуру
                </button>
              </FeatureGate>
            </div>

            <div v-else class="boards-grid">
              <div
                v-for="board in boards"
                :key="board.id"
                class="board-card"
                :class="{ 'locked': board.is_locked }"
                @click="openBoard(board)"
              >
                <div v-if="board.is_locked" class="lock-indicator">
                  <span class="lock-icon">🔒</span>
                </div>

                <div class="board-thumbnail">
                  <img
                    v-if="board.thumbnail_url"
                    :src="getThumbnailUrl(board.thumbnail_url)"
                    alt="Preview"
                    class="board-thumb-image"
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
                      <FeatureGate feature="can_export_pdf" displayMode="hide" :showUpgrade="false">
                        <button @click="exportBoardToPDF(board.id)">📄 Экспорт PDF</button>
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

    <!-- Модальное окно для заблокированной доски -->
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

const API_URL = import.meta.env.VITE_API_URL || 'https://interactive.marketingfohow.ru/api'

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

function openBoard(board) {
  // Если передан только ID (из меню), найдем доску
  const boardData = typeof board === 'object' ? board : boards.value.find(b => b.id === board)

  if (!boardData) {
    return
  }

  // Проверяем, заблокирована ли доска
  if (boardData.is_locked) {
    // Вычисляем количество дней до удаления
    const daysUntilDeletion = calculateDaysUntilDeletion(boardData.locked_at)

    lockedMessage.value = `Эта доска заблокирована. Если в течение ${daysUntilDeletion} дней не произойдет продление тарифа минимум на «Индивидуальный», доска будет автоматически удалена.`
    showLockedModal.value = true
    return
  }

  // Если доска не заблокирована, открываем ее
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

async function exportBoardToPDF(id) {
  try {
    // Открываем доску для печати/экспорта в PDF
    const board = boards.value.find(b => b.id === id)
    if (!board) return

    // Открываем доску и затем вызываем печать
    emit('open-board', id)
    close()

    // Даем время загрузиться доске, затем вызываем печать
    setTimeout(() => {
      window.print()
    }, 1000)

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

/* Стили для заблокированных досок */
.board-card.locked {
  opacity: 0.6;
  filter: grayscale(50%);
  position: relative;
}

.board-card.locked::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.1);
  pointer-events: none;
  border-radius: 16px;
  z-index: 1;
}

.board-card.locked:hover {
  opacity: 0.7;
}

.lock-indicator {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 2;
  pointer-events: none;
}

.lock-icon {
  font-size: 48px;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  filter: drop-shadow(0 0 10px rgba(255, 255, 255, 0.8));
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
