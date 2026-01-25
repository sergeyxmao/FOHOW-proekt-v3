<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useHistoryStore } from '@/stores/history'
import { useCanvasStore } from '@/stores/canvas'
import { useBoardStore } from '@/stores/board'
import { useMobileStore } from '@/stores/mobile'
import { useProjectActions } from '@/composables/useProjectActions'
import { storeToRefs } from 'pinia'

const props = defineProps({
  isModernTheme: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits([
  'toggle-theme',
  'open-profile',
  'request-auth',
  'open-boards',
  'export-html',
  'activate-pencil'
])

const router = useRouter()
const authStore = useAuthStore()
const historyStore = useHistoryStore()
const canvasStore = useCanvasStore()
const boardStore = useBoardStore()
const mobileStore = useMobileStore()

const { isAuthenticated, user, isLoadingProfile } = storeToRefs(authStore)
const { currentBoardName, isSaving, lastSaved } = storeToRefs(boardStore)
const { isMenuScaled, menuScale, isMobileMode, isSelectionMode } = storeToRefs(mobileStore)

const { handleSaveAsHTML, handleShareProject } = useProjectActions()

const API_URL = import.meta.env.VITE_API_URL || 'https://interactive.marketingfohow.ru/api'
const lastSavedFormatter = new Intl.DateTimeFormat('ru-RU', {
  hour: '2-digit',
  minute: '2-digit'
})
const userInitials = computed(() => {
  if (!user.value?.name) return '?'
  const names = user.value.name.trim().split(/\s+/)
  if (names.length === 1) {
    return names[0].charAt(0).toUpperCase()
  }
  return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase()
})

const isHierarchyMode = computed(() => canvasStore.isHierarchicalDragMode)
const showUserMenu = ref(false)
const showShareMenu = ref(false)
const userMenuRef = ref(null)
const userMenuTriggerRef = ref(null)
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

const handleUndo = () => {
  historyStore.undo()
}

const handleRedo = () => {
  historyStore.redo()
}

const closeUserMenu = () => {
  showUserMenu.value = false
}

const toggleUserMenu = () => {
  showUserMenu.value = !showUserMenu.value
}

const handleAvatarClick = () => {
  if (!isAuthenticated.value) {
    emit('request-auth')
    return
  }
  toggleUserMenu()
}

const handleAuthButtonClick = () => {
  emit('request-auth')
}
const handleMenuProjects = () => {
  closeUserMenu()
  emit('open-boards')
}

const handleMenuProfile = () => {
  closeUserMenu()
  emit('open-profile')
}

const handleMenuAdmin = () => {
  closeUserMenu()
  router.push('/admin')
}

const handleMenuLogout = () => {
  closeUserMenu()
  if (confirm('Вы уверены, что хотите выйти?')) {
    authStore.logout()
  }
}
const handleRenameCurrentBoard = async () => {
  const newName = prompt('Введите новое название проекта', currentBoardName.value)

  if (newName === null) {
    return
  }

  try {
    const result = await boardStore.updateCurrentBoardName(newName)

    if (!result.success) {
      if (result.reason === 'empty') {
        alert('Название проекта не может быть пустым.')
      }

      return
    }
  } catch (error) {
    console.error('Ошибка переименования проекта:', error)
    alert('Не удалось переименовать проект. Попробуйте позже.')
  }
}

const toggleHierarchyMode = () => {
  canvasStore.toggleHierarchicalDragMode()
}

const toggleSelectionMode = () => {
  mobileStore.toggleSelectionMode()
}

const handleActivatePencil = () => {
  emit('activate-pencil')
}

const handleExportHTML = () => {
  showShareMenu.value = true
}

const closeShareMenu = () => {
  showShareMenu.value = false

}

const handleSaveAs = async () => {
  await handleSaveAsHTML()
  closeShareMenu()
}

const handleShare = async () => {
  await handleShareProject()
  closeShareMenu()
}

function getAvatarUrl(url) {
  if (!url) return ''
  return `${API_URL.replace('/api', '')}${url}`
}

const handleEscapeKey = (event) => {
  if (event.key === 'Escape') {
    closeUserMenu()
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleEscapeKey)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleEscapeKey)
})

