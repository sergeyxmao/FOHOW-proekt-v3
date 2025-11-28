<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  avatar: {
    type: Object,
    required: true
  },
  isSelected: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits([
  'avatar-click',
  'start-drag'
])

const ignoreNextClick = ref(false)

const avatarStyle = computed(() => {
  const diameter = props.avatar.diameter || 418
  const strokeWidth = props.avatar.strokeWidth || 3

  return {
    position: 'absolute',
    left: `${props.avatar.x}px`,
    top: `${props.avatar.y}px`,
    width: `${diameter}px`,
    height: `${diameter}px`
  }
})

const circleStyle = computed(() => {
  const diameter = props.avatar.diameter || 418
  const strokeWidth = props.avatar.strokeWidth || 3
  const stroke = props.avatar.stroke || '#5D8BF4'

  return {
    width: `${diameter}px`,
    height: `${diameter}px`,
    borderRadius: '50%',
    border: `${strokeWidth}px solid ${stroke}`,
    backgroundColor: '#ffffff',
    overflow: 'hidden',
    position: 'relative',
    boxShadow: props.isSelected ? '0 0 0 3px rgba(93, 139, 244, 0.3)' : 'none',
    transition: 'box-shadow 0.2s ease'
  }
})

const imageStyle = computed(() => {
  return {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block'
  }
})

const handleAvatarClick = (event) => {
  event.stopPropagation()

  if (ignoreNextClick.value) {
    ignoreNextClick.value = false
    return
  }

  emit('avatar-click', event, props.avatar.id)
}

const handlePointerDown = (event) => {
  if (event.target.classList.contains('connection-point')) {
    return
  }

  if (event.ctrlKey || event.metaKey) {
    event.stopPropagation()
    ignoreNextClick.value = true

    const clearIgnoreFlag = () => {
      setTimeout(() => {
        ignoreNextClick.value = false
      }, 0)
      window.removeEventListener('pointerup', clearIgnoreFlag)
      window.removeEventListener('pointercancel', clearIgnoreFlag)
    }

    window.addEventListener('pointerup', clearIgnoreFlag, { once: true })
    window.addEventListener('pointercancel', clearIgnoreFlag, { once: true })

    emit('avatar-click', event, props.avatar.id)
    return
  }

  emit('start-drag', event, props.avatar.id)
}
</script>

<template>
  <div
    class="avatar-object"
    :style="avatarStyle"
    @click="handleAvatarClick"
    @pointerdown="handlePointerDown"
  >
    <div class="avatar-circle" :style="circleStyle">
      <img
        :src="avatar.avatarUrl || '/Avatar.png'"
        :alt="avatar.username || 'Avatar'"
        :style="imageStyle"
      />
    </div>

    <div v-if="avatar.username" class="avatar-username">
      {{ avatar.username }}
    </div>

    <!-- 9 точек соединения (будут реализованы в Шаге 2) -->
    <!-- Пока оставляем заглушки для будущей реализации -->
    <template v-if="false">
      <div class="connection-point connection-point--top"></div>
      <div class="connection-point connection-point--top-right"></div>
      <div class="connection-point connection-point--right"></div>
      <div class="connection-point connection-point--bottom-right"></div>
      <div class="connection-point connection-point--bottom"></div>
      <div class="connection-point connection-point--bottom-left"></div>
      <div class="connection-point connection-point--left"></div>
      <div class="connection-point connection-point--top-left"></div>
      <div class="connection-point connection-point--center"></div>
    </template>
  </div>
</template>

<style scoped>
.avatar-object {
  cursor: move;
  user-select: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  z-index: 10;
}

.avatar-circle {
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-username {
  margin-top: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
  text-align: center;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 0 8px;
}

/* Точки соединения (будут использоваться в Шаге 2) */
.connection-point {
  position: absolute;
  width: 12px;
  height: 12px;
  background-color: #5D8BF4;
  border: 2px solid #ffffff;
  border-radius: 50%;
  cursor: crosshair;
  opacity: 0;
  transition: opacity 0.2s ease;
  pointer-events: none;
}

.avatar-object:hover .connection-point {
  opacity: 1;
  pointer-events: auto;
}

.connection-point--top {
  top: -6px;
  left: 50%;
  transform: translateX(-50%);
}

.connection-point--top-right {
  top: 10%;
  right: 10%;
}

.connection-point--right {
  top: 50%;
  right: -6px;
  transform: translateY(-50%);
}

.connection-point--bottom-right {
  bottom: 10%;
  right: 10%;
}

.connection-point--bottom {
  bottom: -6px;
  left: 50%;
  transform: translateX(-50%);
}

.connection-point--bottom-left {
  bottom: 10%;
  left: 10%;
}

.connection-point--left {
  top: 50%;
  left: -6px;
  transform: translateY(-50%);
}

.connection-point--top-left {
  top: 10%;
  left: 10%;
}

.connection-point--center {
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}
</style>
