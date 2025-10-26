<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

const props = defineProps({
  snapshot: {
    type: String,
    required: true
  },
  bounds: {
    type: Object,
    required: true,
    validator(value) {
      return (
        value &&
        typeof value.top === 'number' &&
        typeof value.left === 'number' &&
        typeof value.width === 'number' &&
        typeof value.height === 'number'
      );
    }
  }
});

const emit = defineEmits(['close']);

const drawingCanvasRef = ref(null);
const canvasContext = ref(null);
const canvasWidth = ref(0);
const canvasHeight = ref(0);
const isReady = ref(false);
const activePointerId = ref(null);
const lastPoint = ref(null);
const isDrawing = ref(false);
const currentTool = ref('brush');
const brushColor = ref('#ff4757');
const brushSize = ref(4);
const textColor = ref('#111827');
const textSize = ref(24);
const isTextBold = ref(false);
const texts = ref([]);
const selectedTextId = ref(null);
const baseImage = ref(null);
const textInputRefs = new Map();
let previousHtmlOverflow = '';
let previousBodyOverflow = '';

const boardClasses = computed(() => [
  'pencil-overlay__board',
  currentTool.value === 'text'
    ? 'pencil-overlay__board--text'
    : 'pencil-overlay__board--brush'
]);

const boardStyle = computed(() => ({
  top: `${props.bounds.top}px`,
  left: `${props.bounds.left}px`,
  width: `${canvasWidth.value}px`,
  height: `${canvasHeight.value}px`,
  backgroundImage: `url(${props.snapshot})`
}));

const panelStyle = computed(() => {
  const offset = 16;
  const top = Math.max(props.bounds.top - offset, offset);
  const left = Math.max(props.bounds.left, offset);

  return {
    top: `${top}px`,
    left: `${left}px`
  };
});

const registerTextInput = (id, el) => {
  if (el) {
    textInputRefs.set(id, el);
  } else {
    textInputRefs.delete(id);
  }
};

const focusTextInput = (id) => {
  nextTick(() => {
    const element = textInputRefs.get(id);
    if (element) {
      element.focus();
      element.select();
    }
  });
};

const getCanvasPoint = (event) => {
  const canvas = drawingCanvasRef.value;
  if (!canvas) return null;

  const rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };
};

const startStroke = (point) => {
  if (!canvasContext.value) return;

  canvasContext.value.lineCap = 'round';
  canvasContext.value.lineJoin = 'round';
  canvasContext.value.strokeStyle = brushColor.value;
  canvasContext.value.lineWidth = brushSize.value;
  canvasContext.value.beginPath();
  canvasContext.value.moveTo(point.x, point.y);
  lastPoint.value = point;
  isDrawing.value = true;
};

const continueStroke = (point) => {
  if (!canvasContext.value || !isDrawing.value || !lastPoint.value) return;

  canvasContext.value.lineTo(point.x, point.y);
  canvasContext.value.stroke();
  lastPoint.value = point;
};

const finishStroke = () => {
  if (!canvasContext.value || !isDrawing.value) return;

  canvasContext.value.closePath();
  isDrawing.value = false;
  lastPoint.value = null;
  activePointerId.value = null;
};

const createTextEntry = (point) => {
  const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  texts.value.push({
    id,
    x: point.x,
    y: point.y,
    color: textColor.value,
    size: textSize.value,
    bold: isTextBold.value,
    content: '',
    isEditing: true
  });

  selectedTextId.value = id;
  focusTextInput(id);
};

const selectText = (id) => {
  const entry = texts.value.find((item) => item.id === id);
  if (!entry) return;

  selectedTextId.value = id;
};

const editText = (id) => {
  const entry = texts.value.find((item) => item.id === id);
  if (!entry) return;

  entry.isEditing = true;
  selectedTextId.value = id;
  focusTextInput(id);
};

