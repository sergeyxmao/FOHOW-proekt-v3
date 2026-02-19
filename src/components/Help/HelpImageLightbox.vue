<script setup>
import { onMounted, onBeforeUnmount } from 'vue'

defineProps({
  src: {
    type: String,
    required: true
  },
  alt: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['close'])

function handleKeydown(e) {
  if (e.key === 'Escape') {
    emit('close')
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <Teleport to="body">
    <div class="help-lightbox" @click.self="$emit('close')">
      <button
        class="help-lightbox__close"
        type="button"
        title="Закрыть"
        @click="$emit('close')"
      >
        ✕
      </button>
      <img
        :src="src"
        :alt="alt"
        class="help-lightbox__img"
      />
    </div>
  </Teleport>
</template>

<style scoped>
.help-lightbox {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.help-lightbox__img {
  max-width: 90vw;
  max-height: 90vh;
  object-fit: contain;
  border-radius: 8px;
  cursor: default;
}

.help-lightbox__close {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 40px;
  height: 40px;
  border: none;
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
  font-size: 20px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s ease;
}

.help-lightbox__close:hover {
  background: rgba(255, 255, 255, 0.3);
}
</style>
