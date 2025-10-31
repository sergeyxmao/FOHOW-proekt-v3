<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
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

const authStore = useAuthStore()
const boardStore = useBoardStore()
const { isAuthenticated, user } = storeToRefs(authStore)
const { currentBoardName, isSaving, lastSaved } = storeToRefs(boardStore)

const showAuthModal = ref(false)
const authModalView = ref('login')
const showProfile = ref(false)
const showBoards = ref(false)
const showUserMenu = ref(false)
const userMenuRef = ref(null)
const userTriggerRef = ref(null)
const API_URL = import.meta.env.VITE_API_URL || 'https://interactive.marketingfohow.ru/api'
import HeaderActions from './HeaderActions.vue'  

const emit = defineEmits(['open-board', 'save-board', 'toggle-theme'])

const themeTitle = computed(() =>
  props.isModernTheme ? 'Вернуть светлое меню' : 'Включить тёмное меню'
)
  return `${API_URL.replace('/api', '')}${url}`
}

function getInitials(name) {
  if (!name) return '?'
  const parts = name.split(' ')
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
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
  closeUserMenu()
}

function handleOpenBoard(boardId) {
  showBoards.value = false
  emit('open-board', boardId)
}

function handleLogout() {
  closeUserMenu()
  if (confirm('Вы уверены, что хотите выйти?')) {
    authStore.logout()
  }
}

function toggleUserMenu() {
  if (!isAuthenticated.value) return
  showUserMenu.value = !showUserMenu.value
}

function closeUserMenu() {
  showUserMenu.value = false
}

function handleSaveClick() {
  emit('save-board')
  closeUserMenu()
}

function handleProfileClick() {
  showProfile.value = true
  closeUserMenu()
}

function handleClickOutside(event) {
  const menuEl = userMenuRef.value
  const triggerEl = userTriggerRef.value
  if (!menuEl || !showUserMenu.value) return
  if (menuEl.contains(event.target)) return
  if (triggerEl && triggerEl.contains(event.target)) return
  closeUserMenu()
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div
    :class="[
      'app-header',
      { 'app-header--modern': props.isModernTheme }
    ]"
  >
    <div class="app-header__inner">
      <div class="app-header__center">
        <div class="app-header__auth">
          <template v-if="isAuthenticated">
            <button
              ref="userTriggerRef"
              type="button"
              class="app-header__user-trigger"
              @click.stop="toggleUserMenu"
            >
              <span class="user-avatar-wrapper">
                <img
                  v-if="user?.avatar_url"
                  :src="getAvatarUrl(user.avatar_url)"
                  alt="Аватар"
                  class="user-avatar"
                >
                <span v-else class="user-avatar-placeholder">
                  {{ getInitials(user?.username || user?.email) }}
                </span>
              </span>
              <span class="user-name">{{ user?.username || user?.email }}</span>
            </button>

            <transition name="fade">
              <div
                v-if="showUserMenu"
                ref="userMenuRef"
                class="user-menu"
              >
              <div class="user-menu__section user-menu__section--project">
                <div class="user-menu__project-row">
                  <span class="user-menu__project-name">{{ currentBoardName }}</span>
                  <button
                    class="user-menu__save"
                    type="button"
                    :disabled="isSaving"
                    @click="handleSaveClick"
                  >
                    💾 Сохранить
                  </button>
                </div>
                <div class="user-menu__status">
                  <template v-if="isSaving">
                    <span class="status-spinner">⏳</span>
                    <span>Сохранение...</span>
                  </template>
                  <template v-else-if="lastSaved">
                    <span class="status-icon">✓</span>
                    <span>Сохранено</span>
                  </template>
                  <template v-else>
                    <span>Нет сохранений</span>
                  </template>
                </div>
              </div>

              <div class="user-menu__section">
                <button class="user-menu__item" type="button" @click="openBoards">
                  📁 Мои проекты
                </button>
                <div class="user-menu__item user-menu__item--static">
                  🤝 Совместные проекты
                </div>
              </div>
              <div class="user-menu__divider" />

              <div class="user-menu__section">
                <div class="user-menu__item user-menu__item--static">
                  🔐 Номер личного кабинета: RUY68241101111
                </div>
                <button class="user-menu__item" type="button" @click="handleProfileClick">
                  👤 Профиль
                </button>
                <button class="user-menu__item user-menu__item--danger" type="button" @click="handleLogout">
                  🚪 Выйти
                </button>
              </div>
            </div>
          </transition>
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
        <HeaderActions
          class="app-header__actions"
          :is-modern-theme="props.isModernTheme"
          :hide-theme-toggle="true"
          @toggle-theme="emit('toggle-theme')"
        />
      </div>
      <button
        class="app-header__theme-toggle"
        type="button"
        :title="themeTitle"
        @click="emit('toggle-theme')"
      >
        <span class="app-header__theme-icon" aria-hidden="true"></span>
      </button>
    </div>

    <AuthModal
      :is-open="showAuthModal"
      :initial-view="authModalView"
      :is-modern-theme="props.isModernTheme"
      @close="showAuthModal = false"
      @success="showAuthModal = false"
    />

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
  --header-input-border: rgba(15, 23, 42, 0.15);
  position: fixed;
  top: 12px;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  padding: 0 24px;
  z-index: 1900;
  font-size: 16px;
  line-height: 1.3;
  color: var(--header-text);
  pointer-events: none; 
}

