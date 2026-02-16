<template>
  <Teleport to="body">
    <div v-if="isOpen" class="modal-overlay" @click.self="close">
      <div
        class="modal-content"
        :class="props.isModernTheme ? 'modal-content--modern' : 'modal-content--classic'"
      >
        <button class="close-btn" @click="close">×</button>

        <LoginForm
          v-if="currentView === 'login'"
          :is-modern-theme="props.isModernTheme"
          @login-success="handleSuccess"
          @switch-to-register="currentView = 'register'"
          @switch-to-forgot="currentView = 'forgot'"
        />

        <RegisterForm
          v-else-if="currentView === 'register'"
          :is-modern-theme="props.isModernTheme"
          @register-success="handleSuccess"
          @switch-to-login="currentView = 'login'"
        />

        <ForgotPasswordForm
          v-else-if="currentView === 'forgot'"
          :is-modern-theme="props.isModernTheme"
          @back-to-login="currentView = 'login'"
        />
      </div>
    </div>
  </Teleport>
</template>>

<script setup>
import { ref, watch } from 'vue'
import LoginForm from './LoginForm.vue'
import RegisterForm from './RegisterForm.vue'
import ForgotPasswordForm from './ForgotPasswordForm.vue'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  initialView: {
    type: String,
    default: 'login' // 'login' или 'register'
  },
  isModernTheme: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'success'])

const currentView = ref(props.initialView)
watch(
  () => props.initialView,
  (value) => {
    currentView.value = value
  }
)

watch(
  () => props.isOpen,
  (isOpen) => {
    if (isOpen) {
      currentView.value = props.initialView
    }
  }
)
function close() {
  emit('close')
}

function handleSuccess() {
  emit('success')
  close()
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: color-mix(in srgb, var(--md-sys-color-scrim) 32%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  backdrop-filter: blur(4px);
}

.modal-content {
  position: relative;
  border-radius: var(--md-sys-shape-corner-extra-large);
  max-width: 520px;
  width: min(520px, calc(100vw - 32px));
  max-height: min(92vh, 720px);
  overflow-y: auto;
  padding: 48px 40px 40px;
  box-sizing: border-box;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 24px;
  background: var(--md-sys-color-surface-container-high);
  border: none;
  box-shadow: var(--md-sys-elevation-3);
  color: var(--md-sys-color-on-surface);
  transition: background var(--md-sys-motion-duration-medium2) var(--md-sys-motion-easing-standard),
    box-shadow var(--md-sys-motion-duration-medium2) var(--md-sys-motion-easing-standard),
    color var(--md-sys-motion-duration-medium2) var(--md-sys-motion-easing-standard);

  /* Auth token bridge — propagates M3 colors to child forms */
  --auth-surface: var(--md-sys-color-surface-container-high);
  --auth-border: var(--md-sys-color-outline-variant);
  --auth-shadow: var(--md-sys-elevation-3);
  --auth-text: var(--md-sys-color-on-surface);
  --auth-heading: var(--md-sys-color-on-surface);
  --auth-muted: var(--md-sys-color-on-surface-variant);
  --auth-input-bg: var(--md-sys-color-surface-container-lowest);
  --auth-input-border: var(--md-sys-color-outline);
  --auth-input-focus-border: var(--md-sys-color-primary);
  --auth-input-focus-ring: color-mix(in srgb, var(--md-sys-color-primary) 18%, transparent);
  --auth-input-placeholder: var(--md-sys-color-on-surface-variant);
  --auth-primary: var(--md-sys-color-primary);
  --auth-primary-hover: var(--md-ref-primary-35);
  --auth-primary-disabled: color-mix(in srgb, var(--md-sys-color-primary) 38%, transparent);
  --auth-primary-shadow: color-mix(in srgb, var(--md-sys-color-primary) 24%, transparent);
  --auth-link: var(--md-sys-color-primary);
  --auth-link-hover: var(--md-ref-primary-30);
  --auth-error: var(--md-sys-color-error);
  --auth-success: var(--md-sys-color-success);
  --auth-error-bg: var(--md-sys-color-error-container);
  --auth-success-bg: var(--md-sys-color-success-container);
  --auth-error-border: color-mix(in srgb, var(--md-sys-color-error) 28%, transparent);
  --auth-success-border: color-mix(in srgb, var(--md-sys-color-success) 32%, transparent);
}

.modal-content--modern {
  /* Teleported to body — outside #app .m3-dark, so must set dark tokens explicitly */
  background: var(--md-ref-neutral-17);
  color: var(--md-ref-neutral-90);
  --auth-surface: var(--md-ref-neutral-17);
  --auth-border: var(--md-ref-neutral-variant-30);
  --auth-text: var(--md-ref-neutral-90);
  --auth-heading: var(--md-ref-neutral-90);
  --auth-muted: var(--md-ref-neutral-variant-80);
  --auth-input-bg: var(--md-ref-neutral-4);
  --auth-input-border: var(--md-ref-neutral-variant-60);
  --auth-input-focus-border: var(--md-ref-primary-80);
  --auth-input-focus-ring: color-mix(in srgb, var(--md-ref-primary-80) 18%, transparent);
  --auth-input-placeholder: var(--md-ref-neutral-variant-70);
  --auth-primary: var(--md-ref-primary-80);
  --auth-primary-hover: var(--md-ref-primary-90);
  --auth-primary-disabled: color-mix(in srgb, var(--md-ref-primary-80) 38%, transparent);
  --auth-primary-shadow: color-mix(in srgb, var(--md-ref-primary-80) 24%, transparent);
  --auth-link: var(--md-ref-primary-80);
  --auth-link-hover: var(--md-ref-primary-90);
  --auth-error: var(--md-ref-error-80);
  --auth-success: #34d399;
  --auth-error-bg: var(--md-ref-error-30);
  --auth-success-bg: #065f46;
  --auth-error-border: color-mix(in srgb, var(--md-ref-error-80) 28%, transparent);
  --auth-success-border: color-mix(in srgb, #34d399 32%, transparent);
}

.modal-content--classic {
  /* Uses default M3 light tokens from .modal-content */
}

.close-btn {
  position: absolute;
  top: 14px;
  right: 14px;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--md-sys-color-surface-variant);
  border: none;
  border-radius: var(--md-sys-shape-corner-full);
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
  color: var(--md-sys-color-on-surface-variant);
  z-index: 1;
  transition: background var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-standard),
    color var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-standard);
}

.close-btn:hover {
  background: var(--md-sys-color-surface-container-highest);
  color: var(--md-sys-color-on-surface);
}

.close-btn:active {
  transform: scale(0.95);
}
</style>
