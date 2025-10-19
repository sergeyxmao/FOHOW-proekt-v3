<script setup>
import { ref, nextTick } from 'vue';
import { useCardsStore } from '../../stores/cards';

// Определяем входные параметры
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

// Определяем события, которые компонент может генерировать
const emit = defineEmits([
  'card-click',
  'start-drag'
]);

// Локальное состояние для редактирования
const isEditing = ref(false);
const editText = ref(props.card.text);
const textInput = ref(null);

// Хранилище карточек
const cardsStore = useCardsStore();

// Обработчик клика по карточке
const handleCardClick = (event) => {
  event.stopPropagation();
  
  // Если клик по тексту и карточка выбрана, начинаем редактирование
  if (event.target.classList.contains('card-text') && props.isSelected) {
    startEditing();
  } else {
    emit('card-click', props.card.id);
  }
};

// Обработчик начала перетаскивания
const handleMouseDown = (event) => {
  // Не начинаем перетаскивание во время редактирования
  if (isEditing.value) return;
  
  emit('start-drag', event, props.card.id);
};

// Начало редактирования
const startEditing = () => {
  isEditing.value = true;
  editText.value = props.card.text;
  
  // Фокусируемся на поле ввода после следующего обновления DOM
  nextTick(() => {
    if (textInput.value) {
      textInput.value.focus();
      textInput.value.select();
    }
  });
};

// Завершение редактирования
const finishEditing = () => {
  if (isEditing.value) {
    // Обновляем текст карточки, если он изменился
    if (editText.value !== props.card.text) {
      cardsStore.updateCard(props.card.id, { text: editText.value });
    }
    isEditing.value = false;
  }
};

// Отмена редактирования
const cancelEditing = () => {
  isEditing.value = false;
  editText.value = props.card.text;
};

// Обработчики клавиш
const handleKeyDown = (event) => {
  if (event.key === 'Enter') {
    finishEditing();
  } else if (event.key === 'Escape') {
    cancelEditing();
  }
};

// Обработчик потери фокуса
const handleBlur = () => {
  finishEditing();
};
</script>

<template>
  <div
    class="card"
    :class="{
      'selected': isSelected,
      'connecting': isConnecting,
      'editing': isEditing
    }"
    :style="{
      position: 'absolute',
      left: card.x + 'px',
      top: card.y + 'px',
      width: card.width + 'px',
      height: card.height + 'px',
      backgroundColor: card.fill,
      border: `${card.strokeWidth}px solid ${card.stroke}`,
      borderRadius: '5px',
      display: 'flex',
      flexDirection: 'column',
      color: '#333333',
      fontSize: '14px',
      cursor: isEditing ? 'text' : 'move',
      userSelect: isEditing ? 'text' : 'none'
    }"
    @click="handleCardClick"
    @mousedown="handleMouseDown"
  >
    <!-- Заголовок карточки -->
    <div
      class="card-header"
      :style="{ backgroundColor: card.headerBg || 'rgb(93, 139, 244)' }"
    >
      <div class="card-title">{{ card.text }}</div>
    </div>
    
    <!-- Содержимое карточки -->
    <div class="card-content">
      <!-- Если есть custom bodyHTML, отображаем его -->
      <div
        v-if="card.bodyHTML"
        class="card-body-html"
        v-html="card.bodyHTML"
      ></div>
      <!-- Иначе используем стандартное содержимое -->
      <template v-else>
        <!-- Режим редактирования -->
        <input
          v-if="isEditing"
          ref="textInput"
          v-model="editText"
          class="card-text-input"
          @keydown="handleKeyDown"
          @blur="handleBlur"
        />
        <!-- Режим отображения -->
        <div
          v-else
          class="card-text"
          :title="isSelected ? 'Кликните для редактирования текста' : ''"
        >
          {{ card.text }}
        </div>
      </template>
    </div>
    
    <!-- Соединительные точки -->
    <div
      class="connection-point top"
      :data-card-id="card.id"
      data-side="top"
    ></div>
    <div
      class="connection-point right"
      :data-card-id="card.id"
      data-side="right"
    ></div>
    <div
      class="connection-point bottom"
      :data-card-id="card.id"
      data-side="bottom"
    ></div>
    <div
      class="connection-point left"
      :data-card-id="card.id"
      data-side="left"
    ></div>
  </div>
</template>

<style scoped>
.card.selected {
  box-shadow: 0 0 0 3px #ff9800;
}

.card.connecting {
  box-shadow: 0 0 0 2px #4CAF50;
}

.card.editing {
  box-shadow: 0 0 0 3px #2196F3;
}

.card-header {
  padding: 8px 12px;
  border-radius: 5px 5px 0 0;
  flex-shrink: 0;
  min-height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.card-title {
  font-weight: 600;
  font-size: 14px;
  text-align: center;
  word-wrap: break-word;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  line-height: 1.2;
  color: white;
}

.card-content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 12px;
}

.card-text {
  width: 100%;
  text-align: center;
  word-wrap: break-word;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

.card.selected .card-text {
  cursor: pointer;
}

.card.selected .card-text:hover {
  text-decoration: underline;
}

.card-text-input {
  width: 90%;
  background: rgba(255, 255, 255, 0.9);
  border: none;
  border-radius: 3px;
  padding: 4px;
  text-align: center;
  color: #333;
  font-size: 14px;
}

.card-body-html {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 8px;
  color: white;
  font-size: 12px;
}

.card-body-html .card-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  margin: 2px 0;
}

.card-body-html .coin-icon {
  width: 20px;
  height: 20px;
  margin-right: 8px;
}

.card-body-html .label {
  font-weight: bold;
  margin-right: 8px;
}

.card-body-html .value {
  flex: 1;
  text-align: right;
}

.connection-point {
  position: absolute;
  width: 12px;
  height: 12px;
  background-color: #2196F3;
  border: 2px solid #ffffff;
  border-radius: 50%;
  cursor: pointer;
  z-index: 10;
  opacity: 0.7;
  transition: all 0.2s ease;
}

.connection-point:hover {
  opacity: 1;
  transform: scale(1.2);
}

.connection-point.top {
  top: -6px;
  left: 50%;
  transform: translateX(-50%);
}

.connection-point.right {
  right: -6px;
  top: 50%;
  transform: translateY(-50%);
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

.connection-point.top:hover {
  transform: translateX(-50%) scale(1.2);
}

.connection-point.right:hover {
  transform: translateY(-50%) scale(1.2);
}

.connection-point.bottom:hover {
  transform: translateX(-50%) scale(1.2);
}

.connection-point.left:hover {
  transform: translateY(-50%) scale(1.2);
}
</style>