const finishText = (id) => {
  const entryIndex = texts.value.findIndex((item) => item.id === id);
  if (entryIndex === -1) return;

  const entry = texts.value[entryIndex];
  entry.content = entry.content.replace(/\s+$/u, '');
  entry.isEditing = false;

  if (!entry.content.trim()) {
    texts.value.splice(entryIndex, 1);
    if (selectedTextId.value === id) {
      selectedTextId.value = null;
    }
  }
};

const handleTextKeydown = (event, id) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    finishText(id);
  }
};

const handleCanvasPointerDown = (event) => {
  if (event.button !== 0) return;

  if (currentTool.value === 'brush') {
    const point = getCanvasPoint(event);
    if (!point) return;

    const canvas = drawingCanvasRef.value;
    canvas.setPointerCapture(event.pointerId);
    activePointerId.value = event.pointerId;
    startStroke(point);
  } else if (currentTool.value === 'text') {
    const point = getCanvasPoint(event);
    if (!point) return;
    createTextEntry(point);
  }
};

const handleCanvasPointerMove = (event) => {
  if (currentTool.value !== 'brush') return;
  if (!isDrawing.value || activePointerId.value !== event.pointerId) return;

  const point = getCanvasPoint(event);
  if (!point) return;

  continueStroke(point);
};

const handleCanvasPointerUp = (event) => {
  if (currentTool.value !== 'brush') return;
  if (activePointerId.value !== event.pointerId) return;

  const canvas = drawingCanvasRef.value;
  canvas.releasePointerCapture(event.pointerId);
  finishStroke();
};

const handleCanvasPointerLeave = (event) => {
  if (currentTool.value !== 'brush') return;
  if (activePointerId.value !== event.pointerId) return;

  finishStroke();
};

const exportFinalImage = () => {
  if (!baseImage.value || !drawingCanvasRef.value) {
    return null;
  }

  const resultCanvas = document.createElement('canvas');
  resultCanvas.width = baseImage.value.width;
  resultCanvas.height = baseImage.value.height;

  const ctx = resultCanvas.getContext('2d');
  ctx.drawImage(baseImage.value, 0, 0);
  ctx.drawImage(drawingCanvasRef.value, 0, 0);

  texts.value.forEach((entry) => {
    if (!entry.content.trim()) {
      return;
    }

    ctx.save();
    ctx.fillStyle = entry.color;
    ctx.font = `${entry.bold ? 'bold ' : ''}${entry.size}px Inter, 'Segoe UI', Roboto, sans-serif`;
    ctx.textBaseline = 'top';
    const lineHeight = entry.size * 1.25;
    entry.content.split('\n').forEach((line, index) => {
      ctx.fillText(line, entry.x, entry.y + index * lineHeight);
    });
    ctx.restore();
  });

  return resultCanvas.toDataURL('image/png');
};

const handleClose = () => {
  const image = exportFinalImage();
  emit('close', { image });
};

const handleKeydown = (event) => {
  if (event.key === 'Escape') {
    event.preventDefault();
    handleClose();
  }
};

const loadBaseImage = () => {
  const image = new Image();
  image.onload = () => {
    baseImage.value = image;
    canvasWidth.value = image.width;
    canvasHeight.value = image.height;

    isReady.value = true;

    nextTick(() => {
      const canvas = drawingCanvasRef.value;
      if (!canvas) {
        console.error('Не удалось получить ссылку на холст режима карандаша после инициализации');
        return;
      }

      canvas.width = image.width;
      canvas.height = image.height;
      canvasContext.value = canvas.getContext('2d');
    });    
  };
  image.onerror = () => {
    console.error('Не удалось загрузить базовый снимок для режима карандаша');
  };
  image.src = props.snapshot;
};

watch(selectedTextId, (id) => {
  if (!id) {
    return;
  }
  const entry = texts.value.find((item) => item.id === id);
  if (!entry) {
    return;
  }

  textColor.value = entry.color;
  textSize.value = entry.size;
  isTextBold.value = entry.bold;
});

