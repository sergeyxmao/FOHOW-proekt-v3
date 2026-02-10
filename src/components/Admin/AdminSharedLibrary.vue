<template>
  <div class="shared-library">
    <div v-if="lastError" class="error-banner">
      <span>{{ lastError }}</span>
      <button type="button" class="error-close" @click="clearLastError">&times;</button>
    </div>    
    <div class="library-container">
      <!-- Левая колонка: папки -->
      <div class="folders-column">
        <div class="folders-header">
          <h3>Папки</h3>
        </div>

        <!-- Форма создания новой папки -->
        <div class="create-folder">
          <input
            v-model="newFolderName"
            type="text"
            placeholder="Название новой папки"
            @keyup.enter="handleCreateFolder"
            :disabled="adminStore.isLoading"
            class="folder-input"
          />
          <button
            @click="handleCreateFolder"
            :disabled="!newFolderName.trim() || adminStore.isLoading"
            class="create-button"
          >
            Создать папку
          </button>
        </div>

        <!-- Список папок -->
        <div v-if="adminStore.isLoading && !adminStore.sharedFoldersWithDetails.length" class="loading">
          <div class="spinner"></div>
          <p>Загрузка папок...</p>
        </div>

        <div v-else-if="adminStore.sharedFoldersWithDetails.length === 0" class="empty-state">
          <p>Папок пока нет. Создайте первую папку.</p>
        </div>

        <div v-else class="folders-list">
          <button
            v-for="folder in adminStore.sharedFoldersWithDetails"
            :key="folder.id"
            :class="['folder-item', { active: selectedFolder?.id === folder.id }]"
            @click="selectFolder(folder)"
          >
            <span class="folder-name">{{ folder.name }}</span>
            <span class="folder-count">({{ folder.images_count || 0 }})</span>
          </button>
        </div>
      </div>

      <!-- Правая часть: содержимое папки -->
      <div class="content-column">
        <div v-if="!selectedFolder" class="empty-state">
          <p>Выберите папку для просмотра изображений</p>
        </div>

        <div v-else>
          <!-- Заголовок и кнопка загрузки -->
          <div class="content-header">
            <div class="folder-title" @dblclick="startRename">
              <template v-if="isRenaming">
                <input
                  ref="renameInput"
                  v-model="renameValue"
                  type="text"
                  class="rename-input"
                  @keyup.enter="handleRenameSubmit"
                  @keyup.esc="cancelRename"
                  @blur="handleRenameSubmit"
                />
              </template>
              <template v-else>
                <h2>Папка: {{ selectedFolder.name }}</h2>
                <span class="rename-hint">Двойной клик для переименования</span>
              </template>
            </div>
            <div class="header-actions">
              <input
                ref="fileInput"
                type="file"
                accept="image/*"
                @change="handleFileSelect"
                style="display: none"
              />
               <button
                @click="handleDeleteFolder"
                :disabled="adminStore.isLoading"
                class="delete-folder-button"
                title="Удалить папку"
              >
                🗑
              </button>             
              <button
                @click="$refs.fileInput.click()"
                :disabled="adminStore.isLoading"
                class="upload-button"
              >
                Загрузить изображение
              </button>
            </div>
          </div>

          <!-- Загрузка изображений -->
          <div v-if="adminStore.isLoadingImages" class="loading">
            <div class="spinner"></div>
            <p>Загрузка изображений...</p>
          </div>

          <!-- Пустое состояние -->
          <div v-else-if="adminStore.currentFolderImages.length === 0" class="empty-state">
            <p>В этой папке пока нет изображений</p>
          </div>

          <!-- Сетка изображений -->
          <div v-else class="images-grid">
            <div
              v-for="image in adminStore.currentFolderImages"
              :key="image.id"
              class="image-card"
            >
              <div class="image-preview">
                <div v-if="loadingImages[image.id]" class="image-loading">
                  <div class="image-spinner"></div>
                  <span>Загрузка...</span>
                </div>
                <img
                  v-else-if="imageUrls[image.id]"
                  :src="imageUrls[image.id]"
                  :alt="image.original_name"
                  loading="lazy"
                />
                <div v-else class="image-error">Ошибка загрузки</div>
              </div>
              <div class="image-info">
                <div
                  v-if="renamingImageId !== image.id"
                  class="image-name editable"
                  :title="image.original_name"
                  @dblclick="startImageRename(image)"
                >
                  {{ image.original_name }}
                </div>
                <input
                  v-else
                  ref="renameImageInput"
                  type="text"
                  class="rename-image-input"
                  v-model="newImageName"
                  @blur="cancelImageRename"
                  @keydown.enter="confirmImageRename"
                  @keydown.esc="cancelImageRename"
                />
                <div class="image-meta">
                  <span class="image-size">{{ formatFileSize(image.file_size) }}</span>
                  <span v-if="image.width && image.height" class="image-dimensions">
                    {{ image.width }}×{{ image.height }}
                  </span>
                </div>
                <div v-if="image.user_full_name" class="image-author">
                  <span>{{ image.user_full_name }}</span>
                  <span v-if="image.user_personal_id" class="author-id">
                    ({{ image.user_personal_id }})
                  </span>
                </div>
              </div>
              <div class="image-actions">
                <button
                  @click="openMoveDialog(image)"
                  class="action-button move-button"
                  :disabled="adminStore.isLoading"
                >
                  Переместить
                </button>
                <button
                  @click="openDeleteDialog(image)"
                  class="action-button delete-button"
                  :disabled="adminStore.isLoading"
                >
                  Удалить
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Модальное окно перемещения -->
    <div v-if="showMoveDialog" class="modal-overlay" @click.self="closeMoveDialog">
      <div class="modal">
        <div class="modal-header">
          <h3>Переместить изображение</h3>
          <button @click="closeMoveDialog" class="close-button">&times;</button>
        </div>
        <div class="modal-body">
          <p>Выберите папку для перемещения изображения "{{ imageToMove?.original_name }}":</p>
          <select v-model="selectedTargetFolderId" class="folder-select">
            <option :value="null" disabled>Выберите папку</option>
            <option
              v-for="folder in adminStore.sharedFoldersWithDetails"
              :key="folder.id"
              :value="folder.id"
            >
              {{ folder.name }}
            </option>
          </select>
        </div>
        <div class="modal-footer">
          <button @click="closeMoveDialog" class="cancel-button">Отмена</button>
          <button
            @click="handleMoveImage"
            :disabled="!selectedTargetFolderId || adminStore.isLoading"
            class="confirm-button"
          >
            Переместить
          </button>
        </div>
      </div>
    </div>

    <!-- Диалог подтверждения удаления -->
    <div v-if="showDeleteDialog" class="modal-overlay" @click.self="closeDeleteDialog">
      <div class="modal">
        <div class="modal-header">
          <h3>Удаление изображения</h3>
          <button @click="closeDeleteDialog" class="close-button">&times;</button>
        </div>
        <div class="modal-body">
          <p>Удалить изображение из общей библиотеки?</p>
          <p class="warning-text">Это действие удалит файл с Яндекс.Диска.</p>
        </div>
        <div class="modal-footer">
          <button @click="closeDeleteDialog" class="cancel-button">Отмена</button>
          <button
            @click="handleDeleteImage"
            :disabled="adminStore.isLoading"
            class="confirm-button delete"
          >
            Удалить
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue'
import { useAdminStore } from '../../stores/admin'
import { useNotificationsStore } from '../../stores/notifications'
import { useImageProxy } from '../../composables/useImageProxy'
import { convertToWebP, isImageFile } from '../../utils/imageUtils'