watch(
  isAuthenticated,
  (value) => {
    if (!value) {
      closeUserMenu()
    }
  }
)

// Автоматически включаем режим иерархии при переходе на мобильную версию
watch(
  isMobileMode,
  (newValue) => {
    // Включаем режим иерархии когда активируется мобильный режим
    // (работает и при начальной загрузке благодаря immediate: true)
    if (newValue === true) {
      canvasStore.setHierarchicalDragMode(true)
    }
  },
  { immediate: true }
) 
</script>

<template>
  <div
    class="mobile-header"
    :class="{ 'mobile-header--dark': isModernTheme, 'mobile-header--scaled': isMenuScaled }"
    :style="{ '--menu-scale': menuScale }"  
   >
   <div class="mobile-header-layout">
      <div class="mobile-header-section mobile-header-section--left">
        <!-- Отмена -->
        <button
          v-if="isAuthenticated"
          class="mobile-header-button"
          type="button"
          :disabled="!historyStore.canUndo"
          @click="handleUndo"
          title="Отменить"
        >
          <span class="button-icon">↶</span>
        </button>

        <!-- Повтор -->
        <button
          v-if="isAuthenticated"
          class="mobile-header-button"
          type="button"
          :disabled="!historyStore.canRedo"
          @click="handleRedo"
          title="Повторить"
        >
          <span class="button-icon">↷</span>
        </button>
      </div>

      <div class="mobile-header-section mobile-header-section--center">
        <!-- Режим иерархии -->
        <button
          v-if="isAuthenticated"
          class="mobile-header-button"
          :class="{ 'mobile-header-button--active': isHierarchyMode }"
          type="button"
          @click="toggleHierarchyMode"
          title="Режим иерархии"
        >
          <span class="button-icon">🌳</span>
        </button>

        <!-- Режим рисования -->
        <button
          v-if="isAuthenticated"
          class="mobile-header-button"
          type="button"
          @click="handleActivatePencil"
          title="Режим рисования"
        >
          <span class="button-icon">✏️</span>
        </button>

        <!-- Поделиться проектом -->
        <button
          v-if="isAuthenticated"
          class="mobile-header-button"
          type="button"
          @click="handleExportHTML"
          title="Поделиться проектом"
        >
          <span class="button-icon">📄</span>
        </button>

        <!-- Режим выделения -->
        <button
          v-if="isAuthenticated"
          class="mobile-header-button"
          :class="{ 'mobile-header-button--active': isSelectionMode }"
          type="button"
          @click="toggleSelectionMode"
          title="Режим выделения"
        >
          <span class="button-icon">⬚</span>
        </button>
      </div>

      <div class="mobile-header-section mobile-header-section--right">
        <!-- Аватар -->
        <button
          v-if="isAuthenticated && !isLoadingProfile"
          class="mobile-header-avatar"
          ref="userMenuTriggerRef"
          type="button"
          @click="handleAvatarClick"
          :title="user?.name || 'Профиль'"
        >
          <div :class="['avatar-container', { 'avatar-container--verified': user?.is_verified }]">
            <img
              v-if="user?.avatar_url"
              :src="getAvatarUrl(user.avatar_url)"
              alt="Аватар"
              class="avatar-image"
            >
            <span v-else class="avatar-initials">{{ userInitials }}</span>
          </div>
        </button>
        <button
          v-else-if="!isLoadingProfile"
          class="mobile-header-button"
          type="button"
          @click="handleAuthButtonClick"
          title="Войти"
        >
          <span class="button-icon">👤</span>
        </button>
      </div>
    </div>

    <Teleport to="body">
      <transition name="fade">
        <div
          v-if="showUserMenu"
          class="mobile-user-menu-overlay"
          :class="{ 'mobile-user-menu-overlay--dark': isModernTheme }"
          @click.self="closeUserMenu"
        >
          <div
            ref="userMenuRef"
            :class="['mobile-user-menu', { 'mobile-user-menu--dark': isModernTheme }]"
          >
            <button class="mobile-user-menu__close" type="button" @click="closeUserMenu">✕</button>

            <div class="mobile-user-menu__section mobile-user-menu__section--account">
              <div class="mobile-user-menu__account-number">
                RUY68241101111
              </div>
            </div>
            <div class="mobile-user-menu__divider" />

            <div class="mobile-user-menu__section mobile-user-menu__section--project">
              <button
                class="mobile-user-menu__project-button"
                type="button"
                title="Переименовать проект"
                @click="handleRenameCurrentBoard"
              >
                <span class="mobile-user-menu__project-name">{{ currentBoardName }}</span>
                <span class="mobile-user-menu__project-edit" aria-hidden="true">✏️</span>
              </button>
             <div class="mobile-user-menu__status">
                <template v-if="isSaving">
                  <span class="status-spinner">⏳</span>
                  <span>Сохранение...</span>
                </template>
                <template v-else-if="formattedLastSaved">
                  <span class="status-icon">✓</span>
                  <span>Сохранено в {{ formattedLastSaved }}</span>
                </template>
                <template v-else>
                  <span>Нет сохранений</span>
                </template>
              </div>
            </div>

            <div class="mobile-user-menu__section">
              <button class="mobile-user-menu__item" type="button" @click="handleMenuProjects">
                📁 Мои проекты
              </button>
              <div class="mobile-user-menu__item mobile-user-menu__item--static">
                🤝 Совместные проекты
              </div>
            </div>

            <div class="mobile-user-menu__divider" />

            <div class="mobile-user-menu__section">
              <button class="mobile-user-menu__item" type="button" @click="handleMenuProfile">
                👤 Профиль
              </button>
              <button
                v-if="user?.role === 'admin'"
                class="mobile-user-menu__item mobile-user-menu__item--admin"
                type="button"
                @click="handleMenuAdmin"
              >
                ⚙️ Админ панель
              </button>
              <button
                class="mobile-user-menu__item mobile-user-menu__item--danger"
                type="button"
                @click="handleMenuLogout"
              >
                🚪 Выйти
              </button>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>

    <!-- Модальное окно для меню "Поделиться" -->
    <Teleport to="body">
      <transition name="fade">
        <div
          v-if="showShareMenu"
          class="mobile-share-menu-overlay"
          :class="{ 'mobile-share-menu-overlay--dark': isModernTheme }"
          @click.self="closeShareMenu"
        >
          <div
            :class="['mobile-share-menu', { 'mobile-share-menu--dark': isModernTheme }]"
          >
            <button class="mobile-share-menu__close" type="button" @click="closeShareMenu">✕</button>

            <div class="mobile-share-menu__title">
              Поделиться проектом
            </div>

            <div class="mobile-share-menu__section">
              <button class="mobile-share-menu__item" type="button" @click="handleSaveAs">
                💾 Сохранить как
              </button>

              <button class="mobile-share-menu__item" type="button" @click="handleShare">
                📤 Поделиться
              </button>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>
  </div>
