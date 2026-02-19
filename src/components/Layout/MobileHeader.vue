<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useHistoryStore } from '@/stores/history'
import { useCanvasStore } from '@/stores/canvas'
import { useBoardStore } from '@/stores/board'
import { useMobileStore } from '@/stores/mobile'
import { usePerformanceModeStore } from '@/stores/performanceMode'
import { useDesignModeStore } from '@/stores/designMode'
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
  'activate-pencil',
  'open-full-menu'
])

const { t } = useI18n()
const router = useRouter()
const authStore = useAuthStore()
const historyStore = useHistoryStore()
const canvasStore = useCanvasStore()
const boardStore = useBoardStore()
const mobileStore = useMobileStore()
const performanceModeStore = usePerformanceModeStore()
const designModeStore = useDesignModeStore()

const { isAuthenticated, user, isLoadingProfile } = storeToRefs(authStore)
const { currentBoardName, isSaving, lastSaved } = storeToRefs(boardStore)
const { isMenuScaled, menuScale, isMobileMode, isSelectionMode } = storeToRefs(mobileStore)
const { isFull, isLight, isView } = storeToRefs(performanceModeStore)
const { isAuroraDesign } = storeToRefs(designModeStore)

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
  // Если режим иерархии включён, отключаем режим выделения
  if (canvasStore.isHierarchicalDragMode) {
    mobileStore.setSelectionMode(false)
  }
}

const toggleSelectionMode = () => {
  mobileStore.toggleSelectionMode()
  // Если режим выделения включён, отключаем режим иерархии
  if (mobileStore.isSelectionMode) {
    canvasStore.setHierarchicalDragMode(false)
  }
}

const handleActivatePencil = () => {
  emit('activate-pencil')
}

