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
  },
  isDrawingLine: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits([
  'avatar-click',
  'start-drag',
  'connection-point-click'
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

// Определение 9 точек соединения с углами (0°, 40°, 80°, 120°, 160°, 200°, 240°, 280°, 320°)
const connectionPoints = computed(() => {
  const diameter = props.avatar.diameter || 418
  const radius = diameter / 2
  const offset = 5 // Отступ точки от края

  const points = [
    { index: 1, angle: 0, name: 'top', size: 16 },           // 12 часов
    { index: 2, angle: 40, name: 'top-right-1', size: 8 },   // ~1:20
    { index: 3, angle: 80, name: 'right-top', size: 8 },     // ~2:40
    { index: 4, angle: 120, name: 'right-bottom', size: 8 }, // 4 часа
    { index: 5, angle: 160, name: 'bottom-right', size: 8 }, // ~5:20
    { index: 6, angle: 200, name: 'bottom-left', size: 8 },  // ~6:40
    { index: 7, angle: 240, name: 'left-bottom', size: 8 },  // 8 часов
    { index: 8, angle: 280, name: 'left-top', size: 8 },     // ~9:20
    { index: 9, angle: 320, name: 'top-left', size: 8 }      // ~10:40
  ]

  return points.map(point => {
    const angleRad = point.angle * Math.PI / 180
    const centerX = diameter / 2
    const centerY = diameter / 2

    const pointX = centerX + (radius + offset) * Math.sin(angleRad)
    const pointY = centerY - (radius + offset) * Math.cos(angleRad)

    return {
      ...point,
      x: pointX - point.size / 2,
      y: pointY - point.size / 2
    }
  })
})

const handleConnectionPointClick = (event, pointIndex, pointAngle) => {
  event.stopPropagation()
  emit('connection-point-click', {
    avatarId: props.avatar.id,
    pointIndex,
    pointAngle,
    event
  })
}

const shouldShowConnectionPoints = computed(() => {
  return props.isSelected || props.isDrawingLine
})
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

    <!-- 9 точек соединения равномерно распределены по кругу -->
    <div
      v-for="point in connectionPoints"
      :key="point.index"
      class="connection-point"
      :class="{ 'connection-point--visible': shouldShowConnectionPoints }"
      :style="{
        left: `${point.x}px`,
        top: `${point.y}px`,
        width: `${point.size}px`,
        height: `${point.size}px`
      }"
      :data-avatar-id="avatar.id"
      :data-point-index="point.index"
      :data-point-angle="point.angle"
      @click="handleConnectionPointClick($event, point.index, point.angle)"
      @pointerdown.stop
    ></div>
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

/* Точки соединения */
.connection-point {
  position: absolute;
  background-color: #5D8BF4;
  border: 2px solid #ffffff;
  border-radius: 50%;
  cursor: crosshair;
  opacity: 0;
  transition: opacity 0.2s ease;
  pointer-events: none;
  z-index: 20;
}

/* Показать точки при наведении на аватар */
.avatar-object:hover .connection-point,
.connection-point--visible {
  opacity: 1;
  pointer-events: auto;
}
</style>
