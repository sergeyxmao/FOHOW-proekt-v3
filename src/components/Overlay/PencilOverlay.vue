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
const hasStrokeChanges = ref(false);  
const currentTool = ref('brush');
const brushColor = ref('#ff4757');
const brushSize = ref(4);
const markerSize = ref(60);
const markerOpacity = ref(0.35);
const eraserSize = ref(24);
const textColor = ref('#111827');
const textSize = ref(24);
const isTextBold = ref(false);
const texts = ref([]);
const selectedTextId = ref(null);
const baseImage = ref(null);
const textInputRefs = new Map();
let previousHtmlOverflow = '';
let previousBodyOverflow = '';
const historyEntries = ref([]);
const historyIndex = ref(-1);
const isApplyingHistory = ref(false);
let historySaveHandle = null;
let pendingCanvasCapture = false;
const selectionRect = ref(null);
const isCreatingSelection = ref(false);
const isMovingSelection = ref(false);
const selectionPointerId = ref(null);
const selectionStartPoint = ref(null);
const activeSelection = ref(null);
const selectionMoveStartPoint = ref(null);
const selectionInitialRect = ref(null);
const selectionInitialTextPositions = ref([]);
const selectionMoveState = ref(null);

const ERASER_MIN_SIZE = 4;
const ERASER_MAX_SIZE = 80;

const MAX_HISTORY_LENGTH = 50;
const MARKER_MIN_SIZE = 30;
const MARKER_MAX_SIZE = 100;

const boardClasses = computed(() => {
  const classes = ['pencil-overlay__board'];

  switch (currentTool.value) {
    case 'text':
      classes.push('pencil-overlay__board--text');
      break;
    case 'marker':
      classes.push('pencil-overlay__board--marker');
      break;
    case 'eraser':
      classes.push('pencil-overlay__board--eraser');
      break;
    case 'selection':
      classes.push('pencil-overlay__board--selection');
      break;
    default:
      classes.push('pencil-overlay__board--brush');
  }

  return classes;
});
const boardStyle = computed(() => ({
  top: `${props.bounds.top}px`,
  left: `${props.bounds.left}px`,
  width: `${canvasWidth.value}px`,
  height: `${canvasHeight.value}px`,
  backgroundImage: `url(${props.snapshot})`
}));
const selectionStyle = computed(() => {
  if (!selectionRect.value) {
    return null;
  }

  return {
    top: `${selectionRect.value.y}px`,
    left: `${selectionRect.value.x}px`,
    width: `${selectionRect.value.width}px`,
    height: `${selectionRect.value.height}px`
  };
});

const markerOpacityPercent = computed(() => Math.round(markerOpacity.value * 100));