</template>

<style scoped>
.mobile-header {
  position: fixed;
  top: env(safe-area-inset-top, 0);
  left: 0;
  right: 0;
  height: 56px;
  background: transparent;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  padding: 0 8px;
  padding-left: calc(8px + env(safe-area-inset-left, 0));
  padding-right: calc(8px + env(safe-area-inset-right, 0));
  z-index: 1000;
}

.mobile-header--dark {
  background: transparent;
}

.mobile-header-layout {
  display: flex;
  align-items: center;
  width: 100%;
  gap: 8px;
}

.mobile-header-section {
  display: flex;
  align-items: center;
  gap: 8px;
}

.mobile-header-section--left,
.mobile-header-section--right {
  flex: 0 0 auto;
}

.mobile-header-section--center {
  flex: 1 1 auto;
  justify-content: center;
}

.mobile-header-section--right {
  margin-left: auto;
}

.mobile-header-button {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  width: 44px;
  height: 44px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  color: #111827;
  font-size: 20px;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  flex-shrink: 0;
  transform: scale(var(--menu-scale, 1));
  transform-origin: center; 
}
.mobile-header--scaled .mobile-header-button,
.mobile-header--scaled .mobile-header-avatar {
  transform: scale(var(--menu-scale, 1));
}

.mobile-header--scaled .mobile-header-avatar {
  transform-origin: center;
}

