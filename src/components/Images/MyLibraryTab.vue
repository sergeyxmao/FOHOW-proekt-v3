<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { useStickersStore } from '../../stores/stickers'
import { useBoardStore } from '../../stores/board'
import { useNotificationsStore } from '../../stores/notifications'
import { getMyFolders, getMyImages, uploadImage, deleteImage, requestShareImage, renameImage, createFolder } from '../../services/imageService'
import { convertToWebP, isImageFile } from '../../utils/imageUtils'
import ImageCard from './ImageCard.vue'

const stickersStore = useStickersStore()
const boardStore = useBoardStore()
const notificationsStore = useNotificationsStore()
const props = defineProps({
 placementTarget: {
    type: String,
    default: 'board'
  }
}) 
// Состояние
const folders = ref([])
const selectedFolder = ref('')
const searchQuery = ref('')
const images = ref([])
const error = ref(null)
const isCreateFolderModalOpen = ref(false)
const newFolderName = ref('')
const createFolderError = ref('')
const isCreatingFolder = ref(false)
const folderNameInputRef = ref(null) 
const pagination = ref({
  page: 1,
  limit: 40,
  total: 0
})
const isInitialLoading = ref(false)
const isLoadingMore = ref(false)
const hasMore = ref(true)
const gridRef = ref(null)
const gridWrapperRef = ref(null)
const indicatorRef = ref(null)  
const scrollContainerRef = gridRef
let hideTimeout = null

watch(newFolderName, () => {
  if (createFolderError.value) {
    createFolderError.value = ''
  }
})
 // Локальное состояние для загрузки файлов
const isUploading = ref(false)
const fileInputRef = ref(null)
function onWheel(e) {
  e.stopPropagation()

  const el = gridRef.value
  if (!el) return

  const atTop = el.scrollTop === 0
  const atBottom = el.scrollHeight - el.scrollTop === el.clientHeight

  if (!(atTop && e.deltaY < 0) && !(atBottom && e.deltaY > 0)) {
    return
  }

  e.preventDefault()
}

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
const folderOptions = computed(() => [
  { value: '', label: 'Все папки' },
  ...folders.value.map(folderName => ({
    value: folderName,
    label: folderName || 'Без названия'
  }))
])

// Методы

/**
 * Загрузить список папок
 */
async function loadFolders() {
  try {
    folders.value = await getMyFolders()
  } catch (err) {
    console.error('Ошибка загрузки папок:', err)

    // Обработка специфической ошибки доступа
    if (err.code === 'IMAGE_LIBRARY_ACCESS_DENIED') {
      error.value = err
      // Не показываем уведомление, ошибка отобразится в UI
    } else {
      notificationsStore.addNotification({
        message: `Ошибка загрузки папок: ${err.message}`,
        type: 'error',
        duration: 6000
      })
    }
  }
}

/**
 * Загрузить первую страницу изображений
 */
async function loadInitialImages() {
  pagination.value.page = 1
  images.value = []
  hasMore.value = true
  isInitialLoading.value = true

  try {
    const response = await getMyImages({
      page: pagination.value.page,
      limit: pagination.value.limit,
      folder: selectedFolder.value || null
    })
    const responsePagination = response?.pagination || {}
    const fetchedItems = Array.isArray(response?.items) ? response.items : []

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
  } catch (err) {
    console.error('Ошибка загрузки изображений:', err)
    images.value = []
    hasMore.value = false
    // Обработка специфической ошибки доступа
    if (err.code === 'IMAGE_LIBRARY_ACCESS_DENIED') {
      error.value = err
      // Не показываем уведомление, ошибка отобразится в UI
    } else {
      notificationsStore.addNotification({
        message: `Ошибка загрузки изображений: ${err.message}`,
        type: 'error',
        duration: 6000
      })
    }
  } finally {
    isInitialLoading.value = false
  }
}

/**
 * Дозагрузить следующую страницу изображений
 */