const handleOpenFullMenu = () => {
  emit('open-full-menu')
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
    :class="{ 'mobile-header--dark': isModernTheme, 'mobile-header--scaled': isMenuScaled, 'mobile-header--aurora': isAuroraDesign }"
    :style="{ '--menu-scale': menuScale }"  
   >
   <div class="mobile-header-layout">
      <div class="mobile-header-section mobile-header-section--left">
        <!-- Full-режим: гамбургер-кнопка -->
        <button
          v-if="isAuthenticated && isFull"
          class="mobile-header-button"
          type="button"
          @click="handleOpenFullMenu"
          title="Меню"
        >
          <span class="button-icon">☰</span>
        </button>

        <!-- Light-режим: Отмена / Повтор слева -->
        <button
          v-if="isAuthenticated && isLight"
          class="mobile-header-button"
          type="button"
          :disabled="!historyStore.canUndo"
          @click="handleUndo"
          title="Отменить"
        >
          <span class="button-icon">↶</span>
        </button>
        <button
          v-if="isAuthenticated && isLight"
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
        <!-- Full-режим: Отмена / Повтор + иерархия / выделение по центру -->
        <button
          v-if="isAuthenticated && isFull"
          class="mobile-header-button"
          type="button"
          :disabled="!historyStore.canUndo"
          @click="handleUndo"
          title="Отменить"
        >
          <span class="button-icon">↶</span>
        </button>
        <button
          v-if="isAuthenticated && isFull"
          class="mobile-header-button"
          type="button"
          :disabled="!historyStore.canRedo"
          @click="handleRedo"
          title="Повторить"
        >
          <span class="button-icon">↷</span>
        </button>
        <button
          v-if="isAuthenticated && isFull"
          class="mobile-header-button"
          :class="{ 'mobile-header-button--active': isHierarchyMode }"
          type="button"
          @click="toggleHierarchyMode"
          title="Режим иерархии"
        >
          <span class="button-icon">🌳</span>
        </button>
        <button
          v-if="isAuthenticated && isFull"
          class="mobile-header-button"
          :class="{ 'mobile-header-button--active': isSelectionMode }"
          type="button"
          @click="toggleSelectionMode"
          :title="t('userMenu.selectionMode')"
        >
          <span class="button-icon">⬚</span>
        </button>

        <!-- Light-режим: иерархия, рисование, поделиться, выделение -->
        <button
          v-if="isAuthenticated && isLight"
          class="mobile-header-button"
          :class="{ 'mobile-header-button--active': isHierarchyMode }"
          type="button"
          @click="toggleHierarchyMode"
          title="Режим иерархии"
        >
          <span class="button-icon">🌳</span>
        </button>
        <button
          v-if="isAuthenticated && isLight"
          class="mobile-header-button"
          type="button"
          @click="handleActivatePencil"
          title="Режим рисования"
        >
          <span class="button-icon">✏️</span>
        </button>

        <!-- Поделиться — видна во всех режимах -->
        <button
          v-if="isAuthenticated"
          class="mobile-header-button"
          type="button"
          @click="handleExportHTML"
          :title="t('userMenu.shareProject')"
        >
          <span class="button-icon">📄</span>
        </button>

        <button
          v-if="isAuthenticated && isLight"
          class="mobile-header-button"
          :class="{ 'mobile-header-button--active': isSelectionMode }"
          type="button"
          @click="toggleSelectionMode"
          :title="t('userMenu.selectionMode')"
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
          :title="user?.name || t('profile.title')"
        >
          <div :class="['avatar-container', { 'avatar-container--verified': user?.is_verified }]">
            <img
              v-if="user?.avatar_url"
              :src="getAvatarUrl(user.avatar_url)"
              :alt="t('profile.title')"
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
          :title="t('auth.login')"
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
                {{ user?.personal_id || t('userMenu.notSpecified') }}
              </div>
            </div>
            <div class="mobile-user-menu__divider" />

            <div class="mobile-user-menu__section mobile-user-menu__section--project">
              <button
                class="mobile-user-menu__project-button"
                type="button"
                :title="t('userMenu.renameProject')"
                @click="handleRenameCurrentBoard"
              >
                <span class="mobile-user-menu__project-name">{{ currentBoardName }}</span>
                <span class="mobile-user-menu__project-edit" aria-hidden="true">✏️</span>
              </button>
             <div class="mobile-user-menu__status">
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

            <div class="mobile-user-menu__section">
              <button class="mobile-user-menu__item" type="button" @click="handleMenuProjects">
                📁 {{ t('userMenu.myProjects') }}
              </button>
              <div class="mobile-user-menu__item mobile-user-menu__item--static">
                🤝 {{ t('userMenu.sharedProjects') }}
              </div>
            </div>

            <div class="mobile-user-menu__divider" />

            <div class="mobile-user-menu__section">
              <button class="mobile-user-menu__item" type="button" @click="handleMenuProfile">
                👤 {{ t('profile.title') }}
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
                🚪 {{ t('auth.logout') }}
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
              {{ t('userMenu.shareProject') }}
            </div>

            <div class="mobile-share-menu__section">
              <button class="mobile-share-menu__item" type="button" @click="handleSaveAs">
                💾 {{ t('userMenu.saveAs') }}
              </button>

              <button class="mobile-share-menu__item" type="button" @click="handleShare">
                📤 {{ t('userMenu.share') }}
              </button>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>
  </div>
</template>

<style scoped>
/* ============================================================
   MobileHeader — Material Design 3 Style
   Uses tokens from m3-tokens.css
   ============================================================ */

/* --- Header bar --- */
.mobile-header {
  position: fixed;
  top: env(safe-area-inset-top, 0);
  left: 0;
  right: 0;
  height: 56px;
  background: transparent;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
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

/* --- Header buttons (pill shape, 44x44) --- */
.mobile-header-button {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  width: 44px;
  height: 44px;
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: var(--md-sys-shape-corner-full);
  background: color-mix(in srgb, var(--md-sys-color-surface-container-high) 92%, transparent);
  backdrop-filter: none;
  color: var(--md-sys-color-on-surface);
  font-size: 20px;
  cursor: pointer;
  transition:
    background var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-standard),
    color var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-standard),
    border-color var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-standard),
    box-shadow var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-standard),
    transform var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-standard);
  user-select: none;
  box-shadow: var(--md-sys-elevation-1);
  flex-shrink: 0;
  transform: scale(var(--menu-scale, 1));
  transform-origin: center;
}

