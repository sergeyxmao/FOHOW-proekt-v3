<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { storeToRefs } from 'pinia';  
import { useHistoryStore } from '../../stores/history';
import { useViewportStore } from '../../stores/viewport';  
import {
  NOTE_COLORS,
  ensureNoteStructure,
  formatLocalYMD,
  setNoteEntryValue,
  getNoteEntryInfo,
  getMonthMatrix,
  adjustViewDate,
  applyCardRectToNote,
  updateNoteOffsets,
  getSelectedColor,
  ensureSelectedDate
} from '../../utils/noteUtils';

const props = defineProps({
  card: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['close', 'sync']);

const historyStore = useHistoryStore();
const viewportStore = useViewportStore();
const { zoomScale } = storeToRefs(viewportStore);  

const note = computed(() => {
  const normalized = ensureNoteStructure(props.card.note);
  if (normalized !== props.card.note) {
    props.card.note = normalized;
  }
  return normalized;
});const windowEl = ref(null);
const textareaRef = ref(null);
const headerRef = ref(null);
const resizeHandleRef = ref(null);
const isDragging = ref(false);
const dragPointerId = ref(null);
const dragStart = ref({ x: 0, y: 0 });
const initialPosition = ref({ x: 0, y: 0 });
const isResizing = ref(false);
const resizePointerId = ref(null);
const resizeStart = ref({ x: 0, y: 0, width: 0, height: 0 });
const cardElement = ref(null);
const textareaValue = ref('');

function resolveMonthState(viewDate) {
  const state = getMonthMatrix(viewDate);
  if (!state || !Array.isArray(state.days)) {
    return {
      days: [],
      title: '',
      month: 0,
      year: 0,
      firstDay: new Date()
    };
  }
  return state;
}

const monthState = ref(resolveMonthState(note.value.viewDate));
const selectedDate = computed(() => ensureSelectedDate(note.value, formatLocalYMD(new Date())));
const selectedColor = computed(() => getSelectedColor(note.value));

const effectiveScale = computed(() => {
  const value = Number(zoomScale.value);
  return Number.isFinite(value) && value > 0 ? value : 1;
});

const noteStyle = computed(() => {
  const scale = effectiveScale.value;
  return {
    left: `${note.value.x}px`,
    top: `${note.value.y}px`,
    width: `${note.value.width}px`,
    height: `${note.value.height}px`,
    '--note-accent': note.value.highlightColor || NOTE_COLORS[0],
    transform: `scale(${scale})`,
    transformOrigin: 'top left'
  };
});

const colorDots = computed(() => NOTE_COLORS.map(color => ({
  color,
  active: note.value.colors[selectedDate.value] === color
})));

const monthTitle = computed(() => monthState.value.title || '');

const daysGrid = computed(() => (monthState.value.days || []).map(day => {
  const entry = getNoteEntryInfo(note.value.entries[day.date]);
  const hasContent = entry.text.trim().length > 0;
  const color = note.value.colors[day.date] || note.value.highlightColor;
  const isSelected = day.date === selectedDate.value;
  return {
    ...day,
    hasContent,
    color,
    isSelected,
    isOut: !day.inMonth
  };
}));

const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

function focusTextarea() {
  nextTick(() => {
    textareaRef.value?.focus();
  });
}

function updateTextareaFromEntry() {
  const entry = getNoteEntryInfo(note.value.entries[selectedDate.value]);
  textareaValue.value = entry.text;
}

function ensureCardElement() {
  if (!cardElement.value) {
    cardElement.value = document.querySelector(`[data-card-id="${props.card.id}"]`);
  }
  return cardElement.value;
}

function syncWithCardPosition(options = {}) {
  const element = ensureCardElement();
  if (!element) {
    return;
  }
  const rect = element.getBoundingClientRect();
  const scale = Number.isFinite(options.scale) && options.scale > 0 ? options.scale : effectiveScale.value;
  const shouldForce = Boolean(options.forceAlign)
    || !Number.isFinite(note.value.offsetX)
    || !Number.isFinite(note.value.offsetY);

  if (shouldForce) {
    applyCardRectToNote(note.value, rect, {
      scale,
      align: 'right',
      forceAlign: true
    });
  } else {
    note.value.x = rect.left + note.value.offsetX * scale;
    note.value.y = rect.top + note.value.offsetY * scale;
  }
  updateNoteOffsets(note.value, rect, { scale });
  emit('sync', { x: note.value.x, y: note.value.y });
}

function commitHistory(description = 'Обновлена заметка') {
  historyStore.setActionMetadata('update', `${description} "${props.card.text}"`);
  historyStore.saveState();
}

function handleClose() {
  emit('close');
  commitHistory('Закрыта заметка для карточки');
}

function handleDayClick(day) {
  note.value.selectedDate = day.date;
  if (!note.value.colors[note.value.selectedDate]) {
    note.value.highlightColor = selectedColor.value;
  }
  updateTextareaFromEntry();
  focusTextarea();
}

function handlePrevMonth() {
  note.value.viewDate = adjustViewDate(note.value.viewDate, -1);
  monthState.value = resolveMonthState(note.value.viewDate);
}

function handleNextMonth() {
  note.value.viewDate = adjustViewDate(note.value.viewDate, 1);
  monthState.value = resolveMonthState(note.value.viewDate);
}

function handleColorSelect(color) {
  if (!selectedDate.value) {
    return;
  }
  note.value.colors[selectedDate.value] = color;
  note.value.highlightColor = color;
  commitHistory('Изменен цвет заметки для карточки');
}

function handleTextareaInput(event) {
  const value = event.target.value;
  textareaValue.value = value;
  setNoteEntryValue(note.value, selectedDate.value, value);
}

function handleTextareaBlur() {
  commitHistory('Обновлена заметка для карточки');
}

function startDrag(event) {
  if (isResizing.value) {
    return;
  }
  isDragging.value = true;
  dragPointerId.value = event.pointerId;
  dragStart.value = { x: event.clientX, y: event.clientY };
  initialPosition.value = { x: note.value.x, y: note.value.y };
  headerRef.value?.setPointerCapture?.(event.pointerId);
  window.addEventListener('pointermove', onDragMove, { passive: false });
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);
}

