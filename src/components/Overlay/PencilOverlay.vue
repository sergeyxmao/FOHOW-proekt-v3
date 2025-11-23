<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useSidePanelsStore } from '../../stores/sidePanels.js';
import { useStickersStore } from '../../stores/stickers.js';
import ImagesPanel from '../Panels/ImagesPanel.vue';
  
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
const sidePanelsStore = useSidePanelsStore();
const stickersStore = useStickersStore();

const drawingCanvasRef = ref(null);
const canvasContext = ref(null);
const canvasWidth = ref(0);
const canvasHeight = ref(0);
const canvasScale = ref(1); // Масштаб между canvas и отображаемым размером
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
const markerOpacity = ref(0.01);
const eraserSize = ref(24);
const openDropdown = ref(null);
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
  
const isImagesPanelOpen = computed(() => sidePanelsStore.isImagesOpen);

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

  // Используем bounds для отображаемых размеров, а не высокоразрешенные размеры canvas
  return {
    top: `${props.bounds.top}px`,
    left: `${props.bounds.left}px`,
    width: `${props.bounds.width}px`,
    height: `${props.bounds.height}px`,
    backgroundImage: `url(${props.snapshot})`,
    backgroundSize: '100% 100%', // Масштабируем фон под размеры
    transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
    transformOrigin: 'top left'
  };
});
const selectionStyle = computed(() => {
  if (!selectionRect.value) {
    return null;
  }

  // Преобразуем координаты из canvas пикселей в экранные пиксели
  const displayScale = canvasScale.value || 1;

  return {
    top: `${selectionRect.value.y / displayScale}px`,
    left: `${selectionRect.value.x / displayScale}px`,
    width: `${selectionRect.value.width / displayScale}px`,
    height: `${selectionRect.value.height / displayScale}px`
  };
});

