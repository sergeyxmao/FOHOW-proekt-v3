<template>
  <Teleport to="body">
    <div class="notifications-container">
      <TransitionGroup name="toast">
        <ToastNotification
          v-for="notification in notificationsStore.notifications"
          :key="notification.id"
          :id="notification.id"
          :message="notification.message"
          :type="notification.type"
          :action-text="notification.actionText"
          :on-action="notification.onAction"
        />
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup>
import { useNotificationsStore } from '@/stores/notifications'
import ToastNotification from './ToastNotification.vue'

const notificationsStore = useNotificationsStore()
</script>

<style scoped>
.notifications-container {
  position: fixed;
  top: 24px;
  right: 24px;
  z-index: 10000;
  display: flex;
  flex-direction: column;
  gap: 12px;
  pointer-events: none;
}

.notifications-container > * {
  pointer-events: auto;
}

/* Анимация для TransitionGroup */
.toast-enter-active {
  animation: slideIn 0.3s ease-out;
}

.toast-leave-active {
  animation: slideOut 0.3s ease-in;
}

.toast-move {
  transition: transform 0.3s ease;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes slideOut {
  from {
    transform: translateX(0);
    opacity: 1;
  }
  to {
    transform: translateX(100%);
    opacity: 0;
  }
}

/* Мобильная адаптация */
@media (max-width: 768px) {
  .notifications-container {
    top: 16px;
    right: 16px;
    left: 16px;
    max-width: calc(100vw - 32px);
  }
}

@media (max-width: 480px) {
  .notifications-container {
    top: 12px;
    right: 12px;
    left: 12px;
    gap: 8px;
  }
}
</style>
