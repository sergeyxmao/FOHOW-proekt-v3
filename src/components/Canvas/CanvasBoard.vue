<script setup>
import { ref, onMounted, onBeforeUnmount, computed, watch } from 'vue';
import { useCardsStore } from '../../stores/cards';
import { useConnectionsStore } from '../../stores/connections';
import { useCanvasStore } from '../../stores/canvas';
import Card from './Card.vue';
import { useKeyboardShortcuts } from '../../composables/useKeyboardShortcuts';
import { getHeaderColorRgb } from '../../utils/constants';
import { batchDeleteCards } from '../../utils/historyOperations';

// Определяем emit для событий
const emit = defineEmits(['update-connection-status']);

const cardsStore = useCardsStore();
const connectionsStore = useConnectionsStore();
const canvasStore = useCanvasStore();
const { cards } = cardsStore;
const { connections } = connectionsStore;

// Добавляем отслеживание изменений в массиве карточек
watch(() => cardsStore.cards, (newCards, oldCards) => {
  console.log('=== Cards array updated ===');
  console.log('Previous cards count:', oldCards.length);
  console.log('New cards count:', newCards.length);
  console.log('New cards:', newCards.map(card => ({ id: card.id, text: card.text, x: card.x, y: card.y })));
  console.log('=== Cards update end ===');
}, { deep: true });

// Инициализируем горячие клавиши
useKeyboardShortcuts({
  enabled: true,
  preventDefault: true,
  visualFeedback: true,
  feedbackDuration: 300,
  disableOnInput: true
});
const canvasContainer = ref(null);
const canvasScale = ref(1);
const canvasTranslation = ref({ x: 0, y: 0 });

const MIN_CANVAS_SCALE = 0.5;
const MAX_CANVAS_SCALE = 2;
const CANVAS_SCALE_STEP = 0.1;
const stageConfig = ref({
  width: 0,
  height: 0
});
const contentTransformStyle = computed(() => ({
  transform: `translate(${canvasTranslation.value.x}px, ${canvasTranslation.value.y}px) scale(${canvasScale.value})`,
  transformOrigin: '0 0'
}));

const screenToWorld = (clientX, clientY) => {
  const rect = canvasContainer.value?.getBoundingClientRect();
  if (!rect) {
    return { x: 0, y: 0 };
  }

  const relativeX = clientX - rect.left;
  const relativeY = clientY - rect.top;

  return {
    x: (relativeX - canvasTranslation.value.x) / canvasScale.value,
    y: (relativeY - canvasTranslation.value.y) / canvasScale.value
  };
};

const clampTranslation = (translation, scale) => {
  if (!canvasContainer.value) {
    return translation;
  }

  const containerWidth = canvasContainer.value.clientWidth;
  const containerHeight = canvasContainer.value.clientHeight;
  const scaledWidth = containerWidth * scale;
  const scaledHeight = containerHeight * scale;

  const minX = Math.min(0, containerWidth - scaledWidth);
  const maxX = Math.max(0, containerWidth - scaledWidth);
  const minY = Math.min(0, containerHeight - scaledHeight);
  const maxY = Math.max(0, containerHeight - scaledHeight);

  return {
    x: Math.min(Math.max(translation.x, minX), maxX),
    y: Math.min(Math.max(translation.y, minY), maxY)
  };
};

const handleWheel = (event) => {
  if (event.ctrlKey) {
    event.preventDefault();
    return;
  }
  event.preventDefault();

  const rect = canvasContainer.value?.getBoundingClientRect();
  if (!rect) {
    return;
  }

  const zoomDirection = event.deltaY < 0 ? 1 : -1;
  const scaleDelta = 1 + CANVAS_SCALE_STEP * zoomDirection;
  let nextScale = canvasScale.value * scaleDelta;
  nextScale = Math.min(MAX_CANVAS_SCALE, Math.max(MIN_CANVAS_SCALE, nextScale));

  if (nextScale === canvasScale.value) {
    return;
  }

  const cursorX = event.clientX - rect.left;
  const cursorY = event.clientY - rect.top;

  const worldPosition = {
    x: (cursorX - canvasTranslation.value.x) / canvasScale.value,
    y: (cursorY - canvasTranslation.value.y) / canvasScale.value
  };

  canvasScale.value = nextScale;
  const nextTranslation = {
    x: cursorX - worldPosition.x * nextScale,
    y: cursorY - worldPosition.y * nextScale
  };
  canvasTranslation.value = clampTranslation(nextTranslation, nextScale);
};

// Состояние для создания соединений
const selectedCardId = ref(null);
const isConnecting = ref(false);
const connectionStart = ref(null); // Хранит информацию о начальной точке соединения
const isDrawingLine = ref(false); // Флаг рисования линии
const previewLine = ref(null); // Временная линия при рисовании
const mousePosition = ref({ x: 0, y: 0 }); // Позиция мыши
const selectedConnectionId = ref(null);

// Константа для смещения маркеров
const MARKER_OFFSET = 12;

