<template>
  <div class="drawing-canvas-container">
    <canvas
      ref="canvasRef"
      class="drawing-canvas"
      @mousedown="handleMouseDown"
      @mousemove="handleMouseMove"
      @mouseleave="handleMouseLeave"
    ></canvas>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, computed } from 'vue';
import { useImagesStore } from '../../stores/images';

const imagesStore = useImagesStore();
const canvasRef = ref(null);

// State для drag-операций
const isDragging = ref(false);
const dragStartX = ref(0);
const dragStartY = ref(0);
const dragObjectId = ref(null);
const dragInitialX = ref(0);
const dragInitialY = ref(0);
const currentInteractionType = ref(null);

// State для resize-операций
const resizeInitialWidth = ref(0);    // начальная ширина объекта
const resizeInitialHeight = ref(0);   // начальная высота объекта
const resizeAspectRatio = ref(1);     // соотношение сторон
const resizeKeepAspectRatio = ref(true); // сохранять пропорции (по умолчанию true)

// Получаем выбранный объект
const selectedObject = computed(() => {
  return imagesStore.images.find(img => img.isSelected);
});

/**
 * Проверка попадания точки в объект с учетом rotation
 * @param {number} x - Координата X курсора на canvas
 * @param {number} y - Координата Y курсора на canvas
 * @param {Object} object - Объект изображения
 * @returns {boolean} - true если точка внутри объекта
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
  const sortedImages = [...imagesStore.images].sort((a, b) => {
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

/**
 * Изменение курсора в зависимости от типа взаимодействия
 * @param {string|null} interactionType - тип взаимодействия
 */
const updateCursor = (interactionType) => {
  const canvas = canvasRef.value;
  if (!canvas) return;

  const cursorMap = {
    'move': 'move',
    'resize-nw': 'nw-resize',
    'resize-n': 'n-resize',
    'resize-ne': 'ne-resize',
    'resize-e': 'e-resize',
    'resize-se': 'se-resize',
    'resize-s': 's-resize',
    'resize-sw': 'sw-resize',
    'resize-w': 'w-resize',
    'rotate': 'grab',
    null: 'default'
  };

  canvas.style.cursor = cursorMap[interactionType] || 'default';
};

/**
 * Обработчик события mousedown
 * @param {MouseEvent} event
 */
const handleMouseDown = (event) => {
  const canvas = canvasRef.value;
  if (!canvas) return;

  // Получить координаты клика относительно canvas
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  // Получить выделенный объект
  const selected = selectedObject.value;

  if (selected) {
    // Если есть выделенный объект, проверяем тип взаимодействия
    const interactionType = getInteractionType(x, y, selected);
    currentInteractionType.value = interactionType;

    if (interactionType !== null) {
      // Начинаем перетаскивание
      isDragging.value = true;
      dragStartX.value = x;
      dragStartY.value = y;
      dragObjectId.value = selected.id;
      dragInitialX.value = selected.x;
      dragInitialY.value = selected.y;

      // Если это resize операция, сохраняем дополнительные параметры
      if (interactionType.startsWith('resize-')) {
        resizeInitialWidth.value = selected.width;
        resizeInitialHeight.value = selected.height;
        resizeAspectRatio.value = selected.width / selected.height;
        resizeKeepAspectRatio.value = !event.shiftKey; // Shift отключает сохранение пропорций
      }

      event.preventDefault();

      // Изменяем курсор
      updateCursor(interactionType);
      return;
    }
  }

  // Если нет выделенного объекта или клик не попал в выделенный объект
  // Ищем объект под курсором
  const objectAtPoint = getObjectAtPoint(x, y);

  if (objectAtPoint) {
    // Выделяем объект
    imagesStore.deselectAllImages();
    imagesStore.selectImage(objectAtPoint.id);

    // Начинаем перетаскивание
    currentInteractionType.value = 'move';
    isDragging.value = true;
    dragStartX.value = x;
    dragStartY.value = y;
    dragObjectId.value = objectAtPoint.id;
    dragInitialX.value = objectAtPoint.x;
    dragInitialY.value = objectAtPoint.y;
    event.preventDefault();

    // Изменяем курсор
    updateCursor('move');
  } else {
    // Снимаем выделение
    imagesStore.deselectAllImages();
    currentInteractionType.value = null;
    updateCursor(null);
  }
};