function onDragMove(event) {
  if (!isDragging.value || (dragPointerId.value !== null && event.pointerId !== dragPointerId.value)) {
    return;
  }
  event.preventDefault();
  const dx = event.clientX - dragStart.value.x;
  const dy = event.clientY - dragStart.value.y;
  note.value.x = initialPosition.value.x + dx;
  note.value.y = initialPosition.value.y + dy;
}

function endDrag(event) {
  if (dragPointerId.value !== null && event.pointerId !== undefined && event.pointerId !== dragPointerId.value) {
    return;
  }
  window.removeEventListener('pointermove', onDragMove);
  window.removeEventListener('pointerup', endDrag);
  window.removeEventListener('pointercancel', endDrag);
  if (isDragging.value) {
    const element = ensureCardElement();
    if (element) {
      const rect = element.getBoundingClientRect();
      updateNoteOffsets(note.value, rect, { scale: effectiveScale.value });
    }
  }
  isDragging.value = false;
  dragPointerId.value = null;
  commitHistory('Перемещено окно заметки для карточки');
}

function startResize(event) {
  isResizing.value = true;
  resizePointerId.value = event.pointerId;
  resizeStart.value = {
    x: event.clientX,
    y: event.clientY,
    width: windowEl.value?.offsetWidth || note.value.width,
    height: windowEl.value?.offsetHeight || note.value.height
  };
  resizeHandleRef.value?.setPointerCapture?.(event.pointerId);
  window.addEventListener('pointermove', onResizeMove, { passive: false });
  window.addEventListener('pointerup', endResize);
  window.addEventListener('pointercancel', endResize);
}

