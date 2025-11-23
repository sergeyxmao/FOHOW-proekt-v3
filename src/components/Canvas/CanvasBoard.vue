<script setup>
import { ref, onMounted, onBeforeUnmount, computed, watch, nextTick } from 'vue';
import html2canvas from 'html2canvas';
import { storeToRefs } from 'pinia';
import { useDebounceFn, useThrottleFn } from '@vueuse/core';
import { useCardsStore } from '../../stores/cards';
import { useConnectionsStore } from '../../stores/connections';
import { useCanvasStore } from '../../stores/canvas';
import { useViewSettingsStore } from '../../stores/viewSettings';
import { useImagesStore } from '../../stores/images';
import { useAnchorsStore } from '../../stores/anchors';  
import Card from './Card.vue';
import NoteWindow from './NoteWindow.vue';
import Sticker from './Sticker.vue';
import CanvasImage from './CanvasImage.vue';
import AnchorPoint from './AnchorPoint.vue';  
import { useKeyboardShortcuts } from '../../composables/useKeyboardShortcuts';
import { getHeaderColorRgb } from '../../utils/constants';
import { batchDeleteCards } from '../../utils/historyOperations';
import { usePanZoom } from '../../composables/usePanZoom';
import { useHistoryStore } from '../../stores/history.js';
import { useViewportStore } from '../../stores/viewport.js';
import { useNotesStore } from '../../stores/notes.js';
import { useMobileStore } from '../../stores/mobile.js';
import { useStickersStore } from '../../stores/stickers.js';
import { useBoardStore } from '../../stores/board.js';
import { useSidePanelsStore } from '../../stores/sidePanels.js';  
import { Engine } from '../../utils/calculationEngine';
import {
  propagateActivePvUp,
  applyActivePvDelta,
  applyActivePvClear
} from '../../utils/activePv';
import {
  ensureNoteStructure,
  applyCardRectToNote,
  updateNoteOffsets,
  DEFAULT_NOTE_WIDTH,
  DEFAULT_NOTE_HEIGHT
} from '../../utils/noteUtils';
import {
  buildConnectionGeometry,
  buildOrthogonalConnectionPath,
  getCardConnectorPoint,
  resolveConnectionSides
} from '../../utils/canvasGeometry';  
const historyStore = useHistoryStore();
const notesStore = useNotesStore();
const mobileStore = useMobileStore();
const stickersStore = useStickersStore();
const boardStore = useBoardStore();
const sidePanelsStore = useSidePanelsStore();
const anchorsStore = useAnchorsStore();  
const imagesStore = useImagesStore();  
const emit = defineEmits(['update-connection-status']);
const props = defineProps({
  isModernTheme: {
    type: Boolean,
    default: false
  }
});
const cardsStore = useCardsStore();
const connectionsStore = useConnectionsStore();
const canvasStore = useCanvasStore();
const viewSettingsStore = useViewSettingsStore();

const { cards } = storeToRefs(cardsStore);
const { connections } = storeToRefs(connectionsStore);
const { images } = storeToRefs(imagesStore);
const { selectedAnchorId, pendingFocusAnchorId, placementMode } = storeToRefs(boardStore);
const { anchors } = storeToRefs(anchorsStore);
  
const {
  backgroundColor,
  isHierarchicalDragMode,
  isSelectionMode,
  guidesEnabled,
  gridStep: gridStepRef,
  isGridBackgroundVisible
} = storeToRefs(canvasStore);
const { isMobileMode } = storeToRefs(mobileStore);
  watch(() => cardsStore.cards, (newCards, oldCards) => {
  console.log('=== Cards array updated ===');
  console.log('Previous cards count:', oldCards.length);
  console.log('New cards count:', newCards.length);
}, { deep: true });

useKeyboardShortcuts({
  enabled: true,
  preventDefault: true,
  visualFeedback: true,
  feedbackDuration: 300,
  disableOnInput: true
});

const stageConfig = ref({
  width: 0,
  height: 0
});
const CANVAS_PADDING = 400;

