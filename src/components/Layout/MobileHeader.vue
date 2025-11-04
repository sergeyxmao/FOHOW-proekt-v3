<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useHistoryStore } from '@/stores/history'
import { useCanvasStore } from '@/stores/canvas'
import { useBoardStore } from '@/stores/board'
import { useMobileStore } from '@/stores/mobile' 
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
  'load-json'
])

const authStore = useAuthStore()
const historyStore = useHistoryStore()
const canvasStore = useCanvasStore()
const boardStore = useBoardStore()
const mobileStore = useMobileStore()

const { currentBoardName, isSaving, lastSaved } = storeToRefs(boardStore)
const { isMenuScaled, menuScale } = storeToRefs(mobileStore)
 
const API_URL = import.meta.env.VITE_API_URL || 'https://interactive.marketingfohow.ru/api'
const lastSavedFormatter = new Intl.DateTimeFormat('ru-RU', {
  hour: '2-digit',
  minute: '2-digit'
})
const userInitials = computed(() => {
  if (!authStore.user?.name) return '?'
  const names = authStore.user.name.trim().split(/\s+/)
  if (names.length === 1) {
    return names[0].charAt(0).toUpperCase()
  }
  return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase()
})

const isHierarchyMode = computed(() => canvasStore.isHierarchicalDragMode)
const showUserMenu = ref(false)
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
  if (!authStore.isAuthenticated) {
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
  () => authStore.isAuthenticated,
  (value) => {
    if (!value) {
      closeUserMenu()
    }
  }
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
          class="mobile-header-button"
          :class="{ 'mobile-header-button--active': isHierarchyMode }"
          type="button"
          @click="toggleHierarchyMode"
          title="Режим иерархии"
        >
          <span class="button-icon">🌳</span>
        </button>

        <!-- Загрузить JSON -->
        <button
          class="mobile-header-button"
          type="button"
          @click="handleLoadJSON"
          title="Загрузить JSON"
        >
          <span class="button-icon">📂</span>
        </button>

        <!-- Экспортировать HTML -->
        <button
          class="mobile-header-button"
          type="button"
          @click="handleExportHTML"
          title="Экспортировать HTML"
        >
          <span class="button-icon">📄</span>
        </button>
      </div>

      <div class="mobile-header-section mobile-header-section--right">
        <!-- Аватар -->
        <button
          v-if="authStore.isAuthenticated"
          class="mobile-header-avatar"
          ref="userMenuTriggerRef"         
          type="button"
          @click="handleAvatarClick"
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
              <div class="mobile-user-menu__item mobile-user-menu__item--static">
                🔐 Номер личного кабинета: RUY68241101111
              </div>
              <button class="mobile-user-menu__item" type="button" @click="handleMenuProfile">
                👤 Профиль
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
  padding: 0 8px;
  z-index: 1000;
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
</style>