/* Scaled mode */
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

/* Dark mode button */
.mobile-header--dark .mobile-header-button {
  background: color-mix(in srgb, var(--md-sys-color-surface-container-high) 92%, transparent);
  border-color: var(--md-sys-color-outline-variant);
  color: var(--md-sys-color-on-surface);
}

/* Hover: state layer */
.mobile-header-button:hover:not(:disabled) {
  background: color-mix(
    in srgb,
    var(--md-sys-color-on-surface) calc(var(--md-sys-state-hover-opacity) * 100%),
    var(--md-sys-color-surface-container-high)
  );
  border-color: var(--md-sys-color-outline);
  box-shadow: var(--md-sys-elevation-2);
}

.mobile-header--dark .mobile-header-button:hover:not(:disabled) {
  background: color-mix(
    in srgb,
    var(--md-sys-color-on-surface) calc(var(--md-sys-state-hover-opacity) * 100%),
    var(--md-sys-color-surface-container-high)
  );
  border-color: var(--md-sys-color-outline);
  box-shadow: var(--md-sys-elevation-2);
}

/* Pressed */
.mobile-header-button:active:not(:disabled) {
  background: color-mix(
    in srgb,
    var(--md-sys-color-on-surface) calc(var(--md-sys-state-pressed-opacity) * 100%),
    var(--md-sys-color-surface-container-high)
  );
  border-color: var(--md-sys-color-outline);
  box-shadow: var(--md-sys-elevation-1);
}

/* Disabled */
.mobile-header-button:disabled {
  opacity: var(--md-sys-state-disabled-opacity);
  cursor: not-allowed;
}

/* Active (toggled on) — filled primary for high contrast */
/* Повышаем специфичность чтобы перебить :hover и :active на мобильных */
.mobile-header-button--active,
.mobile-header-button--active:hover:not(:disabled),
.mobile-header-button--active:active:not(:disabled) {
  background: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
  border-color: var(--md-sys-color-primary);
  box-shadow: var(--md-sys-elevation-2);
}

.mobile-header--dark .mobile-header-button--active,
.mobile-header--dark .mobile-header-button--active:hover:not(:disabled),
.mobile-header--dark .mobile-header-button--active:active:not(:disabled) {
  background: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
  border-color: var(--md-sys-color-primary);
}

/* --- Button icon --- */
.button-icon {
  font-size: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* --- Avatar button --- */
.mobile-header-avatar {
  min-width: 44px;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: transparent;
  color: var(--md-sys-color-on-surface);
  font-size: 18px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  cursor: pointer;
  box-shadow: none;
  transition:
    all var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-standard);
  user-select: none;
  flex-shrink: 0;
  padding: 0;
  box-sizing: border-box;
  transform: scale(var(--menu-scale, 1));
  transform-origin: center;
}

.mobile-header-avatar:active {
  transform: scale(calc(var(--menu-scale, 1) * 0.95));
}

/* --- Avatar container --- */
.avatar-container {
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    border-color var(--md-sys-motion-duration-medium2) var(--md-sys-motion-easing-standard),
    box-shadow var(--md-sys-motion-duration-medium2) var(--md-sys-motion-easing-standard),
    background var(--md-sys-motion-duration-medium2) var(--md-sys-motion-easing-standard);
}

/* Verified avatar — goldPulse preserved */
.avatar-container--verified {
  padding: 3px;
  border-radius: 50%;
  border: 2px solid #FFD700;
  box-shadow: 0 0 10px rgba(255, 215, 0, 0.6);
  animation: goldPulse 3s ease-in-out infinite;
}

