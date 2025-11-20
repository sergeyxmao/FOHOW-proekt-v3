<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useStickersStore } from '../../stores/stickers'
import { useBoardStore } from '../../stores/board'
import { useNotificationsStore } from '../../stores/notifications'
import { getSharedLibrary } from '../../services/imageService'
import ImageCard from './ImageCard.vue'

const stickersStore = useStickersStore()
const boardStore = useBoardStore()
const notificationsStore = useNotificationsStore()

// Состояние
const folders = ref([])
const images = ref([])  
const selectedFolderId = ref(null)
const searchQuery = ref('')
const isInitialLoading = ref(false)
const isLoadingMore = ref(false)
const hasMore = ref(true)
const error = ref(null)
const pagination = ref({
  page: 1,
  limit: 40,
  total: 0
})
const scrollContainerRef = ref(null)
  const error = ref(null)

// Вычисляемые свойства

/**
 * Изображения выбранной папки
 */
const currentFolderImages = computed(() => {
  if (!selectedFolderId.value) {
    return images.value
  }

  return images.value.filter(img => {
    const folderId = img.folder_id ?? img.folderId ?? img.folder?.id ?? null
    return folderId === selectedFolderId.value
  })
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
  const optionsMap = new Map()

  folders.value.forEach(folder => {
    if (folder?.id !== undefined && folder?.id !== null) {
      optionsMap.set(folder.id, folder.name)
    }
  })

  images.value.forEach(img => {
    const folderId = img.folder_id ?? img.folderId ?? img.folder?.id
    const folderName = img.folder_name ?? img.folderName ?? img.folder?.name

    if (folderId !== undefined && folderId !== null && !optionsMap.has(folderId)) {
      optionsMap.set(folderId, folderName || 'Без названия')
    }
  })
  
  return [
    { value: null, label: 'Все папки' },
    ...Array.from(optionsMap.entries()).map(([value, label]) => ({ value, label: label || 'Без названия' }))

  ]
})
function normalizeSharedImage(image, folderContext = null) {
  if (!image || typeof image !== 'object') return {}

  return {
    ...image,
    folder_id: image.folder_id ?? image.folderId ?? image.folder?.id ?? folderContext?.id ?? null,
    folder_name: image.folder_name ?? image.folderName ?? image.folder?.name ?? folderContext?.name ?? null
  }
}

function normalizeSharedItems(response) {
  const responseItems = Array.isArray(response?.items) ? response.items : []
  const responseFolders = Array.isArray(response?.folders) ? response.folders : []

  const fromItems = responseItems.map(item => normalizeSharedImage(item))
  const fromFolders = responseFolders.flatMap(folder =>
    (folder.images || []).map(image => normalizeSharedImage(image, folder))
  )

  return fromItems.length ? fromItems : fromFolders
}

// Методы

/**
 * Загрузить первую страницу общей библиотеки
 */
async function loadSharedLibrary() {
  error.value = null
  images.value = []
  folders.value = []
  hasMore.value = true
  pagination.value.page = 1
  isInitialLoading.value = true
  try {
    const response = await getSharedLibrary({
      page: pagination.value.page,
      limit: pagination.value.limit
    })

    const responsePagination = response?.pagination || {}
    const responseFolders = Array.isArray(response?.folders) ? response.folders : []
    const fetchedItems = normalizeSharedItems(response)

    folders.value = responseFolders
    images.value = fetchedItems
    pagination.value = {
      ...pagination.value,
      page: responsePagination.page ?? pagination.value.page,
      limit: responsePagination.limit ?? pagination.value.limit,
      total: responsePagination.total ?? fetchedItems.length
    }

    if (fetchedItems.length < pagination.value.limit) {
      hasMore.value = false
    }

    console.log('✅ Общая библиотека загружена:', fetchedItems.length)
  } catch (err) {
    console.error('Ошибка загрузки общей библиотеки:', err)
    images.value = []
    hasMore.value = false    
    error.value = err

    // Обработка специфической ошибки доступа
    if (err.code === 'IMAGE_LIBRARY_ACCESS_DENIED') {
      // Ошибка доступа будет показана в UI
    } else {
      notificationsStore.addNotification({
        message: `Ошибка загрузки общей библиотеки: ${err.message}`,
        type: 'error',
        duration: 6000
      })
    }
  } finally {
    isInitialLoading.value = false
  }
}

/**
 * Дозагрузить следующую страницу общей библиотеки
 */
