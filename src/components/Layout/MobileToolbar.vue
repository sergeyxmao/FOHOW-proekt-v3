<script setup>
import { computed } from 'vue'
import { storeToRefs } from 'pinia'  
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

const emit = defineEmits(['save', 'toggle-theme', 'fit-to-content', 'open-profile', 'request-auth'])

const authStore = useAuthStore()
const boardStore = useBoardStore()
const mobileStore = useMobileStore()
const viewportStore = useViewportStore()

const { isSaving, currentBoardId, currentBoardName } = storeToRefs(boardStore)
const isMobileMode = computed(() => mobileStore.isMobileMode)
const { isMenuScaled, menuScale } = storeToRefs(mobileStore)
const { zoomPercentage } = storeToRefs(viewportStore)
const zoomDisplay = computed(() => String(zoomPercentage.value ?? 0))
const isSaveAvailable = computed(() => {
  const boardName = (currentBoardName.value ?? '').trim()

  return boardName.length > 0
})

const saveTooltip = computed(() =>
  isSaveAvailable.value
    ? 'Сохранить'
    : 'Задайте название проекта, чтобы сохранить'
)

const handleSave = () => {
  if (!isSaveAvailable.value) {
    return
  }
  
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

const handleFitToContent = () => {
  emit('fit-to-content')
}

const handleProfileClick = () => {
  if (authStore.isAuthenticated) {
    emit('open-profile')
    return
  }

  emit('request-auth')
}
</script>

<template>
  <div
    class="mobile-toolbar"
    :class="{ 'mobile-toolbar--dark': isModernTheme, 'mobile-toolbar--scaled': isMenuScaled }"
    :style="{ '--menu-scale': menuScale }"  
    >
    <div class="mobile-toolbar-layout">
      <div class="mobile-toolbar-section mobile-toolbar-section--left">
        <!-- @marketingFohow -->
        <button
          class="mobile-toolbar-button marketing-button"
          type="button"
          @click="openMarketingLink"
          title="@marketingFohow"
          aria-label="Открыть Telegram @marketingFohow"
        >
          <svg class="marketing-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M21.543 2.47a1.25 1.25 0 0 0-1.303-.193L3.154 9.53c-.5.214-.82.7-.798 1.23.022.53.38.99.897 1.16l4.72 1.566 1.837 5.52c.18.54.68.905 1.25.923h.04c.56 0 1.06-.34 1.26-.86l1.68-4.32 4.66 3.54c.22.17.49.26.76.26.17 0 .34-.03.5-.1.39-.16.68-.5.78-.91l3.18-13.42c.13-.54-.12-1.1-.6-1.36Z"
              fill="currentColor"
            />
          </svg>
        </button>
      </div>

      <div class="mobile-toolbar-section mobile-toolbar-section--center">
        <!-- Переключатель темы -->
        <button
          v-if="authStore.isAuthenticated"
          class="mobile-toolbar-button theme-button"
          type="button"
          @click="handleToggleTheme"
          :title="isModernTheme ? 'Светлая тема' : 'Темная тема'"
          aria-label="Переключить тему"
        >
          <span class="theme-icon"></span>
        </button>
        <!-- Текущий масштаб -->
        <button
          v-if="authStore.isAuthenticated"
          class="mobile-toolbar-button zoom-button"
          type="button"
          @click="handleFitToContent"
          :title="`Текущий масштаб: ${zoomDisplay}%`"
          aria-label="Автоподгонка масштаба"
        >
          <span class="button-icon zoom-button__value">{{ zoomDisplay }}</span>
        </button>
        <!-- Переключатель версии -->
        <button
          v-if="authStore.isAuthenticated"
          class="mobile-toolbar-button version-button"
          type="button"
          @click="handleToggleVersion"
          :title="isMobileMode ? 'Версия для ПК' : 'Мобильная версия'"
          aria-label="Переключить версию"
        >
          <span class="button-icon">{{ isMobileMode ? '💻' : '📱' }}</span>
        </button>
      </div>

      <div class="mobile-toolbar-section mobile-toolbar-section--right">
        <button
          v-if="!authStore.isAuthenticated"
          class="mobile-toolbar-button auth-button"
          type="button"
          @click="handleProfileClick"
          title="Войти"
          aria-label="Открыть окно авторизации"
        >
          <span class="button-icon">👤</span>
        </button>

        <!-- Кнопка сохранения -->
        <button
          v-if="authStore.isAuthenticated"
          class="mobile-toolbar-button save-button"
          type="button"
          :disabled="isSaving || !isSaveAvailable"
          @click="handleSave"
          :title="saveTooltip"
          :aria-label="saveTooltip"
        >
          <span class="button-icon">💾</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mobile-toolbar {
  position: fixed;
  bottom: env(safe-area-inset-bottom, 0);
  left: 0;
  right: 0;
  height: 56px;
  background: transparent;
  display: flex;
  align-items: center;
  padding: 0 8px;
  padding-left: calc(8px + env(safe-area-inset-left, 0));
  padding-right: calc(8px + env(safe-area-inset-right, 0));
  z-index: 1000;
}

.mobile-toolbar-layout {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  gap: 8px;
}

.mobile-toolbar-section {
  display: flex;
  align-items: center;
  gap: 8px;
}

.mobile-toolbar-section--left,
.mobile-toolbar-section--right {
  flex: 0 0 auto;
}

.mobile-toolbar-section--center {
  flex: 1 1 auto;
  justify-content: center;
}

.mobile-toolbar-section--right {
  margin-left: auto;  
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
  transform: scale(var(--menu-scale, 1));  
}
.mobile-toolbar--scaled .mobile-toolbar-button {
  transform: scale(var(--menu-scale, 1));
}

.mobile-toolbar--scaled .mobile-toolbar-section {
  gap: 12px;
}

.mobile-toolbar--dark .mobile-toolbar-button {
  background: rgba(28, 38, 58, 0.95);
  border-color: rgba(255, 255, 255, 0.1);
  color: #e5f3ff;
}

.mobile-toolbar-button:active:not(:disabled) {
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
  transform: scale(calc(var(--menu-scale, 1) * 0.95));  
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
}

.marketing-icon {
  width: 20px;
  height: 20px;
}

/* Переключатель темы */
.theme-button {
  background: linear-gradient(145deg, rgba(59, 130, 246, 0.18), rgba(59, 130, 246, 0));
  border-color: rgba(15, 23, 42, 0.12);
}
/* Кнопка масштаба */
.zoom-button {
  min-width: 52px;
  padding: 0 6px;
  font-variant-numeric: tabular-nums;
}

.zoom-button__value {
  font-size: 18px;
  font-weight: 600;
}

.mobile-toolbar--dark .zoom-button {
  border-color: rgba(96, 164, 255, 0.32);
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
  .mobile-toolbar-layout,
  .mobile-toolbar-section {
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