const panelStyle = computed(() => {
  const offset = 16;
  const top = Math.max(props.bounds.top - offset, offset);
  const left = Math.max(props.bounds.left, offset);

  return {
    top: `${top}px`,
    left: `${left}px`
  };
});
const hexToRgba = (hex, alpha) => {
  if (typeof hex !== 'string') {
    return `rgba(0, 0, 0, ${alpha})`;
  }

  let normalized = hex.trim();
  if (normalized[0] === '#') {
    normalized = normalized.slice(1);
  }

  if (normalized.length === 3) {
    normalized = normalized.split('').map((char) => char + char).join('');
  }

  const int = Number.parseInt(normalized, 16);
  if (Number.isNaN(int)) {
    return `rgba(0, 0, 0, ${alpha})`;
  }

  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const cloneTexts = (items) => items.map((item) => ({ ...item }));

const captureCanvasData = () => {
  const canvas = drawingCanvasRef.value;
  if (!canvas) {
    return null;
  }
  return canvas.toDataURL('image/png');
};

const buildSnapshot = (captureCanvasExplicitly = false) => {
  let canvasData;
  if (captureCanvasExplicitly) {
    canvasData = captureCanvasData();
  } else if (historyIndex.value >= 0 && historyIndex.value < historyEntries.value.length) {
    canvasData = historyEntries.value[historyIndex.value].canvas;
  } else {
    canvasData = captureCanvasData();
  }

  return {
    canvas: canvasData,
    texts: cloneTexts(texts.value),
    selectedTextId: selectedTextId.value
  };
};

const pushHistoryEntry = (entry) => {
  historyEntries.value = historyEntries.value.slice(0, historyIndex.value + 1);
  historyEntries.value.push(entry);

  if (historyEntries.value.length > MAX_HISTORY_LENGTH) {
    historyEntries.value.shift();
  }

  historyIndex.value = historyEntries.value.length - 1;
};

const scheduleHistorySave = (captureCanvasExplicitly = false) => {
  if (isApplyingHistory.value) {
    return;
  }

  pendingCanvasCapture = pendingCanvasCapture || captureCanvasExplicitly;

  if (historySaveHandle) {
    clearTimeout(historySaveHandle);
    historySaveHandle = null;
  }

  if (typeof window === 'undefined') {
    const snapshot = buildSnapshot(pendingCanvasCapture);
    pushHistoryEntry(snapshot);
    pendingCanvasCapture = false;
    return;
  }

  historySaveHandle = window.setTimeout(() => {
    const snapshot = buildSnapshot(pendingCanvasCapture);
    pushHistoryEntry(snapshot);
    historySaveHandle = null;
    pendingCanvasCapture = false;
  }, 0);
};

const flushPendingHistorySave = () => {
  if (!historySaveHandle) {
    return;
  }

  clearTimeout(historySaveHandle);
  historySaveHandle = null;

  if (isApplyingHistory.value) {
    return;
  }

  const snapshot = buildSnapshot(pendingCanvasCapture);
  pushHistoryEntry(snapshot);
  pendingCanvasCapture = false;
};

const drawCanvasFromSnapshot = (dataUrl) => new Promise((resolve) => {
  const canvas = drawingCanvasRef.value;
  const context = canvasContext.value;

  if (!canvas || !context) {
    resolve();
    return;
  }

  context.save();
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.globalCompositeOperation = 'source-over';
  context.globalAlpha = 1;
  context.clearRect(0, 0, canvas.width, canvas.height);

  if (!dataUrl) {
    context.restore();
    resolve();
    return;
  }

  const image = new Image();
  image.onload = () => {
    context.drawImage(image, 0, 0);
    context.restore();
    resolve();
  };
  image.onerror = () => {
    context.restore();
    resolve();
  };
  image.src = dataUrl;
});

const applySnapshot = async (snapshot) => {
  if (!snapshot) {
    return;
  }

  isApplyingHistory.value = true;
  cancelSelection();  
  textInputRefs.clear();
  texts.value = cloneTexts(snapshot.texts || []);
  selectedTextId.value = snapshot.selectedTextId || null;

  await nextTick();
  await drawCanvasFromSnapshot(snapshot.canvas);

  if (selectedTextId.value) {
    const editableEntry = texts.value.find((item) => item.id === selectedTextId.value && item.isEditing);
    if (editableEntry) {
      focusTextInput(editableEntry.id);
    }
  }

  isApplyingHistory.value = false;
};

const resetHistory = () => {
  historyEntries.value = [];
  historyIndex.value = -1;
  pendingCanvasCapture = false;
  const snapshot = buildSnapshot(true);
  pushHistoryEntry(snapshot);
};

const undo = () => {
  flushPendingHistorySave();
  if (historyIndex.value <= 0) {
    return;
  }

  historyIndex.value -= 1;
  const snapshot = historyEntries.value[historyIndex.value];
  applySnapshot(snapshot);
};

const redo = () => {
  flushPendingHistorySave();
  if (historyIndex.value < 0 || historyIndex.value >= historyEntries.value.length - 1) {
    return;
  }

  historyIndex.value += 1;
  const snapshot = historyEntries.value[historyIndex.value];
  applySnapshot(snapshot);
};

const canUndo = computed(() => historyIndex.value > 0);
const canRedo = computed(() => historyIndex.value >= 0 && historyIndex.value < historyEntries.value.length - 1);
const isDrawingToolActive = computed(() => ['brush', 'marker', 'eraser'].includes(currentTool.value));
const isSelectionToolActive = computed(() => currentTool.value === 'selection');
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
      if (typeof element.focus === 'function') {
        element.focus({ preventScroll: true });
      }
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

  const context = canvasContext.value;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.globalAlpha = 1;

  if (currentTool.value === 'eraser') {
    context.globalCompositeOperation = 'destination-out';
    context.strokeStyle = 'rgba(0, 0, 0, 1)';
    context.lineWidth = eraserSize.value;
  } else {
    context.globalCompositeOperation = 'source-over';
    if (currentTool.value === 'marker') {
      context.strokeStyle = hexToRgba(brushColor.value, markerOpacity.value);
      context.lineWidth = markerSize.value;
    } else {
      context.strokeStyle = brushColor.value;
      context.lineWidth = brushSize.value;
    }
  }

  context.beginPath();
  context.moveTo(point.x, point.y);
  lastPoint.value = point;
  isDrawing.value = true;
  hasStrokeChanges.value = false;  
};

