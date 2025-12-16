<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import ObjectContextMenu from '../drawing/ObjectContextMenu.vue'

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

const emit = defineEmits(['image-click', 'start-drag', 'redraw'])

const isDragging = ref(false)
const contextMenu = ref({
  visible: false,
  x: 0,
  y: 0
})
const CONTEXT_MENU_DEFAULT_WIDTH = 200
const CONTEXT_MENU_DEFAULT_HEIGHT = 240
const CONTEXT_MENU_OFFSET = 12
const contextMenuSize = ref({
  width: CONTEXT_MENU_DEFAULT_WIDTH,
  height: CONTEXT_MENU_DEFAULT_HEIGHT
})
const contextMenuRef = ref(null)

const calculateContextMenuPosition = (clientX, clientY) => {
  const menuWidth = contextMenuSize.value.width
  const menuHeight = contextMenuSize.value.height

  // Горизонтальное позиционирование
  const availableRight = window.innerWidth - clientX
  const availableLeft = clientX
  const placeLeft = availableRight < menuWidth + CONTEXT_MENU_OFFSET

  let x
  if (placeLeft) {
    // Пытаемся разместить слева от курсора
    x = clientX - menuWidth - CONTEXT_MENU_OFFSET
    // Если не помещается слева, прижимаем к левому краю
    if (x < CONTEXT_MENU_OFFSET) {
      x = CONTEXT_MENU_OFFSET
    }
  } else {
    // Размещаем справа от курсора
    x = clientX + CONTEXT_MENU_OFFSET
    // Убеждаемся, что меню не выходит за правый край
    const maxX = window.innerWidth - menuWidth - CONTEXT_MENU_OFFSET
    if (x > maxX) {
      x = maxX
    }
  }

  // Вертикальное позиционирование
  const availableBottom = window.innerHeight - clientY
  const placeAbove = availableBottom < menuHeight + CONTEXT_MENU_OFFSET

  let y
  if (placeAbove) {
    // Пытаемся разместить выше курсора
    y = clientY - menuHeight - CONTEXT_MENU_OFFSET
    // Если не помещается выше, прижимаем к верхнему краю
    if (y < CONTEXT_MENU_OFFSET) {
      y = CONTEXT_MENU_OFFSET
    }
  } else {
    // Размещаем ниже курсора
    y = clientY + CONTEXT_MENU_OFFSET
    // Убеждаемся, что меню не выходит за нижний край
    const maxY = window.innerHeight - menuHeight - CONTEXT_MENU_OFFSET
    if (y > maxY) {
      y = maxY
    }
  }

  return { x, y }
}
/**
 * Определение типа взаимодействия с объектом изображения
 * @param {MouseEvent} event - событие мыши
 * @returns {string} - Тип взаимодействия: 'move', 'resize-nw', 'resize-n', etc.
 */
function getInteractionType(event) {
  if (props.image.isLocked) return 'move'

  const target = event.target

  // Проверяем, клик по ручке изменения размера
  if (target.classList.contains('resize-handle')) {
    const handleType = target.dataset.handle
    return `resize-${handleType}`
  }

  // По умолчанию - перемещение
  return 'move'
}

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
  pointerEvents: 'auto',
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

  const interactionType = getInteractionType(event)

  emit('start-drag', {
    event,
    imageId: props.image.id,
    type: 'image',
    interactionType
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

// Обработчик контекстного меню
function handleContextMenu(event) {
  event.preventDefault()
  event.stopPropagation()
  emit('image-click', { event, imageId: props.image.id })

  const position = calculateContextMenuPosition(event.clientX, event.clientY)
  
  contextMenu.value = {
    visible: true,
    x: position.x,
    y: position.y
  }

  nextTick().then(() => {
    const rect = contextMenuRef.value?.getMenuRect?.()
    if (rect) {
      contextMenuSize.value = {
        width: rect.width,
        height: rect.height
      }

      const adjustedPosition = calculateContextMenuPosition(event.clientX, event.clientY)
      contextMenu.value.x = adjustedPosition.x
      contextMenu.value.y = adjustedPosition.y
    }
  })  
}

// Закрыть контекстное меню
function closeContextMenu() {
  contextMenu.value.visible = false
}

// Обработчик перерисовки
function handleRedraw() {
  emit('redraw')
}

// Обработчик клика вне контекстного меню
function handleClickOutside(event) {
  if (contextMenu.value.visible && !event.target.closest('.context-menu')) {
    closeContextMenu()
  }
}

// Монтируем обработчик клика при создании компонента
onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

// Удаляем обработчик при размонтировании
onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
})
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
    @contextmenu="handleContextMenu"
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
    <div v-if="image.isLocked" class="canvas-image__lock-indicator" aria-hidden="true">
      🔒
    </div>

    <!-- Рамка выделения -->
    <div
      v-if="isSelected && !image.isLocked"
      class="canvas-image__selection-border"
    />

    <!-- Ручки изменения размера -->
    <template v-if="isSelected && !image.isLocked">
      <div class="resize-handle resize-handle--nw" data-handle="nw" @mousedown.stop="handleMouseDown"></div>
      <div class="resize-handle resize-handle--n" data-handle="n" @mousedown.stop="handleMouseDown"></div>
      <div class="resize-handle resize-handle--ne" data-handle="ne" @mousedown.stop="handleMouseDown"></div>
      <div class="resize-handle resize-handle--e" data-handle="e" @mousedown.stop="handleMouseDown"></div>
      <div class="resize-handle resize-handle--se" data-handle="se" @mousedown.stop="handleMouseDown"></div>
      <div class="resize-handle resize-handle--s" data-handle="s" @mousedown.stop="handleMouseDown"></div>
      <div class="resize-handle resize-handle--sw" data-handle="sw" @mousedown.stop="handleMouseDown"></div>
      <div class="resize-handle resize-handle--w" data-handle="w" @mousedown.stop="handleMouseDown"></div>
    </template>
  </div>

  <!-- Контекстное меню -->
  <ObjectContextMenu
    ref="contextMenuRef"    
    :is-visible="contextMenu.visible"
    :x="contextMenu.x"
    :y="contextMenu.y"
    :object="image"
    @close="closeContextMenu"
    @redraw="handleRedraw"
  />
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
.canvas-image__lock-indicator {
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 6px;
  background: rgba(0, 0, 0, 0.01);
  color: #fff;
  border-radius: 8px;
  font-size: 16px;
  line-height: 1;
  pointer-events: none;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
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

/* Resize handles */
.resize-handle {
  position: absolute;
  width: 8px;
  height: 8px;
  background-color: #3b82f6;
  border: 1px solid white;
  border-radius: 2px;
  z-index: 10;
}

.resize-handle--nw {
  top: -4px;
  left: -4px;
  cursor: nw-resize;
}

.resize-handle--n {
  top: -4px;
  left: 50%;
  transform: translateX(-50%);
  cursor: n-resize;
}

.resize-handle--ne {
  top: -4px;
  right: -4px;
  cursor: ne-resize;
}

.resize-handle--e {
  top: 50%;
  right: -4px;
  transform: translateY(-50%);
  cursor: e-resize;
}

.resize-handle--se {
  bottom: -4px;
  right: -4px;
  cursor: se-resize;
}

.resize-handle--s {
  bottom: -4px;
  left: 50%;
  transform: translateX(-50%);
  cursor: s-resize;
}

.resize-handle--sw {
  bottom: -4px;
  left: -4px;
  cursor: sw-resize;
}

.resize-handle--w {
  top: 50%;
  left: -4px;
  transform: translateY(-50%);
  cursor: w-resize;
}
</style>
