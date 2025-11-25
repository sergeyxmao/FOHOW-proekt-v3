<template>
  <div class="boards-container">
    <!-- Кнопка назад -->
    <button
      class="btn-back"
      @click="goBack"
      title="Вернуться на главную"
    >
      ← Назад
    </button>

    <div class="boards-header">
      <div class="header-left">
        <h1>Мои структуры</h1>
        <div v-if="foldersLimit > 0" class="folders-counter">
          Папки: {{ foldersCount }} / {{ foldersLimit === -1 ? '∞' : foldersLimit }}
        </div>
      </div>
      <div class="header-actions">
        <div v-if="userPlanLoading" class="plan-loading-indicator">
          <span class="spinner"></span>
          <span>Загружаем лимиты тарифа...</span>
        </div>        
        <button
          v-if="canCreateFolder"
          @click="openCreateFolderModal"
          class="btn-create-folder"
        >
          + Создать папку
        </button>
        <FeatureGate feature="max_boards">
          <button class="btn-create" @click="createNewBoard">
            + Создать структуру
          </button>
        </FeatureGate>
      </div>
    </div>

    <UsageLimitBar
      resourceType="boards"
      label="Мои доски"
    />

    <div v-if="loading" class="loading">
      <div class="spinner"></div>
      <p>Загрузка структур...</p>
    </div>

    <div v-else-if="error" class="error-message">
      {{ error }}
      <button class="btn-retry" @click="error = ''; loadBoards()">Повторить</button>
    </div>

    <div v-else-if="boards.length === 0" class="empty-state">
      <div class="empty-icon">🎨</div>
      <h2>У вас пока нет структур</h2>
      <p>Создайте первую структуру, чтобы начать работу</p>
      <FeatureGate feature="max_boards">
        <button class="btn-create-big" @click="createNewBoard">
          + Создать первую структуру
        </button>
      </FeatureGate>
    </div>

    <div v-else class="folders-view">
      <!-- Секция "Все доски" -->
      <div class="folder-section all-boards">
        <div class="folder-header" @click="showAllBoards">
          <span class="folder-icon">📁</span>
          <span class="folder-name">Все доски</span>
          <span class="board-count">({{ allBoardsCount }})</span>
        </div>
      </div>

      <!-- Секция "Без категории" -->
      <div class="folder-section uncategorized">
        <div
          class="folder-header"
          @click="toggleFolderCollapse('uncategorized')"
        >
          <span class="chevron-icon" :class="{ collapsed: isFolderCollapsed('uncategorized') }">▼</span>
          <span class="folder-icon">📂</span>
          <span class="folder-name">Без категории</span>
          <span class="board-count">({{ uncategorizedCount }})</span>
        </div>
        <div
          v-show="!isFolderCollapsed('uncategorized')"
          class="folder-boards"
          @drop="handleDrop($event, null)"
          @dragover.prevent
          @dragenter="handleDragEnter($event, null)"
          @dragleave="handleDragLeave"
        >
          <div
            v-for="board in uncategorizedBoards"
            :key="board.id"
            class="board-card"
            :class="{ 'locked': board.is_locked }"
            draggable="true"
            @dragstart="handleDragStart($event, board)"
            @dragend="handleDragEnd"
            @click="openBoard(board)"
          >
            <div v-if="board.is_locked" class="lock-indicator">
              <span class="lock-icon">🔒</span>
            </div>

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
                {{ formatDate(board.updated_at) }}
              </p>
              <div class="board-stats">
                <span class="stat">{{ board.object_count }} объектов</span>
                <span v-if="board.is_public" class="stat public">Общая</span>
                <span v-else class="stat private">Приватная</span>
              </div>
            </div>

            <div class="board-actions" @click.stop>
              <button class="btn-menu" @click="toggleMenu(board.id)">⋯</button>
              <div v-if="activeMenu === board.id" class="dropdown-menu">
                <button @click="openBoard(board)">Открыть</button>
                <button @click="renameBoard(board)">Переименовать</button>
                <button @click="showBoardFolderMenu($event, board)">Управление папками</button>
                <FeatureGate feature="can_duplicate_boards" displayMode="hide" :showUpgrade="false">
                  <button @click="duplicateBoard(board.id)">Дублировать</button>
                </FeatureGate>
                <FeatureGate feature="can_export_pdf" displayMode="hide" :showUpgrade="false">
                  <button @click="exportBoardToPDF(board.id)">Экспорт PDF</button>
                </FeatureGate>
                <button @click="deleteBoard(board.id)" class="danger">Удалить</button>
              </div>
            </div>
          </div>

          <div v-if="uncategorizedBoards.length === 0" class="empty-folder">
            Перетащите доски сюда
          </div>
        </div>
      </div>

      <!-- Пользовательские папки -->
      <div
        v-for="folder in folders"
        :key="folder.id"
        class="folder-section"
      >
        <div
          class="folder-header"
          @click="toggleFolderCollapse(folder.id)"
        >
          <span class="chevron-icon" :class="{ collapsed: isFolderCollapsed(folder.id) }">▼</span>
          <span class="folder-icon">📁</span>
          <span class="folder-name">{{ folder.name }}</span>
          <span class="board-count">({{ folder.board_count || 0 }})</span>
          <button
            class="btn-folder-menu"
            @click.stop="showFolderContextMenu($event, folder)"
          >
            ⋮
          </button>
        </div>
        <div
          v-show="!isFolderCollapsed(folder.id)"
          class="folder-boards"
          @drop="handleDrop($event, folder.id)"
          @dragover.prevent
          @dragenter="handleDragEnter($event, folder.id)"
          @dragleave="handleDragLeave"
        >
          <div
            v-for="board in getFolderBoards(folder.id)"
            :key="board.id"
            class="board-card"
            :class="{ 'locked': board.is_locked }"
            draggable="true"
            @dragstart="handleDragStart($event, board)"
            @dragend="handleDragEnd"
            @click="openBoard(board)"
          >
            <div v-if="board.is_locked" class="lock-indicator">
              <span class="lock-icon">🔒</span>
            </div>

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
                {{ formatDate(board.updated_at) }}
              </p>
              <div class="board-stats">
                <span class="stat">{{ board.object_count }} объектов</span>
                <span v-if="board.is_public" class="stat public">Общая</span>
                <span v-else class="stat private">Приватная</span>
              </div>
            </div>

            <div class="board-actions" @click.stop>
              <button class="btn-menu" @click="toggleMenu(board.id)">⋯</button>
              <div v-if="activeMenu === board.id" class="dropdown-menu">
                <button @click="openBoard(board)">Открыть</button>
                <button @click="renameBoard(board)">Переименовать</button>
                <button @click="showBoardFolderMenu($event, board)">Управление папками</button>
                <FeatureGate feature="can_duplicate_boards" displayMode="hide" :showUpgrade="false">
                  <button @click="duplicateBoard(board.id)">Дублировать</button>
                </FeatureGate>
                <FeatureGate feature="can_export_pdf" displayMode="hide" :showUpgrade="false">
                  <button @click="exportBoardToPDF(board.id)">Экспорт PDF</button>
                </FeatureGate>
                <button @click="deleteBoard(board.id)" class="danger">Удалить</button>
              </div>
            </div>
          </div>

          <div v-if="getFolderBoards(folder.id).length === 0" class="empty-folder">
            Перетащите доски сюда
          </div>
        </div>
      </div>
    </div>

    <!-- Контекстное меню папки -->
    <Teleport to="body">
      <div
        v-if="folderContextMenu.show"
        class="context-menu"
        :style="{ left: folderContextMenu.x + 'px', top: folderContextMenu.y + 'px' }"
        @click.stop
      >
        <button @click="openRenameFolderModal(selectedFolder)">Переименовать</button>
        <button @click="openDeleteFolderModal(selectedFolder)" class="danger">Удалить</button>
      </div>
    </Teleport>

    <!-- Модальное окно создания папки -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="showCreateFolderModal" class="modal-overlay" @click="showCreateFolderModal = false">
          <div class="modal-content" @click.stop>
            <button class="modal-close" @click="showCreateFolderModal = false">✕</button>
            <h2>Создать папку</h2>
            <input
              v-model="newFolderName"
              type="text"
              placeholder="Название папки"
              class="modal-input"
              @keyup.enter="createFolder"
            >
            <div class="modal-actions">
              <button class="btn-primary" @click="createFolder" :disabled="!newFolderName.trim()">
                Создать
              </button>
              <button class="btn-secondary" @click="showCreateFolderModal = false">
                Отмена
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Модальное окно переименования папки -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="showRenameFolderModal" class="modal-overlay" @click="showRenameFolderModal = false">
          <div class="modal-content" @click.stop>
            <button class="modal-close" @click="showRenameFolderModal = false">✕</button>
            <h2>Переименовать папку</h2>
            <input
              v-model="newFolderName"
              type="text"
              placeholder="Новое название"
              class="modal-input"
              @keyup.enter="renameFolder"
            >
            <div class="modal-actions">
              <button class="btn-primary" @click="renameFolder" :disabled="!newFolderName.trim()">
                Сохранить
              </button>
              <button class="btn-secondary" @click="showRenameFolderModal = false">
                Отмена
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Модальное окно удаления папки -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="showDeleteFolderModal" class="modal-overlay" @click="showDeleteFolderModal = false">
          <div class="modal-content" @click.stop>
            <button class="modal-close" @click="showDeleteFolderModal = false">✕</button>
            <div class="modal-icon warning">⚠️</div>
            <h2>Удалить папку?</h2>
            <p class="modal-message">
              Папка "{{ selectedFolder?.name }}" и все доски в ней будут удалены.
              Это действие нельзя отменить.
            </p>
            <div class="modal-actions">
              <button class="btn-danger" @click="deleteFolderConfirm">
                Удалить
              </button>
              <button class="btn-secondary" @click="showDeleteFolderModal = false">
                Отмена
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Модальное окно управления папками доски -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="showManageBoardFoldersModal" class="modal-overlay" @click="showManageBoardFoldersModal = false">
          <div class="modal-content" @click.stop>
            <button class="modal-close" @click="showManageBoardFoldersModal = false">✕</button>
            <h2>Управление папками</h2>
            <p class="modal-subtitle">Доска: {{ selectedBoard?.name }}</p>
            <div class="folders-list">
              <div
                v-for="folder in folders"
                :key="folder.id"
                class="folder-checkbox-item"
              >
                <label>
                  <input
                    type="checkbox"
                    :checked="isBoardInFolder(selectedBoard, folder.id)"
                    @change="toggleBoardInFolder(folder.id, selectedBoard?.id, isBoardInFolder(selectedBoard, folder.id))"
                  >
                  {{ folder.name }}
                </label>
              </div>
              <div v-if="folders.length === 0" class="no-folders">
                Нет созданных папок
              </div>
            </div>
            <div class="modal-actions">
              <button class="btn-primary" @click="showManageBoardFoldersModal = false">
                Готово
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Модальное окно для заблокированной доски -->
    <Teleport to="body">
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
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { useUserStore } from '@/stores/user'
import { useBoardFoldersStore } from '@/stores/boardFolders'
import { useNotificationsStore } from '@/stores/notifications'  
import FeatureGate from '@/components/FeatureGate.vue'
import UsageLimitBar from '@/components/UsageLimitBar.vue'