/**
 * Обработчик события mousemove
 * @param {MouseEvent} event
 */
const handleMouseMove = (event) => {
  const canvas = canvasRef.value;
  if (!canvas) return;

  // Получить текущие координаты курсора
  const rect = canvas.getBoundingClientRect();
  const currentX = event.clientX - rect.left;
  const currentY = event.clientY - rect.top;

  if (!isDragging.value) {
    // Если не перетаскиваем, обновляем курсор при наведении
    const selected = selectedObject.value;
    if (selected) {
      const interactionType = getInteractionType(currentX, currentY, selected);
      updateCursor(interactionType);
    } else {
      const objectAtPoint = getObjectAtPoint(currentX, currentY);
      updateCursor(objectAtPoint ? 'move' : null);
    }
    return;
  }

  // Вычислить смещение курсора
  const deltaX = currentX - dragStartX.value;
  const deltaY = currentY - dragStartY.value;

  // Получить перетаскиваемый объект
  const draggingObject = imagesStore.getImageById(dragObjectId.value);
  if (!draggingObject) return;

  if (currentInteractionType.value === 'move') {
    // Вычислить новую позицию объекта
    const newX = dragInitialX.value + deltaX;
    const newY = dragInitialY.value + deltaY;

    // Обновить позицию объекта через store (без сохранения в историю при перетаскивании)
    imagesStore.updateImage(dragObjectId.value, { x: newX, y: newY }, { saveToHistory: false });

    // Перерисовать canvas (если есть метод отрисовки)
    // TODO: вызвать метод перерисовки canvas
  } else if (currentInteractionType.value?.startsWith('resize-')) {
    // Обработка изменения размера
    let newWidth, newHeight, newX, newY;
    const resizeType = currentInteractionType.value;

    switch (resizeType) {
      case 'resize-se': // юго-восток, правый нижний угол
        newWidth = resizeInitialWidth.value + deltaX;
        newHeight = resizeInitialHeight.value + deltaY;

        if (resizeKeepAspectRatio.value) {
          // Берем большее изменение и масштабируем пропорционально
          const scale = Math.max(newWidth / resizeInitialWidth.value, newHeight / resizeInitialHeight.value);
          newWidth = resizeInitialWidth.value * scale;
          newHeight = resizeInitialHeight.value * scale;
        }

        newWidth = Math.max(20, newWidth);
        newHeight = Math.max(20, newHeight);

        imagesStore.updateImage(dragObjectId.value, {
          width: newWidth,
          height: newHeight
        }, { saveToHistory: false });
        break;

      case 'resize-nw': // северо-запад, левый верхний угол
        newWidth = resizeInitialWidth.value - deltaX;
        newHeight = resizeInitialHeight.value - deltaY;

        if (resizeKeepAspectRatio.value) {
          const scale = Math.max(newWidth / resizeInitialWidth.value, newHeight / resizeInitialHeight.value);
          newWidth = resizeInitialWidth.value * scale;
          newHeight = resizeInitialHeight.value * scale;
        }

        newWidth = Math.max(20, newWidth);
        newHeight = Math.max(20, newHeight);

        // При изменении размера от верхнего левого угла нужно сдвинуть позицию
        newX = dragInitialX.value + (resizeInitialWidth.value - newWidth);
        newY = dragInitialY.value + (resizeInitialHeight.value - newHeight);

        imagesStore.updateImage(dragObjectId.value, {
          width: newWidth,
          height: newHeight,
          x: newX,
          y: newY
        }, { saveToHistory: false });
        break;

      case 'resize-ne': // северо-восток, правый верхний угол
        newWidth = resizeInitialWidth.value + deltaX;
        newHeight = resizeInitialHeight.value - deltaY;

        if (resizeKeepAspectRatio.value) {
          const scale = Math.max(newWidth / resizeInitialWidth.value, newHeight / resizeInitialHeight.value);
          newWidth = resizeInitialWidth.value * scale;
          newHeight = resizeInitialHeight.value * scale;
        }

        newWidth = Math.max(20, newWidth);
        newHeight = Math.max(20, newHeight);

        newY = dragInitialY.value + (resizeInitialHeight.value - newHeight);

        imagesStore.updateImage(dragObjectId.value, {
          width: newWidth,
          height: newHeight,
          y: newY
        }, { saveToHistory: false });
        break;

      case 'resize-sw': // юго-запад, левый нижний угол
        newWidth = resizeInitialWidth.value - deltaX;
        newHeight = resizeInitialHeight.value + deltaY;

        if (resizeKeepAspectRatio.value) {
          const scale = Math.max(newWidth / resizeInitialWidth.value, newHeight / resizeInitialHeight.value);
          newWidth = resizeInitialWidth.value * scale;
          newHeight = resizeInitialHeight.value * scale;
        }

        newWidth = Math.max(20, newWidth);
        newHeight = Math.max(20, newHeight);

        newX = dragInitialX.value + (resizeInitialWidth.value - newWidth);

        imagesStore.updateImage(dragObjectId.value, {
          width: newWidth,
          height: newHeight,
          x: newX
        }, { saveToHistory: false });
        break;

      case 'resize-n': // север, верхняя сторона
        newHeight = resizeInitialHeight.value - deltaY;
        newWidth = resizeInitialWidth.value;

        if (resizeKeepAspectRatio.value) {
          newWidth = newHeight * resizeAspectRatio.value;
        }

        newWidth = Math.max(20, newWidth);
        newHeight = Math.max(20, newHeight);

        newY = dragInitialY.value + (resizeInitialHeight.value - newHeight);
        newX = dragInitialX.value + (resizeInitialWidth.value - newWidth) / 2; // центрировать по горизонтали

        imagesStore.updateImage(dragObjectId.value, {
          width: newWidth,
          height: newHeight,
          x: newX,
          y: newY
        }, { saveToHistory: false });
        break;

      case 'resize-s': // юг, нижняя сторона
        newHeight = resizeInitialHeight.value + deltaY;
        newWidth = resizeInitialWidth.value;

        if (resizeKeepAspectRatio.value) {
          newWidth = newHeight * resizeAspectRatio.value;
        }

        newWidth = Math.max(20, newWidth);
        newHeight = Math.max(20, newHeight);

        newX = dragInitialX.value + (resizeInitialWidth.value - newWidth) / 2;

        imagesStore.updateImage(dragObjectId.value, {
          width: newWidth,
          height: newHeight,
          x: newX
        }, { saveToHistory: false });
        break;

      case 'resize-e': // восток, правая сторона
        newWidth = resizeInitialWidth.value + deltaX;
        newHeight = resizeInitialHeight.value;

        if (resizeKeepAspectRatio.value) {
          newHeight = newWidth / resizeAspectRatio.value;
        }

        newWidth = Math.max(20, newWidth);
        newHeight = Math.max(20, newHeight);

        newY = dragInitialY.value + (resizeInitialHeight.value - newHeight) / 2;

        imagesStore.updateImage(dragObjectId.value, {
          width: newWidth,
          height: newHeight,
          y: newY
        }, { saveToHistory: false });
        break;

      case 'resize-w': // запад, левая сторона
        newWidth = resizeInitialWidth.value - deltaX;
        newHeight = resizeInitialHeight.value;

        if (resizeKeepAspectRatio.value) {
          newHeight = newWidth / resizeAspectRatio.value;
        }

        newWidth = Math.max(20, newWidth);
        newHeight = Math.max(20, newHeight);

        newX = dragInitialX.value + (resizeInitialWidth.value - newWidth);
        newY = dragInitialY.value + (resizeInitialHeight.value - newHeight) / 2;

        imagesStore.updateImage(dragObjectId.value, {
          width: newWidth,
          height: newHeight,
          x: newX,
          y: newY
        }, { saveToHistory: false });
        break;
    }

    // Перерисовать canvas (если есть метод отрисовки)
    // TODO: вызвать метод перерисовки canvas
  } else if (currentInteractionType.value === 'rotate') {
    // Заглушка для rotate
    // TODO: реализовать в следующих пунктах
  }

  event.preventDefault();
};

