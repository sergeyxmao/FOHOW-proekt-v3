<script setup>
import { ref, computed } from 'vue';
import { useStickersStore } from '../../stores/stickers';

const props = defineProps({
  sticker: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['sticker-click', 'start-drag']);

const stickersStore = useStickersStore();

// Локальное состояние
const isEditing = ref(false);
const editableContent = ref(props.sticker.content || '');
const isDragging = ref(false);
const dragOffset = ref({ x: 0, y: 0 });
const isHovering = ref(false);
// Временная позиция во время перетаскивания
const tempPosition = ref({ x: null, y: null });

// Вычисляемые свойства
const stickerStyle = computed(() => ({
  left: `${tempPosition.value.x !== null ? tempPosition.value.x : props.sticker.pos_x}px`,
  top: `${tempPosition.value.y !== null ? tempPosition.value.y : props.sticker.pos_y}px`,
  backgroundColor: props.sticker.color || '#FFFF88'
}));

// Проверка, выделен ли стикер
const isSelected = computed(() => props.sticker.selected === true);

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

  // Проверка Ctrl/Meta для выделения
  if (e.ctrlKey || e.metaKey) {
    e.stopPropagation();

    // Эмитим событие выделения
    emit('sticker-click', e, props.sticker.id);
    return;
  }

  // Начинаем перетаскивание через общую систему
  emit('start-drag', e, props.sticker.id);

  // Не начинаем локальное перетаскивание - оно будет управляться из CanvasBoard
  // isDragging.value = true; - закомментировано
  // const rect = e.currentTarget.getBoundingClientRect();
  // dragOffset.value = {
  //   x: e.clientX - rect.left,
  //   y: e.clientY - rect.top
  // };
  // e.currentTarget.setPointerCapture(e.pointerId);
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

  // Обновляем временную позицию (используется в computed свойстве)
  tempPosition.value = { x: newX, y: newY };
};

const handlePointerUp = async (e) => {
  if (!isDragging.value) return;

  isDragging.value = false;
  e.currentTarget.releasePointerCapture(e.pointerId);

  // Используем сохраненные временные координаты
  const newX = tempPosition.value.x !== null ? tempPosition.value.x : props.sticker.pos_x;
  const newY = tempPosition.value.y !== null ? tempPosition.value.y : props.sticker.pos_y;

  // Сохраняем новую позицию на сервере
  try {
    await stickersStore.updateSticker(props.sticker.id, {
      pos_x: Math.round(newX),
      pos_y: Math.round(newY)
    });

    // Очищаем временную позицию после успешного сохранения
    tempPosition.value = { x: null, y: null };
  } catch (error) {
    console.error('Ошибка сохранения позиции стикера:', error);
    alert('Не удалось сохранить новую позицию');
    // В случае ошибки возвращаем стикер на старое место
    tempPosition.value = { x: null, y: null };
  }
};

// Удаление
const handleDelete = async (event) => {
  // Останавливаем всплытие события
  event.stopPropagation();
  event.preventDefault();

  if (!confirm('Вы уверены, что хотите удалить этот стикер?')) {
    return;
  }

  try {
    await stickersStore.deleteSticker(props.sticker.id);
  } catch (error) {
    console.error('Ошибка удаления стикера:', error);
    const errorMessage = error.message || 'Не удалось удалить стикер';
    alert(`Не удалось удалить стикер: ${errorMessage}`);
  }
};
</script>

<template>
  <div
    class="sticker"
    :class="{
      'sticker--dragging': isDragging,
      'sticker--editing': isEditing,
      'sticker--selected': isSelected
    }"
    :style="stickerStyle"
    :data-sticker-id="sticker.id"
    @dblclick="handleDoubleClick"
    @pointerdown="handlePointerDown"
    @pointermove="handlePointerMove"
    @pointerup="handlePointerUp"
    @mouseenter="isHovering = true"
    @mouseleave="isHovering = false"
  >
    <!-- Иконка "булавки" -->
    <div class="sticker__pin" aria-hidden="true">
      <svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
        <!-- Тень под булавкой -->
        <ellipse cx="18" cy="36" rx="8" ry="2" fill="rgba(0,0,0,0.2)" />

        <!-- Иголка (металлическая часть) -->
        <defs>
          <linearGradient id="needleGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" style="stop-color:#b8b8b8;stop-opacity:1" />
            <stop offset="50%" style="stop-color:#e8e8e8;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#c0c0c0;stop-opacity:1" />
          </linearGradient>
        </defs>
        <path d="M 18 14 L 16 32"
              stroke="url(#needleGradient)"
              stroke-width="2"
              stroke-linecap="round"
              fill="none" />

        <!-- Шляпка булавки (основа) -->
        <defs>
          <radialGradient id="pinHeadGradient">
            <stop offset="0%" style="stop-color:#ff4444;stop-opacity:1" />
            <stop offset="70%" style="stop-color:#cc0000;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#990000;stop-opacity:1" />
          </radialGradient>
        </defs>
        <circle cx="18" cy="12" r="9" fill="url(#pinHeadGradient)" />

        <!-- Блик на шляпке для объема -->
        <ellipse cx="15" cy="9" rx="3" ry="4" fill="rgba(255,255,255,0.4)" />
        <ellipse cx="16" cy="10" rx="1.5" ry="2" fill="rgba(255,255,255,0.6)" />

        <!-- Внутренняя тень для глубины -->
        <circle cx="18" cy="12" r="9"
                fill="none"
                stroke="rgba(0,0,0,0.2)"
                stroke-width="0.5" />
      </svg>
    </div>

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

.sticker--selected {
  outline: 3px solid #2196F3;
  outline-offset: 2px;
  box-shadow: 0 8px 16px rgba(33, 150, 243, 0.4);
}

.sticker__pin {
  position: absolute;
  top: -12px;
  left: -8px;
  width: 32px;
  height: 32px;
  pointer-events: none;
  transform: rotate(-35deg);
  filter: drop-shadow(2px 2px 3px rgba(0, 0, 0, 0.3));
  z-index: 10;
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

/* Анимация при фокусировке из панели */
.sticker--focused {
  animation: stickerPulse 2s ease-in-out;
}

@keyframes stickerPulse {
  0%, 100% {
    transform: scale(1);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
  }
  25% {
    transform: scale(1.1);
    box-shadow: 0 8px 24px rgba(33, 150, 243, 0.6);
  }
  50% {
    transform: scale(1);
    box-shadow: 0 6px 16px rgba(33, 150, 243, 0.4);
  }
  75% {
    transform: scale(1.05);
    box-shadow: 0 8px 24px rgba(33, 150, 243, 0.6);
  }
}
</style>