.mobile-header--scaled .mobile-header-section {
  gap: 12px;
}
.mobile-header--dark .mobile-header-button {
  background: rgba(28, 38, 58, 0.95);
  border-color: rgba(255, 255, 255, 0.1);
  color: #e5f3ff;
}

.mobile-header-button:active:not(:disabled) {
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
}

.mobile-header-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.mobile-header-button--active {
  background: linear-gradient(135deg, #0f62fe 0%, #0353e9 100%);
  color: #ffffff;
  border-color: rgba(15, 98, 254, 0.8);
  box-shadow: 0 4px 12px rgba(15, 98, 254, 0.3);
}

.mobile-header--dark .mobile-header-button--active {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
}

.button-icon {
  font-size: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mobile-header-avatar {
  min-width: 44px;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: linear-gradient(135deg, #0f62fe 0%, #0353e9 100%);
  color: #ffffff;
  font-size: 18px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(15, 98, 254, 0.5);
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(15, 98, 254, 0.3);
  transition: all 0.2s ease;
  user-select: none;
  flex-shrink: 0;
  overflow: hidden;
  transform: scale(var(--menu-scale, 1));
  transform-origin: center; 
}

.mobile-header-avatar:active {
  transform: scale(var(--menu-scale, 1));
}

.avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
  display: block; 
}

.avatar-initials {
  font-size: 16px;
  font-weight: 700;
}

.avatar-container {
  position: relative;
  display: inline-block;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  transition: border-color 0.4s ease, box-shadow 0.4s ease, background 0.4s ease;  
}

.avatar-container--verified {
  padding: 6px;
  border-radius: 50%;
  border: 3px solid #FFD700;
  box-shadow: 0 0 12px rgba(255, 215, 0, 0.6);
  background: linear-gradient(135deg, rgba(255, 215, 0, 0.18) 0%, rgba(255, 165, 0, 0.18) 100%);
  animation: goldPulse 3s ease-in-out infinite;
}

@keyframes goldPulse {
  0% {
    box-shadow: 0 0 12px rgba(255, 215, 0, 0.45), 0 0 0 0 rgba(255, 215, 0, 0.35);
    border-color: rgba(255, 215, 0, 0.85);
  }
  50% {
    box-shadow: 0 0 20px rgba(255, 215, 0, 0.7), 0 0 0 8px rgba(255, 215, 0, 0.08);
    border-color: rgba(255, 215, 0, 1);
  }
  100% {
    box-shadow: 0 0 12px rgba(255, 215, 0, 0.45), 0 0 0 0 rgba(255, 215, 0, 0.0);
    border-color: rgba(255, 215, 0, 0.85);
  }
}
.mobile-user-menu-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  z-index: 2500;
  backdrop-filter: blur(6px);
}

.mobile-user-menu-overlay--dark {
  background: rgba(11, 16, 28, 0.6);
}

.mobile-user-menu {
  position: relative;
  width: min(360px, calc(100vw - 32px));
  max-height: calc(100vh - 64px);
  overflow-y: auto;
  background: rgba(255, 255, 255, 0.98);
  color: #0f172a;
  border-radius: 22px;
  padding: 24px;
  box-shadow: 0 24px 48px rgba(15, 23, 42, 0.18);
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.mobile-user-menu--dark {
  background: rgba(28, 38, 58, 0.96);
  color: #e5f3ff;
  box-shadow: 0 24px 48px rgba(5, 10, 18, 0.45);
  border: 1px solid rgba(229, 243, 255, 0.1);
}

.mobile-user-menu__close {
  position: absolute;
  top: 14px;
  right: 14px;
  width: 34px;
  height: 34px;
  border-radius: 12px;
  border: none;
  background: rgba(15, 23, 42, 0.08);
  color: inherit;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.2s ease;
}

.mobile-user-menu--dark .mobile-user-menu__close {
  background: rgba(229, 243, 255, 0.12);
}

.mobile-user-menu__close:hover {
  background: rgba(15, 23, 42, 0.12);
}

.mobile-user-menu--dark .mobile-user-menu__close:hover {
  background: rgba(229, 243, 255, 0.2);
}

.mobile-user-menu__section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.mobile-user-menu__section--account {
  text-align: center;
  padding: 4px 0;
}

.mobile-user-menu__account-number {
  font-size: 17px;
  font-weight: 700;
  color: inherit;
  letter-spacing: 0.5px;
}

.mobile-user-menu__section--project {
  padding-right: 26px;
  gap: 10px;
}
.mobile-user-menu__project-button {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 16px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(15, 23, 42, 0.05);
  color: inherit;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
  max-width: 100%;
}

.mobile-user-menu--dark .mobile-user-menu__project-button {
  background: rgba(229, 243, 255, 0.05);
  border-color: rgba(229, 243, 255, 0.18);
}

.mobile-user-menu__project-button:hover {
  background: rgba(15, 23, 42, 0.08);
  transform: translateY(-1px);
}

.mobile-user-menu--dark .mobile-user-menu__project-button:hover {
  background: rgba(229, 243, 255, 0.12);
}

.mobile-user-menu__project-button:focus-visible {
  outline: 2px solid rgba(59, 130, 246, 0.8);
  outline-offset: 3px;
}

.mobile-user-menu__project-name {
  font-weight: 700;
  font-size: 18px;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 220px;
}

.mobile-user-menu__project-edit {
  font-size: 18px;
  flex-shrink: 0;
  opacity: 0.75; 
}

.mobile-user-menu__status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 500;
  opacity: 0.85;
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

.mobile-user-menu__item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 14px;
  border: none;
  background: rgba(15, 23, 42, 0.04);
  color: inherit;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease, transform 0.2s ease;
}

.mobile-user-menu__item:hover {
  background: rgba(15, 23, 42, 0.08);
  transform: translateY(-1px);
}

.mobile-user-menu--dark .mobile-user-menu__item {
  background: rgba(229, 243, 255, 0.05);
}

.mobile-user-menu--dark .mobile-user-menu__item:hover {
  background: rgba(229, 243, 255, 0.12);
}

.mobile-user-menu__item--static {
  cursor: default;
  background: transparent;
  padding-left: 0;
  padding-right: 0;
}

.mobile-user-menu__item--static:hover {
  background: transparent;
  transform: none;
}

.mobile-user-menu__item--danger {
  background: rgba(244, 67, 54, 0.08);
}

.mobile-user-menu__item--danger:hover {
  background: rgba(244, 67, 54, 0.15);
}

.mobile-user-menu__item--admin {
  background: rgba(33, 150, 243, 0.08);
}

.mobile-user-menu__item--admin:hover {
  background: rgba(33, 150, 243, 0.15);
}

.mobile-user-menu__divider {
  height: 1px;
  background: rgba(15, 23, 42, 0.12);
}

.mobile-user-menu--dark .mobile-user-menu__divider {
  background: rgba(229, 243, 255, 0.18);
}

/* Адаптация для очень маленьких экранов */
@media (max-width: 480px) {
  .mobile-header {
    height: 52px;
    padding: 0 6px;
  }

  .mobile-header-layout,
  .mobile-header-section {
   gap: 6px;
  }

  .mobile-header-button {
    min-width: 40px;
    width: 40px;
    height: 40px;
    font-size: 18px;
  }

  .mobile-header-avatar {
    min-width: 40px;
    width: 40px;
    height: 40px;
  }

  .avatar-initials {
    font-size: 14px;
  }

  .mobile-user-menu {
    width: min(320px, calc(100vw - 24px));
    padding: 20px;
    gap: 16px;
  }

  .mobile-user-menu__item {
    font-size: 14px;
    padding: 10px 12px;
  }
}

/* Стили для модального окна "Поделиться" */
.mobile-share-menu-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  z-index: 2500;
  backdrop-filter: blur(6px);
}