.avatar-container--verified:hover {
  box-shadow: 0 0 14px rgba(255, 215, 0, 0.75);
}

@keyframes goldPulse {
  0% {
    box-shadow: 0 0 10px rgba(255, 215, 0, 0.45), 0 0 0 0 rgba(255, 215, 0, 0.35);
    border-color: rgba(255, 215, 0, 0.85);
  }
  50% {
    box-shadow: 0 0 16px rgba(255, 215, 0, 0.7), 0 0 0 6px rgba(255, 215, 0, 0.08);
    border-color: rgba(255, 215, 0, 1);
  }
  100% {
    box-shadow: 0 0 10px rgba(255, 215, 0, 0.45), 0 0 0 0 rgba(255, 215, 0, 0.0);
    border-color: rgba(255, 215, 0, 0.85);
  }
}

/* Avatar image */
.avatar-image {
  width: 34px;
  height: 34px;
  object-fit: cover;
  border-radius: 50%;
  display: block;
  flex-shrink: 0;
}

/* Avatar initials — M3 primary-container instead of gradient */
.avatar-initials {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: var(--md-sys-color-primary-container);
  color: var(--md-sys-color-on-primary-container);
  font-size: 14px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

/* ============================================================
   TELEPORTED MENUS
   These teleport to <body>, outside #app / .m3-dark ancestor.
   Light mode uses --md-ref-neutral-* light values directly.
   Dark mode (--dark suffix) uses --md-ref-neutral-* dark values.
   ============================================================ */

/* --- User menu overlay --- */
.mobile-user-menu-overlay {
  position: fixed;
  inset: 0;
  background: color-mix(in srgb, var(--md-ref-neutral-10) 32%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  z-index: 2500;
  backdrop-filter: blur(6px);
}

.mobile-user-menu-overlay--dark {
  background: color-mix(in srgb, var(--md-ref-neutral-0) 55%, transparent);
}

/* --- User menu panel --- */
.mobile-user-menu {
  position: relative;
  width: min(360px, calc(100vw - 32px));
  max-height: calc(100vh - 64px);
  overflow-y: auto;
  background: var(--md-ref-neutral-98);
  color: var(--md-ref-neutral-10);
  border-radius: var(--md-sys-shape-corner-extra-large);
  padding: 24px;
  box-shadow: var(--md-sys-elevation-3);
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.mobile-user-menu--dark {
  background: var(--md-ref-neutral-17);
  color: var(--md-ref-neutral-90);
  box-shadow: var(--md-sys-elevation-3);
  border: 1px solid color-mix(in srgb, var(--md-ref-neutral-variant-60) 20%, transparent);
}

/* Close button — pill shape */
.mobile-user-menu__close {
  position: absolute;
  top: 14px;
  right: 14px;
  width: 34px;
  height: 34px;
  border-radius: var(--md-sys-shape-corner-full);
  border: none;
  background: color-mix(in srgb, var(--md-ref-neutral-10) 8%, transparent);
  color: inherit;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  transition: background var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-standard);
}

.mobile-user-menu--dark .mobile-user-menu__close {
  background: color-mix(in srgb, var(--md-ref-neutral-90) 12%, transparent);
}

.mobile-user-menu__close:hover {
  background: color-mix(in srgb, var(--md-ref-neutral-10) 12%, transparent);
}

.mobile-user-menu--dark .mobile-user-menu__close:hover {
  background: color-mix(in srgb, var(--md-ref-neutral-90) 20%, transparent);
}

/* --- Menu sections --- */
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

/* --- Project button --- */
.mobile-user-menu__project-button {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: var(--md-sys-shape-corner-large);
  border: 1px solid color-mix(in srgb, var(--md-ref-neutral-10) 8%, transparent);
  background: color-mix(in srgb, var(--md-ref-neutral-10) 5%, transparent);
  color: inherit;
  cursor: pointer;
  transition:
    background var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-standard),
    border-color var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-standard),
    transform var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-standard);
  max-width: 100%;
}

