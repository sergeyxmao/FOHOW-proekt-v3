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
  },
  isModernTheme: {
    type: Boolean,
    default: false    
  }
});

const emit = defineEmits(['close']);

const drawingCanvasRef = ref(null);
const canvasContext = ref(null);
const canvasWidth = ref(0);
const canvasHeight = ref(0);
const zoomScale = ref(1);
const minZoomScale = ref(1);
const isReady = ref(false);
const activePointerId = ref(null);
const lastPoint = ref(null);
const isDrawing = ref(false);
const hasStrokeChanges = ref(false);  
const currentTool = ref('brush');
const brushColor = ref('#ff4757');
const brushSize = ref(4);
const markerSize = ref(60);
const markerOpacity = ref(0.1);
const eraserSize = ref(24);
const baseImage = ref(null);
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
const selectionMoveState = ref(null);
const pointerPosition = ref(null);
const panOffset = ref({ x: 0, y: 0 });
const isPanning = ref(false);
const panPointerId = ref(null);
const panStartPoint = ref(null);
const panInitialOffset = ref({ x: 0, y: 0 });  
const ERASER_MIN_SIZE = 4;
const ERASER_MAX_SIZE = 80;

const MAX_HISTORY_LENGTH = 50;
const MARKER_MIN_SIZE = 30;
const MARKER_MAX_SIZE = 100;
  
const isZoomedIn = computed(() => {
  const minZoom = minZoomScale.value || 1;
  return (zoomScale.value || 1) > minZoom + 0.0001;
});
  