const adminStore = useAdminStore()
const notificationsStore = useNotificationsStore()
const { getImageUrl } = useImageProxy()

const selectedFolder = ref(null)
const imageUrls = ref({})
const loadingImages = ref({})
const newFolderName = ref('')
const fileInput = ref(null)
const isRenaming = ref(false)
const renameValue = ref('')
const renameInput = ref(null)
const lastError = ref('')

// Переименование изображения
const renamingImageId = ref(null)
const newImageName = ref('')
const renameImageInput = ref(null)

function formatError(err, fallbackMessage) {
  const base = err?.message || fallbackMessage || 'Произошла ошибка'
  const details = []

  if (err?.status) {
    details.push(`Статус: ${err.status}`)
  }

  if (err?.code) {
    details.push(`Код: ${err.code}`)
  }

  return details.length ? `${base} · ${details.join(' · ')}` : base
}

function clearLastError() {
  lastError.value = ''
}
// Модальные окна
const showMoveDialog = ref(false)
const imageToMove = ref(null)
const selectedTargetFolderId = ref(null)

const showDeleteDialog = ref(false)
const imageToDelete = ref(null)

/**
 * Загрузить список папок
 */
async function loadFolders() {
  try {
    await adminStore.fetchSharedFoldersWithDetails()
    clearLastError()  
  } catch (err) {
    const message = formatError(err, 'Ошибка загрузки папок')
    lastError.value = message    
    notificationsStore.addNotification({
      type: 'error',
      message
    })
  }
}
/**
 * Начать переименование папки
 */