.mobile-user-menu--dark .mobile-user-menu__project-button {
  background: color-mix(in srgb, var(--md-ref-neutral-90) 5%, transparent);
  border-color: color-mix(in srgb, var(--md-ref-neutral-90) 18%, transparent);
}

.mobile-user-menu__project-button:hover {
  background: var(--md-ref-primary-90);
  color: var(--md-ref-primary-10);
  border-color: color-mix(in srgb, var(--md-ref-primary-40) 30%, transparent);
  transform: translateY(-1px);
}

.mobile-user-menu--dark .mobile-user-menu__project-button:hover {
  background: var(--md-ref-primary-30);
  color: var(--md-ref-primary-90);
  border-color: color-mix(in srgb, var(--md-ref-primary-80) 30%, transparent);
}

.mobile-user-menu__project-button:focus-visible {
  outline: 2px solid var(--md-ref-primary-40);
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

/* --- Save status --- */
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

/* --- Menu items --- */
.mobile-user-menu__item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: var(--md-sys-shape-corner-large);
  border: none;
  background: color-mix(in srgb, var(--md-ref-neutral-10) 4%, transparent);
  color: inherit;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition:
    background var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-standard),
    transform var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-standard);
}

.mobile-user-menu__item:hover {
  background: var(--md-ref-primary-90);
  color: var(--md-ref-primary-10);
  transform: translateY(-1px);
}

.mobile-user-menu--dark .mobile-user-menu__item {
  background: color-mix(in srgb, var(--md-ref-neutral-90) 5%, transparent);
}

.mobile-user-menu--dark .mobile-user-menu__item:hover {
  background: var(--md-ref-primary-30);
  color: var(--md-ref-primary-90);
}

/* Static item (disabled-looking) */
.mobile-user-menu__item--static {
  cursor: default;
  background: transparent;
  padding-left: 0;
  padding-right: 0;
}

.mobile-user-menu__item--static:hover {
  background: transparent;
  color: inherit;
  transform: none;
}

/* Danger item — error-container */
.mobile-user-menu__item--danger {
  background: color-mix(in srgb, var(--md-ref-error-40) 8%, transparent);
}

.mobile-user-menu__item--danger:hover {
  background: var(--md-ref-error-90);
  color: var(--md-ref-error-10);
}

.mobile-user-menu--dark .mobile-user-menu__item--danger {
  background: color-mix(in srgb, var(--md-ref-error-80) 10%, transparent);
}

.mobile-user-menu--dark .mobile-user-menu__item--danger:hover {
  background: var(--md-ref-error-30);
  color: var(--md-ref-error-90);
}

/* Admin item */
.mobile-user-menu__item--admin {
  background: color-mix(in srgb, var(--md-ref-primary-40) 8%, transparent);
}

.mobile-user-menu__item--admin:hover {
  background: var(--md-ref-primary-90);
  color: var(--md-ref-primary-10);
}

.mobile-user-menu--dark .mobile-user-menu__item--admin {
  background: color-mix(in srgb, var(--md-ref-primary-80) 10%, transparent);
}

.mobile-user-menu--dark .mobile-user-menu__item--admin:hover {
  background: var(--md-ref-primary-30);
  color: var(--md-ref-primary-90);
}

/* --- Divider --- */
.mobile-user-menu__divider {
  height: 1px;
  background: color-mix(in srgb, var(--md-ref-neutral-10) 12%, transparent);
}

.mobile-user-menu--dark .mobile-user-menu__divider {
  background: color-mix(in srgb, var(--md-ref-neutral-90) 16%, transparent);
}

