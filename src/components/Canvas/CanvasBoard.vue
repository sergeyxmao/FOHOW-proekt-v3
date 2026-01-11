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
import UserCard from './UserCard.vue';
import UserCardContextMenu from './UserCardContextMenu.vue';
import UserCardNumberInputModal from '../Modals/UserCardNumberInputModal.vue';
import NoteWindow from './NoteWindow.vue';
import IncompatibilityWarningModal from '../Modals/IncompatibilityWarningModal.vue';
import Sticker from './Sticker.vue';
import CanvasImage from './CanvasImage.vue';
import ObjectContextMenu from './ObjectContextMenu.vue';
import AnchorPoint from './AnchorPoint.vue';  
import { useKeyboardShortcuts } from '../../composables/useKeyboardShortcuts';
import { useBezierCurves } from '../../composables/useBezierCurves';
import { useUserCardConnections, toRgbString } from '../../composables/useUserCardConnections';
import { useCanvasContextMenus } from '../../composables/useCanvasContextMenus';
import { useCanvasDrag } from '../../composables/useCanvasDrag';
import { useImageResize } from '../../composables/useImageResize';
import { useCanvasSelection } from '../../composables/useCanvasSelection';
import { useCanvasConnections } from '../../composables/useCanvasConnections';
import { useCanvasImageRenderer } from '../../composables/useCanvasImageRenderer';
import { useActivePv } from '../../composables/useActivePv';
import { useNoteWindows } from '../../composables/useNoteWindows';
import { useCanvasFocus } from '../../composables/useCanvasFocus';
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
const { connections, userCardConnections } = storeToRefs(connectionsStore);
const { images } = storeToRefs(imagesStore);
const { selectedAnchorId, pendingFocusAnchorId, placementMode, targetViewPoint } = storeToRefs(boardStore);
const { anchors } = storeToRefs(anchorsStore);
  