function startRename() {
  if (!selectedFolder.value) return

  renameValue.value = selectedFolder.value.name
  isRenaming.value = true

  requestAnimationFrame(() => {
    if (renameInput.value) {
      renameInput.value.focus()
      renameInput.value.select()
    }
  })
}

/**
 * Завершить переименование папки
 */
async function handleRenameSubmit() {
  if (!selectedFolder.value) return

  const newName = renameValue.value.trim()
  if (!newName || newName === selectedFolder.value.name) {
    isRenaming.value = false
    return
  }

  try {
    await adminStore.renameSharedFolder(selectedFolder.value.id, newName)
    selectedFolder.value = { ...selectedFolder.value, name: newName }
    clearLastError()

    notificationsStore.addNotification({
      type: 'success',
      message: 'Папка переименована'
    })
  } catch (err) {
    const message = formatError(err, 'Не удалось переименовать папку')
    lastError.value = message
    notificationsStore.addNotification({
      type: 'error',
      message
    })
  } finally {
    isRenaming.value = false
  }
}

function cancelRename() {
  isRenaming.value = false
  renameValue.value = ''
}
/**
 * Создать новую папку
 */
async function handleCreateFolder() {
  if (!newFolderName.value.trim()) return

  try {
    const createdFolder = await adminStore.createSharedFolder(newFolderName.value.trim())
    await loadFolders()

    const syncedFolder = adminStore.sharedFoldersWithDetails.find(folder => folder.id === createdFolder.id)
    if (syncedFolder) {
      await selectFolder(syncedFolder)
    }
    notificationsStore.addNotification({
      type: 'success',
      message: 'Папка успешно создана'
    })
    clearLastError()    
    newFolderName.value = ''
  } catch (err) {
    const message = formatError(err, 'Ошибка создания папки')
    lastError.value = message    
    notificationsStore.addNotification({
      type: 'error',
      message
    })
  }
}

/**
 * Выбрать папку
 */
async function selectFolder(folder) {
  selectedFolder.value = folder
  try {
    await adminStore.fetchFolderImages(folder.id)
    // Загружаем blob URLs для изображений
    await loadImageUrls()
    clearLastError()    
  } catch (err) {
    const message = formatError(err, 'Ошибка загрузки изображений')
    lastError.value = message    
    notificationsStore.addNotification({
      type: 'error',
      message
    })
  }
}

/**
 * Загрузить blob URLs для всех изображений
 */
async function loadImageUrls() {
  const urls = {}
  const loading = {}

  for (const image of adminStore.currentFolderImages) {
    loading[image.id] = true
    loadingImages.value = { ...loadingImages.value, ...loading }

    try {
      urls[image.id] = await getImageUrl(image.id)
    } catch (error) {
      console.error(`Ошибка загрузки изображения ${image.id}:`, error)
      urls[image.id] = ''
    } finally {
      loading[image.id] = false
      loadingImages.value = { ...loadingImages.value, ...loading }
    }
  }

  imageUrls.value = urls
}

// Следим за изменением списка изображений
watch(() => adminStore.currentFolderImages, async (newImages) => {
  if (newImages && newImages.length > 0) {
    await loadImageUrls()
  }
}, { deep: true })

/**
 * Обработка выбора файла для загрузки
 */
