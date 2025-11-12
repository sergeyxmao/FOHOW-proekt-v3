<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../../stores/auth.js'
import { useBoardStore } from '../../stores/board.js'
import AuthModal from '../AuthModal.vue'
import UserProfile from '../UserProfile.vue'
import BoardsModal from '../Board/BoardsModal.vue'
import LanguageSwitcher from '../LanguageSwitcher.vue'

const { t } = useI18n()

const props = defineProps({
  isModernTheme: {
    type: Boolean,
    default: false
  },
  zoomDisplay: {
    type: String,
    default: ''    
  }
})

const authStore = useAuthStore()
const boardStore = useBoardStore()
const { isAuthenticated, user, isLoadingProfile } = storeToRefs(authStore)
const { currentBoardName, isSaving, lastSaved } = storeToRefs(boardStore)
  
const lastSavedFormatter = new Intl.DateTimeFormat('ru-RU', {
  hour: '2-digit',
  minute: '2-digit'
})
  
const showAuthModal = ref(false)
const authModalView = ref('login')
const showProfile = ref(false)
const showBoards = ref(false)
const showUserMenu = ref(false)
const userMenuRef = ref(null)
const userTriggerRef = ref(null)
const API_URL = import.meta.env.VITE_API_URL || 'https://interactive.marketingfohow.ru/api'
import HeaderActions from './HeaderActions.vue'  

const emit = defineEmits(['open-board', 'save-board', 'toggle-theme', 'fit-to-content'])

