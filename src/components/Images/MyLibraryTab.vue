<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useStickersStore } from '../../stores/stickers'
import { getMyFolders, getMyImages, uploadImage, deleteImage, requestShareImage } from '../../services/imageService'
import { convertToWebP, isImageFile } from '../../utils/imageUtils'
import ImageCard from './ImageCard.vue'

const stickersStore = useStickersStore()

// Состояние
const folders = ref([])
const selectedFolder = ref('')
const searchQuery = ref('')
const images = ref([])
const isLoading = ref(false)
const pagination = ref({
  page: 1,
  limit: 20,
  total: 0
})

// Локальное состояние для загрузки файлов
const isUploading = ref(false)
const fileInputRef = ref(null)

// Вычисляемые свойства

// Фильтрация изображений по поисковому запросу (локально)
const filteredImages = computed(() => {
  if (!searchQuery.value.trim()) {
    return images.value
  }

  const query = searchQuery.value.toLowerCase()
  return images.value.filter(img => {
    const name = (img.original_name || img.filename || '').toLowerCase()
    return name.includes(query)
  })
})

// Опции для выпадающего списка папок
const folderOptions = computed(() => {
  return [
    { value: '', label: 'Все папки' },
    ...folders.value.map(folder => ({ value: folder, label: folder }))
  ]
})

// Методы

/**
 * Загрузить список папок
 */
async function loadFolders() {
  try {
    folders.value = await getMyFolders()
  } catch (error) {
    console.error('Ошибка загрузки папок:', error)
    alert(`Ошибка загрузки папок: ${error.message}`)
  }
}

/**
 * Загрузить список изображений
 */
async function loadImages() {
  isLoading.value = true

  try {
    const response = await getMyImages({
      page: pagination.value.page,
      limit: pagination.value.limit,
      folder: selectedFolder.value || null
    })

    images.value = response.items || []
    pagination.value = {
      ...pagination.value,
      total: response.pagination.total
    }
  } catch (error) {
    console.error('Ошибка загрузки изображений:', error)
    alert(`Ошибка загрузки изображений: ${error.message}`)
  } finally {
    isLoading.value = false
  }
}

/**
 * Обработчик изменения выбранной папки
 */
function handleFolderChange() {
  pagination.value.page = 1
  loadImages()
}

/**
 * Открыть диалог выбора файлов
 */
function openFileDialog() {
  fileInputRef.value?.click()
}

/**
 * Обработчик выбора файлов
 */
async function handleFileSelect(event) {
  const files = Array.from(event.target.files || [])

  if (files.length === 0) return

  // Обрабатываем каждый файл по очереди
  for (const file of files) {
    await uploadSingleImage(file)
  }

  // Очищаем input для возможности повторной загрузки того же файла
  if (fileInputRef.value) {
    fileInputRef.value.value = ''
  }
}

/**
 * Загрузить одно изображение
 */
async function uploadSingleImage(file) {
  // Проверка типа файла
  if (!isImageFile(file)) {
    alert(`Файл "${file.name}" не является изображением`)
    return
  }

  isUploading.value = true

  try {
    // Конвертируем в WebP
    const { blob, width, height } = await convertToWebP(file, 0.9, 2048, 2048)

    // Определяем имя файла для WebP
    const originalName = file.name.replace(/\.[^/.]+$/, '') + '.webp'

    // Загружаем на сервер
    const newImage = await uploadImage({
      file: blob,
      originalName,
      folder: selectedFolder.value || null,
      width,
      height
    })

    // Добавляем новое изображение в начало списка
    images.value.unshift(newImage)

    // Обновляем счётчик
    pagination.value.total++

    // Обновляем список папок, если была выбрана новая папка
    if (selectedFolder.value && !folders.value.includes(selectedFolder.value)) {
      folders.value.push(selectedFolder.value)
      folders.value.sort()
    }

    console.log('✅ Изображение успешно загружено:', newImage)
  } catch (error) {
    console.error('Ошибка загрузки изображения:', error)

    // Обработка специфических ошибок лимитов
    if (error.code === 'FILE_SIZE_LIMIT_EXCEEDED' ||
        error.code === 'IMAGE_COUNT_LIMIT_EXCEEDED' ||
        error.code === 'STORAGE_LIMIT_EXCEEDED') {
      alert(error.message + '\n\nОбновите тариф для увеличения лимитов.')
    } else {
      alert(`Ошибка загрузки изображения "${file.name}": ${error.message}`)
    }
  } finally {
    isUploading.value = false
  }
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
  // Это будет обработано в компоненте CanvasBoard при клике на холст
  stickersStore.pendingImageData = {
    type: 'image',
    url: image.public_url,
    width: image.width || 200,
    height: image.height || 150
  }

  console.log('📌 Режим размещения изображения активирован:', image)
}