async function loadMoreImages() {
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
    const response = await getMyImages({
      page: pagination.value.page,
      limit: pagination.value.limit,
      folder: selectedFolder.value || null
    })

    const fetchedItems = Array.isArray(response?.items) ? response.items : []
    images.value = [...images.value, ...fetchedItems]

    if (fetchedItems.length < pagination.value.limit) {
      hasMore.value = false
    }
  } catch (err) {
    console.error('Ошибка загрузки следующей страницы:', err)
    pagination.value.page = previousPage

    notificationsStore.addNotification({
      message: `Ошибка загрузки изображений: ${err.message}`,
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
  pagination.value.page = 1
  loadInitialImages()
}
/**
 * Создать новую папку
 */
function handleCreateFolder() {
  newFolderName.value = ''
  createFolderError.value = ''
  isCreateFolderModalOpen.value = true

  nextTick(() => {
    folderNameInputRef.value?.focus()
  })
}

function closeCreateFolderModal() {
  isCreateFolderModalOpen.value = false
  createFolderError.value = ''
  newFolderName.value = ''
}

async function confirmCreateFolder() {
  const trimmedName = newFolderName.value.trim()

  if (!trimmedName) {
    createFolderError.value = 'Введите название папки'
    return
  }

  const duplicate = folders.value.find(folder => folder.toLowerCase() === trimmedName.toLowerCase())
  if (duplicate) {
    createFolderError.value = 'Такая папка уже существует'
    selectedFolder.value = duplicate
    handleFolderChange()
    return
  }

  isCreatingFolder.value = true
  createFolderError.value = ''

  try {
    const createdFolder = await createFolder(trimmedName)
    const createdName = createdFolder?.folder?.name || createdFolder?.name || trimmedName
    await loadFolders()

    selectedFolder.value = createdName
    handleFolderChange()
    isCreateFolderModalOpen.value = false

    notificationsStore.addNotification({
      message: `Папка "${createdName}" создана`,
      type: 'success',
      duration: 4000
    })
  } catch (error) {
    createFolderError.value = error.message || 'Не удалось создать папку'

    notificationsStore.addNotification({
      message: `Ошибка создания папки: ${error.message}`,
      type: 'error',
      duration: 6000
    })
  } finally {
    isCreatingFolder.value = false
  }
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
    notificationsStore.addNotification({
      message: `Файл "${file.name}" не является изображением`,
      type: 'error',
      duration: 5000
    })
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

    notificationsStore.addNotification({
      message: `Изображение "${originalName}" успешно загружено`,
      type: 'success',
      duration: 4000
    })

    console.log('✅ Изображение успешно загружено:', newImage)
  } catch (error) {
    console.error('Ошибка загрузки изображения:', error)

    let errorMessage = `Ошибка загрузки изображения "${file.name}": ${error.message}`

    // Обработка специфических ошибок лимитов
    if (error.code === 'FILE_SIZE_LIMIT_EXCEEDED' ||
        error.code === 'IMAGE_COUNT_LIMIT_EXCEEDED' ||
        error.code === 'STORAGE_LIMIT_EXCEEDED' ||
        error.code === 'FILE_TOO_LARGE' ||
        error.code === 'RATE_LIMIT_EXCEEDED') {
      errorMessage = error.message + '\n\nОбновите тариф для увеличения лимитов.'
    }

    notificationsStore.addNotification({
      message: errorMessage,
      type: 'error',
      duration: 8000
    })
  } finally {
    isUploading.value = false
  }
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
  stickersStore.enablePlacementMode(props.placementTarget || 'board')

  // Сохраняем данные изображения для последующего создания стикера
  // Это будет обработано в компоненте CanvasBoard при клике на холст
  stickersStore.pendingImageData = {
    type: 'image',
    imageId: image.id, // ID изображения из библиотеки
    width: image.width || 200,
    height: image.height || 150,
    dataUrl: image.url || image.preview_url || image.thumbnail
  }

  console.log('📌 Pending image data установлен, режим размещения активирован')
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

    notificationsStore.addNotification({
      message: `Изображение "${image.original_name}" успешно удалено`,
      type: 'success',
      duration: 4000
    })

    console.log('✅ Изображение успешно удалено:', image.id)
  } catch (error) {
    console.error('Ошибка удаления изображения:', error)

    let errorMessage = `Ошибка удаления изображения: ${error.message}`

    if (error.code === 'IMAGE_IN_USE') {
      errorMessage = 'Нельзя удалить: картинка используется на досках. Удалите её с досок и попробуйте снова.'
    }

    notificationsStore.addNotification({
    })
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

    let errorMessage = `Ошибка отправки запроса: ${error.message}`

    if (error.code === 'ALREADY_REQUESTED') {
      errorMessage = 'Вы уже отправили это изображение на модерацию. Ожидайте решения администратора.'
    } else if (error.code === 'ALREADY_SHARED') {
      errorMessage = 'Это изображение уже находится в общей библиотеке.'
    }

    alert('Ошибка: ' + errorMessage)
  }
}
/**
 * Переименовать изображение
 */
