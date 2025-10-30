<script setup>
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useProjectStore } from '../../stores/project.js'
import { useAuthStore } from '../../stores/auth.js'
import { useBoardStore } from '../../stores/board.js'
import AuthModal from '../AuthModal.vue'
import UserProfile from '../UserProfile.vue'
import BoardsModal from '../Board/BoardsModal.vue'

const props = defineProps({
  isModernTheme: {
    type: Boolean,
    default: false
  }
})

const projectStore = useProjectStore()
const authStore = useAuthStore()
const boardStore = useBoardStore()
const { projectName } = storeToRefs(projectStore)
const { isAuthenticated, user } = storeToRefs(authStore)
const { currentBoardName, isSaving, lastSaved } = storeToRefs(boardStore)
const projectPlaceholder = 'Введите название проекта'

const showAuthModal = ref(false)
const authModalView = ref('login')
const showProfile = ref(false)
const showBoards = ref(false) // For boards modal

const API_URL = import.meta.env.VITE_API_URL || 'https://interactive.marketingfohow.ru/api'

const emit = defineEmits(['open-board'])

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

function openLogin() {
  authModalView.value = 'login'
  showAuthModal.value = true
}

function openRegister() {
  authModalView.value = 'register'
  showAuthModal.value = true
}

function openBoards() {
  showBoards.value = true
}

function handleOpenBoard(boardId) {
  showBoards.value = false
  emit('open-board', boardId)
}

function handleLogout() {
  if (confirm('Вы уверены, что хотите выйти?')) {
    authStore.logout()
  }
}
</script>

<template>
  <div
    :class="[
      'app-header',
      { 'app-header--modern': props.isModernTheme }
    ]"
  >
    <div class="app-header__board-info">
      <div class="board-name">
        <span class="board-icon">📋</span>
        <span class="board-title">{{ currentBoardName }}</span>
      </div>
      <div v-if="isSaving" class="board-status board-status--saving">
        <span class="status-spinner">⏳</span>
        <span>Сохранение...</span>
      </div>
      <div v-else-if="lastSaved" class="board-status board-status--saved">
        <span class="status-icon">✓</span>
        <span>Сохранено</span>
      </div>
    </div>

    <!-- Блок авторизации -->
    <div class="app-header__auth">
      <template v-if="isAuthenticated">
        <div class="app-header__user">
          <img
            v-if="user?.avatar_url"
            :src="getAvatarUrl(user.avatar_url)"
            alt="Аватар"
            class="user-avatar"
          >
          <span v-else class="user-avatar-placeholder">
            {{ getInitials(user?.username || user?.email) }}
          </span>
          <span class="user-name">{{ user?.username || user?.email }}</span>
        </div>
        <button class="app-header__btn app-header__btn--boards" @click="openBoards">
          📋 Мои доски
        </button>
        <button class="app-header__btn app-header__btn--profile" @click="showProfile = true">
          Профиль
        </button>
        <button class="app-header__btn app-header__btn--logout" @click="handleLogout">
          Выйти
        </button>
      </template>
      <template v-else>
        <button class="app-header__btn app-header__btn--login" @click="openLogin">
          Войти
        </button>
        <button class="app-header__btn app-header__btn--register" @click="openRegister">
          Регистрация
        </button>
      </template>
    </div>

    <!-- Модальное окно авторизации -->
    <AuthModal
      :is-open="showAuthModal"
      :initial-view="authModalView"
      :is-modern-theme="props.isModernTheme"
      @close="showAuthModal = false"
      @success="showAuthModal = false"
    />

    <!-- Модальное окно профиля -->
    <Teleport to="body">
      <div
        v-if="showProfile"
        :class="[
          'profile-modal-overlay',
          { 'profile-modal-overlay--modern': props.isModernTheme }
        ]"
        @click.self="showProfile = false"
      >
        <UserProfile
          :is-modern-theme="props.isModernTheme"
          @close="showProfile = false"
        />
      </div>
    </Teleport>
    
    <!-- Boards Modal -->
    <BoardsModal 
      :is-open="showBoards" 
      @close="showBoards = false"
      @open-board="handleOpenBoard"
    />
  </div>