const continueStroke = (point) => {
  if (!canvasContext.value || !isDrawing.value || !lastPoint.value) return;

  canvasContext.value.lineTo(point.x, point.y);
  canvasContext.value.stroke();
  lastPoint.value = point;
  hasStrokeChanges.value = true;  
};

const finishStroke = () => {
  if (!canvasContext.value || !isDrawing.value) return;

  canvasContext.value.closePath();
  canvasContext.value.globalAlpha = 1;
  canvasContext.value.globalCompositeOperation = 'source-over';
  isDrawing.value = false;
  lastPoint.value = null;
  activePointerId.value = null;

  if (hasStrokeChanges.value) {
    scheduleHistorySave(true);
  }
};

const clampValue = (value, min, max) => Math.min(Math.max(value, min), max);

const normalizeSelectionRect = (start, current) => {
  if (!start || !current) {
    return null;
  }

  const clampedStart = {
    x: clampValue(start.x, 0, canvasWidth.value),
    y: clampValue(start.y, 0, canvasHeight.value)
  };

  const clampedCurrent = {
    x: clampValue(current.x, 0, canvasWidth.value),
    y: clampValue(current.y, 0, canvasHeight.value)
  };

  const left = Math.min(clampedStart.x, clampedCurrent.x);
  const top = Math.min(clampedStart.y, clampedCurrent.y);
  const right = Math.max(clampedStart.x, clampedCurrent.x);
  const bottom = Math.max(clampedStart.y, clampedCurrent.y);

  return {
    x: Math.round(left),
    y: Math.round(top),
    width: Math.round(right - left),
    height: Math.round(bottom - top)
  };
};

const isPointInsideRect = (point, rect) => {
  if (!rect) {
    return false;
  }

  const withinX = point.x >= rect.x && point.x <= rect.x + rect.width;
  const withinY = point.y >= rect.y && point.y <= rect.y + rect.height;
  return withinX && withinY;
};

const resetSelectionInteraction = () => {
  isCreatingSelection.value = false;
  isMovingSelection.value = false;
  selectionPointerId.value = null;
  selectionStartPoint.value = null;
  selectionMoveStartPoint.value = null;
  selectionInitialRect.value = null;
  selectionInitialTextPositions.value = [];
  selectionMoveState.value = null;
  selectionHasChanges.value = false;
};

const selectionHasChanges = ref(false);

