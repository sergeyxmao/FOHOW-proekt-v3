<template>
  <div
    v-if="isVisible"
    ref="menuRef"    
    class="context-menu"
    :style="{ left: x + 'px', top: y + 'px' }"
  >
    <ul>
      <li @click="bringToFront">На передний план</li>
      <li @click="sendToBack">На задний план</li>
      <li class="separator"></li>
      <li @click="duplicate">Дублировать</li>
      <li @click="deleteObject" class="danger">Удалить</li>
      <li class="separator"></li>
      <li @click="toggleLock">
        {{ object?.isLocked ? 'Разблокировать' : 'Заблокировать' }}
      </li>
    </ul>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
  
import { useImagesStore } from '../../stores/images';

// Props
const props = defineProps({
  isVisible: {
    type: Boolean,
    default: false
  },
  x: {
    type: Number,
    default: 0
  },
  y: {
    type: Number,
    default: 0
  },
  object: {
    type: Object,
    required: true
  }
});

// Emits
const emit = defineEmits(['close', 'redraw']);

const imagesStore = useImagesStore();
const menuRef = ref(null);

const menuRect = computed(() => menuRef.value?.getBoundingClientRect() || null);

const getMenuRect = () => menuRect.value;

defineExpose({ getMenuRect });
  
/**
 * Переместить объект на передний план
 */
const bringToFront = () => {
  if (!props.object) return;

  imagesStore.bringToFront(props.object.id);
  emit('close');
  emit('redraw');
};

/**
 * Переместить объект на задний план
 */
const sendToBack = () => {
  if (!props.object) return;

  imagesStore.sendToBack(props.object.id);
  emit('close');
  emit('redraw');
};

/**
 * Дублировать объект
 */
const duplicate = () => {
  if (!props.object) return;

  imagesStore.duplicateImage(props.object.id, { x: 20, y: 20 });
  emit('close');
  emit('redraw');
};

/**
 * Удалить объект
 */
const deleteObject = () => {
  if (!props.object) return;

  imagesStore.removeImage(props.object.id);
  emit('close');
  emit('redraw');
};

/**
 * Переключить блокировку объекта
 */
const toggleLock = () => {
  if (!props.object) return;

  imagesStore.updateImage(
    props.object.id,
    { isLocked: !props.object.isLocked }
  );
  emit('close');
  emit('redraw');
};
</script>

<style scoped>
.context-menu {
  position: fixed;
  background: white;
  border: 1px solid #ccc;
  border-radius: 6px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.15);
  z-index: 9999;
  min-width: 180px;
  padding: 4px 0;
}

.context-menu ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

.context-menu li {
  padding: 8px 16px;
  cursor: pointer;
  font-size: 14px;
  color: #333;
  transition: background 0.2s;
}

.context-menu li:hover {
  background: #f5f5f5;
}

.context-menu li.danger {
  color: #dc3545;
}

.context-menu li.danger:hover {
  background: #ffebee;
}

.context-menu li.separator {
  height: 1px;
  background: #e0e0e0;
  margin: 4px 0;
  padding: 0;
  cursor: default;
}

.context-menu li.separator:hover {
  background: #e0e0e0;
}
</style>