async function handleFileSelect(event) {
  const file = event.target.files[0]
  if (!file || !selectedFolder.value) return

  try {
    if (!isImageFile(file)) {
      notificationsStore.addNotification({
        type: 'error',
        message: `Файл "${file.name}" не является изображением`
      })
      event.target.value = ''
      return
    }

    let uploadFile = file
    let width
    let height

    if (file.type !== 'image/webp') {
      const { blob, width: convertedWidth, height: convertedHeight } = await convertToWebP(file, 0.9, 2048, 2048)
      const originalName = file.name.replace(/\.[^/.]+$/, '') + '.webp'
      uploadFile = new File([blob], originalName, { type: 'image/webp' })
      width = convertedWidth
      height = convertedHeight
    } else {
      const dimensions = await getImageDimensions(file)
      width = dimensions.width
      height = dimensions.height
    }

    await adminStore.uploadSharedImage(
      uploadFile,
      selectedFolder.value.id,
      width,
      height
    )

    notificationsStore.addNotification({
      type: 'success',
      message: 'Изображение успешно загружено'
    })

    // Очищаем input
    event.target.value = ''
    clearLastError()
    
    // Перезагружаем изображения папки
    await adminStore.fetchFolderImages(selectedFolder.value.id)
  } catch (err) {
    const message = formatError(err, 'Ошибка загрузки изображения')
    lastError.value = message    
    notificationsStore.addNotification({
      type: 'error',
      message
    })
    event.target.value = ''
  }
}

/**
 * Получить размеры изображения из файла
 */
function getImageDimensions(file) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve({
        width: img.width,
        height: img.height
      })
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Не удалось загрузить изображение'))
    }

    img.src = url
  })
}

/**
 * Открыть диалог перемещения
 */
function openMoveDialog(image) {
  imageToMove.value = image
  selectedTargetFolderId.value = null
  showMoveDialog.value = true
}

/**
 * Закрыть диалог перемещения
 */
function closeMoveDialog() {
  showMoveDialog.value = false
  imageToMove.value = null
  selectedTargetFolderId.value = null
}

/**
 * Переместить изображение
 */
async function handleMoveImage() {
  if (!imageToMove.value || !selectedTargetFolderId.value || !selectedFolder.value) return

  try {
    await adminStore.moveImageToFolder(
      imageToMove.value.id,
      selectedTargetFolderId.value,
      selectedFolder.value.id
    )

    notificationsStore.addNotification({
      type: 'success',
      message: 'Изображение успешно перемещено'
    })
    clearLastError()
    closeMoveDialog()
  } catch (err) {
    const message = formatError(err, 'Ошибка перемещения изображения')
    lastError.value = message    
    notificationsStore.addNotification({
      type: 'error',
      message
    })
  }
}

/**
 * Открыть диалог удаления
 */
function openDeleteDialog(image) {
  imageToDelete.value = image
  showDeleteDialog.value = true
}

/**
 * Закрыть диалог удаления
 */
function closeDeleteDialog() {
  showDeleteDialog.value = false
  imageToDelete.value = null
}

/**
 * Удалить изображение
 */
async function handleDeleteImage() {
  if (!imageToDelete.value || !selectedFolder.value) return

  try {
    await adminStore.deleteSharedImage(imageToDelete.value.id, selectedFolder.value.id)

    notificationsStore.addNotification({
      type: 'success',
      message: 'Изображение успешно удалено'
    })
    clearLastError()
    closeDeleteDialog()
  } catch (err) {
    const message = formatError(err, 'Ошибка удаления изображения')
    lastError.value = message
    notificationsStore.addNotification({
      type: 'error',
      message
    })
  }
}

/**
 * Удалить выбранную папку
 */
async function handleDeleteFolder() {
  if (!selectedFolder.value) return

  const confirmed = confirm('Удалить текущую папку и все её содержимое?')
  if (!confirmed) return

  try {
    await adminStore.deleteSharedFolder(selectedFolder.value.id)
    selectedFolder.value = null

    notificationsStore.addNotification({
      type: 'success',
      message: 'Папка удалена'
    })
    clearLastError()
  } catch (err) {
    const message = formatError(err, 'Ошибка удаления папки')
    lastError.value = message    
    notificationsStore.addNotification({
      type: 'error',
      message
    })
  }
}

/**
 * Начать переименование изображения
 */
function startImageRename(image) {
  renamingImageId.value = image.id
  newImageName.value = image.original_name

  requestAnimationFrame(() => {
    if (renameImageInput.value) {
      renameImageInput.value.focus()
      renameImageInput.value.select()
    }
  })
}

/**
 * Отменить переименование изображения
 */
function cancelImageRename() {
  renamingImageId.value = null
  newImageName.value = ''
}

/**
 * Подтвердить переименование изображения
 */