const cancelSelection = () => {
  if (isMovingSelection.value && activeSelection.value && selectionMoveState.value && selectionInitialRect.value) {
    const context = canvasContext.value;
    if (context && selectionMoveState.value.baseImageData) {
      context.putImageData(selectionMoveState.value.baseImageData, 0, 0);
      context.putImageData(
        activeSelection.value.imageData,
        selectionInitialRect.value.x,
        selectionInitialRect.value.y
      );
    }

    selectionInitialTextPositions.value.forEach(({ id, x, y }) => {
      const entry = texts.value.find((item) => item.id === id);
      if (entry) {
        entry.x = x;
        entry.y = y;
      }
    });

    if (activeSelection.value) {
      activeSelection.value.rect = { ...selectionInitialRect.value };
    }
  }

  resetSelectionInteraction();
  activeSelection.value = null;
  selectionRect.value = null;
};

const captureSelectionSnapshot = (rect) => {
  const context = canvasContext.value;
  if (!context || !rect || rect.width <= 1 || rect.height <= 1) {
    return null;
  }

  try {
    const imageData = context.getImageData(rect.x, rect.y, rect.width, rect.height);
    const selectedTextIds = texts.value
      .filter((entry) => entry.x >= rect.x && entry.x <= rect.x + rect.width && entry.y >= rect.y && entry.y <= rect.y + rect.height)
      .map((entry) => entry.id);

    return {
      rect: { ...rect },
      imageData,
      textIds: selectedTextIds
    };
  } catch (error) {
    console.error('Не удалось получить данные выделенной области', error);
    return null;
  }
};

const beginSelectionCreation = (point, pointerId) => {
  isCreatingSelection.value = true;
  selectionPointerId.value = pointerId;
  selectionStartPoint.value = point;
  selectionRect.value = {
    x: point.x,
    y: point.y,
    width: 0,
    height: 0
  };
};

const updateSelectionCreation = (point) => {
  if (!isCreatingSelection.value || !selectionStartPoint.value) {
    return;
  }

  const rect = normalizeSelectionRect(selectionStartPoint.value, point);
  selectionRect.value = rect;
};

const finalizeSelectionCreation = () => {
  if (!isCreatingSelection.value) {
    return;
  }

  const rect = selectionRect.value;
  resetSelectionInteraction();

  if (!rect || rect.width < 2 || rect.height < 2) {
    selectionRect.value = null;
    activeSelection.value = null;
    return;
  }

  const snapshot = captureSelectionSnapshot(rect);
  if (!snapshot) {
    selectionRect.value = null;
    activeSelection.value = null;
    return;
  }

  activeSelection.value = snapshot;
  selectionRect.value = { ...snapshot.rect };
};

const beginSelectionMove = (point, pointerId) => {
  if (!activeSelection.value) {
    return;
  }

  const context = canvasContext.value;
  if (!context) {
    return;
  }

  isMovingSelection.value = true;
  selectionPointerId.value = pointerId;
  selectionMoveStartPoint.value = point;
  selectionInitialRect.value = { ...activeSelection.value.rect };
  selectionInitialTextPositions.value = activeSelection.value.textIds
    .map((id) => {
      const entry = texts.value.find((item) => item.id === id);
      return entry ? { id, x: entry.x, y: entry.y } : null;
    })
    .filter(Boolean);

  context.save();
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.globalCompositeOperation = 'source-over';
  context.globalAlpha = 1;
  context.clearRect(
    activeSelection.value.rect.x,
    activeSelection.value.rect.y,
    activeSelection.value.rect.width,
    activeSelection.value.rect.height
  );

  const baseImageData = context.getImageData(0, 0, canvasWidth.value, canvasHeight.value);
  context.putImageData(
    activeSelection.value.imageData,
    activeSelection.value.rect.x,
    activeSelection.value.rect.y
  );
  context.restore();

  selectionMoveState.value = {
    baseImageData
  };
  selectionHasChanges.value = false;
};

