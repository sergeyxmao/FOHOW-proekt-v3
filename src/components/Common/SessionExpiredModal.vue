<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  reason: {
    type: String,
    default: 'forced_logout', // 'forced_logout' | 'session_expired'
    validator: (value) => ['forced_logout', 'session_expired'].includes(value)
  }
})

const emit = defineEmits(['close', 'login'])

// Автозакрытие через 10 секунд
const AUTO_CLOSE_SECONDS = 10
const countdown = ref(AUTO_CLOSE_SECONDS)
let countdownInterval = null

const title = computed(() => {
  return props.reason === 'forced_logout'
    ? 'Ваша сессия завершена'
    : 'Сессия истекла'
})

const icon = computed(() => {
  return props.reason === 'forced_logout' ? '⚠️' : '⏱️'
})

const message = computed(() => {
  return props.reason === 'forced_logout'
    ? 'Обнаружен вход в систему с другого устройства или браузера.'
    : 'Вы не проявляли активность более 1 часа.'
})

const secondaryMessage = computed(() => {
  return props.reason === 'forced_logout'
    ? 'Если это были не вы — немедленно смените пароль в настройках профиля.'
    : 'Пожалуйста, войдите снова.'
})

const buttonText = computed(() => {
  return props.reason === 'forced_logout' ? 'Понятно' : 'Войти'
})

function handleClose() {
  stopCountdown()
  if (props.reason === 'session_expired') {
    emit('login')
  } else {
    emit('close')
  }
}

function startCountdown() {
  countdown.value = AUTO_CLOSE_SECONDS
  countdownInterval = setInterval(() => {
    countdown.value--
    if (countdown.value <= 0) {
      handleClose()
    }
  }, 1000)
}

function stopCountdown() {
  if (countdownInterval) {
    clearInterval(countdownInterval)
    countdownInterval = null
  }
}

watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    startCountdown()
  } else {
    stopCountdown()
  }
})

onMounted(() => {
  if (props.isOpen) {
    startCountdown()
  }
})

onBeforeUnmount(() => {
  stopCountdown()
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div
        v-if="isOpen"
        class="session-modal-overlay"
        @click.self="handleClose"
      >
        <div class="session-modal" role="alertdialog" aria-modal="true">
          <div class="session-modal__icon">{{ icon }}</div>
          <h2 class="session-modal__title">{{ title }}</h2>
          <p class="session-modal__message">{{ message }}</p>
          <p class="session-modal__secondary">{{ secondaryMessage }}</p>

          <button
            type="button"
            class="session-modal__button"
            @click="handleClose"
          >
            {{ buttonText }}
          </button>

          <p class="session-modal__countdown">
            Окно закроется автоматически через {{ countdown }} сек.
          </p>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.session-modal-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(4px);
  z-index: 100000;
}

.session-modal {
  width: 100%;
  max-width: 420px;
  background: #ffffff;
  border-radius: 16px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.4);
  padding: 32px 28px 24px;
  text-align: center;
  animation: modal-appear 0.3s ease-out;
}

@keyframes modal-appear {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(-10px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.session-modal__icon {
  font-size: 48px;
  line-height: 1;
  margin-bottom: 16px;
}

.session-modal__title {
  margin: 0 0 12px;
  font-size: 22px;
  font-weight: 700;
  color: #111827;
}

.session-modal__message {
  margin: 0 0 8px;
  font-size: 15px;
  color: #374151;
  line-height: 1.5;
}

.session-modal__secondary {
  margin: 0 0 24px;
  font-size: 14px;
  color: #6b7280;
  line-height: 1.5;
}

.session-modal__button {
  width: 100%;
  padding: 14px 24px;
  border: none;
  border-radius: 12px;
  background: linear-gradient(135deg, #0f62fe 0%, #0353e9 100%);
  color: #ffffff;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  box-shadow: 0 8px 20px rgba(15, 98, 254, 0.35);
}

.session-modal__button:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 28px rgba(15, 98, 254, 0.45);
}

.session-modal__button:active {
  transform: translateY(0);
}

.session-modal__countdown {
  margin: 16px 0 0;
  font-size: 12px;
  color: #9ca3af;
}

/* Transition */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.25s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

/* Mobile */
@media (max-width: 480px) {
  .session-modal {
    padding: 24px 20px 20px;
  }

  .session-modal__icon {
    font-size: 40px;
  }

  .session-modal__title {
    font-size: 20px;
  }

  .session-modal__message {
    font-size: 14px;
  }
}
</style>