.app-header--modern {
  --header-surface: rgba(28, 38, 58, 0.9);
  --header-shadow: 0 18px 34px rgba(6, 11, 21, 0.45);
  --header-text: #e5f3ff;
  --header-label-bg: rgba(44, 58, 82, 0.72);
  --header-input-border: rgba(96, 164, 255, 0.35);
}
.app-header__inner {
  pointer-events: auto;
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 18px;
  padding: 12px 18px;
  background: var(--header-surface);
  border-radius: 20px;
  box-shadow: var(--header-shadow);
  backdrop-filter: blur(6px);
  width: min(720px, 100%);
}

.app-header__center {
  justify-self: center;
  display: flex;
  align-items: center;
  gap: 18px;
}
.app-header__auth {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
}
.app-header__actions {
  display: flex;
  align-items: center;
}
.app-header__theme-toggle {
  width: 52px;
  height: 52px;
  border-radius: 20px;
  border: 1px solid rgba(15, 23, 42, 0.12);
  background: linear-gradient(145deg, rgba(59, 130, 246, 0.14), rgba(59, 130, 246, 0));
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 16px 30px rgba(37, 99, 235, 0.26);
  transition: transform 0.2s ease, box-shadow 0.2s ease, border 0.2s ease;
}

.app-header__theme-toggle:hover {
  transform: translateY(-2px);
  box-shadow: 0 24px 38px rgba(37, 99, 235, 0.34);
  border-color: rgba(59, 130, 246, 0.35);
}

.app-header__theme-icon {
  position: relative;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: linear-gradient(135deg, #0f172a 0%, #2563eb 100%);
  box-shadow: inset -4px -4px 10px rgba(255, 255, 255, 0.22), 0 6px 12px rgba(15, 23, 42, 0.18);
}

.app-header__theme-icon::before,
.app-header__theme-icon::after {
  content: '';
  position: absolute;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.85);
  transition: opacity 0.2s ease;
}

.app-header__theme-icon::before {
  inset: 4px;
  opacity: 0.4;
}

.app-header__theme-icon::after {
  inset: 7px;
  opacity: 0.2;
}

.app-header--modern .app-header__theme-toggle {
  border-color: rgba(96, 164, 255, 0.42);
  background: linear-gradient(145deg, rgba(114, 182, 255, 0.28), rgba(114, 182, 255, 0));
  box-shadow: 0 20px 40px rgba(6, 11, 21, 0.58);
}

.app-header--modern .app-header__theme-toggle:hover {
  box-shadow: 0 26px 46px rgba(6, 11, 21, 0.72);
}

.app-header--modern .app-header__theme-icon {
  background: linear-gradient(135deg, #e5f3ff 0%, #73c8ff 100%);
  box-shadow: inset -4px -4px 10px rgba(6, 11, 21, 0.35), 0 6px 12px rgba(6, 11, 21, 0.3);
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

.app-header__user-trigger {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 14px 6px 6px;
  background: var(--header-label-bg);
  border-radius: 18px;
  border: none;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  color: inherit;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.app-header__user-trigger:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(15, 23, 42, 0.15);
}

.user-avatar-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
}

.user-menu {
  position: absolute;
  top: calc(100% + 12px);
  left: 50%;
  min-width: 320px;
  background: var(--header-surface);
  color: var(--header-text);
  border-radius: 18px;
  box-shadow: 0 20px 40px rgba(15, 23, 42, 0.2);
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  z-index: 2500;
  transform: translateX(-50%);  
}

.user-menu__section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.user-menu__section--project {
  gap: 12px;
}

.user-menu__project-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.user-menu__project-name {
  font-weight: 700;
  font-size: 16px;
  flex: 1 1 auto;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-menu__save {
  padding: 6px 14px;
  border-radius: 12px;
  border: none;
  background: #2196f3;
  color: #fff;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease, transform 0.2s ease;
}

.user-menu__save:hover:not(:disabled) {
  background: #1976d2;
  transform: translateY(-1px);
}

.user-menu__save:disabled {
  background: #90caf9;
  cursor: default;
}

.user-menu__status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 500;
  opacity: 0.8;
}

.status-spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.status-icon {
  font-weight: 700;
}

.user-menu__item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 12px;
  border: none;
  background: transparent;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  color: inherit;
  transition: background 0.2s ease, transform 0.2s ease;
}

.user-menu__item:hover {
  background: rgba(15, 23, 42, 0.08);
  transform: translateY(-1px);
}
.app-header--modern .user-menu__item:hover {
  background: rgba(229, 243, 255, 0.08);
}
.user-menu__item--static {
  cursor: default;
}

.user-menu__item--static:hover {
  background: transparent;
  transform: none;
}

.user-menu__item--danger:hover {
  background: rgba(244, 67, 54, 0.12);
}

.user-menu__divider {
  height: 1px;
  background: rgba(15, 23, 42, 0.12);
}
.app-header--modern .user-menu__divider {
  background: rgba(229, 243, 255, 0.18);
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
  background: #4caf50;
  color: white;
}

.app-header__btn--login:hover {
  background: #45a049;
  transform: translateY(-1px);
}

.app-header__btn--register {
  background: #2196f3;
  color: white;
}

.app-header__btn--register:hover {
  background: #0b7dda;
  transform: translateY(-1px);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
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

@media (max-width: 640px) {
  .app-header {
    width: calc(100% - 24px);
    justify-content: center;
  }

  .app-header__auth {
    width: 100%;
    justify-content: center;
  }

  .user-menu {
    right: 50%;
    transform: translateX(50%);
  }
}
</style>