watch([textColor, textSize, isTextBold], ([color, size, bold]) => {
  if (!selectedTextId.value) {
    return;
  }

  const entry = texts.value.find((item) => item.id === selectedTextId.value);
  if (!entry) {
    return;
  }

  entry.color = color;
  entry.size = size;
  entry.bold = bold;
});

onMounted(() => {
  previousHtmlOverflow = document.documentElement.style.overflow;
  previousBodyOverflow = document.body.style.overflow;
  document.documentElement.style.overflow = 'hidden';
  document.body.style.overflow = 'hidden';
  window.addEventListener('keydown', handleKeydown);
  loadBaseImage();
});

onBeforeUnmount(() => {
  document.documentElement.style.overflow = previousHtmlOverflow;
  document.body.style.overflow = previousBodyOverflow;
  window.removeEventListener('keydown', handleKeydown);
});
</script>

<template>
  <div class="pencil-overlay">
    <div class="pencil-overlay__backdrop"></div>
    <div
      v-if="isReady"
      :class="boardClasses"
      :style="boardStyle"
    >
      <canvas
        ref="drawingCanvasRef"
        class="pencil-overlay__canvas"
        @pointerdown="handleCanvasPointerDown"
        @pointermove="handleCanvasPointerMove"
        @pointerup="handleCanvasPointerUp"
        @pointerleave="handleCanvasPointerLeave"
        @pointercancel="handleCanvasPointerLeave"
      ></canvas>
      <div
        v-for="entry in texts"
        :key="entry.id"
        :class="[
          'pencil-overlay__text',
          { 'pencil-overlay__text--selected': selectedTextId === entry.id }
        ]"
        :style="{
          top: `${entry.y}px`,
          left: `${entry.x}px`,
          color: entry.color,
          fontSize: `${entry.size}px`,
          fontWeight: entry.bold ? 700 : 400
        }"
        @pointerdown.stop="selectText(entry.id)"
        @dblclick.stop="editText(entry.id)"
      >
        <textarea
          v-if="entry.isEditing"
          :ref="(el) => registerTextInput(entry.id, el)"
          v-model="entry.content"
          class="pencil-overlay__text-input"
          spellcheck="false"
          @keydown="(event) => handleTextKeydown(event, entry.id)"
          @blur="() => finishText(entry.id)"
        ></textarea>
        <div v-else class="pencil-overlay__text-label">{{ entry.content || ' ' }}</div>
      </div>
    </div>

    <div
      class="pencil-overlay__panel"
      :style="panelStyle"
    >
      <button
        type="button"
        class="pencil-overlay__close"
        title="Сохранить и выйти"
        @click="handleClose"
      >
        ✕
      </button>
      <div class="pencil-overlay__section">
        <span class="pencil-overlay__section-title">Инструменты</span>
        <div class="pencil-overlay__tool-buttons">
          <button
            type="button"
            :class="[
              'pencil-overlay__tool-button',
              { 'pencil-overlay__tool-button--active': currentTool === 'brush' }
            ]"
            title="Карандаш"
            @click="currentTool = 'brush'"
          >
            ✏️
          </button>
          <button
            type="button"
            :class="[
              'pencil-overlay__tool-button',
              { 'pencil-overlay__tool-button--active': currentTool === 'text' }
            ]"
            title="Текст"
            @click="currentTool = 'text'"
          >
            T
          </button>
        </div>
      </div>

      <div class="pencil-overlay__section">
        <span class="pencil-overlay__section-title">Карандаш</span>
        <label class="pencil-overlay__control">
          <span>Цвет</span>
          <input v-model="brushColor" type="color" />
        </label>
        <label class="pencil-overlay__control">
          <span>Толщина: {{ brushSize }} px</span>
          <input
            v-model.number="brushSize"
            type="range"
            min="1"
            max="24"
          />
        </label>
      </div>

      <div class="pencil-overlay__section">
        <span class="pencil-overlay__section-title">Текст</span>
        <label class="pencil-overlay__control">
          <span>Цвет</span>
          <input v-model="textColor" type="color" />
        </label>
        <label class="pencil-overlay__control">
          <span>Размер: {{ textSize }} px</span>
          <input
            v-model.number="textSize"
            type="range"
            min="12"
            max="72"
          />
        </label>
        <label class="pencil-overlay__control pencil-overlay__control--inline">
          <input
            v-model="isTextBold"
            type="checkbox"
          />
          <span>Жирный шрифт</span>
        </label>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pencil-overlay {
  position: fixed;
  inset: 0;
  z-index: 4000;
  pointer-events: auto;
}

