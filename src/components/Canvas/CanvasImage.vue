<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  image: {
    type: Object,
    required: true
  },
  isSelected: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['image-click', 'start-drag'])

const isDragging = ref(false)

const imageStyle = computed(() => ({
  position: 'absolute',
  left: `${props.image.x}px`,
  top: `${props.image.y}px`,
  width: `${props.image.width}px`,
  height: `${props.image.height}px`,
  transform: `rotate(${props.image.rotation || 0}deg)`,
  opacity: props.image.opacity || 1,
  zIndex: props.image.zIndex || 0,
  cursor: props.image.isLocked ? 'default' : 'move',
  pointerEvents: props.image.isLocked ? 'none' : 'auto',
  userSelect: 'none'
}))

const containerClass = computed(() => ({
  'canvas-image': true,
  'canvas-image--selected': props.isSelected,
  'canvas-image--dragging': isDragging.value,
  'canvas-image--locked': props.image.isLocked
}))

function handleClick(event) {
  if (props.image.isLocked) return
  emit('image-click', { event, imageId: props.image.id })
}

function handleMouseDown(event) {
  if (props.image.isLocked) return

  // Предотвращаем выделение текста
  event.preventDefault()

  isDragging.value = true

  emit('start-drag', {
    event,
    imageId: props.image.id,
    type: 'image'
  })
}

function handleMouseUp() {
  isDragging.value = false
}

// Предотвращаем drag&drop браузера
function handleDragStart(event) {
  event.preventDefault()
  return false
}
</script>

<template>
  <div
    :class="containerClass"
    :style="imageStyle"
    :data-image-id="image.id"
    @click="handleClick"
    @mousedown="handleMouseDown"
    @mouseup="handleMouseUp"
    @dragstart="handleDragStart"
  >
    <img
      :src="image.dataUrl"
      :alt="image.name"
      :style="{
        width: '100%',
        height: '100%',
        display: 'block',
        objectFit: 'contain',
        pointerEvents: 'none',
        userSelect: 'none'
      }"
      draggable="false"
    />

    <!-- Рамка выделения -->
    <div
      v-if="isSelected && !image.isLocked"
      class="canvas-image__selection-border"
    />
  </div>
</template>

<style scoped>
.canvas-image {
  position: absolute;
  transition: opacity 0.2s ease;
}

.canvas-image--dragging {
  opacity: 0.7;
  cursor: grabbing !important;
}

.canvas-image--locked {
  cursor: default !important;
  opacity: 0.6;
}

.canvas-image--selected .canvas-image__selection-border {
  position: absolute;
  top: -2px;
  left: -2px;
  right: -2px;
  bottom: -2px;
  border: 2px solid #3b82f6;
  border-radius: 4px;
  pointer-events: none;
  box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.2);
}

.canvas-image img {
  -webkit-user-drag: none;
  -khtml-user-drag: none;
  -moz-user-drag: none;
  -o-user-drag: none;
  user-drag: none;
}
</style>
