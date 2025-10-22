<script setup>
import { ref, onMounted, onBeforeUnmount, computed, watch } from 'vue';
import { useCardsStore } from '../../stores/cards';
import { useConnectionsStore } from '../../stores/connections';
import { useCanvasStore } from '../../stores/canvas';
import Card from './Card.vue';
import { useKeyboardShortcuts } from '../../composables/useKeyboardShortcuts';
import { getHeaderColorRgb } from '../../utils/constants';
import { batchDeleteCards } from '../../utils/historyOperations';
import { usePanZoom } from '../../composables/usePanZoom';
  
const emit = defineEmits(['update-connection-status']);

const cardsStore = useCardsStore();
const connectionsStore = useConnectionsStore();
const canvasStore = useCanvasStore();
const { cards } = cardsStore;
const { connections } = connectionsStore;

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

const canvasContainerRef = ref(null);
const { scale: zoomScale, translateX: zoomTranslateX, translateY: zoomTranslateY } = usePanZoom(canvasContainerRef);

const selectedCardId = ref(null);
const isConnecting = ref(false);
const connectionStart = ref(null);
const isDrawingLine = ref(false);
const previewLine = ref(null);
const previewLineWidth = computed(() => connectionsStore.defaultLineThickness || 2);
const mousePosition = ref({ x: 0, y: 0 });
const selectedConnectionIds = ref([]);

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
  const midP1 = { x: p1.x, y: p1.y };
  const finalP2 = { x: p2.x, y: p2.y };  
  
  if (side1 === 'left' || side1 === 'right') {
    midP1.x = p2.x;
  } else {
    midP1.y = p2.y;
  }

  if (side2) {
    if (side1 === 'left' || side1 === 'right') {
      finalP2.y = p2.y + (p2.y > p1.y ? -MARKER_OFFSET : MARKER_OFFSET);
    } else {
      finalP2.x = p2.x + (p2.x > p1.x ? -MARKER_OFFSET : MARKER_OFFSET);
    }
  }
  
  return `M ${p1.x} ${p1.y} L ${midP1.x} ${midP1.y} L ${finalP2.x} ${finalP2.y}`;
};

