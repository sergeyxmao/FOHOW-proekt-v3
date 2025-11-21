<script setup>
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

const emit = defineEmits(['select'])

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
  ></div>
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
}

.anchor-point:hover {
  transform: scale(1.1);
  box-shadow: 0 0 0 4px rgba(255, 204, 0, 0.35);
}

.anchor-point--selected {
  box-shadow: 0 0 0 4px rgba(0, 0, 0, 0.25);
}

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
</style>
