<script setup>
import { ref, nextTick, computed } from 'vue';
import { useCardsStore } from '../../stores/cards';

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
const isEditing = ref(false);
const editText = ref(props.card.text);
const textInput = ref(null);

// Вычисляемое свойство для проверки, является ли карточка большой
const isLargeCard = computed(() => props.card.width >= 494);

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
  }
};

// Обработчик для обновления значений
const updateValue = (event, field) => {
  const newValue = event.target.textContent.trim();
  cardsStore.updateCard(props.card.id, { [field]: newValue });
};
</script>

<template>
  <div
    class="card"
    :class="{
      'selected': isSelected,
      'connecting': isConnecting,
      'editing': isEditing,
      'card--large': isLargeCard
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
    
    <!-- Значки -->
    <div v-if="card.showSlfBadge" class="slf-badge visible">SLF</div>
    <div v-if="card.showFendouBadge" class="fendou-badge visible">奋斗</div>
    <img 
      v-if="card.rankBadge" 
      :src="`/rank-${card.rankBadge}.png`" 
      class="rank-badge visible"
      alt="Ранговый значок"
    />
    
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
.card {
  border-radius: 16px;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.12);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  overflow: visible;
  min-height: 280px;
}

.card:hover {
  transform: translateY(-1px);
  box-shadow: 0 12px 26px rgba(0, 0, 0, 0.18);
}

.card.selected {
  box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.6), 0 12px 26px rgba(0, 0, 0, 0.18);
}

.card-header {
  padding: 10px 44px 10px 10px;
  position: relative;
  height: 52px;
  border-radius: 16px 16px 0 0;
  cursor: grab;
  display: flex;
  align-items: center;
  justify-content: center;
}

.card-title {
  color: #fff;
  text-align: center;
  font-size: 20px;
  line-height: 1;
  font-weight: 800;
  letter-spacing: 0.3px;
  width: 100%;
}

.card.selected .card-title {
  cursor: pointer;
}

.card-title-input {
  width: 100%;
  background: rgba(255, 255, 255, 0.9);
  border: none;
  border-radius: 6px;
  padding: 6px;
  text-align: center;
  color: #333;
  font-size: 20px;
  font-weight: 800;
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
  font-size: 24px;
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
  padding: 15px;
  background: #fff;
  border-radius: 0 0 16px 16px;
}

.card-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.card-row:last-child {
  margin-bottom: 0;
}

.card-row.pv-row {
  justify-content: center;
  gap: 10px;
  margin-bottom: 15px;
}

.coin-icon {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
}

.label {
  font-weight: 700;
  color: #374151;
  font-size: 14px;
}

.value {
  color: #111827;
  font-weight: 800;
  font-size: 20px;
  outline: none;
  padding: 3px 6px;
  border-radius: 5px;
  transition: background 0.15s ease;
}

.value:focus {
  background: #fff8dc;
  box-shadow: 0 0 6px 2px rgba(255, 193, 7, 0.35);
}

.pv-value {
  font-size: 18px;
}

/* Значки */
.slf-badge,
.fendou-badge,
.rank-badge {
  position: absolute;
  display: none;
  user-select: none;
  pointer-events: none;
}

.slf-badge.visible,
.fendou-badge.visible,
.rank-badge.visible {
  display: block;
}

.slf-badge {
  top: 15px;
  left: 15px;
  color: #ffc700;
  font-weight: 900;
  font-size: 36px;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
}

.fendou-badge {
  top: -25px;
  left: 50%;
  transform: translateX(-50%);
  color: red;
  font-weight: 900;
  font-size: 56px;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
}

.rank-badge {
  top: -15px;
  right: 15px;
  width: 80px;
  height: auto;
  transform: rotate(15deg);
}

/* Соединительные точки */
.connection-point {
  position: absolute;
  width: 16px;
  height: 16px;
  background: #fff;
  border: 3px solid rgb(93, 139, 244);
  border-radius: 50%;
  cursor: pointer;
  transform: translate(-50%, -50%);
  display: none;
  transition: background 0.15s, transform 0.15s;
  z-index: 101;
}

.card:hover .connection-point {
  display: block;
}

.connection-point:hover {
  background: rgb(93, 139, 244);
  transform: scale(1.15) translate(-50%, -50%);
}

.connection-point.top {
  top: 0;
  left: 50%;
}

.connection-point.bottom {
  top: 100%;
  left: 50%;
}

.connection-point.left {
  top: 50%;
  left: 0;
}

.connection-point.right {
  top: 50%;
  left: 100%;
}

/* Большая карточка */
.card--large {
  min-height: 280px;
}
</style>