/**
 * Обработчик события mouseup
 * @param {MouseEvent} event
 */
const handleMouseUp = (event) => {
  if (!isDragging.value) return;

  // Сохранить в историю финальное состояние
  if (dragObjectId.value) {
    const draggingObject = imagesStore.getImageById(dragObjectId.value);
    if (draggingObject) {
      if (currentInteractionType.value === 'move') {
        // Обновляем объект с сохранением в историю
        imagesStore.updateImage(
          dragObjectId.value,
          { x: draggingObject.x, y: draggingObject.y },
          { saveToHistory: true }
        );
      } else if (currentInteractionType.value?.startsWith('resize-')) {
        // Сохраняем финальные размеры и позицию после resize
        imagesStore.updateImage(
          dragObjectId.value,
          {
            width: draggingObject.width,
            height: draggingObject.height,
            x: draggingObject.x,
            y: draggingObject.y
          },
          { saveToHistory: true }
        );
      }
    }
  }

  // Сбросить состояние перетаскивания
  isDragging.value = false;
  dragObjectId.value = null;
  currentInteractionType.value = null;

  // Вернуть курсор по умолчанию
  const canvas = canvasRef.value;
  if (canvas) {
    canvas.style.cursor = 'default';
  }

  // Перерисовать canvas (финальная отрисовка)
  // TODO: вызвать метод финальной перерисовки canvas
};

