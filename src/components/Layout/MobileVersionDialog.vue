<script setup>
import { useMobileStore } from '@/stores/mobile'

const mobileStore = useMobileStore()

const handleSwitchToDesktop = () => {
  mobileStore.switchToDesktop()
}

const handleContinueMobile = () => {
  mobileStore.closeMobileDialog()
}
</script>

<template>
  <div v-if="mobileStore.showMobileDialog" class="mobile-dialog-overlay">
    <div class="mobile-dialog">
      <div class="mobile-dialog-content">
        <div class="mobile-dialog-icon">📱</div>
        <h2 class="mobile-dialog-title">Мобильная версия</h2>
        <p class="mobile-dialog-message">
          Вы используете мобильную версию приложения с ограниченным функционалом.
          Для полного доступа ко всем возможностям переключитесь на версию для ПК.
        </p>
        <div class="mobile-dialog-actions">
          <button
            class="mobile-dialog-button mobile-dialog-button--desktop"
            type="button"
            @click="handleSwitchToDesktop"
          >
            <span class="button-icon">💻</span>
            <span>Версия для ПК</span>
          </button>
          <button
            class="mobile-dialog-button mobile-dialog-button--mobile"
            type="button"
            @click="handleContinueMobile"
          >
            <span class="button-icon">📱</span>
            <span>Продолжить</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mobile-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: color-mix(in srgb, var(--md-sys-color-scrim) 32%, transparent);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 20px;
}

.mobile-dialog {
  background: var(--md-sys-color-surface-container-high);
  border-radius: var(--md-sys-shape-corner-extra-large);
  max-width: 400px;
  width: 100%;
  box-shadow: var(--md-sys-elevation-3);
  animation: slideUp var(--md-sys-motion-duration-medium2) var(--md-sys-motion-easing-emphasized-decelerate);
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.mobile-dialog-content {
  padding: 32px 24px 24px;
  text-align: center;
}

.mobile-dialog-icon {
  font-size: 56px;
  margin-bottom: 16px;
  animation: bounce 0.6s var(--md-sys-motion-easing-emphasized);
}

@keyframes bounce {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

.mobile-dialog-title {
  font-size: 24px;
  font-weight: 500;
  color: var(--md-sys-color-on-surface);
  margin: 0 0 12px 0;
}

.mobile-dialog-message {
  font-size: 14px;
  line-height: 1.6;
  color: var(--md-sys-color-on-surface-variant);
  margin: 0 0 28px 0;
}

.mobile-dialog-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.mobile-dialog-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  padding: 14px 24px;
  border: none;
  border-radius: var(--md-sys-shape-corner-full);
  font-size: 15px;
  font-weight: 500;
  letter-spacing: 0.02em;
  cursor: pointer;
  transition: background var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-standard),
    box-shadow var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-standard),
    transform var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-standard);
}

.button-icon {
  font-size: 20px;
}

/* Primary filled button */
.mobile-dialog-button--desktop {
  background: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
  box-shadow: var(--md-sys-elevation-1);
}

.mobile-dialog-button--desktop:hover {
  box-shadow: var(--md-sys-elevation-2);
}

.mobile-dialog-button--desktop:active {
  transform: scale(0.98);
}

/* Outlined button */
.mobile-dialog-button--mobile {
  background: transparent;
  color: var(--md-sys-color-on-surface);
  border: 1px solid var(--md-sys-color-outline);
}

.mobile-dialog-button--mobile:hover {
  background: color-mix(in srgb, var(--md-sys-color-on-surface) 8%, transparent);
}

.mobile-dialog-button--mobile:active {
  background: color-mix(in srgb, var(--md-sys-color-on-surface) 12%, transparent);
  transform: scale(0.98);
}

@media (max-width: 480px) {
  .mobile-dialog-content {
    padding: 24px 20px 20px;
  }

  .mobile-dialog-icon {
    font-size: 44px;
  }

  .mobile-dialog-title {
    font-size: 20px;
  }

  .mobile-dialog-message {
    font-size: 13px;
  }

  .mobile-dialog-button {
    padding: 12px 20px;
    font-size: 14px;
  }
}
</style>