.mobile-share-menu-overlay--dark {
  background: rgba(11, 16, 28, 0.6);
}

.mobile-share-menu {
  position: relative;
  width: min(360px, calc(100vw - 32px));
  max-height: calc(100vh - 64px);
  overflow-y: auto;
  background: rgba(255, 255, 255, 0.98);
  color: #0f172a;
  border-radius: 22px;
  padding: 24px;
  box-shadow: 0 24px 48px rgba(15, 23, 42, 0.18);
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.mobile-share-menu--dark {
  background: rgba(28, 38, 58, 0.96);
  color: #e5f3ff;
  box-shadow: 0 24px 48px rgba(5, 10, 18, 0.45);
  border: 1px solid rgba(229, 243, 255, 0.1);
}

.mobile-share-menu__close {
  position: absolute;
  top: 14px;
  right: 14px;
  width: 34px;
  height: 34px;
  border-radius: 12px;
  border: none;
  background: rgba(15, 23, 42, 0.08);
  color: inherit;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.2s ease;
}

.mobile-share-menu--dark .mobile-share-menu__close {
  background: rgba(229, 243, 255, 0.12);
}

.mobile-share-menu__close:hover {
  background: rgba(15, 23, 42, 0.12);
}

.mobile-share-menu--dark .mobile-share-menu__close:hover {
  background: rgba(229, 243, 255, 0.2);
}

.mobile-share-menu__title {
  font-size: 20px;
  font-weight: 700;
  text-align: center;
  padding-right: 34px;
  color: inherit;
}

.mobile-share-menu__section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.mobile-share-menu__item-wrapper {
  position: relative;
}

.mobile-share-menu__item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 14px;
  border: none;
  background: rgba(15, 23, 42, 0.04);
  color: inherit;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease, transform 0.2s ease;
  width: 100%;
}

