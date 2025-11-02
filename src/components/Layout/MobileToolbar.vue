<script setup>
import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useBoardStore } from '@/stores/board'
import { useMobileStore } from '@/stores/mobile'
import { useViewportStore } from '@/stores/viewport'

const props = defineProps({
  isModernTheme: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['save', 'toggle-theme', 'fit-to-content'])

const authStore = useAuthStore()
const boardStore = useBoardStore()
const mobileStore = useMobileStore()
const viewportStore = useViewportStore()

const isSaving = computed(() => boardStore.isSaving)
const isMobileMode = computed(() => mobileStore.isMobileMode)
const zoomDisplay = computed(() => `${viewportStore.zoomPercentage}%`)

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

const handleZoomClick = () => {
  emit('fit-to-content')
}

const openMarketingLink = () => {
  window.open('https://t.me/marketingFohow', '_blank')
}
</script>

<template>
  <div class="mobile-toolbar" :class="{ 'mobile-toolbar--dark': isModernTheme }">
    <!-- Левая часть: Telegram -->
    <div class="mobile-toolbar-left">
      <a
        href="https://t.me/marketingFohow"
        target="_blank"
        rel="noopener noreferrer"
        class="mobile-toolbar-button telegram-button"
        @click.prevent="openMarketingLink"
        title="@marketingFohow"
      >
        <svg class="telegram-icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161c-.18 1.897-.962 6.502-1.359 8.627-.168.9-.5 1.201-.82 1.23-.697.064-1.226-.461-1.901-.903-1.056-.693-1.653-1.124-2.678-1.8-1.185-.781-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.139-5.062 3.345-.479.329-.913.489-1.302.481-.428-.009-1.252-.241-1.865-.44-.752-.244-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.831-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635.099-.002.321.023.465.141.122.099.155.232.171.326.016.093.036.305.02.469z"/>
        </svg>
      </a>
    </div>

    <!-- Центральная часть: Тема, Масштаб, Версия -->
    <div class="mobile-toolbar-center">
      <!-- Переключатель темы -->
      <button
        class="mobile-toolbar-button theme-button"
        type="button"
        @click="handleToggleTheme"
        :title="isModernTheme ? 'Светлая тема' : 'Темная тема'"
      >
        <span class="theme-icon"></span>
      </button>

      <!-- Масштаб -->
      <button
        class="mobile-toolbar-button zoom-button"
        type="button"
        @click="handleZoomClick"
        title="Автоподгонка масштаба"
      >
        <span class="zoom-text">{{ zoomDisplay }}</span>
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
    </div>

    <!-- Правая часть: Сохранить -->
    <div class="mobile-toolbar-right">
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
  justify-content: space-between;
  padding: 0 8px;
  z-index: 1000;
}

.mobile-toolbar-left,
.mobile-toolbar-center,
.mobile-toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.mobile-toolbar-left {
  flex: 0 0 auto;
}

.mobile-toolbar-center {
  flex: 1;
  justify-content: center;
}

.mobile-toolbar-right {
  flex: 0 0 auto;
}

.mobile-toolbar-button {
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
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  text-decoration: none;
  flex-shrink: 0;
  font-size: 14px;
  font-weight: 700;
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

/* Telegram button */
.telegram-button {
  background: linear-gradient(135deg, #2AABEE 0%, #229ED9 100%);
  color: #ffffff;
  border-color: rgba(42, 171, 238, 0.5);
  box-shadow: 0 2px 8px rgba(42, 171, 238, 0.3);
}

.telegram-icon {
  width: 24px;
  height: 24px;
}

/* Theme button */
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

/* Zoom button */
.zoom-button {
  min-width: auto;
  width: auto;
  padding: 0 12px;
}

.zoom-text {
  font-size: 14px;
  font-weight: 700;
  color: inherit;
}

/* Version button */
.version-button {
  background: rgba(15, 98, 254, 0.1);
}

.mobile-toolbar--dark .version-button {
  background: rgba(59, 130, 246, 0.2);
}

/* Save button */
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

  .mobile-toolbar-left,
  .mobile-toolbar-center,
  .mobile-toolbar-right {
    gap: 6px;
  }

  .mobile-toolbar-button {
    min-width: 40px;
    width: 40px;
    height: 40px;
    font-size: 13px;
  }

  .button-icon {
    font-size: 18px;
  }

  .theme-icon {
    width: 18px;
    height: 18px;
  }

  .telegram-icon {
    width: 22px;
    height: 22px;
  }

  .zoom-button {
    padding: 0 10px;
  }

  .zoom-text {
    font-size: 13px;
  }
}
</style>
