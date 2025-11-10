<template>
  <div class="boards-container">
    <div class="boards-header">
      <h1>📋 Мои структуры</h1>
      <button class="btn-create" @click="createNewBoard">
        ➕ Создать структуру
      </button>
    </div>

    <div v-if="loading" class="loading">
      <div class="spinner"></div>
      <p>Загрузка структур...</p>
    </div>

    <div v-else-if="error" class="error-message">
      ❌ {{ error }}
    </div>

    <div v-else-if="boards.length === 0" class="empty-state">
      <div class="empty-icon">🎨</div>
      <h2>У вас пока нет структур</h2>
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
          <div v-else class="board-placeholder">
            🎨
          </div>
        </div>
        
        <div class="board-info">
          <h3>{{ board.name }}</h3>
          <p class="board-meta">
            📅 {{ formatDate(board.updated_at) }}
          </p>
          <div class="board-stats">
            <span class="stat">📦 {{ board.object_count }} объектов</span>
            <span v-if="board.is_public" class="stat">🔗 Общая</span>
            <span v-else class="stat">🔒 Приватная</span>
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
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const boards = ref([])
const loading = ref(true)
const error = ref('')
const activeMenu = ref(null)

const API_URL = import.meta.env.VITE_API_URL || 'https://interactive.marketingfohow.ru/api'

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
    router.push(`/board/${data.board.id}`)
  } catch (err) {
    error.value = err.message
  }
}

function openBoard(id) {
  router.push(`/board/${id}`)
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
const handleDocumentClick = () => {
  activeMenu.value = null
}

function handleBoardsRefresh() {
  loadBoards()
}

onMounted(() => {
  loadBoards()
  
  // Закрываем меню при клике вне его
  document.addEventListener('click', handleDocumentClick)
  window.addEventListener('boards:refresh', handleBoardsRefresh)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleDocumentClick)
  window.removeEventListener('boards:refresh', handleBoardsRefresh)
})
</script>

<style scoped>
.boards-container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 40px 20px;
}

.boards-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 40px;
}

.boards-header h1 {
  font-size: 32px;
  font-weight: 700;
  margin: 0;
}

.btn-create {
  padding: 12px 24px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.btn-create:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
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
  padding: 80px 20px;
}

.empty-icon {
  font-size: 80px;
  margin-bottom: 20px;
}

.empty-state h2 {
  font-size: 24px;
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
  font-size: 18px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s;
}

.btn-create-big:hover {
  transform: translateY(-2px);
}

.boards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 24px;
}

.board-card {
  background: white;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  position: relative;
}

.board-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0,0,0,0.15);
}

.board-thumbnail {
  width: 100%;
  height: 200px;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
}

.board-thumb-image {
  width: min(100%, 200px);
  height: 120px;
  object-fit: cover;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.05);
  display: block;  
}

.board-placeholder {
  font-size: 60px;
  opacity: 0.3;
}

.board-info {
  padding: 20px;
}

.board-info h3 {
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 10px 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.board-meta {
  font-size: 14px;
  color: #666;
  margin: 0 0 10px 0;
}

.board-stats {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.stat {
  font-size: 12px;
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
  font-size: 20px;
  cursor: pointer;
  backdrop-filter: blur(10px);
  transition: background 0.2s;
}

.btn-menu:hover {
  background: white;
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
  transition: background 0.2s;
}

.dropdown-menu button:hover {
  background: #f5f5f5;
}

.dropdown-menu button.danger {
  color: #f44336;
}

.dropdown-menu button.danger:hover {
  background: #ffebee;
}
</style>
