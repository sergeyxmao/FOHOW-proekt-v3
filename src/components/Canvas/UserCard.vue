<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  userCard: {
    type: Object,
    required: true
  },
  isSelected: {
    type: Boolean,
    default: false
  },
  isAnimated: {
    type: Boolean,
    default: false
  },  
  isDrawingLine: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits([
  'user-card-click',
  'user-card-dblclick',
  'start-drag',
  'connection-point-click'
])

const ignoreNextClick = ref(false)

const userCardStyle = computed(() => {
  const diameter = props.userCard.diameter || 418

  return {
    position: 'absolute',
    left: `${props.userCard.x}px`,
    top: `${props.userCard.y}px`,
    width: `${diameter}px`,
    height: 'auto'
  }
})

const shapeStyle = computed(() => {
  const diameter = props.userCard.diameter || 418

  return {
    position: 'relative',
    width: `${diameter}px`,
    height: `${diameter}px`
  }
})

const circleStyle = computed(() => {
  const diameter = props.userCard.diameter || 418
  const strokeWidth = adaptiveStrokeWidth.value
  const stroke = props.userCard.stroke || '#5D8BF4'

  return {
    width: `${diameter}px`,
    height: `${diameter}px`,
    borderRadius: '50%',
    border: `${strokeWidth}px solid ${stroke}`,
    backgroundColor: '#ffffff',
    overflow: 'hidden',
    position: 'relative',
    boxShadow: props.isSelected ? '0 0 0 3px rgba(93, 139, 244, 0.3)' : 'none',
    transition: 'all 0.2s ease'
  }
})
const ringSize = computed(() => props.userCard.diameter || 418)
const ringStrokeWidth = computed(() => Math.max(3, (props.userCard.strokeWidth || 3) * 1.6))
const ringRadius = computed(() => ringSize.value / 2 - ringStrokeWidth.value - 2)

const imageStyle = computed(() => {
  return {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block'
  }
})

const handleUserCardClick = (event) => {
  event.stopPropagation()

  if (ignoreNextClick.value) {
    ignoreNextClick.value = false
    return
  }

  emit('user-card-click', event, props.userCard.id)
}

const handleUserCardDblClick = (event) => {
  event.stopPropagation()
  emit('user-card-dblclick', event, props.userCard.id)
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

    emit('user-card-click', event, props.userCard.id)
    return
  }

  emit('start-drag', event, props.userCard.id)
}

// Определение 10 точек соединения с углами (0°, 40°, 80°, 120°, 160°, 180°, 200°, 240°, 280°, 320°)
const connectionPoints = computed(() => {
  const diameter = props.userCard.diameter || 418
  const radius = diameter / 2
  const offset = 5 // Отступ точки от края

  const points = [
    { index: 1, angle: 0, name: 'top', size: 16 },           // 12 часов
    { index: 2, angle: 40, name: 'top-right-1', size: 8 },   // ~1:20
    { index: 3, angle: 80, name: 'right-top', size: 8 },     // ~2:40
    { index: 4, angle: 120, name: 'right-bottom', size: 8 }, // 4 часа
    { index: 5, angle: 160, name: 'bottom-right', size: 8 }, // ~5:20
    { index: 6, angle: 180, name: 'bottom', size: 16 },      // 6 часов
    { index: 7, angle: 200, name: 'bottom-left', size: 8 },  // ~6:40
    { index: 8, angle: 240, name: 'left-bottom', size: 8 },  // 8 часов
    { index: 9, angle: 280, name: 'left-top', size: 8 },     // ~9:20
    { index: 10, angle: 320, name: 'top-left', size: 8 }     // ~10:40
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
    userCardId: props.userCard.id,
    pointIndex,
    pointAngle,
    event
  })
}

const shouldShowConnectionPoints = computed(() => {
  return props.isSelected || props.isDrawingLine
})

// Вычисление размера шрифта для имени пользователя в зависимости от размера карточки
const usernameFontSize = computed(() => {
  const size = props.userCard.size || 100

  if (size <= 25) return '10px'
  if (size <= 50) return '12px'
  if (size <= 75) return '14px'
  return '16px'
})

// Вычисление ширины обводки в зависимости от размера карточки
const adaptiveStrokeWidth = computed(() => {
  const size = props.userCard.size || 100
  const baseStrokeWidth = props.userCard.strokeWidth || 3

  if (size <= 25) return Math.max(2, baseStrokeWidth - 1)
  if (size <= 50) return baseStrokeWidth
  return baseStrokeWidth
})

const handleImageError = (event) => {
  event.target.src = '/Avatar.png'
}
</script>

