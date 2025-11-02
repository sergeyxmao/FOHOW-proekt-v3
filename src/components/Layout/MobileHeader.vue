<script setup>
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { useHistoryStore } from '@/stores/history'
import { useCanvasStore } from '@/stores/canvas'
import { useBoardStore } from '@/stores/board'

const props = defineProps({
  isModernTheme: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits([
  'toggle-theme',
  'open-profile',
  'export-html',
  'load-json',
  'open-board',
  'logout'
])

const authStore = useAuthStore()
const historyStore = useHistoryStore()
const canvasStore = useCanvasStore()
const boardStore = useBoardStore()

const { isAuthenticated, user } = storeToRefs(authStore)
const { currentBoardName, isSaving, lastSaved } = storeToRefs(boardStore)

const API_URL = import.meta.env.VITE_API_URL || 'https://interactive.marketingfohow.ru/api'

const showUserMenu = ref(false)
const userMenuRef = ref(null)
const userTriggerRef = ref(null)

const userInitials = computed(() => {
  if (!authStore.user?.name) return '?'
  const names = authStore.user.name.trim().split(/\s+/)
  if (names.length === 1) {
    return names[0].charAt(0).toUpperCase()
  }
  return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase()
})

const isHierarchyMode = computed(() => canvasStore.isHierarchicalDragMode)

const handleUndo = () => {
  historyStore.undo()
}

const handleRedo = () => {
  historyStore.redo()
}

const toggleUserMenu = () => {
  if (!isAuthenticated.value) {
    emit('open-profile')
    return
  }
  showUserMenu.value = !showUserMenu.value
}

const closeUserMenu = () => {
  showUserMenu.value = false
}

const handleProfileClick = () => {
  emit('open-profile')
  closeUserMenu()
}

const handleLogout = () => {
  closeUserMenu()
  emit('logout')
}

const openBoards = () => {
  closeUserMenu()
  // This will be handled by parent
}

const toggleHierarchyMode = () => {
  canvasStore.toggleHierarchicalDragMode()
}

const handleLoadJSON = () => {
  emit('load-json')
}

const handleExportHTML = () => {
  emit('export-html')
}

function getAvatarUrl(url) {
  if (!url) return ''
  return `${API_URL.replace('/api', '')}${url}`
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
  <div class="mobile-header" :class="{ 'mobile-header--dark': isModernTheme }">
    <!-- Левая часть: Отмена/Повтор -->
    <div class="mobile-header-left">
      <button
        class="mobile-header-button"
        type="button"
        :disabled="!historyStore.canUndo"
        @click="handleUndo"
        title="Отменить"
      >
        <span class="button-icon">↶</span>
      </button>
      <button
        class="mobile-header-button"
        type="button"
        :disabled="!historyStore.canRedo"
        @click="handleRedo"
        title="Повторить"
      >
        <span class="button-icon">↷</span>
      </button>
    </div>

    <!-- Центральная часть: Иерархия, Загрузить, Экспорт -->
    <div class="mobile-header-center">
      <button
        class="mobile-header-button hierarchy-button"
        :class="{ 'hierarchy-button--active': isHierarchyMode }"
        type="button"
        @click="toggleHierarchyMode"
        title="Режим иерархии"
      >
        <span class="hierarchy-icon">🔗</span>
      </button>
      <button
        class="mobile-header-button"
        type="button"
        @click="handleLoadJSON"
        title="Загрузить JSON"
      >
        <span class="button-icon">📂</span>
      </button>
      <button
        class="mobile-header-button"
        type="button"
        @click="handleExportHTML"
        title="Экспортировать HTML"
      >
        <span class="button-icon">📄</span>
      </button>
    </div>

    <!-- Правая часть: Аватар -->
    <div class="mobile-header-right">
      <button
        v-if="authStore.isAuthenticated"
        ref="userTriggerRef"
        class="mobile-header-avatar"
        type="button"
        @click.stop="toggleUserMenu"
        :title="authStore.user?.name || 'Профиль'"
      >
        <img
          v-if="authStore.user?.avatar_url"
          :src="getAvatarUrl(authStore.user.avatar_url)"
          alt="Аватар"
          class="avatar-image"
        >
        <span v-else class="avatar-initials">{{ userInitials }}</span>
      </button>
      <button
        v-else
        class="mobile-header-button"
        type="button"
        @click="toggleUserMenu"
        title="Войти"
      >
        <span class="button-icon">👤</span>
      </button>

      <!-- User Menu -->
      <transition name="fade">
        <div
          v-if="showUserMenu"
          ref="userMenuRef"
          class="mobile-user-menu"
          :class="{ 'mobile-user-menu--dark': isModernTheme }"
        >
          <div class="user-menu-section user-menu-section--project">
            <span class="user-menu-project-name">{{ currentBoardName }}</span>
            <div class="user-menu-status">
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

          <div class="user-menu-section">
            <button class="user-menu-item" type="button" @click="openBoards">
              📁 Мои проекты
            </button>
            <div class="user-menu-item user-menu-item--static">
              🤝 Совместные проекты
            </div>
          </div>

          <div class="user-menu-divider" />

          <div class="user-menu-section">
            <div class="user-menu-item user-menu-item--static">
              🔐 Номер личного кабинета: RUY68241101111
            </div>
            <button class="user-menu-item" type="button" @click="handleProfileClick">
              👤 Профиль
            </button>
            <button class="user-menu-item user-menu-item--danger" type="button" @click="handleLogout">
              🚪 Выйти
            </button>
          </div>
        </div>
      </transition>
    </div>
  </div>
</template>

<style scoped>
.mobile-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 56px;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 8px;
  z-index: 1000;
}

.mobile-header-left,
.mobile-header-center,
.mobile-header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.mobile-header-left {
  flex: 0 0 auto;
}

.mobile-header-center {
  flex: 1;
  justify-content: center;
}

.mobile-header-right {
  flex: 0 0 auto;
  position: relative;
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
}

.mobile-header--dark .mobile-header-button {
  background: rgba(28, 38, 58, 0.95);
  border-color: rgba(255, 255, 255, 0.1);
  color: #e5f3ff;
}

.mobile-header-button:active:not(:disabled) {
  transform: scale(0.95);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
}

.mobile-header-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.button-icon,
.hierarchy-icon {
  font-size: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Hierarchy button - same as desktop */
.hierarchy-button--active {
  background: linear-gradient(135deg, #0f62fe 0%, #0353e9 100%);
  color: #ffffff;
  border-color: rgba(15, 98, 254, 0.8);
  box-shadow: 0 4px 12px rgba(15, 98, 254, 0.3);
}

.mobile-header--dark .hierarchy-button--active {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
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
}

.mobile-header-avatar:active {
  transform: scale(0.95);
}

.avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-initials {
  font-size: 16px;
  font-weight: 700;
}

/* User Menu */
.mobile-user-menu {
  position: absolute;
  top: calc(100% + 10px);
  right: 0;
  min-width: 280px;
  max-width: 90vw;
  background: rgba(255, 255, 255, 0.98);
  backdrop-filter: blur(10px);
  color: #111827;
  border-radius: 14px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  z-index: 2000;
  border: 1px solid rgba(0, 0, 0, 0.08);
}

.mobile-user-menu--dark {
  background: rgba(28, 38, 58, 0.98);
  color: #e5f3ff;
  border-color: rgba(255, 255, 255, 0.1);
}

.user-menu-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.user-menu-section--project {
  gap: 10px;
}

.user-menu-project-name {
  font-weight: 700;
  font-size: 15px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-menu-status {
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
  to { transform: rotate(360deg); }
}

.status-icon {
  font-weight: 700;
}

.user-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 10px;
  border: none;
  background: transparent;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  color: inherit;
  text-align: left;
  transition: background 0.2s ease;
}

.user-menu-item:hover {
  background: rgba(15, 98, 254, 0.1);
}

.mobile-user-menu--dark .user-menu-item:hover {
  background: rgba(59, 130, 246, 0.15);
}

.user-menu-item--static {
  cursor: default;
}

.user-menu-item--static:hover {
  background: transparent;
}

.user-menu-item--danger:hover {
  background: rgba(244, 67, 54, 0.12);
}

.user-menu-divider {
  height: 1px;
  background: rgba(0, 0, 0, 0.1);
}

.mobile-user-menu--dark .user-menu-divider {
  background: rgba(255, 255, 255, 0.15);
}

/* Fade transition */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

/* Адаптация для маленьких экранов */
@media (max-width: 480px) {
  .mobile-header {
    height: 52px;
    padding: 0 6px;
  }

  .mobile-header-left,
  .mobile-header-center,
  .mobile-header-right {
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
    min-width: 260px;
  }
}
</style>
