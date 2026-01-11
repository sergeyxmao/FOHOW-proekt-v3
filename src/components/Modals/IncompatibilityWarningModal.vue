<script setup>
import { computed, onBeforeUnmount, onMounted } from 'vue'

const props = defineProps({
  type: {
    type: String,
    default: null
  }
})

const emit = defineEmits(['close'])

const message = computed(() => {
  if (props.type === 'user_card') {
    return 'На доске присутствуют лицензии. Карточки партнёров и лицензии не могут находиться на одной доске. Удалите лицензии или создайте новую доску.'
  }

  return 'На доске присутствуют карточки партнёров. Лицензии и карточки партнёров не могут находиться на одной доске. Удалите карточки партнёров или создайте новую доску.'
})

const handleOverlayClick = (event) => {
  if (event.target === event.currentTarget) {
    emit('close')
  }
}

const handleKeydown = (event) => {
  if (event.key === 'Escape') {
    emit('close')
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="modal-overlay" @click="handleOverlayClick">
    <div class="modal-window" role="dialog" aria-modal="true">
      <div class="modal-icon" aria-hidden="true">⚠️</div>
      <h3 class="modal-title">Несовместимые объекты</h3>
      <p class="modal-message">{{ message }}</p>
      <button type="button" class="modal-button" @click="emit('close')">
        ОК
      </button>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1200;
}

.modal-window {
  background: #ffffff;
  border-radius: 12px;
  width: 450px;
  max-width: calc(100% - 32px);
  padding: 24px;
  box-shadow: 0 20px 60px rgba(15, 23, 42, 0.25);
  text-align: center;
}

.modal-icon {
  font-size: 36px;
  margin-bottom: 16px;
}

.modal-title {
  font-size: 20px;
  font-weight: 700;
  color: #0f172a;
  margin: 0 0 12px;
}

.modal-message {
  font-size: 15px;
  color: #1f2937;
  margin: 0 0 20px;
  line-height: 1.6;
}

.modal-button {
  width: 100%;
  height: 44px;
  border: none;
  border-radius: 8px;
  background: #5d8bf4;
  color: #ffffff;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease;
}

.modal-button:hover {
  background: #4a78e0;
}

.modal-button:active {
  background: #3d68cc;
}
</style>
