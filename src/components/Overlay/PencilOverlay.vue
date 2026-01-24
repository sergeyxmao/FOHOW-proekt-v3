<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useSidePanelsStore } from '../../stores/sidePanels.js';
import { useStickersStore } from '../../stores/stickers.js';
import ImagesPanel from '../Panels/ImagesPanel.vue';
import { toCanvasPoint } from '../../utils/canvasCoordinates.js';

// Composables
import { usePencilHistory } from '../../composables/usePencilHistory.js';
import { usePencilSelection } from '../../composables/usePencilSelection.js';
import { usePencilDrawing, ERASER_MIN_SIZE, ERASER_MAX_SIZE, MARKER_MIN_SIZE, MARKER_MAX_SIZE } from '../../composables/usePencilDrawing.js';
import { usePencilImages } from '../../composables/usePencilImages.js';
import { usePencilZoom } from '../../composables/usePencilZoom.js';

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

// === Базовые refs ===
const drawingCanvasRef = ref(null);
const canvasContext = ref(null);
const canvasWidth = ref(0);
const canvasHeight = ref(0);
const canvasScale = ref(1);
const isReady = ref(false);
const baseImage = ref(null);
const openDropdown = ref(null);
const previousToolBeforeImages = ref('brush');
let previousHtmlOverflow = '';
let previousBodyOverflow = '';

// === Инициализация Composables ===

// Zoom composable
const {
  zoomScale,
  minZoomScale,
  panOffset,
  isPanning,
  panPointerId,
  isZoomedIn,
  handleBoardWheel,
  beginPan,
  updatePan,
  finishPan,
  resetZoom
} = usePencilZoom({ isReady });

// Drawing composable
const {
  currentTool,
  brushColor,
  brushSize,
  markerSize,
  markerOpacity,
  eraserSize,
  isDrawing,
  activePointerId,
  pointerPosition,
  markerOpacityPercent,
  isDrawingToolActive,
  isSelectionToolActive,
  showEraserPreview,
  startStroke,
  continueStroke,
  finishStroke,
  updatePointerPreview,
  clearPointerPreview
} = usePencilDrawing({
  canvasContext,
  canvasScale,
  scheduleHistorySave: null // Будет установлено после инициализации history
});

// История - нужна ссылка на cancelSelection из selection composable
const {
  historyEntries,
  historyIndex,
  isApplyingHistory,
  canUndo,
  canRedo,
  scheduleHistorySave,
  resetHistory,
  undo: historyUndo,
  redo: historyRedo
} = usePencilHistory({
  drawingCanvasRef,
  canvasContext,
  canvasWidth,
  canvasHeight,
  onBeforeApply: () => cancelSelection()
});

// Selection composable
const {
  selectionRect,
  isCreatingSelection,
  isMovingSelection,
  selectionPointerId,
  activeSelection,
  isPointInsideRect,
  resetSelectionInteraction,
  cancelSelection,
  beginSelectionCreation,
  updateSelectionCreation,
  finalizeSelectionCreation,
  beginSelectionMove,
  updateSelectionMove,
  finishSelectionMove
} = usePencilSelection({
  canvasContext,
  canvasWidth,
  canvasHeight,
  scheduleHistorySave
});

// Функция получения координат canvas из события
const getCanvasPoint = (event) => {
  const canvas = drawingCanvasRef.value;
  if (!canvas) return null;

  const rect = canvas.getBoundingClientRect();
  const scale = zoomScale.value || 1;
  const displayScale = canvasScale.value || 1;

  return toCanvasPoint({
    clientX: event.clientX,
    clientY: event.clientY,
    rect,
    zoomScale: scale,
    canvasScale: displayScale
  });
};

// Images composable
const {
  placedImages,
  activeImageId,
  imageTransformState,
  activePlacedImage,
  getPlacedImageStyle,
  finalizeActiveImagePlacement,
  cancelActiveImagePlacement,
  beginImageTransform,
  applyImageTransform,
  finishImageTransform,
  addDroppedImage,
  resetImages
} = usePencilImages({
  canvasContext,
  canvasWidth,
  canvasHeight,
  canvasScale,
  getCanvasPoint,
  scheduleHistorySave
});

// === Computed ===
const isImagesPanelOpen = computed(() => sidePanelsStore.isImagesOpen);