const connectionPaths = computed(() => {
  return connections
    .map(connection => {
      const fromCard = cards.find(card => card.id === connection.from);
      const toCard = cards.find(card => card.id === connection.to);

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
  
  const fromCard = cards.find(card => card.id === connectionStart.value.cardId);
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

const createConnectionBetweenCards = (fromCardId, toCardId, options = {}) => {
  if (fromCardId === toCardId) return null;

  const fromCard = cards.find(card => card.id === fromCardId);
  const toCard = cards.find(card => card.id === toCardId);

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
  
const draggedCardId = ref(null);
const dragOffset = ref({ x: 0, y: 0 });

const screenToCanvas = (clientX, clientY) => {
  if (!canvasContainerRef.value) return { x: clientX, y: clientY };
  
  const rect = canvasContainerRef.value.getBoundingClientRect();
  const x = (clientX - rect.left - zoomTranslateX.value) / zoomScale.value;
  const y = (clientY - rect.top - zoomTranslateY.value) / zoomScale.value;
  
  return { x, y };
};

const startDrag = (event, cardId) => {
  draggedCardId.value = cardId;
  const card = cards.find(c => c.id === cardId);
  if (card) {
    const canvasPos = screenToCanvas(event.clientX, event.clientY);
    dragOffset.value = {
      x: canvasPos.x - card.x,
      y: canvasPos.y - card.y
    };
  }
  
  document.addEventListener('mousemove', handleDrag);
  document.addEventListener('mouseup', endDrag);
  event.preventDefault();
};

const handleDrag = (event) => {
  if (!draggedCardId.value) return;
  
  const canvasPos = screenToCanvas(event.clientX, event.clientY);
  const newX = canvasPos.x - dragOffset.value.x;
  const newY = canvasPos.y - dragOffset.value.y;
  
  cardsStore.updateCardPosition(draggedCardId.value, newX, newY);
};

const endDrag = () => {
  draggedCardId.value = null;
  document.removeEventListener('mousemove', handleDrag);
  document.removeEventListener('mouseup', endDrag);
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
    event.preventDefault();
    
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
  event.preventDefault();
  
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
  isConnecting.value = false;
  cancelDrawing();
};

const handleCardClick = (event, cardId) => {
  const isCtrlPressed = event.ctrlKey || event.metaKey;
  selectedConnectionIds.value = [];
  
  if (!isConnecting.value) {
    if (isCtrlPressed) {
      cardsStore.toggleCardSelection(cardId);
    } else {
      cardsStore.deselectAllCards();
      cardsStore.selectCard(cardId);
    }
    selectedCardId.value = cardId;
  } else {
    if (selectedCardId.value !== cardId) {
      createConnectionBetweenCards(selectedCardId.value, cardId);
    }
    selectedCardId.value = null;
    isConnecting.value = false;
  }
};

const handleStageClick = (event) => {
  if (!event.ctrlKey && !event.metaKey) {
    cardsStore.deselectAllCards();
    selectedConnectionIds.value = [];
  }
  
  selectedCardId.value = null;
  isConnecting.value = false;
  cancelDrawing();
};

const addNewCard = () => {
  const colors = ['#4CAF50', '#2196F3', '#FF9800', '#9C27B0', '#F44336'];
  const randomColor = colors[Math.floor(Math.random() * colors.length)];
  
  const newCard = {
    x: Math.random() * (stageConfig.value.width - 150),
    y: Math.random() * (stageConfig.value.height - 80),
    text: `Карточка ${cards.length + 1}`,
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

const deleteSelectedCards = () => {
  const uniqueIds = Array.from(new Set(cardsStore.selectedCardIds));
  if (uniqueIds.length === 0) return;

  batchDeleteCards(uniqueIds);
  cardsStore.selectedCardIds = [];
  selectedCardId.value = null;
  isConnecting.value = false;
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
      isConnecting.value = false;
      cancelDrawing();
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
  const resizeStage = () => {
    if (canvasContainerRef.value) {
      stageConfig.value.width = canvasContainerRef.value.clientWidth;
      stageConfig.value.height = canvasContainerRef.value.clientHeight;
    }
  };

  resizeStage();
  window.addEventListener('resize', resizeStage);
  window.addEventListener('keydown', handleKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown);
  window.removeEventListener('pointermove', handleMouseMove);
});

watch(isDrawingLine, (isActive) => {
  if (isActive) {
    window.addEventListener('pointermove', handleMouseMove);
  } else {
    window.removeEventListener('pointermove', handleMouseMove);
  }
});

const resetView = () => {};

defineExpose({
  resetView
});

watch([isDrawingLine, isConnecting], ([drawing, connecting]) => {
  if (drawing) {
    emit('update-connection-status', 'Рисование линии: кликните на соединительную точку другой карточки');
  } else if (connecting) {
    emit('update-connection-status', 'Выберите вторую карточку для соединения');
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
  
watch(() => canvasStore.backgroundColor, () => {}, { immediate: true });
</script>

<template>
  <div 
    ref="canvasContainerRef" 
    class="canvas-container" 
    :style="{ backgroundColor: canvasStore.backgroundColor }"
  >
    <div class="canvas-content">
      <svg
        class="svg-layer"
        :width="stageConfig.width"
        :height="stageConfig.height"
        style="position: absolute; top: 0; left: 0; z-index: 1; overflow: visible; pointer-events: none;"
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

        <path
          v-for="path in connectionPaths"
          :key="path.id"
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
          @click="(event) => handleLineClick(event, path.id)"
        />

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
          zIndex: 2
        }"
        @click="handleStageClick"
        @mousemove="handleMouseMove"
        @pointerdown="handlePointerDown"
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
        />
      </div>   
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

.canvas-content {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  transform-origin: 0 0;
}

.line {
  fill: none;
  stroke: var(--line-color, #0f62fe);
  stroke-width: var(--line-width, 5px);
  pointer-events: stroke;
  cursor: pointer;
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
