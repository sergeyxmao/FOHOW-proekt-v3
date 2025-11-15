/**
 * Примеры использования useDrawingStore
 *
 * Этот файл демонстрирует, как использовать store для управления объектами на доске
 */

import { useDrawingStore } from './drawing'

// === Пример 1: Добавление объекта ===
function example1() {
  const drawingStore = useDrawingStore()

  // Добавить новый объект (например, изображение)
  const newImage = {
    id: 'img-1',
    type: 'image',
    dataUrl: 'data:image/png;base64,...',
    x: 100,
    y: 100,
    width: 200,
    height: 150,
    zIndex: 1,
    rotation: 0
  }

  drawingStore.addObject(newImage)
  // Объект автоматически становится выбранным
  console.log(drawingStore.selectedObjectId) // 'img-1'
}

// === Пример 2: Обновление объекта ===
function example2() {
  const drawingStore = useDrawingStore()

  // Переместить объект
  drawingStore.updateObject({
    id: 'img-1',
    updates: {
      x: 300,
      y: 250
    }
  })

  // Изменить размер и поворот
  drawingStore.updateObject({
    id: 'img-1',
    updates: {
      width: 300,
      height: 200,
      rotation: 45
    }
  })
}

// === Пример 3: Работа с выделением ===
function example3() {
  const drawingStore = useDrawingStore()

  // Выбрать объект
  drawingStore.selectObject('img-1')

  // Получить выбранный объект
  const selected = drawingStore.selectedObject
  console.log(selected) // { id: 'img-1', ... }

  // Снять выделение со всех объектов
  drawingStore.deselectAll()
}

// === Пример 4: Управление Z-индексом ===
function example4() {
  const drawingStore = useDrawingStore()

  // Переместить объект на передний план
  drawingStore.bringToFront('img-1')

  // Переместить объект на задний план
  drawingStore.sendToBack('img-2')

  // Переместить на один уровень вперед
  drawingStore.bringForward('img-3')

  // Переместить на один уровень назад
  drawingStore.sendBackward('img-3')

  // Получить отсортированные объекты (по zIndex)
  const sorted = drawingStore.sortedObjects
  console.log(sorted) // [obj1, obj2, obj3] отсортированы по zIndex
}

// === Пример 5: Удаление объектов ===
function example5() {
  const drawingStore = useDrawingStore()

  // Удалить конкретный объект
  drawingStore.removeObject('img-1')

  // Удалить все выбранные объекты
  const count = drawingStore.removeSelectedObjects()
  console.log(`Удалено объектов: ${count}`)
}

// === Пример 6: Поиск объектов ===
function example6() {
  const drawingStore = useDrawingStore()

  // Получить объект по ID
  const obj = drawingStore.getObjectById('img-1')

  // Получить все объекты определенного типа
  const images = drawingStore.getObjectsByType('image')
  const shapes = drawingStore.getObjectsByType('shape')

  console.log(`Всего изображений: ${images.length}`)
  console.log(`Всего фигур: ${shapes.length}`)
}

// === Пример 7: Дублирование объекта ===
function example7() {
  const drawingStore = useDrawingStore()

  // Дублировать объект со смещением по умолчанию (20, 20)
  const duplicate = drawingStore.duplicateObject('img-1')

  // Дублировать с пользовательским смещением
  const duplicate2 = drawingStore.duplicateObject('img-1', { x: 50, y: 50 })
}

// === Пример 8: Загрузка и экспорт ===
function example8() {
  const drawingStore = useDrawingStore()

  // Загрузить объекты из сохраненных данных
  const savedData = [
    { id: 'obj-1', type: 'image', x: 100, y: 100 },
    { id: 'obj-2', type: 'shape', x: 200, y: 200 }
  ]
  drawingStore.loadObjects(savedData)

  // Получить объекты для экспорта (без служебных полей)
  const exportData = drawingStore.getObjectsForExport()
  console.log(exportData) // Массив объектов без поля isSelected
}

// === Пример 9: Использование геттеров ===
function example9() {
  const drawingStore = useDrawingStore()

  // Проверить, есть ли выбранные объекты
  if (drawingStore.hasSelectedObjects) {
    console.log('Есть выбранные объекты')
  }

  // Получить все выбранные объекты
  const selected = drawingStore.selectedObjects
  console.log(`Выбрано объектов: ${selected.length}`)

  // Получить выбранный объект (один)
  const currentlySelected = drawingStore.selectedObject
  if (currentlySelected) {
    console.log(`Выбран: ${currentlySelected.id}`)
  }
}

// === Пример 10: Использование в компоненте Vue ===
function example10InVueComponent() {
  // В Vue компоненте:
  /*
  <script setup>
  import { useDrawingStore } from '@/stores/drawing'

  const drawingStore = useDrawingStore()

  // Добавить новый объект при клике
  function handleAddImage(imageData) {
    drawingStore.addObject({
      type: 'image',
      dataUrl: imageData.url,
      x: imageData.x,
      y: imageData.y,
      width: imageData.width,
      height: imageData.height,
      zIndex: 0
    })
  }

  // Обработать перетаскивание
  function handleDrag(objectId, newX, newY) {
    drawingStore.updateObject({
      id: objectId,
      updates: { x: newX, y: newY }
    })
  }

  // Удалить выбранные объекты при нажатии Delete
  function handleDelete() {
    drawingStore.removeSelectedObjects()
  }
  </script>

  <template>
    <div class="canvas">
      <div
        v-for="obj in drawingStore.sortedObjects"
        :key="obj.id"
        :class="{ selected: obj.isSelected }"
        @click="drawingStore.selectObject(obj.id)"
      >
        <!-- Рендер объекта -->
      </div>
    </div>
  </template>
  */
}

export {
  example1,
  example2,
  example3,
  example4,
  example5,
  example6,
  example7,
  example8,
  example9,
  example10InVueComponent
}
