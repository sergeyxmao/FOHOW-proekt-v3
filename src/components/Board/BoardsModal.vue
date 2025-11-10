<template>
  <Teleport to="body">
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
              v-if="userStore.features && userStore.usage && userStore.features.max_boards !== -1"
              label="Доски"
              :current="userStore.usage.boards.current"
              :limit="userStore.features.max_boards"
            />

            <div v-if="loading" class="loading">
              <div class="spinner"></div>
              <p>Загрузка структур...</p>
            </div>

            <div v-else-if="error" class="error-message">
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
                @click="openBoard(board.id)"
              >
                <div class="board-thumbnail">
                  <img
                    v-if="board.thumbnail_url"
                    :src="board.thumbnail_url"
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
                  <div v-if="activeMenu === board.id" class="dropdown-menu">
                    <button @click="renameBoard(board)">✏️ Переименовать</button>
                    <button @click="duplicateBoard(board.id)">📋 Дублировать</button>
                    <button @click="deleteBoard(board.id)" class="danger">🗑️ Удалить</button>
                  </div>
                </div>
              </div>
            </div>
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
const boards = ref([])
const loading = ref(false)
const error = ref('')
const activeMenu = ref(null)

const API_URL = import.meta.env.VITE_API_URL || 'https://interactive.marketingfohow.ru/api'

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    loadBoards()
  }
})
function handleBoardsRefresh() {
  loadBoards()
}

onMounted(() => {
  window.addEventListener('boards:refresh', handleBoardsRefresh)
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
  try {
    const response = await fetch(`${API_URL}/boards`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Новая структура',
        content: {
          objects: [],
          background: '#ffffff',
          zoom: 1
        }
      })
    })

    if (!response.ok) {
      // Проверяем, не превышен ли лимит
      if (response.status === 403) {
        try {
          const errorData = await response.json()
          if (errorData.code === 'USAGE_LIMIT_REACHED') {
            // Показываем специфичное сообщение о превышении лимита
            alert(errorData.error || 'Достигнут лимит досок на вашем тарифе')
            return
          }
        } catch (parseError) {
          // Если не удалось распарсить JSON, продолжаем с общей ошибкой
        }
      }
      throw new Error('Ошибка создания структуры')
    }

    const data = await response.json()
    emit('open-board', data.board.id)
    close()
  } catch (err) {
    error.value = err.message
  }
}

function openBoard(id) {
  emit('open-board', id)
  close()
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
      // Проверяем, не превышен ли лимит
      if (response.status === 403) {
        try {
          const errorData = await response.json()
          if (errorData.code === 'USAGE_LIMIT_REACHED') {
            // Показываем специфичное сообщение о превышении лимита
            alert(errorData.error || 'Достигнут лимит на вашем тарифе')
            activeMenu.value = null
            return
          }
        } catch (parseError) {
          // Если не удалось распарсить JSON, продолжаем с общей ошибкой
        }
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

  try {
    const response = await fetch(`${API_URL}/boards/${id}/duplicate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    })

    if (!response.ok) {
      // Проверяем, не превышен ли лимит
      if (response.status === 403) {
        try {
          const errorData = await response.json()
          if (errorData.code === 'USAGE_LIMIT_REACHED') {
            // Показываем специфичное сообщение о превышении лимита
            alert(errorData.error || 'Достигнут лимит досок на вашем тарифе')
            activeMenu.value = null
            return
          }
        } catch (parseError) {
          // Если не удалось распарсить JSON, продолжаем с общей ошибкой
        }
      }
      throw new Error('Ошибка дублирования')
    }

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
  z-index: 10000;
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

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
