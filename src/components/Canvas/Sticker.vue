<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick, inject } from 'vue';
import { useStickersStore } from '../../stores/stickers';

// Inject isReadOnly from parent (CanvasBoard)
const isReadOnly = inject('isReadOnly', ref(false));

const props = defineProps({
  sticker: {
    type: Object,
    required: true
  },
  isAnimated: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['sticker-click', 'start-drag']);

const stickersStore = useStickersStore();

// Локальное состояние
const isEditing = ref(false);
const editableContent = ref(props.sticker.content || '');
const originalContent = ref(''); // Сохраняем оригинальный текст для отмены по Esc
const isDragging = ref(false);
const dragOffset = ref({ x: 0, y: 0 });
const isHovering = ref(false);
// Временная позиция во время перетаскивания
const tempPosition = ref({ x: null, y: null });
// Реф для стикера
const stickerRef = ref(null);
// Время начала редактирования (для защиты от ложных срабатываний handleClickOutside)
const editingStartTime = ref(0);

// Вычисляемые свойства
const stickerStyle = computed(() => ({
  left: `${tempPosition.value.x !== null ? tempPosition.value.x : props.sticker.pos_x}px`,
  top: `${tempPosition.value.y !== null ? tempPosition.value.y : props.sticker.pos_y}px`,
  backgroundColor: props.sticker.color || '#FFFF88',
  zIndex: props.sticker.z_index ?? 10000
}));

// Проверка, выделен ли стикер
const isSelected = computed(() => props.sticker.selected === true);

// Редактирование
const handleDoubleClick = () => {
  // Запрещаем редактирование в readonly режиме
  if (isReadOnly.value) return;
  if (isDragging.value) return;
  isEditing.value = true;
  editableContent.value = props.sticker.content || '';
  originalContent.value = props.sticker.content || ''; // Сохраняем оригинальный текст для отмены
  
  // Устанавливаем фокус после рендера textarea
  nextTick(() => {
    const textarea = stickerRef.value?.querySelector('.sticker__textarea');
    if (textarea) {
      textarea.focus();
      // Устанавливаем курсор в конец текста
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    }
  });
};

// Программное открытие редактирования (для вызова извне, например при создании стикера)
const startEditing = () => {
  isEditing.value = true;
  editableContent.value = props.sticker.content || '';
  originalContent.value = props.sticker.content || '';
  nextTick(() => {
    const textarea = stickerRef.value?.querySelector('.sticker__textarea');
    if (textarea) {
      textarea.focus();
    }
  });
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

  // Очищаем оригинальный контент
  originalContent.value = '';
};

// Обработчик blur с проверкой, действительно ли фокус ушел за пределы стикера
const handleBlur = () => {
  // Используем setTimeout, чтобы дать браузеру время обновить activeElement
  setTimeout(() => {
    // Проверяем, находится ли новый активный элемент внутри стикера
    if (isEditing.value && stickerRef.value && !stickerRef.value.contains(document.activeElement)) {
      saveChanges();
    }
  }, 0);
};

// Отмена редактирования по Esc
const cancelEditing = (event) => {
  if (!isEditing.value) return;

  // Восстанавливаем оригинальный текст
  editableContent.value = originalContent.value;
  isEditing.value = false;
  originalContent.value = '';

  // Убираем фокус с элемента
  event.target.blur();
  event.preventDefault();
  event.stopPropagation();
};

// Закрытие редактирования при клике вне стикера
const closeEditing = () => {
  if (isEditing.value) {
    saveChanges();
  }
};

// Обработчик кликов вне стикера для закрытия редактирования
const handleClickOutside = (event) => {
  if (!isEditing.value) return;

  // Игнорируем клики, которые произошли сразу после открытия редактирования
  // Это защищает от синтетических событий и "эха" кликов
  if (performance.now() - editingStartTime.value < 300) return;

  // Игнорируем клики по самому текстовому полю (на всякий случай)
  if (event.target.classList.contains('sticker__textarea')) return;

  // Проверяем, кликнули ли вне стикера
  if (stickerRef.value && !stickerRef.value.contains(event.target)) {
    saveChanges();
  }
};

// Watch для добавления/удаления обработчика кликов при входе/выходе из режима редактирования
watch(isEditing, (newValue) => {
  if (newValue) {
    // Запоминаем время начала редактирования
    editingStartTime.value = performance.now();
    // Добавляем обработчик с задержкой, чтобы не закрыть сразу после открытия
    setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 300);
  } else {
    document.removeEventListener('click', handleClickOutside);
  }
});

// Убираем обработчик при размонтировании компонента
onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});

// Экспортировать методы для доступа из родительского компонента
defineExpose({
  closeEditing,
  startEditing
});

// Перетаскивание
const handlePointerDown = (e) => {
  // Игнорируем правую кнопку мыши
  if (e.button === 2) return;

  // Если стикер в режиме редактирования
  if (isEditing.value) {
    // Если клик НЕ на textarea, предотвращаем потерю фокуса
    if (!e.target.classList.contains('sticker__textarea')) {
      e.preventDefault(); // Предотвращаем потерю фокуса
      e.stopPropagation(); // Останавливаем всплытие
      // Возвращаем фокус на textarea
      const textarea = e.currentTarget.querySelector('.sticker__textarea');
      if (textarea) {
        textarea.focus();
      }
    }
    return;
  }

  // Останавливаем всплытие для ВСЕХ остальных случаев
  e.stopPropagation();

  // Проверка Ctrl/Meta для выделения
  if (e.ctrlKey || e.metaKey) {
    emit('sticker-click', e, props.sticker.id);
    return;
  }

  // Обычный клик без Ctrl - тоже эмитим событие для выделения
  emit('sticker-click', e, props.sticker.id);

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
    ref="stickerRef"
    class="sticker"
    :class="{
      'sticker--dragging': isDragging,
      'sticker--editing': isEditing,
      'sticker--selected': isSelected,
      'is-animated': isAnimated
    }"
    :style="stickerStyle"
    :data-sticker-id="sticker.id"
    @click.stop
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
      v-if="!isEditing"
      class="sticker__delete"
      :class="{ 'sticker__delete--visible': isHovering }"
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
      @blur="handleBlur"
      @click.stop
      @pointerdown.stop
      @keydown.esc="cancelEditing"
      autofocus
    ></textarea>
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
  /* z-index теперь динамический и задается через style */
}

.sticker:hover {
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.2);
}

.sticker--dragging {
  cursor: grabbing;
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.25);
  transform: rotate(1deg);
  /* Временно повышаем z-index при перетаскивании - должен быть выше всех стикеров */
  z-index: 99999 !important;
}

.sticker--editing {
  cursor: default;
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.25);
  /* Временно повышаем z-index при редактировании - должен быть выше всех стикеров */
  z-index: 99999 !important;
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
  transition: background 0.2s ease, transform 0.1s ease, opacity 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  opacity: 0;
  pointer-events: none;
}

.sticker__delete--visible {
  opacity: 1;
  pointer-events: auto;
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

/* Анимация при клике на монетку (PV changed) */
.sticker.is-animated {
  animation: sticker-pulse 2s ease-in-out;
  box-shadow: 0 0 20px rgba(93, 139, 244, 0.6) !important;
  border: 2px solid rgb(93, 139, 244) !important;
}

@keyframes sticker-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}
</style>
