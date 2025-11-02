<script setup>
import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useBoardStore } from '@/stores/board'
import { useCardsStore } from '@/stores/cards'

const props = defineProps({
  isModernTheme: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits([
  'save',
  'add-license',
  'add-lower',
  'add-gold',
  'add-template'
])

const authStore = useAuthStore()
const boardStore = useBoardStore()
const cardsStore = useCardsStore()

const isSaving = computed(() => boardStore.isSaving)

const handleSave = () => {
  emit('save')
}

const handleAddLicense = () => {
  emit('add-license')
}

const handleAddLower = () => {
  emit('add-lower')
}

const handleAddGold = () => {
  emit('add-gold')
}

const handleAddTemplate = () => {
  emit('add-template')
}

const openMarketingLink = () => {
  window.open('https://t.me/marketingFohow', '_blank')
}
</script>

<template>
  <div class="mobile-toolbar" :class="{ 'mobile-toolbar--dark': isModernTheme }">
    <!-- Левый нижний угол: @marketingFohow -->
    <a
      href="https://t.me/marketingFohow"
      target="_blank"
      rel="noopener noreferrer"
      class="mobile-toolbar-button marketing-button"
      @click.prevent="openMarketingLink"
    >
      <span class="marketing-icon">✈️</span>
      <span class="marketing-text">@marketingFohow</span>
    </a>

    <!-- Центральные кнопки: добавление карточек -->
    <div class="mobile-toolbar-center">
      <button
        class="mobile-toolbar-button add-button"
        type="button"
        @click="handleAddLicense"
        title="Добавить лицензию"
      >
        <span class="add-icon">📜</span>
      </button>

      <button
        class="mobile-toolbar-button add-button"
        type="button"
        @click="handleAddLower"
        title="Добавить более низкую"
      >
        <span class="add-icon">📊</span>
      </button>

      <button
        class="mobile-toolbar-button add-button"
        type="button"
        @click="handleAddGold"
        title="Добавить Gold"
      >
        <span class="add-icon">⭐</span>
      </button>

      <button
        class="mobile-toolbar-button add-button"
        type="button"
        @click="handleAddTemplate"
        title="Добавить шаблон"
      >
        <span class="add-icon">📋</span>
      </button>
    </div>

    <!-- Правый нижний угол: кнопка сохранения (только иконка) -->
    <button
      v-if="authStore.isAuthenticated"
      class="mobile-toolbar-button save-button"
      type="button"
      :disabled="isSaving"
      @click="handleSave"
      title="Сохранить"
    >
      <span class="save-icon">💾</span>
    </button>
  </div>
</template>

<style scoped>
.mobile-toolbar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 68px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-top: 1px solid rgba(0, 0, 0, 0.08);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  z-index: 1000;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.06);
}

.mobile-toolbar--dark {
  background: rgba(28, 38, 58, 0.95);
  border-top-color: rgba(255, 255, 255, 0.1);
  color: #e5f3ff;
}

.mobile-toolbar-button {
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.04);
  color: #111827;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
  text-decoration: none;
}

.mobile-toolbar--dark .mobile-toolbar-button {
  background: rgba(255, 255, 255, 0.08);
  color: #e5f3ff;
}

.mobile-toolbar-button:active:not(:disabled) {
  transform: scale(0.95);
}

.mobile-toolbar-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Кнопка маркетинга */
.marketing-button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: linear-gradient(135deg, #0088cc 0%, #0066a1 100%);
  color: #ffffff;
  font-size: 13px;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(0, 136, 204, 0.3);
}

.marketing-icon {
  font-size: 18px;
}

.marketing-text {
  white-space: nowrap;
}

/* Центральная группа кнопок */
.mobile-toolbar-center {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0 8px;
}

.add-button {
  width: 48px;
  height: 48px;
  background: rgba(15, 98, 254, 0.1);
}

.mobile-toolbar--dark .add-button {
  background: rgba(59, 130, 246, 0.2);
}

.add-button:active {
  background: rgba(15, 98, 254, 0.2);
}

.mobile-toolbar--dark .add-button:active {
  background: rgba(59, 130, 246, 0.3);
}

.add-icon {
  font-size: 24px;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1));
}

/* Кнопка сохранения */
.save-button {
  width: 52px;
  height: 52px;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: #ffffff;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

.save-button:active:not(:disabled) {
  transform: scale(0.95);
  box-shadow: 0 2px 6px rgba(16, 185, 129, 0.4);
}

.save-button:disabled {
  background: #9ca3af;
  box-shadow: none;
}

.save-icon {
  font-size: 26px;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.2));
}

/* Адаптация для маленьких экранов */
@media (max-width: 480px) {
  .mobile-toolbar {
    height: 64px;
    padding: 0 8px;
  }

  .marketing-button {
    padding: 8px 12px;
    font-size: 12px;
  }

  .marketing-icon {
    font-size: 16px;
  }

  .add-button {
    width: 44px;
    height: 44px;
  }

  .add-icon {
    font-size: 22px;
  }

  .save-button {
    width: 48px;
    height: 48px;
  }

  .save-icon {
    font-size: 24px;
  }

  .mobile-toolbar-center {
    gap: 6px;
    padding: 0 6px;
  }
}

/* Адаптация для очень маленьких экранов */
@media (max-width: 360px) {
  .marketing-text {
    display: none;
  }

  .marketing-button {
    width: 44px;
    height: 44px;
    padding: 0;
  }

  .marketing-icon {
    font-size: 20px;
  }

  .mobile-toolbar-center {
    gap: 4px;
    padding: 0 4px;
  }

  .add-button {
    width: 40px;
    height: 40px;
  }

  .add-icon {
    font-size: 20px;
  }

  .save-button {
    width: 44px;
    height: 44px;
  }

  .save-icon {
    font-size: 22px;
  }
}
</style>