/* --- Responsive: small screens --- */
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

  .avatar-image {
    width: 30px;
    height: 30px;
  }

  .avatar-initials {
    width: 30px;
    height: 30px;
    font-size: 12px;
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

/* ============================================================
   SHARE MENU (Teleported)
   Same M3 treatment as user menu
   ============================================================ */

/* --- Share menu overlay --- */
.mobile-share-menu-overlay {
  position: fixed;
  inset: 0;
  background: color-mix(in srgb, var(--md-ref-neutral-10) 32%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  z-index: 2500;
  backdrop-filter: blur(6px);
}

.mobile-share-menu-overlay--dark {
  background: color-mix(in srgb, var(--md-ref-neutral-0) 55%, transparent);
}

/* --- Share menu panel --- */
.mobile-share-menu {
  position: relative;
  width: min(360px, calc(100vw - 32px));
  max-height: calc(100vh - 64px);
  overflow-y: auto;
  background: var(--md-ref-neutral-98);
  color: var(--md-ref-neutral-10);
  border-radius: var(--md-sys-shape-corner-extra-large);
  padding: 24px;
  box-shadow: var(--md-sys-elevation-3);
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.mobile-share-menu--dark {
  background: var(--md-ref-neutral-17);
  color: var(--md-ref-neutral-90);
  box-shadow: var(--md-sys-elevation-3);
  border: 1px solid color-mix(in srgb, var(--md-ref-neutral-variant-60) 20%, transparent);
}

/* Close button — pill */
.mobile-share-menu__close {
  position: absolute;
  top: 14px;
  right: 14px;
  width: 34px;
  height: 34px;
  border-radius: var(--md-sys-shape-corner-full);
  border: none;
  background: color-mix(in srgb, var(--md-ref-neutral-10) 8%, transparent);
  color: inherit;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  transition: background var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-standard);
}

.mobile-share-menu--dark .mobile-share-menu__close {
  background: color-mix(in srgb, var(--md-ref-neutral-90) 12%, transparent);
}

.mobile-share-menu__close:hover {
  background: color-mix(in srgb, var(--md-ref-neutral-10) 12%, transparent);
}

.mobile-share-menu--dark .mobile-share-menu__close:hover {
  background: color-mix(in srgb, var(--md-ref-neutral-90) 20%, transparent);
}

/* Title */
.mobile-share-menu__title {
  font-size: 20px;
  font-weight: 700;
  text-align: center;
  padding-right: 34px;
  color: inherit;
}

/* Section */
.mobile-share-menu__section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Item wrapper (for submenu positioning) */
.mobile-share-menu__item-wrapper {
  position: relative;
}

/* Share menu items */
.mobile-share-menu__item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: var(--md-sys-shape-corner-large);
  border: none;
  background: color-mix(in srgb, var(--md-ref-neutral-10) 4%, transparent);
  color: inherit;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition:
    background var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-standard),
    transform var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-standard);
  width: 100%;
}

.mobile-share-menu__item:hover {
  background: var(--md-ref-primary-90);
  color: var(--md-ref-primary-10);
  transform: translateY(-1px);
}

.mobile-share-menu__item--active {
  background: color-mix(in srgb, var(--md-ref-primary-40) 15%, transparent);
}

.mobile-share-menu--dark .mobile-share-menu__item {
  background: color-mix(in srgb, var(--md-ref-neutral-90) 5%, transparent);
}

.mobile-share-menu--dark .mobile-share-menu__item:hover {
  background: var(--md-ref-primary-30);
  color: var(--md-ref-primary-90);
}

/* Arrow (for expandable items) */
.mobile-share-menu__arrow {
  margin-left: auto;
  font-size: 14px;
  transition: transform var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-standard);
}

.mobile-share-menu__arrow--rotated {
  transform: rotate(90deg);
}

/* Submenu */
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
  border-radius: var(--md-sys-shape-corner-medium);
  border: none;
  background: color-mix(in srgb, var(--md-ref-neutral-10) 3%, transparent);
  color: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition:
    background var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-standard),
    transform var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-standard);
  width: 100%;
}