// Функция для получения координат точки подключения на карточке
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
  
// Функция для вычисления Г-образного пути
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

// Вычисляемые свойства для SVG путей соединений
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

// Вычисляемое свойство для временной линии при рисовании
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
  if (fromCardId === toCardId) {
    return null;
  }

  const fromCard = cards.find(card => card.id === fromCardId);
  const toCard = cards.find(card => card.id === toCardId);

  if (!fromCard || !toCard) {
    return null;
  }

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
  
// Состояние для перетаскивания
const draggedCardId = ref(null);
const dragOffset = ref({ x: 0, y: 0 });

// Обработчики для перетаскивания карточек
const startDrag = (event, cardId) => {
  draggedCardId.value = cardId;
  const card = cards.find(c => c.id === cardId);
  if (card) {
    const pointer = screenToWorld(event.clientX, event.clientY);    dragOffset.value = {
      x: pointer.x - card.x,
      y: pointer.y - card.y
    };
  }
  
  // Добавляем обработчики на документ
  document.addEventListener('mousemove', handleDrag);
  document.addEventListener('mouseup', endDrag);
  
  // Предотвращаем выделение текста при перетаскивании
  event.preventDefault();
};

const handleDrag = (event) => {
  if (!draggedCardId.value) return;

  const pointer = screenToWorld(event.clientX, event.clientY);
  const newX = pointer.x - dragOffset.value.x;
   const newY = pointer.y - dragOffset.value.y;
  
  cardsStore.updateCardPosition(draggedCardId.value, newX, newY);
};

const endDrag = () => {
  draggedCardId.value = null;
  
  // Удаляем обработчики с документа
  document.removeEventListener('mousemove', handleDrag);
  document.removeEventListener('mouseup', endDrag);
};


// Обработчик движения мыши для обновления временной линии
const handleMouseMove = (event) => {
  if (isDrawingLine.value) {
    // Обновляем позицию мыши в координатах рабочей области
    mousePosition.value = screenToWorld(event.clientX, event.clientY);
  }
};

// Глобальный обработчик нажатия кнопки мыши/указателя
const handlePointerDown = (event) => {
  // Проверяем, был ли клик по соединительной точке
  const connectionPoint = event.target.closest('.connection-point');
  
  if (connectionPoint) {
    event.stopPropagation();
    
    // Извлекаем данные из атрибутов
    const cardId = connectionPoint.dataset.cardId;
    const side = connectionPoint.dataset.side;
    
    if (!cardId || !side) return;
    
    if (!isDrawingLine.value) {
      // Начинаем рисование линии
      startDrawingLine(cardId, side);
    } else {
      // Завершаем рисование линии
      endDrawingLine(cardId, side);
    }
  } else if (!event.target.closest('.card')) {
    if (event.button === 0) {
      event.preventDefault();
    }
// Если клик не по карточке и не по точке соединения, отменяем рисование
    cancelDrawing();
  }
};

// Начало рисования линии
const startDrawingLine = (cardId, side) => {
  selectedConnectionId.value = null;
  connectionStart.value = { cardId, side };
  isDrawingLine.value = true;
  emit('update-connection-status', 'Рисование линии: кликните на соединительную точку другой карточки');
  console.log('Начало рисования линии:', connectionStart.value);
};

// Завершение рисования линии
const endDrawingLine = (cardId, side) => {
  if (!connectionStart.value || connectionStart.value.cardId === cardId) {
    cancelDrawing();
    return;
  }
  
  // Создаем соединение между карточками
  createConnectionBetweenCards(connectionStart.value.cardId, cardId, {
    fromSide: connectionStart.value.side,
    toSide: side
  });  console.log('Создано соединение:', connectionStart.value.cardId, '->', cardId);
  
  // Сбрасываем состояние
  cancelDrawing();
};

// Отмена рисования линии
const cancelDrawing = () => {
  connectionStart.value = null;
  isDrawingLine.value = false;
  previewLine.value = null;
  emit('update-connection-status', 'Кликните на соединительную точку для создания линии');
  console.log('Рисование линии отменено');
};

const handleLineClick = (event, connectionId) => {
  event.stopPropagation();
  event.preventDefault();

  if (selectedConnectionId.value === connectionId) {
    selectedConnectionId.value = null;
    return;
  }

  selectedConnectionId.value = connectionId;
  cardsStore.deselectAllCards();
  selectedCardId.value = null;
  isConnecting.value = false;
  cancelDrawing();
};

  
// Обработчик клика по карточке
const handleCardClick = (event, cardId) => {
  // Проверяем, нажата ли клавиша Ctrl для множественного выделения
  const isCtrlPressed = event.ctrlKey || event.metaKey;


  selectedConnectionId.value = null;
  
  if (!isConnecting.value) {
    // Управляем выделением карточек
    if (isCtrlPressed) {
      // Множественное выделение с Ctrl
      cardsStore.toggleCardSelection(cardId);
    } else {
      // Одиночное выделение - снимаем выделение со всех и выделяем текущую
      cardsStore.deselectAllCards();
      cardsStore.selectCard(cardId);
    }
    
    // Обновляем selectedCardId для совместимости с другими функциями
    selectedCardId.value = cardId;
  } else {
    // Завершаем процесс соединения
    if (selectedCardId.value !== cardId) {
      createConnectionBetweenCards(selectedCardId.value, cardId);
    }
    // Сбрасываем состояние
    selectedCardId.value = null;
    isConnecting.value = false;
  }
};

