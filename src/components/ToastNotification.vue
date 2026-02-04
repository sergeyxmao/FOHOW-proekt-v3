<template>
  <div
    :class="['toast-notification', `toast-notification--${type}`]"
    role="alert"
    aria-live="polite"
  >
    <div class="toast-notification__icon">
      {{ getIcon() }}
    </div>

    <div class="toast-notification__content">
      <p class="toast-notification__message">{{ message }}</p>

      <button
        v-if="actionText"
        class="toast-notification__action"
        @click="handleAction"
      >
        {{ actionText }}
      </button>
    </div>

    <button
      class="toast-notification__close"
      @click="handleClose"
      :aria-label="t('notifications.close')"
    >
      ✕
    </button>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { useNotificationsStore } from '@/stores/notifications'

const { t } = useI18n()

const props = defineProps({
  id: {
    type: Number,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  type: {
    type: String,
    default: 'info',
    validator: (value) => ['error', 'success', 'info', 'warning'].includes(value)
  },
  actionText: {
    type: String,
    default: ''
  },
  onAction: {
    type: Function,
    default: null
  }
})

const notificationsStore = useNotificationsStore()

function getIcon() {
  const icons = {
    error: '❌',
    success: '✅',
    info: 'ℹ️',
    warning: '⚠️'
  }
  return icons[props.type] || icons.info
}

function handleClose() {
  notificationsStore.removeNotification(props.id)
}

function handleAction() {
  if (props.onAction) {
    props.onAction()
  }
  handleClose()
}
</script>

<style scoped>
.toast-notification {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  min-width: 320px;
  max-width: 480px;
  padding: 16px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  border-left: 4px solid;
  animation: slideIn 0.3s ease-out;
  transition: transform 0.2s ease, opacity 0.2s ease;
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

.toast-notification:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.2);
}

/* Типы уведомлений */
.toast-notification--error {
  border-left-color: #f44336;
}

.toast-notification--success {
  border-left-color: #4caf50;
}

.toast-notification--info {
  border-left-color: #2196f3;
}

.toast-notification--warning {
  border-left-color: #ff9800;
}

/* Иконка */
.toast-notification__icon {
  font-size: 24px;
  line-height: 1;
  flex-shrink: 0;
}

/* Контент */
.toast-notification__content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.toast-notification__message {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: #333;
}

/* Кнопка действия */
.toast-notification__action {
  align-self: flex-start;
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.toast-notification--error .toast-notification__action {
  background: #f44336;
  color: white;
}

.toast-notification--error .toast-notification__action:hover {
  background: #d32f2f;
  transform: translateY(-1px);
}

.toast-notification--success .toast-notification__action {
  background: #4caf50;
  color: white;
}

.toast-notification--success .toast-notification__action:hover {
  background: #388e3c;
  transform: translateY(-1px);
}

.toast-notification--info .toast-notification__action {
  background: #2196f3;
  color: white;
}

.toast-notification--info .toast-notification__action:hover {
  background: #1976d2;
  transform: translateY(-1px);
}

.toast-notification--warning .toast-notification__action {
  background: #ff9800;
  color: white;
}

.toast-notification--warning .toast-notification__action:hover {
  background: #f57c00;
  transform: translateY(-1px);
}

/* Кнопка закрытия */
.toast-notification__close {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: #999;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s ease;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.toast-notification__close:hover {
  background: #f5f5f5;
  color: #333;
}

/* Мобильная адаптация */
@media (max-width: 480px) {
  .toast-notification {
    min-width: 280px;
    max-width: calc(100vw - 32px);
    padding: 14px;
  }

  .toast-notification__icon {
    font-size: 20px;
  }

  .toast-notification__message {
    font-size: 13px;
  }

  .toast-notification__action {
    font-size: 12px;
    padding: 6px 12px;
  }
}
</style>