const markerOpacityPercent = computed(() => Math.round(markerOpacity.value * 100));
const showEraserPreview = computed(() => currentTool.value === 'eraser' && Boolean(pointerPosition.value));
const eraserPreviewStyle = computed(() => {
  if (!showEraserPreview.value || !pointerPosition.value) {
    return null;
  }

  // Преобразуем координаты и размеры из canvas пикселей в экранные пиксели
  const displayScale = canvasScale.value || 1;

  return {
    width: `${eraserSize.value}px`,
    height: `${eraserSize.value}px`,
    top: `${pointerPosition.value.y / displayScale}px`,
    left: `${pointerPosition.value.x / displayScale}px`
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

const openImagesPanel = () => {
  sidePanelsStore.openImages();
};
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
const calculateImageDisplaySize = (originalWidth, originalHeight, maxSize = 500) => {
  if (originalWidth <= maxSize && originalHeight <= maxSize) {
    return { width: originalWidth, height: originalHeight };
  }

  let displayWidth;
  let displayHeight;

  if (originalWidth > originalHeight) {
    displayWidth = maxSize;
    displayHeight = (originalHeight / originalWidth) * maxSize;
  } else if (originalHeight > originalWidth) {
    displayHeight = maxSize;
    displayWidth = (originalWidth / originalHeight) * maxSize;
  } else {
    displayWidth = maxSize;
    displayHeight = maxSize;
  }

  return {
    width: Math.round(displayWidth),
    height: Math.round(displayHeight)
  };
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
  // Учитываем масштаб между отображаемым размером и высокоразрешенным canvas
  const displayScale = canvasScale.value || 1;
  return {
    x: ((event.clientX - rect.left) / scale) * displayScale,
    y: ((event.clientY - rect.top) / scale) * displayScale
  };
};
const placePendingImageOnCanvas = (point) => {
  const pendingImage = stickersStore.pendingImageData;
  const context = canvasContext.value;

  if (!pendingImage || !pendingImage.dataUrl || !context) {
    return;
  }

  const imageElement = new Image();
  imageElement.crossOrigin = 'anonymous';

  imageElement.onload = () => {
    const originalWidth = pendingImage.width || imageElement.width || 200;
    const originalHeight = pendingImage.height || imageElement.height || 150;
    const displaySize = calculateImageDisplaySize(originalWidth, originalHeight);

    context.drawImage(imageElement, point.x, point.y, displaySize.width, displaySize.height);
    scheduleHistorySave(true);
  };

  imageElement.onerror = () => {
    console.error('Не удалось загрузить изображение для режима рисования');
  };

  imageElement.src = pendingImage.dataUrl;
};

const startStroke = (point) => {
  if (!canvasContext.value) return;

  const context = canvasContext.value;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.globalAlpha = 1;

  // Масштабируем размеры инструментов с учетом высокого разрешения canvas
  const displayScale = canvasScale.value || 1;

  if (currentTool.value === 'eraser') {
    context.globalCompositeOperation = 'destination-out';
    context.strokeStyle = 'rgba(0, 0, 0, 1)';
    context.lineWidth = eraserSize.value * displayScale;
  } else {
    context.globalCompositeOperation = 'source-over';
    if (currentTool.value === 'marker') {
      context.strokeStyle = hexToRgba(brushColor.value, markerOpacity.value);
      context.lineWidth = markerSize.value * displayScale;
    } else {
      context.strokeStyle = brushColor.value;
      context.lineWidth = brushSize.value * displayScale;
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
  if (stickersStore.isPlacementMode && stickersStore.placementTarget === 'drawing') {
    placePendingImageOnCanvas(point);
    stickersStore.pendingImageData = null;
    stickersStore.disablePlacementMode();
    return;
  }

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

    // Вычисляем масштаб между высокоразрешенным canvas и отображаемым размером
    canvasScale.value = image.width / props.bounds.width;
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

      // Создаем canvas с высоким разрешением
      canvas.width = image.width;
      canvas.height = image.height;

      canvasContext.value = canvas.getContext('2d', {
        alpha: true,
        desynchronized: false,
        willReadFrequently: false
      });

      if (canvasContext.value) {
        // Настройки качества рендеринга
        canvasContext.value.imageSmoothingEnabled = true;
        canvasContext.value.imageSmoothingQuality = 'high';
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
  stickersStore.disablePlacementMode();
  stickersStore.setPlacementTarget('drawing');
  stickersStore.pendingImageData = null;

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
  stickersStore.pendingImageData = null;
  stickersStore.disablePlacementMode();
  stickersStore.setPlacementTarget('board');  
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
  
  // Функция перемещения холста средней кнопкой мыши отключена в режиме рисования
  event.preventDefault();
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

const toggleDropdown = (toolName) => {
  if (openDropdown.value === toolName) {
    openDropdown.value = null;
  } else {
    openDropdown.value = toolName;
  }
};

const selectTool = (toolName) => {
  currentTool.value = toolName;
  openDropdown.value = null;
};

const closeAllDropdowns = () => {
  openDropdown.value = null;
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

    <!-- Кнопка закрытия в правом верхнем углу -->
    <button
      type="button"
      class="pencil-overlay__close-button"
      title="Сохранить и выйти"
      @click="handleClose"
    >
      ✕
    </button>

    <!-- Кнопки инструментов в левом верхнем углу -->
    <div class="pencil-overlay__tools-bar">
      <!-- Карандаш -->
      <div class="pencil-overlay__tool-item">
        <button
          type="button"
          :class="[
            'pencil-overlay__tool-btn',
            { 'pencil-overlay__tool-btn--active': currentTool === 'brush' }
          ]"
          title="Карандаш"
          @click="toggleDropdown('brush')"
        >
          ✏️
        </button>
        <div
          v-if="openDropdown === 'brush'"
          class="pencil-overlay__dropdown"
        >
          <div class="pencil-overlay__dropdown-content">
            <button
              type="button"
              class="pencil-overlay__dropdown-select-btn"
              @click="selectTool('brush')"
            >
              Выбрать карандаш
            </button>
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
        </div>
      </div>

      <!-- Маркер -->
      <div class="pencil-overlay__tool-item">
        <button
          type="button"
          :class="[
            'pencil-overlay__tool-btn',
            { 'pencil-overlay__tool-btn--active': currentTool === 'marker' }
          ]"
          title="Маркер"
          @click="toggleDropdown('marker')"
        >
          🖍️
        </button>
        <div
          v-if="openDropdown === 'marker'"
          class="pencil-overlay__dropdown"
        >
          <div class="pencil-overlay__dropdown-content">
            <button
              type="button"
              class="pencil-overlay__dropdown-select-btn"
              @click="selectTool('marker')"
            >
              Выбрать маркер
            </button>
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
        </div>
      </div>

      <!-- Ластик -->
      <div class="pencil-overlay__tool-item">
        <button
          type="button"
          :class="[
            'pencil-overlay__tool-btn',
            { 'pencil-overlay__tool-btn--active': currentTool === 'eraser' }
          ]"
          title="Ластик"
          @click="toggleDropdown('eraser')"
        >
          🧽
        </button>
        <div
          v-if="openDropdown === 'eraser'"
          class="pencil-overlay__dropdown"
        >
          <div class="pencil-overlay__dropdown-content">
            <button
              type="button"
              class="pencil-overlay__dropdown-select-btn"
              @click="selectTool('eraser')"
            >
              Выбрать ластик
            </button>
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
        </div>
      </div>

      <!-- Выделение -->
      <div class="pencil-overlay__tool-item">
        <button
          type="button"
          :class="[
            'pencil-overlay__tool-btn',
            { 'pencil-overlay__tool-btn--active': currentTool === 'selection' }
          ]"
          title="Выделение"
          @click="toggleDropdown('selection')"
        >
          🔲
        </button>
        <div
          v-if="openDropdown === 'selection'"
          class="pencil-overlay__dropdown"
        >
          <div class="pencil-overlay__dropdown-content">
            <button
              type="button"
              class="pencil-overlay__dropdown-select-btn"
              @click="selectTool('selection')"
            >
              Выбрать выделение
            </button>
            <p class="pencil-overlay__helper-text">
              Выделите область, затем перемещайте содержимое левой кнопкой мыши. Для отмены выделения нажмите Esc или кликните по свободной области.
            </p>
          </div>
        </div>
      </div>

      <!-- Изображения -->
      <div class="pencil-overlay__tool-item">
        <button
          type="button"
          class="pencil-overlay__tool-btn"
          title="Изображения"
          @click="openImagesPanel"
        >
          🖼️
        </button>
      </div>      
    </div>

    <!-- Кнопки отмена/повтор в центре сверху -->
    <div class="pencil-overlay__undo-redo-bar">
      <button
        type="button"
        class="pencil-overlay__undo-redo-btn"
        :disabled="!canUndo"
        @click="undo"
        title="Отмена"
      >
        ↶ Отмена
      </button>
      <button
        type="button"
        class="pencil-overlay__undo-redo-btn"
        :disabled="!canRedo"
        @click="redo"
        title="Повтор"
      >
        Повтор ↷
      </button>
    </div>

    <!-- Панель изображений -->
    <ImagesPanel
      v-if="isImagesPanelOpen"
      :is-modern-theme="false"
      placement-target="drawing"
    />
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

/* Кнопка закрытия в правом верхнем углу */
.pencil-overlay__close-button {
  position: fixed;
  top: 16px;
  right: 16px;
  width: 40px;
  height: 40px;
  border: none;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  border-radius: 50%;
  font-size: 20px;
  cursor: pointer;
  z-index: 4002;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pencil-overlay__close-button:hover {
  background: rgba(0, 0, 0, 0.9);
  transform: scale(1.1);
}

/* Панель инструментов в левом верхнем углу */
.pencil-overlay__tools-bar {
  position: fixed;
  top: 16px;
  left: 16px;
  display: flex;
  gap: 8px;
  z-index: 4002;
}

.pencil-overlay__tool-item {
  position: relative;
}

.pencil-overlay__tool-btn {
  width: 48px;
  height: 48px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  font-size: 24px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pencil-overlay__tool-btn:hover {
  background: rgba(0, 0, 0, 0.85);
  border-color: rgba(255, 255, 255, 0.5);
}

.pencil-overlay__tool-btn--active {
  background: #0f62fe;
  border-color: #0f62fe;
  box-shadow: 0 4px 12px rgba(15, 98, 254, 0.4);
}

/* Выпадающее меню */
.pencil-overlay__dropdown {
  position: absolute;
  top: 56px;
  left: 0;
  min-width: 280px;
  background: rgba(0, 0, 0, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  padding: 12px;
  z-index: 4003;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
}

.pencil-overlay__dropdown-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.pencil-overlay__dropdown-select-btn {
  padding: 10px 16px;
  background: #0f62fe;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.pencil-overlay__dropdown-select-btn:hover {
  background: #0353e9;
  box-shadow: 0 4px 12px rgba(15, 98, 254, 0.4);
}

/* Кнопки отмена/повтор в центре сверху */
.pencil-overlay__undo-redo-bar {
  position: fixed;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 8px;
  z-index: 4002;
}

.pencil-overlay__undo-redo-btn {
  padding: 10px 20px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.pencil-overlay__undo-redo-btn:hover:not(:disabled) {
  background: rgba(0, 0, 0, 0.85);
  border-color: rgba(255, 255, 255, 0.5);
}

.pencil-overlay__undo-redo-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
/* Панель изображений в режиме рисования */
.pencil-overlay .images-panel {
  position: fixed;
  top: 0;
  right: 0;
  width: 400px;
  height: 100vh;
  z-index: 10002;
  background: white;
  box-shadow: -4px 0 12px rgba(0, 0, 0, 0.15);
}

@media (max-width: 768px) {
  .pencil-overlay .images-panel {
    width: 100%;
  }
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

/* Контролы в выпадающем меню */
.pencil-overlay__control {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 14px;
  color: white;
}

.pencil-overlay__control input[type="color"] {
  width: 36px;
  height: 36px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 8px;
  padding: 0;
  background: transparent;
  cursor: pointer;
}

.pencil-overlay__control input[type="range"] {
  flex: 1;
}

.pencil-overlay__helper-text {
  margin: 0;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
  line-height: 1.4;
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
