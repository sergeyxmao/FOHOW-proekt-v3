<script setup>
import { computed } from 'vue'

const props = defineProps({
  isModernTheme: {
    type: Boolean,
    default: false
  },
  isDesktop: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['stay-mobile', 'switch-desktop', 'close'])
const dialogTitle = computed(() => (props.isDesktop ? 'Режим ПК' : 'Мобильная версия'))
</script>

<template>
  <div class="mobile-version-dialog" role="dialog" aria-modal="true">
    <div
      :class="[
        'mobile-version-dialog__content',
        { 'mobile-version-dialog__content--modern': props.isModernTheme }
      ]"
    >
      <button
        type="button"
        class="mobile-version-dialog__close"
        aria-label="Закрыть уведомление"
        @click="$emit('close')"
      >
        ✕
      </button>
      <h2 class="mobile-version-dialog__title">{{ dialogTitle }}</h2>
      <p class="mobile-version-dialog__text">
        Вы используете облегчённую мобильную версию интерфейса. Часть функций недоступна. Для полного набора инструментов переключитесь в режим ПК.
      </p>
      <div class="mobile-version-dialog__actions">
        <button
          type="button"
          class="mobile-version-dialog__action"
          title="Оставаться в мобильной версии"
          @click="$emit('stay-mobile')"
        >
          📱
          <span class="visually-hidden">Оставаться в мобильной версии</span>
        </button>
        <button
          type="button"
          class="mobile-version-dialog__action mobile-version-dialog__action--desktop"
          title="Переключиться на версию для ПК"
          @click="$emit('switch-desktop')"
        >
          💻
          <span class="visually-hidden">Переключиться на версию для ПК</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mobile-version-dialog {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(15, 23, 42, 0.55);
  z-index: 2300;
}

.mobile-version-dialog__content {
  position: relative;
  width: min(90%, 420px);
  padding: 28px 24px 24px;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.96);
  color: #0f172a;
  text-align: center;
  box-shadow: 0 28px 64px rgba(15, 23, 42, 0.35);
}

.mobile-version-dialog__content--modern {
  background: rgba(24, 34, 58, 0.95);
  color: #e5f3ff;
  box-shadow: 0 34px 72px rgba(6, 11, 21, 0.62);
}

.mobile-version-dialog__close {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 36px;
  height: 36px;
  border-radius: 12px;
  border: none;
  background: rgba(15, 23, 42, 0.08);
  color: inherit;
  font-size: 18px;
  cursor: pointer;
  transition: transform 0.2s ease, background 0.2s ease;
}

.mobile-version-dialog__close:hover {
  transform: translateY(-2px);
  background: rgba(59, 130, 246, 0.15);
}

.mobile-version-dialog__title {
  margin: 0 0 12px;
  font-size: 22px;
  font-weight: 700;
}

.mobile-version-dialog__text {
  margin: 0 0 20px;
  font-size: 15px;
  line-height: 1.6;
}

.mobile-version-dialog__actions {
  display: flex;
  justify-content: center;
  gap: 18px;
}

.mobile-version-dialog__action {
  width: 64px;
  height: 64px;
  border-radius: 18px;
  border: 1px solid rgba(15, 23, 42, 0.12);
  background: rgba(255, 255, 255, 0.92);
  font-size: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 18px 42px rgba(15, 23, 42, 0.25);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.mobile-version-dialog__action:hover {
  transform: translateY(-2px);
  box-shadow: 0 26px 54px rgba(15, 23, 42, 0.32);
}

.mobile-version-dialog__action--desktop {
  background: #0f62fe;
  color: #ffffff;
}

.mobile-version-dialog__content--modern .mobile-version-dialog__action {
  border-color: rgba(114, 182, 255, 0.35);
  background: rgba(24, 34, 58, 0.92);
  color: #e5f3ff;
  box-shadow: 0 22px 52px rgba(6, 11, 21, 0.62);
}

.mobile-version-dialog__content--modern .mobile-version-dialog__action--desktop {
  background: #0f62fe;
  color: #ffffff;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