const {
  backgroundColor,
  isHierarchicalDragMode,
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

// Refs для компонентов стикеров
const stickerRefs = ref(new Map());

const handleStickerRefRegister = (stickerId, stickerComponent) => {
  if (stickerComponent) {
    stickerRefs.value.set(stickerId, stickerComponent);
  } else {
    stickerRefs.value.delete(stickerId);
  }
};

const CANVAS_PADDING = 400;
const IMAGE_CACHE_LIMIT = 120;
const OFFSCREEN_CACHE_LIMIT = 80;
const IMAGE_VIRTUALIZATION_OVERSCAN = 800;

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

// Конвертация координат экрана в координаты canvas
const screenToCanvas = (clientX, clientY) => {
  if (!canvasContainerRef.value) return { x: clientX, y: clientY };

  const rect = canvasContainerRef.value.getBoundingClientRect();
  const x = (clientX - rect.left - zoomTranslateX.value) / zoomScale.value;
  const y = (clientY - rect.top - zoomTranslateY.value) / zoomScale.value;

  return { x, y };
};

// Watch для центрирования на целевой точке
watch(targetViewPoint, (newTarget) => {
  if (!newTarget || !canvasContainerRef.value) {
    return
  }

  const containerRect = canvasContainerRef.value.getBoundingClientRect()
  const containerWidth = containerRect.width
  const containerHeight = containerRect.height

  // Устанавливаем zoom = 1.0
  const targetScale = 1.0

  // Вычисляем новые координаты translate так, чтобы точка (x, y) была в центре экрана
  const newTranslateX = containerWidth / 2 - newTarget.x * targetScale
  const newTranslateY = containerHeight / 2 - newTarget.y * targetScale

  // Применяем transform через API usePanZoom
  setZoomTransform({
    scale: targetScale,
    translateX: newTranslateX,
    translateY: newTranslateY
  })
}, { deep: true })

const canvasContentStyle = computed(() => {
  const translateX = Number.isFinite(zoomTranslateX.value) ? zoomTranslateX.value : 0;
  const translateY = Number.isFinite(zoomTranslateY.value) ? zoomTranslateY.value : 0;
  const scale = Number.isFinite(zoomScale.value) && zoomScale.value > 0 ? zoomScale.value : 1;

  // Определяем, активен ли режим размещения новых объектов
  const isPlacingObject = placementMode.value === 'anchor' || stickersStore.isPlacementMode;

  const style = {
    transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
    // Устанавливаем размер canvas-content равным размеру stage для возможности размещения элементов в любой точке
    width: `${stageConfig.value.width}px`,
    height: `${stageConfig.value.height}px`,
    // Пропускаем клики через canvas-content ТОЛЬКО в режиме размещения новых объектов
    // В обычном режиме разрешаем события для интерактивных элементов (стикеры, карточки)
    pointerEvents: isPlacingObject ? 'none' : 'auto'
  };

  const step = Number.isFinite(gridStepRef.value) ? gridStepRef.value : 0;
  const normalizedStep = Math.max(1, Math.round(step));
  const isVisible = Boolean(isGridBackgroundVisible.value && normalizedStep > 0);
  style['--grid-step'] = `${normalizedStep}px`;
  style['--grid-line-color'] = 'rgba(79, 85, 99, 0.15)';
  style['--grid-opacity'] = isVisible ? '1' : '0';

  return style;
});


const createLruCache = (limit) => {
  const map = new Map();

  const touch = (key, value) => {
    map.delete(key);
    map.set(key, value);
  };

  return {
    get(key) {
      const value = map.get(key);
      if (value !== undefined) {
        touch(key, value);
      }
      return value;
    },
    set(key, value) {
      touch(key, value);
      if (map.size > limit) {
        const oldestKey = map.keys().next().value;
        map.delete(oldestKey);
      }
    },
    delete(key) {
      return map.delete(key);
    },
    clear() {
      map.clear();
    }
  };
};
  
const anchorPoints = computed(() => Array.isArray(anchors.value) ? anchors.value : []);
  
const selectedCardId = ref(null);
const mousePosition = ref({ x: 0, y: 0 });

// Инициализация composable для соединений между карточками
const {
  connectionStart,
  isDrawingLine,
  previewLine,
  selectedConnectionIds,
  previewLineWidth,
  previewLinePath,
  createConnectionBetweenCards,
  startDrawingLine,
  endDrawingLine,
  cancelDrawing,
  handleLineClick,
  deleteSelectedConnections,
  clearConnectionSelection
} = useCanvasConnections({
  connectionsStore,
  cardsStore,
  cards,
  mousePosition,
  emit
});

// Анимация выделения обычных стикеров и их линий
const animatedStickerIds = ref(new Set())
const animatedStickerConnectionIds = ref(new Set())
const stickerAnimationTimers = ref([])
const stickerAnimationRootId = ref(null)

// Инициализация composable для кривых Безье
const { buildBezierPath, getUserCardConnectionPoint, calculateMidpoint, findClosestPointOnBezier, isPointNearBezier } = useBezierCurves();

// Инициализация composable для UserCard-соединений (карточки партнёров на холсте)
const {
  // Refs
  userCardConnectionStart,
  selectedUserCardConnectionIds,
  userCardContextMenu,
  userCardContextMenuPosition,
  userCardNumberModalVisible,
  userCardNumberModalUserCardId,
  userCardNumberModalCurrentId,
  animatedUserCardIds,
  animatedUserCardConnectionIds,
  userCardAnimationTimers,
  userCardAnimationRootId,
  draggingControlPoint,
  // Computed
  userCardAnimationDuration,
  userCardAnimationColor,
  userCardAnimationColorRgb,
  isUserCardAnimationEnabled,
  userCardConnectionPaths,
  userCardPreviewLinePath,
  // Функции
  stopUserCardSelectionAnimation,
  startUserCardSelectionAnimation,
  collectUserCardConnectionSnapshots,
  handleUserCardLineClick,
  handleUserCardConnectionPointClick,
  handleUserCardLineDoubleClick,
  handleControlPointDoubleClick,
  handleControlPointDragStart,
  handleUserCardContextMenu,
  closeUserCardContextMenu,
  handleUserCardDoubleClick,
  handleUserCardNumberApply,
  closeUserCardNumberModal,
  deleteSelectedUserCardConnections,
  cancelUserCardDrawing
} = useUserCardConnections({
  cards,
  userCardConnections,
  connectionsStore,
  cardsStore,
  viewSettingsStore,
  screenToCanvas,
  mousePosition,
  previewLineWidth
});

const activeGuides = ref({ vertical: null, horizontal: null });

// Инициализация composable для выделения объектов
const {
  isSelecting,
  selectionRect,
  selectionCursorPosition,
  clearObjectSelections,
  startSelection,
  finishSelection,
  removeSelectionListeners,
  getSuppressNextStageClick,
  setSuppressNextStageClick
} = useCanvasSelection({
  cardsStore,
  stickersStore,
  imagesStore,
  canvasContainerRef,
  selectedCardId,
  stopUserCardSelectionAnimation,
  onSelectionStart: () => {
    // При начале выделения сбрасываем состояние соединений
    clearConnectionSelection()
    cancelDrawing()
  }
});

const closeAllStickerEditing = () => {
  stickerRefs.value.forEach((stickerComponent) => {
    if (stickerComponent && typeof stickerComponent.closeEditing === 'function') {
      stickerComponent.closeEditing();
    }
  });
};

// ========================================
// Вспомогательные функции для composables
// ========================================
const findCardById = (cardId) => cards.value.find(card => card.id === cardId);

const getCardElement = (cardId) => {
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

const getCardElementRect = (cardId) => {
  const element = document.querySelector(`[data-card-id="${cardId}"]`);
  return element ? element.getBoundingClientRect() : null;
};

// ========================================
// Инициализация composables
// ========================================

// Canvas Rendering для изображений
const imagesCanvasRef = ref(null);

const {
  imageCache,
  offscreenCache,
  invalidateImageCache,
  renderAllImages,
  renderAllImagesForExport,
  scheduleRender,
  handlePngExportRenderAllImages,
  handlePngExportRenderComplete,
  getVisibleCanvasRect,
  isImageWithinViewport
} = useCanvasImageRenderer({
  imagesStore,
  imagesCanvasRef,
  zoomScale,
  zoomTranslateX,
  zoomTranslateY,
  canvasContainerRef,
  screenToCanvas,
  stageConfig,
  images
});

// Active PV логика
const {
  ACTIVE_PV_FLASH_MS,
  activeAnimationTimers,
  updateActivePvDatasets,
  cancelAllActiveAnimations,
  highlightActivePvChange,
  animateBalancePropagation,
  applyActivePvPropagation,
  handleActivePvButtonClick
} = useActivePv({
  cardsStore,
  connectionsStore,
  viewSettingsStore,
  historyStore,
  connections,
  getCardElement,
  getConnectionElement,
  canvasContainerRef
});

// Note Windows
const {
  noteWindowRefs,
  cardsWithVisibleNotes,
  ensureCardNote,
  handleNoteWindowRegister,
  syncNoteWindowWithCard,
  openNoteForCard,
  closeNoteForCard,
  handleNoteWindowClose,
  syncAllNoteWindows
} = useNoteWindows({
  cardsStore,
  historyStore,
  cards,
  zoomScale,
  findCardById,
  getCardElementRect
});

// Canvas Focus
const {
  focusCardOnCanvas,
  focusStickerOnCanvas,
  focusAnchorOnCanvas,
  getBranchDescendants
} = useCanvasFocus({
  cardsStore,
  stickersStore,
  boardStore,
  anchors,
  connections,
  zoomScale,
  canvasContainerRef,
  setZoomTransform,
  findCardById
});

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

// Инициализация composable для контекстных меню
const {
  imageContextMenu,
  imageContextMenuPosition,
  handleImageContextMenu,
  handleStageContextMenu,
  closeImageContextMenu,
  closeAllContextMenus
} = useCanvasContextMenus({
  imagesStore,
  screenToCanvas,
  getObjectAtPoint,
  clearObjectSelections,
  closeUserCardContextMenu
});


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
  'canvas-container--selection-mode': true,
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
const selectionCounterStyle = computed(() => {
  if (!selectionCursorPosition.value) {
    return {};
  }

  const offset = 14;
  return {
    left: `${selectionCursorPosition.value.x + offset}px`,
    top: `${selectionCursorPosition.value.y + offset}px`
  };
});

const selectedObjectsCount = computed(() =>
  cardsStore.selectedCardIds.length
  + stickersStore.selectedStickerIds.length
  + imagesStore.selectedImageIds.length
);

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

      // Проверяем, анимирована ли эта линия
      const isAnimated = animatedStickerConnectionIds.value.has(connection.id);

      return {
        id: connection.id,
        d: geometry.d,
        color: connection.color || connectionsStore.defaultLineColor,
        strokeWidth: connection.thickness || connectionsStore.defaultLineThickness,
        highlightType: isAnimated ? 'animated' : (connection.highlightType || null),
        isAnimated,
        animationDuration: connection.animationDuration ?? connectionsStore.defaultAnimationDuration,
        flowDirection: 1
		};
    })
    .filter(Boolean);
});