async function confirmImageRename() {
  const imageId = renamingImageId.value
  const newName = newImageName.value.trim()

  // Валидация
  if (!newName) {
    alert('Имя не может быть пустым')
    return
  }

  // Найти изображение в списке
  const image = adminStore.currentFolderImages.find(img => img.id === imageId)
  if (!image) {
    cancelImageRename()
    return
  }

  // Если имя не изменилось
  if (newName === image.original_name) {
    cancelImageRename()
    return
  }

  try {
    // Вызов API для переименования
    const result = await adminStore.renameImage(imageId, newName)

    // Обновить данные изображения в списке
    const index = adminStore.currentFolderImages.findIndex(img => img.id === imageId)
    if (index !== -1) {
      adminStore.currentFolderImages[index] = {
        ...adminStore.currentFolderImages[index],
        ...result.image
      }
    }

    // Показать уведомление
    const boardsCount = result.boards_updated || 0
    const message = boardsCount > 0
      ? `Изображение переименовано. Обновлено досок: ${boardsCount}`
      : 'Изображение переименовано'

    notificationsStore.addNotification({
      type: 'success',
      message
    })
    clearLastError()

    cancelImageRename()

  } catch (err) {
    const message = formatError(err, 'Ошибка переименования изображения')
    lastError.value = message
    notificationsStore.addNotification({
      type: 'error',
      message
    })
  }
}

/**
 * Форматирование размера файла
 */
function formatFileSize(bytes) {
  if (!bytes) return '0 Б'
  if (bytes < 1024) return bytes + ' Б'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' КБ'
  return (bytes / (1024 * 1024)).toFixed(1) + ' МБ'
}

// Очистка blob URLs при размонтировании
onBeforeUnmount(() => {
  // Освобождаем все blob URLs
  Object.values(imageUrls.value).forEach(url => {
    if (url && url.startsWith('blob:')) {
      URL.revokeObjectURL(url)
    }
  })
  imageUrls.value = {}
})

// Загружаем папки при монтировании
onMounted(() => {
  loadFolders()
})
</script>

<style scoped>
.shared-library {
  padding: 20px;
}
.error-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #ffecec;
  border: 1px solid #f5c6cb;
  color: #b71c1c;
  padding: 12px 16px;
  border-radius: 8px;
  margin-bottom: 16px;
  gap: 12px;
}

.error-close {
  background: transparent;
  border: none;
  color: #b71c1c;
  font-size: 18px;
  cursor: pointer;
  padding: 4px;
  line-height: 1;
}

.library-container {
  display: flex;
  gap: 20px;
  height: calc(100vh - 200px);
}

/* Левая колонка */
.folders-column {
  width: 280px;
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
}

.folders-header h3 {
  margin: 0 0 15px 0;
  font-size: 18px;
  color: #333;
}

.create-folder {
  margin-bottom: 20px;
}

.folder-input {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 5px;
  font-size: 14px;
  margin-bottom: 10px;
}

.folder-input:focus {
  outline: none;
  border-color: #6c63ff;
}

.create-button {
  width: 100%;
  padding: 10px;
  background: #6c63ff;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.3s;
}

.create-button:hover:not(:disabled) {
  background: #5a52d5;
}

.create-button:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.folders-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.folder-item {
  width: 100%;
  padding: 12px;
  background: #f5f5f5;
  border: 1px solid #e0e0e0;
  border-radius: 5px;
  cursor: pointer;
  text-align: left;
  transition: all 0.3s;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.folder-item:hover {
  background: #ebebeb;
}

.folder-item.active {
  background: #6c63ff;
  color: white;
  border-color: #6c63ff;
}

.folder-name {
  font-size: 14px;
  font-weight: 500;
}

.folder-count {
  font-size: 12px;
  opacity: 0.8;
}

/* Правая часть */
.content-column {
  flex: 1;
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  overflow-y: auto;
}

.content-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 2px solid #f0f0f0;
}
.folder-title {
  display: flex;
  flex-direction: column;
  gap: 6px;
  cursor: pointer;
}

.rename-input {
  padding: 8px 10px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 16px;
  width: 320px;
}

.rename-input:focus {
  outline: none;
  border-color: #6c63ff;
  box-shadow: 0 0 0 3px rgba(108, 99, 255, 0.12);
}

.rename-hint {
  font-size: 12px;
  color: #94a3b8;
}

.content-header h2 {
  margin: 0;
  font-size: 22px;
  color: #333;
}
.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.upload-button {
  padding: 10px 20px;
  background: #4caf50;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.3s;
}
.delete-folder-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 10px 14px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  cursor: pointer;
  font-size: 16px;
  transition: all 0.2s ease;
}