const boardClasses = computed(() => {
  const classes = ['pencil-overlay__board'];

  switch (currentTool.value) {
     case 'pan':
      classes.push('pencil-overlay__board--pan');
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

const boardStyle = computed(() => {
  const scale = zoomScale.value || 1;
  const offset = panOffset.value || { x: 0, y: 0 };

  return {
    top: `${props.bounds.top}px`,
    left: `${props.bounds.left}px`,
    width: `${props.bounds.width}px`,
    height: `${props.bounds.height}px`,
    backgroundImage: `url(${props.snapshot})`,
    backgroundSize: '100% 100%',
    transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
    transformOrigin: 'top left'
  };
});

const selectionStyle = computed(() => {
  if (!selectionRect.value) {
    return null;
  }

  const displayScale = canvasScale.value || 1;

  return {
    top: `${selectionRect.value.y / displayScale}px`,
    left: `${selectionRect.value.x / displayScale}px`,
    width: `${selectionRect.value.width / displayScale}px`,
    height: `${selectionRect.value.height / displayScale}px`
  };
});

const eraserPreviewStyle = computed(() => {
  if (!showEraserPreview.value || !pointerPosition.value) {
    return null;
  }

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

// === Watchers ===
watch(isImagesPanelOpen, (isOpen) => {
  if (isOpen) {
    previousToolBeforeImages.value = currentTool.value;
    currentTool.value = 'pan';
    openDropdown.value = null;
  } else if (currentTool.value === 'pan') {
    currentTool.value = previousToolBeforeImages.value || 'brush';
  }
});

watch(currentTool, (tool, previous) => {
  if (previous === 'selection' && tool !== 'selection') {
    cancelSelection();
  }
  if (tool !== 'eraser') {
    clearPointerPreview();
  }
  if (previous === 'pan' && tool !== 'pan') {
    isPanning.value = false;
  }
});

watch(() => props.snapshot, (value, previous) => {
  if (value && value !== previous) {
    loadBaseImage();
  }
});

// === Функции ===
const openImagesPanel = () => {
  sidePanelsStore.openImages();
};

const placePendingImageOnCanvas = async (point) => {
  const pendingImage = stickersStore.pendingImageData;
  if (!pendingImage) return false;

  let imageUrl = pendingImage.dataUrl;
  if (!imageUrl && pendingImage.imageId) {
    try {
      const { useImageProxy } = await import('../../composables/useImageProxy');
      const { getImageUrl } = useImageProxy();
      imageUrl = await getImageUrl(pendingImage.imageId);
    } catch (error) {
      console.error('Ошибка получения URL изображения для режима рисования:', error);
    }
  }

  if (!imageUrl) {
    console.error('Не удалось вставить изображение: отсутствует URL/dataUrl');
    return false;
  }

  // В режиме рисования вставляем как "временное" изображение (overlay) с выделением и хэндлами
  await addDroppedImage(imageUrl, pendingImage, point);
  return true;
};

const handleCanvasPointerDown = async (event) => {
  const isPrimaryButton = event.button === 0 || event.button === undefined || event.button === -1;

  if (!isPrimaryButton) return;

  const point = getCanvasPoint(event);
  if (!point) return;

  const canvas = drawingCanvasRef.value;
  if (!canvas) return;

  if (stickersStore.isPlacementMode && stickersStore.placementTarget === 'drawing') {
    await finalizeActiveImagePlacement();
    const placed = await placePendingImageOnCanvas(point);
    stickersStore.pendingImageData = null;
    stickersStore.disablePlacementMode();
    if (placed) {
      sidePanelsStore.closePanel();
    }
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
    clearPointerPreview();
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
  clearPointerPreview();
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

const handleClose = async () => {
  await finalizeActiveImagePlacement();
  const image = exportFinalImage();
  emit('close', { image });
};

const undo = () => {
  historyUndo();
};

const redo = () => {
  historyRedo();
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
    if (activePlacedImage.value) {
      event.preventDefault();
      cancelActiveImagePlacement();
      return;
    }
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

  isReady.value = false;
  const image = new Image();
  image.onload = () => {
    baseImage.value = image;

    canvasScale.value = image.width / props.bounds.width;
    canvasWidth.value = image.width;
    canvasHeight.value = image.height;
    resetZoom();
    isReady.value = true;
    resetImages();

    nextTick(() => {
      const canvas = drawingCanvasRef.value;
      if (!canvas) {
        console.error('Не удалось получить ссылку на холст режима карандаша после инициализации');
        return;
      }

      canvas.width = image.width;
      canvas.height = image.height;

      canvasContext.value = canvas.getContext('2d', {
        alpha: true,
        desynchronized: false,
        willReadFrequently: false
      });

      if (canvasContext.value) {
        canvasContext.value.imageSmoothingEnabled = true;
        canvasContext.value.imageSmoothingQuality = 'high';
        canvasContext.value.setTransform(1, 0, 0, 1, 0, 0);
        canvasContext.value.clearRect(0, 0, canvas.width, canvas.height);
      }
      clearPointerPreview();
      cancelSelection();
      resetHistory();
    });
  };
  image.onerror = () => {
    console.error('Не удалось загрузить базовый снимок для режима карандаша');
  };
  image.src = props.snapshot;
};

const handleBoardPointerDown = (event) => {
  const isPrimaryButton = event.button === 0 || event.button === undefined || event.button === -1;

  if (isPrimaryButton && !imageTransformState.value && !event.target.closest('.pencil-overlay__image-wrapper')) {
    void finalizeActiveImagePlacement();
  }

  if (currentTool.value === 'pan' && isPrimaryButton) {
    beginPan(event);
    return;
  }

  if (event.pointerType !== 'mouse' || event.button !== 1) {
    return;
  }

  event.preventDefault();
};

const handleBoardPointerMove = (event) => {
  if (imageTransformState.value && imageTransformState.value.pointerId === event.pointerId) {
    event.preventDefault();
    applyImageTransform(event);
    return;
  }

  if (!isPanning.value || panPointerId.value !== event.pointerId) {
    return;
  }

  event.preventDefault();
  updatePan(event);
};

const handleBoardPointerUp = (event) => {
  if (imageTransformState.value && imageTransformState.value.pointerId === event.pointerId) {
    finishImageTransform(event);
    return;
  }

  if (panPointerId.value !== event.pointerId) {
    return;
  }

  finishPan(event);
};

const handleBoardPointerCancel = (event) => {
  if (imageTransformState.value && imageTransformState.value.pointerId === event.pointerId) {
    finishImageTransform(event);
    return;
  }

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

const handleDragOver = (event) => {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'copy';
};

const handleDrop = async (event) => {
  event.preventDefault();
  await finalizeActiveImagePlacement();

  const jsonData = event.dataTransfer.getData('application/json');
  if (!jsonData) return;

  let imageData;
  try {
    imageData = JSON.parse(jsonData);
  } catch (error) {
    console.error('Ошибка парсинга данных изображения:', error);
    return;
  }

  const point = getCanvasPoint(event);
  if (!point) return;

  let imageUrl = imageData.url;
  if (imageData.imageId && !imageUrl) {
    try {
      const { useImageProxy } = await import('../../composables/useImageProxy');
      const { getImageUrl } = useImageProxy();
      imageUrl = await getImageUrl(imageData.imageId);
    } catch (error) {
      console.error('Ошибка загрузки blob URL:', error);
    }
  }

  if (!imageUrl) {
    console.error('Не удалось добавить изображение: отсутствует URL');
    return;
  }

  await addDroppedImage(imageUrl, imageData, point);
};

// === Lifecycle ===
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

onBeforeUnmount(() => {
  document.documentElement.style.overflow = previousHtmlOverflow;
  document.body.style.overflow = previousBodyOverflow;
  window.removeEventListener('keydown', handleKeydown);
  stickersStore.pendingImageData = null;
  stickersStore.disablePlacementMode();
  stickersStore.setPlacementTarget('board');
});
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
      @dragover.prevent="handleDragOver"
      @drop.prevent="handleDrop"
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
      <div class="pencil-overlay__images-layer">
        <div
          v-for="image in placedImages"
          :key="image.id"
          class="pencil-overlay__image-wrapper"
          :class="{ 'pencil-overlay__image-wrapper--active': image.id === activeImageId }"
          :style="getPlacedImageStyle(image)"
          @pointerdown.stop.prevent="beginImageTransform(image.id, 'move', null, $event)"
          @pointermove.stop.prevent="applyImageTransform"
          @pointerup.stop.prevent="finishImageTransform"
          @pointercancel.stop.prevent="finishImageTransform"
        >
          <img :src="image.src" alt="Вставленное изображение" class="pencil-overlay__image" draggable="false" />
          <div v-if="image.id === activeImageId" class="pencil-overlay__image-frame">
            <span
              class="pencil-overlay__image-handle pencil-overlay__image-handle--top-left"
              title="Масштабировать"
              @pointerdown.stop.prevent="beginImageTransform(image.id, 'resize', 'top-left', $event)"
            ></span>
            <span
              class="pencil-overlay__image-handle pencil-overlay__image-handle--top"
              title="Масштабировать"
              @pointerdown.stop.prevent="beginImageTransform(image.id, 'resize', 'top', $event)"
            ></span>
            <span
              class="pencil-overlay__image-handle pencil-overlay__image-handle--top-right"
              title="Масштабировать"
              @pointerdown.stop.prevent="beginImageTransform(image.id, 'resize', 'top-right', $event)"
            ></span>
            <span
              class="pencil-overlay__image-handle pencil-overlay__image-handle--right"
              title="Масштабировать"
              @pointerdown.stop.prevent="beginImageTransform(image.id, 'resize', 'right', $event)"
            ></span>
            <span
              class="pencil-overlay__image-handle pencil-overlay__image-handle--bottom-right"
              title="Масштабировать"
              @pointerdown.stop.prevent="beginImageTransform(image.id, 'resize', 'bottom-right', $event)"
            ></span>
            <span
              class="pencil-overlay__image-handle pencil-overlay__image-handle--bottom"
              title="Масштабировать"
              @pointerdown.stop.prevent="beginImageTransform(image.id, 'resize', 'bottom', $event)"
            ></span>
            <span
              class="pencil-overlay__image-handle pencil-overlay__image-handle--bottom-left"
              title="Масштабировать"
              @pointerdown.stop.prevent="beginImageTransform(image.id, 'resize', 'bottom-left', $event)"
            ></span>
            <span
              class="pencil-overlay__image-handle pencil-overlay__image-handle--left"
              title="Масштабировать"
              @pointerdown.stop.prevent="beginImageTransform(image.id, 'resize', 'left', $event)"
            ></span>
          </div>
        </div>
      </div>
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
      :class="[
        'pencil-overlay__close-button',
        { 'pencil-overlay__close-button--modern': props.isModernTheme }
      ]"
      title="Сохранить и выйти"
      @click="handleClose"
    >
      ✕
    </button>

    <!-- Кнопки инструментов в центре нижней части экрана -->
    <div class="pencil-overlay__tools-bar">
      <!-- Карандаш -->
      <div class="pencil-overlay__tool-item">
        <button
          type="button"
          :class="[
            'pencil-overlay__tool-btn',
            { 'pencil-overlay__tool-btn--active': currentTool === 'brush' },
            { 'pencil-overlay__tool-btn--modern': props.isModernTheme }
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
            { 'pencil-overlay__tool-btn--active': currentTool === 'marker' },
            { 'pencil-overlay__tool-btn--modern': props.isModernTheme }
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
            { 'pencil-overlay__tool-btn--active': currentTool === 'eraser' },
            { 'pencil-overlay__tool-btn--modern': props.isModernTheme }
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
            { 'pencil-overlay__tool-btn--active': currentTool === 'selection' },
            { 'pencil-overlay__tool-btn--modern': props.isModernTheme }
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
          :class="[
            'pencil-overlay__tool-btn',
            { 'pencil-overlay__tool-btn--modern': props.isModernTheme }
          ]"
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
        :class="[
          'pencil-overlay__undo-redo-btn',
          { 'pencil-overlay__undo-redo-btn--modern': props.isModernTheme }
        ]"
        :disabled="!canUndo"
        @click="undo"
        title="Отмена"
      >
        <span class="pencil-overlay__btn-icon">↶</span>
      </button>
      <button
        type="button"
        :class="[
          'pencil-overlay__undo-redo-btn',
          { 'pencil-overlay__undo-redo-btn--modern': props.isModernTheme }
        ]"
        :disabled="!canRedo"
        @click="redo"
        title="Повтор"
      >
        <span class="pencil-overlay__btn-icon">↷</span>
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
  background: white;
  color: #1f2937;
  border-radius: 50%;
  font-size: 20px;
  cursor: pointer;
  z-index: 4002;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.pencil-overlay__close-button:hover {
  background: #f3f4f6;
  transform: scale(1.1);
}

.pencil-overlay__close-button--modern {
  background: transparent;
  color: white;
  box-shadow: none;
}

.pencil-overlay__close-button--modern:hover {
  background: rgba(0, 0, 0, 0.2);
  transform: scale(1.1);
}

/* Панель инструментов в нижней части экрана */
.pencil-overlay__tools-bar {
  position: fixed;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  justify-content: center;
  gap: 8px;
  z-index: 4002;
  max-width: calc(100vw - 32px);
}

@media (min-width: 768px) {
  .pencil-overlay__tools-bar {
    gap: 12px;
  }
}

@media (max-width: 480px) {
  .pencil-overlay__tools-bar {
    gap: 6px;
    bottom: 12px;
  }
}

.pencil-overlay__tool-item {
  position: relative;
}

.pencil-overlay__tool-btn {
  width: 48px;
  height: 48px;
  border: 2px solid #d1d5db;
  border-radius: 12px;
  background: white;
  color: #1f2937;
  font-size: 24px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

@media (max-width: 480px) {
  .pencil-overlay__tool-btn {
    width: 44px;
    height: 44px;
    font-size: 20px;
  }
}

.pencil-overlay__tool-btn:hover {
  background: #f3f4f6;
  border-color: #9ca3af;
}

.pencil-overlay__tool-btn--active {
  background: #0f62fe;
  color: white;
  border-color: #0f62fe;
  box-shadow: 0 4px 12px rgba(15, 98, 254, 0.4);
}

.pencil-overlay__tool-btn--modern {
  background: transparent;
  color: white;
  border-color: rgba(255, 255, 255, 0.3);
  box-shadow: none;
}

.pencil-overlay__tool-btn--modern:hover {
  background: rgba(0, 0, 0, 0.2);
  border-color: rgba(255, 255, 255, 0.5);
}

.pencil-overlay__tool-btn--modern.pencil-overlay__tool-btn--active {
  background: #0f62fe;
  color: white;
  border-color: #0f62fe;
  box-shadow: 0 4px 12px rgba(15, 98, 254, 0.4);
}

/* Выпадающее меню */
.pencil-overlay__dropdown {
  position: fixed;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  min-width: 280px;
  max-width: calc(100vw - 32px);
  background: rgba(0, 0, 0, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  padding: 12px;
  z-index: 4003;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
}

@media (max-width: 480px) {
  .pencil-overlay__dropdown {
    min-width: 260px;
    bottom: 76px;
  }
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
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  width: 44px;
  height: 44px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  color: #111827;
  font-size: 20px;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.pencil-overlay__undo-redo-btn:hover:not(:disabled) {
  background: rgba(243, 244, 246, 0.95);
  border-color: rgba(0, 0, 0, 0.12);
}

.pencil-overlay__undo-redo-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.pencil-overlay__undo-redo-btn--modern {
  background: rgba(28, 38, 58, 0.95);
  border-color: rgba(255, 255, 255, 0.1);
  color: #e5f3ff;
  box-shadow: none;
}

.pencil-overlay__undo-redo-btn--modern:hover:not(:disabled) {
  background: rgba(38, 48, 68, 0.95);
  border-color: rgba(255, 255, 255, 0.2);
}

.pencil-overlay__undo-redo-btn--modern:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.pencil-overlay__btn-icon {
  font-size: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

@media (max-width: 480px) {
  .pencil-overlay__undo-redo-btn {
    min-width: 40px;
    width: 40px;
    height: 40px;
    font-size: 18px;
  }

  .pencil-overlay__btn-icon {
    font-size: 18px;
  }
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

.pencil-overlay__board--pan {
  cursor: grab;
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
.pencil-overlay__images-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.pencil-overlay__image-wrapper {
  position: absolute;
  pointer-events: auto;
  user-select: none;
  transform-origin: top left;
}

.pencil-overlay__image-wrapper--active {
  z-index: 2;
}

.pencil-overlay__image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: 4px;
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.18);
}

.pencil-overlay__image-frame {
  position: absolute;
  inset: 0;
  border: 2px dashed rgba(15, 98, 254, 0.85);
  border-radius: 6px;
  box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.15);
  pointer-events: none;
}

.pencil-overlay__image-wrapper--active .pencil-overlay__image-frame {
  pointer-events: none;
}

.pencil-overlay__image-handle {
  position: absolute;
  width: 12px;
  height: 12px;
  background: #0f62fe;
  border: 2px solid #ffffff;
  border-radius: 50%;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
  pointer-events: auto;
}

.pencil-overlay__image-handle--top-left {
  top: -6px;
  left: -6px;
  cursor: nwse-resize;
}

.pencil-overlay__image-handle--top {
  top: -6px;
  left: 50%;
  transform: translateX(-50%);
  cursor: ns-resize;
}

.pencil-overlay__image-handle--top-right {
  top: -6px;
  right: -6px;
  cursor: nesw-resize;
}

.pencil-overlay__image-handle--right {
  right: -6px;
  top: 50%;
  transform: translateY(-50%);
  cursor: ew-resize;
}

.pencil-overlay__image-handle--bottom-right {
  bottom: -6px;
  right: -6px;
  cursor: nwse-resize;
}

.pencil-overlay__image-handle--bottom {
  bottom: -6px;
  left: 50%;
  transform: translateX(-50%);
  cursor: ns-resize;
}

.pencil-overlay__image-handle--bottom-left {
  bottom: -6px;
  left: -6px;
  cursor: nesw-resize;
}

.pencil-overlay__image-handle--left {
  left: -6px;
  top: 50%;
  transform: translateY(-50%);
  cursor: ew-resize;
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
