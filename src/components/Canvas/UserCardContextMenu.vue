<script setup>
import { computed, onMounted, onBeforeUnmount } from 'vue'
import { useCardsStore } from '../../stores/cards'

const props = defineProps({
  userCard: {
    type: Object,
    required: true
  },
  position: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['close'])

const cardsStore = useCardsStore()

// Обработчик нажатия клавиши Escape
const handleKeyDown = (event) => {
  if (event.key === 'Escape') {
    emit('close')
  }
}

// Добавляем обработчик при монтировании
onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})

// Удаляем обработчик при размонтировании
onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeyDown)
})

// Текущий размер карточки
const currentSize = computed(() => props.userCard.size || 100)

// Размеры в процентах
const sizes = [
  { percent: 25, label: 'x25%', diameter: 104.5 },
  { percent: 50, label: 'x50%', diameter: 209 },
  { percent: 75, label: 'x75%', diameter: 313.5 },
  { percent: 100, label: 'x100%', diameter: 418 },
  { percent: 125, label: 'x125%', diameter: 522.5 },
  { percent: 150, label: 'x150%', diameter: 627 },
  { percent: 175, label: 'x175%', diameter: 731.5 },
  { percent: 200, label: 'x200%', diameter: 836 }]

// Обработчик изменения размера
const setSize = (sizePercent) => {
  cardsStore.resizeUserCard(props.userCard.id, sizePercent)
  emit('close')
}

// Закрытие меню при клике вне его
const handleClickOutside = () => {
  emit('close')
}
</script>

<template>
  <div
    class="context-menu-overlay"
    @click="handleClickOutside"
    @contextmenu.prevent
  >
    <div
      class="user-card-context-menu"
      :style="{
        left: position.x + 'px',
        top: position.y + 'px'
      }"
      @click.stop
    >
      <!-- Секция: Размер -->
      <div class="context-menu-section">
        <div class="context-menu-header">Размер карточки</div>

        <div
          v-for="size in sizes"
          :key="size.percent"
          class="context-menu-item"
          :class="{ active: currentSize === size.percent }"
          @click="setSize(size.percent)"
        >
          <span class="menu-icon">{{ currentSize === size.percent ? '✓' : '○' }}</span>
          <span class="size-label">{{ size.label }}</span>
          <span class="size-diameter">({{ size.diameter }}px)</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.context-menu-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: transparent;
}

.user-card-context-menu {
  position: fixed;
  z-index: 10000;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
  padding: 8px;
  min-width: 200px;
  max-width: 250px;
}

.context-menu-section {
  padding: 0;
}

.context-menu-header {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #9ca3af;
  padding: 6px 12px;
  margin-bottom: 4px;
}

.context-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  cursor: pointer;
  font-size: 14px;
  color: #374151;
  border-radius: 6px;
  transition: all 0.15s ease;
  min-height: 40px;
}

.context-menu-item:hover {
  background-color: #f5f5f5;
}

.context-menu-item.active {
  background-color: #5D8BF4;
  color: #ffffff;
  font-weight: 600;
}

.context-menu-item.active .menu-icon {
  transform: scale(1.2);
  color: #ffffff;
}

.context-menu-item.active .size-diameter {
  color: rgba(255, 255, 255, 0.8);
}

.menu-icon {
  font-size: 16px;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: transform 0.15s ease;
  color: #5D8BF4;
}

.size-label {
  font-weight: 600;
  flex: 0 0 auto;
}

.size-diameter {
  font-size: 12px;
  color: #9ca3af;
  margin-left: auto;
}
</style>