async function handleRename(image) {
  const currentName = image.original_name.replace(/\.[^/.]+$/, '') // Убираем расширение
  const newName = prompt(`Введите новое имя для изображения:`, currentName)

  if (!newName || newName.trim() === '') {
    return
  }

  if (newName.trim() === currentName) {
    notificationsStore.addNotification({
      message: 'Имя не изменилось',
      type: 'info',
      duration: 3000
    })
    return
  }

  try {
    await renameImage(image.id, newName.trim())

    // Обновляем имя изображения локально
    const index = images.value.findIndex(img => img.id === image.id)
    if (index !== -1) {
      const extension = image.original_name.match(/\.[^/.]+$/)?.[0] || '.webp'
      images.value[index] = {
        ...images.value[index],
        original_name: newName.trim() + extension
      }
    }

    notificationsStore.addNotification({
      message: `Изображение успешно переименовано в "${newName}"`,
      type: 'success',
      duration: 4000
    })

    console.log('✅ Изображение успешно переименовано:', image.id)
  } catch (error) {
    console.error('Ошибка переименования изображения:', error)

    notificationsStore.addNotification({
      message: `Ошибка переименования: ${error.message}`,
      type: 'error',
      duration: 6000
    })
  }
}
function updateIndicator() {
  const el = gridRef.value
  const ind = indicatorRef.value
  if (!el || !ind) return

  const maxScroll = el.scrollHeight - el.clientHeight
  if (maxScroll <= 0 || el.scrollTop <= 0) {
    ind.style.opacity = 0
    return
  }

  const scrollTop = el.scrollTop
  const ratio = scrollTop / maxScroll

  const indicatorHeight = Math.max(20, el.clientHeight * (el.clientHeight / el.scrollHeight))
  const maxYOffset = el.clientHeight - indicatorHeight

  const yOffset = ratio * maxYOffset

  ind.style.height = indicatorHeight + 'px'
  ind.style.transform = `translateY(${yOffset}px)`
}

function onScroll() {
  const el = gridRef.value
  const ind = indicatorRef.value

  updateIndicator()

  if (!el || !ind) return

  const maxScroll = el.scrollHeight - el.clientHeight
  if (maxScroll <= 0 || el.scrollTop <= 0) {
    ind.style.opacity = 0
    return
  }

  ind.style.opacity = 1

  clearTimeout(hideTimeout)
  hideTimeout = setTimeout(() => {
    ind.style.opacity = 0
  }, 600)
}  
function handleScroll() {
  const container = scrollContainerRef.value
  if (!container) return

  const { scrollHeight, scrollTop, clientHeight } = container
  const threshold = 200
  const distanceToBottom = scrollHeight - scrollTop - clientHeight

  if (distanceToBottom <= threshold) {
    loadMoreImages()
  }
}

function resetState() {
  images.value = []
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
  await Promise.all([
    loadFolders(),
    loadInitialImages()
  ])

  await nextTick()
  const container = scrollContainerRef.value
  if (container) {
    container.addEventListener('scroll', handleScroll)
    container.addEventListener('scroll', onScroll)
    updateIndicator()    
  }
})