const updateSelectionMove = (point) => {
  if (!isMovingSelection.value || !selectionMoveStartPoint.value || !selectionInitialRect.value) {
    return;
  }

  const dx = point.x - selectionMoveStartPoint.value.x;
  const dy = point.y - selectionMoveStartPoint.value.y;

  const maxX = Math.max(0, canvasWidth.value - selectionInitialRect.value.width);
  const maxY = Math.max(0, canvasHeight.value - selectionInitialRect.value.height);

  const targetX = clampValue(selectionInitialRect.value.x + dx, 0, maxX);
  const targetY = clampValue(selectionInitialRect.value.y + dy, 0, maxY);

  const appliedDx = Math.round(targetX - selectionInitialRect.value.x);
  const appliedDy = Math.round(targetY - selectionInitialRect.value.y);

  const rect = {
    x: selectionInitialRect.value.x + appliedDx,
    y: selectionInitialRect.value.y + appliedDy,
    width: selectionInitialRect.value.width,
    height: selectionInitialRect.value.height
  };

  selectionRect.value = rect;

  const context = canvasContext.value;
  if (context && selectionMoveState.value?.baseImageData) {
    context.putImageData(selectionMoveState.value.baseImageData, 0, 0);
    context.putImageData(activeSelection.value.imageData, rect.x, rect.y);
  }

  selectionInitialTextPositions.value.forEach(({ id, x, y }) => {
    const entry = texts.value.find((item) => item.id === id);
    if (entry) {
      entry.x = x + appliedDx;
      entry.y = y + appliedDy;
    }
  });

  if (appliedDx !== 0 || appliedDy !== 0) {
    selectionHasChanges.value = true;
  }
};

const finishSelectionMove = () => {
  if (!isMovingSelection.value) {
    return;
  }

  const rect = selectionRect.value ? { ...selectionRect.value } : null;
  const context = canvasContext.value;

  if (context && rect && selectionMoveState.value?.baseImageData) {
    context.putImageData(selectionMoveState.value.baseImageData, 0, 0);
    context.putImageData(activeSelection.value.imageData, rect.x, rect.y);

    try {
      activeSelection.value.imageData = context.getImageData(rect.x, rect.y, rect.width, rect.height);
    } catch (error) {
      console.error('Не удалось обновить данные выделенной области после перемещения', error);
    }
  }

  if (activeSelection.value && rect) {
    activeSelection.value.rect = rect;
  }

  const hasChanges = selectionHasChanges.value;
  resetSelectionInteraction();

  if (rect) {
    selectionRect.value = { ...rect };
  }

  if (hasChanges) {
    scheduleHistorySave(true);
  } 
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
  scheduleHistorySave(false);
  
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

  scheduleHistorySave(false);  
};

const handleTextKeydown = (event, id) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    finishText(id);
  }
};

const handleCanvasPointerDown = (event) => {
  if (event.button !== 0) return;

  const point = getCanvasPoint(event);
  if (!point) return;

  const canvas = drawingCanvasRef.value;
  if (!canvas) return;

  if (isSelectionToolActive.value) {
    canvas.setPointerCapture(event.pointerId);
    if (activeSelection.value && isPointInsideRect(point, activeSelection.value.rect)) {
      beginSelectionMove(point, event.pointerId);
    } else {
      cancelSelection();
      beginSelectionCreation(point, event.pointerId);
    }
    return;
  }

  if (isDrawingToolActive.value) {
    canvas.setPointerCapture(event.pointerId);
    activePointerId.value = event.pointerId;
    startStroke(point);
  } else if (currentTool.value === 'text') {
    createTextEntry(point);
  }
};

const handleCanvasPointerMove = (event) => {

  const point = getCanvasPoint(event);
  if (!point) return;
  if (isSelectionToolActive.value) {
    if (selectionPointerId.value !== event.pointerId) {
      return;
    }

    if (isCreatingSelection.value) {
      updateSelectionCreation(point);
    } else if (isMovingSelection.value) {
      updateSelectionMove(point);
    }

    return;
  }

  if (!isDrawingToolActive.value) return;
  if (!isDrawing.value || activePointerId.value !== event.pointerId) return;
  continueStroke(point);
};