const router = useRouter()
const authStore = useAuthStore()
const userStore = useUserStore()
const boardFoldersStore = useBoardFoldersStore()
const notificationsStore = useNotificationsStore()

// Refs из store папок
const {
  folders,
  loading: foldersLoading,
  canCreateFolder,
  foldersLimit,
  foldersCount
} = storeToRefs(boardFoldersStore)
const { loading: userPlanLoading } = storeToRefs(userStore)
const boards = ref([])
const loading = ref(true)
const error = ref('')
const activeMenu = ref(null)
const showLockedModal = ref(false)
const lockedMessage = ref('')

// Локальное состояние для модальных окон папок
const showCreateFolderModal = ref(false)
const showRenameFolderModal = ref(false)
const showDeleteFolderModal = ref(false)
const showManageBoardFoldersModal = ref(false)
const selectedFolder = ref(null)
const selectedBoard = ref(null)
const newFolderName = ref('')
const folderContextMenu = ref({ show: false, x: 0, y: 0 })
const boardContextMenu = ref({ show: false, x: 0, y: 0 })

const API_URL = import.meta.env.VITE_API_URL || 'https://interactive.marketingfohow.ru/api'

// Функция возврата на главную страницу
const goBack = () => {
  router.push('/')
}

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
  router.push(`/board/${boardData.id}`)
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
  router.push('/pricing')
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

