<script setup>
import { computed } from 'vue'
import { useMobileStore } from '@/stores/mobile'

const props = defineProps({
  isModernTheme: {
    type: Boolean,
    default: false
  }
})

const mobileStore = useMobileStore()

const isMobileMode = computed(() => mobileStore.isMobileMode)

const handleToggleVersion = () => {
  if (isMobileMode.value) {
    mobileStore.switchToDesktop()
  } else {
    mobileStore.switchToMobile()
  }
}
</script>

<template>
  <button
    class="version-switcher"
    :class="{
      'version-switcher--dark': isModernTheme,
      'version-switcher--mobile': isMobileMode
    }"
    type="button"
    @click="handleToggleVersion"
    :title="isMobileMode ? 'Переключить на версию для ПК' : 'Переключить на мобильную версию'"
  >
    <span class="version-icon">{{ isMobileMode ? '💻' : '📱' }}</span>
  </button>
</template>

<style scoped>
.version-switcher {
  position: fixed;
  bottom: 100px;
  right: 24px;
  z-index: 1900;
  width: 56px;
  height: 56px;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  color: #111827;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  user-select: none;
  border: 2px solid rgba(0, 0, 0, 0.08);
}

.version-switcher--dark {
  background: rgba(28, 38, 58, 0.95);
  color: #e5f3ff;
  border-color: rgba(255, 255, 255, 0.1);
}

.version-switcher:hover {
  transform: scale(1.05);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.2);
}

.version-switcher:active {
  transform: scale(0.95);
}

.version-icon {
  font-size: 28px;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.15));
}

/* Mobile positioning */
.version-switcher--mobile {
  bottom: 90px;
  right: 12px;
  width: 52px;
  height: 52px;
}

.version-switcher--mobile .version-icon {
  font-size: 26px;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .version-switcher {
    bottom: 90px;
    right: 16px;
  }
}

@media (max-width: 480px) {
  .version-switcher {
    width: 48px;
    height: 48px;
  }

  .version-switcher .version-icon {
    font-size: 24px;
  }

  .version-switcher--mobile {
    bottom: 85px;
    right: 8px;
    width: 44px;
    height: 44px;
  }

  .version-switcher--mobile .version-icon {
    font-size: 22px;
  }
}
</style>