/**
 * Удалить изображение
 */
async function handleImageDelete(image) {
  if (!confirm(`Вы уверены, что хотите удалить изображение "${image.original_name}"?`)) {
    return
  }

  try {
    await deleteImage(image.id)

    // Удаляем из списка
    const index = images.value.findIndex(img => img.id === image.id)
    if (index !== -1) {
      images.value.splice(index, 1)
      pagination.value.total--
    }

    console.log('✅ Изображение успешно удалено:', image.id)
  } catch (error) {
    console.error('Ошибка удаления изображения:', error)

    if (error.code === 'IMAGE_IN_USE') {
      alert('Нельзя удалить: картинка используется на досках. Удалите её с досок и попробуйте снова.')
    } else {
      alert(`Ошибка удаления изображения: ${error.message}`)
    }
  }
}

/**
 * Отправить запрос на добавление в общую библиотеку
 */
async function handleShareRequest(image) {
  if (!confirm(`Отправить изображение "${image.original_name}" на модерацию для добавления в общую библиотеку?`)) {
    return
  }

  try {
    await requestShareImage(image.id)

    // Обновляем статус изображения локально
    const index = images.value.findIndex(img => img.id === image.id)
    if (index !== -1) {
      images.value[index] = {
        ...images.value[index],
        share_requested_at: new Date().toISOString()
      }
    }

    alert('Изображение успешно отправлено на модерацию!')
    console.log('✅ Запрос на модерацию отправлен:', image.id)
  } catch (error) {
    console.error('Ошибка отправки запроса:', error)

    if (error.code === 'ALREADY_REQUESTED') {
      alert('Изображение уже отправлено на модерацию')
    } else if (error.code === 'ALREADY_SHARED') {
      alert('Изображение уже находится в общей библиотеке')
    } else {
      alert(`Ошибка отправки запроса: ${error.message}`)
    }
  }
}

/**
 * Загрузить следующую страницу (пагинация)
 */
function loadNextPage() {
  const totalPages = Math.ceil(pagination.value.total / pagination.value.limit)
  if (pagination.value.page < totalPages) {
    pagination.value.page++
    loadImages()
  }
}

/**
 * Загрузить предыдущую страницу
 */
function loadPrevPage() {
  if (pagination.value.page > 1) {
    pagination.value.page--
    loadImages()
  }
}

// Жизненный цикл
onMounted(async () => {
  await loadFolders()
  await loadImages()
})

// Следим за изменениями currentBoardId
watch(() => stickersStore.currentBoardId, (newBoardId) => {
  console.log('📋 Текущая доска изменилась:', newBoardId)
})
</script>