const canvasContainerRef = ref(null);
const {
  scale: zoomScale,
  translateX: zoomTranslateX,
  translateY: zoomTranslateY,
  clampScale: clampZoomScale,
  setTransform: setZoomTransform,
  resetTransform: resetZoomTransform
} = usePanZoom(canvasContainerRef);
const viewportStore = useViewportStore();
watch(zoomScale, (value) => {
  viewportStore.setZoomScale(value);
}, { immediate: true });
const canvasContentStyle = computed(() => {
  const translateX = Number.isFinite(zoomTranslateX.value) ? zoomTranslateX.value : 0;
  const translateY = Number.isFinite(zoomTranslateY.value) ? zoomTranslateY.value : 0;
  const scale = Number.isFinite(zoomScale.value) && zoomScale.value > 0 ? zoomScale.value : 1;
  
  const style = {
    width: `${stageConfig.value.width}px`,
    height: `${stageConfig.value.height}px`,
    transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`
  };

  const step = Number.isFinite(gridStepRef.value) ? gridStepRef.value : 0;
  const normalizedStep = Math.max(1, Math.round(step));
  const isVisible = Boolean(isGridBackgroundVisible.value && normalizedStep > 0);
  style['--grid-step'] = `${normalizedStep}px`;
  style['--grid-line-color'] = 'rgba(79, 85, 99, 0.15)';
  style['--grid-opacity'] = isVisible ? '1' : '0';

  return style;
});
  
const anchorPoints = computed(() => Array.isArray(anchors.value) ? anchors.value : []);
  
const selectedCardId = ref(null);
const connectionStart = ref(null);
const isDrawingLine = ref(false);
const previewLine = ref(null);
const previewLineWidth = computed(() => connectionsStore.defaultLineThickness || 2);
const mousePosition = ref({ x: 0, y: 0 });
const selectedConnectionIds = ref([]);
const dragState = ref(null);

// State для resize-операций изображений
const resizeState = ref(null); // { imageId, initialWidth, initialHeight, aspectRatio, keepAspectRatio, interactionType, startX, startY }

const activeGuides = ref({ vertical: null, horizontal: null });
let activeDragPointerId = null;
let dragPointerCaptureElement = null;
const suppressNextCardClick = ref(false);
const isSelecting = ref(false);
const selectionRect = ref(null);
let selectionStartPoint = null;
const createSelectionBaseState = () => ({
  cardIds: new Set(),
  stickerIds: new Set(),
  imageIds: new Set()
});
let selectionBaseSelection = createSelectionBaseState();
let suppressNextStageClick = false;

const clearObjectSelections = ({ preserveCardSelection = false } = {}) => {
  if (!preserveCardSelection) {
    cardsStore.deselectAllCards();
    selectedCardId.value = null;
  }
  stickersStore.deselectAllStickers();
  imagesStore.deselectAllImages();
};

const noteWindowRefs = new Map();
const ACTIVE_PV_FLASH_MS = 650;

// ========================================
// Canvas Rendering для изображений
// ========================================
const imagesCanvasRef = ref(null);
const imageCache = new Map(); // key: dataUrl, value: { img: HTMLImageElement, loading: Promise, error: boolean }

// Оптимизация производительности: Lazy rendering с requestAnimationFrame
let needsRedraw = false;
let renderScheduled = false;

// Оффскрин рендеринг: кэш для отрисованных изображений
const offscreenCache = new Map(); // key: imageId, value: { canvas: HTMLCanvasElement, version: number }
const imageVersions = new Map(); // key: imageId, value: version (изменяется при изменении изображения)

/**
 * Получение версии изображения для проверки изменений
 * @param {Object} imageObj - Объект изображения
 * @returns {string} - Версия изображения
 */
const getImageVersion = (imageObj) => {
  return `${imageObj.x}-${imageObj.y}-${imageObj.width}-${imageObj.height}-${imageObj.rotation || 0}-${imageObj.opacity || 1}-${imageObj.dataUrl.substring(0, 50)}`;
};

/**
 * Инвалидация кэша изображения при изменении
 * @param {string} imageId - ID изображения
 */
const invalidateImageCache = (imageId) => {
  offscreenCache.delete(imageId);
  console.log('🔄 Кэш изображения инвалидирован:', imageId);
};

/**
 * Создание оффскрин canvas для изображения
 * @param {Object} imageObj - Объект изображения
 * @param {HTMLImageElement} img - Загруженное изображение
 * @returns {HTMLCanvasElement} - Offscreen canvas с отрисованным изображением
 */
const createOffscreenCanvas = (imageObj, img) => {
  const offscreenCanvas = document.createElement('canvas');
  offscreenCanvas.width = imageObj.width;
  offscreenCanvas.height = imageObj.height;

  const ctx = offscreenCanvas.getContext('2d', { alpha: true, willReadFrequently: false });

  if (!ctx) {
    return null;
  }

  ctx.save();

  // Переместить точку отсчета в центр
  ctx.translate(offscreenCanvas.width / 2, offscreenCanvas.height / 2);

  // Применить поворот
  ctx.rotate((imageObj.rotation || 0) * Math.PI / 180);

  // Применить прозрачность
  ctx.globalAlpha = imageObj.opacity !== undefined ? imageObj.opacity : 1;

  // Нарисовать изображение
  ctx.drawImage(
    img,
    -offscreenCanvas.width / 2,
    -offscreenCanvas.height / 2,
    offscreenCanvas.width,
    offscreenCanvas.height
  );

  ctx.restore();

  return offscreenCanvas;
};

/**
 * Загрузка и кэширование изображения
 * @param {string} dataUrl - URL изображения
 * @returns {Promise<HTMLImageElement>}
 */
const loadImage = (dataUrl) => {
  // Проверяем кэш
  const cached = imageCache.get(dataUrl);

  if (cached) {
    // Если изображение загружено успешно
    if (cached.img && !cached.error) {
      return Promise.resolve(cached.img);
    }

    // Если идет загрузка
    if (cached.loading) {
      return cached.loading;
    }

    // Если была ошибка, пробуем загрузить снова
    if (cached.error) {
      imageCache.delete(dataUrl);
    }
  }

  // Создаем новый Promise для загрузки
  const loadingPromise = new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      // Сохраняем загруженное изображение в кэш
      imageCache.set(dataUrl, { img, loading: null, error: false });
      console.log('✅ Изображение загружено:', dataUrl.substring(0, 50) + '...');
      resolve(img);
    };

    img.onerror = (error) => {
      // Помечаем ошибку в кэше
      imageCache.set(dataUrl, { img: null, loading: null, error: true });
      console.error('❌ Ошибка загрузки изображения:', error);
      reject(new Error('Failed to load image'));
    };

    img.src = dataUrl;
  });

  // Сохраняем промис загрузки в кэш
  imageCache.set(dataUrl, { img: null, loading: loadingPromise, error: false });

  return loadingPromise;
};

/**
 * Отрисовка одного изображения на canvas с использованием оффскрин кэширования
 * @param {CanvasRenderingContext2D} ctx - Контекст canvas
 * @param {Object} imageObj - Объект изображения
 */
const drawImageObject = async (ctx, imageObj) => {
  try {
    const img = await loadImage(imageObj.dataUrl);
    const currentVersion = getImageVersion(imageObj);
    const cachedVersion = imageVersions.get(imageObj.id);

    let offscreenCanvas = null;

    // Проверяем, нужно ли обновить кэш
    if (cachedVersion !== currentVersion) {
      // Версия изменилась - создаем новый offscreen canvas
      offscreenCanvas = createOffscreenCanvas(imageObj, img);

      if (offscreenCanvas) {
        offscreenCache.set(imageObj.id, offscreenCanvas);
        imageVersions.set(imageObj.id, currentVersion);
        console.log('✨ Создан offscreen кэш для изображения:', imageObj.id);
      }
    } else {
      // Версия не изменилась - используем кэш
      offscreenCanvas = offscreenCache.get(imageObj.id);
    }

    ctx.save();

    // Если есть offscreen canvas, копируем из него
    if (offscreenCanvas) {
      ctx.drawImage(
        offscreenCanvas,
        imageObj.x,
        imageObj.y,
        imageObj.width,
        imageObj.height
      );
    } else {
      // Fallback: рисуем напрямую без кэша (для старых браузеров или ошибок)
      ctx.translate(
        imageObj.x + imageObj.width / 2,
        imageObj.y + imageObj.height / 2
      );

      ctx.rotate((imageObj.rotation || 0) * Math.PI / 180);
      ctx.globalAlpha = imageObj.opacity !== undefined ? imageObj.opacity : 1;

      ctx.drawImage(
        img,
        -imageObj.width / 2,
        -imageObj.height / 2,
        imageObj.width,
        imageObj.height
      );
    }

    ctx.restore();
  } catch (error) {
    // Отрисовываем placeholder при ошибке
    drawImagePlaceholder(ctx, imageObj);
  }
};

/**
 * Отрисовка placeholder для изображения с ошибкой
 * @param {CanvasRenderingContext2D} ctx - Контекст canvas
 * @param {Object} imageObj - Объект изображения
 */
const drawImagePlaceholder = (ctx, imageObj) => {
  ctx.save();

  ctx.translate(
    imageObj.x + imageObj.width / 2,
    imageObj.y + imageObj.height / 2
  );

  ctx.rotate((imageObj.rotation || 0) * Math.PI / 180);

  // Рисуем прямоугольник с ошибкой
  ctx.fillStyle = '#f3f4f6';
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 2;

  ctx.fillRect(
    -imageObj.width / 2,
    -imageObj.height / 2,
    imageObj.width,
    imageObj.height
  );

  ctx.strokeRect(
    -imageObj.width / 2,
    -imageObj.height / 2,
    imageObj.width,
    imageObj.height
  );

  // Рисуем крестик
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 3;
  ctx.beginPath();

  const iconSize = Math.min(imageObj.width, imageObj.height) * 0.3;
  ctx.moveTo(-iconSize / 2, -iconSize / 2);
  ctx.lineTo(iconSize / 2, iconSize / 2);
  ctx.moveTo(iconSize / 2, -iconSize / 2);
  ctx.lineTo(-iconSize / 2, iconSize / 2);

  ctx.stroke();

  // Добавляем текст "Error"
  ctx.fillStyle = '#ef4444';
  ctx.font = '14px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Error', 0, iconSize / 2 + 20);

  ctx.restore();
};

/**
 * Отрисовка рамки выделения для изображения
 * @param {CanvasRenderingContext2D} ctx - Контекст canvas
 * @param {Object} imageObj - Объект изображения
 */
const drawSelectionBorder = (ctx, imageObj) => {
  ctx.save();

  // Переместить точку отсчета в центр изображения
  ctx.translate(
    imageObj.x + imageObj.width / 2,
    imageObj.y + imageObj.height / 2
  );

  // Применить поворот
  ctx.rotate((imageObj.rotation || 0) * Math.PI / 180);

  // Рисуем рамку выделения
  ctx.strokeStyle = '#007bff'; // Синий цвет
  ctx.lineWidth = 2;
  ctx.strokeRect(
    -imageObj.width / 2,
    -imageObj.height / 2,
    imageObj.width,
    imageObj.height
  );

  ctx.restore();
};

/**
 * Отрисовка ручек изменения размера
 * @param {CanvasRenderingContext2D} ctx - Контекст canvas
 * @param {Object} imageObj - Объект изображения
 */
const drawResizeHandles = (ctx, imageObj) => {
  ctx.save();

  // Переместить точку отсчета в центр изображения
  ctx.translate(
    imageObj.x + imageObj.width / 2,
    imageObj.y + imageObj.height / 2
  );

  // Применить поворот
  ctx.rotate((imageObj.rotation || 0) * Math.PI / 180);

  const halfWidth = imageObj.width / 2;
  const halfHeight = imageObj.height / 2;
  const handleSize = 8;
  const halfHandleSize = handleSize / 2;

  // Позиции 8 ручек (относительно центра изображения)
  const handles = [
    // 4 угла
    { x: -halfWidth, y: -halfHeight },           // Верхний левый
    { x: halfWidth, y: -halfHeight },            // Верхний правый
    { x: halfWidth, y: halfHeight },             // Нижний правый
    { x: -halfWidth, y: halfHeight },            // Нижний левый
    // 4 середины сторон
    { x: 0, y: -halfHeight },                    // Середина верха
    { x: 0, y: halfHeight },                     // Середина низа
    { x: -halfWidth, y: 0 },                     // Середина слева
    { x: halfWidth, y: 0 }                       // Середина справа
  ];

  // Рисуем каждую ручку
  handles.forEach(handle => {
    // Белый квадрат
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(
      handle.x - halfHandleSize,
      handle.y - halfHandleSize,
      handleSize,
      handleSize
    );

    // Синяя обводка
    ctx.strokeStyle = '#007bff';
    ctx.lineWidth = 2;
    ctx.strokeRect(
      handle.x - halfHandleSize,
      handle.y - halfHandleSize,
      handleSize,
      handleSize
    );
  });

  ctx.restore();
};

/**
 * Отрисовка ручки поворота
 * @param {CanvasRenderingContext2D} ctx - Контекст canvas
 * @param {Object} imageObj - Объект изображения
 */
const drawRotationHandle = (ctx, imageObj) => {
  ctx.save();

  // Переместить точку отсчета в центр изображения
  ctx.translate(
    imageObj.x + imageObj.width / 2,
    imageObj.y + imageObj.height / 2
  );

  // Применить поворот
  ctx.rotate((imageObj.rotation || 0) * Math.PI / 180);

  const halfHeight = imageObj.height / 2;
  const handleDistance = 20; // Расстояние от верхней стороны
  const handleRadius = 5; // Радиус круга (диаметр 10px)

  // Позиция ручки поворота (над центром верхней стороны)
  const handleX = 0;
  const handleY = -halfHeight - handleDistance;

  // Рисуем линию, соединяющую ручку с верхней стороной
  ctx.strokeStyle = '#007bff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -halfHeight);
  ctx.lineTo(handleX, handleY);
  ctx.stroke();

  // Рисуем круг (ручка поворота)
  // Белый круг
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(handleX, handleY, handleRadius, 0, 2 * Math.PI);
  ctx.fill();

  // Синяя обводка
  ctx.strokeStyle = '#007bff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(handleX, handleY, handleRadius, 0, 2 * Math.PI);
  ctx.stroke();

  ctx.restore();
};

/**
 * Отрисовка серой рамки для заблокированного объекта
 * @param {CanvasRenderingContext2D} ctx - Контекст canvas
 * @param {Object} imageObj - Объект изображения
 */
const drawLockedBorder = (ctx, imageObj) => {
  ctx.save();

  // Переместить точку отсчета в центр изображения
  ctx.translate(
    imageObj.x + imageObj.width / 2,
    imageObj.y + imageObj.height / 2
  );

  // Применить поворот
  ctx.rotate((imageObj.rotation || 0) * Math.PI / 180);

  // Рисуем серую рамку для заблокированного объекта
  ctx.strokeStyle = '#808080'; // Серый цвет
  ctx.lineWidth = 2;
  ctx.strokeRect(
    -imageObj.width / 2,
    -imageObj.height / 2,
    imageObj.width,
    imageObj.height
  );

  ctx.restore();
};

/**
 * Отрисовка иконки замка для заблокированного объекта
 * @param {CanvasRenderingContext2D} ctx - Контекст canvas
 * @param {Object} imageObj - Объект изображения
 */
const drawLockIcon = (ctx, imageObj) => {
  ctx.save();

  // Переместить точку отсчета в центр изображения
  ctx.translate(
    imageObj.x + imageObj.width / 2,
    imageObj.y + imageObj.height / 2
  );

  // Применить поворот
  ctx.rotate((imageObj.rotation || 0) * Math.PI / 180);

  // Позиция иконки замка в правом верхнем углу
  const iconX = imageObj.width / 2 - 20; // 20px от правого края
  const iconY = -imageObj.height / 2 + 5; // 5px от верхнего края
  const iconSize = 16;

  // Рисуем фон для иконки (полупрозрачный белый)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.fillRect(iconX - 2, iconY - 2, iconSize + 4, iconSize + 4);

  // Рисуем рамку вокруг фона
  ctx.strokeStyle = '#808080';
  ctx.lineWidth = 1;
  ctx.strokeRect(iconX - 2, iconY - 2, iconSize + 4, iconSize + 4);

  // Рисуем иконку замка
  ctx.fillStyle = '#808080'; // Серый цвет
  ctx.strokeStyle = '#808080';
  ctx.lineWidth = 1.5;

  // Дужка замка (верхняя часть)
  const lockCenterX = iconX + iconSize / 2;
  const lockCenterY = iconY + iconSize / 2;
  const lockWidth = iconSize * 0.6;
  const lockHeight = iconSize * 0.7;
  const shackleHeight = iconSize * 0.35;

  ctx.beginPath();
  ctx.arc(
    lockCenterX,
    lockCenterY - lockHeight / 2 + shackleHeight / 2,
    lockWidth / 2,
    Math.PI,
    0,
    false
  );
  ctx.stroke();

  // Тело замка (нижняя часть)
  ctx.fillRect(
    lockCenterX - lockWidth / 2,
    lockCenterY - lockHeight / 2 + shackleHeight,
    lockWidth,
    lockHeight - shackleHeight
  );

  // Замочная скважина
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(
    lockCenterX,
    lockCenterY + shackleHeight / 4,
    iconSize * 0.12,
    0,
    2 * Math.PI
  );
  ctx.fill();

  ctx.restore();
};

/**
 * Отрисовка выделения изображения (рамка + ручки)
 * @param {CanvasRenderingContext2D} ctx - Контекст canvas
 * @param {Object} imageObj - Объект изображения
 */
const drawImageSelection = (ctx, imageObj) => {
  if (!imageObj.isSelected) {
    return;
  }

  // Если объект заблокирован, показываем только серую рамку и иконку замка
  if (imageObj.isLocked) {
    drawLockedBorder(ctx, imageObj);
    drawLockIcon(ctx, imageObj);
    return;
  }

  // Обычное выделение с ручками
  drawSelectionBorder(ctx, imageObj);
  drawResizeHandles(ctx, imageObj);
  drawRotationHandle(ctx, imageObj);
};

/**
 * Рендеринг всех изображений на canvas
 */
const renderAllImages = async () => {
  if (!imagesCanvasRef.value) {
    return;
  }

  const canvas = imagesCanvasRef.value;
  const ctx = canvas.getContext('2d', { alpha: true, willReadFrequently: false });

  if (!ctx) {
    return;
  }

  // Устанавливаем размеры canvas
  canvas.width = stageConfig.value.width;
  canvas.height = stageConfig.value.height;

  // Очищаем canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Сортируем изображения по zIndex (от меньшего к большему)
  const sortedImages = [...images.value].sort((a, b) => {
    const zIndexA = a.zIndex !== undefined ? a.zIndex : 0;
    const zIndexB = b.zIndex !== undefined ? b.zIndex : 0;
    return zIndexA - zIndexB;
  });

  // Отрисовываем изображения
  for (const image of sortedImages) {
    await drawImageObject(ctx, image);
  }

  // Отрисовываем выделение поверх всех изображений
  for (const image of sortedImages) {
    drawImageSelection(ctx, image);
  }

  // Сбрасываем флаг перерисовки
  needsRedraw = false;
};

/**
 * Планирование рендеринга с использованием requestAnimationFrame (Lazy rendering)
 * Гарантирует, что рендеринг будет выполнен только один раз за frame
 */
const scheduleRender = () => {
  // Устанавливаем флаг необходимости перерисовки
  needsRedraw = true;

  // Если рендеринг уже запланирован, не планируем снова
  if (renderScheduled) {
    return;
  }

  renderScheduled = true;

  // Планируем рендеринг на следующий frame
  requestAnimationFrame(() => {
    renderScheduled = false;

    // Проверяем флаг перед рендерингом
    if (needsRedraw) {
      renderAllImages();
    }
  });
};

// Следим за изменениями images и планируем перерисовку (вместо прямого вызова)
watch(images, () => {
  scheduleRender();
}, { deep: true });

// Следим за изменениями размеров stage и планируем перерисовку
watch(stageConfig, () => {
  scheduleRender();
}, { deep: true });

// ========================================
// Конец Canvas Rendering
// ========================================

// ========================================
// Методы взаимодействия с объектами изображений
// ========================================

/**
 * Проверка попадания курсора в объект изображения
 * @param {number} x - Координата X курсора на canvas
 * @param {number} y - Координата Y курсора на canvas
 * @param {Object} object - Объект изображения
 * @returns {boolean} - true если курсор внутри объекта, false если снаружи
 */
const isPointInObject = (x, y, object) => {
  if (!object || object.type !== 'image') {
    return false;
  }

  // Вычисляем центр объекта
  const centerX = object.x + object.width / 2;
  const centerY = object.y + object.height / 2;

  // Преобразуем координаты курсора с учетом rotation объекта (инверсия поворота)
  const angle = -(object.rotation || 0) * Math.PI / 180;
  const dx = x - centerX;
  const dy = y - centerY;
  const rotatedX = dx * Math.cos(angle) - dy * Math.sin(angle);
  const rotatedY = dx * Math.sin(angle) + dy * Math.cos(angle);
  const localX = rotatedX + centerX;
  const localY = rotatedY + centerY;

  // Проверяем попадание в прямоугольник объекта
  return localX >= object.x &&
         localX <= object.x + object.width &&
         localY >= object.y &&
         localY <= object.y + object.height;
};

/**
 * Определение типа взаимодействия с объектом изображения
 * @param {number} x - Координата X курсора на canvas
 * @param {number} y - Координата Y курсора на canvas
 * @param {Object} object - Объект изображения
 * @returns {string|null} - Тип взаимодействия или null
 * Возможные значения: 'move', 'resize-nw', 'resize-n', 'resize-ne', 'resize-e',
 * 'resize-se', 'resize-s', 'resize-sw', 'resize-w', 'rotate', null
 */
const getInteractionType = (x, y, object) => {
  if (!object || object.type !== 'image' || !object.isSelected || object.isLocked) {
    return null;
  }

  const centerX = object.x + object.width / 2;
  const centerY = object.y + object.height / 2;
  const rotation = object.rotation || 0;
  const angle = rotation * Math.PI / 180;

  // Вспомогательная функция для преобразования координат с учетом поворота
  const rotatePoint = (px, py) => {
    const dx = px - centerX;
    const dy = py - centerY;
    return {
      x: centerX + dx * Math.cos(angle) - dy * Math.sin(angle),
      y: centerY + dx * Math.sin(angle) + dy * Math.cos(angle)
    };
  };

  // Вспомогательная функция для проверки расстояния до точки
  const distanceToPoint = (px, py) => {
    return Math.sqrt((x - px) ** 2 + (y - py) ** 2);
  };

  // 1. Проверка попадания в ручку поворота
  const rotateHandlePos = rotatePoint(centerX, object.y - 20);
  if (distanceToPoint(rotateHandlePos.x, rotateHandlePos.y) <= 10) {
    return 'rotate';
  }

  // 2. Проверка попадания в ручки изменения размера
  const handleSize = 8; // Размер области клика для ручки (8x8px)
  const handleRadius = handleSize / 2;

  // Позиции ручек (без учета поворота)
  const handles = {
    'resize-nw': { x: object.x, y: object.y },
    'resize-n': { x: centerX, y: object.y },
    'resize-ne': { x: object.x + object.width, y: object.y },
    'resize-e': { x: object.x + object.width, y: centerY },
    'resize-se': { x: object.x + object.width, y: object.y + object.height },
    'resize-s': { x: centerX, y: object.y + object.height },
    'resize-sw': { x: object.x, y: object.y + object.height },
    'resize-w': { x: object.x, y: centerY }
  };

  // Проверяем каждую ручку с учетом поворота
  for (const [type, pos] of Object.entries(handles)) {
    const rotatedPos = rotatePoint(pos.x, pos.y);
    if (distanceToPoint(rotatedPos.x, rotatedPos.y) <= handleRadius) {
      return type;
    }
  }

  // 3. Если попал в объект, но не в ручки - перемещение
  if (isPointInObject(x, y, object)) {
    return 'move';
  }

  // 4. Вне объекта
  return null;
};

/**
 * Нахождение объекта изображения под курсором
 * @param {number} x - Координата X курсора на canvas
 * @param {number} y - Координата Y курсора на canvas
 * @returns {Object|null} - Объект изображения или null
 */
const getObjectAtPoint = (x, y) => {
  // Получаем массив всех изображений, отсортированный по zIndex (от большего к меньшему)
  const sortedImages = [...images.value].sort((a, b) => {
    const zIndexA = a.zIndex !== undefined ? a.zIndex : 0;
    const zIndexB = b.zIndex !== undefined ? b.zIndex : 0;
    return zIndexB - zIndexA; // Обратный порядок - от верхних к нижним
  });

  // Перебираем объекты от верхних к нижним
  for (const imageObj of sortedImages) {
    if (isPointInObject(x, y, imageObj)) {
      return imageObj;
    }
  }

  // Ни один объект не найден
  return null;
};

// ========================================
// Конец методов взаимодействия с объектами
// ========================================

const getCardElement = (cardId) => {
  if (!cardId) {
    return null;
  }
  const root = canvasContainerRef.value || document;
  return root.querySelector(`[data-card-id="${cardId}"]`);
};

const getConnectionElement = (connectionId) => {
  if (!connectionId) {
    return null;
  }
  const root = canvasContainerRef.value || document;
  return root.querySelector(`[data-connection-id="${connectionId}"] .line`);
};

const updateActivePvDatasets = (payload = {}) => {
  nextTick(() => {
    Object.entries(payload).forEach(([cardId, values]) => {
      const cardElement = getCardElement(cardId);
      if (!cardElement) {
        return;
      }
      const hidden = cardElement.querySelector('.active-pv-hidden');
      if (!hidden) {
        return;
      }

      const units = values.units || { left: 0, right: 0 };
      const manual = values.manual || { left: 0, right: 0 };
      const remainder = values.remainder || { left: 0, right: 0 };

      hidden.dataset.locall = String(units.left ?? 0);
      hidden.dataset.localr = String(units.right ?? 0);
      hidden.dataset.btnl = String(manual.left ?? 0);
      hidden.dataset.btnr = String(manual.right ?? 0);
      hidden.dataset.remainderl = String(remainder.left ?? 0);
      hidden.dataset.remainderr = String(remainder.right ?? 0);
    });
  });
};

// Хранилище активных таймеров анимации
const activeAnimationTimers = new Map(); // cardId -> { cardTimer, lineTimers: [] }

// Функция отмены всех активных анимаций
const cancelAllActiveAnimations = () => {
  console.log('🛑 Отмена всех активных анимаций, количество:', activeAnimationTimers.size);

  activeAnimationTimers.forEach((timers, cardId) => {
    // Отменяем таймер карточки
    if (timers.cardTimer) {
      clearTimeout(timers.cardTimer);
      // Убираем класс анимации с карточки
      const cardElement = getCardElement(cardId);
      if (cardElement) {
        cardElement.classList.remove('card--balance-propagation');
      }
    }

    // Отменяем таймеры линий
    if (Array.isArray(timers.lineTimers)) {
      timers.lineTimers.forEach(({ timer, lineElement }) => {
        clearTimeout(timer);
        // Убираем класс анимации с линии
        if (lineElement) {
          lineElement.classList.remove('line--balance-propagation');
        }
      });
    }
  });

  activeAnimationTimers.clear();
  // Отменяем анимацию чисел на всех карточках

  const root = canvasContainerRef.value || document;

  const animatingValues = root.querySelectorAll('.value--animating');

  console.log('🔢 Отмена анимации чисел, найдено элементов:', animatingValues.length);

 

  animatingValues.forEach(element => {

    element.classList.remove('value--animating');

  });

 

  console.log('✅ Все анимации отменены (линии и числа)');
};

const highlightActivePvChange = (cardId) => {
  if (!cardId) {
    return;
  }
  const cardElement = getCardElement(cardId);
  if (cardElement) {
    cardElement.classList.add('card--balance-highlight');
    window.setTimeout(() => {
      cardElement.classList.remove('card--balance-highlight');
    }, ACTIVE_PV_FLASH_MS);
  }

  const relatedConnections = connections.value.filter(connection => connection.from === cardId || connection.to === cardId);
  relatedConnections.forEach(connection => {
    const lineElement = getConnectionElement(connection.id);
    if (!lineElement) {
      return;
    }
    lineElement.classList.add('line--balance-flash');
    window.setTimeout(() => {
      lineElement.classList.remove('line--balance-flash');
    }, ACTIVE_PV_FLASH_MS);
  });
};

// Анимация распространения баланса вверх по структуре
const animateBalancePropagation = (changedCardId, changedSide = null) => {
  if (!changedCardId) {
    return;
  }

  // Получаем длительность анимации из настроек
  const animationDuration = viewSettingsStore.animationDurationMs || 2000;

  console.log('🎨 Запуск анимации баланса для карточки:', changedCardId, 'длительность:', animationDuration);

  // Инициализируем хранилище таймеров для этой карточки
  const timers = {
    cardTimer: null,
    lineTimers: []
  };

  // Показываем желтый индикатор на измененной карточке через CSS-класс
  const cardElement = getCardElement(changedCardId);
  if (cardElement) {
    console.log('✅ Карточка найдена, добавляем класс card--balance-propagation');
    cardElement.classList.add('card--balance-propagation');
    const cardTimer = window.setTimeout(() => {
      cardElement.classList.remove('card--balance-propagation');
    }, animationDuration);
    timers.cardTimer = cardTimer;
  } else {
    console.warn('❌ Карточка не найдена:', changedCardId);
  }

  // Находим путь вверх по структуре
  const meta = cardsStore.calculationMeta || {};
  const parentOf = meta.parentOf || {};

  console.log('📊 Метаданные parentOf:', parentOf);

  const pathUp = [];
  let currentId = changedCardId;

  // Строим путь от текущей карточки до корня
  while (parentOf[currentId]) {
    const relation = parentOf[currentId];
    const parentId = relation.parentId;
    const side = relation.side;

    console.log(`🔗 Связь найдена: ${currentId} -> ${parentId} (сторона: ${side})`);
    if (!parentId) break;

    // Находим линию между текущей карточкой и родителем
    const connection = connections.value.find(conn =>
      (conn.from === currentId && conn.to === parentId) ||
      (conn.from === parentId && conn.to === currentId)
    );

    if (connection) {
      console.log(`✅ Соединение найдено: ${connection.id}`);
      pathUp.push({ connectionId: connection.id, side });
    } else {
      console.warn(`❌ Соединение НЕ найдено между ${currentId} и ${parentId}`);
    }
    currentId = parentId;
  }

  console.log('📍 Путь вверх построен, найдено линий:', pathUp.length);

  // Применяем анимацию к линиям вверх по структуре
  pathUp.forEach(({ connectionId }, index) => {
    const lineElement = getConnectionElement(connectionId);
    console.log(`Линия ${index + 1}/${pathUp.length}:`, connectionId, '→ элемент найден:', !!lineElement);

    if (!lineElement) return;
    lineElement.classList.add('line--balance-propagation');
    console.log('✅ Класс line--balance-propagation добавлен к линии:', connectionId);
    const lineTimer = window.setTimeout(() => {
      lineElement.classList.remove('line--balance-propagation');
    }, animationDuration);
    timers.lineTimers.push({ timer: lineTimer, lineElement });
  });

  // Сохраняем таймеры в глобальном хранилище
  activeAnimationTimers.set(changedCardId, timers);
};

const applyActivePvPropagation = (highlightCardId = null, options = {}) => {
  if (!Array.isArray(cardsStore.cards) || cardsStore.cards.length === 0) {
    return;
  }

  const propagation = propagateActivePvUp(cardsStore.cards, cardsStore.calculationMeta || {});
  const datasetPayload = {};
  const cardsWithBalanceChanges = []; // Карточки с изменениями баланса для анимации

  Object.entries(propagation).forEach(([cardId, data]) => {
    const card = cardsStore.cards.find(item => item.id === cardId);
    if (!card) {
      return;
    }

    const manualLeft = Math.max(0, Number(data?.manual?.left ?? 0));
    const manualRight = Math.max(0, Number(data?.manual?.right ?? 0));
    const manualTotal = manualLeft + manualRight;

    const remainderLeft = Math.max(0, Number(data?.remainder?.left ?? 0));
    const remainderRight = Math.max(0, Number(data?.remainder?.right ?? 0));
    const localBalanceLeft = Math.max(0, Number(data?.localBalance?.left ?? 0));
    const localBalanceRight = Math.max(0, Number(data?.localBalance?.right ?? 0));
    
    const unitsLeft = Math.max(0, Number(data?.units?.left ?? 0));
    const unitsRight = Math.max(0, Number(data?.units?.right ?? 0));
    const unitsTotal = unitsLeft + unitsRight;
    const balanceLeft = Math.max(0, Number(data?.balance?.left ?? remainderLeft));
    const balanceRight = Math.max(0, Number(data?.balance?.right ?? remainderRight));
    const packs = Math.max(0, Number(data?.activePacks ?? 0));
    const cycles = Math.max(0, Number(data?.cycles ?? 0));

    const formattedRemainder = `${remainderLeft} / ${remainderRight}`;

    const updates = {};

    if (!card.activePvManual
      || card.activePvManual.left !== manualLeft
      || card.activePvManual.right !== manualRight
      || card.activePvManual.total !== manualTotal) {
      updates.activePvManual = { left: manualLeft, right: manualRight, total: manualTotal };
    }

    if (!card.activePvLocal
      || card.activePvLocal.left !== manualLeft
      || card.activePvLocal.right !== manualRight
      || card.activePvLocal.total !== manualTotal) {
      updates.activePvLocal = { left: manualLeft, right: manualRight, total: manualTotal };
    }

    if (!card.activePvAggregated
      || card.activePvAggregated.left !== unitsLeft
      || card.activePvAggregated.right !== unitsRight
      || card.activePvAggregated.total !== unitsTotal
      || card.activePvAggregated.remainderLeft !== remainderLeft
      || card.activePvAggregated.remainderRight !== remainderRight) {
      updates.activePvAggregated = {
        left: unitsLeft,
        right: unitsRight,
        total: unitsTotal,
        remainderLeft,
        remainderRight
      };
    }
    if (!card.activePvLocalBalance
      || card.activePvLocalBalance.left !== localBalanceLeft
      || card.activePvLocalBalance.right !== localBalanceRight
      || card.activePvLocalBalance.total !== localBalanceLeft + localBalanceRight) {
      updates.activePvLocalBalance = {
        left: localBalanceLeft,
        right: localBalanceRight,
        total: localBalanceLeft + localBalanceRight
      };
    }

    if (card.activePv !== formattedRemainder) {
      updates.activePv = formattedRemainder;
    }
    if (!card.activePvBalance
      || card.activePvBalance.left !== balanceLeft
      || card.activePvBalance.right !== balanceRight) {
      updates.activePvBalance = { left: balanceLeft, right: balanceRight };

      console.log(`💰 Изменение баланса для карточки ${cardId}:`, {

        oldLeft: card.activePvBalance?.left ?? 0,

        newLeft: balanceLeft,

        oldRight: card.activePvBalance?.right ?? 0,

        newRight: balanceRight,

        triggerAnimation: options.triggerAnimation

      });

 

      // Запоминаем карточки с изменениями баланса для анимации

      if (options.triggerAnimation) {

        const changedSide = balanceLeft !== (card.activePvBalance?.left ?? 0) ? 'left' :

                           balanceRight !== (card.activePvBalance?.right ?? 0) ? 'right' : null;

        console.log(`  ➡️ Добавляем в массив анимации: cardId=${cardId}, side=${changedSide}`);
        cardsWithBalanceChanges.push({ cardId, side: changedSide });
      }
    }

    if (!Number.isFinite(card.activePvPacks) || card.activePvPacks !== packs) {
      updates.activePvPacks = packs;
    }

    if (!Number.isFinite(card.activePvCycles) || card.activePvCycles !== cycles) {
      updates.activePvCycles = cycles;
    }
    if (Object.keys(updates).length > 0) {
      cardsStore.updateCard(cardId, updates, { saveToHistory: false });
    }

    datasetPayload[cardId] = {
      manual: { left: manualLeft, right: manualRight },
      units: { left: unitsLeft, right: unitsRight },
      remainder: { left: remainderLeft, right: remainderRight }
    };
  });

  updateActivePvDatasets(datasetPayload);

  if (options.saveHistory) {
    const actionDescription = options.historyDescription || 'Изменены бонусы Active-PV';
    historyStore.setActionMetadata('update', actionDescription);
    historyStore.saveState();
  }

  if (highlightCardId) {
    highlightActivePvChange(highlightCardId);
  }

  console.log('🔍 Проверка запуска анимации:');

  console.log('  - options.triggerAnimation:', options.triggerAnimation);

  console.log('  - cardsWithBalanceChanges.length:', cardsWithBalanceChanges.length);

  console.log('  - cardsWithBalanceChanges:', cardsWithBalanceChanges);

 

  // Запускаем анимацию для карточек с изменениями баланса при автоматических расчетах

  if (options.triggerAnimation && cardsWithBalanceChanges.length > 0) {

    console.log('✅ Запускаем анимацию для', cardsWithBalanceChanges.length, 'карточек');

    cardsWithBalanceChanges.forEach(({ cardId, side }) => {

      animateBalancePropagation(cardId, side);

    });

  } else {

    console.warn('❌ Анимация НЕ запускается. Причина:');

    if (!options.triggerAnimation) console.warn('   - triggerAnimation = false');

    if (cardsWithBalanceChanges.length === 0) console.warn('   - нет карточек с изменениями баланса');
  }
};

const handleActivePvButtonClick = (event) => {
  const button = event.target.closest('.active-pv-btn');
  if (!button) {
    return;
  }

  const cardElement = button.closest('[data-card-id]');
  if (!cardElement) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  const cardId = cardElement.dataset.cardId;
  const card = cardsStore.cards.find(item => item.id === cardId);

  if (!cardId || !card) {
    return;
  }
  const meta = cardsStore.calculationMeta || {};
  let result;

  const action = button.dataset.action || 'delta';
  let shouldAnimate = false; // Флаг для определения, нужна ли анимация

  if (action === 'clear-all') {
    result = applyActivePvClear({ cards: cardsStore.cards, meta, cardId });
    shouldAnimate = false; // Не анимируем при очистке (корзина)
  } else {
    const direction = button.dataset.dir === 'right' ? 'right' : 'left';
    let step = Number(button.dataset.step);

    if (!Number.isFinite(step) || step === 0) {
      return;
    }

    if (step < 0) {
      const hiddenElement = cardElement.querySelector('.active-pv-hidden');
      const remainderKey = direction === 'right' ? 'remainderr' : 'remainderl';
      const parsedRemainder = Number(hiddenElement?.dataset?.[remainderKey]);
      const remainder = Number.isFinite(parsedRemainder) ? parsedRemainder : 0;

      if (-step > remainder) {
        step = -remainder;
      }

      if (step === 0) {
        return;
      }
      shouldAnimate = false; // Не анимируем при уменьшении (-1, -10)
    } else {
      shouldAnimate = true; // Анимируем только при увеличении (+1, +10)
    }

    result = applyActivePvDelta({
      cards: cardsStore.cards,
      meta,
      cardId,
      side: direction,
      delta: step
    });
  }

  const updates = result?.updates || {};
  const changedIds = result?.changedIds || [];

  const updateEntries = Object.entries(updates);



  console.log('📦 Результат applyActivePvDelta:', {

    updatesCount: updateEntries.length,

    changedIds,

    cardId,

    shouldAnimate

  });



  if (updateEntries.length === 0) {

    return;

  }



  updateEntries.forEach(([id, payload]) => {

    cardsStore.updateCard(id, payload, { saveToHistory: false });

  });



  const description = card?.text

    ? `Active-PV обновлены для "${card.text}"`

    : 'Изменены бонусы Active-PV';



  // Запускаем анимацию ТОЛЬКО если значения увеличились (shouldAnimate === true)

  if (shouldAnimate && changedIds.length > 0) {

    console.log('🎯 Запуск анимации для changedIds:', changedIds);

    // Отменяем все предыдущие анимации перед запуском новых
    cancelAllActiveAnimations();

    changedIds.forEach(id => {

      animateBalancePropagation(id);

    });

  } else {

    console.log('❌ Анимация НЕ запускается (уменьшение или очистка)');

  }



  applyActivePvPropagation(cardId, { saveHistory: true, historyDescription: description, triggerAnimation: false });
};  
const getCurrentZoom = () => {
  const value = Number(zoomScale.value);
  return Number.isFinite(value) && value > 0 ? value : 1;
};  
const cardsWithVisibleNotes = computed(() => cards.value.filter(card => card.note && card.note.visible));

/**
 * Отсортированные изображения по z-index (от меньшего к большему)
 * Это гарантирует правильный порядок рендеринга в DOM
 */
const sortedImages = computed(() => {
  return [...images.value].sort((a, b) => {
    const zIndexA = a.zIndex !== undefined ? a.zIndex : 0
    const zIndexB = b.zIndex !== undefined ? b.zIndex : 0
    return zIndexA - zIndexB
  })
})

/**
 * Отсортированные стикеры по z-index (от меньшего к большему)
 * Это гарантирует правильный порядок рендеринга в DOM
 */
const sortedStickers = computed(() => {
  return [...stickersStore.stickers].sort((a, b) => {
    const zIndexA = a.z_index !== undefined ? a.z_index : 10000
    const zIndexB = b.z_index !== undefined ? b.z_index : 10000
    return zIndexA - zIndexB
  })
})

const engineInput = computed(() => {
  const normalizedCards = cards.value.map(card => ({
    id: card.id,
    x: Number.isFinite(card.x) ? card.x : 0,
    y: Number.isFinite(card.y) ? card.y : 0,
    width: Number.isFinite(card.width) ? card.width : 0,
    height: Number.isFinite(card.height) ? card.height : 0,
    bodyHTML: typeof card.bodyHTML === 'string' ? card.bodyHTML : '',
    pv: typeof card.pv === 'string' ? card.pv : ''
  }));

  const normalizedLines = connections.value.map(connection => ({
    startId: connection.from,
    endId: connection.to,
    startSide: connection.fromSide,
    endSide: connection.toSide
  }));

  return {
    cards: normalizedCards,
    lines: normalizedLines
  };
});

watch(engineInput, (state) => {
  if (!state.cards.length) {
    cardsStore.resetCalculationResults();
    applyActivePvPropagation(null, { triggerAnimation: false });
    return;
  }

  try {
    const { result, meta } = Engine.recalc(state);
    cardsStore.applyCalculationResults({ result, meta });
    applyActivePvPropagation(null, { triggerAnimation: true });
  } catch (error) {
    console.error('Engine recalculation error:', error);
  }
}, { immediate: true });
const GUIDE_SNAP_THRESHOLD = 10;

const resetActiveGuides = () => {
  activeGuides.value = { vertical: null, horizontal: null };
};

const snapDelta = (value) => {
  const step = gridStepRef.value;

  if (!step || step <= 0) {
    return value;
  }

  return Math.round(value / step) * step;
};

const computeGuideSnap = (primaryCardId, proposedX, proposedY) => {
  if (!guidesEnabled.value || !primaryCardId) {
    return null;
  }

  const primaryCard = findCardById(primaryCardId);
  if (!primaryCard) {
    return null;
  }

  const movingIds = dragState.value?.movingIds;
  const cardWidth = primaryCard.width || 0;
  const cardHeight = primaryCard.height || 0;

  const currentEdges = {
    left: proposedX,
    center: proposedX + cardWidth / 2,
    right: proposedX + cardWidth
  };
  const currentRows = {
    top: proposedY,
    middle: proposedY + cardHeight / 2,
    bottom: proposedY + cardHeight
  };

  const bestMatch = {
    vertical: { diff: GUIDE_SNAP_THRESHOLD + 1 },
    horizontal: { diff: GUIDE_SNAP_THRESHOLD + 1 }
  };

  cards.value.forEach(otherCard => {
    if (!otherCard || otherCard.id === primaryCardId) {
      return;
    }

    if (movingIds && typeof movingIds.has === 'function' && movingIds.has(otherCard.id)) {
      return;
    }

    const otherEdges = {
      left: otherCard.x,
      center: otherCard.x + (otherCard.width || 0) / 2,
      right: otherCard.x + (otherCard.width || 0)
    };
    const otherRows = {
      top: otherCard.y,
      middle: otherCard.y + (otherCard.height || 0) / 2,
      bottom: otherCard.y + (otherCard.height || 0)
    };

    Object.entries(currentEdges).forEach(([position, value]) => {
      Object.entries(otherEdges).forEach(([otherPosition, otherValue]) => {
        const diff = Math.abs(value - otherValue);
        if (diff < bestMatch.vertical.diff && diff <= GUIDE_SNAP_THRESHOLD) {
          let targetX = proposedX;
          switch (position) {
            case 'left':
              targetX = otherValue;
              break;
            case 'center':
              targetX = otherValue - cardWidth / 2;
              break;
            case 'right':
              targetX = otherValue - cardWidth;
              break;
          }
          bestMatch.vertical = {
            diff,
            guidePosition: otherValue,
            adjust: targetX - proposedX
          };
        }
      });
    });

    Object.entries(currentRows).forEach(([position, value]) => {
      Object.entries(otherRows).forEach(([otherPosition, otherValue]) => {
        const diff = Math.abs(value - otherValue);
        if (diff < bestMatch.horizontal.diff && diff <= GUIDE_SNAP_THRESHOLD) {
          let targetY = proposedY;
          switch (position) {
            case 'top':
              targetY = otherValue;
              break;
            case 'middle':
              targetY = otherValue - cardHeight / 2;
              break;
            case 'bottom':
              targetY = otherValue - cardHeight;
              break;
          }
          bestMatch.horizontal = {
            diff,
            guidePosition: otherValue,
            adjust: targetY - proposedY
          };
        }
      });
    });
  });

  const result = {
    adjustX: 0,
    adjustY: 0,
    guides: { vertical: null, horizontal: null }
  };

  if (bestMatch.vertical.diff <= GUIDE_SNAP_THRESHOLD) {
    result.adjustX = bestMatch.vertical.adjust;
    result.guides.vertical = bestMatch.vertical.guidePosition;
  }

  if (bestMatch.horizontal.diff <= GUIDE_SNAP_THRESHOLD) {
    result.adjustY = bestMatch.horizontal.adjust;
    result.guides.horizontal = bestMatch.horizontal.guidePosition;
  }

  if (!result.guides.vertical && !result.guides.horizontal) {
    return null;
  }

  return result;
};

const guideOverlayStyle = computed(() => ({
  width: `${stageConfig.value.width}px`,
  height: `${stageConfig.value.height}px`
}));

  
const canvasContainerClasses = computed(() => ({
  'canvas-container--selection-mode': isSelectionMode.value,
  'canvas-container--sticker-placement': stickersStore.isPlacementMode,
  'canvas-container--anchor-placement': placementMode.value === 'anchor'
}));

const selectionBoxStyle = computed(() => {
  if (!selectionRect.value) {
    return { display: 'none' };
  }

  const { left, top, width, height } = selectionRect.value;

  return {
    left: `${left}px`,
    top: `${top}px`,
    width: `${width}px`,
    height: `${height}px`
  };
});

const connectionPaths = computed(() => {
  return connections.value
    .map(connection => {
      const fromCard = cards.value.find(card => card.id === connection.from);
      const toCard = cards.value.find(card => card.id === connection.to);

      if (!fromCard || !toCard) return null;

      const geometry = buildConnectionGeometry(connection, fromCard, toCard);


       if (!geometry || !geometry.d) {
        return null;
      }


      return {
        id: connection.id,
        d: geometry.d,
        color: connection.color || connectionsStore.defaultLineColor,
        strokeWidth: connection.thickness || connectionsStore.defaultLineThickness,
        highlightType: connection.highlightType || null,
        animationDuration: connection.animationDuration ?? connectionsStore.defaultAnimationDuration
      };
    })
    .filter(Boolean);
});

const previewLinePath = computed(() => {
  if (!isDrawingLine.value || !connectionStart.value) return null;
  
  const fromCard = cards.value.find(card => card.id === connectionStart.value.cardId);
  if (!fromCard) return null;

  const startPoint = getCardConnectorPoint(fromCard, connectionStart.value.side);
  const { d } = buildOrthogonalConnectionPath(startPoint, mousePosition.value, connectionStart.value.side, null);

  return {
    d,
    color: '#ff9800',
    strokeWidth: previewLineWidth.value,
    strokeDasharray: '5,5'
  };
});

const findCardById = (cardId) => cards.value.find(card => card.id === cardId);

const getCardElementRect = (cardId) => {
  const element = document.querySelector(`[data-card-id="${cardId}"]`);
  return element ? element.getBoundingClientRect() : null;
};

const ensureCardNote = (card) => {
  if (!card) {
    return null;
  }
  card.note = ensureNoteStructure(card.note);
  if (!card.note.viewDate) {
    const selected = card.note.selectedDate || card.note.viewDate || '';
    if (selected) {
      card.note.viewDate = `${selected.slice(0, 7)}-01`;
    }
  }
  return card.note;
};

const handleNoteWindowRegister = (cardId, instance) => {
  if (instance) {
    noteWindowRefs.set(cardId, instance);
  } else {
    noteWindowRefs.delete(cardId);
  }
};

const syncNoteWindowWithCard = (cardId, options = {}) => {
const card = findCardById(cardId);
  if (!card || !card.note || !card.note.visible) {
    return;
  }
  const scale = getCurrentZoom();
  const alignSide = options.align === 'left' ? 'left' : 'right';
  const shouldForceAlign = Boolean(options.forceAlign)
    || !Number.isFinite(card.note.offsetX)
    || !Number.isFinite(card.note.offsetY);

  const ref = noteWindowRefs.get(cardId);
  if (ref && typeof ref.syncWithCardPosition === 'function') {
    ref.syncWithCardPosition({ scale, forceAlign: shouldForceAlign });
    return;
  }
  const rect = getCardElementRect(cardId);
  if (rect) {
    applyCardRectToNote(card.note, rect, {
      scale,
      align: alignSide,
      forceAlign: shouldForceAlign
    });
    updateNoteOffsets(card.note, rect, { scale });
  }
};

const openNoteForCard = (card, options = {}) => {
  const note = ensureCardNote(card);
  if (!note) {
    return;
  }

  // Закрыть все другие открытые заметки перед открытием новой
  cards.value.forEach(c => {
    if (c.id !== card.id && c.note && c.note.visible) {
      c.note.visible = false;
    }
  });

  note.width = Number.isFinite(note.width) ? note.width : DEFAULT_NOTE_WIDTH;
  note.height = Number.isFinite(note.height) ? note.height : DEFAULT_NOTE_HEIGHT;
  const rect = getCardElementRect(card.id);
  if (rect) {
    const scale = getCurrentZoom();
    applyCardRectToNote(note, rect, {
      scale,
      align: 'right',
      forceAlign: Boolean(options?.forceAlign)
    });
    updateNoteOffsets(note, rect, { scale });
  }
  if (!note.viewDate && note.selectedDate) {
    note.viewDate = `${note.selectedDate.slice(0, 7)}-01`;
  }
  note.visible = true;
  syncNoteWindowWithCard(card.id, { forceAlign: Boolean(options?.forceAlign), align: 'right' });
};

const closeNoteForCard = (card, options = { saveToHistory: false }) => {
  const note = ensureCardNote(card);
  if (!note) {
    return;
  }
  note.visible = false;
  if (options.saveToHistory) {
    historyStore.setActionMetadata('update', `Закрыта заметка для карточки "${card.text}"`);
    historyStore.saveState();
  }
};

const handleNoteWindowClose = (cardId) => {
  const card = findCardById(cardId);
  if (!card) {
    return;
  }
  closeNoteForCard(card);
};

const focusCardOnCanvas = (cardId) => {
  const card = findCardById(cardId);
  if (!card || !canvasContainerRef.value) {
    return;
  }
  const scale = zoomScale.value || 1;
  const containerRect = canvasContainerRef.value.getBoundingClientRect();
  const cardCenterX = card.x + (card.width || 0) / 2;
  const cardCenterY = card.y + (card.height || 0) / 2;
  const targetTranslateX = containerRect.width / 2 - cardCenterX * scale;
  const targetTranslateY = containerRect.height / 2 - cardCenterY * scale;

  setZoomTransform({
    scale,
    translateX: targetTranslateX,
    translateY: targetTranslateY
  });

  cardsStore.deselectAllCards();
  cardsStore.selectCard(cardId);
};

const focusStickerOnCanvas = (stickerId) => {
  const sticker = stickersStore.stickers.find(s => s.id === stickerId);
  if (!sticker || !canvasContainerRef.value) {
    console.warn(`Стикер с ID ${stickerId} не найден для фокусировки.`);
    return;
  }

  // 1. Получаем текущие параметры холста
  const scale = zoomScale.value || 1;
  const containerRect = canvasContainerRef.value.getBoundingClientRect();

  // 2. Вычисляем целевые координаты для центрирования стикера
  // Размеры стикера примерно 200x150, берем центр
  const stickerCenterX = sticker.pos_x + 100;
  const stickerCenterY = sticker.pos_y + 75;
  const targetTranslateX = containerRect.width / 2 - stickerCenterX * scale;
  const targetTranslateY = containerRect.height / 2 - stickerCenterY * scale;

  // 3. Плавно перемещаем холст
  setZoomTransform({
    scale,
    translateX: targetTranslateX,
    translateY: targetTranslateY
  });

  // 4. Снимаем выделение со всего остального
  stickersStore.deselectAllStickers();
  cardsStore.deselectAllCards();

  // 5. Выделяем нужный стикер и запускаем анимацию
  // Небольшая задержка, чтобы пользователь увидел перемещение холста
  setTimeout(() => {
    // Выделяем стикер
    stickersStore.selectSticker(stickerId);

    // Находим DOM-элемент стикера и добавляем класс для анимации
    const stickerElement = document.querySelector(`[data-sticker-id="${stickerId}"]`);
    if (stickerElement) {
      stickerElement.classList.add('sticker--focused');
      
      // Убираем класс после завершения анимации (длительность 2000ms)
      setTimeout(() => {
        stickerElement.classList.remove('sticker--focused');
      }, 2000);
    }
  }, 150); // Задержка в 150мс
};
const focusAnchorOnCanvas = (anchorId) => {
  const anchor = anchors.value.find(item => item.id === anchorId);
  if (!anchor || !canvasContainerRef.value) {
    return;
  }
  const anchorX = Number.isFinite(anchor.pos_x) ? anchor.pos_x : anchor.x;
  const anchorY = Number.isFinite(anchor.pos_y) ? anchor.pos_y : anchor.y;

  const scale = zoomScale.value || 1;
  const containerRect = canvasContainerRef.value.getBoundingClientRect();
  const targetTranslateX = containerRect.width / 2 - anchorX * scale;
  const targetTranslateY = containerRect.height / 2 - anchorY * scale;
  setZoomTransform({
    scale,
    translateX: targetTranslateX,
    translateY: targetTranslateY
  });

  boardStore.selectAnchor(anchorId);
};

// Наблюдаем за запросами на фокусировку стикера через Pinia store
watch(() => stickersStore.pendingFocusStickerId, (stickerId) => {
  if (stickerId !== null) {
    focusStickerOnCanvas(stickerId);
    // Сбрасываем состояние, чтобы можно было повторно кликнуть на тот же стикер
    stickersStore.pendingFocusStickerId = null;
  }
});
watch(pendingFocusAnchorId, (anchorId) => {
  if (!anchorId) {
    return;
  }
  focusAnchorOnCanvas(anchorId);
  pendingFocusAnchorId.value = null;
});

const getBranchDescendants = (startCardId, branchFilter) => {
  const visited = new Set([startCardId]);
  const descendants = new Set();
  const queue = [startCardId];
  let isInitialCard = true;

  while (queue.length > 0) {
    const currentId = queue.shift();

    for (const connection of connections.value) {
      const fromCard = findCardById(connection.from);
      const toCard = findCardById(connection.to);

      if (!fromCard || !toCard) {
        continue;
      }

      const fromTop = fromCard.y;
      const toTop = toCard.y;

      let parentId = connection.from;
      let childId = connection.to;
      let parentSide = connection.fromSide;

      if (fromTop > toTop) {
        parentId = connection.to;
        childId = connection.from;
        parentSide = connection.toSide;
      } else if (fromTop === toTop) {
        // Если карточки расположены на одной горизонтали, оставляем ориентацию соединения без изменений
        parentId = connection.from;
        childId = connection.to;
        parentSide = connection.fromSide;
      }
          connection.fromSide === branchFilter;

      if (parentId !== currentId) {
        continue;
      }

      const normalizedParentSide = parentSide || 'bottom';

      if (isInitialCard) {
        if (branchFilter === 'all') {
          if (!['left', 'right', 'bottom'].includes(normalizedParentSide)) {
            continue;
          }
        } else if (branchFilter && normalizedParentSide !== branchFilter) {          continue;
        }
      }

      if (!visited.has(childId)) {
        visited.add(childId);
        descendants.add(childId);
        queue.push(childId);
      }
    }

    isInitialCard = false;
  }

  return descendants;
};

const collectDragTargets = (cardId, event) => {
  const cardIds = new Set();
  const stickerIds = new Set();
  let imageIds = [];
  
  if (isHierarchicalDragMode.value) {
    const branchTarget = event.target;
    let branchFilter = null;

    if (branchTarget.closest('.card-header')) {
      branchFilter = 'all';
    } else {
      const bodyElement = branchTarget.closest('.card-body');
      if (!bodyElement) {
        return { cardIds: [], stickerIds: [], imageIds: [] };
      }
      const bodyRect = bodyElement.getBoundingClientRect();
      const offsetX = event.clientX - bodyRect.left;
      branchFilter = offsetX < bodyRect.width / 2 ? 'left' : 'right';
    }

    clearObjectSelections();
    cardIds.add(cardId);
    cardsStore.selectCard(cardId);

    const descendants = getBranchDescendants(cardId, branchFilter);
    descendants.forEach(descendantId => {
      cardIds.add(descendantId);
      cardsStore.selectCard(descendantId);
    });
  } else {
    const isCardAlreadySelected = cardsStore.selectedCardIds.includes(cardId);

    if (isCardAlreadySelected) {
      cardsStore.selectedCardIds.forEach(id => cardIds.add(id));
      stickersStore.selectedStickerIds.forEach(id => stickerIds.add(id));
      imageIds = Array.from(imagesStore.selectedImageIds);
    } else if (event?.ctrlKey || event?.metaKey) {
      return { cardIds: [], stickerIds: [], imageIds: [] };
    } else {
      clearObjectSelections();
      cardsStore.selectCard(cardId);
      cardIds.add(cardId);
    }
  }

  selectedCardId.value = cardId;
  selectedConnectionIds.value = [];

  return {
    cardIds: Array.from(cardIds),
    stickerIds: Array.from(stickerIds),
    imageIds
  };
};

const collectStickerDragTargets = (stickerId, event) => {
  const stickerIds = new Set();
  const cardIds = new Set();
  let imageIds = [];
  const isStickerAlreadySelected = stickersStore.selectedStickerIds.includes(stickerId);

  if (isStickerAlreadySelected) {
    stickersStore.selectedStickerIds.forEach(id => stickerIds.add(id));
    cardsStore.selectedCardIds.forEach(id => cardIds.add(id));
    imageIds = Array.from(imagesStore.selectedImageIds);
  } else if (event?.ctrlKey || event?.metaKey) {
    return { cardIds: [], stickerIds: [], imageIds: [] };
  } else {
    clearObjectSelections();

    stickersStore.selectSticker(stickerId);
    stickerIds.add(stickerId);
  }

  selectedCardId.value = null;
  selectedConnectionIds.value = [];

  return {
    cardIds: Array.from(cardIds),
    stickerIds: Array.from(stickerIds),
    imageIds
  };
};

const collectImageDragTargets = (imageId, event) => {
  const cardIds = new Set();
  const stickerIds = new Set();
  let imageIds = new Set();

  const isImageAlreadySelected = imagesStore.selectedImageIds.includes(imageId);

  if (isImageAlreadySelected) {
    cardsStore.selectedCardIds.forEach(id => cardIds.add(id));
    stickersStore.selectedStickerIds.forEach(id => stickerIds.add(id));
    imageIds = new Set(imagesStore.selectedImageIds);
  } else if (event?.ctrlKey || event?.metaKey) {
    return { cardIds: [], stickerIds: [], imageIds: [] };
  } else {
    clearObjectSelections();
    imagesStore.selectImage(imageId);
    imageIds.add(imageId);
  }

  selectedCardId.value = cardIds.size > 0 ? selectedCardId.value : null;
  selectedConnectionIds.value = [];

  return {
    cardIds: Array.from(cardIds),
    stickerIds: Array.from(stickerIds),
    imageIds: Array.from(imageIds)
  };
};
  
const createConnectionBetweenCards = (fromCardId, toCardId, options = {}) => {
  if (fromCardId === toCardId) return null;

  const fromCard = cards.value.find(card => card.id === fromCardId);
  const toCard = cards.value.find(card => card.id === toCardId);

  if (!fromCard || !toCard) return null;

  const { fromSide, toSide } = resolveConnectionSides(
    fromCard,
    toCard,
    options.fromSide,
    options.toSide
  );

  return connectionsStore.addConnection(fromCardId, toCardId, {
    ...options,
    fromSide,
    toSide
  });
};
  
const screenToCanvas = (clientX, clientY) => {
  if (!canvasContainerRef.value) return { x: clientX, y: clientY };
  
  const rect = canvasContainerRef.value.getBoundingClientRect();
  const x = (clientX - rect.left - zoomTranslateX.value) / zoomScale.value;
  const y = (clientY - rect.top - zoomTranslateY.value) / zoomScale.value;
  
  return { x, y };
};

const updateStageSize = () => {
  if (!canvasContainerRef.value) {
    return;
  }
  const containerWidth = canvasContainerRef.value.clientWidth;
  const containerHeight = canvasContainerRef.value.clientHeight;
  
  // Установите большой размер холста по умолчанию (неограниченная область)
  const UNLIMITED_CANVAS_SIZE = 50000; // Размер в пиксели - достаточный для любого использования
  
  stageConfig.value.width = UNLIMITED_CANVAS_SIZE;
  stageConfig.value.height = UNLIMITED_CANVAS_SIZE;
  
  const cardBounds = cardsStore.cards.map(card => ({
    right: card.x + (card.width || 0),
    bottom: card.y + (card.height || 0)
  }));

  const stickerBounds = stickersStore.stickers.map(sticker => ({
    right: sticker.pos_x + 200,
    bottom: sticker.pos_y + 150
  }));

  const imageBounds = imagesStore.images.map(image => ({
    right: image.x + (image.width || 0),
    bottom: image.y + (image.height || 0)
  }));

  const anchorBounds = anchors.value.map(anchor => {
    const anchorX = Number.isFinite(anchor.pos_x) ? anchor.pos_x : anchor.x;
    const anchorY = Number.isFinite(anchor.pos_y) ? anchor.pos_y : anchor.y;
    return {
      right: anchorX + 12,
      bottom: anchorY + 12
    };
  });

  const allBounds = [...cardBounds, ...stickerBounds, ...imageBounds, ...anchorBounds];

  const hasObjects = allBounds.length > 0;

  const maxRight = hasObjects ? Math.max(...allBounds.map(item => item.right)) : 0;
  const maxBottom = hasObjects ? Math.max(...allBounds.map(item => item.bottom)) : 0;
  const dynamicPadding = Math.max(CANVAS_PADDING, containerWidth, containerHeight);
  
  const baseWidth = hasObjects
    ? Math.max(containerWidth, maxRight + dynamicPadding)
    : Math.max(containerWidth + CANVAS_PADDING, dynamicPadding);
  const baseHeight = hasObjects
    ? Math.max(containerHeight, maxBottom + dynamicPadding)
    : Math.max(containerHeight + CANVAS_PADDING, dynamicPadding);

  stageConfig.value.width = baseWidth;
  stageConfig.value.height = baseHeight;
};

const removeSelectionListeners = () => {
  window.removeEventListener('pointermove', handleSelectionPointerMove);
  window.removeEventListener('pointerup', handleSelectionPointerUp);
  window.removeEventListener('pointercancel', handleSelectionPointerCancel);
};

const applySelectionFromRect = (rect) => {
  const nextSelectionCardIds = new Set();
  const nextSelectionStickerIds = new Set();
  const nextSelectionImageIds = new Set();

  selectionBaseSelection.cardIds.forEach((id) => {
    if (cardsStore.cards.some(card => card.id === id)) {
      nextSelectionCardIds.add(id);
    }
  });
  selectionBaseSelection.stickerIds.forEach((id) => {
    if (stickersStore.stickers.some(sticker => sticker.id === id)) {
      nextSelectionStickerIds.add(id);
    }
  });
  selectionBaseSelection.imageIds.forEach((id) => {
    if (imagesStore.images.some(image => image.id === id)) {
      nextSelectionImageIds.add(id);
    }
  });

  if (canvasContainerRef.value) {
    // Проверяем карточки
    const cardElements = canvasContainerRef.value.querySelectorAll('.card');
    cardElements.forEach((element) => {
      const cardId = element.dataset.cardId;
      if (!cardId) {
        return;
      }

      const cardRect = element.getBoundingClientRect();
      const intersects =
        cardRect.left < rect.right &&
        cardRect.right > rect.left &&
        cardRect.top < rect.bottom &&
        cardRect.bottom > rect.top;

      if (intersects) {
        nextSelectionCardIds.add(cardId);
      }
    });

    // Проверяем стикеры
    const stickerElements = canvasContainerRef.value.querySelectorAll('.sticker');
    stickerElements.forEach((element) => {
      const stickerId = element.dataset.stickerId;
      if (!stickerId) {
        return;
      }

      const stickerRect = element.getBoundingClientRect();
      const intersects =
        stickerRect.left < rect.right &&
        stickerRect.right > rect.left &&
        stickerRect.top < rect.bottom &&
        stickerRect.bottom > rect.top;

      if (intersects) {
        nextSelectionStickerIds.add(Number(stickerId));
      }
    });

    // Проверяем изображения
    const imageElements = canvasContainerRef.value.querySelectorAll('.canvas-image');
    imageElements.forEach((element) => {
      const imageId = element.dataset.imageId;
      if (!imageId) {
        return;
      }

      const imageRect = element.getBoundingClientRect();
      const intersects =
        imageRect.left < rect.right &&
        imageRect.right > rect.left &&
        imageRect.top < rect.bottom &&
        imageRect.bottom > rect.top;

      if (intersects) {
        nextSelectionImageIds.add(imageId);
      }
    });    
  }

  // Применяем выделение для карточек
  cardsStore.deselectAllCards();
  const orderedCardIds = Array.from(nextSelectionCardIds);
  orderedCardIds.forEach((id) => {
    cardsStore.selectCard(id);
  });

  // Применяем выделение для стикеров
  stickersStore.deselectAllStickers();
  const orderedStickerIds = Array.from(nextSelectionStickerIds);
  orderedStickerIds.forEach((id) => {
    stickersStore.selectSticker(id);
  });
  // Применяем выделение для изображений
  imagesStore.deselectAllImages();
  const orderedImageIds = Array.from(nextSelectionImageIds);
  orderedImageIds.forEach((id) => {
    imagesStore.selectImage(id);
  });
  selectedCardId.value = orderedCardIds.length > 0 ? orderedCardIds[orderedCardIds.length - 1] : null;
};

const updateSelectionRectFromEvent = (event) => {
  if (!selectionStartPoint) {
    return;
  }

  const currentX = event.clientX;
  const currentY = event.clientY;

  const left = Math.min(selectionStartPoint.x, currentX);
  const top = Math.min(selectionStartPoint.y, currentY);
  const width = Math.abs(currentX - selectionStartPoint.x);
  const height = Math.abs(currentY - selectionStartPoint.y);

  const rect = {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height
  };

  selectionRect.value = rect;
  applySelectionFromRect(rect);
};

const finishSelection = () => {

  removeSelectionListeners();
  isSelecting.value = false;
  selectionRect.value = null;
  selectionStartPoint = null;
  selectionBaseSelection = createSelectionBaseState();

  setTimeout(() => {
    suppressNextStageClick = false;
  }, 50);
};

const handleSelectionPointerMove = (event) => {
  if (!isSelecting.value) {
    return;
  }

  event.preventDefault();
  updateSelectionRectFromEvent(event);
};

const handleSelectionPointerUp = (event) => {
  if (isSelecting.value) {
    updateSelectionRectFromEvent(event);
  }
  finishSelection();
};

const handleSelectionPointerCancel = (event) => {
  if (isSelecting.value) {
    updateSelectionRectFromEvent(event);
  }
  finishSelection();
};

const startSelection = (event) => {
  if (event.button !== 0) {
    return;
  }

  event.preventDefault();
  suppressNextStageClick = true;
  isSelecting.value = true;
  selectionStartPoint = { x: event.clientX, y: event.clientY };

  // Сохраняем базовое выделение (включая карточки и стикеры)
  if (event.ctrlKey || event.metaKey) {
    selectionBaseSelection = {
      cardIds: new Set(cardsStore.selectedCardIds),
      stickerIds: new Set(stickersStore.selectedStickerIds),
      imageIds: new Set(imagesStore.selectedImageIds)
    };
  } else {
    selectionBaseSelection = createSelectionBaseState();
    clearObjectSelections();
  }

  selectedConnectionIds.value = [];
  selectedCardId.value = null;
  cancelDrawing();

  selectionRect.value = {
    left: selectionStartPoint.x,
    top: selectionStartPoint.y,
    width: 0,
    height: 0,
    right: selectionStartPoint.x,
    bottom: selectionStartPoint.y
  };

  window.addEventListener('pointermove', handleSelectionPointerMove, { passive: false });
  window.addEventListener('pointerup', handleSelectionPointerUp);
  window.addEventListener('pointercancel', handleSelectionPointerCancel);
};  

const startDrag = (event, cardId) => {
  if (event.button !== 0) {
    return;
  }

  if (isSelecting.value) {
    return;
  }

  const interactiveTarget = event.target.closest('button, input, textarea, select, [contenteditable="true"], a[href]');
  if (interactiveTarget) {
    return;
  }

  const dragTargets = collectDragTargets(cardId, event);
  const dragCardIds = dragTargets.cardIds || [];
  const dragStickerIds = dragTargets.stickerIds || [];
  const dragImageIds = dragTargets.imageIds || [];
  if (dragCardIds.length === 0 && dragStickerIds.length === 0 && dragImageIds.length === 0) {
    return;
  }

  const canvasPos = screenToCanvas(event.clientX, event.clientY);

  // Собираем карточки
  const cardsToDrag = dragCardIds
    .map(id => {
      const card = findCardById(id);
      if (!card) return null;
      return {
        id: card.id,
        type: 'card',
        startX: card.x,
        startY: card.y
      };
    })
    .filter(Boolean);

  // Собираем стикеры
  const stickersToDrag = dragStickerIds
    .map(id => {
      const sticker = stickersStore.stickers.find(s => s.id === id);
      if (!sticker) return null;
      return {
        id: sticker.id,
        type: 'sticker',
        startX: sticker.pos_x,
        startY: sticker.pos_y
      };
    })
    .filter(Boolean);

  // Собираем изображения
  const imagesToDrag = dragImageIds
    .map(id => {
      const image = imagesStore.images.find(img => img.id === id);
      if (!image || image.isLocked) {
        return null;
      }
      return {
        id: image.id,
        type: 'image',
        startX: image.x,
        startY: image.y
      };
    })
    .filter(Boolean);

  const itemsToDrag = [...cardsToDrag, ...stickersToDrag, ...imagesToDrag];
  
  if (itemsToDrag.length === 0) {
    return;
  }

  const movingIds = new Set(itemsToDrag.map(item => item.id));
  const primaryEntry = itemsToDrag.find(item => item.id === cardId) || itemsToDrag[0] || null;

  dragState.value = {
    cards: cardsToDrag,
    stickers: stickersToDrag,
    images: imagesToDrag,    
    items: itemsToDrag,
    startPointer: canvasPos,
    hasMoved: false,
    movingIds,
    primaryCardId: primaryEntry ? primaryEntry.id : null,
    primaryCardStart: primaryEntry ? { x: primaryEntry.startX, y: primaryEntry.startY } : null,
    axisLock: null
  };
  resetActiveGuides();

  const isPointerEvent = typeof PointerEvent !== 'undefined' && event instanceof PointerEvent;

  if (isPointerEvent) {
    activeDragPointerId = event.pointerId;
    dragPointerCaptureElement = event.target;
    dragPointerCaptureElement?.setPointerCapture?.(activeDragPointerId);
    window.addEventListener('pointermove', handleDrag, { passive: false });
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
  } else {
    window.addEventListener('mousemove', handleDrag);
    window.addEventListener('mouseup', endDrag);
  }
  event.preventDefault();
};

const startStickerDrag = (event, stickerId) => {
  if (event.button !== 0) {
    return;
  }

  if (isSelecting.value) {
    return;
  }

  const dragTargets = collectStickerDragTargets(stickerId, event);
  const dragCardIds = dragTargets.cardIds || [];
  const dragStickerIds = dragTargets.stickerIds || [];
  const dragImageIds = dragTargets.imageIds || [];
  if (dragCardIds.length === 0 && dragStickerIds.length === 0 && dragImageIds.length === 0) {
    return;
  }

  const canvasPos = screenToCanvas(event.clientX, event.clientY);

  // Собираем стикеры
  const stickersToDrag = dragStickerIds
    .map(id => {
      const sticker = stickersStore.stickers.find(s => s.id === id);
      if (!sticker) return null;
      return {
        id: sticker.id,
        type: 'sticker',
        startX: sticker.pos_x,
        startY: sticker.pos_y
      };
    })
    .filter(Boolean);

  // Собираем карточки
  const cardsToDrag = dragCardIds
    .map(id => {
      const card = findCardById(id);
      if (!card) return null;
      return {
        id: card.id,
        type: 'card',
        startX: card.x,
        startY: card.y
      };
    })
    .filter(Boolean);

  // Собираем изображения
  const imagesToDrag = dragImageIds
    .map(id => {
      const image = imagesStore.images.find(img => img.id === id);
      if (!image || image.isLocked) {
        return null;
      }
      return {
        id: image.id,
        type: 'image',
        startX: image.x,
        startY: image.y
      };
    })
    .filter(Boolean);

  const itemsToDrag = [...stickersToDrag, ...cardsToDrag, ...imagesToDrag];
  if (itemsToDrag.length === 0) {
    return;
  }

  const movingIds = new Set(itemsToDrag.map(item => item.id));
  const primaryEntry = itemsToDrag.find(item => item.id === stickerId) || itemsToDrag[0] || null;

  dragState.value = {
    cards: cardsToDrag,
    stickers: stickersToDrag,
    images: imagesToDrag,    
    items: itemsToDrag,
    startPointer: canvasPos,
    hasMoved: false,
    movingIds,
    primaryCardId: primaryEntry ? primaryEntry.id : null,
    primaryCardStart: primaryEntry ? { x: primaryEntry.startX, y: primaryEntry.startY } : null,
    axisLock: null
  };
  resetActiveGuides();

  const isPointerEvent = typeof PointerEvent !== 'undefined' && event instanceof PointerEvent;

  if (isPointerEvent) {
    activeDragPointerId = event.pointerId;
    dragPointerCaptureElement = event.target;
    dragPointerCaptureElement?.setPointerCapture?.(activeDragPointerId);
    window.addEventListener('pointermove', handleDrag, { passive: false });
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
  } else {
    window.addEventListener('mousemove', handleDrag);
    window.addEventListener('mouseup', endDrag);
  }
  event.preventDefault();
};

const startImageDrag = ({ event, imageId, interactionType = 'move' }) => {
  if (event.button !== 0) {
    return;
  }

  if (isSelecting.value) {
    return;
  }

  const image = imagesStore.images.find(img => img.id === imageId);
  if (!image || image.isLocked) {
    return;
  }

  const canvasPos = screenToCanvas(event.clientX, event.clientY);

  // Если это resize операция, сохраняем resize state
  if (interactionType.startsWith('resize-')) {
    resizeState.value = {
      imageId: image.id,
      initialWidth: image.width,
      initialHeight: image.height,
      aspectRatio: image.width / image.height,
      keepAspectRatio: !event.shiftKey, // Shift отключает сохранение пропорций
      interactionType: interactionType,
      startX: image.x,
      startY: image.y,
      startPointer: canvasPos
    };

    const isPointerEvent = typeof PointerEvent !== 'undefined' && event instanceof PointerEvent;

    if (isPointerEvent) {
      activeDragPointerId = event.pointerId;
      dragPointerCaptureElement = event.target;
      dragPointerCaptureElement?.setPointerCapture?.(activeDragPointerId);
      window.addEventListener('pointermove', handleImageResize, { passive: false });
      window.addEventListener('pointerup', endImageResize);
      window.addEventListener('pointercancel', endImageResize);
    } else {
      window.addEventListener('mousemove', handleImageResize);
      window.addEventListener('mouseup', endImageResize);
    }
    event.preventDefault();
    return;
  }

  // Обычное перемещение изображения
  const dragTargets = collectImageDragTargets(imageId, event);
  const dragCardIds = dragTargets.cardIds || [];
  const dragStickerIds = dragTargets.stickerIds || [];
  const dragImageIds = dragTargets.imageIds || [];

  if (dragCardIds.length === 0 && dragStickerIds.length === 0 && dragImageIds.length === 0) {
    return;
  }

  const cardsToDrag = dragCardIds
    .map(id => {
      const targetCard = findCardById(id);
      if (!targetCard) return null;
      return {
        id: targetCard.id,
        type: 'card',
        startX: targetCard.x,
        startY: targetCard.y
      };
    })
    .filter(Boolean);

  const stickersToDrag = dragStickerIds
    .map(id => {
      const sticker = stickersStore.stickers.find(s => s.id === id);
      if (!sticker) return null;
      return {
        id: sticker.id,
        type: 'sticker',
        startX: sticker.pos_x,
        startY: sticker.pos_y
      };
    })
    .filter(Boolean);

  const imagesToDrag = dragImageIds
    .map(id => {
      const targetImage = imagesStore.images.find(img => img.id === id);
      if (!targetImage || targetImage.isLocked) {
        return null;
      }
      return {
        id: targetImage.id,
        type: 'image',
        startX: targetImage.x,
        startY: targetImage.y
      };
    })
    .filter(Boolean);

  const itemsToDrag = [...cardsToDrag, ...stickersToDrag, ...imagesToDrag];

  if (itemsToDrag.length === 0) {
    return;
  }

  const movingIds = new Set(itemsToDrag.map(item => item.id));
  const primaryEntry = itemsToDrag.find(item => item.id === imageId) || itemsToDrag[0] || null;

  dragState.value = {
    cards: cardsToDrag,
    stickers: stickersToDrag,
    images: imagesToDrag,
    items: itemsToDrag,
    startPointer: canvasPos,
    hasMoved: false,
    movingIds,
    primaryCardId: primaryEntry ? primaryEntry.id : null,
    primaryCardStart: primaryEntry ? { x: primaryEntry.startX, y: primaryEntry.startY } : null,
    axisLock: null
  };
  resetActiveGuides();

  const isPointerEvent = typeof PointerEvent !== 'undefined' && event instanceof PointerEvent;

  if (isPointerEvent) {
    activeDragPointerId = event.pointerId;
    dragPointerCaptureElement = event.target;
    dragPointerCaptureElement?.setPointerCapture?.(activeDragPointerId);
    window.addEventListener('pointermove', handleDrag, { passive: false });
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
  } else {
    window.addEventListener('mousemove', handleDrag);
    window.addEventListener('mouseup', endDrag);
  }
  event.preventDefault();
};

const handleDragInternal = (event) => {
  if (!dragState.value || (!dragState.value.cards.length && !dragState.value.stickers.length && !dragState.value.images?.length)) {
    return;
  }

  if (
    activeDragPointerId !== null &&
    event.pointerId !== undefined &&
    event.pointerId !== activeDragPointerId
  ) {
    return;
  }

  if (event.cancelable) {
    event.preventDefault();
  }
  const canvasPos = screenToCanvas(event.clientX, event.clientY);
  const rawDx = canvasPos.x - dragState.value.startPointer.x;
  const rawDy = canvasPos.y - dragState.value.startPointer.y;
  let dx = snapDelta(rawDx);
  let dy = snapDelta(rawDy);

  const shiftPressed = Boolean(event.shiftKey);
  let axisLock = dragState.value.axisLock;

  if (!shiftPressed) {
    axisLock = null;
  } else if (!axisLock) {
    const absDx = Math.abs(rawDx);
    const absDy = Math.abs(rawDy);

    if (absDx > absDy) {
      axisLock = 'horizontal';
    } else if (absDy > absDx) {
      axisLock = 'vertical';
    }
  }

  if (axisLock === 'horizontal') {
    dy = 0;
  } else if (axisLock === 'vertical') {
    dx = 0;
  }

  dragState.value.axisLock = axisLock;

  let guideAdjustX = 0;
  let guideAdjustY = 0;

  if (dragState.value.primaryCardId && dragState.value.primaryCardStart) {
    const proposedX = dragState.value.primaryCardStart.x + dx;
    const proposedY = dragState.value.primaryCardStart.y + dy;
    const guideResult = computeGuideSnap(dragState.value.primaryCardId, proposedX, proposedY);

    if (guideResult) {
      guideAdjustX = axisLock === 'vertical' ? 0 : guideResult.adjustX;
      guideAdjustY = axisLock === 'horizontal' ? 0 : guideResult.adjustY;
      activeGuides.value = guideResult.guides;
    } else {
      resetActiveGuides();
    }
  }

  const finalDx = dx + guideAdjustX;
  const finalDy = dy + guideAdjustY;

  // Обновляем позиции карточек
  dragState.value.cards.forEach(item => {
    cardsStore.updateCardPosition(
      item.id,
      item.startX + finalDx,
      item.startY + finalDy,
      { saveToHistory: false }
    );
    const movingCard = findCardById(item.id);
    if (movingCard?.note?.visible) {
      syncNoteWindowWithCard(item.id);
    }
  });

  // Обновляем позиции стикеров
  dragState.value.stickers.forEach(item => {
    const sticker = stickersStore.stickers.find(s => s.id === item.id);
    if (sticker) {
      sticker.pos_x = Math.round(item.startX + finalDx);
      sticker.pos_y = Math.round(item.startY + finalDy);
    }
  });

  // Обновляем позиции изображений
  if (dragState.value.images && dragState.value.images.length > 0) {
    dragState.value.images.forEach(item => {
      imagesStore.updateImagePosition(
        item.id,
        item.startX + finalDx,
        item.startY + finalDy,
        { saveToHistory: false }
      );
    });
  }

  updateStageSize();

  if (dx !== 0 || dy !== 0) {
    dragState.value.hasMoved = true;
  }
};

// Throttle handleDrag с задержкой 16ms (60 FPS) для оптимизации производительности
const handleDrag = useThrottleFn(handleDragInternal, 16, true, false);

const endDrag = async (event) => {
  if (
    event &&
    activeDragPointerId !== null &&
    event.pointerId !== undefined &&
    event.pointerId !== activeDragPointerId
  ) {
    return;
  }
  if (dragState.value && dragState.value.hasMoved) {
    const movedCardIds = dragState.value.cards.map(item => item.id);
    const movedStickerIds = dragState.value.stickers.map(item => item.id);
    const movedImageIds = dragState.value.images?.map(item => item.id) || [];
    const totalCount = movedCardIds.length + movedStickerIds.length + movedImageIds.length;

    let description = '';
    if (totalCount === 1) {
      if (movedCardIds.length === 1) {
        const card = findCardById(movedCardIds[0]);
        description = card ? `Перемещена карточка "${card.text}"` : 'Перемещена карточка';
      } else if (movedStickerIds.length === 1) {
        description = 'Перемещен стикер';
      } else if (movedImageIds.length === 1) {
        const image = imagesStore.images.find(img => img.id === movedImageIds[0]);
        description = image ? `Перемещено изображение "${image.name}"` : 'Перемещено изображение';
      }
    } else {
      const parts = [];
      if (movedCardIds.length > 0) {
        parts.push(`${movedCardIds.length} карточек`);
      }
      if (movedStickerIds.length > 0) {
        parts.push(`${movedStickerIds.length} стикеров`);
      }
      if (movedImageIds.length > 0) {
        parts.push(`${movedImageIds.length} изображений`);
      }
      description = `Перемещено ${parts.join(' и ')}`;
    }

    historyStore.setActionMetadata('update', description);
    movedCardIds.forEach(id => {
      syncNoteWindowWithCard(id);
    });
    historyStore.saveState();

    // Сохраняем позиции стикеров на сервере
    for (const item of dragState.value.stickers) {
      const sticker = stickersStore.stickers.find(s => s.id === item.id);
      if (sticker) {
        try {
          await stickersStore.updateSticker(sticker.id, {
            pos_x: sticker.pos_x,
            pos_y: sticker.pos_y
          });
        } catch (error) {
          console.error('Ошибка сохранения позиции стикера:', error);
        }
      }
    }

    suppressNextCardClick.value = true;
    setTimeout(() => {
      suppressNextCardClick.value = false;
    }, 0);
  }

  dragState.value = null;
  resetActiveGuides();

  if (activeDragPointerId !== null) {
    dragPointerCaptureElement?.releasePointerCapture?.(activeDragPointerId);
  }
  activeDragPointerId = null;
  dragPointerCaptureElement = null;
  window.removeEventListener('pointermove', handleDrag);
  window.removeEventListener('pointerup', endDrag);
  window.removeEventListener('pointercancel', endDrag);
  window.removeEventListener('mousemove', handleDrag);
  window.removeEventListener('mouseup', endDrag);
};

// Обработчик изменения размера изображения
const handleImageResizeInternal = (event) => {
  if (!resizeState.value) {
    return;
  }

  const canvasPos = screenToCanvas(event.clientX, event.clientY);
  const deltaX = canvasPos.x - resizeState.value.startPointer.x;
  const deltaY = canvasPos.y - resizeState.value.startPointer.y;

  const image = imagesStore.images.find(img => img.id === resizeState.value.imageId);
  if (!image) {
    return;
  }

  let newWidth, newHeight, newX, newY;
  const resizeType = resizeState.value.interactionType;
  const initialWidth = resizeState.value.initialWidth;
  const initialHeight = resizeState.value.initialHeight;
  const aspectRatio = resizeState.value.aspectRatio;
  const keepAspectRatio = resizeState.value.keepAspectRatio;
  const startX = resizeState.value.startX;
  const startY = resizeState.value.startY;

  switch (resizeType) {
    case 'resize-se': // юго-восток, правый нижний угол
      newWidth = initialWidth + deltaX;
      newHeight = initialHeight + deltaY;

      if (keepAspectRatio) {
        const scale = Math.max(newWidth / initialWidth, newHeight / initialHeight);
        newWidth = initialWidth * scale;
        newHeight = initialHeight * scale;
      }

      newWidth = Math.max(20, newWidth);
      newHeight = Math.max(20, newHeight);

      imagesStore.updateImage(image.id, {
        width: newWidth,
        height: newHeight
      });
      break;

    case 'resize-nw': // северо-запад, левый верхний угол
      newWidth = initialWidth - deltaX;
      newHeight = initialHeight - deltaY;

      if (keepAspectRatio) {
        const scale = Math.max(newWidth / initialWidth, newHeight / initialHeight);
        newWidth = initialWidth * scale;
        newHeight = initialHeight * scale;
      }

      newWidth = Math.max(20, newWidth);
      newHeight = Math.max(20, newHeight);

      newX = startX + (initialWidth - newWidth);
      newY = startY + (initialHeight - newHeight);

      imagesStore.updateImage(image.id, {
        width: newWidth,
        height: newHeight,
        x: newX,
        y: newY
      });
      break;

    case 'resize-ne': // северо-восток, правый верхний угол
      newWidth = initialWidth + deltaX;
      newHeight = initialHeight - deltaY;

      if (keepAspectRatio) {
        const scale = Math.max(newWidth / initialWidth, newHeight / initialHeight);
        newWidth = initialWidth * scale;
        newHeight = initialHeight * scale;
      }

      newWidth = Math.max(20, newWidth);
      newHeight = Math.max(20, newHeight);

      newY = startY + (initialHeight - newHeight);

      imagesStore.updateImage(image.id, {
        width: newWidth,
        height: newHeight,
        y: newY
      });
      break;

    case 'resize-sw': // юго-запад, левый нижний угол
      newWidth = initialWidth - deltaX;
      newHeight = initialHeight + deltaY;

      if (keepAspectRatio) {
        const scale = Math.max(newWidth / initialWidth, newHeight / initialHeight);
        newWidth = initialWidth * scale;
        newHeight = initialHeight * scale;
      }

      newWidth = Math.max(20, newWidth);
      newHeight = Math.max(20, newHeight);

      newX = startX + (initialWidth - newWidth);

      imagesStore.updateImage(image.id, {
        width: newWidth,
        height: newHeight,
        x: newX
      });
      break;

    case 'resize-n': // север, верхняя сторона
      newHeight = initialHeight - deltaY;
      newWidth = initialWidth;

      if (keepAspectRatio) {
        newWidth = newHeight * aspectRatio;
      }

      newWidth = Math.max(20, newWidth);
      newHeight = Math.max(20, newHeight);

      newY = startY + (initialHeight - newHeight);
      newX = startX + (initialWidth - newWidth) / 2;

      imagesStore.updateImage(image.id, {
        width: newWidth,
        height: newHeight,
        x: newX,
        y: newY
      });
      break;

    case 'resize-s': // юг, нижняя сторона
      newHeight = initialHeight + deltaY;
      newWidth = initialWidth;

      if (keepAspectRatio) {
        newWidth = newHeight * aspectRatio;
      }

      newWidth = Math.max(20, newWidth);
      newHeight = Math.max(20, newHeight);

      newX = startX + (initialWidth - newWidth) / 2;

      imagesStore.updateImage(image.id, {
        width: newWidth,
        height: newHeight,
        x: newX
      });
      break;

    case 'resize-e': // восток, правая сторона
      newWidth = initialWidth + deltaX;
      newHeight = initialHeight;

      if (keepAspectRatio) {
        newHeight = newWidth / aspectRatio;
      }

      newWidth = Math.max(20, newWidth);
      newHeight = Math.max(20, newHeight);

      newY = startY + (initialHeight - newHeight) / 2;

      imagesStore.updateImage(image.id, {
        width: newWidth,
        height: newHeight,
        y: newY
      });
      break;

    case 'resize-w': // запад, левая сторона
      newWidth = initialWidth - deltaX;
      newHeight = initialHeight;

      if (keepAspectRatio) {
        newHeight = newWidth / aspectRatio;
      }

      newWidth = Math.max(20, newWidth);
      newHeight = Math.max(20, newHeight);

      newX = startX + (initialWidth - newWidth);
      newY = startY + (initialHeight - newHeight) / 2;

      imagesStore.updateImage(image.id, {
        width: newWidth,
        height: newHeight,
        x: newX,
        y: newY
      });
      break;
  }

  event.preventDefault();
};

// Throttle handleImageResize для оптимизации производительности
const handleImageResize = useThrottleFn(handleImageResizeInternal, 16, true, false);

// Завершение изменения размера изображения
const endImageResize = (event) => {
  if (
    event &&
    activeDragPointerId !== null &&
    event.pointerId !== undefined &&
    event.pointerId !== activeDragPointerId
  ) {
    return;
  }

  if (resizeState.value) {
    const image = imagesStore.images.find(img => img.id === resizeState.value.imageId);
    if (image) {
      // Сохраняем в историю финальное состояние
      historyStore.setActionMetadata('update', `Изменен размер изображения "${image.name}"`);
      historyStore.saveState();
    }
  }

  resizeState.value = null;

  if (activeDragPointerId !== null) {
    dragPointerCaptureElement?.releasePointerCapture?.(activeDragPointerId);
  }
  activeDragPointerId = null;
  dragPointerCaptureElement = null;
  window.removeEventListener('pointermove', handleImageResize);
  window.removeEventListener('pointerup', endImageResize);
  window.removeEventListener('pointercancel', endImageResize);
  window.removeEventListener('mousemove', handleImageResize);
  window.removeEventListener('mouseup', endImageResize);
};

const handleMouseMoveInternal = (event) => {
  if (isDrawingLine.value) {
    const canvasPos = screenToCanvas(event.clientX, event.clientY);
    mousePosition.value = {
      x: canvasPos.x,
      y: canvasPos.y
    };
  }
};

// Throttle handleMouseMove с задержкой 16ms (60 FPS) для оптимизации производительности
const handleMouseMove = useThrottleFn(handleMouseMoveInternal, 16, true, false);

const handlePointerDown = (event) => {
  const connectionPoint = event.target.closest('.connection-point');
  
  if (connectionPoint) {
    event.stopPropagation();
    
    const cardId = connectionPoint.dataset.cardId;
    const side = connectionPoint.dataset.side;
    
    if (!cardId || !side) return;
    
    if (!isDrawingLine.value) {
      startDrawingLine(cardId, side);
    } else {
      endDrawingLine(cardId, side);
    }
    return;
  }

  if (isSelectionMode.value && !isSelecting.value) {
    const isCardTarget = event.target.closest('.card');
    const interactiveTarget = event.target.closest('button, input, textarea, select, [contenteditable="true"], a[href]');

    if (!isCardTarget && !interactiveTarget) {
      startSelection(event);
      return;
    }
  }  
};

const startDrawingLine = (cardId, side) => {
  selectedConnectionIds.value = [];
  connectionStart.value = { cardId, side };
  isDrawingLine.value = true;

  const startCard = cards.value.find(card => card.id === cardId);
  if (startCard) {
    const startPoint = getPointCoords(startCard, side);
    mousePosition.value = { x: startPoint.x, y: startPoint.y };
  }
  
  emit('update-connection-status', 'Рисование линии: кликните на соединительную точку другой карточки');
  console.log('Начало рисования линии:', connectionStart.value);
};

const endDrawingLine = (cardId, side) => {
  if (!connectionStart.value || connectionStart.value.cardId === cardId) {
    cancelDrawing();
    return;
  }
  
  createConnectionBetweenCards(connectionStart.value.cardId, cardId, {
    fromSide: connectionStart.value.side,
    toSide: side
  });
  
  console.log('Создано соединение:', connectionStart.value.cardId, '->', cardId);
  cancelDrawing();
};

const cancelDrawing = () => {
  connectionStart.value = null;
  isDrawingLine.value = false;
  previewLine.value = null;
  emit('update-connection-status', 'Кликните на соединительную точку для создания линии');
};

const handleLineClick = (event, connectionId) => {
  event.stopPropagation();
  
  const isCtrlPressed = event.ctrlKey || event.metaKey;
  
  if (isCtrlPressed) {
    const index = selectedConnectionIds.value.indexOf(connectionId);
    if (index > -1) {
      selectedConnectionIds.value.splice(index, 1);
    } else {
      selectedConnectionIds.value.push(connectionId);
    }
  } else {
    if (selectedConnectionIds.value.length === 1 && selectedConnectionIds.value[0] === connectionId) {
      selectedConnectionIds.value = [];
    } else {
      selectedConnectionIds.value = [connectionId];
    }
  }
  
  cardsStore.deselectAllCards();
  selectedCardId.value = null;
  cancelDrawing();
};

const handleCardClick = (event, cardId) => {
  if (suppressNextCardClick.value) {
    suppressNextCardClick.value = false;
    return;
  }

  // Останавливаем всплытие события, чтобы клик не дошел до canvas-content
  // Это важно для режима размещения стикеров
  event.stopPropagation();

  const isCtrlPressed = event.ctrlKey || event.metaKey;
  selectedConnectionIds.value = [];

  if (isCtrlPressed) {
    cardsStore.toggleCardSelection(cardId);
  } else {
    const isCardAlreadySelected = cardsStore.selectedCardIds.includes(cardId);
    const hasMultipleCards = cardsStore.selectedCardIds.length > 1;
    const hasOtherTypesSelected =
      stickersStore.selectedStickerIds.length > 0 || imagesStore.selectedImageIds.length > 0;

    if (!isCardAlreadySelected || hasMultipleCards || hasOtherTypesSelected) {
      clearObjectSelections();
      cardsStore.selectCard(cardId);
    }
  }
  selectedCardId.value = cardId;
};

const handleStickerClick = (event, stickerId) => {
  // Останавливаем всплытие события
  event.stopPropagation();

  const isCtrlPressed = event.ctrlKey || event.metaKey;
  selectedConnectionIds.value = [];

  if (isCtrlPressed) {
    stickersStore.toggleStickerSelection(stickerId);
  } else {
    const isStickerAlreadySelected = stickersStore.selectedStickerIds.includes(stickerId);
    const hasMultipleStickers = stickersStore.selectedStickerIds.length > 1;
    const hasOtherTypesSelected =
      cardsStore.selectedCardIds.length > 0 || imagesStore.selectedImageIds.length > 0;

    if (!isStickerAlreadySelected || hasMultipleStickers || hasOtherTypesSelected) {
      clearObjectSelections();
      stickersStore.selectSticker(stickerId);
    }
  }
  selectedCardId.value = null;
};
const handleAnchorSelect = (anchorId) => {
  boardStore.selectAnchor(anchorId);
  sidePanelsStore.openAnchors();
};

const handleImageClick = ({ event, imageId }) => {
  // Останавливаем всплытие события
  event.stopPropagation();

  const isCtrlPressed = event.ctrlKey || event.metaKey;
  selectedConnectionIds.value = [];

  if (isCtrlPressed) {
    imagesStore.toggleImageSelection(imageId);
  } else {
    const isImageAlreadySelected = imagesStore.selectedImageIds.includes(imageId);
    const hasMultipleImages = imagesStore.selectedImageIds.length > 1;
    const hasOtherTypesSelected =
      cardsStore.selectedCardIds.length > 0 || stickersStore.selectedStickerIds.length > 0;

    if (!isImageAlreadySelected || hasMultipleImages || hasOtherTypesSelected) {
      clearObjectSelections();
      imagesStore.selectImage(imageId);
    }
  }
  selectedCardId.value = null;
};

const handleImageRedraw = () => {
  // Перерисовка происходит автоматически через реактивность Vue и Pinia
};

const handleAddNoteClick = (cardId) => {
  const card = findCardById(cardId);
  if (!card) {
    return;
  }
  const note = ensureCardNote(card);
  if (!note.visible) {
    openNoteForCard(card);
  } else {
    closeNoteForCard(card, { saveToHistory: true });
  }
};

const handlePvChanged = (cardId) => {

  console.log('🔵 PV changed for card:', cardId);

  // Запускаем анимацию для карточки, у которой изменился PV

  // Это вызовет пересчет баланса и анимацию распространения вверх

  animateBalancePropagation(cardId);

};

const handleStageClick = async (event) => {
  if (suppressNextStageClick) {
    suppressNextStageClick = false;
    return;
  }
  if (placementMode.value === 'anchor') {
    event.stopPropagation();
    const { x, y } = screenToCanvas(event.clientX, event.clientY);
    if (!boardStore.currentBoardId) {
      console.warn('Не удалось создать точку: доска не выбрана');
      return;
    }

    try {
      const newAnchor = await anchorsStore.createAnchor(boardStore.currentBoardId, {
        pos_x: Math.round(x),
        pos_y: Math.round(y),
        description: ''
      });

      boardStore.selectAnchor(newAnchor.id);
      boardStore.setPlacementMode(null);
      sidePanelsStore.openAnchors();
      boardStore.requestAnchorEdit(newAnchor.id);
    } catch (error) {
      console.error('Ошибка создания точки:', error);
    }
    return;
  }

  // Если активен режим размещения стикера/изображения
  if (stickersStore.isPlacementMode && stickersStore.placementTarget === 'board') {
    // Выключаем режим размещения СРАЗУ, чтобы предотвратить дублирование
    stickersStore.disablePlacementMode();

    // Останавливаем всплытие события, чтобы предотвратить повторное срабатывание
    event.stopPropagation();

    // Используем существующую вспомогательную функцию для получения корректных координат
    const { x, y } = screenToCanvas(event.clientX, event.clientY);

    // Проверяем, есть ли данные изображения для размещения
    if (stickersStore.pendingImageData) {
      const imageData = stickersStore.pendingImageData;

      try {
        // Добавляем изображение на canvas через imagesStore
        await imagesStore.addImage({
          name: 'Image from library',
          imageId: imageData.imageId, // ID из библиотеки
          width: imageData.width || 200,
          height: imageData.height || 150,
          x: Math.round(x),
          y: Math.round(y)
        });

        console.log('✅ Изображение добавлено на доску:', imageData);
      } catch (error) {
        console.error('Ошибка добавления изображения на доску:', error);
        alert('Не удалось добавить изображение на доску');
      } finally {
        // Очищаем pendingImageData
        stickersStore.pendingImageData = null;
      }

      return; // Завершаем выполнение функции
    }

    // Если нет данных изображения, создаем обычный стикер
    if (boardStore.currentBoardId) {
      try {
        // Вызываем action для добавления стикера
        await stickersStore.addSticker(boardStore.currentBoardId, {
          pos_x: Math.round(x),
          pos_y: Math.round(y),
          color: '#FFFF88' // Цвет по умолчанию, как в ТЗ
        });
      } catch (error) {
        console.error('Ошибка создания стикера:', error);
        alert('Не удалось создать стикер');
      }
    } else {
      console.error('Не удалось создать стикер: ID доски не определен.');
    }

    const isImageAlreadySelected = imagesStore.selectedImageIds.includes(imageId);
    const hasMultipleImages = imagesStore.selectedImageIds.length > 1;
    const hasOtherTypesSelected =
      cardsStore.selectedCardIds.length > 0 || stickersStore.selectedStickerIds.length > 0;

    if (!isImageAlreadySelected || hasMultipleImages || hasOtherTypesSelected) {
      clearObjectSelections();
    }

  }

  // Логика для снятия выделения при клике на пустое место 
  const preserveCardSelection = isSelectionMode.value;
  if (!event.ctrlKey && !event.metaKey) {
    clearObjectSelections({ preserveCardSelection });
  }

  selectedConnectionIds.value = [];
  cancelDrawing();

};

const addNewCard = () => {
  const colors = ['#4CAF50', '#2196F3', '#FF9800', '#9C27B0', '#F44336'];
  const randomColor = colors[Math.floor(Math.random() * colors.length)];
  
  const newCard = {
    x: Math.random() * (stageConfig.value.width - 150),
    y: Math.random() * (stageConfig.value.height - 80),
    text: `Карточка ${cards.value.length + 1}`,
    width: 150,
    height: 80,
    fill: randomColor,
    stroke: '#000000',
    strokeWidth: 1,
    headerBg: getHeaderColorRgb(0),
    colorIndex: 0
  };
  
  cardsStore.addCard(newCard);
};
const syncAllNoteWindows = () => {
  cardsWithVisibleNotes.value.forEach(card => {
    syncNoteWindowWithCard(card.id);
  });
};

const handleViewportChange = () => {
  syncAllNoteWindows();
};

const handleWindowResize = () => {
  updateStageSize();
  handleViewportChange();
};

const deleteSelectedCards = () => {
  const uniqueIds = Array.from(new Set(cardsStore.selectedCardIds));
  if (uniqueIds.length === 0) return;

  batchDeleteCards(uniqueIds);
  cardsStore.selectedCardIds = [];
  selectedCardId.value = null;
  selectedConnectionIds.value = [];
  cancelDrawing();
};

const deleteSelectedConnections = () => {
  if (selectedConnectionIds.value.length === 0) return;

  console.log('Deleting connections:', selectedConnectionIds.value);

  selectedConnectionIds.value.forEach(connectionId => {
    connectionsStore.removeConnection(connectionId);
  });

  selectedConnectionIds.value = [];
  console.log('Connections deleted');
};

const deleteSelectedImages = () => {
  if (imagesStore.selectedImageIds.length === 0) return;

  console.log('Deleting images:', imagesStore.selectedImageIds);

  // Создаем копию массива ID, так как он будет модифицироваться при удалении
  const imageIdsToDelete = [...imagesStore.selectedImageIds];

  imageIdsToDelete.forEach(imageId => {
    const image = imagesStore.images.find(img => img.id === imageId);
    // Проверяем что изображение не заблокировано
    if (image && !image.isLocked) {
      imagesStore.removeImage(imageId);
    }
  });

  console.log('Images deleted');
};

const handleKeydown = (event) => {
  const target = event.target;
  const tagName = target?.tagName?.toLowerCase?.();
  const isEditableElement =
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select' ||
    target?.isContentEditable;

  // Обработка Shift для изменения размера изображений
  if (event.key === 'Shift' && resizeState.value) {
    resizeState.value.keepAspectRatio = false;
    return;
  }

  if (event.key === 'Escape' || event.code === 'Escape') {
    if (!isEditableElement) {
      event.preventDefault();
      clearObjectSelections();
      selectedConnectionIds.value = [];
      cancelDrawing();
      finishSelection();
      if (isSelectionMode.value) {
        canvasStore.setSelectionMode(false);
      }
      if (isHierarchicalDragMode.value) {
        canvasStore.setHierarchicalDragMode(false);
      }
    }
    return;
  }

  const isDeleteKey = event.key === 'Delete' || event.code === 'Delete';
  const isBackspaceKey = event.key === 'Backspace' || event.code === 'Backspace';

  if (!isDeleteKey && !isBackspaceKey) return;
  if (isEditableElement) return;

  event.preventDefault();

  // Проверяем выбранные изображения (приоритет перед карточками)
  if (imagesStore.selectedImageIds.length > 0) {
    deleteSelectedImages();
    return;
  }

  if (selectedConnectionIds.value.length > 0) {
    deleteSelectedConnections();
    return;
  }

  if (cardsStore.selectedCardIds.length > 0) {
    deleteSelectedCards();
    return;
  }
};

const handleKeyup = (event) => {
  // Обработка Shift для изменения размера изображений
  if (event.key === 'Shift' && resizeState.value) {
    resizeState.value.keepAspectRatio = true;
  }
};
const loadAnchorsForBoard = async (boardId) => {
  if (!boardId) {
    return;
  }

  try {
    await anchorsStore.loadForBoard(boardId);
  } catch (error) {
    console.error('Ошибка загрузки точек:', error);
  }
};
onMounted(() => {
  if (canvasContainerRef.value) { // Добавляем проверку
    canvasContainerRef.value.addEventListener('pointermove', handleMouseMove);
    canvasContainerRef.value.addEventListener('pointerdown', handlePointerDown);
    canvasContainerRef.value.addEventListener('click', handleActivePvButtonClick, true);
  }

  handleWindowResize();
  window.addEventListener('resize', handleWindowResize);
  window.addEventListener('keydown', handleKeydown);
  window.addEventListener('keyup', handleKeyup);
  window.addEventListener('scroll', handleViewportChange, true);

  // Загружаем стикеры для текущей доски
  if (boardStore.currentBoardId) {
    stickersStore.fetchStickers(boardStore.currentBoardId).catch(err => {
      console.error('Ошибка загрузки стикеров:', err);
    });
  }

  nextTick(() => {
    applyActivePvPropagation();
    // Инициализируем рендеринг изображений на canvas
    renderAllImages();
  });
});
watch(() => boardStore.currentBoardId, (newBoardId, oldBoardId) => {
  if (!newBoardId) {
    anchorsStore.reset();
    return;
  }

  if (oldBoardId && oldBoardId !== newBoardId) {
    anchorsStore.reset();
  }

  loadAnchorsForBoard(newBoardId);
}, { immediate: true });

onBeforeUnmount(() => {
  // Очищаем blob URLs для предотвращения утечки памяти
  imagesStore.images.forEach(image => {
    if (image.dataUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(image.dataUrl);
    }
  });

  // Очищаем стикеры при размонтировании
  stickersStore.clearStickers();
  
  // Сбрасываем точки
  anchorsStore.reset();

  // Очищаем кэш изображений
  imageCache.clear();

  if (canvasContainerRef.value) { // Добавляем проверку
    canvasContainerRef.value.removeEventListener('pointermove', handleMouseMove);
    canvasContainerRef.value.removeEventListener('pointerdown', handlePointerDown);
    canvasContainerRef.value.removeEventListener('click', handleActivePvButtonClick, true);

  }
  window.removeEventListener('keydown', handleKeydown);
  window.removeEventListener('keyup', handleKeyup);
  window.removeEventListener('resize', handleWindowResize);
  window.removeEventListener('scroll', handleViewportChange, true);
  window.removeEventListener('pointermove', handleMouseMove); // Управляем подпиской в watch
  window.removeEventListener('pointermove', handleDrag);
  window.removeEventListener('pointerup', endDrag);
  window.removeEventListener('pointercancel', endDrag);
  window.removeEventListener('mousemove', handleDrag);
  window.removeEventListener('mouseup', endDrag);
  removeSelectionListeners();

});

watch(isDrawingLine, (isActive) => {
  if (isActive) {
    window.addEventListener('pointermove', handleMouseMove);
  } else {
    window.removeEventListener('pointermove', handleMouseMove);
  }
});
watch(isSelectionMode, (active) => {
  if (!active) {
    finishSelection();
  }
});
const resetView = () => {
  resetZoomTransform();
};

const fitToContent = (options = {}) => {
  if (!canvasContainerRef.value) {
    return;
  }

  const padding = Number.isFinite(options.padding) ? Math.max(0, options.padding) : 120;
  const cardsList = cards.value;
  const connectionsList = connections.value;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let hasContent = false;

  cardsList.forEach(card => {
    if (!card) {
      return;
    }

    const left = Number.isFinite(card.x) ? card.x : 0;
    const top = Number.isFinite(card.y) ? card.y : 0;
    const width = Number.isFinite(card.width) ? card.width : 0;
    const height = Number.isFinite(card.height) ? card.height : 0;

    minX = Math.min(minX, left);
    minY = Math.min(minY, top);
    maxX = Math.max(maxX, left + width);
    maxY = Math.max(maxY, top + height);
    hasContent = true;
  });

  if (Array.isArray(connectionsList) && connectionsList.length > 0) {
    const cardMap = new Map(cardsList.map(card => [card.id, card]));
    const defaultThickness = connectionsStore.defaultLineThickness || 0;

    connectionsList.forEach(connection => {
      const fromCard = cardMap.get(connection.from);
      const toCard = cardMap.get(connection.to);

      if (!fromCard || !toCard) {
        return;
      }

      const geometry = buildConnectionGeometry(connection, fromCard, toCard);

      if (!geometry || !geometry.points || geometry.points.length === 0) {
        return;
      }

      const strokeWidth = Number.isFinite(connection.thickness)
        ? connection.thickness
        : defaultThickness;
      const markerRadius = Math.max(strokeWidth, 8) / 2;
      geometry.points.forEach(point => {
        if (!point) {
          return;
        }

        minX = Math.min(minX, point.x - markerRadius);
        minY = Math.min(minY, point.y - markerRadius);
        maxX = Math.max(maxX, point.x + markerRadius);
        maxY = Math.max(maxY, point.y + markerRadius);
      });

      hasContent = true;
    });
  }

  if (!hasContent || !Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {    resetZoomTransform();
    return;
  }

  const containerRect = canvasContainerRef.value.getBoundingClientRect();
  const containerWidth = containerRect.width || canvasContainerRef.value.clientWidth || 1;
  const containerHeight = containerRect.height || canvasContainerRef.value.clientHeight || 1;

  const paddedMinX = minX - padding;
  const paddedMinY = minY - padding;
  const paddedMaxX = maxX + padding;
  const paddedMaxY = maxY + padding;

  const contentWidth = Math.max(1, paddedMaxX - paddedMinX);
  const contentHeight = Math.max(1, paddedMaxY - paddedMinY);

  const scaleX = containerWidth / contentWidth;
  const scaleY = containerHeight / contentHeight;
  let targetScale = clampZoomScale(Math.min(scaleX, scaleY));

  if (!Number.isFinite(targetScale) || targetScale <= 0) {
    targetScale = 1;
  }

  const contentCenterX = paddedMinX + contentWidth / 2;
  const contentCenterY = paddedMinY + contentHeight / 2;

  const targetTranslateX = containerWidth / 2 - contentCenterX * targetScale;
  const targetTranslateY = containerHeight / 2 - contentCenterY * targetScale;

  setZoomTransform({
    scale: targetScale,
    translateX: targetTranslateX,
    translateY: targetTranslateY
  });
};
const SNAPSHOT_CLASS = 'canvas-container--capturing';

const captureViewportSnapshot = async () => {
  const element = canvasContainerRef.value;

  if (!element) {
    return null;
  }
  element.classList.add(SNAPSHOT_CLASS);
  await nextTick();
  const rect = element.getBoundingClientRect();

  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));

  try {
    const deviceScale = Math.max(1, window.devicePixelRatio || 1);
    // Увеличиваем масштаб до 4 для лучшего качества в режиме рисования
    const captureScale = Math.min(deviceScale, 4);
    const canvas = await html2canvas(element, {
      backgroundColor: null,
      logging: false,
      useCORS: true,
      scale: captureScale,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      width,
      height
    });

    // Возвращаем canvas в полном разрешении без уменьшения
    // для максимального качества в режиме рисования
    return canvas.toDataURL('image/png');
  } catch (error) {
    console.error('Не удалось сделать снимок полотна', error);
    return null;
  } finally {
    element.classList.remove(SNAPSHOT_CLASS);    
  }
};

const getViewportBounds = () => {
  const element = canvasContainerRef.value;

  if (!element) {
    return null;
  }

  const rect = element.getBoundingClientRect();

  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height
  };
};

/**
 * Снять выделение со всех объектов изображений
 */
const deselectAll = () => {
  imagesStore.deselectAllImages();
  renderAllImages();
};

defineExpose({
  resetView,
  fitToContent,
  captureViewportSnapshot,
  getViewportBounds,
  deselectAll
});

watch(isDrawingLine, (isDrawing) => {
  if (isDrawing) {
    emit('update-connection-status', 'Рисование линии: кликните на соединительную точку другой карточки');
  } else {
    emit('update-connection-status', 'Кликните на соединительную точку для создания линии');
  }
});

watch(
  () => Array.isArray(connections.value)
    ? connections.value.map(connection => connection.id)
    : [],
  (newIds) => {
    selectedConnectionIds.value = selectedConnectionIds.value.filter(id => newIds.includes(id));
  }
);

watch(cards, () => {
  updateStageSize();
}, { deep: true });
watch(() => stickersStore.stickers, () => {
  updateStageSize();
}, { deep: true });
watch(() => imagesStore.images, () => {
  updateStageSize();
}, { deep: true });
watch(anchors, () => {
  updateStageSize();
}, { deep: true });  
watch(() => cardsStore.calculationMeta, () => {
  applyActivePvPropagation();
}, { deep: true });

watch(() => cards.value.length, () => {
  applyActivePvPropagation();
});

watch(guidesEnabled, (enabled) => {
  if (!enabled) {
    resetActiveGuides();
  }
});
watch([zoomScale, zoomTranslateX, zoomTranslateY], () => {
  syncAllNoteWindows();
});

watch(cardsWithVisibleNotes, () => {
  nextTick(() => syncAllNoteWindows());
});

watch(() => notesStore.pendingOpenCardId, (cardId) => {
  if (!cardId) {
    return;
  }
  const targetId = notesStore.consumeOpenRequest();
  if (!targetId) {
    return;
  }
  const requestedDate = notesStore.consumeSelectedDate();
  const card = findCardById(targetId);
  if (!card) {
    return;
  }
  openNoteForCard(card, { forceAlign: true });
  if (requestedDate) {
    const note = ensureCardNote(card);
    if (note) {
      note.selectedDate = requestedDate;
      note.viewDate = `${requestedDate.slice(0, 7)}-01`;
    }
  }
});
watch(() => notesStore.pendingFocusCardId, (cardId) => {
  if (!cardId) {
    return;
  }
  const targetId = notesStore.consumeFocusRequest();
  if (!targetId) {
    return;
  }
  focusCardOnCanvas(targetId);
});

</script>

<template>
<div
  ref="canvasContainerRef"
  :class="['canvas-container', canvasContainerClasses, { 'canvas-container--modern': props.isModernTheme }]"
  :style="{ backgroundColor: backgroundColor }"
>
    <div
      v-if="selectionRect"
      class="selection-box"
      :style="selectionBoxStyle"
    ></div>  
    <div class="canvas-content" :style="canvasContentStyle" @click="handleStageClick">
      <div
        v-if="guidesEnabled && (activeGuides.vertical !== null || activeGuides.horizontal !== null)"
        class="guides-overlay"
        :style="guideOverlayStyle"
      >
        <div
          v-if="activeGuides.horizontal !== null"
          class="guide-line guide-line--horizontal"
          :style="{ top: `${activeGuides.horizontal}px` }"
        ></div>
        <div
          v-if="activeGuides.vertical !== null"
          class="guide-line guide-line--vertical"
          :style="{ left: `${activeGuides.vertical}px` }"
        ></div>
      </div>

      <!-- Canvas слой для рендеринга изображений -->
      <!-- z-index: 0 - фон/сетка доски -->
      <canvas
        ref="imagesCanvasRef"
        class="images-canvas-layer"
        :width="stageConfig.width"
        :height="stageConfig.height"
        style="position: absolute; top: 0; left: 0; z-index: 0; pointer-events: none;"
      ></canvas>

      <!-- SVG слой для линий связи -->
      <!-- z-index: 5 - линии связи между объектами (диапазон 5-9) -->
      <svg
        class="svg-layer"
        :width="stageConfig.width"
        :height="stageConfig.height"
        style="position: absolute; top: 0; left: 0; z-index: 5; overflow: visible; pointer-events: auto;"
        @click="handleStageClick"
      >
        <defs>
          <marker
            id="marker-dot"
            viewBox="0 0 10 10"
            refX="5"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            fill="currentColor"
          >
            <circle cx="5" cy="5" r="4"/>
          </marker>
        </defs>

      <g
        v-for="path in connectionPaths"
        :key="path.id"
        class="line-group"
        :data-connection-id="path.id"
        @click.stop="(event) => handleLineClick(event, path.id)"
      >
          <!-- Невидимая область для клика (hitbox) -->
          <path
            :d="path.d"
            class="line-hitbox"
            @click.stop="(event) => handleLineClick(event, path.id)"
          />
          <!-- Видимая линия -->
          <path
            :d="path.d"
            :class="[
              'line',
              {
                selected: selectedConnectionIds.includes(path.id),
                'line--balance-highlight': path.highlightType === 'balance',
                'line--pv-highlight': path.highlightType === 'pv'
              }           
            ]"
            marker-start="url(#marker-dot)"
            marker-end="url(#marker-dot)"
            :style="{
              '--line-color': path.color,
              '--line-width': `${path.strokeWidth}px`,
              '--line-animation-duration': `${path.animationDuration}ms`,
              color: path.color,
              stroke: path.color,
              strokeWidth: path.strokeWidth
            }"
          />
        </g>

        <path
          v-if="previewLinePath"
          :d="previewLinePath.d"
          class="line line--preview"
          :style="{
            '--line-color': previewLinePath.color,
            '--line-width': `${previewLinePath.strokeWidth}px`,
            color: previewLinePath.color
          }"
          :stroke-dasharray="previewLinePath.strokeDasharray"
          marker-start="url(#marker-dot)"
          marker-end="url(#marker-dot)"
        />
      </svg>
            <div class="anchors-layer">
        <AnchorPoint
          v-for="anchor in anchorPoints"
          :key="anchor.id"
          :anchor="anchor"
          :is-selected="selectedAnchorId === anchor.id"
          @select="handleAnchorSelect"
        />
      </div>
      <!-- Контейнер для карточек -->
      <!-- z-index: 10 - карточки структуры (лицензии) -->
      <div
        class="cards-container"
        :style="{
          width: stageConfig.width + 'px',
          height: stageConfig.height + 'px',
          position: 'relative',
          zIndex: 10,
          pointerEvents: 'none'
        }"
        @dragstart.prevent
      >
          <Card
          v-for="card in cards"
          :key="card.id"
          :card="card"
          :is-selected="card.selected"
          :is-connecting="isDrawingLine && connectionStart?.cardId === card.id"
          @card-click="(event) => handleCardClick(event, card.id)"
          @start-drag="startDrag"
          @add-note="handleAddNoteClick"
          @pv-changed="handlePvChanged"         
          style="pointer-events: auto;"
          />
      </div>
      <NoteWindow
        v-for="card in cardsWithVisibleNotes"
        :key="`note-${card.id}`"
        :card="card"
        :ref="el => handleNoteWindowRegister(card.id, el)"
        @close="() => handleNoteWindowClose(card.id)"
      />
      <!-- Изображения отсортированные по z-index -->
      <!-- Диапазон z-index для изображений: 6-9 (задний план) и 11-999 (передний план) -->
      <CanvasImage
        v-for="image in sortedImages"
        :key="`image-${image.id}`"
        :image="image"
        :is-selected="image.isSelected"
        @image-click="handleImageClick"
        @start-drag="startImageDrag"
        @redraw="handleImageRedraw"
      />
      <!-- Стикеры отсортированные по z-index -->
      <!-- Диапазон z-index для стикеров: 10000+ (всегда на переднем плане) -->
      <Sticker
        v-for="sticker in sortedStickers"
        :key="`sticker-${sticker.id}`"
        :sticker="sticker"
        @sticker-click="handleStickerClick"
        @start-drag="startStickerDrag"
      />
    </div>
    <a
      v-if="!isMobileMode"      
      class="marketing-watermark"
      :class="{ 'marketing-watermark--modern': props.isModernTheme }"
      href="https://t.me/MarketingFohow"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Открыть Telegram-канал MarketingFohow"
    >
      @MarketingFohow
    </a>
  </div>
</template>

<style scoped>
.canvas-container {
  width: 100%;
  height: 100%;
  overflow: hidden;
  position: relative;
  touch-action: none;  
}
.canvas-container--selection-mode {
  cursor: crosshair;
}
.canvas-container--sticker-placement {
  cursor: crosshair;
}
.canvas-container--sticker-placement .canvas-content,
.canvas-container--sticker-placement .cards-container,
.canvas-container--sticker-placement .svg-layer {
  cursor: crosshair;
}
.canvas-container--anchor-placement,
.canvas-container--anchor-placement .canvas-content,
.canvas-container--anchor-placement .cards-container,
.canvas-container--anchor-placement .svg-layer {
  cursor: crosshair;
}  
.canvas-container--panning,
.canvas-container--panning .canvas-content,
.canvas-container--panning .cards-container,
.canvas-container--panning .svg-layer {
  cursor: grabbing !important;
}

.canvas-container--selection-mode .cards-container,
.canvas-container--selection-mode .svg-layer {
  cursor: crosshair;
}

.canvas-content {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  transform-origin: 0 0;
  --grid-step: 40px;
  --grid-line-color: rgba(79, 85, 99, 0.15);
  --grid-opacity: 0;
}

.canvas-content::before {
  content: '';
  position: absolute;
  inset: -5000px;
  background-image:
    linear-gradient(to right, var(--grid-line-color) 1px, transparent 1px),
    linear-gradient(to bottom, var(--grid-line-color) 1px, transparent 1px);
  background-size: var(--grid-step) var(--grid-step);
  background-position: 0 0;
  opacity: var(--grid-opacity);
  pointer-events: none;
  z-index: -1;  
}

.line-group {
  cursor: pointer;
}

.line-hitbox {
  fill: none;
  stroke: transparent;
  stroke-width: 25px; /* Широкая область для клика */
  stroke-linecap: round;
  stroke-linejoin: round;
  pointer-events: stroke;
}

.line {
  fill: none;
  stroke: var(--line-color, #0f62fe);
  stroke-width: var(--line-width, 5px);
  pointer-events: none; /* Клики проходят сквозь видимую линию к hitbox */
  filter: drop-shadow(0 0 5px rgba(0, 0, 0, .15));
  transition: stroke-width 0.2s ease, filter 0.2s ease, stroke 0.2s ease;
}

.line.selected {
  stroke: #ff0000 !important;
  stroke-dasharray: 8 8;
  stroke-width: calc(var(--line-width, 5px) + 3px) !important;
  stroke-linecap: round;
  filter: drop-shadow(0 0 12px rgba(255, 0, 0, 0.8));
  animation: dash-animation 0.5s linear infinite;
}

@keyframes dash-animation {
  to {
    stroke-dashoffset: 16;
  }
}

.line--preview {
  stroke: var(--line-color, #ff9800);
  stroke-width: var(--line-width, 2px);
  stroke-dasharray: 5 5;
  pointer-events: none;
}

.line--balance-highlight {
  --line-highlight-color: rgba(217, 48, 37, .55);
  stroke-dasharray: 16;
  stroke-linecap: round;
  animation-name: lineBalanceFlow;
  animation-duration: var(--line-animation-duration, 1.6s);
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
  filter: drop-shadow(0 0 10px var(--line-highlight-color));
}
.line--balance-flash {
  animation: lineBalanceFlash 0.6s ease;
  stroke-dasharray: 16;
  stroke-linecap: round;
  filter: drop-shadow(0 0 10px rgba(15, 98, 254, 0.35));
}
.line--pv-highlight {
  --line-highlight-color: rgba(15, 98, 254, .45);
  stroke-dasharray: 14;
  stroke-linecap: round;
  animation-name: linePvFlow;
  animation-duration: var(--line-animation-duration, 1.6s);
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
  filter: drop-shadow(0 0 10px var(--line-highlight-color));
}
.anchors-layer {
  position: absolute;
  inset: 0;
  z-index: 8;
  pointer-events: none;
}

.anchors-layer :deep(.anchor-point) {
  pointer-events: auto;
}

@keyframes lineBalanceFlash {
  0% {
    stroke-width: var(--line-width, 5px);
    opacity: 1;
  }
  50% {
    stroke-width: calc(var(--line-width, 5px) + 2px);
    opacity: 0.75;
  }
  100% {
    stroke-width: var(--line-width, 5px);
    opacity: 1;
  }
}  
.canvas-container--capturing .line,
.canvas-container--capturing .line.selected,
.canvas-container--capturing .line--balance-highlight,
.canvas-container--capturing .line--pv-highlight {
  filter: none !important;
  animation: none !important;
}

.canvas-container--capturing .line.selected {
  stroke: var(--line-color, #0f62fe) !important;
  stroke-dasharray: none !important;
}

.canvas-container--capturing .card.selected {
  box-shadow: 10px 12px 24px rgba(15, 35, 95, 0.16),
    -6px -6px 18px rgba(255, 255, 255, 0.85) !important;
}

/* Во время съёмки превью скрываем вспомогательные элементы режима редактирования */
.canvas-container--capturing .selection-box,
.canvas-container--capturing .guides-overlay,
.canvas-container--capturing .guide-line,
.canvas-container--capturing .line--preview,
.canvas-container--capturing .connection-point,
.canvas-container--capturing .note-window,
.canvas-container--capturing .context-menu-overlay,
.canvas-container--capturing .card-context-menu {
  display: none !important;
}  
.guides-overlay {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
  z-index: 3;
}

.guide-line {
  position: absolute;
  background: rgba(59, 130, 246, 0.6);
  box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.3);
}

.guide-line--horizontal {
  width: 100%;
  height: 1px;
}

.guide-line--vertical {
  height: 100%;
  width: 1px;
}

@keyframes lineBalanceFlow {
  0% {
    stroke-dashoffset: -24;
    stroke: var(--line-color, currentColor);
    color: var(--line-color, currentColor);
  }
  50% {
    stroke: #d93025;
    color: #d93025;
  }
  100% {
    stroke-dashoffset: 24;
    stroke: var(--line-color, currentColor);
    color: var(--line-color, currentColor);
  }
}
.selection-box {
  position: fixed;
  border: 1px dashed rgba(59, 130, 246, 0.9);
  background: rgba(59, 130, 246, 0.15);
  pointer-events: none;
  z-index: 4000;
}
@keyframes linePvFlow {
  0% {
    stroke-dashoffset: -18;
    stroke: var(--line-color, currentColor);
    color: var(--line-color, currentColor);
  }
  50% {
    stroke: #0f62fe;
    color: #0f62fe;
  }
  100% {
    stroke-dashoffset: 18;
    stroke: var(--line-color, currentColor);
    color: var(--line-color, currentColor);
  }
}

/* Анимация красных пунктирных линий при автоматическом расчете баланса */
.line--balance-propagation {
  stroke: #ff0000 !important;
  stroke-dasharray: 8 8;
  stroke-width: calc(var(--line-width, 5px) + 2px) !important;
  stroke-linecap: round;
  filter: drop-shadow(0 0 10px rgba(255, 0, 0, 0.6));
  animation: balancePropagationFlow var(--line-animation-duration, 2000ms) ease-in-out infinite;
}

@keyframes balancePropagationFlow {
  0% {
    stroke-dashoffset: 0;
    opacity: 0.3;
  }
  30% {
    opacity: 1;
  }
  100% {
    stroke-dashoffset: -16;
    opacity: 1;
  }
}

.marketing-watermark {
  position: absolute;
  left: 20px;
  bottom: 20px;
  z-index: 5000;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 8px 16px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.95);
  color: #0f62fe;
  font-weight: 600;
  font-size: 15px;
  line-height: 1;
  letter-spacing: 0.2px;
  text-decoration: none;
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.18);
  border: 1px solid rgba(15, 23, 42, 0.12);
  pointer-events: auto;
  user-select: none;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.marketing-watermark--modern {
  border-color: rgba(96, 164, 255, 0.35);
  background: rgba(32, 45, 72, 0.92);
  color: #e5f3ff;
  box-shadow: 0 18px 34px rgba(6, 11, 21, 0.55);
}
.marketing-watermark:hover {
  transform: translateY(-1px);
  box-shadow: 0 18px 36px rgba(15, 23, 42, 0.2);
}
.marketing-watermark--modern:hover {
  box-shadow: 0 24px 44px rgba(6, 11, 21, 0.65);
}

.marketing-watermark:active {
  transform: translateY(0);
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.22);
}

/* Print Styles - Обеспечиваем корректное отображение холста и карточек при печати */
@media print {
  .canvas-container {
    position: absolute !important;
    top: 0 !important;
    left: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    overflow: visible !important;
    transform: none !important;
  }

  .canvas-content {
    position: absolute !important;
    top: 0 !important;
    left: 0 !important;
    width: auto !important;
    height: auto !important;
    overflow: visible !important;
    transform: none !important;
    transform-origin: top left !important;
  }

  /* Убираем фоновую сетку при печати */
  .canvas-content::before {
    display: none !important;
  }

  .cards-container {
    position: absolute !important;
    top: 0 !important;
    left: 0 !important;
    width: auto !important;
    height: auto !important;
    overflow: visible !important;
  }

  .svg-layer {
    position: absolute !important;
    top: 0 !important;
    left: 0 !important;
    width: 100% !important;
    height: 100% !important;
    overflow: visible !important;
  }

  /* Скрываем ненужные элементы интерфейса внутри холста */
  .marketing-watermark,
  .selection-box,
  .guides-overlay,
  .guide-line,
  .line--preview,
  .note-window,
  .connection-point,
  .card-close-btn,
  .card-note-btn,
  .active-pv-btn,
  .card-controls,
  .card-active-controls {
    display: none !important;
  }

  /* Убираем интерактивные эффекты и анимации */
  .line-group, .line {
    pointer-events: none !important;
  }

  .line--balance-highlight,
  .line--pv-highlight,
  .line--balance-propagation,
  .line.selected {
    animation: none !important;
    filter: none !important;
    stroke-dasharray: none !important;
  }

  /* Карточки остаются на своих позициях */
  .card {
    page-break-inside: avoid !important;
  }
}
</style>
