<script setup>
import { ref, nextTick, computed, onMounted, onUnmounted } from 'vue';
import { useCardsStore } from '../../stores/cards';
import { useNotesStore } from '../../stores/notes';

const props = defineProps({
  card: {
    type: Object,
    required: true
  },
  isSelected: {
    type: Boolean,
    default: false
  },
  isConnecting: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits([
  'card-click',
  'start-drag'
]);

const cardsStore = useCardsStore();
const notesStore = useNotesStore();
const isEditing = ref(false);
const editText = ref(props.card.text);
const textInput = ref(null);

// Вычисляемое свойство для проверки, является ли карточка большой
const isLargeCard = computed(() => props.card.width >= 494);

// Вычисляемые свойства для заметки
const hasNote = computed(() => {
  const note = notesStore.getNote(props.card.id);
  return note && (note.text || Object.keys(note.entries || {}).length > 0);
});

const noteIndicatorColor = computed(() => {
  const note = notesStore.getNote(props.card.id);
  if (!note) return null;
  return note.highlightColor || null;
});

const handleCardClick = (event) => {
  event.stopPropagation();
  if (event.target.classList.contains('card-title') && props.isSelected) {
    startEditing();
  } else {
    emit('card-click', event, props.card.id);
  }
};

const handleMouseDown = (event) => {
  if (isEditing.value) return;
  emit('start-drag', event, props.card.id);
};

const startEditing = () => {
  isEditing.value = true;
  editText.value = props.card.text;
  nextTick(() => {
    if (textInput.value) {
      textInput.value.focus();
      textInput.value.select();
    }
  });
};

const finishEditing = () => {
  if (isEditing.value) {
    if (editText.value !== props.card.text) {
      cardsStore.updateCard(props.card.id, { text: editText.value });
    }
    isEditing.value = false;
  }
};

const cancelEditing = () => {
  isEditing.value = false;
  editText.value = props.card.text;
};

const handleKeyDown = (event) => {
  if (event.key === 'Enter') {
    finishEditing();
  } else if (event.key === 'Escape') {
    cancelEditing();
  }
};

const handleBlur = () => {
  finishEditing();
};

// Обработчик для удаления карточки
const handleDelete = (event) => {
  event.stopPropagation();
  if (confirm(`Удалить карточку "${props.card.text}"?`)) {
    cardsStore.removeCard(props.card.id);
    // Удаляем заметку при удалении карточки
    notesStore.removeNote(props.card.id);
  }
};

// Обработчик для обновления значений
const updateValue = (event, field) => {
  const newValue = event.target.textContent.trim();
  cardsStore.updateCard(props.card.id, { [field]: newValue });
};

// Обработчик для открытия/закрытия заметки
const toggleNote = (event) => {
  event.stopPropagation();
  console.log('Toggle note for card:', props.card.id);
  
  // Проверяем, есть ли уже открытое окно для этой заметки
  const note = notesStore.getNote(props.card.id);
  
  if (note && note.visible) {
    // Закрываем заметку
    notesStore.hideNote(props.card.id);
  } else {
    // Открываем заметку
    const cardElement = event.target.closest('.card');
    if (cardElement) {
      const rect = cardElement.getBoundingClientRect();
      notesStore.showNote(props.card.id, {
        x: rect.right + 15,
        y: rect.top,
        cardTitle: props.card.text
      });
    }
  }
};
</script>

<template>
  <div
    class="card"
    :class="{
      'selected': isSelected,
      'connecting': isConnecting,
      'editing': isEditing,
      'card--large': isLargeCard,
      'note-active': notesStore.getNote(card.id)?.visible
    }"
    :style="{
      position: 'absolute',
      left: card.x + 'px',
      top: card.y + 'px',
      width: card.width + 'px',
      backgroundColor: card.fill,
      border: `${card.strokeWidth}px solid ${card.stroke}`,
    }"
    @click="handleCardClick"
    @mousedown="handleMouseDown"
  >
    <!-- Заголовок карточки -->
    <div
      class="card-header"
      :style="{ backgroundColor: card.headerBg || 'rgb(93, 139, 244)' }"
    >
      <input
        v-if="isEditing"
        ref="textInput"
        v-model="editText"
        class="card-title-input"
        @keydown="handleKeyDown"
        @blur="handleBlur"
        @click.stop
      />
      <div
        v-else
        class="card-title"
        :title="isSelected ? 'Кликните для редактирования' : ''"
      >
        {{ card.text }}
      </div>
      
      <!-- Кнопка закрытия -->
      <button
        class="card-close-btn"
        title="Удалить карточку"
        @click="handleDelete"
      >
        ×
      </button>
    </div>
    
    <!-- Содержимое карточки -->
    <div class="card-body">
      <!-- Иконка монетки и PV -->
      <div class="card-row pv-row">
        <svg class="coin-icon" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="45" :fill="card.coinFill || '#ffd700'" stroke="#DAA520" stroke-width="5"/>
        </svg>
        <span class="value pv-value" contenteditable="true" @blur="updateValue($event, 'pv')">
          {{ card.pv || '330/330pv' }}
        </span>
      </div>
      
      <!-- Баланс -->
      <div class="card-row">
        <span class="label">Баланс:</span>
        <span class="value" contenteditable="true" @blur="updateValue($event, 'balance')">
          {{ card.balance || '0 / 0' }}
        </span>
      </div>
      
      <!-- Актив-заказы PV -->
      <div class="card-row">
        <span class="label">Актив-заказы PV:</span>
        <span class="value" contenteditable="true" @blur="updateValue($event, 'activePv')">
          {{ card.activePv || '0 / 0' }}
        </span>
      </div>
      
      <!-- Цикл -->
      <div class="card-row">
        <span class="label">Цикл:</span>
        <span class="value" contenteditable="true" @blur="updateValue($event, 'cycle')">
          {{ card.cycle || '0' }}
        </span>
      </div>
    </div>
    
    <!-- Точки соединения -->
    <div 
      class="connection-point top" 
      :data-card-id="card.id"
      data-side="top"
    />
    <div 
      class="connection-point right" 
      :data-card-id="card.id"
      data-side="right"
    />
    <div 
      class="connection-point bottom" 
      :data-card-id="card.id"
      data-side="bottom"
    />
    <div 
      class="connection-point left" 
      :data-card-id="card.id"
      data-side="left"
    />
    
    <!-- Контролы карточки (включая кнопку заметки) -->
    <div class="card-controls">
      <button
        class="card-control-btn note-btn"
        :class="{
          'has-text': hasNote,
          'has-color': noteIndicatorColor
        }"
        :style="noteIndicatorColor ? `--note-indicator-color: ${noteIndicatorColor}` : ''"
        title="Заметка"
        @click="toggleNote"
      >
        {{ hasNote ? '❗' : '📝' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.card {
  position: absolute;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  user-select: none;
}

.card:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
}

.card.selected {
  box-shadow: 0 0 0 3px rgba(93, 139, 244, 0.5), 0 6px 16px rgba(0, 0, 0, 0.2);
}

.card.note-active::after {
  content: '';
  position: absolute;
  inset: -6px;
  border-radius: 18px;
  border: 2px solid rgba(225, 29, 72, 0.55);
  box-shadow: 0 0 12px rgba(225, 29, 72, 0.35);
  pointer-events: none;
}

.card.note-active .card-header {
  box-shadow: inset 0 -2px 0 rgba(225, 29, 72, 0.45);
}

.card-header {
  padding: 10px;
  border-radius: 12px 12px 0 0;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
  min-height: 40px;
}

.card-title {
  font-weight: bold;
  font-size: 14px;
  color: white;
  text-align: center;
  cursor: text;
}

.card-title-input {
  font-weight: bold;
  font-size: 14px;
  color: white;
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 4px;
  padding: 2px 6px;
  width: 100%;
  text-align: center;
}

.card-close-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.25);
  color: #fff;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s ease, transform 0.15s ease;
}