const handleCanvasPointerUp = (event) => {
  const canvas = drawingCanvasRef.value;
  if (!canvas) return;

  if (isSelectionToolActive.value) {
    if (selectionPointerId.value !== event.pointerId) {
      return;
    }

    canvas.releasePointerCapture(event.pointerId);

    if (isCreatingSelection.value) {
      finalizeSelectionCreation();
    } else if (isMovingSelection.value) {
      finishSelectionMove();
    }

    resetSelectionInteraction();
    return;
  }  
  if (!isDrawingToolActive.value) return;
  if (activePointerId.value !== event.pointerId) return;
  event.preventDefault();

  canvas.releasePointerCapture(event.pointerId);
  finishStroke();
};

const handleCanvasPointerLeave = (event) => {
  const canvas = drawingCanvasRef.value;
  if (!canvas) return;

  if (isSelectionToolActive.value) {
    if (selectionPointerId.value !== event.pointerId) {
      return;
    }

    canvas.releasePointerCapture(event.pointerId);

    if (isMovingSelection.value) {
      finishSelectionMove();
    } else if (isCreatingSelection.value) {
      finalizeSelectionCreation();
    }

    resetSelectionInteraction();
    return;
  }  
  if (!isDrawingToolActive.value) return;
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
  const isModifier = event.ctrlKey || event.metaKey;
  const key = event.key.toLowerCase();

  if (isModifier && key === 'z') {
    event.preventDefault();
    if (event.shiftKey) {
      redo();
    } else {
      undo();
    }
    return;
  }

  if (isModifier && (key === 'y')) {
    event.preventDefault();
    redo();
    return;
  }
  
  if (event.key === 'Escape') {
    if (currentTool.value === 'selection' && (activeSelection.value || isCreatingSelection.value || isMovingSelection.value)) {
      event.preventDefault();
      cancelSelection();
      return;
    }
    
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
       resetHistory();
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
  if (isApplyingHistory.value) {
    return;
  }  
  if (!selectedTextId.value) {
    return;
  }

  const entry = texts.value.find((item) => item.id === selectedTextId.value);
  if (!entry) {
    return;
  }
  if (entry.color === color && entry.size === size && entry.bold === bold) {
    return;
  }
  entry.color = color;
  entry.size = size;
  entry.bold = bold;
  scheduleHistorySave(false);  
});

onMounted(() => {
  previousHtmlOverflow = document.documentElement.style.overflow;
  previousBodyOverflow = document.body.style.overflow;
  if (historySaveHandle) {
    clearTimeout(historySaveHandle);
    historySaveHandle = null;
  }
  scheduleHistorySave(false);
});