async function loadMoreSharedImages() {
  if (!hasMore.value || isInitialLoading.value || isLoadingMore.value) {
    return
  }

  isLoadingMore.value = true
  const previousPage = pagination.value.page
  pagination.value = {
    ...pagination.value,
    page: previousPage + 1
  }

  try {
    const response = await getSharedLibrary({
      page: pagination.value.page,
      limit: pagination.value.limit
    })

    const fetchedItems = normalizeSharedItems(response)
    images.value = [...images.value, ...fetchedItems]

    if (fetchedItems.length < pagination.value.limit) {
      hasMore.value = false
    }
  } catch (err) {
    console.error('Ошибка загрузки следующей страницы общей библиотеки:', err)
    pagination.value.page = previousPage

    notificationsStore.addNotification({
      message: `Ошибка загрузки общей библиотеки: ${err.message}`,
      type: 'error',
      duration: 6000
    })
  } finally {
    isLoadingMore.value = false
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
async function handleImageClick(image) {
  // Проверяем все возможные источники boardId
  const boardId = stickersStore.currentBoardId || boardStore.currentBoardId

  if (!boardId) {
    console.log('❌ Board ID не найден:', {
      stickersStore: stickersStore.currentBoardId,
      boardStore: boardStore.currentBoardId
    })
    notificationsStore.addNotification({
      message: 'Сначала откройте доску',
      type: 'info',
      duration: 4000
    })
    return
  }

  console.log('✅ Добавление изображения на доску:', boardId, 'image:', image.id)

  // Включаем режим размещения
  stickersStore.enablePlacementMode()

  // Сохраняем данные изображения для последующего создания стикера
  stickersStore.pendingImageData = {
    type: 'image',
    imageId: image.id, // ID изображения из библиотеки
    width: image.width || 200,
    height: image.height || 150,
    dataUrl: image.url || image.preview_url || image.thumbnail
  }

  console.log('📌 Pending image data установлен, режим размещения активирован')
}
function handleScroll() {
  const container = scrollContainerRef.value
  if (!container) return

  const { scrollHeight, scrollTop, clientHeight } = container
  const threshold = 200
  const distanceToBottom = scrollHeight - scrollTop - clientHeight

  if (distanceToBottom <= threshold) {
    loadMoreSharedImages()
  }
}

function resetState() {
  images.value = []
  folders.value = []
  pagination.value = { ...pagination.value, page: 1, total: 0 }
  hasMore.value = true
  isInitialLoading.value = false
  isLoadingMore.value = false
  error.value = null
}

defineExpose({
  resetState
})

// Жизненный цикл
onMounted(async () => {
  await loadSharedLibrary()

  await nextTick()
  const container = scrollContainerRef.value
  if (container) {
    container.addEventListener('scroll', handleScroll)
  }
})

onBeforeUnmount(() => {
  const container = scrollContainerRef.value
  if (container) {
    container.removeEventListener('scroll', handleScroll)
  }  
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
    <div v-if="isInitialLoading" class="shared-library-tab__loading">
      <div class="shared-library-tab__spinner"></div>
      <span>Загрузка общей библиотеки...</span>
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
    <div
      v-else-if="filteredImages.length > 0"
      ref="scrollContainerRef"
      class="shared-library-tab__grid"
    >
      <ImageCard
        v-for="image in filteredImages"
        :key="image.id"
        :image="image"
        :is-my-library="false"
        @click="handleImageClick"
      />
    </div>
    <div v-if="filteredImages.length > 0" class="shared-library-tab__footer">
      <div v-if="isLoadingMore" class="shared-library-tab__loading-more">
        <div class="shared-library-tab__spinner shared-library-tab__spinner--small"></div>
        <span>Загружаем ещё...</span>
      </div>
      <div v-else-if="!hasMore" class="shared-library-tab__no-more">
        Больше изображений нет
      </div>
    <
    <!-- Пустое состояние -->
    <div v-else-if="!isInitialLoading && !error" class="shared-library-tab__empty">
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
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  color: #64748b;
  font-size: 14px;
}

.shared-library-tab__spinner {
  width: 48px;
  height: 48px;
  border: 4px solid rgba(33, 150, 243, 0.1);
  border-top-color: #2196f3;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.shared-library-tab__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-auto-rows: var(--images-grid-card-height, 190px);
  gap: 8px;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  align-content: start;
}
.shared-library-tab__footer {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 32px;
  color: #64748b;
  font-size: 13px;
}

.shared-library-tab__loading-more {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.shared-library-tab__spinner--small {
  width: 20px;
  height: 20px;
  border-width: 3px;
}

.shared-library-tab__no-more {
  color: #94a3b8;
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