/**
 * Обработчик события mouseleave
 * @param {MouseEvent} event
 */
const handleMouseLeave = (event) => {
  // Не завершаем перетаскивание при выходе за пределы canvas
  // Пользователь может вернуть курсор обратно
  // Можно добавить визуальный индикатор, что курсор вне canvas
  if (isDragging.value) {
    // TODO: добавить визуальный индикатор
  }
};

/**
 * Обработчик события keydown для клавиши Shift
 * @param {KeyboardEvent} event
 */
const handleKeyDown = (event) => {
  if (event.key === 'Shift' && isDragging.value && currentInteractionType.value?.startsWith('resize-')) {
    resizeKeepAspectRatio.value = false;
  }
};

/**
 * Обработчик события keyup для клавиши Shift
 * @param {KeyboardEvent} event
 */
const handleKeyUp = (event) => {
  if (event.key === 'Shift' && isDragging.value && currentInteractionType.value?.startsWith('resize-')) {
    resizeKeepAspectRatio.value = true;
  }
};

// Lifecycle hooks
onMounted(() => {
  // Привязываем обработчики к document
  document.addEventListener('mouseup', handleMouseUp);
  document.addEventListener('keydown', handleKeyDown);
  document.addEventListener('keyup', handleKeyUp);

  // Инициализация canvas
  const canvas = canvasRef.value;
  if (canvas) {
    // TODO: установить размеры canvas
    // canvas.width = ...
    // canvas.height = ...
  }
});

onBeforeUnmount(() => {
  // Удаляем обработчики из document
  document.removeEventListener('mouseup', handleMouseUp);
  document.removeEventListener('keydown', handleKeyDown);
  document.removeEventListener('keyup', handleKeyUp);
});
</script>

<style scoped>
.drawing-canvas-container {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
}

.drawing-canvas {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