.card-close-btn:hover {
  background: rgba(0, 0, 0, 0.4);
  transform: scale(1.05);
}

.card-body {
  padding: 12px;
}

.card-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.card-row.pv-row {
  margin-bottom: 12px;
}

.label {
  font-size: 12px;
  color: #666;
}

.value {
  font-size: 12px;
  font-weight: 600;
  color: #333;
  cursor: text;
  padding: 2px 4px;
  border-radius: 3px;
  min-width: 50px;
  text-align: right;
}

.value:hover {
  background: rgba(0, 0, 0, 0.05);
}

.value:focus {
  outline: 2px solid rgba(93, 139, 244, 0.5);
  background: white;
}

.coin-icon {
  width: 24px;
  height: 24px;
  cursor: pointer;
}

.pv-value {
  font-size: 14px;
  font-weight: bold;
}

/* Точки соединения */
.connection-point {
  position: absolute;
  width: 12px;
  height: 12px;
  background: #5d8bf4;
  border: 2px solid white;
  border-radius: 50%;
  cursor: crosshair;
  opacity: 0;
  transition: opacity 0.2s ease, transform 0.2s ease;
  z-index: 10;
}

.card:hover .connection-point {
  opacity: 1;
}

.connection-point:hover {
  transform: scale(1.2);
  background: #2563eb;
}

.connection-point.top {
  top: -6px;
  left: 50%;
  transform: translateX(-50%);
}

.connection-point.bottom {
  bottom: -6px;
  left: 50%;
  transform: translateX(-50%);
}

.connection-point.left {
  left: -6px;
  top: 50%;
  transform: translateY(-50%);
}

.connection-point.right {
  right: -6px;
  top: 50%;
  transform: translateY(-50%);
}

.card:hover .connection-point.top,
.card:hover .connection-point.bottom {
  transform: translateX(-50%) scale(1);
}

.card:hover .connection-point.left,
.card:hover .connection-point.right {
  transform: translateY(-50%) scale(1);
}

.connection-point.top:hover,
.connection-point.bottom:hover {
  transform: translateX(-50%) scale(1.2);
}

.connection-point.left:hover,
.connection-point.right:hover {
  transform: translateY(-50%) scale(1.2);
}

/* Контролы карточки */
.card-controls {
  position: absolute;
  bottom: 8px;
  right: 8px;
  display: flex;
  gap: 6px;
  z-index: 102;
}

.card-control-btn {
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
  font-size: 16px;
  display: grid;
  place-items: center;
  transition: transform 0.15s ease, background 0.15s ease;
}

.card-control-btn:hover {
  transform: scale(1.1);
}

/* Стили для кнопки заметки */
.note-btn {
  position: relative;
  background: #fff;
}

.note-btn::after {
  content: "";
  position: absolute;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: 1px solid rgba(17, 24, 39, 0.45);
  bottom: 2px;
  right: 2px;
  opacity: 0;
  transform: scale(0.6);
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.note-btn.has-color::after {
  opacity: 1;
  transform: scale(1);
  background: var(--note-indicator-color, transparent);
}

.note-btn.has-text {
  background: #e11d48;
  color: #fff;
}

.note-btn.has-text.has-color::after {
  border-color: rgba(255, 255, 255, 0.75);
}

/* Большие карточки */
.card--large {
  /* Дополнительные стили для больших карточек */
}

.card--large .card-body {
  padding: 16px;
}

.card--large .card-row {
  margin-bottom: 12px;
}
</style>