const themeTitle = computed(() =>
  props.isModernTheme ? 'Вернуть светлое меню' : 'Включить тёмное меню'
)
const formattedLastSaved = computed(() => {
  if (!lastSaved.value) return ''

  const date = lastSaved.value instanceof Date
    ? lastSaved.value
    : new Date(lastSaved.value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return lastSavedFormatter.format(date)
})

function getAvatarUrl(url) {
  if (!url) return ''  
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
  closeUserMenu()
}

function handleOpenBoard(boardId) {
  showBoards.value = false
  emit('open-board', boardId)
}

function handleLogout() {
  closeUserMenu()
  if (confirm(t('auth.confirmLogout'))) {
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

function handleZoomClick() {
  emit('fit-to-content')
}

function handleProfileClick() {
  showProfile.value = true
  closeUserMenu()
}
async function handleRenameCurrentBoard() {
  const newName = prompt('Введите новое название структуры', currentBoardName.value)

  if (newName === null) {
    return
  }

  try {
    const result = await boardStore.updateCurrentBoardName(newName)

    if (!result.success) {
      if (result.reason === 'empty') {
        alert('Название структуры не может быть пустым.')
      }

      return
    }
  } catch (error) {
    console.error('Ошибка переименования структуры:', error)
    alert('Не удалось переименовать структуру. Попробуйте позже.')
  }
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
      <div class="app-header__user-block">
        <LanguageSwitcher />
        <div class="app-header__auth">
          <template v-if="isAuthenticated && !isLoadingProfile">
            <div class="app-header__user-column">
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
            </div>

            <transition name="fade">
              <div
                v-if="showUserMenu"
                ref="userMenuRef"
                class="user-menu"
              >
              <div class="user-menu__section user-menu__section--account">
                <div class="user-menu__account-number">
                  RUY68241101111
                </div>
              </div>
              <div class="user-menu__divider" />

              <div class="user-menu__section user-menu__section--project">
                <button
                  class="user-menu__project-name-button"
                  type="button"
                  :title="t('board.renameStructure')"
                  @click="handleRenameCurrentBoard"
                >
                  <span class="user-menu__project-name">{{ currentBoardName }}</span>
                  <span class="user-menu__project-name-edit" aria-hidden="true">✏️</span>
                </button>
                <div class="user-menu__status">
                  <template v-if="isSaving">
                    <span class="status-spinner">⏳</span>
                    <span>{{ t('board.saving') }}</span>
                  </template>
                  <template v-else-if="formattedLastSaved">
                    <span class="status-icon">✓</span>
                    <span>{{ t('board.savedAt') }} {{ formattedLastSaved }}</span>
                  </template>
                  <template v-else>
                    <span>{{ t('board.noSaves') }}</span>
                  </template>
                </div>
              </div>

              <div class="user-menu__section">
                <button class="user-menu__item" type="button" @click="openBoards">
                  📁 {{ t('board.myStructures') }}
                </button>
                <div class="user-menu__item user-menu__item--static">
                  🤝 {{ t('board.sharedStructures') }}
                </div>
              </div>
              <div class="user-menu__divider" />
              <div class="user-menu__section">
                <button class="user-menu__item" type="button" @click="handleProfileClick">
                  👤 {{ t('profile.title') }}
                </button>
                <button class="user-menu__item user-menu__item--danger" type="button" @click="handleLogout">
                  🚪 {{ t('auth.logout') }}
                </button>
              </div>
            </div>
          </transition>
        </template>
        <template v-else>
          <button class="app-header__btn app-header__btn--login" @click="openLogin">
            {{ t('auth.login') }}
          </button>
          <button class="app-header__btn app-header__btn--register" @click="openRegister">
            {{ t('auth.register') }}
          </button>
        </template>
      </div>
      </div>
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
    <HeaderActions
      v-if="isAuthenticated"
      class="app-header__side-actions"
      variant="menu"
      hide-theme-toggle
      :is-modern-theme="props.isModernTheme"
      @toggle-theme="emit('toggle-theme')"
    />

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
  top: 16px;
  left: 0;
  right: 0;
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
  pointer-events: none;
  display: contents;
}

.app-header__user-block {
  position: fixed;
  top: 16px;
  right: 24px;
  display: flex;
  align-items: center;
  min-width: 0;
  justify-content: flex-end;
  pointer-events: auto;
}
.app-header__auth {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
}
.app-header__user-column {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.app-header__side-actions {
  position: fixed;
  right: 24px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;  
  align-items: center;
  gap: 12px;
  padding: 6px;
  pointer-events: auto;
  z-index: 1850;
}

.app-header__side-actions :deep(.header-actions) {
  flex-direction: column;
  align-items: center;
  gap: 14px;
  background: transparent;
  box-shadow: none;
  padding: 0;
  --header-button-bg: rgba(248, 250, 252, 0.92);
  --header-button-border: rgba(148, 163, 184, 0.45);
  --header-button-color: #0f172a;
  --header-button-shadow: rgba(15, 23, 42, 0.18);
  --header-button-hover-shadow: rgba(15, 98, 254, 0.32);
}

.app-header__side-actions :deep(.header-actions__grid) {
  --header-grid-size: 58px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.app-header__side-actions :deep(.header-actions__grid-button) {
  box-shadow: 0 16px 30px var(--header-button-shadow);
}

.app-header--modern .app-header__side-actions :deep(.header-actions) {
  --header-button-bg: rgba(32, 44, 68, 0.92);
  --header-button-border: rgba(104, 171, 255, 0.45);
  --header-button-color: #e5f3ff;
  --header-button-shadow: rgba(6, 11, 21, 0.55);
  --header-button-hover-shadow: rgba(12, 84, 196, 0.45);
}

.app-header__side-actions :deep(.header-actions__grid-item) {
  width: 100%;
  display: flex;
  justify-content: center;
}  
.user-avatar,
.user-avatar-placeholder {
  width: 96px;
  height: 96px;
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
  font-size: 28px;
  font-weight: 700;
}

.app-header__user-trigger {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0;
  background: transparent;
  border-radius: 18px;
  border: none;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  color: inherit;
  transition: transform 0.2s ease;
}

.app-header__user-trigger:hover {
  transform: scale(1.05);
  box-shadow: none;
}

.user-name {
  display: none;
}

.user-avatar-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
}

.user-menu {
  position: absolute;
  top: 0;
  right: calc(100% + 16px);
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
  transform: none;
}

.user-menu__section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.user-menu__actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.user-menu__section--account {
  text-align: center;
  padding: 4px 0;
}

.user-menu__account-number {
  font-size: 16px;
  font-weight: 700;
  color: inherit;
  letter-spacing: 0.5px;
}

.user-menu__section--project {
  gap: 12px;
}
.user-menu__project-name-button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 12px;
  border: 1px solid transparent;
  background: rgba(15, 23, 42, 0.06);
  color: inherit;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
  max-width: 100%;
}

.app-header--modern .user-menu__project-name-button {
  background: rgba(229, 243, 255, 0.06);
  border-color: rgba(229, 243, 255, 0.12);
}

.user-menu__project-name-button:hover {
  background: rgba(15, 23, 42, 0.1);
  transform: translateY(-1px);
}

.app-header--modern .user-menu__project-name-button:hover {
  background: rgba(229, 243, 255, 0.14);
}

.user-menu__project-name-button:focus-visible {
  outline: 2px solid rgba(59, 130, 246, 0.8);
  outline-offset: 2px;
}

.user-menu__project-name {
  font-weight: 700;
  font-size: 16px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 220px;
}

.user-menu__project-name-edit {
  font-size: 16px;
  flex-shrink: 0;
  opacity: 0.7;  
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
  .app-header__inner {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .app-header__user-block {
    right: 50%;
    transform: translateX(50%);
  }

  .app-header__auth {
    width: 100%;
    justify-content: center;
  }
  .app-header__user-column {
    flex-direction: column;
    gap: 12px;
  }

  .user-menu {
    right: 50%;
    transform: translateX(50%);
  }
}
</style>
