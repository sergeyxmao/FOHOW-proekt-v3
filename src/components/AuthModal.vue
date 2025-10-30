<template>
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
      />
      
      <RegisterForm
        v-else
        :is-modern-theme="props.isModernTheme"        
        @register-success="handleSuccess"
        @switch-to-login="currentView = 'login'"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import LoginForm from './LoginForm.vue'
import RegisterForm from './RegisterForm.vue'

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
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.modal-content {
  position: relative;
  border-radius: 24px;
  max-width: 520px;
  width: min(520px, calc(100vw - 32px));
  max-height: min(92vh, 720px);
  overflow-y: auto;
  padding: 56px 48px 48px;
  box-sizing: border-box;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 24px;
  border: 1px solid var(--auth-border);
  background: var(--auth-surface);
  box-shadow: var(--auth-shadow);
  color: var(--auth-text);
  backdrop-filter: blur(22px);
  transition: background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease,
    color 0.3s ease;
  --auth-surface: rgba(255, 255, 255, 0.96);
  --auth-border: rgba(15, 23, 42, 0.14);
  --auth-shadow: 0 26px 54px rgba(15, 23, 42, 0.14);
  --auth-text: #111827;
  --auth-heading: #0f172a;
  --auth-muted: rgba(71, 85, 105, 0.78);
  --auth-input-bg: rgba(255, 255, 255, 0.98);
  --auth-input-border: rgba(148, 163, 184, 0.48);
  --auth-input-focus-border: rgba(15, 98, 254, 0.75);
  --auth-input-focus-ring: rgba(15, 98, 254, 0.18);
  --auth-input-placeholder: rgba(100, 116, 139, 0.68);
  --auth-primary: #0f62fe;
  --auth-primary-hover: #0c54d4;
  --auth-primary-disabled: rgba(15, 98, 254, 0.35);
  --auth-primary-shadow: rgba(15, 98, 254, 0.26);
  --auth-link: #0f62fe;
  --auth-link-hover: #073b98;
  --auth-error: #ef4444;
  --auth-success: #16a34a;
  --auth-error-bg: rgba(239, 68, 68, 0.12);
  --auth-success-bg: rgba(22, 163, 74, 0.12);
  --auth-error-border: rgba(239, 68, 68, 0.28);
  --auth-success-border: rgba(22, 163, 74, 0.32);
}

.modal-content--modern {
  --auth-surface: rgba(18, 27, 43, 0.94);
  --auth-border: rgba(114, 182, 255, 0.35);
  --auth-shadow: 0 32px 64px rgba(3, 8, 20, 0.62);
  --auth-text: #e5f3ff;
  --auth-heading: #f8fbff;
  --auth-muted: rgba(186, 208, 247, 0.78);
  --auth-input-bg: rgba(8, 18, 36, 0.82);
  --auth-input-border: rgba(114, 182, 255, 0.45);
  --auth-input-focus-border: rgba(123, 196, 255, 0.95);
  --auth-input-focus-ring: rgba(79, 168, 255, 0.26);
  --auth-input-placeholder: rgba(186, 208, 247, 0.62);
  --auth-primary: #73c8ff;
  --auth-primary-hover: #5fb9f7;
  --auth-primary-disabled: rgba(115, 200, 255, 0.35);
  --auth-primary-shadow: rgba(115, 200, 255, 0.32);
  --auth-link: #8fd0ff;
  --auth-link-hover: #b6e5ff;
  --auth-error: #ff8f8f;
  --auth-success: #7cffc2;
  --auth-error-bg: rgba(255, 143, 143, 0.14);
  --auth-success-bg: rgba(124, 255, 194, 0.18);
  --auth-error-border: rgba(255, 143, 143, 0.36);
  --auth-success-border: rgba(124, 255, 194, 0.4);
}

.modal-content--classic {
  /* Используются значения по умолчанию, заданные в .modal-content */
}

.close-btn {
  position: absolute;
  top: 18px;
  right: 22px;
  background: none;
  border: none;
  font-size: 30px;
  cursor: pointer;
  color: var(--auth-muted);
  z-index: 1;
  transition: color 0.2s ease;  
}

.close-btn:hover {
  color: var(--auth-text);
}
</style>
