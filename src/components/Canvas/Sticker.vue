<script setup>
import { ref, computed } from 'vue';
import { useStickersStore } from '../../stores/stickers';

const props = defineProps({
  sticker: {
    type: Object,
    required: true
  }
});

const stickersStore = useStickersStore();

// Локальное состояние
const isEditing = ref(false);
const editableContent = ref(props.sticker.content || '');
const isDragging = ref(false);
const dragOffset = ref({ x: 0, y: 0 });
const isHovering = ref(false);

// Вычисляемые свойства
const stickerStyle = computed(() => ({
  left: `${props.sticker.pos_x}px`,
  top: `${props.sticker.pos_y}px`,
  backgroundColor: props.sticker.color || '#FFFF88'
}));

// Редактирование
const handleDoubleClick = () => {
  if (isDragging.value) return;
  isEditing.value = true;
  editableContent.value = props.sticker.content || '';
};

const saveChanges = async () => {
  if (!isEditing.value) return;

  isEditing.value = false;

  // Сохраняем только если контент изменился
  if (editableContent.value !== props.sticker.content) {
    try {
      await stickersStore.updateSticker(props.sticker.id, {
        content: editableContent.value
      });
    } catch (error) {
      console.error('Ошибка сохранения стикера:', error);
      alert('Не удалось сохранить изменения');
    }
  }
};

// Перетаскивание
const handlePointerDown = (e) => {
  if (isEditing.value) return;

  // Игнорируем правую кнопку мыши
  if (e.button === 2) return;

  isDragging.value = true;

  const rect = e.currentTarget.getBoundingClientRect();
  dragOffset.value = {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  };

  e.currentTarget.setPointerCapture(e.pointerId);
};

const handlePointerMove = (e) => {
  if (!isDragging.value) return;

  e.preventDefault();

  // Получаем координаты относительно контейнера холста
  const canvas = e.currentTarget.closest('.canvas-content');
  if (!canvas) return;

  const canvasRect = canvas.getBoundingClientRect();
  const scale = parseFloat(getComputedStyle(canvas).getPropertyValue('transform').split(',')[0].replace('matrix(', '')) || 1;

  // Вычисляем новые координаты с учетом масштаба
  const newX = (e.clientX - canvasRect.left) / scale - dragOffset.value.x;
  const newY = (e.clientY - canvasRect.top) / scale - dragOffset.value.y;

  // Временно обновляем позицию (визуально)
  e.currentTarget.style.left = `${newX}px`;
  e.currentTarget.style.top = `${newY}px`;
};

const handlePointerUp = async (e) => {
  if (!isDragging.value) return;

  isDragging.value = false;
  e.currentTarget.releasePointerCapture(e.pointerId);

  // Получаем финальные координаты
  const canvas = e.currentTarget.closest('.canvas-content');
  if (!canvas) return;

  const canvasRect = canvas.getBoundingClientRect();
  const scale = parseFloat(getComputedStyle(canvas).getPropertyValue('transform').split(',')[0].replace('matrix(', '')) || 1;

  const newX = (e.clientX - canvasRect.left) / scale - dragOffset.value.x;
  const newY = (e.clientY - canvasRect.top) / scale - dragOffset.value.y;

  // Сохраняем новую позицию на сервере
  try {
    await stickersStore.updateSticker(props.sticker.id, {
      pos_x: Math.round(newX),
      pos_y: Math.round(newY)
    });
  } catch (error) {
    console.error('Ошибка сохранения позиции стикера:', error);
    alert('Не удалось сохранить новую позицию');
  }
};

// Удаление
const handleDelete = async () => {
  if (!confirm('Вы уверены, что хотите удалить этот стикер?')) {
    return;
  }

  try {
    await stickersStore.deleteSticker(props.sticker.id);
  } catch (error) {
    console.error('Ошибка удаления стикера:', error);
    alert('Не удалось удалить стикер');
  }
};
</script>

<template>
  <div
    class="sticker"
    :class="{ 'sticker--dragging': isDragging, 'sticker--editing': isEditing }"
    :style="stickerStyle"
    @dblclick="handleDoubleClick"
    @pointerdown="handlePointerDown"
    @pointermove="handlePointerMove"
    @pointerup="handlePointerUp"
    @mouseenter="isHovering = true"
    @mouseleave="isHovering = false"
  >
    <!-- Иконка "булавки" -->
    <div class="sticker__pin" aria-hidden="true">📌</div>

    <!-- Кнопка удаления -->
    <button
      v-if="isHovering && !isEditing"
      class="sticker__delete"
      type="button"
      @click.stop="handleDelete"
      aria-label="Удалить стикер"
    >
      ×
    </button>

    <!-- Контент стикера -->
    <div v-if="!isEditing" class="sticker__content">
      {{ sticker.content || 'Дважды кликните для редактирования' }}
    </div>

    <!-- Редактируемое поле -->
    <textarea
      v-else
      v-model="editableContent"
      class="sticker__textarea"
      placeholder="Введите текст..."
      @blur="saveChanges"
      @click.stop
      @pointerdown.stop
      @keydown.esc="saveChanges"
      autofocus
    />
  </div>
</template>

<style scoped>
.sticker {
  position: absolute;
  width: 200px;
  min-height: 150px;
  padding: 30px 16px 16px;
  background-color: #FFFF88;
  border-radius: 4px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
  cursor: move;
  user-select: none;
  transition: box-shadow 0.2s ease, transform 0.1s ease;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  font-size: 14px;
  line-height: 1.5;
  color: #333;
  z-index: 100;
}

.sticker:hover {
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.2);
}

.sticker--dragging {
  cursor: grabbing;
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.25);
  transform: rotate(1deg);
  z-index: 1000;
}

.sticker--editing {
  cursor: default;
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.25);
  z-index: 1000;
}

.sticker__pin {
  position: absolute;
  top: 8px;
  left: 8px;
  font-size: 18px;
  pointer-events: none;
  transform: rotate(-45deg);
}

.sticker__delete {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 50%;
  background: rgba(244, 67, 54, 0.9);
  color: white;
  font-size: 20px;
  font-weight: bold;
  line-height: 1;
  cursor: pointer;
  transition: background 0.2s ease, transform 0.1s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}

.sticker__delete:hover {
  background: rgba(211, 47, 47, 1);
  transform: scale(1.1);
}

.sticker__delete:active {
  transform: scale(0.95);
}

.sticker__content {
  width: 100%;
  height: 100%;
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow-wrap: break-word;
  color: #333;
  pointer-events: none;
}

.sticker__content:empty::before {
  content: 'Дважды кликните для редактирования';
  color: #999;
  font-style: italic;
  font-size: 12px;
}

.sticker__textarea {
  width: 100%;
  height: 120px;
  padding: 8px;
  border: 2px solid #FFC107;
  border-radius: 4px;
  background: white;
  font-family: inherit;
  font-size: inherit;
  line-height: inherit;
  color: inherit;
  resize: none;
  outline: none;
}

.sticker__textarea:focus {
  border-color: #FF9800;
}
</style>