</template>

<style scoped>
.app-header {
  --header-surface: rgba(255, 255, 255, 0.92);
  --header-shadow: 0 12px 28px rgba(15, 23, 42, 0.14);
  --header-text: #111827;
  --header-label-bg: rgba(15, 23, 42, 0.06);
  --header-input-bg: rgba(255, 255, 255, 0.98);
  --header-input-border: rgba(15, 23, 42, 0.15);
  --header-input-color: #111827;
  --header-input-placeholder: rgba(17, 24, 39, 0.55);
  --header-focus-border: #0f62fe;
  --header-focus-shadow: rgba(15, 98, 254, 0.15);
  position: fixed;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 12px 24px;
  background: var(--header-surface);
  border-radius: 20px;
  box-shadow: var(--header-shadow);
  backdrop-filter: blur(6px);
  z-index: 1900;
  font-size: 16px;
  line-height: 1.3;
  color: var(--header-text);
}

.app-header--modern {
  --header-surface: rgba(28, 38, 58, 0.9);
  --header-shadow: 0 18px 34px rgba(6, 11, 21, 0.45);
  --header-text: #e5f3ff;
  --header-label-bg: rgba(44, 58, 82, 0.72);
  --header-input-bg: rgba(17, 24, 39, 0.92);
  --header-input-border: rgba(96, 164, 255, 0.35);
  --header-input-color: #e5f3ff;
  --header-input-placeholder: rgba(229, 243, 255, 0.5);
  --header-focus-border: rgba(89, 208, 255, 0.85);
  --header-focus-shadow: rgba(17, 203, 255, 0.2);
}

.app-header__board-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 20px;
  border-radius: 16px;
  background: var(--header-label-bg);
  min-width: 200px;
}

.board-name {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  font-size: 16px;
  color: var(--header-text);
}

.board-icon {
  font-size: 18px;
}

.board-title {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 250px;
}

.board-status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 500;
  opacity: 0.8;
}

.board-status--saving {
  color: #ff9800;
}

.board-status--saved {
  color: #4caf50;
}

.status-spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.status-icon {
  font-weight: 700;
}

/* Блок авторизации */
.app-header__auth {
  display: flex;
  align-items: center;
  gap: 12px;
}

.app-header__btn {
  padding: 8px 20px;
  border-radius: 12px;
  border: none;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.app-header__btn--login {
  background: #4CAF50;
  color: white;
}

.app-header__btn--login:hover {
  background: #45a049;
  transform: translateY(-1px);
}

.app-header__btn--register {
  background: #2196F3;
  color: white;
}

.app-header__btn--register:hover {
  background: #0b7dda;
  transform: translateY(-1px);
}

.app-header__btn--boards,
.app-header__btn--profile {
  background: #2196F3;
  color: white;
}

.app-header__btn--boards:hover,
.app-header__btn--profile:hover {
  background: #1976D2;
  transform: translateY(-1px);
}

.app-header__btn--logout {
  background: #f44336;
  color: white;
}

.app-header__btn--logout:hover {
  background: #da190b;
  transform: translateY(-1px);
}

.profile-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  z-index: 10000;
}
.profile-modal-overlay--modern {
  background: rgba(5, 12, 24, 0.8);
}

@media (max-width: 900px) {
  .app-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .app-header__board-info {
    width: 100%;
  }

  .app-header__auth {
    width: 100%;
    justify-content: center;
  }
}

.app-header__user {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 12px 6px 6px;
  background: var(--header-label-bg);
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
}

.user-avatar,
.user-avatar-placeholder {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid var(--header-input-border);
  flex-shrink: 0;
}

.user-avatar-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  font-size: 14px;
  font-weight: 700;
}

.user-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 150px;
}
</style>```
