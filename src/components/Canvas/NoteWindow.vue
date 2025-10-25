<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { useNotesStore } from '../../stores/notes';
import { useCardsStore } from '../../stores/cards';

const props = defineProps({
  cardId: {
    type: String,
    required: true
  }
});

const notesStore = useNotesStore();
const cardsStore = useCardsStore();

const noteWindow = ref(null);
const isDragging = ref(false);
const dragOffset = ref({ x: 0, y: 0 });
const isResizing = ref(false);
const textarea = ref(null);

// Получаем данные заметки
const note = computed(() => notesStore.getNote(props.cardId));
const card = computed(() => cardsStore.cards.find(c => c.id === props.cardId));

// Текущая дата и календарь
const currentDate = ref(new Date());
const selectedDate = computed({
  get: () => note.value?.selectedDate || formatDate(new Date()),
  set: (value) => notesStore.updateSelectedDate(props.cardId, value)
});

// Текст заметки для выбранной даты
const noteText = computed({
  get: () => {
    const entry = note.value?.entries?.[selectedDate.value];
    return entry?.text || '';
  },
  set: (value) => {
    notesStore.updateNoteText(props.cardId, selectedDate.value, value);
  }
});

// Цвета для выделения
const colors = ['#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#00bcd4', '#009688', '#4caf50', '#8bc34a'];

// Текущий цвет для выбранной даты
const currentColor = computed(() => {
  return note.value?.colors?.[selectedDate.value] || note.value?.highlightColor || '#f44336';
});

// Форматирование даты
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Получение дней месяца для календаря
function getDaysInMonth() {
  const year = currentDate.value.getFullYear();
  const month = currentDate.value.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const days = [];
  
  // Добавляем пустые дни в начале
  const startDayOfWeek = firstDay.getDay() || 7; // Понедельник = 1, Воскресенье = 7
  for (let i = 1; i < startDayOfWeek; i++) {
    days.push(null);
  }
  
  // Добавляем дни месяца
  for (let i = 1; i <= lastDay.getDate(); i++) {
    days.push(new Date(year, month, i));
  }
  
  return days;
}

const daysInMonth = computed(() => getDaysInMonth());

// Навигация по месяцам
function previousMonth() {
  const newDate = new Date(currentDate.value);
  newDate.setMonth(newDate.getMonth() - 1);
  currentDate.value = newDate;
}

function nextMonth() {
  const newDate = new Date(currentDate.value);
  newDate.setMonth(newDate.getMonth() + 1);
  currentDate.value = newDate;
}

// Выбор даты
function selectDate(date) {
  if (!date) return;
  selectedDate.value = formatDate(date);
}

// Проверка, есть ли заметка для даты
function hasNoteForDate(date) {
  if (!date || !note.value?.entries) return false;
  const dateStr = formatDate(date);
  return !!note.value.entries[dateStr]?.text;
}

// Получение цвета для даты
function getColorForDate(date) {
  if (!date || !note.value?.colors) return null;
  const dateStr = formatDate(date);
  return note.value.colors[dateStr];
}

// Установка цвета
function setColor(color) {
  notesStore.updateNoteColor(props.cardId, selectedDate.value, color);
  notesStore.updateHighlightColor(props.cardId, color);
}

// Закрытие окна
function closeNote() {
  notesStore.hideNote(props.cardId);
}

// Перетаскивание окна
function startDrag(event) {
  if (event.target.closest('.note-close-btn') || event.target.closest('.note-tools')) return;
  
  isDragging.value = true;
  const rect = noteWindow.value.getBoundingClientRect();
  dragOffset.value = {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };
  
  document.addEventListener('mousemove', handleDrag);
  document.addEventListener('mouseup', endDrag);
  event.preventDefault();
}

function handleDrag(event) {
  if (!isDragging.value) return;
  
  const x = event.clientX - dragOffset.value.x;
  const y = event.clientY - dragOffset.value.y;
  
  notesStore.updateNotePosition(props.cardId, x, y);
}

function endDrag() {
  isDragging.value = false;
  document.removeEventListener('mousemove', handleDrag);
  document.removeEventListener('mouseup', endDrag);
}

// Изменение размера окна
function startResize(event) {
  isResizing.value = true;
  const rect = noteWindow.value.getBoundingClientRect();
  const startX = event.clientX;
  const startY = event.clientY;
  const startWidth = rect.width;
  const startHeight = rect.height;
  
  const handleResize = (e) => {
    const newWidth = startWidth + (e.clientX - startX);
    const newHeight = startHeight + (e.clientY - startY);
    notesStore.updateNoteSize(props.cardId, newWidth, newHeight);
  };
  
  const stopResize = () => {
    isResizing.value = false;
    document.removeEventListener('mousemove', handleResize);
    document.removeEventListener('mouseup', stopResize);
  };
  
  document.addEventListener('mousemove', handleResize);
  document.addEventListener('mouseup', stopResize);
  event.preventDefault();
}

// Стили окна
const windowStyles = computed(() => ({
  left: `${note.value?.x || 100}px`,
  top: `${note.value?.y || 100}px`,
  width: `${note.value?.width || 260}px`,
  height: `${note.value?.height || 380}px`,
  '--note-accent': currentColor.value
}));

// Названия месяцев
const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 
                    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const monthName = computed(() => monthNames[currentDate.value.getMonth()]);

onMounted(() => {
  // Фокусируемся на textarea при открытии
  nextTick(() => {
    if (textarea.value) {
      textarea.value.focus();
    }
  });
});
</script>