// Сброс режима соединения и выделения при клике на пустое место
const handleStageClick = (event) => {
  // Если клик не по карточке и не нажат Ctrl, снимаем выделение
  if (!event.ctrlKey && !event.metaKey) {
    cardsStore.deselectAllCards();
  }
  
  selectedCardId.value = null;
  isConnecting.value = false;
  selectedConnectionId.value = null;
  cancelDrawing();
};

// Функции для управления карточками
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
    headerBg: getHeaderColorRgb(0), // Цвет заголовка по умолчанию
    colorIndex: 0                  // Индекс цвета по умолчанию
  };
  
  cardsStore.addCard(newCard);
};

const deleteSelectedCards = () => {
  const uniqueIds = Array.from(new Set(cardsStore.selectedCardIds));

  if (uniqueIds.length === 0) {
    return;
  }

  batchDeleteCards(uniqueIds);

  cardsStore.selectedCardIds = [];
  selectedCardId.value = null;
  isConnecting.value = false;
  selectedConnectionId.value = null;
  cancelDrawing();
};

const handleDeletionKeydown = (event) => {
  const isDeleteKey = event.key === 'Delete' || event.code === 'Delete';
  const isBackspaceKey = event.key === 'Backspace' || event.code === 'Backspace';

  if (!isDeleteKey && !isBackspaceKey) {
    return;
  }

  const target = event.target;
  const tagName = target?.tagName?.toLowerCase?.();
  const isEditableElement =
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select' ||
    target?.isContentEditable;

  if (isEditableElement) {
    return;
  }

  if (selectedConnectionId.value) {
    event.preventDefault();
    connectionsStore.removeConnection(selectedConnectionId.value);
    selectedConnectionId.value = null;
    return;
  }
  
  if (cardsStore.selectedCardIds.length === 0) {
    return;
  }

  event.preventDefault();
  deleteSelectedCards();};

onMounted(() => {
  // Устанавливаем размеры сцены равными размерам родительского контейнера
  const resizeStage = () => {
    if (canvasContainer.value) {
      stageConfig.value.width = canvasContainer.value.clientWidth;
      stageConfig.value.height = canvasContainer.value.clientHeight;
      canvasTranslation.value = clampTranslation(canvasTranslation.value, canvasScale.value);
    }
  };

  resizeStage();
  window.addEventListener('resize', resizeStage);
  window.addEventListener('keydown', handleDeletionKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleDeletionKeydown);});
const resetView = () => {
  canvasScale.value = 1;
  canvasTranslation.value = clampTranslation({ x: 0, y: 0 }, 1);
};

defineExpose({
  resetView
});

// Следим за изменением статуса соединения и эмитим событие
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
    if (selectedConnectionId.value && !newIds.includes(selectedConnectionId.value)) {
      selectedConnectionId.value = null;
    }
  }
);
  
// Следим за изменением цвета фона в store
watch(() => canvasStore.backgroundColor, (newColor, oldColor) => {
  // Цвет фона изменен, реактивное обновление произойдет автоматически
}, { immediate: true });
</script>

<template>
  <div
    class="canvas-container"
    ref="canvasContainer"
    :style="{ backgroundColor: canvasStore.backgroundColor }"
    @wheel="handleWheel"
  >
    <div class="canvas-content" :style="contentTransformStyle">
      <!-- SVG слой для отрисовки линий соединений -->
      <svg
        class="svg-layer"
        :width="stageConfig.width"
        :height="stageConfig.height"
        style="position: absolute; top: 0; left: 0; z-index: 1;"
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

        <!-- Отрисовка Г-образных линий соединений -->
        <path
          v-for="path in connectionPaths"
          :key="path.id"
          :d="path.d"
          :class="[
            'line',
            {
              selected: path.id === selectedConnectionId,
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
            color: path.color
          }"
          @pointerdown.stop.prevent
          @click="(event) => handleLineClick(event, path.id)"        />

        <!-- Временная линия при рисовании соединения -->
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

      <!-- Контейнер для карточек (обычный HTML/DOM) -->
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
        <!-- Отрисовка карточек -->
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
  pointer-events: auto;
  cursor: pointer;
  filter: drop-shadow(0 0 5px rgba(0, 0, 0, .15));
  marker-start: url(#marker-dot);
  marker-end: url(#marker-dot);
  transition: stroke-dashoffset .3s ease;
}

.line.selected {
  stroke-dasharray: 6 6;
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