.delete-folder-button:hover:not(:disabled) {
  background: #fee2e2;
  border-color: #fca5a5;
}

.delete-folder-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.upload-button:hover:not(:disabled) {
  background: #45a049;
}

.upload-button:disabled {
  background: #ccc;
  cursor: not-allowed;
}

/* Сетка изображений */
.images-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 20px;
}

.image-card {
  background: #f9f9f9;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  overflow: hidden;
  transition: box-shadow 0.3s;
}

.image-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.image-preview {
  width: 100%;
  height: 200px;
  background: #f0f0f0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.image-preview img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.image-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  gap: 8px;
  color: #666;
  font-size: 13px;
}

.image-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #f3f3f3;
  border-top: 3px solid #6c63ff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.image-error {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: #f44336;
  font-size: 13px;
}

.image-info {
  padding: 12px;
}

.image-name {
  font-size: 14px;
  font-weight: 500;
  color: #333;
  margin-bottom: 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.image-name.editable {
  cursor: text;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.image-name.editable:hover {
  background-color: #f0f0f0;
}

.rename-image-input {
  width: 100%;
  padding: 4px 8px;
  font-size: 14px;
  border: 2px solid #6c63ff;
  border-radius: 4px;
  outline: none;
  font-family: inherit;
  margin-bottom: 8px;
}

.rename-image-input:focus {
  border-color: #5a52d5;
  box-shadow: 0 0 0 3px rgba(108, 99, 255, 0.1);
}

.image-meta {
  display: flex;
  gap: 10px;
  font-size: 12px;
  color: #666;
  margin-bottom: 8px;
}

.image-author {
  font-size: 12px;
  color: #888;
}

.author-id {
  color: #aaa;
}

.image-actions {
  display: flex;
  gap: 8px;
  padding: 12px;
  border-top: 1px solid #e0e0e0;
}

.action-button {
  flex: 1;
  padding: 8px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.3s;
}

.move-button {
  background: #2196f3;
  color: white;
}

.move-button:hover:not(:disabled) {
  background: #1976d2;
}

.delete-button {
  background: #f44336;
  color: white;
}

.delete-button:hover:not(:disabled) {
  background: #d32f2f;
}

.action-button:disabled {
  background: #ccc;
  cursor: not-allowed;
}

/* Состояния */
.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: #666;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #6c63ff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 15px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: #999;
  font-size: 16px;
  text-align: center;
}

/* Модальные окна */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: white;
  border-radius: 8px;
  width: 90%;
  max-width: 500px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #e0e0e0;
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
  color: #333;
}

.close-button {
  background: none;
  border: none;
  font-size: 28px;
  color: #999;
  cursor: pointer;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.3s;
}

.close-button:hover {
  color: #333;
}

.modal-body {
  padding: 20px;
}

.modal-body p {
  margin: 0 0 15px 0;
  color: #333;
}

.warning-text {
  color: #f44336;
  font-weight: 500;
  font-size: 14px;
}

.folder-select {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 5px;
  font-size: 14px;
}

.folder-select:focus {
  outline: none;
  border-color: #6c63ff;
}

.modal-footer {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  padding: 20px;
  border-top: 1px solid #e0e0e0;
}

.cancel-button,
.confirm-button {
  padding: 10px 20px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.3s;
}

.cancel-button {
  background: #f0f0f0;
  color: #333;
}

.cancel-button:hover {
  background: #e0e0e0;
}

.confirm-button {
  background: #6c63ff;
  color: white;
}

.confirm-button:hover:not(:disabled) {
  background: #5a52d5;
}

.confirm-button.delete {
  background: #f44336;
}

.confirm-button.delete:hover:not(:disabled) {
  background: #d32f2f;
}

.confirm-button:disabled {
  background: #ccc;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .shared-library {
    padding: 10px;
  }

  .library-container {
    flex-direction: column;
    height: auto;
  }

  .folders-column {
    width: 100%;
    padding: 14px;
  }

  .content-column {
    padding: 14px;
  }

  .content-header {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }

  .header-actions {
    flex-wrap: wrap;
  }

  .rename-input {
    width: 100%;
  }

  .images-grid {
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 12px;
  }

  .image-preview {
    height: 140px;
  }

  .modal {
    width: 95%;
  }
}
</style>