async function exportBoardToPDF(id) {
  try {
    // Открываем доску в новом окне для печати/экспорта в PDF
    const board = boards.value.find(b => b.id === id)
    if (!board) return

    // Сохраняем текущий URL
    const currentUrl = window.location.href

    // Открываем доску
    router.push(`/board/${id}`)

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
const handleDocumentClick = (event) => {
  activeMenu.value = null
  folderContextMenu.value.show = false
  boardContextMenu.value.show = false
}

function handleBoardsRefresh() {
  loadBoards()
}

// === Функционал для папок ===

// Получить доски в папке
const getFolderBoards = (folderId) => {
  return boards.value.filter(board =>
    board.folders && board.folders.some(f => f.id === folderId)
  )
}

// Получить доски без категории
const uncategorizedBoards = computed(() => {
  return boards.value.filter(board =>
    !board.folders || board.folders.length === 0
  )
})

const uncategorizedCount = computed(() => uncategorizedBoards.value.length)
const allBoardsCount = computed(() => boards.value.length)

// Показать все доски
const showAllBoards = () => {
  boardFoldersStore.setCurrentFolder(null)
}

// Переключить свёрнутость папки
const toggleFolderCollapse = (folderId) => {
  boardFoldersStore.toggleFolderCollapse(folderId)
}

// Проверить свёрнута ли папка
const isFolderCollapsed = (folderId) => {
  return boardFoldersStore.isFolderCollapsed(folderId)
}

// Drag and Drop
let draggedBoard = null
let dragTarget = null

const handleDragStart = (event, board) => {
  draggedBoard = board
  event.dataTransfer.effectAllowed = 'move'
  event.target.closest('.board-card').style.opacity = '0.5'
}

const handleDragEnd = (event) => {
  event.target.closest('.board-card').style.opacity = '1'
}

const handleDragEnter = (event, folderId) => {
  dragTarget = folderId
  event.currentTarget.classList.add('drag-over')
}

const handleDragLeave = (event) => {
  event.currentTarget.classList.remove('drag-over')
}

const handleDrop = async (event, folderId) => {
  event.currentTarget.classList.remove('drag-over')

  if (!draggedBoard) return

  try {
    if (folderId === null) {
      // Перетащили в "Без категории" - убрать из всех папок
      for (const folder of draggedBoard.folders || []) {
        await boardFoldersStore.removeBoardFromFolder(folder.id, draggedBoard.id)
      }
    } else {
      // Добавить в папку
      await boardFoldersStore.addBoardToFolder(folderId, draggedBoard.id)
    }

    // Обновить списки
    await loadBoards()
    await boardFoldersStore.fetchFolders()

  } catch (err) {
    console.error('Ошибка при перемещении доски:', err)
    error.value = 'Ошибка при перемещении доски'
  } finally {
    draggedBoard = null
    dragTarget = null
  }
}

// Контекстное меню папки
const showFolderContextMenu = (event, folder) => {
  event.stopPropagation()
  selectedFolder.value = folder
  folderContextMenu.value = {
    show: true,
    x: event.clientX,
    y: event.clientY
  }
}

// Контекстное меню доски (для управления папками)
const showBoardFolderMenu = (event, board) => {
  event.stopPropagation()
  selectedBoard.value = board
  showManageBoardFoldersModal.value = true
}

// Создание папки
const openCreateFolderModal = () => {
  newFolderName.value = ''
  showCreateFolderModal.value = true
}

const createFolder = async () => {
  if (!newFolderName.value.trim()) return

  try {
    await boardFoldersStore.createFolder(newFolderName.value.trim())
    showCreateFolderModal.value = false
    newFolderName.value = ''
  } catch (err) {
    error.value = err.message
  }
}

// Переименование папки
const openRenameFolderModal = (folder) => {
  selectedFolder.value = folder
  newFolderName.value = folder.name
  showRenameFolderModal.value = true
  folderContextMenu.value.show = false
}

const renameFolder = async () => {
  if (!newFolderName.value.trim() || !selectedFolder.value) return

  try {
    await boardFoldersStore.renameFolder(selectedFolder.value.id, newFolderName.value.trim())
    showRenameFolderModal.value = false
    selectedFolder.value = null
    newFolderName.value = ''
  } catch (err) {
    error.value = err.message
  }
}

// Удаление папки
const openDeleteFolderModal = (folder) => {
  selectedFolder.value = folder
  showDeleteFolderModal.value = true
  folderContextMenu.value.show = false
}

const deleteFolderConfirm = async () => {
  if (!selectedFolder.value) return

  try {
    const folderName = selectedFolder.value.name
    const deletedBoardsCount = await boardFoldersStore.deleteFolder(selectedFolder.value.id)
    await loadBoards()
    notificationsStore.addNotification({
      type: 'success',
      message: `Папка "${folderName}" удалена${deletedBoardsCount ? ` вместе с ${deletedBoardsCount} досками` : ''}.`
    })
    showDeleteFolderModal.value = false
    selectedFolder.value = null
  } catch (err) {
    error.value = err.message
  }
}

// Управление папками доски
const toggleBoardInFolder = async (folderId, boardId, isInFolder) => {
  try {
    if (isInFolder) {
      await boardFoldersStore.removeBoardFromFolder(folderId, boardId)
    } else {
      await boardFoldersStore.addBoardToFolder(folderId, boardId)
    }
    await loadBoards()
    await boardFoldersStore.fetchFolders()
  } catch (err) {
    error.value = err.message
  }
}

const isBoardInFolder = (board, folderId) => {
  return board.folders && board.folders.some(f => f.id === folderId)
}

onMounted(async () => {
  loadBoards()
  // Загружаем информацию о тарифе пользователя
  userStore.fetchUserPlan().catch(console.error)

  // Загружаем папки
  await boardFoldersStore.fetchFolders()
  boardFoldersStore.loadCollapsedState()

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

.btn-back {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  margin-bottom: 20px;
  background: white;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-back:hover {
  background: #f8f8f8;
  border-color: #999;
}

.boards-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 40px;
}
.plan-loading-indicator {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border: 1px solid #e0e7ff;
  border-radius: 10px;
  background: #f5f7ff;
  color: #4a5568;
  font-weight: 600;
  margin-right: 12px;
}

.plan-loading-indicator .spinner {
  width: 18px;
  height: 18px;
  border-width: 3px;
  margin: 0;
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
  z-index: 10000;
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

/* Анимация для модального окна */
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

/* === Стили для заголовка с папками === */
.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.folders-counter {
  font-size: 14px;
  color: #666;
  background: #f0f0f0;
  padding: 6px 12px;
  border-radius: 8px;
}

.btn-create-folder {
  padding: 12px 24px;
  background: #f5f5f5;
  color: #333;
  border: 2px dashed #ccc;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-create-folder:hover {
  background: #e8e8e8;
  border-color: #999;
}

.btn-retry {
  margin-left: 12px;
  padding: 8px 16px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
}

/* === Стили для папок === */
.folders-view {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.folder-section {
  background: white;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}

.folder-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  background: #f8f9fa;
  cursor: pointer;
  user-select: none;
  transition: background 0.2s;
}

.folder-header:hover {
  background: #f0f1f3;
}

.chevron-icon {
  font-size: 12px;
  transition: transform 0.2s;
  color: #666;
}

.chevron-icon.collapsed {
  transform: rotate(-90deg);
}

.folder-icon {
  font-size: 20px;
}

.folder-name {
  font-weight: 600;
  font-size: 16px;
  color: #333;
}

.board-count {
  font-size: 14px;
  color: #888;
}

.btn-folder-menu {
  margin-left: auto;
  background: transparent;
  border: none;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  font-size: 18px;
  cursor: pointer;
  color: #666;
  transition: all 0.2s;
}

.btn-folder-menu:hover {
  background: #e0e0e0;
  color: #333;
}

.folder-boards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
  padding: 20px;
  min-height: 100px;
  transition: background 0.2s;
}

.folder-boards.drag-over {
  background: #e3f2fd;
  border: 2px dashed #2196f3;
  border-radius: 12px;
  margin: 8px;
  padding: 12px;
}

.empty-folder {
  grid-column: 1 / -1;
  text-align: center;
  padding: 40px;
  color: #999;
  font-size: 14px;
  border: 2px dashed #e0e0e0;
  border-radius: 12px;
}

/* === Стили для контекстного меню папки === */
.context-menu {
  position: fixed;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.15);
  overflow: hidden;
  z-index: 10001;
  min-width: 150px;
}

.context-menu button {
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

.context-menu button:hover {
  background: #f5f5f5;
}

.context-menu button.danger {
  color: #f44336;
}

.context-menu button.danger:hover {
  background: #ffebee;
}

/* === Стили для модальных окон === */
.modal-overlay {
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
  z-index: 10000;
}

.modal-content {
  background: white;
  border-radius: 20px;
  padding: 32px;
  max-width: 400px;
  width: 90%;
  position: relative;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.modal-close {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: #f5f5f5;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.2s;
}

.modal-close:hover {
  background: #e0e0e0;
}

.modal-content h2 {
  font-size: 20px;
  font-weight: 700;
  margin: 0 0 20px 0;
  color: #333;
}

.modal-input {
  width: 100%;
  padding: 14px 16px;
  font-size: 16px;
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  margin-bottom: 20px;
  outline: none;
  transition: border-color 0.2s;
  box-sizing: border-box;
}

.modal-input:focus {
  border-color: #667eea;
}

.modal-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.btn-primary {
  padding: 12px 24px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  padding: 12px 24px;
  background: #f5f5f5;
  color: #666;
  border: none;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-secondary:hover {
  background: #e0e0e0;
}

.btn-danger {
  padding: 12px 24px;
  background: #f44336;
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-danger:hover {
  background: #d32f2f;
  transform: translateY(-2px);
}

.modal-icon {
  font-size: 48px;
  text-align: center;
  margin-bottom: 16px;
}

.modal-icon.warning {
  color: #ff9800;
}

.modal-message {
  font-size: 15px;
  line-height: 1.6;
  color: #666;
  margin: 0 0 24px 0;
  text-align: center;
}

.modal-subtitle {
  font-size: 14px;
  color: #888;
  margin: -12px 0 20px 0;
}

/* === Управление папками доски === */
.folders-list {
  max-height: 300px;
  overflow-y: auto;
  margin-bottom: 20px;
}

.folder-checkbox-item {
  padding: 12px 0;
  border-bottom: 1px solid #f0f0f0;
}

.folder-checkbox-item:last-child {
  border-bottom: none;
}

.folder-checkbox-item label {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  font-size: 15px;
}

.folder-checkbox-item input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.no-folders {
  text-align: center;
  padding: 20px;
  color: #999;
  font-size: 14px;
}

/* === Стили для статусов досок === */
.stat.public {
  background: #e3f2fd;
  color: #1976d2;
}

.stat.private {
  background: #fce4ec;
  color: #c2185b;
}

/* === Адаптация анимаций для новых модалок === */
.modal-fade-enter-active .modal-content,
.modal-fade-leave-active .modal-content {
  animation: scaleIn 0.3s ease;
}

.modal-fade-leave-active .modal-content {
  animation: scaleIn 0.3s ease reverse;
}
</style>
