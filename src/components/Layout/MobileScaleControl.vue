<script setup>
import { computed } from 'vue'
import { useMobileStore } from '@/stores/mobile'
import { storeToRefs } from 'pinia'

const props = defineProps({
  isModernTheme: {
    type: Boolean,
    default: false
  }
})

const mobileStore = useMobileStore()
const { menuScale } = storeToRefs(mobileStore)

const handleIncreaseScale = () => {
  mobileStore.increaseMenuScale()
}

const handleDecreaseScale = () => {
  mobileStore.decreaseMenuScale()
}

const handleResetScale = () => {
  mobileStore.resetMenuScale()
}

const formattedScale = computed(() => {
  return Math.round(menuScale.value * 100)
})

const canIncrease = computed(() => menuScale.value < 2)
const canDecrease = computed(() => menuScale.value > 1)
</script>

<template>
  <div
    class="mobile-scale-control"
    :class="{ 'mobile-scale-control--dark': isModernTheme }"
  >
    <button
      class="scale-button scale-button--decrease"
      type="button"
      :disabled="!canDecrease"
      @click="handleDecreaseScale"
      title="Уменьшить масштаб панелей"
      aria-label="Уменьшить масштаб панелей"
    >
      <span class="scale-icon">−</span>
    </button>

    <button
      class="scale-button scale-button--reset"
      type="button"
      @click="handleResetScale"
      :title="`Масштаб панелей: ${formattedScale}%`"
      aria-label="Сбросить масштаб панелей"
    >
      <span class="scale-value">{{ formattedScale }}%</span>
    </button>

    <button
      class="scale-button scale-button--increase"
      type="button"
      :disabled="!canIncrease"
      @click="handleIncreaseScale"
      title="Увеличить масштаб панелей"
      aria-label="Увеличить масштаб панелей"
    >
      <span class="scale-icon">+</span>
    </button>
  </div>
</template>

<style scoped>
.mobile-scale-control {
  position: fixed;
  left: 8px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 900;
  padding: 8px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

.mobile-scale-control--dark {
  background: rgba(28, 38, 58, 0.95);
  border-color: rgba(255, 255, 255, 0.1);
}

.scale-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.98);
  color: #111827;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
  position: relative;
}

.mobile-scale-control--dark .scale-button {
  background: rgba(40, 50, 70, 0.98);
  border-color: rgba(255, 255, 255, 0.1);
  color: #e5f3ff;
}

.scale-button:active:not(:disabled) {
  transform: scale(0.95);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.scale-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.scale-button--increase,
.scale-button--decrease {
  background: linear-gradient(135deg, #0f62fe 0%, #0353e9 100%);
  color: #ffffff;
  border-color: rgba(15, 98, 254, 0.5);
  box-shadow: 0 2px 8px rgba(15, 98, 254, 0.3);
}

.mobile-scale-control--dark .scale-button--increase,
.mobile-scale-control--dark .scale-button--decrease {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
}

.scale-button--increase:disabled,
.scale-button--decrease:disabled {
  background: #9ca3af;
  border-color: rgba(156, 163, 175, 0.5);
  box-shadow: none;
}

.scale-icon {
  font-size: 28px;
  font-weight: 700;
  line-height: 1;
}

.scale-value {
  font-size: 13px;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
}

/* Анимация при изменении значения */
@keyframes pulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
}

.scale-button--reset:active {
  animation: pulse 0.3s ease;
}

/* Адаптация для маленьких экранов */
@media (max-width: 480px) {
  .mobile-scale-control {
    left: 6px;
    padding: 6px;
    gap: 6px;
  }

  .scale-button {
    width: 44px;
    height: 44px;
  }

  .scale-icon {
    font-size: 24px;
  }

  .scale-value {
    font-size: 12px;
  }
}

/* Для очень маленьких экранов */
@media (max-width: 360px) {
  .scale-button {
    width: 40px;
    height: 40px;
  }

  .scale-icon {
    font-size: 22px;
  }

  .scale-value {
    font-size: 11px;
  }
}
</style>
