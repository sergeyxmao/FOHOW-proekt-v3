<script setup>
import { ref, onMounted, onBeforeUnmount, computed, watch, nextTick } from 'vue';
import html2canvas from 'html2canvas';  
import { storeToRefs } from 'pinia';
import { useCardsStore } from '../../stores/cards';
import { useConnectionsStore } from '../../stores/connections';
import { useCanvasStore } from '../../stores/canvas';
import Card from './Card.vue';
import NoteWindow from './NoteWindow.vue';  
import { useKeyboardShortcuts } from '../../composables/useKeyboardShortcuts';
import { getHeaderColorRgb } from '../../utils/constants';
import { batchDeleteCards } from '../../utils/historyOperations';
import { usePanZoom } from '../../composables/usePanZoom';
import { useHistoryStore } from '../../stores/history.js';
import { useViewportStore } from '../../stores/viewport.js';
import { useNotesStore } from '../../stores/notes.js';
import {
  ensureNoteStructure,
  applyCardRectToNote,
  updateNoteOffsets,
  getCardNotesSummary,
  DEFAULT_NOTE_WIDTH,
  DEFAULT_NOTE_HEIGHT
} from '../../utils/noteUtils';
const historyStore = useHistoryStore();
const notesStore = useNotesStore();
const emit = defineEmits(['update-connection-status']);

const cardsStore = useCardsStore();
const connectionsStore = useConnectionsStore();
const canvasStore = useCanvasStore();

const { cards } = storeToRefs(cardsStore);
const { connections } = storeToRefs(connectionsStore);
const {
  backgroundColor,
  isHierarchicalDragMode,
  isSelectionMode,
  guidesEnabled,
  gridStep: gridStepRef,
  isGridBackgroundVisible
} = storeToRefs(canvasStore);  
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
  const style = {
    width: `${stageConfig.value.width}px`,
    height: `${stageConfig.value.height}px`
  };

  const step = Number.isFinite(gridStepRef.value) ? gridStepRef.value : 0;
  const normalizedStep = Math.max(1, Math.round(step));
  const isVisible = Boolean(isGridBackgroundVisible.value && normalizedStep > 0);
  style['--grid-step'] = `${normalizedStep}px`;
  style['--grid-line-color'] = 'rgba(79, 85, 99, 0.15)';
  style['--grid-opacity'] = isVisible ? '1' : '0';

  return style;
});
  
const selectedCardId = ref(null);
const connectionStart = ref(null);
const isDrawingLine = ref(false);
const previewLine = ref(null);
const previewLineWidth = computed(() => connectionsStore.defaultLineThickness || 2);
const mousePosition = ref({ x: 0, y: 0 });
const selectedConnectionIds = ref([]);
const dragState = ref(null);
const activeGuides = ref({ vertical: null, horizontal: null });
let activeDragPointerId = null;
let dragPointerCaptureElement = null;
const suppressNextCardClick = ref(false);
const isSelecting = ref(false);
const selectionRect = ref(null);
let selectionStartPoint = null;
let selectionBaseSelection = new Set();
let suppressNextStageClick = false;

const noteWindowRefs = new Map();
const getCurrentZoom = () => {
  const value = Number(zoomScale.value);
  return Number.isFinite(value) && value > 0 ? value : 1;
};  
const cardsWithVisibleNotes = computed(() => cards.value.filter(card => card.note && card.note.visible));
const notesSummary = computed(() => getCardNotesSummary(cards.value));
  
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
  'canvas-container--selection-mode': isSelectionMode.value
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
const MARKER_OFFSET = 12;

const getPointCoords = (card, side) => {
  const halfWidth = card.width / 2;
  const halfHeight = card.height / 2;
  switch (side) {
    case 'top':
      return { x: card.x + halfWidth, y: card.y };
    case 'bottom':
      return { x: card.x + halfWidth, y: card.y + card.height };
    case 'left':
      return { x: card.x, y: card.y + halfHeight };
    case 'right':
      return { x: card.x + card.width, y: card.y + halfHeight };
    default:
      return { x: card.x + halfWidth, y: card.y + halfHeight };
  }
};

