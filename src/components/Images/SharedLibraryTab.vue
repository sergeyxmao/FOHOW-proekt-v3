<script setup>
import { ref, computed, onMounted } from 'vue'
import { useStickersStore } from '../../stores/stickers'
import { getSharedLibrary } from '../../services/imageService'
import ImageCard from './ImageCard.vue'

const stickersStore = useStickersStore()

// Состояние
const folders = ref([])
const selectedFolderId = ref(null)
const searchQuery = ref('')
const isLoading = ref(false)
const error = ref(null)

// Вычисляемые свойства

/**
 * Изображения выбранной папки
 */
const currentFolderImages = computed(() => {
  if (!selectedFolderId.value) {
    // Если папка не выбрана, показываем все изображения из всех папок
    return folders.value.flatMap(folder => folder.images || [])
  }

  const folder = folders.value.find(f => f.id === selectedFolderId.value)
  return folder?.images || []
})

/**
 * Фильтрация изображений по поисковому запросу
 */
const filteredImages = computed(() => {
  if (!searchQuery.value.trim()) {
    return currentFolderImages.value
  }

  const query = searchQuery.value.toLowerCase()
  return currentFolderImages.value.filter(img => {
    const name = (img.original_name || img.filename || '').toLowerCase()
    const authorName = (img.author_full_name || '').toLowerCase()
    const authorId = (img.author_personal_id || '').toLowerCase()

    return name.includes(query) ||
           authorName.includes(query) ||
           authorId.includes(query)
  })
})

/**
 * Опции для выпадающего списка папок
 */
const folderOptions = computed(() => {
  return [
    { value: null, label: 'Все папки' },
    ...folders.value.map(folder => ({
      value: folder.id,
      label: folder.name
    }))
  ]
})

// Методы

/**
 * Загрузить структуру общей библиотеки
 */
async function loadSharedLibrary() {
  isLoading.value = true
  error.value = null

  try {
    const response = await getSharedLibrary()
    folders.value = response.folders || []

    console.log('✅ Общая библиотека загружена:', folders.value)
  } catch (err) {
    console.error('Ошибка загрузки общей библиотеки:', err)
    error.value = err

    // Обработка специфической ошибки доступа
    if (err.code === 'IMAGE_LIBRARY_ACCESS_DENIED') {
      // Ошибка доступа будет показана в UI
    } else {
      alert(`Ошибка загрузки общей библиотеки: ${err.message}`)
    }
  } finally {
    isLoading.value = false
  }
}

/**
 * Обработчик изменения выбранной папки
 */
function handleFolderChange() {
  console.log('📁 Выбрана папка:', selectedFolderId.value)
}

/**
 * Добавить изображение на доску
 */
function handleImageClick(image) {
  if (!stickersStore.currentBoardId) {
    alert('Сначала откройте доску')
    return
  }

  // Включаем режим размещения
  stickersStore.enablePlacementMode()

  // Сохраняем данные изображения для последующего создания стикера
  stickersStore.pendingImageData = {
    type: 'image',
    url: image.public_url,
    width: image.width || 200,
    height: image.height || 150
  }

  console.log('📌 Режим размещения изображения активирован:', image)
}

// Жизненный цикл
onMounted(async () => {
  await loadSharedLibrary()
})
</script>