// Вспомогательные функции для анимации
const addAnimatedItem = (setRef, id) => {
  const next = new Set(setRef.value);
  next.add(id);
  setRef.value = next;
};

const removeAnimatedItem = (setRef, id) => {
  const next = new Set(setRef.value);
  next.delete(id);
  setRef.value = next;
};

// Watch для остановки анимации стикеров при отключении
watch(() => isUserCardAnimationEnabled.value, (enabled) => {
  if (!enabled) {
    stopStickerSelectionAnimation();
  }
});

// Функции для анимации обычных стикеров и их линий
const stopStickerSelectionAnimation = () => {
  stickerAnimationTimers.value.forEach(timerId => window.clearTimeout(timerId));
  stickerAnimationTimers.value = [];
  animatedStickerIds.value = new Set();
  animatedStickerConnectionIds.value = new Set();
  stickerAnimationRootId.value = null;
};

const startStickerSelectionAnimation = (stickerId) => {
  const sticker = cards.value.find(card => card.id === stickerId && card.type !== 'user_card');
  if (!sticker) {
    stopStickerSelectionAnimation();
    return;
  }

  stopStickerSelectionAnimation();
  stickerAnimationRootId.value = stickerId;

  // Найти все connections, связанные с этим стикером
  const relatedConnectionIds = new Set();
  connections.value.forEach(connection => {
    if (connection.from === stickerId || connection.to === stickerId) {
      relatedConnectionIds.add(connection.id);
    }
  });

  animatedStickerIds.value = new Set([stickerId]);
  animatedStickerConnectionIds.value = relatedConnectionIds;

  const duration = userCardAnimationDuration.value;

  const timerId = window.setTimeout(() => {
    if (stickerAnimationRootId.value !== stickerId) return;
    stopStickerSelectionAnimation();
  }, duration);

  stickerAnimationTimers.value.push(timerId);
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

/**
 * Обновление размеров холста на основе всех объектов (карточки, изображения, стикеры)
 * Реализация виртуального бесконечного холста
 */
const updateStageSize = () => {
  if (!canvasContainerRef.value) {
    return;
  }

  const containerWidth = canvasContainerRef.value.clientWidth;
  const containerHeight = canvasContainerRef.value.clientHeight;

  // Начальные границы холста
  let minX = 0;
  let minY = 0;
  let maxX = containerWidth;
  let maxY = containerHeight;

  let hasContent = false;

  // Учитываем карточки
  if (cards.value && cards.value.length > 0) {
    cards.value.forEach(card => {
      const cardX = Number.isFinite(card.x) ? card.x : 0;
      const cardY = Number.isFinite(card.y) ? card.y : 0;
      const cardWidth = Number.isFinite(card.width) ? card.width : 0;
      const cardHeight = Number.isFinite(card.height) ? card.height : 0;

      minX = Math.min(minX, cardX);
      minY = Math.min(minY, cardY);
      maxX = Math.max(maxX, cardX + cardWidth);
      maxY = Math.max(maxY, cardY + cardHeight);
      hasContent = true;
    });
  }

  // Учитываем изображения
  if (imagesStore.images && imagesStore.images.length > 0) {
    imagesStore.images.forEach(image => {
      const imgX = Number.isFinite(image.x) ? image.x : 0;
      const imgY = Number.isFinite(image.y) ? image.y : 0;
      const imgWidth = Number.isFinite(image.width) ? image.width : 0;
      const imgHeight = Number.isFinite(image.height) ? image.height : 0;

      minX = Math.min(minX, imgX);
      minY = Math.min(minY, imgY);
      maxX = Math.max(maxX, imgX + imgWidth);
      maxY = Math.max(maxY, imgY + imgHeight);
      hasContent = true;
    });
  }

  // Учитываем стикеры
  if (stickersStore.stickers && stickersStore.stickers.length > 0) {
    stickersStore.stickers.forEach(sticker => {
      const stickerX = Number.isFinite(sticker.pos_x) ? sticker.pos_x : 0;
      const stickerY = Number.isFinite(sticker.pos_y) ? sticker.pos_y : 0;
      const stickerWidth = Number.isFinite(sticker.width) ? sticker.width : 200; // Дефолтная ширина стикера
      const stickerHeight = Number.isFinite(sticker.height) ? sticker.height : 150; // Дефолтная высота стикера

      minX = Math.min(minX, stickerX);
      minY = Math.min(minY, stickerY);
      maxX = Math.max(maxX, stickerX + stickerWidth);
      maxY = Math.max(maxY, stickerY + stickerHeight);
      hasContent = true;
    });
  }

  // Если нет контента, используем размер контейнера
  if (!hasContent) {
    stageConfig.value.width = containerWidth;
    stageConfig.value.height = containerHeight;
    return;
  }

  // Динамический отступ вокруг контента
  const dynamicPadding = Math.max(CANVAS_PADDING, containerWidth, containerHeight);

  // Вычисляем финальные размеры холста с учетом отступов
  const contentWidth = maxX - minX;
  const contentHeight = maxY - minY;

  stageConfig.value.width = Math.max(
    containerWidth,
    contentWidth + dynamicPadding * 2
  );
  stageConfig.value.height = Math.max(
    containerHeight,
    contentHeight + dynamicPadding * 2
  );
};

// Инициализация composable для resize изображений
const {
  resizeState,
  isResizing,
  startImageResize,
  handleImageResize,
  endImageResize
} = useImageResize({
  imagesStore,
  historyStore,
  screenToCanvas
});

// Инициализация composable для drag
const {
  dragState,
  suppressNextCardClick,
  startDrag,
  startStickerDrag,
  startImageDrag: startImageDragFromComposable,
  handleDrag,
  endDrag
} = useCanvasDrag({
  cardsStore,
  stickersStore,
  imagesStore,
  connectionsStore,
  historyStore,
  screenToCanvas,
  findCardById,
  collectUserCardConnectionSnapshots,
  syncNoteWindowWithCard,
  updateStageSize,
  computeGuideSnap,
  resetActiveGuides,
  activeGuides,
  isSelecting,
  snapDelta,
  collectDragTargets,
  collectStickerDragTargets,
  collectImageDragTargets
});

// Обёртка для startImageDrag, которая обрабатывает и resize, и move
const startImageDrag = ({ event, imageId, interactionType = 'move' }) => {
  // Если это resize операция, используем composable для resize
  if (interactionType.startsWith('resize-')) {
    startImageResize({ event, imageId, interactionType });
    return;
  }
  // Иначе используем composable для drag
  startImageDragFromComposable(event, imageId);
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
  if (stickersStore.isPlacementMode && stickersStore.placementTarget === 'board') {
    return;
  }

  // Игнорируем pointerdown в режиме размещения якоря
  if (placementMode.value === 'anchor') {
    return;
  }

  const connectionPoint = event.target.closest('.connection-point');

  // Debug: Отслеживаем состояние isDrawingLine при каждом pointerdown
  console.log('🔵 pointerDown', {
    isDrawingLine: isDrawingLine.value,
    target: event.target.className,
    isConnectionPoint: !!connectionPoint
  });

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

  if (!isSelecting.value && !isDrawingLine.value) {
    const isCardTarget = event.target.closest('.card');
    const isUserCardTarget = event.target.closest('.user-card-object');    
    const isStickerTarget = event.target.closest('.sticker');
    const isImageTarget = event.target.closest('.canvas-image');
    const isNoteTarget = event.target.closest('.note-window');
    const isAnchorTarget = event.target.closest('.anchor-point');
    const isConnectionTarget = event.target.closest('.line-group, .user-card-line-group, .line');
    const isControlPointTarget = event.target.closest('.control-point');    
    const interactiveTarget = event.target.closest('button, input, textarea, select, [contenteditable="true"], a[href]');

    // Начинаем выделение только если клик по пустой области
    if (
      !isCardTarget &&
      !isUserCardTarget &&
      !isStickerTarget &&
      !isImageTarget &&
      !isNoteTarget &&
      !isAnchorTarget &&
      !isConnectionTarget &&
      !isControlPointTarget &&
      !interactiveTarget
    ) {
      startSelection(event);
      return;
    }
  }
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

  const clickedCard = cardsStore.cards.find(c => c.id === cardId);
  const isUserCardType = clickedCard?.type === 'user_card';
  const isNowSelected = cardsStore.selectedCardIds.includes(cardId);

  // Анимация для аватаров
  if (isUserCardType && isNowSelected && isUserCardAnimationEnabled.value) {
    startUserCardSelectionAnimation(cardId);
  } else if (isUserCardType) {
    stopUserCardSelectionAnimation();
  }

  // Анимация для обычных стикеров/лицензий
  if (!isUserCardType && isNowSelected && isUserCardAnimationEnabled.value) {
    startStickerSelectionAnimation(cardId);
  } else if (!isUserCardType) {
    stopStickerSelectionAnimation();
  }
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

const handleStageMouseDown = (event) => {
  // Проверяем только левую кнопку мыши
  if (event.button !== 0) {
    return;
  }

	if (stickersStore.isPlacementMode && stickersStore.placementTarget === 'board') {
    return;
  }

  // Проверяем, есть ли изображение под курсором (даже если оно на заднем плане)
  const canvasPos = screenToCanvas(event.clientX, event.clientY);
  const imageUnderCursor = getObjectAtPoint(canvasPos.x, canvasPos.y);

  // Если найдено изображение под курсором и оно не заблокировано
  if (imageUnderCursor && !imageUnderCursor.isLocked) {
    // stopImmediatePropagation предотвращает срабатывание других обработчиков
    // включая pointerdown на карточках, которые перекрывают изображение
    event.stopImmediatePropagation();
    event.preventDefault();

    // Если изображение не выделено - выделяем его
    if (!imageUnderCursor.isSelected) {
      const isCtrlPressed = event.ctrlKey || event.metaKey;
      if (isCtrlPressed) {
        imagesStore.toggleImageSelection(imageUnderCursor.id);
      } else {
        clearObjectSelections();
        imagesStore.selectImage(imageUnderCursor.id);
      }
    }

    // Инициируем перетаскивание изображения
    startImageDrag({
      event,
      imageId: imageUnderCursor.id,
      interactionType: 'move'
    });
  }
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
  // Игнорируем среднюю кнопку мыши (используется для панорамирования)
  if (event.button === 1) {
    event.preventDefault(); // Предотвращаем автоскролл браузера
    return;
  }

  // Игнорируем правую кнопку мыши (контекстное меню)
  if (event.button === 2) {
    return;
  }

  // Debug: Отслеживаем состояние isDrawingLine и клик на connection-point
  const isConnectionPoint = event.target.closest('.connection-point');
  console.log('🟡 stageClick', {
    isDrawingLine: isDrawingLine.value,
    target: event.target.className,
    isConnectionPoint: !!isConnectionPoint,
    isPlacementMode: stickersStore.isPlacementMode,
    placementTarget: stickersStore.placementTarget
  });
  if (getSuppressNextStageClick()) {
    setSuppressNextStageClick(false);
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

      // Снимаем выделение со всех других объектов перед выделением геоточки
      clearObjectSelections();

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
    if (event.button !== 0) {
      return;
    }

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
     
		stickersStore.disablePlacementMode();		  
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
        const newSticker = await stickersStore.addSticker(boardStore.currentBoardId, {
          pos_x: Math.round(x),
          pos_y: Math.round(y),
          color: '#FFFF88',
        });

        // Проверяем, что стикер создан успешно
        if (!newSticker) {
          // Ошибка уже показана в store (alert), просто выходим
          stickersStore.disablePlacementMode();
          return;
        }

        clearObjectSelections();
        stickersStore.selectSticker(newSticker.id);
        stickersStore.disablePlacementMode();
        await nextTick();
        const elem = document.querySelector(`[data-sticker-id="${newSticker.id}"]`);
        if (elem) {
          elem.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
        }
      } catch (error) {
        console.error(error);
      }
    } else {
      console.error('Не удалось создать стикер: ID доски не определен.');
    }

    return; // Завершаем выполнение функции после создания стикера
  }

  // Проверяем, есть ли изображение под курсором (даже если оно на заднем плане)
  const canvasPos = screenToCanvas(event.clientX, event.clientY);
  const imageUnderCursor = getObjectAtPoint(canvasPos.x, canvasPos.y);

  if (imageUnderCursor && !imageUnderCursor.isLocked) {
    // Если найдено изображение под курсором, выделяем его
    event.stopPropagation();

    const isCtrlPressed = event.ctrlKey || event.metaKey;

    if (isCtrlPressed) {
      // При Ctrl - переключаем выделение
      imagesStore.toggleImageSelection(imageUnderCursor.id);
    } else {
      // Без Ctrl - выделяем только это изображение
      clearObjectSelections();
      imagesStore.selectImage(imageUnderCursor.id);
    }

    selectedConnectionIds.value = [];
    selectedCardId.value = null;
    return;
  }

  // Логика для снятия выделения при клике на пустое место
  const preserveCardSelection = true;
  if (!event.ctrlKey && !event.metaKey) {
    closeAllStickerEditing();
    clearObjectSelections({ preserveCardSelection });
  }

  // Не отменяем рисование линии, если кликнули на connection-point
  // (это обрабатывается в handlePointerDown)
  if (!isConnectionPoint) {
    selectedConnectionIds.value = [];
    cancelDrawing();
  }

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
  if (selectedUserCardConnectionIds.value.length > 0) {
    deleteSelectedUserCardConnections();
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
    // Добавляем обработчик pointerdown в capture фазе для перетаскивания изображений на заднем плане
    canvasContainerRef.value.addEventListener('pointerdown', handleStageMouseDown, true);
    // Добавляем обработчик contextmenu в capture фазе для контекстного меню изображений на заднем плане
    canvasContainerRef.value.addEventListener('contextmenu', handleStageContextMenu, true);
  }

  handleWindowResize();
  window.addEventListener('resize', handleWindowResize);
  window.addEventListener('keydown', handleKeydown);
  window.addEventListener('keyup', handleKeyup);
  window.addEventListener('scroll', handleViewportChange, true);

  // Подписываемся на события PNG экспорта для рендеринга всех изображений
  window.addEventListener('png-export-render-all-images', handlePngExportRenderAllImages);
  window.addEventListener('png-export-render-complete', handlePngExportRenderComplete);

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
    canvasContainerRef.value.removeEventListener('pointerdown', handleStageMouseDown, true);
    canvasContainerRef.value.removeEventListener('contextmenu', handleStageContextMenu, true);
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

  // Отписываемся от событий PNG экспорта
  window.removeEventListener('png-export-render-all-images', handlePngExportRenderAllImages);
  window.removeEventListener('png-export-render-complete', handlePngExportRenderComplete);
});

