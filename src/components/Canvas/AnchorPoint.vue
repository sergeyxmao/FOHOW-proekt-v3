<script setup>
import { computed } from 'vue'
import { useBoardStore } from '../../stores/board.js'
  
const props = defineProps({
  anchor: {
    type: Object,
    required: true
  },
  isSelected: {
    type: Boolean,
    default: false
  }
})
  
const boardStore = useBoardStore()
  
const emit = defineEmits(['select'])
const isAnimating = computed(() => boardStore.animatingAnchorId === props.anchor.id)

const handleClick = (event) => {
  event.stopPropagation()
  emit('select', props.anchor.id)
}
</script>

<template>
  <div
    class="anchor-point"
    :class="{ 'anchor-point--selected': isSelected }"
    :style="{ left: `${(anchor?.pos_x ?? anchor?.x ?? 0) - 6}px`, top: `${(anchor?.pos_y ?? anchor?.y ?? 0) - 6}px` }"
    @click="handleClick"
  >
    <div v-if="isAnimating" class="anchor-point__ripple">
      <span class="ripple-circle ripple-1"></span>
      <span class="ripple-circle ripple-2"></span>
      <span class="ripple-circle ripple-3"></span>
    </div>
  </div>
</template>

<style scoped>
.anchor-point {
  position: absolute;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ffcc00;
  border: 2px solid #000000;
  box-sizing: border-box;
  cursor: pointer;
  z-index: 8;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  animation: anchor-pop 0.28s ease;
  overflow: visible;  
}

.anchor-point:hover {
  transform: scale(1.1);
  box-shadow: 0 0 0 4px rgba(255, 204, 0, 0.35);
}

.anchor-point--selected {
  box-shadow: 0 0 0 4px rgba(0, 0, 0, 0.25);
}
.anchor-point__ripple {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.ripple-circle {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 36px;
  height: 36px;
  border: 2px solid #667eea;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  animation: ripple-expand 3s ease-out forwards;
  opacity: 0;
}

.ripple-1 { animation-delay: 0s; }
.ripple-2 { animation-delay: 0.6s; }
.ripple-3 { animation-delay: 1.2s; }
@keyframes anchor-pop {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.3);
  }
  100% {
    transform: scale(1);
  }
}

@keyframes ripple-expand {
  0% {
    width: 36px;
    height: 36px;
    opacity: 0.75;
  }
  100% {
    width: 120px;
    height: 120px;
    opacity: 0;
  }
}  
</style>
