<script setup>
import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useHistoryStore } from '@/stores/history'
import { useCanvasStore } from '@/stores/canvas'

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
  'load-json'
])

const authStore = useAuthStore()
const historyStore = useHistoryStore()
const canvasStore = useCanvasStore()

const API_URL = import.meta.env.VITE_API_URL || 'https://interactive.marketingfohow.ru/api'

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

const handleProfileClick = () => {
  emit('open-profile')
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
</script>

<template>
  <div class="mobile-header" :class="{ 'mobile-header--dark': isModernTheme }">
    <!-- Кнопки слева направо -->
    <div class="mobile-header-buttons">
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

      <!-- Режим иерархии -->
      <button
        class="mobile-header-button"
        :class="{ 'mobile-header-button--active': isHierarchyMode }"
        type="button"
        @click="toggleHierarchyMode"
        title="Режим иерархии"
      >
        <span class="button-icon">🔗</span>
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

      <!-- Аватар -->
      <button
        v-if="authStore.isAuthenticated"
        class="mobile-header-avatar"
        type="button"
        @click="handleProfileClick"
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
        @click="handleProfileClick"
        title="Войти"
      >
        <span class="button-icon">👤</span>
      </button>
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
  padding: 0 8px;
  z-index: 1000;
}

.mobile-header-buttons {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  flex-wrap: nowrap;
  overflow-x: auto;
  scrollbar-width: none;
}

.mobile-header-buttons::-webkit-scrollbar {
  display: none;
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

/* Адаптация для очень маленьких экранов */
@media (max-width: 480px) {
  .mobile-header {
    height: 52px;
    padding: 0 6px;
  }

  .mobile-header-buttons {
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
}
</style>