.pencil-overlay__backdrop {
  position: absolute;
  inset: 0;
  background: transparent;
  pointer-events: none;
}

.pencil-overlay__board {
  position: fixed;
  background-repeat: no-repeat;
  background-size: 100% 100%;
  background-position: top left;
  box-shadow: none;
  border-radius: 0;
  overflow: hidden;
  pointer-events: auto;
}

.pencil-overlay__board--brush {
  cursor: crosshair;
}

.pencil-overlay__board--text {
  cursor: text;
}

.pencil-overlay__canvas {
  display: block;
  width: 100%;
  height: 100%;
  touch-action: none;  
}

.pencil-overlay__text {
  position: absolute;
  min-width: 32px;
  min-height: 32px;
  padding: 2px 4px;
  white-space: pre-wrap;
  pointer-events: auto;
  user-select: none;
}

.pencil-overlay__text--selected::after {
  content: '';
  position: absolute;
  inset: 0;
  border: 1px dashed rgba(17, 24, 39, 0.4);
  pointer-events: none;
}

.pencil-overlay__text-input {
  min-width: 160px;
  min-height: 48px;
  padding: 6px 8px;
  border-radius: 8px;
  border: 1px solid rgba(148, 163, 184, 0.6);
  box-shadow: 0 12px 24px rgba(15, 23, 42, 0.15);
  background: rgba(255, 255, 255, 0.95);
  font: inherit;
  color: inherit;
  resize: none;
  outline: none;
  white-space: pre-wrap;
  user-select: text;  
}

.pencil-overlay__text-label {
  pointer-events: none;
}

.pencil-overlay__panel {
  position: fixed;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 18px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 24px 50px rgba(15, 23, 42, 0.35);
  pointer-events: auto;
  min-width: 220px;
}

.pencil-overlay__close {
  align-self: flex-end;
  border: none;
  background: transparent;
  font-size: 18px;
  cursor: pointer;
  color: #111827;
  transition: transform 0.2s ease;
}

.pencil-overlay__close:hover {
  transform: scale(1.1);
}

.pencil-overlay__section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.pencil-overlay__section-title {
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #475569;
}

.pencil-overlay__tool-buttons {
  display: flex;
  gap: 8px;
}

.pencil-overlay__tool-button {
  flex: 1;
  border: 1px solid rgba(148, 163, 184, 0.5);
  border-radius: 12px;
  padding: 8px 12px;
  background: rgba(248, 250, 252, 0.85);
  font-size: 16px;
  cursor: pointer;
  transition: background 0.2s ease, box-shadow 0.2s ease;
}

.pencil-overlay__tool-button--active {
  background: #0f62fe;
  color: #ffffff;
  border-color: rgba(15, 98, 254, 0.8);
  box-shadow: 0 16px 30px rgba(15, 98, 254, 0.35);
}

.pencil-overlay__control {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 14px;
}

.pencil-overlay__control input[type="color"] {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 10px;
  padding: 0;
  background: transparent;
  cursor: pointer;
}

.pencil-overlay__control input[type="range"] {
  flex: 1;
}

.pencil-overlay__control--inline {
  justify-content: flex-start;
}

.pencil-overlay__control--inline input[type="checkbox"] {
  width: 16px;
  height: 16px;
}
</style>