onBeforeUnmount(() => {
  const container = scrollContainerRef.value
  if (container) {
    container.removeEventListener('scroll', handleScroll)
    container.removeEventListener('scroll', onScroll)
  }
  clearTimeout(hideTimeout)
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
          :key="option.value || 'all'"
          :value="option.value"
        >
          {{ option.label }}
        </option>
      </select>

      <!-- Кнопка создания папки -->
      <button
        type="button"
        class="my-library-tab__create-folder"
        @click="handleCreateFolder"
      >
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M10 4H4C2.89543 4 2 4.89543 2 6V18C2 19.1046 2.89543 20 4 20H20C21.1046 20 22 19.1046 22 18V8C22 6.89543 21.1046 6 20 6H12L10 4Z"
            fill="currentColor"
            fill-opacity="0.12"
          />
          <path
            d="M12 11V15M10 13H14"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <span>Папка</span>
      </button>

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
    <div
      v-if="isCreateFolderModalOpen"
      class="my-library-tab__modal-backdrop"
      @click.self="closeCreateFolderModal"
    >
      <div class="my-library-tab__modal">
        <header class="my-library-tab__modal-header">
          <h3>Создать новую папку</h3>
          <button class="my-library-tab__modal-close" @click="closeCreateFolderModal" aria-label="Закрыть диалог">
            ×
          </button>
        </header>

        <div class="my-library-tab__modal-body">
          <label class="my-library-tab__modal-label" for="my-library-folder-name">Название папки</label>
          <input
            id="my-library-folder-name"
            ref="folderNameInputRef"
            v-model="newFolderName"
            type="text"
            maxlength="255"
            class="my-library-tab__modal-input"
            placeholder="Введите название"
            @keyup.enter="confirmCreateFolder"
          />
          <p v-if="createFolderError" class="my-library-tab__modal-error">{{ createFolderError }}</p>
        </div>

        <footer class="my-library-tab__modal-footer">
          <button type="button" class="my-library-tab__modal-btn my-library-tab__modal-btn--secondary" @click="closeCreateFolderModal">
            Отмена
          </button>
          <button
            type="button"
            class="my-library-tab__modal-btn my-library-tab__modal-btn--primary"
            :disabled="isCreatingFolder || !newFolderName.trim()"
            @click="confirmCreateFolder"
          >
            {{ isCreatingFolder ? 'Создание...' : 'Создать' }}
          </button>
        </footer>
      </div>
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
    <div v-if="isInitialLoading" class="my-library-tab__loading">
      <div class="my-library-tab__spinner"></div>
      <span>Загрузка изображений...</span>
    </div>

    <!-- Ошибка доступа -->
    <div v-else-if="error && error.code === 'IMAGE_LIBRARY_ACCESS_DENIED'" class="my-library-tab__access-denied">
      <div class="my-library-tab__access-denied-icon">
        🔒
      </div>
      <p class="my-library-tab__access-denied-title">
        Библиотека изображений недоступна на текущем тарифе
      </p>
      <p class="my-library-tab__access-denied-text">
        {{ error.message }}
      </p>
      <p class="my-library-tab__access-denied-hint">
        Обновите тариф для получения доступа к библиотеке изображений.
      </p>
    </div>

    <!-- Сетка изображений -->
    <div v-else-if="filteredImages.length > 0" class="images-scroll-wrapper" ref="gridWrapperRef">
      <div class="scroll-indicator" ref="indicatorRef" />
      <div
        ref="gridRef"
        class="my-library-tab__grid"
        @wheel.stop="onWheel"
      >
        <ImageCard
          v-for="image in filteredImages"
          :key="image.id"
          :image="image"
          :is-my-library="true"
          @click="handleImageClick"
          @delete="handleImageDelete"
          @share-request="handleShareRequest"
          @rename="handleRename"         
        />
      </div>
    </div>
    <div v-if="filteredImages.length > 0" class="my-library-tab__footer">
      <div v-if="isLoadingMore" class="my-library-tab__loading-more">
        <div class="my-library-tab__spinner my-library-tab__spinner--small"></div>
        <span>Загружаем ещё...</span>
      </div>
      <div v-else-if="!hasMore" class="my-library-tab__no-more">
        Больше изображений нет
      </div>
    </div>
    <!-- Пустое состояние -->
    <div v-else-if="!error" class="my-library-tab__empty">
      <p class="my-library-tab__empty-text">
        {{ searchQuery ? 'Изображения не найдены' : 'Нет изображений' }}
      </p>
      <p v-if="!searchQuery" class="my-library-tab__empty-hint">
        Нажмите "Загрузить", чтобы добавить изображения
      </p>
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

.my-library-tab__select::placeholder {
  color: #94a3b8;
}
.my-library-tab__create-folder {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 12px;
  border: 1px solid rgba(15, 23, 42, 0.14);
  border-radius: 6px;
  background: #ffffff;
  color: #0f172a;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.my-library-tab__create-folder svg {
  width: 18px;
  height: 18px;
  color: #2196f3;
}

.my-library-tab__create-folder:hover {
  border-color: rgba(15, 23, 42, 0.24);
  background: rgba(33, 150, 243, 0.06);
}

.my-library-tab__create-folder:active {
  transform: scale(0.98);
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
.images-scroll-wrapper {
  position: relative;
  flex: 1;
  min-height: 0;
}

.scroll-indicator {
  position: absolute;
  top: 0;
  right: 2px;
  width: 3px;
  height: 20px;

  background: rgba(255, 255, 255, 0.9);
  border-radius: 2px;

  opacity: 0;
  transform: translateY(0);
  transition: opacity 0.25s ease;
  
  z-index: 10;
  pointer-events: none;
}

.my-library-tab__loading {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  color: #64748b;
  font-size: 14px;
}

.my-library-tab__spinner {
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

.my-library-tab__grid {
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
.my-library-tab__footer {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 32px;
  color: #64748b;
  font-size: 13px;
}

.my-library-tab__loading-more {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.my-library-tab__spinner--small {
  width: 20px;
  height: 20px;
  border-width: 3px;
}

.my-library-tab__no-more {
  color: #94a3b8;
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

/* Access Denied State */
.my-library-tab__access-denied {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
}

.my-library-tab__access-denied-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.my-library-tab__access-denied-title {
  margin: 0 0 8px;
  font-size: 18px;
  font-weight: 600;
  color: #0f172a;
}

.my-library-tab__access-denied-text {
  margin: 0 0 12px;
  font-size: 14px;
  color: #64748b;
  line-height: 1.5;
}

.my-library-tab__access-denied-hint {
  margin: 0;
  font-size: 13px;
  color: #94a3b8;
  line-height: 1.5;
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

.my-library-tab__modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 16px;
}

.my-library-tab__modal {
  background: #fff;
  border-radius: 12px;
  width: min(460px, 100%);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
}

.my-library-tab__modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid #e5e7eb;
}

.my-library-tab__modal-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #0f172a;
}

.my-library-tab__modal-close {
  border: none;
  background: transparent;
  font-size: 24px;
  cursor: pointer;
  color: #6b7280;
  line-height: 1;
}

.my-library-tab__modal-close:hover {
  color: #0f172a;
}

.my-library-tab__modal-body {
  padding: 20px 24px 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.my-library-tab__modal-label {
  font-size: 14px;
  font-weight: 500;
  color: #374151;
}

.my-library-tab__modal-input {
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.my-library-tab__modal-input:focus {
  border-color: #2196f3;
  box-shadow: 0 0 0 3px rgba(33, 150, 243, 0.12);
}

.my-library-tab__modal-error {
  margin: 4px 0 0;
  color: #ef4444;
  font-size: 13px;
}

.my-library-tab__modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px 20px;
  border-top: 1px solid #e5e7eb;
}

.my-library-tab__modal-btn {
  padding: 10px 18px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.2s;
}

.my-library-tab__modal-btn--secondary {
  background: #fff;
  color: #374151;
  border-color: #d1d5db;
}

.my-library-tab__modal-btn--secondary:hover {
  background: #f3f4f6;
}

.my-library-tab__modal-btn--primary {
  background: #2196f3;
  color: #fff;
  border-color: #2196f3;
}

.my-library-tab__modal-btn--primary:hover:not(:disabled) {
  background: #1976d2;
  border-color: #1976d2;
}

.my-library-tab__modal-btn--primary:disabled {
  opacity: 0.7;
  cursor: not-allowed;
} 
</style>