watch(isDrawingLine, (isActive) => {
  if (isActive) {
    window.addEventListener('pointermove', handleMouseMove);
  } else {
    window.removeEventListener('pointermove', handleMouseMove);
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
  const userCardConnectionsList = userCardConnections.value;  
  const imagesList = images.value;
  const stickersList = stickersStore.stickers;
  
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let hasContent = false;
  const updateBounds = (left, top, width, height) => {    
    minX = Math.min(minX, left);
    minY = Math.min(minY, top);
    maxX = Math.max(maxX, left + width);
    maxY = Math.max(maxY, top + height);
    hasContent = true;
  };
  
  cardsList.forEach(card => {
    if (!card) {
      return;
    }

    const left = Number.isFinite(card.x) ? card.x : 0;
    const top = Number.isFinite(card.y) ? card.y : 0;
    const isUserCard = card.type === 'user_card';
    const width = isUserCard
      ? (Number.isFinite(card.diameter) ? card.diameter : 0)
      : (Number.isFinite(card.width) ? card.width : 0);
    const height = isUserCard
      ? (Number.isFinite(card.diameter) ? card.diameter : 0)
      : (Number.isFinite(card.height) ? card.height : 0);

    updateBounds(left, top, width, height);
  });

  imagesList.forEach(image => {
    if (!image) {
      return;
    }

    const left = Number.isFinite(image.x) ? image.x : 0;
    const top = Number.isFinite(image.y) ? image.y : 0;
    const width = Number.isFinite(image.width) ? image.width : 0;
    const height = Number.isFinite(image.height) ? image.height : 0;

    updateBounds(left, top, width, height);
  });

  stickersList.forEach(sticker => {
    if (!sticker) {
      return;
    }

    const left = Number.isFinite(sticker.pos_x) ? sticker.pos_x : 0;
    const top = Number.isFinite(sticker.pos_y) ? sticker.pos_y : 0;
    const width = 200;
    const height = 150;

    updateBounds(left, top, width, height);
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
  if (Array.isArray(userCardConnectionsList) && userCardConnectionsList.length > 0) {
    const defaultThickness = connectionsStore.defaultLineThickness || 0;

    userCardConnectionsList.forEach(connection => {
      const fromUserCard = cardsList.find(card => card.id === connection.from && card.type === 'user_card');
      const toUserCard = cardsList.find(card => card.id === connection.to && card.type === 'user_card');

      if (!fromUserCard || !toUserCard) {
        return;
      }

      const startPoint = getUserCardConnectionPoint(fromUserCard, connection.fromPointIndex);
      const endPoint = getUserCardConnectionPoint(toUserCard, connection.toPointIndex);
      const controlPoints = Array.isArray(connection.controlPoints) ? connection.controlPoints : [];
      const points = [startPoint, ...controlPoints, endPoint].filter(Boolean);

      const strokeWidth = Number.isFinite(connection.thickness)
        ? connection.thickness
        : defaultThickness;
      const markerRadius = Math.max(strokeWidth, 8) / 2;

      points.forEach(point => {
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

/**
 * Обработчик dragover для drag-and-drop изображений из библиотеки
 */
const handleImageDragOver = (event) => {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'copy';
};

/**
 * Обработчик drop для drag-and-drop изображений из библиотеки
 */
const handleImageDrop = async (event) => {
  event.preventDefault();
  event.stopPropagation();

  // Получаем данные изображения
  const jsonData = event.dataTransfer.getData('application/json');
  if (!jsonData) return;

  let imageData;
  try {
    imageData = JSON.parse(jsonData);
  } catch (error) {
    console.error('Ошибка парсинга данных изображения:', error);
    return;
  }

  // Вычисляем координаты drop с учётом масштаба
  const { x, y } = screenToCanvas(event.clientX, event.clientY);

  // Проверяем наличие boardId
  if (!boardStore.currentBoardId) {
    console.error('Не удалось добавить изображение: boardId не определён');
    return;
  }

  // Получаем blob URL для изображения (если нужно)
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

  // Вычисляем размеры для отображения (макс. 500px)
  const displaySize = imagesStore.calculateDisplaySize(
    imageData.width || 200,
    imageData.height || 150,
    500
  );

  // Добавляем изображение на canvas через imagesStore
  await imagesStore.addImage({
    name: imageData.originalName || 'Image from library',
    imageId: imageData.imageId,
    dataUrl: imageUrl,
    originalUrl: imageData.originalUrl,
    width: imageData.width || 200,
    height: imageData.height || 150,
    x: Math.round(x - displaySize.width / 2),  // Центрируем по курсору
    y: Math.round(y - displaySize.height / 2)
  });

  console.log('✅ Изображение добавлено на доску через drag-and-drop:', imageData.originalName);
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
  @mousedown="handleStageClick"
  @dragover.prevent="handleImageDragOver"
  @drop.prevent="handleImageDrop"
>
    <div
      v-if="selectionRect"
      class="selection-box"
      :style="selectionBoxStyle"
    ></div>
    <div
      v-if="selectionRect && selectedObjectsCount > 0"
      class="selection-counter"
      :style="selectionCounterStyle"
    >
      {{ selectedObjectsCount }}
    </div>
  <div class="canvas-content" :style="canvasContentStyle">
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
        style="position: absolute; top: 0; left: 0; z-index: 0; pointer-events: none; background: transparent; opacity: 1;"
      ></canvas>

      <!-- SVG слой для линий связи -->
      <!-- z-index: 5 - линии связи между объектами (диапазон 5-9) -->
      <svg
        class="svg-layer"
        :width="stageConfig.width"
        :height="stageConfig.height"
        style="position: absolute; top: 0; left: 0; z-index: 5; overflow: visible; pointer-events: none;"
        @mousedown="handleStageClick"
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
                'line--pv-highlight': path.highlightType === 'pv',
                'line--animated': path.isAnimated
              }
            ]"
            marker-start="url(#marker-dot)"
            marker-end="url(#marker-dot)"
            :style="{
              '--line-color': path.color,
              '--line-width': `${path.strokeWidth}px`,
              '--line-animation-duration': `${userCardAnimationDuration}ms`,
              '--line-animation-rgb': userCardAnimationColorRgb,
              '--line-animation-color': userCardAnimationColor,
              color: path.isAnimated ? userCardAnimationColor : path.color,
              stroke: path.isAnimated ? userCardAnimationColor : path.color,
              strokeWidth: path.strokeWidth,
              pointerEvents: 'stroke'
            }"
          />
        </g>

        <!-- UserCard-соединения с кривыми Безье -->
        <g
          v-for="path in userCardConnectionPaths"
          :key="path.id"
          class="user-card-line-group"
          :data-connection-id="path.id"
          @click.stop="(event) => handleUserCardLineClick(event, path.id)"
          @dblclick.stop="(event) => handleUserCardLineDoubleClick(event, path.id)"
        >
          <!-- Невидимая область для клика (hitbox) -->
          <path
            :d="path.d"
            class="line-hitbox"
            @click.stop="(event) => handleUserCardLineClick(event, path.id)"
            @dblclick.stop="(event) => handleUserCardLineDoubleClick(event, path.id)"
          />
          <!-- Видимая линия -->
          <path
            :d="path.d"
            :class="[
              'line',
              'user-card-line',
              {
                selected: selectedUserCardConnectionIds.includes(path.id),
                'user-card-line--animated': animatedUserCardConnectionIds.has(path.id)
              }
            ]"
            :style="{
              '--line-color': path.color,
              '--line-width': `${path.strokeWidth}px`,
              '--line-animation-duration': `${userCardAnimationDuration.value}ms`,
              '--line-animation-rgb': userCardAnimationColorRgb.value,
              '--line-animation-color': userCardAnimationColor.value,
              '--line-flow-direction': path.flowDirection,
              color: animatedUserCardConnectionIds.has(path.id) ? userCardAnimationColor.value : path.color,
              stroke: animatedUserCardConnectionIds.has(path.id) ? userCardAnimationColor.value : path.color,
              strokeWidth: path.strokeWidth,
              pointerEvents: 'stroke'
            }"
          />

          <!-- Контрольные точки (видны только когда линия выделена) -->
          <g v-if="selectedUserCardConnectionIds.includes(path.id)">
            <circle
              v-for="(point, index) in path.handlePoints"
              :key="`control-${path.id}-${index}`"
              :cx="point.x"
              :cy="point.y"
              r="5"
              class="control-point"
              :style="{
                fill: '#ff4d4f',
                stroke: '#ff4d4f',
                strokeWidth: '2px',
                cursor: 'move'
              }"
              @mousedown.stop="(event) => handleControlPointDragStart(event, path.id, index)"
              @dblclick.stop="(event) => handleControlPointDoubleClick(event, path.id, index)"
            />
          </g>
        </g>

        <path
          v-if="previewLinePath"
          :d="previewLinePath.d"
          class="line line--preview"
          :style="{
            '--line-color': previewLinePath.color,
            '--line-width': `${previewLinePath.strokeWidth}px`,
            color: previewLinePath.color,
            pointerEvents: 'stroke'
          }"
          :stroke-dasharray="previewLinePath.strokeDasharray"
          marker-start="url(#marker-dot)"
          marker-end="url(#marker-dot)"
        />

        <!-- Preview линия для user-card-соединений -->
        <path
          v-if="userCardPreviewLinePath"
          :d="userCardPreviewLinePath.d"
          class="line line--preview user-card-preview-line"
          :style="{
            '--line-color': userCardPreviewLinePath.color,
            '--line-width': `${userCardPreviewLinePath.strokeWidth}px`,
            color: userCardPreviewLinePath.color,
            stroke: userCardPreviewLinePath.color,
            pointerEvents: 'stroke'
          }"
          :stroke-dasharray="userCardPreviewLinePath.strokeDasharray"
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
          v-for="card in cards.filter(c => c.type !== 'user_card')"
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
          <UserCard
          v-for="userCard in cards.filter(c => c.type === 'user_card')"
          :key="userCard.id"
          :user-card="userCard"
          :is-selected="userCard.selected"
          :is-drawing-line="!!userCardConnectionStart"
          :is-animated="animatedUserCardIds.has(userCard.id)"
          @user-card-click="(event) => handleCardClick(event, userCard.id)"
          @user-card-dblclick="(event) => handleUserCardDoubleClick(event, userCard.id)"
          @start-drag="startDrag"
          @connection-point-click="handleUserCardConnectionPointClick"
          @contextmenu.native="(event) => handleUserCardContextMenu(event, userCard.id)"
          :style="{
            '--user-card-animation-duration': `${userCardAnimationDuration}ms`,
            '--user-card-animation-color': userCardAnimationColor.value,
            '--user-card-animation-color-rgb': userCardAnimationColorRgb,
            pointerEvents: 'auto'
          }"
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
      <!-- Диапазон z-index для изображений: 1-4 (задний план, под линиями) и 11-999 (передний план) -->
      <CanvasImage
        v-for="image in sortedImages"
        :key="`image-${image.id}`"
        :image="image"
        :is-selected="image.isSelected"
        @image-click="handleImageClick"
        @start-drag="startImageDrag"
        @redraw="handleImageRedraw"
        @contextmenu="({ event, imageId }) => handleImageContextMenu(event, imageId)"
      />
      <!-- Стикеры отсортированные по z-index -->
      <!-- Диапазон z-index для стикеров: 10000+ (всегда на переднем плане) -->
      <Sticker
        v-for="sticker in sortedStickers"
        :key="`sticker-${sticker.id}`"
        :sticker="sticker"
        :ref="(el) => handleStickerRefRegister(sticker.id, el)"
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

    <!-- Контекстное меню для карточки партнёра -->
    <UserCardContextMenu
      v-if="userCardContextMenu"
      :user-card="cardsStore.cards.find(c => c.id === userCardContextMenu.userCardId)"
      :position="userCardContextMenuPosition"
      @close="closeUserCardContextMenu"
    />

    <!-- Контекстное меню для изображения -->
    <ObjectContextMenu
      v-if="imageContextMenu"
      :is-visible="!!imageContextMenu"
      :x="imageContextMenuPosition.x"
      :y="imageContextMenuPosition.y"
      :object="imagesStore.images.find(img => img.id === imageContextMenu.imageId)"
      @close="closeImageContextMenu"
      @redraw="() => {}"
    />

    <!-- Модальное окно для ввода компьютерного номера -->
    <UserCardNumberInputModal
      :is-open="userCardNumberModalVisible"
      :user-card-id="userCardNumberModalUserCardId"
      :current-personal-id="userCardNumberModalCurrentId"
      @close="closeUserCardNumberModal"
      @apply="handleUserCardNumberApply"
    />

    <IncompatibilityWarningModal
      v-if="cardsStore.incompatibilityWarning.visible"
      :type="cardsStore.incompatibilityWarning.type"
      @close="cardsStore.hideIncompatibilityWarning()"
    />  
  </div>
</template>

<style scoped>
.canvas-container {
  width: 100%;
  height: 100%;
  overflow: visible; /* Разрешаем размещение элементов за пределами viewport */
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

/* Визуальный эффект при панорамировании холста - затемнение для обратной связи */
.canvas-container--panning .canvas-content::after {
  content: '';
  position: absolute;
  inset: -10000px; /* Большой запас для перекрытия всего холста */
  background: rgba(0, 0, 0, 0.05); /* Легкое затемнение - увеличено для заметности */
  pointer-events: none;
  z-index: 9999;
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
  background: transparent; /* Прозрачный фон, чтобы не перекрывать фон canvas-container */
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

.line--animated {
  --line-highlight: rgba(var(--line-animation-rgb, 93, 139, 244), 0.55);
  stroke-dasharray: 16 12;
  stroke-linecap: round;
  animation: userCardLineFlow var(--line-animation-duration, 2000ms) linear infinite;
  filter: drop-shadow(0 0 10px var(--line-highlight));
  stroke: var(--line-animation-color, var(--line-color, #5D8BF4));
  color: var(--line-animation-color, var(--line-color, #5D8BF4));
}

.user-card-preview-line {
  stroke: #5D8BF4;
  stroke-width: var(--line-width, 2px);
  stroke-dasharray: 5 5;
  pointer-events: none;
}

/* Контрольные точки для user-card-линий */
.control-point {
  cursor: move;
  transition: r 0.2s ease;
}

.control-point:hover {
  r: 7;
  filter: drop-shadow(0 0 4px rgba(93, 139, 244, 0.6));
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
.selection-counter {
  position: fixed;
  z-index: 4001;
  min-width: 36px;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(37, 99, 235, 0.95);
  color: #fff;
  font-weight: 700;
  font-size: 13px;
  line-height: 1;
  text-align: center;
  box-shadow: 0 8px 20px rgba(37, 99, 235, 0.35);
  pointer-events: none;
}  
@keyframes linePvFlow {
  0% {
    stroke-dashoffset: calc(var(--line-flow-direction, 1) * -24px);
    stroke: var(--line-animation-color, var(--line-color, #5D8BF4));
    color: var(--line-animation-color, var(--line-color, #5D8BF4));
  }
  50% {
    stroke: rgba(var(--line-animation-rgb, 93, 139, 244), 0.9);
    color: rgba(var(--line-animation-rgb, 93, 139, 244), 0.9);
  }
  100% {
    stroke-dashoffset: calc(var(--line-flow-direction, 1) * 24px);
    stroke: var(--line-animation-color, var(--line-color, #5D8BF4));
    color: var(--line-animation-color, var(--line-color, #5D8BF4));
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

<style>
/* SVG-стили для user-card линий (без scoped для корректной работы) */
.user-card-line {
  fill: none;
  stroke: var(--line-color, #5D8BF4);
  stroke-width: var(--line-width, 5px);
  pointer-events: none;
  filter: drop-shadow(0 0 5px rgba(0, 0, 0, .15));
  transition: stroke-width 0.2s ease, filter 0.2s ease, stroke 0.2s ease;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.user-card-line--animated {
  --user-card-line-highlight: rgba(var(--line-animation-rgb, 93, 139, 244), 0.55);
  --line-flow-direction: var(--line-flow-direction, 1);
  stroke-dasharray: 16 12;
  stroke-linecap: round;
  animation: userCardLineFlow var(--line-animation-duration, 2000ms) linear infinite;
  filter: drop-shadow(0 0 10px var(--user-card-line-highlight));
  stroke: var(--line-animation-color, var(--line-color, #5D8BF4));
  color: var(--line-animation-color, var(--line-color, #5D8BF4));
}

.user-card-line.selected {
  stroke: #5D8BF4 !important;
  stroke-width: calc(var(--line-width, 5px) + 2px) !important;
  filter: drop-shadow(0 0 12px rgba(93, 139, 244, 0.8));
}

@keyframes userCardLineFlow {
  0% {
    stroke-dashoffset: 0;
    stroke: var(--line-animation-color, var(--line-color, #5D8BF4));
  }
  50% {
    stroke: rgba(var(--line-animation-rgb, 93, 139, 244), 0.9);
  }
  100% {
    stroke-dashoffset: -32;
    stroke: var(--line-animation-color, var(--line-color, #5D8BF4));
  }
}
</style>
