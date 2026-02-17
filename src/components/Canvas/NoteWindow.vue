<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import { useHistoryStore } from '../../stores/history';
import { useViewportStore } from '../../stores/viewport';
import { useNotesStore } from '../../stores/notes';
import { useBoardStore } from '../../stores/board';
import {
  NOTE_COLORS,
  formatLocalYMD,
  getMonthMatrix,
  adjustViewDate
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
const notesStore = useNotesStore();
const boardStore = useBoardStore();
const { t } = useI18n();
const { zoomScale } = storeToRefs(viewportStore);

// ============================================
// ЛОКАЛЬНОЕ СОСТОЯНИЕ ДЛЯ UI ОКНА
// ============================================

// Состояние окна заметки (раньше хранилось в card.note)
const noteWindowState = ref({
  x: 0,
  y: 0,
  width: 260,
  height: 380,
  offsetX: null,
  offsetY: null,
  selectedDate: formatLocalYMD(new Date()),
  viewDate: `${formatLocalYMD(new Date()).slice(0, 7)}-01`,
  highlightColor: NOTE_COLORS[0]
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

// Zoom/magnify mode
const isZoomed = ref(false);
const savedBeforeZoom = ref(null);

// ============================================
// COMPUTED СВОЙСТВА
// ============================================

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

const monthState = ref(resolveMonthState(noteWindowState.value.viewDate));
const selectedDate = computed(() => noteWindowState.value.selectedDate);

// Получаем все заметки для текущей карточки из store
const cardNotes = computed(() => notesStore.getNotesForCard(props.card.id));

// Получаем текущую заметку для выбранной даты
const currentNote = computed(() => {
  const note = notesStore.getNote(props.card.id, selectedDate.value);
  return note || { content: '', color: '' };
});

// Цвет для текущей даты
const selectedColor = computed(() => {
  return currentNote.value.color || noteWindowState.value.highlightColor;
});

const effectiveScale = computed(() => {
  const value = Number(zoomScale.value);
  return Number.isFinite(value) && value > 0 ? value : 1;
});

const VIEWPORT_MARGIN = 16;

function clampNotePosition(options = {}) {
  if (typeof window === 'undefined') {
    return;
  }

  const scale = Number.isFinite(options.scale) && options.scale > 0 ? options.scale : effectiveScale.value;
  const width = Math.max(0, (options.width ?? noteWindowState.value.width) * scale);
  const height = Math.max(0, (options.height ?? noteWindowState.value.height) * scale);

  const maxLeft = Math.max(VIEWPORT_MARGIN, window.innerWidth - width - VIEWPORT_MARGIN);
  const maxTop = Math.max(VIEWPORT_MARGIN, window.innerHeight - height - VIEWPORT_MARGIN);

  const nextX = Math.min(Math.max(noteWindowState.value.x, VIEWPORT_MARGIN), maxLeft);
  const nextY = Math.min(Math.max(noteWindowState.value.y, VIEWPORT_MARGIN), maxTop);

  if (noteWindowState.value.x !== nextX) {
    noteWindowState.value.x = nextX;
  }
  if (noteWindowState.value.y !== nextY) {
    noteWindowState.value.y = nextY;
  }
}

const noteStyle = computed(() => {
  if (isZoomed.value) {
    // Zoomed mode: fill screen from top menu (~70px) to scale bar (~60px from bottom)
    const topOffset = 70;
    const bottomOffset = 60;
    const sideMargin = 24;
    const availableHeight = window.innerHeight - topOffset - bottomOffset;
    const availableWidth = window.innerWidth - sideMargin * 2;

    // Calculate proportional size based on original aspect ratio
    const origW = noteWindowState.value.width;
    const origH = noteWindowState.value.height;
    const ratio = origW / origH;

    let zoomedW = availableWidth;
    let zoomedH = zoomedW / ratio;

    if (zoomedH > availableHeight) {
      zoomedH = availableHeight;
      zoomedW = zoomedH * ratio;
    }

    const left = (window.innerWidth - zoomedW) / 2;
    const top = topOffset;

    return {
      left: `${left}px`,
      top: `${top}px`,
      width: `${zoomedW}px`,
      height: `${zoomedH}px`,
      '--note-accent': noteWindowState.value.highlightColor || NOTE_COLORS[0],
      transform: 'scale(1)',
      transformOrigin: 'top left',
      transition: 'left 0.3s ease, top 0.3s ease, width 0.3s ease, height 0.3s ease'
    };
  }

  const scale = effectiveScale.value;
  return {
    left: `${noteWindowState.value.x}px`,
    top: `${noteWindowState.value.y}px`,
    width: `${noteWindowState.value.width}px`,
    height: `${noteWindowState.value.height}px`,
    '--note-accent': noteWindowState.value.highlightColor || NOTE_COLORS[0],
    transform: `scale(${scale})`,
    transformOrigin: 'top left'
  };
});

const colorDots = computed(() => NOTE_COLORS.map(color => ({
  color,
  active: selectedColor.value === color
})));

const monthTitle = computed(() => monthState.value.title || '');

const daysGrid = computed(() => (monthState.value.days || []).map(day => {
  const noteForDay = notesStore.getNote(props.card.id, day.date);
  const hasContent = noteForDay && noteForDay.content && noteForDay.content.trim().length > 0;
  const color = (noteForDay && noteForDay.color) || noteWindowState.value.highlightColor;
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

// ============================================
// ФУНКЦИИ
// ============================================

function focusTextarea() {
  nextTick(() => {
    textareaRef.value?.focus();
  });
}

function updateTextareaFromEntry() {
  textareaValue.value = currentNote.value.content || '';
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
    || !Number.isFinite(noteWindowState.value.offsetX)
    || !Number.isFinite(noteWindowState.value.offsetY);

  if (shouldForce) {
    // Первоначальная установка позиции справа от карточки
    const cardWidth = Number.isFinite(rect.width) ? rect.width : 0;
    const gap = 15;
    noteWindowState.value.offsetX = cardWidth + gap;
    noteWindowState.value.offsetY = 0;

    if (rect.height) {
      noteWindowState.value.height = Math.max(rect.height, 380);
    }
  }

  noteWindowState.value.x = rect.left + noteWindowState.value.offsetX * scale;
  noteWindowState.value.y = rect.top + noteWindowState.value.offsetY * scale;

  clampNotePosition({ scale });

  // Обновляем смещения
  noteWindowState.value.offsetX = (noteWindowState.value.x - rect.left) / scale;
  noteWindowState.value.offsetY = (noteWindowState.value.y - rect.top) / scale;

  emit('sync', { x: noteWindowState.value.x, y: noteWindowState.value.y });
}

function commitHistory(description = 'Обновлена заметка') {
  historyStore.setActionMetadata('update', `${description} "${props.card.text}"`);
  historyStore.saveState();
}

function toggleZoom() {
  if (isZoomed.value) {
    // Restore original state
    isZoomed.value = false;
  } else {
    // Save current state and zoom in
    isZoomed.value = true;
  }
}

function handleClose() {
  isZoomed.value = false;
  emit('close');
  commitHistory('Закрыта заметка для карточки');
}

function handleDayClick(day) {
  noteWindowState.value.selectedDate = day.date;

  // Обновляем highlightColor на основе заметки для выбранной даты
  const note = notesStore.getNote(props.card.id, day.date);
  if (note && note.color) {
    noteWindowState.value.highlightColor = note.color;
  }

  updateTextareaFromEntry();
  focusTextarea();
}

function handlePrevMonth() {
  noteWindowState.value.viewDate = adjustViewDate(noteWindowState.value.viewDate, -1);
  monthState.value = resolveMonthState(noteWindowState.value.viewDate);
}

function handleNextMonth() {
  noteWindowState.value.viewDate = adjustViewDate(noteWindowState.value.viewDate, 1);
  monthState.value = resolveMonthState(noteWindowState.value.viewDate);
}

async function handleColorSelect(color) {
  if (!selectedDate.value || !boardStore.currentBoardId) {
    return;
  }

  // Обновляем локальный цвет
  noteWindowState.value.highlightColor = color;

  // Сохраняем только если есть текст в заметке
  const content = textareaValue.value || '';
  if (content.trim()) {
    try {
      const result = await notesStore.saveNote({
        boardId: boardStore.currentBoardId,
        cardUid: props.card.id,
        noteDate: selectedDate.value,
        content: content,
        color: color
      });

      // Проверяем, не вернулась ли ошибка лимита
      if (result && result.error && result.code === 'USAGE_LIMIT_REACHED') {
        // Ошибка уже показана пользователю в alert, просто прекращаем выполнение
        return;
      }

      commitHistory('Изменен цвет заметки для карточки');
    } catch (error) {
      console.error('Ошибка сохранения цвета:', error);
    }
  }
}

function handleTextareaInput(event) {
  const value = event.target.value;
  textareaValue.value = value;
}

async function handleTextareaBlur() {
  if (!boardStore.currentBoardId) {
    return;
  }

  const content = textareaValue.value || '';

  try {
    // Сохраняем заметку только если есть текст
    // Если текст пустой, отправляем пустое содержимое для удаления
    const result = await notesStore.saveNote({
      boardId: boardStore.currentBoardId,
      cardUid: props.card.id,
      noteDate: selectedDate.value,
      content: content,
      color: selectedColor.value || ''
    });

    // Проверяем, не вернулась ли ошибка лимита
    if (result && result.error && result.code === 'USAGE_LIMIT_REACHED') {
      // Ошибка уже показана пользователю в alert, просто прекращаем выполнение
      return;
    }

    if (content.trim()) {
      commitHistory('Обновлена заметка для карточки');
    } else {
      commitHistory('Удалена пустая заметка для карточки');
    }
  } catch (error) {
    console.error('Ошибка сохранения заметки:', error);
  }
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
  noteWindowState.value.x = initialPosition.value.x + dx;
  noteWindowState.value.y = initialPosition.value.y + dy;
  clampNotePosition();
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
      const scale = effectiveScale.value;
      noteWindowState.value.offsetX = (noteWindowState.value.x - rect.left) / scale;
      noteWindowState.value.offsetY = (noteWindowState.value.y - rect.top) / scale;
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
    width: windowEl.value?.offsetWidth || noteWindowState.value.width,
    height: windowEl.value?.offsetHeight || noteWindowState.value.height
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
  noteWindowState.value.width = nextWidth;
  noteWindowState.value.height = nextHeight;
  clampNotePosition({ width: nextWidth, height: nextHeight });
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

watch(() => noteWindowState.value.viewDate, (value) => {
  monthState.value = resolveMonthState(value);
});

watch(
  () => [noteWindowState.value.x, noteWindowState.value.y, noteWindowState.value.width, noteWindowState.value.height, effectiveScale.value],
  () => {
    clampNotePosition();
  },
  { immediate: true }
);

watch(selectedDate, () => {
  updateTextareaFromEntry();
});

watch(() => noteWindowState.value.highlightColor, (color) => {
  if (windowEl.value) {
    windowEl.value.style.setProperty('--note-accent', color);
  }
});

onMounted(() => {
  cardElement.value = ensureCardElement();
  syncWithCardPosition({ forceAlign: true });
  updateTextareaFromEntry();
  nextTick(() => {
    if (windowEl.value) {
      windowEl.value.style.setProperty('--note-accent', noteWindowState.value.highlightColor);
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
  syncWithCardPosition,
  setZoomed(value) { isZoomed.value = value; }
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
        @pointerdown.prevent="!isZoomed && startDrag($event)"
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
        <button
          class="note-header__zoom"
          type="button"
          :title="isZoomed ? t('noteWindow.zoomOut') : t('noteWindow.zoomIn')"
          @pointerdown.stop
          @click.stop="toggleZoom"
        >
          {{ isZoomed ? '🔍' : '🔎' }}
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
        v-if="!isZoomed"
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
  background: rgba(30, 41, 59, 0.95);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  min-width: 200px;
  min-height: 200px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: 10000;
  border: 1px solid rgba(255, 255, 255, 0.1);
  transform-origin: top left;
  will-change: transform;
  backdrop-filter: blur(8px);
}

.note-window::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  border-radius: inherit;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.05);
}

.note-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: linear-gradient(135deg, rgba(244, 67, 54, 0.15), rgba(51, 65, 85, 0.9));
  gap: 12px;
  cursor: grab;
  user-select: none;
}

.note-header:active {
  cursor: grabbing;
}

.note-header__close {
  border: none;
  background: rgba(255, 255, 255, 0.1);
  color: #e2e8f0;
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
  background: rgba(255, 255, 255, 0.2);
}

.note-header__zoom {
  border: none;
  background: rgba(255, 255, 255, 0.1);
  color: #e2e8f0;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  font-size: 16px;
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: background 0.2s ease;
}

.note-header__zoom:hover {
  background: rgba(255, 255, 255, 0.2);
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
  border: 2px solid rgba(255, 255, 255, 0.3);
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}

.clr-dot:hover {
  transform: translateY(-1px) scale(1.05);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
}

.clr-dot.active {
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.3), inset 0 0 0 2px rgba(30, 41, 59, 0.8);
  border-color: rgba(255, 255, 255, 0.6);
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
  color: #e2e8f0;
}

.note-calendar__nav-btn {
  border: none;
  background: rgba(255, 255, 255, 0.1);
  color: #e2e8f0;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s ease;
}

.note-calendar__nav-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.note-calendar__grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}

.note-calendar__grid--header {
  font-size: 12px;
  font-weight: 600;
  color: #94a3b8;
  text-transform: uppercase;
}

.note-calendar__weekday {
  display: grid;
  place-items: center;
}

.note-calendar__cell {
  border: none;
  background: rgba(51, 65, 85, 0.6);
  color: #e2e8f0;
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
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
  background: rgba(71, 85, 105, 0.8);
}

.note-calendar__cell.selected {
  outline: 2px solid var(--note-accent);
  background: rgba(59, 130, 246, 0.2);
}

.note-calendar__cell.has-entry {
  color: #fff;
  box-shadow: inset 0 0 0 2px rgba(0, 0, 0, 0.15);
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
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 14px;
  line-height: 1.4;
  font-family: inherit;
  color: #e2e8f0;
  background: rgba(51, 65, 85, 0.5);
  transition: border 0.2s ease, box-shadow 0.2s ease;
  min-height: calc(1.4em * 3 + 20px);
}

.note-textarea::placeholder {
  color: #94a3b8;
}

.note-textarea:focus {
  outline: none;
  border-color: var(--note-accent);
  box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.2);
  background: rgba(51, 65, 85, 0.7);
}

.note-resize-handle {
  position: absolute;
  right: 4px;
  bottom: 2px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.1);
  color: #94a3b8;
  cursor: se-resize;
  display: grid;
  place-items: center;
  font-size: 18px;
  transition: background 0.2s ease;
}

.note-resize-handle:hover {
  background: rgba(255, 255, 255, 0.2);
}
</style>