<template>
  <div class="shared-library-tab">
    <!-- Верхняя панель управления -->
    <div class="shared-library-tab__controls">
      <!-- Выпадающий список папок -->
      <select
        v-model="selectedFolderId"
        class="shared-library-tab__select"
        @change="handleFolderChange"
      >
        <option
          v-for="option in folderOptions"
          :key="option.value"
          :value="option.value"
        >
          {{ option.label }}
        </option>
      </select>
    </div>

    <!-- Поле поиска -->
    <div class="shared-library-tab__search">
      <input
        v-model="searchQuery"
        type="text"
        class="shared-library-tab__search-input"
        placeholder="Поиск по имени файла, автору..."
      />
    </div>

    <!-- Индикатор загрузки -->
    <div v-if="isLoading" class="shared-library-tab__loading">
      Загрузка общей библиотеки...
    </div>

    <!-- Ошибка доступа -->
    <div v-else-if="error && error.code === 'IMAGE_LIBRARY_ACCESS_DENIED'" class="shared-library-tab__access-denied">
      <div class="shared-library-tab__access-denied-icon">
        🔒
      </div>
      <p class="shared-library-tab__access-denied-title">
        Доступ ограничен
      </p>
      <p class="shared-library-tab__access-denied-text">
        {{ error.message }}
      </p>
      <p class="shared-library-tab__access-denied-hint">
        Обновите тариф для получения доступа к общей библиотеке изображений.
      </p>
    </div>

    <!-- Сетка изображений -->
    <div v-else-if="filteredImages.length > 0" class="shared-library-tab__grid">
      <ImageCard
        v-for="image in filteredImages"
        :key="image.id"
        :image="image"
        :is-my-library="false"
        @click="handleImageClick"
      />
    </div>

    <!-- Пустое состояние -->
    <div v-else-if="!isLoading && !error" class="shared-library-tab__empty">
      <p class="shared-library-tab__empty-text">
        {{ searchQuery ? 'Изображения не найдены' : 'Общая библиотека пуста' }}
      </p>
      <p v-if="!searchQuery" class="shared-library-tab__empty-hint">
        Пока нет изображений, одобренных администратором
      </p>
    </div>
  </div>
</template>

<style scoped>
.shared-library-tab {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 16px;
  gap: 16px;
}

.shared-library-tab__controls {
  display: flex;
  gap: 12px;
}

.shared-library-tab__select {
  flex: 1;
  padding: 10px 12px;
  border: 1px solid rgba(15, 23, 42, 0.12);
  border-radius: 6px;
  background: #ffffff;
  font-size: 14px;
  color: #0f172a;
  cursor: pointer;
  transition: all 0.2s ease;
}

.shared-library-tab__select:hover {
  border-color: rgba(15, 23, 42, 0.24);
}

.shared-library-tab__select:focus {
  outline: none;
  border-color: #2196f3;
  box-shadow: 0 0 0 3px rgba(33, 150, 243, 0.1);
}

.shared-library-tab__search {
  display: flex;
}

.shared-library-tab__search-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid rgba(15, 23, 42, 0.12);
  border-radius: 6px;
  background: #ffffff;
  font-size: 14px;
  color: #0f172a;
  transition: all 0.2s ease;
}

.shared-library-tab__search-input:focus {
  outline: none;
  border-color: #2196f3;
  box-shadow: 0 0 0 3px rgba(33, 150, 243, 0.1);
}

.shared-library-tab__search-input::placeholder {
  color: #94a3b8;
}

.shared-library-tab__loading {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #64748b;
  font-size: 14px;
}

.shared-library-tab__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 16px;
  flex: 1;
  overflow-y: auto;
}

.shared-library-tab__empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
}

.shared-library-tab__empty-text {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 600;
  color: #0f172a;
}

.shared-library-tab__empty-hint {
  margin: 0;
  font-size: 14px;
  color: #64748b;
}

/* Access Denied State */
.shared-library-tab__access-denied {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
}

.shared-library-tab__access-denied-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.shared-library-tab__access-denied-title {
  margin: 0 0 8px;
  font-size: 18px;
  font-weight: 600;
  color: #0f172a;
}

.shared-library-tab__access-denied-text {
  margin: 0 0 12px;
  font-size: 14px;
  color: #64748b;
  line-height: 1.5;
}

.shared-library-tab__access-denied-hint {
  margin: 0;
  font-size: 13px;
  color: #94a3b8;
  line-height: 1.5;
}

/* Scrollbar */
.shared-library-tab__grid::-webkit-scrollbar {
  width: 8px;
}

.shared-library-tab__grid::-webkit-scrollbar-track {
  background: transparent;
}

.shared-library-tab__grid::-webkit-scrollbar-thumb {
  background: rgba(15, 23, 42, 0.2);
  border-radius: 4px;
}

.shared-library-tab__grid::-webkit-scrollbar-thumb:hover {
  background: rgba(15, 23, 42, 0.3);
}
</style>
