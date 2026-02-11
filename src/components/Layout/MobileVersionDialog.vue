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
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 20px;
}

.mobile-dialog {
  background: #ffffff;
  border-radius: 20px;
  max-width: 400px;
  width: 100%;
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.3);
  animation: slideUp 0.3s ease-out;
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
  font-size: 64px;
  margin-bottom: 16px;
  animation: bounce 0.6s ease;
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
  font-weight: 700;
  color: #111827;
  margin: 0 0 12px 0;
}

.mobile-dialog-message {
  font-size: 15px;
  line-height: 1.6;
  color: #6b7280;
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
  padding: 14px 20px;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.button-icon {
  font-size: 20px;
}

.mobile-dialog-button--desktop {
  background: #ffc107;
  color: #000000;
  box-shadow: 0 4px 12px rgba(255, 193, 7, 0.3);
}

.mobile-dialog-button--desktop:hover {
  background: #e8a900;
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(255, 193, 7, 0.4);
}

.mobile-dialog-button--desktop:active {
  transform: translateY(0);
}

.mobile-dialog-button--mobile {
  background: #f3f4f6;
  color: #111827;
  border: 1px solid #e5e7eb;
}

.mobile-dialog-button--mobile:hover {
  background: #e5e7eb;
}

.mobile-dialog-button--mobile:active {
  background: #d1d5db;
}

@media (max-width: 480px) {
  .mobile-dialog-content {
    padding: 24px 20px 20px;
  }

  .mobile-dialog-icon {
    font-size: 48px;
  }

  .mobile-dialog-title {
    font-size: 20px;
  }

  .mobile-dialog-message {
    font-size: 14px;
  }

  .mobile-dialog-button {
    padding: 12px 16px;
    font-size: 15px;
  }
}
</style>
