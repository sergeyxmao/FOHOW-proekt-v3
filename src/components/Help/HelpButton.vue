<script setup>
defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  isModernTheme: {
    type: Boolean,
    default: false
  }
})

defineEmits(['toggle'])
</script>

<template>
  <button
    class="help-floating-button no-print"
    :class="{
      'help-floating-button--modern': isModernTheme,
      'help-floating-button--active': isOpen
    }"
    type="button"
    :title="isOpen ? 'Закрыть помощь' : 'Помощь'"
    @click="$emit('toggle')"
  >
    <span class="help-floating-button__icon">{{ isOpen ? '✕' : '?' }}</span>
  </button>
</template>

<style scoped>
.help-floating-button {
  position: fixed;
  left: 24px;
  bottom: 24px;
  z-index: 1800;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 1.5px solid rgba(0, 0, 0, 0.12);
  background: rgba(255, 255, 255, 0.92);
  color: #1a1a2e;
  font-size: 22px;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(6px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  transition: box-shadow 0.2s ease, background 0.2s ease, color 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
  user-select: none;
}

.help-floating-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
  background: #ffc107;
  color: #000;
  border-color: rgba(255, 193, 7, 0.8);
}

.help-floating-button--active {
  background: #ffc107;
  color: #000;
  border-color: rgba(255, 193, 7, 0.8);
}

.help-floating-button--modern {
  border-color: rgba(104, 171, 255, 0.45);
  background: rgba(32, 44, 68, 0.9);
  color: #e5f3ff;
  box-shadow: 0 4px 16px rgba(6, 11, 21, 0.55);
}

.help-floating-button--modern:hover {
  box-shadow: 0 8px 24px rgba(255, 193, 7, 0.4);
  background: #ffc107;
  color: #000;
  border-color: rgba(255, 193, 7, 0.85);
}

.help-floating-button--modern.help-floating-button--active {
  background: #ffc107;
  color: #000;
  border-color: rgba(255, 193, 7, 0.85);
}

.help-floating-button__icon {
  line-height: 1;
  font-family: Inter, system-ui, -apple-system, sans-serif;
}

/* Mobile: поднимаем выше MobileToolbar */
@media (max-width: 768px) {
  .help-floating-button {
    left: 8px;
    bottom: 72px;
  }
}
</style>
