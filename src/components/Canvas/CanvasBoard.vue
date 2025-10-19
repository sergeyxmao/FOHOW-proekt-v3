<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { useCardsStore } from '../../stores/cards';
import { useConnectionsStore } from '../../stores/connections';
import { useCanvasStore } from '../../stores/canvas';
import Card from './Card.vue';
import { useKeyboardShortcuts } from '../../composables/useKeyboardShortcuts';
import { getHeaderColorRgb } from '../../utils/constants';

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

const stageConfig = ref({
  width: 0,
  height: 0
});

// Состояние для создания соединений
const selectedCardId = ref(null);
const isConnecting = ref(false);
const connectionStart = ref(null); // Хранит информацию о начальной точке соединения
const isDrawingLine = ref(false); // Флаг рисования линии
const previewLine = ref(null); // Временная линия при рисовании
const mousePosition = ref({ x: 0, y: 0 }); // Позиция мыши

// Константа для смещения маркеров
const MARKER_OFFSET = 12;

// Функция для получения координат точки подключения на карточке
const getPointCoords = (card, side) => {
  const x = card.x;
  const y = card.y;
  const width = card.width;
  const height = card.height;
  
  switch (side) {
    case 'top': return { x: x + width / 2, y: y };
    case 'bottom': return { x: x + width / 2, y: y + height };
    case 'left': return { x: x, y: y + height / 2 };
    case 'right': return { x: x + width, y: y + height / 2 };
    default: return { x: x + width / 2, y: y + height / 2 };
  }
};

// Функция для вычисления Г-образного пути
const updateLinePath = (p1, p2, side1, side2) => {
  let finalP2 = { ...p2 }, midP1 = { ...p1 };
  
  if (side1 === 'left' || side1 === 'right') {
    midP1 = { x: p2.x, y: p1.y };
    if (side2) finalP2.y = p2.y + (p2.y > p1.y ? -MARKER_OFFSET : MARKER_OFFSET);
  }
  else {
    midP1 = { x: p1.x, y: p2.y };
    if (side2) finalP2.x = p2.x + (p2.x > p1.x ? -MARKER_OFFSET : MARKER_OFFSET);
  }
  
  return `M ${p1.x} ${p1.y} L ${midP1.x} ${midP1.y} L ${finalP2.x} ${finalP2.y}`;
};

// Вычисляемые свойства для SVG путей соединений
const connectionPaths = computed(() => {
  return connections.map(connection => {
    const fromCard = cards.find(card => card.id === connection.from);
    const toCard = cards.find(card => card.id === connection.to);
    
    if (!fromCard || !toCard) return null;
    
    // Определяем стороны для соединения (простая логика - можно улучшить)
    let fromSide = 'right';
    let toSide = 'left';
    
    // Если карточка справа, соединяем с левой стороны
    if (fromCard.x > toCard.x) {
      fromSide = 'left';
      toSide = 'right';
    }
    // Если карточка ниже, соединяем с верхней стороны
    else if (fromCard.y > toCard.y) {
      fromSide = 'top';
      toSide = 'bottom';
    }
    // Если карточка выше, соединяем с нижней стороны
    else if (fromCard.y < toCard.y) {
      fromSide = 'bottom';
      toSide = 'top';
    }
    
    // Получаем координаты точек подключения
    const startPoint = getPointCoords(fromCard, fromSide);
    const endPoint = getPointCoords(toCard, toSide);
    
    // Вычисляем Г-образный путь
    const pathData = updateLinePath(startPoint, endPoint, fromSide, toSide);
    
    return {
      id: connection.id,
      d: pathData,
      stroke: '#3498db',
      strokeWidth: 2,
      fill: 'none'
    };
  }).filter(path => path !== null);
});

// Вычисляемое свойство для временной линии при рисовании
const previewLinePath = computed(() => {
  if (!isDrawingLine.value || !connectionStart.value) return null;
  
  const fromCard = cards.find(card => card.id === connectionStart.value.cardId);
  if (!fromCard) return null;
  
  // Получаем координаты начальной точки
  const startPoint = getPointCoords(fromCard, connectionStart.value.side);
  
  // Вычисляем Г-образный путь до текущей позиции мыши
  const pathData = updateLinePath(startPoint, mousePosition.value, connectionStart.value.side, null);
  
  return {
    d: pathData,
    stroke: '#ff9800',
    strokeWidth: 2,
    fill: 'none',
    strokeDasharray: '5,5'
  };
});

// Состояние для перетаскивания
const draggedCardId = ref(null);
const dragOffset = ref({ x: 0, y: 0 });

// Обработчики для перетаскивания карточек
const startDrag = (event, cardId) => {
  draggedCardId.value = cardId;
  const card = cards.find(c => c.id === cardId);
  if (card) {
    dragOffset.value = {
      x: event.clientX - card.x,
      y: event.clientY - card.y
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
  
  const newX = event.clientX - dragOffset.value.x;
  const newY = event.clientY - dragOffset.value.y;
  
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
    // Обновляем позицию мыши
    const rect = event.currentTarget.getBoundingClientRect();
    mousePosition.value = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
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
    // Если клик не по карточке и не по точке соединения, отменяем рисование
    cancelDrawing();
  }
};

// Начало рисования линии
const startDrawingLine = (cardId, side) => {
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
  connectionsStore.addConnection(connectionStart.value.cardId, cardId);
  console.log('Создано соединение:', connectionStart.value.cardId, '->', cardId);
  
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

// Обработчик клика по карточке
const handleCardClick = (event, cardId) => {
  // Проверяем, нажата ли клавиша Ctrl для множественного выделения
  const isCtrlPressed = event.ctrlKey || event.metaKey;
  
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
      connectionsStore.addConnection(selectedCardId.value, cardId);
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

const deleteSelectedCard = () => {
  if (selectedCardId.value) {
    cardsStore.removeCard(selectedCardId.value);
    selectedCardId.value = null;
    isConnecting.value = false;
    cancelDrawing();
  }
};

onMounted(() => {
  // Устанавливаем размеры сцены равными размерам родительского контейнера
  const resizeStage = () => {
    const container = document.querySelector('.canvas-container');
    if (container) {
      stageConfig.value.width = container.clientWidth;
      stageConfig.value.height = container.clientHeight;
    }
  };

  resizeStage();
  window.addEventListener('resize', resizeStage);
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

// Следим за изменением цвета фона в store
watch(() => canvasStore.backgroundColor, (newColor, oldColor) => {
  // Цвет фона изменен, реактивное обновление произойдет автоматически
}, { immediate: true });
</script>

<template>
  <div class="canvas-container" :style="{ backgroundColor: canvasStore.backgroundColor }">
    
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
        :stroke="path.stroke"
        :stroke-width="path.strokeWidth"
        :fill="path.fill"
        marker-start="url(#marker-dot)"
        marker-end="url(#marker-dot)"
        style="pointer-events: stroke;"
      />
      
      <!-- Временная линия при рисовании соединения -->
      <path
        v-if="previewLinePath"
        :d="previewLinePath.d"
        :stroke="previewLinePath.stroke"
        :stroke-width="previewLinePath.strokeWidth"
        :fill="previewLinePath.fill"
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
</template>

<style scoped>
.canvas-container {
  width: 100%;
  height: 100%;
  overflow: hidden;
  position: relative;
}
</style>