.mobile-share-menu__item:hover {
  background: rgba(15, 23, 42, 0.08);
  transform: translateY(-1px);
}

.mobile-share-menu__item--active {
  background: rgba(59, 130, 246, 0.1);
}

.mobile-share-menu--dark .mobile-share-menu__item {
  background: rgba(229, 243, 255, 0.05);
}

.mobile-share-menu--dark .mobile-share-menu__item:hover {
  background: rgba(229, 243, 255, 0.12);
}

.mobile-share-menu__arrow {
  margin-left: auto;
  font-size: 14px;
  transition: transform 0.2s ease;
}

.mobile-share-menu__arrow--rotated {
  transform: rotate(90deg);
}

.mobile-share-menu__submenu {
  margin-top: 8px;
  margin-left: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow: hidden;
}

.mobile-share-menu__submenu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 12px;
  border: none;
  background: rgba(15, 23, 42, 0.03);
  color: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease, transform 0.2s ease;
  width: 100%;
}

.mobile-share-menu__submenu-item:hover {
  background: rgba(59, 130, 246, 0.08);
  transform: translateX(2px);
}

.mobile-share-menu--dark .mobile-share-menu__submenu-item {
  background: rgba(229, 243, 255, 0.04);
}

.mobile-share-menu--dark .mobile-share-menu__submenu-item:hover {
  background: rgba(229, 243, 255, 0.1);
}

.submenu-slide-enter-active,
.submenu-slide-leave-active {
  transition: opacity 0.2s ease, max-height 0.3s ease;
  overflow: hidden;
}

.submenu-slide-enter-from {
  opacity: 0;
  max-height: 0;
}

.submenu-slide-enter-to,
.submenu-slide-leave-from {
  opacity: 1;
  max-height: 200px;
}

.submenu-slide-leave-to {
  opacity: 0;
  max-height: 0;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
