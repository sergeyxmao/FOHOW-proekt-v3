<script setup>
import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useBoardStore } from '@/stores/board'
import { useMobileStore } from '@/stores/mobile'

const props = defineProps({
  isModernTheme: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['save', 'toggle-theme'])

const authStore = useAuthStore()
const boardStore = useBoardStore()
const mobileStore = useMobileStore()

const isSaving = computed(() => boardStore.isSaving)
const isMobileMode = computed(() => mobileStore.isMobileMode)

const handleSave = () => {
  emit('save')
}

const handleToggleTheme = () => {
  emit('toggle-theme')
}

const handleToggleVersion = () => {
  if (isMobileMode.value) {
    mobileStore.switchToDesktop()
  } else {
    mobileStore.switchToMobile()
  }
}

const openMarketingLink = () => {
  window.open('https://t.me/marketingFohow', '_blank')
}
</script>

<template>
  <div class="mobile-toolbar" :class="{ 'mobile-toolbar--dark': isModernTheme }">
    <!-- Кнопки слева направо -->
    <div class="mobile-toolbar-buttons">
      <!-- @marketingFohow -->
      <a
        href="https://t.me/marketingFohow"
        target="_blank"
        rel="noopener noreferrer"
        class="mobile-toolbar-button marketing-button"
        @click.prevent="openMarketingLink"
        title="@marketingFohow"
      >
        @marketingFohow
      </a>

      <!-- Переключатель темы -->
      <button
        class="mobile-toolbar-button theme-button"
        type="button"
        @click="handleToggleTheme"
        :title="isModernTheme ? 'Светлая тема' : 'Темная тема'"
      >
        <span class="theme-icon"></span>
      </button>

      <!-- Переключатель версии -->
      <button
        class="mobile-toolbar-button version-button"
        type="button"
        @click="handleToggleVersion"
        :title="isMobileMode ? 'Версия для ПК' : 'Мобильная версия'"
      >
        <span class="button-icon">{{ isMobileMode ? '💻' : '📱' }}</span>
      </button>

      <!-- Кнопка сохранения -->
      <button
        v-if="authStore.isAuthenticated"
        class="mobile-toolbar-button save-button"
        type="button"
        :disabled="isSaving"
        @click="handleSave"
        title="Сохранить"
      >
        <span class="button-icon">💾</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.mobile-toolbar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 56px;
  background: transparent;
  display: flex;
  align-items: center;
  padding: 0 8px;
  z-index: 1000;
}

.mobile-toolbar-buttons {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.mobile-toolbar-button {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  height: 44px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  color: #111827;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  text-decoration: none;
  flex-shrink: 0;
}
.mobile-toolbar-button:not(.marketing-button) {
  width: 44px;
}
.mobile-toolbar--dark .mobile-toolbar-button {
  background: rgba(28, 38, 58, 0.95);
  border-color: rgba(255, 255, 255, 0.1);
  color: #e5f3ff;
}

.mobile-toolbar-button:active:not(:disabled) {
  transform: scale(0.95);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
}

.mobile-toolbar-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.button-icon {
  font-size: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Кнопка маркетинга */
.marketing-button {
  background: linear-gradient(135deg, #0088cc 0%, #0066a1 100%);
  color: #ffffff;
  border-color: rgba(0, 136, 204, 0.5);
  box-shadow: 0 2px 8px rgba(0, 136, 204, 0.3);
  padding: 0 16px;
  font-weight: 700;
  font-size: 15px;
  letter-spacing: 0.2px;
  width: auto;  
}

/* Переключатель темы */
.theme-button {
  background: linear-gradient(145deg, rgba(59, 130, 246, 0.18), rgba(59, 130, 246, 0));
  border-color: rgba(15, 23, 42, 0.12);
}

.mobile-toolbar--dark .theme-button {
  background: linear-gradient(145deg, rgba(114, 182, 255, 0.32), rgba(114, 182, 255, 0));
  border-color: rgba(96, 164, 255, 0.42);
}

.theme-icon {
  position: relative;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: linear-gradient(135deg, #0f172a 0%, #2563eb 100%);
  box-shadow: inset -4px -4px 10px rgba(255, 255, 255, 0.22), 0 6px 12px rgba(15, 23, 42, 0.18);
}

.mobile-toolbar--dark .theme-icon {
  background: linear-gradient(135deg, #e5f3ff 0%, #73c8ff 100%);
  box-shadow: inset -4px -4px 10px rgba(6, 11, 21, 0.35), 0 6px 12px rgba(6, 11, 21, 0.3);
}

.theme-icon::before,
.theme-icon::after {
  content: '';
  position: absolute;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.85);
}

.theme-icon::before {
  inset: 4px;
  opacity: 0.4;
}

.theme-icon::after {
  inset: 7px;
  opacity: 0.2;
}

/* Переключатель версии */
.version-button {
  background: rgba(15, 98, 254, 0.1);
}

.mobile-toolbar--dark .version-button {
  background: rgba(59, 130, 246, 0.2);
}

/* Кнопка сохранения */
.save-button {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: #ffffff;
  border-color: rgba(16, 185, 129, 0.5);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

.save-button:active:not(:disabled) {
  transform: scale(0.95);
  box-shadow: 0 2px 6px rgba(16, 185, 129, 0.4);
}

.save-button:disabled {
  background: #9ca3af;
  border-color: rgba(156, 163, 175, 0.5);
  box-shadow: none;
}

/* Адаптация для маленьких экранов */
@media (max-width: 480px) {
  .mobile-toolbar {
    height: 52px;
    padding: 0 6px;
  }
 
  .mobile-toolbar-buttons {
    gap: 6px;
  }

  .mobile-toolbar-button {
    min-width: 40px;
    width: 40px;
    height: 40px;
  }

  .button-icon {
    font-size: 18px;
  }

  .theme-icon {
    width: 18px;
    height: 18px;
  }
}
</style>