.mobile-share-menu__submenu-item:hover {
  background: var(--md-ref-primary-90);
  color: var(--md-ref-primary-10);
  transform: translateX(2px);
}

.mobile-share-menu--dark .mobile-share-menu__submenu-item {
  background: color-mix(in srgb, var(--md-ref-neutral-90) 4%, transparent);
}

.mobile-share-menu--dark .mobile-share-menu__submenu-item:hover {
  background: var(--md-ref-primary-30);
  color: var(--md-ref-primary-90);
}

/* ============================================================
   TRANSITIONS
   ============================================================ */

/* Submenu slide */
.submenu-slide-enter-active,
.submenu-slide-leave-active {
  transition:
    opacity var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-standard),
    max-height var(--md-sys-motion-duration-medium2) var(--md-sys-motion-easing-emphasized);
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

/* Fade (overlay appear/disappear) */
.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-standard);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* ============================================================
   AURORA DESIGN — Spatial Glass Header
   ============================================================ */

.mobile-header--aurora {
  background: rgba(8, 12, 20, 0.55);
  backdrop-filter: blur(24px) saturate(1.3);
  -webkit-backdrop-filter: blur(24px) saturate(1.3);
  border-bottom: 1px solid transparent;
  background-clip: padding-box;
  font-family: 'Manrope', system-ui, -apple-system, sans-serif;
}

/* Aurora gradient border-bottom shimmer */
.mobile-header--aurora::before {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent 5%, #00d4aa 20%, #0088ff 50%, #8b5cf6 80%, transparent 95%);
  opacity: 0.6;
}

/* Aurora glow under header */
.mobile-header--aurora::after {
  content: '';
  position: absolute;
  bottom: -8px;
  left: 10%;
  right: 10%;
  height: 8px;
  background: linear-gradient(90deg, transparent, rgba(0, 212, 170, 0.12), rgba(0, 136, 255, 0.12), rgba(139, 92, 246, 0.08), transparent);
  filter: blur(4px);
  pointer-events: none;
}

/* Aurora buttons */
.mobile-header--aurora .mobile-header-button {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.88);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.mobile-header--aurora .mobile-header-button:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(0, 212, 170, 0.25);
  box-shadow: 0 0 16px rgba(0, 212, 170, 0.1), 0 2px 8px rgba(0, 0, 0, 0.2);
}

.mobile-header--aurora .mobile-header-button:active:not(:disabled) {
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(0, 212, 170, 0.3);
  box-shadow: 0 0 8px rgba(0, 212, 170, 0.08);
}

/* Aurora active button */
.mobile-header--aurora .mobile-header-button--active,
.mobile-header--aurora .mobile-header-button--active:hover:not(:disabled),
.mobile-header--aurora .mobile-header-button--active:active:not(:disabled) {
  background: linear-gradient(135deg, rgba(0, 212, 170, 0.25), rgba(0, 136, 255, 0.25));
  border-color: rgba(0, 212, 170, 0.5);
  color: #00d4aa;
  box-shadow: 0 0 20px rgba(0, 212, 170, 0.15), 0 2px 8px rgba(0, 0, 0, 0.2);
}

/* Aurora avatar */
.mobile-header--aurora .avatar-initials {
  background: linear-gradient(135deg, rgba(0, 212, 170, 0.2), rgba(0, 136, 255, 0.2));
  color: rgba(255, 255, 255, 0.9);
  box-shadow: 0 0 12px rgba(0, 212, 170, 0.15);
}

.mobile-header--aurora .mobile-header-avatar {
  box-shadow: 0 0 0 2px rgba(0, 212, 170, 0.2);
  border-radius: 50%;
}

/* Aurora disabled */
.mobile-header--aurora .mobile-header-button:disabled {
  opacity: 0.3;
}
</style>