<template>
  <div
    class="user-card-object"
    :class="{ 'user-card-highlight': userCard.highlighted, 'user-card--animated': isAnimated }"
    :style="userCardStyle"
    :data-user-card-id="userCard.id"
    @click="handleUserCardClick"
    @dblclick="handleUserCardDblClick"
    @pointerdown="handlePointerDown"
  >
    <div class="user-card-shape" :style="shapeStyle">
      <div class="user-card-circle" :style="circleStyle">
        <img
          :src="userCard.avatarUrl || '/Avatar.png'"
          :alt="userCard.username || 'Avatar'"
          :style="imageStyle"
          @error="handleImageError"
        />
      </div>

      <!-- 10 точек соединения равномерно распределены по кругу -->
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
        :data-user-card-id="userCard.id"
        :data-point-index="point.index"
        :data-point-angle="point.angle"
        @click="handleConnectionPointClick($event, point.index, point.angle)"
        @pointerdown.stop
      ></div>

      <svg
        class="user-card-connection-ring"
        :class="{ 'user-card-connection-ring--active': isAnimated }"
        :width="ringSize"
        :height="ringSize"
        :viewBox="`0 0 ${ringSize} ${ringSize}`"
        aria-hidden="true"
      >
        <circle
          class="user-card-connection-ring__circle"
          :cx="ringSize / 2"
          :cy="ringSize / 2"
          :r="ringRadius"
          :stroke-width="ringStrokeWidth"
        />
      </svg>
    </div>

    <div
      v-if="userCard.username"
      class="user-card-username"
      :style="{ fontSize: usernameFontSize }"
    >
      {{ userCard.username }}
    </div>
  </div>
</template>

<style scoped>
.user-card-object {
  cursor: move;
  user-select: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  z-index: 10;
}
.user-card-shape {
  position: relative;
}

.user-card-circle {
  display: flex;
  align-items: center;
  justify-content: center;
}

.user-card-username {
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
  transform: scale(1);
  transition: opacity 0.2s ease, transform 0.2s ease;
  pointer-events: none;
  z-index: 20;
}
.user-card-connection-ring {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 12;
  transform-origin: center;
}

.user-card-connection-ring__circle {
  fill: none;
  stroke: var(--user-card-animation-color, rgb(var(--user-card-animation-color-rgb, 93, 139, 244)));
  stroke-dasharray: 18 12;
  stroke-linecap: round;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.user-card-connection-ring--active .user-card-connection-ring__circle {
  opacity: 1;
  animation: user-card-ring-flow calc(var(--user-card-animation-duration, 2000ms) / 1.6) linear infinite;
}
/* Показать точки при наведении на карточку */
.user-card-object:hover .connection-point,
.connection-point--visible {
  opacity: 1;
  pointer-events: auto;
}
.user-card-object:hover .connection-point {
  transform: scale(1.25);
}
.user-card-highlight {
  animation: user-card-pulse 2s ease-in-out;
  box-shadow: 0 0 0 4px rgba(var(--user-card-animation-color-rgb, 93, 139, 244), 0.8) !important;
  z-index: 1000 !important;
}

.user-card-object.user-card--animated .user-card-shape {
  position: relative;
}
.user-card-object.user-card--animated .user-card-shape::before {
  content: '';
  position: absolute;
  inset: -14px;
  border-radius: 50%;
  pointer-events: none;
  border: 2px solid rgba(var(--user-card-animation-color-rgb, 93, 139, 244), 0.55);
  animation: user-card-pulse-slow calc(var(--user-card-animation-duration, 2000ms) * 1.6) ease-in-out infinite;
  z-index: 4;
  transform-origin: center;
}
.user-card-object.user-card--animated .user-card-circle {
  border-color: rgba(var(--user-card-animation-color-rgb, 93, 139, 244), 1);
}

.user-card-object.user-card--animated .user-card-shape::after {
  content: '';
  position: absolute;
  inset: -6px;
  border-radius: 50%;
  pointer-events: none;
  box-shadow: 0 0 18px rgba(var(--user-card-animation-color-rgb, 93, 139, 244), 0.9);
  border: 3px solid rgba(var(--user-card-animation-color-rgb, 93, 139, 244), 1);
  animation: user-card-glow var(--user-card-animation-duration, 2s) ease-in-out infinite;
  z-index: 5;
}

@keyframes user-card-pulse-slow {
  0% {
    transform: scale(0.92);
    opacity: 0.65;
  }
  50% {
    transform: scale(1.08);
    opacity: 0.2;
  }
  100% {
    transform: scale(0.92);
    opacity: 0.65;
  }
}

@keyframes user-card-glow {
  0%, 100% {
    box-shadow: 0 0 10px rgba(var(--user-card-animation-color-rgb, 93, 139, 244), 0.6);
  }
  50% {
    box-shadow: 0 0 18px rgba(var(--user-card-animation-color-rgb, 93, 139, 244), 0.9);
  }
}

@keyframes user-card-ring-flow {
  from {
    stroke-dashoffset: 0;
  }
  to {
    stroke-dashoffset: -64;
  }
}
@keyframes user-card-pulse {
  0%, 100% {
    box-shadow: 0 0 0 4px rgba(var(--user-card-animation-color-rgb, 93, 139, 244), 0.8);
  }
  50% {
    box-shadow: 0 0 0 12px rgba(var(--user-card-animation-color-rgb, 93, 139, 244), 0.3);
  }
}
</style>