const boardClasses = computed(() => {
  const classes = ['pencil-overlay__board'];

  switch (currentTool.value) {
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
const boardStyle = computed(() => {
  const scale = zoomScale.value || 1;
  const offset = panOffset.value || { x: 0, y: 0 };

  return {
    top: `${props.bounds.top}px`,
    left: `${props.bounds.left}px`,
    width: `${canvasWidth.value}px`,
    height: `${canvasHeight.value}px`,
    backgroundImage: `url(${props.snapshot})`,
    transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
    transformOrigin: 'top left'
  };
});
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
const showEraserPreview = computed(() => currentTool.value === 'eraser' && Boolean(pointerPosition.value));
const eraserPreviewStyle = computed(() => {
  if (!showEraserPreview.value || !pointerPosition.value) {
    return null;
  }

  return {
    width: `${eraserSize.value}px`,
    height: `${eraserSize.value}px`,
    top: `${pointerPosition.value.y}px`,
    left: `${pointerPosition.value.x}px`
  };
});
const panelStyle = computed(() => {
  const offset = 16;
  const top = Math.max(props.bounds.top - offset, offset);
  const left = Math.max(props.bounds.left, offset);

  return {
    top: `${top}px`,
    left: `${left}px`
  };
});
const panelClasses = computed(() => [
  'pencil-overlay__panel',
  props.isModernTheme ? 'pencil-overlay__panel--modern' : 'pencil-overlay__panel--classic'
]);  
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
    canvas: canvasData
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

  await nextTick();
  await drawCanvasFromSnapshot(snapshot.canvas);
  
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
const getCanvasPoint = (event) => {
  const canvas = drawingCanvasRef.value;
  if (!canvas) return null;

  const rect = canvas.getBoundingClientRect();
  const scale = zoomScale.value || 1;
  return {
    x: (event.clientX - rect.left) / scale,
    y: (event.clientY - rect.top) / scale
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

    return {
      rect: { ...rect },
      imageData
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

const updatePointerPreview = (point) => {
  if (currentTool.value === 'eraser') {
    pointerPosition.value = { ...point };
  } else {
    pointerPosition.value = null;
  }
};

const handleCanvasPointerDown = (event) => {
  const isPrimaryButton = event.button === 0 || event.button === undefined || event.button === -1;
  
  if (!isPrimaryButton) return;

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

  if (!isDrawingToolActive.value) return;

  canvas.setPointerCapture(event.pointerId);
  activePointerId.value = event.pointerId;
  updatePointerPreview(point);
  startStroke(point);
};

const handleCanvasPointerMove = (event) => {
  const point = getCanvasPoint(event);
  if (!point) return;
  updatePointerPreview(point);
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
  if (currentTool.value === 'eraser') {
    pointerPosition.value = null;
  }
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
  pointerPosition.value = null;
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
  if (!props.snapshot) {
    return;
  }

  isReady.value = false  
  const image = new Image();
  image.onload = () => {
    baseImage.value = image;
    canvasWidth.value = image.width;
    canvasHeight.value = image.height;
    zoomScale.value = 1;
    minZoomScale.value = 1;
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
      if (canvasContext.value) {
        canvasContext.value.setTransform(1, 0, 0, 1, 0, 0);
        canvasContext.value.clearRect(0, 0, canvas.width, canvas.height);
      }
      pointerPosition.value = null;
      cancelSelection();
      resetHistory();
    });
  };
  image.onerror = () => {
    console.error('Не удалось загрузить базовый снимок для режима карандаша');
  };
  image.src = props.snapshot;
};
onMounted(() => {
  previousHtmlOverflow = document.documentElement.style.overflow;
  previousBodyOverflow = document.body.style.overflow;

  document.documentElement.style.overflow = 'hidden';
  document.body.style.overflow = 'hidden';

  window.addEventListener('keydown', handleKeydown);
  loadBaseImage();
});

watch(() => props.snapshot, (value, previous) => {
  if (value && value !== previous) {
    loadBaseImage();
  }
});

watch(currentTool, (tool, previous) => {
  if (previous === 'selection' && tool !== 'selection') {
    cancelSelection();
  }
  if (tool !== 'eraser') {
    pointerPosition.value = null;
  }
});
watch(isZoomedIn, (zoomed) => {
  if (!zoomed) {
    panOffset.value = { x: 0, y: 0 };
    isPanning.value = false;
    panPointerId.value = null;
    panStartPoint.value = null;
    panInitialOffset.value = { x: 0, y: 0 };    
  }
});

onBeforeUnmount(() => {
  document.documentElement.style.overflow = previousHtmlOverflow;
  document.body.style.overflow = previousBodyOverflow;
  window.removeEventListener('keydown', handleKeydown);
});

const clampZoom = (value) => {
  const MIN_ZOOM = minZoomScale.value || 1;
  const MAX_ZOOM = 4;
  return Math.min(Math.max(value, MIN_ZOOM), MAX_ZOOM);
};

const handleBoardWheel = (event) => {
  if (!isReady.value) {
    return;
  }

  event.preventDefault();
  const currentScale = zoomScale.value || 1;

  const STEP = 0.1;
  const zoomIn = event.deltaY < 0;
  const factor = zoomIn ? 1 + STEP : 1 / (1 + STEP);
  const updatedScale = clampZoom(currentScale * factor);
  if (Math.abs(updatedScale - currentScale) < 0.0001) {
    return;
  }

  const boardElement = event.currentTarget;
  if (!boardElement || typeof boardElement.getBoundingClientRect !== 'function') {
    zoomScale.value = Number.parseFloat(updatedScale.toFixed(4));
    return;
  }

  const rect = boardElement.getBoundingClientRect();
  const pointerOffsetX = event.clientX - rect.left;
  const pointerOffsetY = event.clientY - rect.top;

  const localX = pointerOffsetX / currentScale;
  const localY = pointerOffsetY / currentScale;
  const currentPan = panOffset.value || { x: 0, y: 0 };
  const scaleDifference = currentScale - updatedScale;

  panOffset.value = {
    x: currentPan.x + scaleDifference * localX,
    y: currentPan.y + scaleDifference * localY
  };

  zoomScale.value = Number.parseFloat(updatedScale.toFixed(4));
};

const beginPan = (event) => {
  if (!isZoomedIn.value) {
    return;
  }

  const boardElement = event.currentTarget;
  if (boardElement && typeof boardElement.setPointerCapture === 'function') {
    boardElement.setPointerCapture(event.pointerId);
  }

  isPanning.value = true;
  panPointerId.value = event.pointerId;
  panStartPoint.value = { x: event.clientX, y: event.clientY };
  const currentPan = panOffset.value || { x: 0, y: 0 };
  panInitialOffset.value = { ...currentPan };
};

const updatePan = (event) => {
  if (!isPanning.value || panPointerId.value !== event.pointerId || !panStartPoint.value) {
    return;
  }

  const deltaX = event.clientX - panStartPoint.value.x;
  const deltaY = event.clientY - panStartPoint.value.y;
  const initial = panInitialOffset.value || { x: 0, y: 0 };

  panOffset.value = {
    x: initial.x + deltaX,
    y: initial.y + deltaY
  };
};

const finishPan = (event) => {
  if (panPointerId.value !== event.pointerId) {
    return;
  }

  const boardElement = event.currentTarget;
  if (boardElement && typeof boardElement.releasePointerCapture === 'function') {
    boardElement.releasePointerCapture(event.pointerId);
  }

  isPanning.value = false;
  panPointerId.value = null;
  panStartPoint.value = null;
  panInitialOffset.value = { x: 0, y: 0 };
};

const handleBoardPointerDown = (event) => {
  if (event.pointerType !== 'mouse' || event.button !== 1) {
    return;
  }

  event.preventDefault();
  beginPan(event);
};

const handleBoardPointerMove = (event) => {
  if (!isPanning.value || panPointerId.value !== event.pointerId) {
    return;
  }

  event.preventDefault();
  updatePan(event);
};

const handleBoardPointerUp = (event) => {
  if (panPointerId.value !== event.pointerId) {
    return;
  }

  finishPan(event);
};

const handleBoardPointerCancel = (event) => {
  if (panPointerId.value !== event.pointerId) {
    return;
  }

  finishPan(event);
};  
</script>

<template>
  <div class="pencil-overlay">
    <div class="pencil-overlay__backdrop"></div>
    <div
      v-if="isReady"
      :class="boardClasses"
      :style="boardStyle"
      @wheel.prevent="handleBoardWheel"
      @pointerdown="handleBoardPointerDown"
      @pointermove="handleBoardPointerMove"
      @pointerup="handleBoardPointerUp"
      @pointerleave="handleBoardPointerCancel"
      @pointercancel="handleBoardPointerCancel"
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
        v-if="showEraserPreview && eraserPreviewStyle"
        class="pencil-overlay__eraser-preview"
        :style="eraserPreviewStyle"
      ></div>      
      <div
        v-if="selectionStyle"
        class="pencil-overlay__selection"
        :style="selectionStyle"
      ></div>      
    </div>

    <div
      :class="panelClasses"
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
      
    <div class="pencil-overlay__tool-settings">

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
        <label class="pencil-overlay__control">
          <span>Цвет</span>
          <input v-model="brushColor" type="color" />
        </label>
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
            min="0.01"
            max="0.1"
            step="0.01"
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
  cursor: url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPSczMicgaGVpZ2h0PSczMicgdmlld0JveD0nMCAwIDMyIDMyJz4KICA8cGF0aCBmaWxsPScjMWYyOTM3JyBkPSdNNiAzMGg4bDItNi02LTYtNiA2eicvPgogIDxwYXRoIGZpbGw9JyMzYjgyZjYnIGQ9J00xNiAybDggOC04IDE0LTYtNnonLz4KICA8cGF0aCBmaWxsPSdub25lJyBzdHJva2U9JyMwZjE3MmEnIHN0cm9rZS13aWR0aD0nMicgc3Ryb2tlLWxpbmVqb2luPSdyb3VuZCcgZD0nTTE2IDJsOCA4LTggMTQtNi02eicvPgo8L3N2Zz4=') 4 28, crosshair;
}
.pencil-overlay__board--marker {
  cursor: url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPSczMicgaGVpZ2h0PSczMicgdmlld0JveD0nMCAwIDMyIDMyJz4KICA8cGF0aCBmaWxsPScjMWYyOTM3JyBkPSdNNiAzMGg4bDItNi02LTYtNiA2eicvPgogIDxwYXRoIGZpbGw9JyMzYjgyZjYnIGQ9J00xNiAybDggOC04IDE0LTYtNnonLz4KICA8cGF0aCBmaWxsPSdub25lJyBzdHJva2U9JyMwZjE3MmEnIHN0cm9rZS13aWR0aD0nMicgc3Ryb2tlLWxpbmVqb2luPSdyb3VuZCcgZD0nTTE2IDJsOCA4LTggMTQtNi02eicvPgo8L3N2Zz4=') 4 28, crosshair;
}
.pencil-overlay__board--eraser {
  cursor: crosshair;
}

.pencil-overlay__board--selection {
  cursor: crosshair;
}

.pencil-overlay__canvas {
  display: block;
  width: 100%;
  height: 100%;
  touch-action: none;
  outline: none;
}
.pencil-overlay__selection {
  position: absolute;
  border: 2px dashed rgba(15, 98, 254, 0.85);
  background: rgba(15, 98, 254, 0.16);
  border-radius: 6px;
  pointer-events: none;
  box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.15);
}
.pencil-overlay__panel {
  --overlay-panel-bg: rgba(255, 255, 255, 0.94);
  --overlay-panel-color: #111827;
  --overlay-panel-title: #475569;
  --overlay-button-bg: rgba(248, 250, 252, 0.85);
  --overlay-button-border: rgba(148, 163, 184, 0.5);
  --overlay-button-color: #111827;
  --overlay-button-shadow: rgba(15, 98, 254, 0.25);
  --overlay-close-color: #111827;
  --overlay-control-border: rgba(148, 163, 184, 0.6);
  --overlay-control-bg: rgba(255, 255, 255, 0.95);
  --overlay-helper-color: #64748b;
  --overlay-panel-shadow: 0 24px 50px rgba(15, 23, 42, 0.35);
  --overlay-color-picker-border: none;
  --overlay-color-picker-bg: transparent;  
  position: fixed;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 18px;
  border-radius: 16px;
  background: var(--overlay-panel-bg);
  color: var(--overlay-panel-color);
  box-shadow: var(--overlay-panel-shadow);
  pointer-events: auto;
  min-width: 220px;
  width: min(360px, calc(100vw - 32px));  
}
.pencil-overlay__panel--modern {
  --overlay-panel-bg: rgba(18, 27, 43, 0.94);
  --overlay-panel-color: #e5f3ff;
  --overlay-panel-title: #9cbef5;
  --overlay-button-bg: rgba(32, 44, 68, 0.9);
  --overlay-button-border: rgba(104, 171, 255, 0.45);
  --overlay-button-color: #e5f3ff;
  --overlay-button-shadow: rgba(12, 84, 196, 0.35);
  --overlay-close-color: #e5f3ff;
  --overlay-control-border: rgba(111, 163, 255, 0.5);
  --overlay-control-bg: rgba(24, 36, 58, 0.9);
  --overlay-helper-color: #afc8f8;
  --overlay-panel-shadow: 0 26px 54px rgba(3, 8, 20, 0.6);
  --overlay-color-picker-border: 1px solid rgba(104, 171, 255, 0.45);
  --overlay-color-picker-bg: rgba(26, 38, 62, 0.85);
}

.pencil-overlay__panel--classic {
  color: var(--overlay-panel-color);
}
.pencil-overlay__close {
  align-self: flex-end;
  border: none;
  background: transparent;
  font-size: 18px;
  cursor: pointer;
  color: var(--overlay-close-color);
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
  color: var(--overlay-panel-title);
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
  border: 1px solid var(--overlay-button-border);
  border-radius: 12px;
  padding: 8px 12px;
  background: var(--overlay-button-bg);
  font-size: 16px;
  color: var(--overlay-button-color);  
  cursor: pointer;
  transition: background 0.2s ease, box-shadow 0.2s ease, color 0.2s ease;
}
.pencil-overlay__action-button {
  flex: 1;
  border: 1px solid var(--overlay-button-border);
  border-radius: 12px;
  padding: 8px 12px;
  background: var(--overlay-button-bg);
  color: var(--overlay-button-color);
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
.pencil-overlay__action-button:not(:disabled):focus-visible,
.pencil-overlay__tool-button:not(:disabled):hover,
.pencil-overlay__tool-button:not(:disabled):focus-visible {
  background: #0f62fe;
  color: #ffffff;
  border-color: rgba(15, 98, 254, 0.8);
  box-shadow: 0 16px 30px var(--overlay-button-shadow);
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
  border: var(--overlay-color-picker-border);
  border-radius: 10px;
  padding: 0;
  background: var(--overlay-color-picker-bg);
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
  color: var(--overlay-helper-color);
}

.pencil-overlay__tool-settings {
  min-height: 200px;
  display: flex;
  flex-direction: column;
}

.pencil-overlay__eraser-preview {
  position: absolute;
  border-radius: 50%;
  border: 2px solid rgba(15, 98, 254, 0.7);
  box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.25);
  pointer-events: none;
  transform: translate(-50%, -50%);
} 
</style>