function onResizeMove(event) {
  if (!isResizing.value || (resizePointerId.value !== null && event.pointerId !== resizePointerId.value)) {
    return;
  }
  event.preventDefault();
  const dx = event.clientX - resizeStart.value.x;
  const dy = event.clientY - resizeStart.value.y;
  const nextWidth = Math.max(200, resizeStart.value.width + dx);
  const nextHeight = Math.max(200, resizeStart.value.height + dy);
  note.value.width = nextWidth;
  note.value.height = nextHeight;
}

function endResize(event) {
  if (resizePointerId.value !== null && event.pointerId !== undefined && event.pointerId !== resizePointerId.value) {
    return;
  }
  window.removeEventListener('pointermove', onResizeMove);
  window.removeEventListener('pointerup', endResize);
  window.removeEventListener('pointercancel', endResize);
  isResizing.value = false;
  resizePointerId.value = null;
  commitHistory('Изменен размер окна заметки');
}

watch(() => note.value.viewDate, (value) => {
  monthState.value = resolveMonthState(value);
});

watch(selectedDate, () => {
  updateTextareaFromEntry();
  note.value.highlightColor = selectedColor.value;
});

watch(() => note.value.highlightColor, (color) => {
  if (windowEl.value) {
    windowEl.value.style.setProperty('--note-accent', color);
  }
});

onMounted(() => {
  cardElement.value = ensureCardElement();
  syncWithCardPosition({ force: true });
  updateTextareaFromEntry();
  nextTick(() => {
    if (windowEl.value) {
      windowEl.value.style.setProperty('--note-accent', note.value.highlightColor);
    }
  });
});

onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onDragMove);
  window.removeEventListener('pointerup', endDrag);
  window.removeEventListener('pointercancel', endDrag);
  window.removeEventListener('pointermove', onResizeMove);
  window.removeEventListener('pointerup', endResize);
  window.removeEventListener('pointercancel', endResize);
});

defineExpose({
  syncWithCardPosition
});
</script>

<template>
  <teleport to="body">
    <div
      ref="windowEl"
      class="note-window"
      :style="noteStyle"
    >
      <div
        ref="headerRef"
        class="note-header"
        @pointerdown.prevent="startDrag"
      >
        <button
          class="note-header__close"
          type="button"
          title="Закрыть"
          @click="handleClose"
          @pointerdown.stop
          @click.stop="handleClose"          
        >
          ×
        </button>
        <div class="note-header__colors">
          <button
            v-for="dot in colorDots"
            :key="dot.color"
            class="clr-dot"
          :class="{ active: dot.active }"
          :style="{ backgroundColor: dot.color }"
          type="button"
          @pointerdown.stop
          @click.stop="handleColorSelect(dot.color)"
        ></button>
        </div>
      </div>
      <div class="note-calendar">
        <div class="note-calendar__nav">
          <button type="button" class="note-calendar__nav-btn" @click="handlePrevMonth">◀</button>
          <div class="note-calendar__title">{{ monthTitle }}</div>
          <button type="button" class="note-calendar__nav-btn" @click="handleNextMonth">▶</button>
        </div>
        <div class="note-calendar__grid note-calendar__grid--header">
          <span v-for="weekday in weekdays" :key="weekday" class="note-calendar__weekday">{{ weekday }}</span>
        </div>
        <div class="note-calendar__grid">
          <button
            v-for="day in daysGrid"
            :key="day.date"
            type="button"
            class="note-calendar__cell"
            :class="{
              selected: day.isSelected,
              'has-entry': day.hasContent,
              out: day.isOut
            }"
            :style="day.hasContent ? { backgroundColor: day.color, color: '#fff' } : {}"
            @click="handleDayClick(day)"
          >
            {{ day.label }}
          </button>
        </div>
      </div>
      <div class="note-editor">
        <textarea
          ref="textareaRef"
          class="note-textarea"
          placeholder="Введите текст заметки..."
          :value="textareaValue"
          @input="handleTextareaInput"
          @blur="handleTextareaBlur"
        ></textarea>
      </div>
      <button
        ref="resizeHandleRef"
        class="note-resize-handle"
        type="button"
        title="Изменить размер"
        @pointerdown.prevent="startResize"
      >
        ⋰
      </button>
    </div>
  </teleport>