<template>
  <div class="my-library-tab">
    <!-- Верхняя панель управления -->
    <div class="my-library-tab__controls">
      <!-- Выпадающий список папок -->
      <select
        v-model="selectedFolder"
        class="my-library-tab__select"
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

      <!-- Кнопка загрузки -->
      <button
        type="button"
        class="my-library-tab__upload-btn"
        :disabled="isUploading"
        @click="openFileDialog"
      >
        <svg v-if="!isUploading" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M9 16V10H5L12 3L19 10H15V16H9ZM5 20V18H19V20H5Z" fill="currentColor"/>
        </svg>
        <span v-if="isUploading">Загрузка...</span>
        <span v-else>Загрузить</span>
      </button>

      <!-- Скрытый input для выбора файлов -->
      <input
        ref="fileInputRef"
        type="file"
        accept="image/*"
        multiple
        style="display: none"
        @change="handleFileSelect"
      />
    </div>

    <!-- Поле поиска -->
    <div class="my-library-tab__search">
      <input
        v-model="searchQuery"
        type="text"
        class="my-library-tab__search-input"
        placeholder="Поиск по имени..."
      />
    </div>

    <!-- Индикатор загрузки -->
    <div v-if="isLoading" class="my-library-tab__loading">
      Загрузка изображений...
    </div>

    <!-- Сетка изображений -->
    <div v-else-if="filteredImages.length > 0" class="my-library-tab__grid">
      <ImageCard
        v-for="image in filteredImages"
        :key="image.id"
        :image="image"
        :is-my-library="true"
        @click="handleImageClick"
        @delete="handleImageDelete"
        @share-request="handleShareRequest"
      />
    </div>

    <!-- Пустое состояние -->
    <div v-else class="my-library-tab__empty">
      <p class="my-library-tab__empty-text">
        {{ searchQuery ? 'Изображения не найдены' : 'Нет изображений' }}
      </p>
      <p v-if="!searchQuery" class="my-library-tab__empty-hint">
        Нажмите "Загрузить", чтобы добавить изображения
      </p>
    </div>

    <!-- Пагинация -->
    <div v-if="!isLoading && images.length > 0" class="my-library-tab__pagination">
      <button
        type="button"
        class="my-library-tab__page-btn"
        :disabled="pagination.page === 1"
        @click="loadPrevPage"
      >
        Назад
      </button>

      <span class="my-library-tab__page-info">
        Страница {{ pagination.page }} из {{ Math.ceil(pagination.total / pagination.limit) }}
      </span>

      <button
        type="button"
        class="my-library-tab__page-btn"
        :disabled="pagination.page >= Math.ceil(pagination.total / pagination.limit)"
        @click="loadNextPage"
      >
        Вперёд
      </button>
    </div>
  </div>
</template>

<style scoped>
.my-library-tab {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 16px;
  gap: 16px;
}

.my-library-tab__controls {
  display: flex;
  gap: 12px;
}

.my-library-tab__select {
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

.my-library-tab__select:hover {
  border-color: rgba(15, 23, 42, 0.24);
}

.my-library-tab__select:focus {
  outline: none;
  border-color: #2196f3;
  box-shadow: 0 0 0 3px rgba(33, 150, 243, 0.1);
}

.my-library-tab__upload-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border: none;
  border-radius: 6px;
  background: #2196f3;
  color: white;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.my-library-tab__upload-btn svg {
  width: 18px;
  height: 18px;
}

.my-library-tab__upload-btn:hover:not(:disabled) {
  background: #1976d2;
}

.my-library-tab__upload-btn:active:not(:disabled) {
  transform: scale(0.98);
}

.my-library-tab__upload-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.my-library-tab__search {
  display: flex;
}

.my-library-tab__search-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid rgba(15, 23, 42, 0.12);
  border-radius: 6px;
  background: #ffffff;
  font-size: 14px;
  color: #0f172a;
  transition: all 0.2s ease;
}

.my-library-tab__search-input:focus {
  outline: none;
  border-color: #2196f3;
  box-shadow: 0 0 0 3px rgba(33, 150, 243, 0.1);
}

.my-library-tab__search-input::placeholder {
  color: #94a3b8;
}

.my-library-tab__loading {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #64748b;
  font-size: 14px;
}

.my-library-tab__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 16px;
  flex: 1;
  overflow-y: auto;
}

.my-library-tab__empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
}

.my-library-tab__empty-text {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 600;
  color: #0f172a;
}

.my-library-tab__empty-hint {
  margin: 0;
  font-size: 14px;
  color: #64748b;
}

.my-library-tab__pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding-top: 16px;
  border-top: 1px solid rgba(15, 23, 42, 0.08);
}

.my-library-tab__page-btn {
  padding: 8px 16px;
  border: 1px solid rgba(15, 23, 42, 0.12);
  border-radius: 6px;
  background: #ffffff;
  color: #0f172a;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.my-library-tab__page-btn:hover:not(:disabled) {
  background: rgba(15, 23, 42, 0.06);
  border-color: rgba(15, 23, 42, 0.24);
}

.my-library-tab__page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.my-library-tab__page-info {
  font-size: 14px;
  color: #64748b;
}

/* Scrollbar */
.my-library-tab__grid::-webkit-scrollbar {
  width: 8px;
}

.my-library-tab__grid::-webkit-scrollbar-track {
  background: transparent;
}

.my-library-tab__grid::-webkit-scrollbar-thumb {
  background: rgba(15, 23, 42, 0.2);
  border-radius: 4px;
}

.my-library-tab__grid::-webkit-scrollbar-thumb:hover {
  background: rgba(15, 23, 42, 0.3);
}
</style>
