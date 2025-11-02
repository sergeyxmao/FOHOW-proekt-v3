<script setup>
import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useHistoryStore } from '@/stores/history'

const props = defineProps({
  isModernTheme: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['toggle-theme', 'open-profile'])

const authStore = useAuthStore()
const historyStore = useHistoryStore()

const userInitials = computed(() => {
  if (!authStore.user?.name) return '?'
  const names = authStore.user.name.trim().split(/\s+/)
  if (names.length === 1) {
    return names[0].charAt(0).toUpperCase()
  }
  return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase()
})

const handleUndo = () => {
  historyStore.undo()
}

const handleRedo = () => {
  historyStore.redo()
}

const handleProfileClick = () => {
  emit('open-profile')
}

const handleThemeToggle = () => {
  emit('toggle-theme')
}
</script>

<template>
  <div class="mobile-header" :class="{ 'mobile-header--dark': isModernTheme }">
    <!-- Левая часть: переключатель темы -->
    <div class="mobile-header-left">
      <button
        class="mobile-header-button theme-toggle"
        type="button"
        @click="handleThemeToggle"
        :title="isModernTheme ? 'Светлая тема' : 'Темная тема'"
      >
        <span class="theme-icon">{{ isModernTheme ? '☀️' : '🌙' }}</span>
      </button>
    </div>

    <!-- Центральная часть: undo/redo -->
    <div class="mobile-header-center">
      <button
        class="mobile-header-button history-button"
        type="button"
        :disabled="!historyStore.canUndo"
        @click="handleUndo"
        title="Отменить"
      >
        <span class="history-icon">↶</span>
      </button>
      <button
        class="mobile-header-button history-button"
        type="button"
        :disabled="!historyStore.canRedo"
        @click="handleRedo"
        title="Повторить"
      >
        <span class="history-icon">↷</span>
      </button>
    </div>

    <!-- Правая часть: аватар -->
    <div class="mobile-header-right">
      <button
        v-if="authStore.isAuthenticated"
        class="mobile-header-avatar"
        type="button"
        @click="handleProfileClick"
        :title="authStore.user?.name || 'Профиль'"
      >
        {{ userInitials }}
      </button>
      <button
        v-else
        class="mobile-header-button login-button"
        type="button"
        @click="handleProfileClick"
        title="Войти"
      >
        <span class="login-icon">👤</span>
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
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  z-index: 1000;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.mobile-header--dark {
  background: rgba(28, 38, 58, 0.95);
  border-bottom-color: rgba(255, 255, 255, 0.1);
  color: #e5f3ff;
}

.mobile-header-left,
.mobile-header-right {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 8px;
}

.mobile-header-center {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.mobile-header-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border: none;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.04);
  color: #111827;
  font-size: 20px;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
}

.mobile-header--dark .mobile-header-button {
  background: rgba(255, 255, 255, 0.08);
  color: #e5f3ff;
}

.mobile-header-button:active:not(:disabled) {
  transform: scale(0.95);
  background: rgba(0, 0, 0, 0.08);
}

.mobile-header--dark .mobile-header-button:active:not(:disabled) {
  background: rgba(255, 255, 255, 0.15);
}

.mobile-header-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.theme-toggle {
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
}

.mobile-header--dark .theme-toggle {
  background: linear-gradient(135deg, #3b82f6 0%, #1e40af 100%);
}

.theme-icon {
  font-size: 22px;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.2));
}

.history-button {
  min-width: 44px;
}

.history-icon {
  font-size: 28px;
  font-weight: 600;
}

.mobile-header-avatar {
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
  border: none;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(15, 98, 254, 0.3);
  transition: all 0.2s ease;
  user-select: none;
}

.mobile-header-avatar:active {
  transform: scale(0.95);
}

.login-button {
  background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%);
}

.login-icon {
  font-size: 22px;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.2));
}

/* Адаптация для очень маленьких экранов */
@media (max-width: 360px) {
  .mobile-header {
    height: 52px;
    padding: 0 8px;
  }

  .mobile-header-button {
    width: 40px;
    height: 40px;
    font-size: 18px;
  }

  .mobile-header-avatar {
    width: 40px;
    height: 40px;
    font-size: 16px;
  }

  .mobile-header-center {
    gap: 8px;
  }
}
</style>