</template>

<style scoped>
.note-window {
  position: fixed;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  min-width: 200px;
  min-height: 200px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: 10000;
  border: 1px solid rgba(15, 23, 42, 0.12);
  transform-origin: top left;
  will-change: transform;  
}

.note-window::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  border-radius: inherit;
  box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.04);
}

.note-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: linear-gradient(135deg, rgba(244, 67, 54, 0.12), rgba(255, 255, 255, 0.9));
  gap: 12px;
  cursor: grab;
  user-select: none;
}

.note-header:active {
  cursor: grabbing;
}

.note-header__close {
  border: none;
  background: rgba(15, 23, 42, 0.08);
  color: #0f172a;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  font-size: 18px;
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: background 0.2s ease;
}

.note-header__close:hover {
  background: rgba(15, 23, 42, 0.16);
}

.note-header__colors {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-left: auto;
}

.clr-dot {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid rgba(15, 23, 42, 0.32);
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}

.clr-dot:hover {
  transform: translateY(-1px) scale(1.05);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.18);
}

.clr-dot.active {
  box-shadow: 0 0 0 2px rgba(15, 23, 42, 0.22), inset 0 0 0 2px #fff;
  border-color: rgba(15, 23, 42, 0.65);
}

.note-calendar {
  padding: 12px 16px 8px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.note-calendar__nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.note-calendar__title {
  font-weight: 600;
  text-transform: capitalize;
  color: #0f172a;
}

.note-calendar__nav-btn {
  border: none;
  background: rgba(15, 23, 42, 0.08);
  color: #0f172a;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s ease;
}

.note-calendar__nav-btn:hover {
  background: rgba(15, 23, 42, 0.16);
}

.note-calendar__grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}

.note-calendar__grid--header {
  font-size: 12px;
  font-weight: 600;
  color: #475569;
  text-transform: uppercase;
}

.note-calendar__weekday {
  display: grid;
  place-items: center;
}

.note-calendar__cell {
  border: none;
  background: rgba(241, 245, 249, 0.9);
  color: #0f172a;
  height: 28px;
  border-radius: 6px;
  font-size: 13px;
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease, color 0.15s ease;
  position: relative;
}

.note-calendar__cell:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 10px rgba(15, 23, 42, 0.15);
}

.note-calendar__cell.selected {
  outline: 2px solid var(--note-accent);
  background: rgba(59, 130, 246, 0.08);
}

.note-calendar__cell.has-entry {
  color: #fff;
  box-shadow: inset 0 0 0 2px rgba(0, 0, 0, 0.08);
}

.note-calendar__cell.out {
  opacity: 0.4;
}

.note-editor {
  padding: 0 16px 16px;
  flex: 1;
  display: flex;
}

.note-textarea {
  resize: none;
  width: 100%;
  flex: 1;
  border: 1px solid rgba(15, 23, 42, 0.12);
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 14px;
  line-height: 1.4;
  font-family: inherit;
  color: #0f172a;
  background: rgba(248, 250, 252, 0.85);
  transition: border 0.2s ease, box-shadow 0.2s ease;
  min-height: calc(1.4em * 3 + 20px);  
}

.note-textarea:focus {
  outline: none;
  border-color: var(--note-accent);
  box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.2);
  background: #fff;
}

.note-resize-handle {
  position: absolute;
  right: 4px;
  bottom: 2px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: none;
  background: rgba(15, 23, 42, 0.08);
  color: #0f172a;
  cursor: se-resize;
  display: grid;
  place-items: center;
  font-size: 18px;
  transition: background 0.2s ease;
}

.note-resize-handle:hover {
  background: rgba(15, 23, 42, 0.16);
}
</style>