const resolveConnectionSides = (fromCard, toCard, preferredFromSide, preferredToSide) => {
  if (preferredFromSide && preferredToSide) {
    return { fromSide: preferredFromSide, toSide: preferredToSide };
  }

  let fromSide = 'right';
  let toSide = 'left';

  if (fromCard.x > toCard.x) {
    fromSide = 'left';
    toSide = 'right';
  } else if (fromCard.y > toCard.y) {
    fromSide = 'top';
    toSide = 'bottom';
  } else if (fromCard.y < toCard.y) {
    fromSide = 'bottom';
    toSide = 'top';
  }

  return { fromSide, toSide };
};
  
const updateLinePath = (p1, p2, side1, side2) => {
  const startAnchor = { ...p1 };
  const endAnchor = { ...p2 };
  const startPoint = { ...startAnchor };
  const endPoint = { ...endAnchor };
  let midPoint = {}; // Точка "колена"

  // 1. Определяем базовое положение "колена"
  if (side1 === 'left' || side1 === 'right') {
    // Линия начинается горизонтально
    midPoint = { x: p2.x, y: p1.y };
  } else {
    // Линия начинается вертикально
    midPoint = { x: p1.x, y: p2.y };
  }

  // 2. Применяем отступы к начальной и конечной точкам
  switch (side1) {
    case 'top':    startPoint.y -= MARKER_OFFSET; break;
    case 'bottom': startPoint.y += MARKER_OFFSET; break;
    case 'left':   startPoint.x -= MARKER_OFFSET; break;
    case 'right':  startPoint.x += MARKER_OFFSET; break;
  }
  
  if (side2) {
    switch (side2) {
      case 'top':    endPoint.y -= MARKER_OFFSET; break;
      case 'bottom': endPoint.y += MARKER_OFFSET; break;
      case 'left':   endPoint.x -= MARKER_OFFSET; break;
      case 'right':  endPoint.x += MARKER_OFFSET; break;
    }
  }

  // 3. Корректируем положение "колена", чтобы оно совпадало со смещенными точками
  if (side1 === 'left' || side1 === 'right') {
    midPoint.y = startPoint.y; // Y "колена" = Y смещенного старта
    midPoint.x = endPoint.x;   // X "колена" = X смещенного конца
  } else {
    midPoint.x = startPoint.x; // X "колена" = X смещенного старта
    midPoint.y = endPoint.y;   // Y "колена" = Y смещенного конца
  }
  

  const pathPoints = [
    startAnchor,
    startPoint,
    midPoint,
    endPoint,
    endAnchor
  ].filter(Boolean);

  const dedupedPoints = pathPoints.filter((point, index, array) => {
    if (!point) return false;
    if (index === 0) return true;
    const prevPoint = array[index - 1];
    return !(prevPoint && prevPoint.x === point.x && prevPoint.y === point.y);
  });

  if (!dedupedPoints.length) {
    return '';
  }

  const [firstPoint, ...otherPoints] = dedupedPoints;
  const commands = [`M ${firstPoint.x} ${firstPoint.y}`];
  otherPoints.forEach(point => {
    commands.push(`L ${point.x} ${point.y}`);
  });

  return commands.join(' ');
};
const connectionPaths = computed(() => {
  return connections.value
    .map(connection => {
      const fromCard = cards.value.find(card => card.id === connection.from);
      const toCard = cards.value.find(card => card.id === connection.to);

      if (!fromCard || !toCard) return null;

      const { fromSide, toSide } = resolveConnectionSides(
        fromCard,
        toCard,
        connection.fromSide,
        connection.toSide
      );

      const startPoint = getPointCoords(fromCard, fromSide);
      const endPoint = getPointCoords(toCard, toSide);
      const pathData = updateLinePath(startPoint, endPoint, fromSide, toSide);

      return {
        id: connection.id,
        d: pathData,
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
  
  const startPoint = getPointCoords(fromCard, connectionStart.value.side);
  const pathData = updateLinePath(startPoint, mousePosition.value, connectionStart.value.side, null);
  
  return {
    d: pathData,
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
  const alignSide = options.align === 'right' ? 'right' : 'left';
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
  note.width = Number.isFinite(note.width) ? note.width : DEFAULT_NOTE_WIDTH;
  note.height = Number.isFinite(note.height) ? note.height : DEFAULT_NOTE_HEIGHT;
  const rect = getCardElementRect(card.id);
  if (rect) {
    const scale = getCurrentZoom();
    applyCardRectToNote(note, rect, {
      scale,
      align: 'left',
      forceAlign: Boolean(options?.forceAlign)
    });
    updateNoteOffsets(note, rect, { scale });
  }
  if (!note.viewDate && note.selectedDate) {
    note.viewDate = `${note.selectedDate.slice(0, 7)}-01`;
  }
  note.visible = true;
  syncNoteWindowWithCard(card.id, { forceAlign: Boolean(options?.forceAlign), align: 'left' });
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
  const dragIds = new Set();

  if (isHierarchicalDragMode.value) {
    const branchTarget = event.target;
    let branchFilter = null;

    if (branchTarget.closest('.card-header')) {
      branchFilter = 'all';
    } else {
      const bodyElement = branchTarget.closest('.card-body');
      if (!bodyElement) {
        return [];
      }
      const bodyRect = bodyElement.getBoundingClientRect();
      const offsetX = event.clientX - bodyRect.left;
      branchFilter = offsetX < bodyRect.width / 2 ? 'left' : 'right';
    }

    cardsStore.deselectAllCards();
    dragIds.add(cardId);
    cardsStore.selectCard(cardId);

    const descendants = getBranchDescendants(cardId, branchFilter);
    descendants.forEach(descendantId => {
      dragIds.add(descendantId);
      cardsStore.selectCard(descendantId);
    });
  } else {
    const isCardAlreadySelected = cardsStore.selectedCardIds.includes(cardId);

    if (isCardAlreadySelected) {
      cardsStore.selectedCardIds.forEach(id => dragIds.add(id));
    } else if (event?.ctrlKey || event?.metaKey) {
      return [];    
    } else {
      cardsStore.deselectAllCards();
      cardsStore.selectCard(cardId);
      dragIds.add(cardId);
    }
  }

  selectedCardId.value = cardId;
  selectedConnectionIds.value = [];

  return Array.from(dragIds);
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

  if (!cards.value.length) {
    stageConfig.value.width = containerWidth;
    stageConfig.value.height = containerHeight;
    return;
  }

  const maxRight = Math.max(...cards.value.map(card => card.x + card.width));
  const maxBottom = Math.max(...cards.value.map(card => card.y + card.height));
  const dynamicPadding = Math.max(CANVAS_PADDING, containerWidth, containerHeight);


  stageConfig.value.width = Math.max(containerWidth, maxRight + dynamicPadding);
  stageConfig.value.height = Math.max(containerHeight, maxBottom + dynamicPadding);
};

const removeSelectionListeners = () => {
  window.removeEventListener('pointermove', handleSelectionPointerMove);
  window.removeEventListener('pointerup', handleSelectionPointerUp);
  window.removeEventListener('pointercancel', handleSelectionPointerCancel);
};

const applySelectionFromRect = (rect) => {
  const nextSelectionIds = new Set(selectionBaseSelection);

  if (canvasContainerRef.value) {
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
        nextSelectionIds.add(cardId);
      }
    });
  }

  cardsStore.deselectAllCards();

  const orderedIds = Array.from(nextSelectionIds);
  orderedIds.forEach((id) => {
    cardsStore.selectCard(id);
  });

  selectedCardId.value = orderedIds.length > 0 ? orderedIds[orderedIds.length - 1] : null;
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
  selectionBaseSelection = new Set();

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
  selectionBaseSelection = new Set(event.ctrlKey || event.metaKey ? cardsStore.selectedCardIds : []);

  if (!(event.ctrlKey || event.metaKey)) {
    cardsStore.deselectAllCards();
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

  const dragTargetIds = collectDragTargets(cardId, event);
  if (dragTargetIds.length === 0) {
    return;
  }

  const canvasPos = screenToCanvas(event.clientX, event.clientY);
  const cardsToDrag = dragTargetIds
    .map(id => {
      const card = findCardById(id);
      if (!card) return null;
      return {
        id: card.id,
        startX: card.x,
        startY: card.y
      };
    })
    .filter(Boolean);

  if (cardsToDrag.length === 0) {
    return;
  }
  const movingIds = new Set(cardsToDrag.map(item => item.id));
  const primaryEntry = cardsToDrag.find(item => item.id === cardId) || cardsToDrag[0] || null;
  dragState.value = {
    cards: cardsToDrag,
    startPointer: canvasPos,
    hasMoved: false,
    movingIds,
    primaryCardId: primaryEntry ? primaryEntry.id : null,
    primaryCardStart: primaryEntry ? { x: primaryEntry.startX, y: primaryEntry.startY } : null  };
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

const handleDrag = (event) => {
  if (!dragState.value || dragState.value.cards.length === 0) {
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
  let dx = canvasPos.x - dragState.value.startPointer.x;
  let dy = canvasPos.y - dragState.value.startPointer.y;

  dx = snapDelta(dx);
  dy = snapDelta(dy);

  let guideAdjustX = 0;
  let guideAdjustY = 0;

  if (dragState.value.primaryCardId && dragState.value.primaryCardStart) {
    const proposedX = dragState.value.primaryCardStart.x + dx;
    const proposedY = dragState.value.primaryCardStart.y + dy;
    const guideResult = computeGuideSnap(dragState.value.primaryCardId, proposedX, proposedY);

    if (guideResult) {
      guideAdjustX = guideResult.adjustX;
      guideAdjustY = guideResult.adjustY;
      activeGuides.value = guideResult.guides;
    } else {
      resetActiveGuides();
    }
  }

  const finalDx = dx + guideAdjustX;
  const finalDy = dy + guideAdjustY;

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
  updateStageSize();

  if (dx !== 0 || dy !== 0) {
    dragState.value.hasMoved = true;
  }
};

const endDrag = (event) => {
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
    const movedCount = movedCardIds.length;

    let description = '';
    if (movedCount === 1) {
      const card = findCardById(movedCardIds[0]);
      description = card ? `Перемещена карточка "${card.text}"` : 'Перемещена карточка';
    } else {
      description = `Перемещено ${movedCount} карточек`;
    }

    historyStore.setActionMetadata('update', description);
    movedCardIds.forEach(id => {
      syncNoteWindowWithCard(id);
    });
    historyStore.saveState();
    historyStore.saveState();

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

const handleMouseMove = (event) => {
  if (isDrawingLine.value) {
    const canvasPos = screenToCanvas(event.clientX, event.clientY);
    mousePosition.value = {
      x: canvasPos.x,
      y: canvasPos.y
    };
  }
};

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
  const isCtrlPressed = event.ctrlKey || event.metaKey;
  selectedConnectionIds.value = [];
  
  if (isCtrlPressed) {
    cardsStore.toggleCardSelection(cardId);
  } else {
    if (!cardsStore.selectedCardIds.includes(cardId) || cardsStore.selectedCardIds.length > 1) {
      cardsStore.deselectAllCards();
      cardsStore.selectCard(cardId);
    }
  }
  selectedCardId.value = cardId;
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

const handleStageClick = (event) => {
  if (suppressNextStageClick) {
    suppressNextStageClick = false;
    return;
  }
  const preserveCardSelection = isSelectionMode.value;
  if (!event.ctrlKey && !event.metaKey) {
    if (!preserveCardSelection) {
      cardsStore.deselectAllCards();
    }
  }
  
  selectedConnectionIds.value = [];
  cancelDrawing();

  if (!preserveCardSelection) {
    selectedCardId.value = null;
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

const handleKeydown = (event) => {
  const target = event.target;
  const tagName = target?.tagName?.toLowerCase?.();
  const isEditableElement =
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select' ||
    target?.isContentEditable;

  if (event.key === 'Escape' || event.code === 'Escape') {
    if (!isEditableElement) {
      event.preventDefault();
      cardsStore.deselectAllCards();
      selectedConnectionIds.value = [];
      selectedCardId.value = null;
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

  if (selectedConnectionIds.value.length > 0) {
    deleteSelectedConnections();
    return;
  }
  
  if (cardsStore.selectedCardIds.length > 0) {
    deleteSelectedCards();
    return;
  }
};

onMounted(() => {
  if (canvasContainerRef.value) { // Добавляем проверку
    canvasContainerRef.value.addEventListener('pointermove', handleMouseMove);
    canvasContainerRef.value.addEventListener('pointerdown', handlePointerDown);
  }

  handleWindowResize();
  window.addEventListener('resize', handleWindowResize);
  window.addEventListener('keydown', handleKeydown);
  window.addEventListener('scroll', handleViewportChange, true);  
});

onBeforeUnmount(() => {
  if (canvasContainerRef.value) { // Добавляем проверку
    canvasContainerRef.value.removeEventListener('pointermove', handleMouseMove);
    canvasContainerRef.value.removeEventListener('pointerdown', handlePointerDown);
  }
  window.removeEventListener('keydown', handleKeydown);
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

  if (!cardsList.length) {
    resetZoomTransform();
    return;
  }

  const minX = Math.min(...cardsList.map(card => card.x));
  const minY = Math.min(...cardsList.map(card => card.y));
  const maxX = Math.max(...cardsList.map(card => card.x + card.width));
  const maxY = Math.max(...cardsList.map(card => card.y + card.height));

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
const captureViewportSnapshot = async () => {
  const element = canvasContainerRef.value;

  if (!element) {
    return null;
  }

  const rect = element.getBoundingClientRect();

  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));

  try {
    const canvas = await html2canvas(element, {
      backgroundColor: null,
      logging: false,
      useCORS: true,
      scale: 1,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      width,
      height
    });

    return canvas.toDataURL('image/png');
  } catch (error) {
    console.error('Не удалось сделать снимок полотна', error);
    return null;
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
  
defineExpose({
  resetView,
  fitToContent,
  captureViewportSnapshot,
  getViewportBounds
});

watch(isDrawingLine, (isDrawing) => {
  if (isDrawing) {
    emit('update-connection-status', 'Рисование линии: кликните на соединительную точку другой карточки');
  } else {
    emit('update-connection-status', 'Кликните на соединительную точку для создания линии');
  }
});

watch(
  () => connections.map(connection => connection.id),
  (newIds) => {
    selectedConnectionIds.value = selectedConnectionIds.value.filter(id => newIds.includes(id));
  }
);

watch(cards, () => {
  updateStageSize();
}, { deep: true });

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

watch(notesSummary, (summary) => {
  notesStore.setCardsWithEntries(summary);
}, { immediate: true });

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
  }});

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
  :class="['canvas-container', canvasContainerClasses]"
  :style="{ backgroundColor: backgroundColor }"
>
    <div
      v-if="selectionRect"
      class="selection-box"
      :style="selectionBoxStyle"
    ></div>  
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
<svg
        class="svg-layer"
        :width="stageConfig.width"
        :height="stageConfig.height"
        style="position: absolute; top: 0; left: 0; z-index: 1; overflow: visible; pointer-events: auto;"
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

      <div
        class="cards-container"
        :style="{
          width: stageConfig.width + 'px',
          height: stageConfig.height + 'px',
          position: 'relative',
          zIndex: 2,
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
    </div>
  </div>
</template>

<style scoped>
.canvas-container {
  width: 100%;
  height: 100%;
  overflow: hidden;
  position: relative;
}
.canvas-container--selection-mode {
  cursor: crosshair;
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
</style>