<template>
  <div
    v-if="note?.visible"
    ref="noteWindow"
    class="note-window"
    :style="windowStyles"
  >
    <!-- Заголовок окна -->
    <div class="note-header" @mousedown="startDrag">
      <span class="note-title">{{ card?.text || 'Заметка' }}</span>
      <button class="note-close-btn" @click="closeNote">×</button>
    </div>
    
    <!-- Инструменты -->
    <div class="note-tools">
      <div class="color-picker">
        <button
          v-for="color in colors"
          :key="color"
          class="color-dot"
          :class="{ active: currentColor === color }"
          :style="{ backgroundColor: color }"
          @click="setColor(color)"
        />
      </div>
    </div>
    
    <!-- Календарь -->
    <div class="note-calendar">
      <div class="calendar-header">
        <button class="calendar-nav" @click="previousMonth">‹</button>
        <span class="calendar-month">{{ monthName }} {{ currentDate.getFullYear() }}</span>
        <button class="calendar-nav" @click="nextMonth">›</button>
      </div>
      
      <div class="calendar-grid">
        <div class="calendar-dow">Пн</div>
        <div class="calendar-dow">Вт</div>
        <div class="calendar-dow">Ср</div>
        <div class="calendar-dow">Чт</div>
        <div class="calendar-dow">Пт</div>
        <div class="calendar-dow">Сб</div>
        <div class="calendar-dow">Вс</div>
        
        <div
          v-for="(day, index) in daysInMonth"
          :key="index"
          class="calendar-cell"
          :class="{
            'calendar-cell--empty': !day,
            'calendar-cell--selected': day && formatDate(day) === selectedDate,
            'calendar-cell--has-note': hasNoteForDate(day),
            'calendar-cell--today': day && formatDate(day) === formatDate(new Date())
          }"
          :style="getColorForDate(day) ? { backgroundColor: getColorForDate(day) + '33' } : {}"
          @click="selectDate(day)"
        >
          <span v-if="day">{{ day.getDate() }}</span>
        </div>
      </div>
    </div>
    
    <!-- Текстовое поле для заметки -->
    <textarea
      ref="textarea"
      v-model="noteText"
      class="note-textarea"
      placeholder="Введите текст заметки..."
    />
    
    <!-- Ручка для изменения размера -->
    <div class="note-resize-handle" @mousedown="startResize" />
  </div>
</template>

<style scoped>
.note-window {
  position: fixed;
  min-width: 260px;
  min-height: 380px;
  background: #fff;
  border: 1px solid var(--note-accent, #e5e7eb);
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  z-index: 1500;
  display: flex;
  flex-direction: column;
  resize: both;
  overflow: hidden;
}

.note-header {
  background: #f3f4f6;
  padding: 8px 12px;
  border-radius: 12px 12px 0 0;
  cursor: grab;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  box-shadow: inset 0 -2px 0 var(--note-accent, transparent);
  user-select: none;
}

.note-header:active {
  cursor: grabbing;
}

.note-title {
  font-weight: 600;
  font-size: 14px;
  color: #111827;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.note-close-btn {
  font-size: 20px;
  cursor: pointer;
  padding: 0 8px;
  border: none;
  background: transparent;
  color: #6b7280;
  transition: color 0.15s;
}

.note-close-btn:hover {
  color: #111827;
}

.note-tools {
  padding: 8px 12px;
  border-bottom: 1px solid #e5e7eb;
  flex-shrink: 0;
}

.color-picker {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.color-dot {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: transform 0.15s, border-color 0.15s;
}

.color-dot:hover {
  transform: scale(1.1);
}

.color-dot.active {
  border-color: #111827;
  transform: scale(1.1);
}

.note-calendar {
  padding: 8px 12px;
  border-bottom: 1px solid #e5e7eb;
  flex-shrink: 0;
}

.calendar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.calendar-nav {
  background: transparent;
  border: none;
  font-size: 18px;
  cursor: pointer;
  padding: 2px 8px;
  color: #6b7280;
  transition: color 0.15s;
}

.calendar-nav:hover {
  color: #111827;
}

.calendar-month {
  font-size: 13px;
  font-weight: 600;
  color: #111827;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
}

.calendar-dow {
  font-size: 11px;
  font-weight: 600;
  color: #6b7280;
  text-align: center;
  padding: 4px 0;
}

.calendar-cell {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  cursor: pointer;
  border-radius: 4px;
  transition: background-color 0.15s;
  position: relative;
}

.calendar-cell:hover:not(.calendar-cell--empty) {
  background-color: #f3f4f6;
}

.calendar-cell--empty {
  cursor: default;
}

.calendar-cell--selected {
  background-color: var(--note-accent, #f44336) !important;
  color: white;
  font-weight: 600;
}

.calendar-cell--has-note::after {
  content: '';
  position: absolute;
  bottom: 2px;
  left: 50%;
  transform: translateX(-50%);
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--note-accent, #f44336);
}

.calendar-cell--selected.calendar-cell--has-note::after {
  background: white;
}

.calendar-cell--today {
  font-weight: 600;
  color: var(--note-accent, #f44336);
}

.note-textarea {
  flex: 1;
  display: block;
  width: calc(100% - 24px);
  margin: 12px;
  padding: 10px;
  border: 1px solid #e5e7eb;
  background: #ffffff;
  color: #111827;
  border-radius: 8px;
  font-family: inherit;
  font-size: 14px;
  line-height: 1.5;
  resize: none;
  outline: none;
}

.note-textarea:focus {
  border-color: var(--note-accent, #f44336);
  box-shadow: 0 0 0 3px rgba(244, 67, 54, 0.1);
}

.note-resize-handle {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 16px;
  height: 16px;
  cursor: se-resize;
  z-index: 1;
  background: repeating-linear-gradient(
    135deg,
    #d1d5db,
    #d1d5db 2px,
    transparent 2px,
    transparent 4px
  );
  border-radius: 0 0 12px 0;
}
</style>