watch(currentTool, (tool, previous) => {
  if (previous === 'selection' && tool !== 'selection') {
    cancelSelection();
  }
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
      <div
        v-if="selectionStyle"
        class="pencil-overlay__selection"
        :style="selectionStyle"
      ></div>      
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
              { 'pencil-overlay__tool-button--active': currentTool === 'marker' }
            ]"
            title="Маркер"
            @click="currentTool = 'marker'"
          >
            🖍️
          </button>
          <button
            type="button"
            :class="[
              'pencil-overlay__tool-button',
              { 'pencil-overlay__tool-button--active': currentTool === 'eraser' }
            ]"
            title="Ластик"
            @click="currentTool = 'eraser'"
          >
            🧽
          </button>
          <button
            type="button"
            :class="[
              'pencil-overlay__tool-button',
              { 'pencil-overlay__tool-button--active': currentTool === 'selection' }
            ]"
            title="Выделение"
            @click="currentTool = 'selection'"
          >
            🔲
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
        <span class="pencil-overlay__section-title">Действия</span>
        <div class="pencil-overlay__action-buttons">
          <button
            type="button"
            class="pencil-overlay__action-button"
            :disabled="!canUndo"
            @click="undo"
          >
            ↶ Отмена
          </button>
          <button
            type="button"
            class="pencil-overlay__action-button"
            :disabled="!canRedo"
            @click="redo"
          >
            Повтор ↷
          </button>
        </div>
      </div>

      <div
        v-if="currentTool === 'brush'"
        class="pencil-overlay__section"
      >
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
      <div
        v-else-if="currentTool === 'marker'"
        class="pencil-overlay__section"
      >
        <span class="pencil-overlay__section-title">Маркер</span>
        <p class="pencil-overlay__helper-text">
          Цвет маркера совпадает с цветом карандаша.
        </p>
        <label class="pencil-overlay__control">
          <span>Толщина: {{ markerSize }} px</span>
          <input
            v-model.number="markerSize"
            type="range"
            :min="MARKER_MIN_SIZE"
            :max="MARKER_MAX_SIZE"
          />
        </label>
        <label class="pencil-overlay__control">
          <span>Прозрачность: {{ markerOpacityPercent }}%</span>
          <input
            v-model.number="markerOpacity"
            type="range"
            min="0.05"
            max="1"
            step="0.05"
          />
        </label>        
      </div>
      <div
        v-else-if="currentTool === 'eraser'"
        class="pencil-overlay__section"
      >
        <span class="pencil-overlay__section-title">Ластик</span>
        <label class="pencil-overlay__control">
          <span>Диаметр: {{ eraserSize }} px</span>
          <input
            v-model.number="eraserSize"
            type="range"
            :min="ERASER_MIN_SIZE"
            :max="ERASER_MAX_SIZE"
          />
        </label>
      </div>
      <div
        v-else-if="currentTool === 'selection'"
        class="pencil-overlay__section"
      >
        <span class="pencil-overlay__section-title">Выделение</span>
        <p class="pencil-overlay__helper-text">
          Выделите область, затем перемещайте содержимое левой кнопкой мыши. Для отмены выделения нажмите Esc или кликните по свободной области.
        </p>
      </div>
      <div
        v-else-if="currentTool === 'text'"
        class="pencil-overlay__section"
      >
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
  outline: none;  
}

.pencil-overlay__board--brush {
  cursor: crosshair;
}
.pencil-overlay__board--marker {
  cursor: crosshair;
}
.pencil-overlay__board--eraser {
  cursor: crosshair;
}

.pencil-overlay__board--selection {
  cursor: crosshair;
}
.pencil-overlay__board--text {
  cursor: text;
}
.pencil-overlay__selection {
  position: absolute;
  border: 2px dashed rgba(37, 99, 235, 0.85);
  background-color: rgba(37, 99, 235, 0.12);
  pointer-events: none;
  box-sizing: border-box;
}

.pencil-overlay__canvas {
  display: block;
  width: 100%;
  height: 100%;
  touch-action: none;
  outline: none;
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
.pencil-overlay__action-buttons {
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
.pencil-overlay__action-button {
  flex: 1;
  border: 1px solid rgba(148, 163, 184, 0.5);
  border-radius: 12px;
  padding: 8px 12px;
  background: rgba(248, 250, 252, 0.85);
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s ease, box-shadow 0.2s ease, color 0.2s ease;
}

.pencil-overlay__action-button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
  box-shadow: none;
}

.pencil-overlay__tool-button--active {
  background: #0f62fe;
  color: #ffffff;
  border-color: rgba(15, 98, 254, 0.8);
  box-shadow: 0 16px 30px rgba(15, 98, 254, 0.35);
}
.pencil-overlay__action-button:not(:disabled):hover,
.pencil-overlay__action-button:not(:disabled):focus-visible {
  background: #0f62fe;
  color: #ffffff;
  border-color: rgba(15, 98, 254, 0.8);
  box-shadow: 0 16px 30px rgba(15, 98, 254, 0.25);
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

.pencil-overlay__helper-text {
  margin: 0;
  font-size: 12px;
  color: #64748b;
}  
</style>
