<script setup>
import { ref, computed, defineEmits } from 'vue'
import FileTreeNode from './FileTreeNode.vue'

const emit = defineEmits(['file-selected'])

// Состояние компонента
const fileTree = ref([])
const rootFolder = ref(null)
const isDragging = ref(false)
const isLoading = ref(false)
const errorMessage = ref('')

// Константы для валидации
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB в байтах
const ALLOWED_MIME_TYPE = 'image/png'
const ALLOWED_EXTENSION = '.png'

// Проверка поддержки File System Access API
const supportsFileSystemAccess = computed(() => {
  return 'showDirectoryPicker' in window
})

// Валидация файла
async function validateFile(file) {
  const errors = []

  // Проверка расширения (регистронезависимо)
  if (!file.name.toLowerCase().endsWith(ALLOWED_EXTENSION)) {
    errors.push(`Недопустимое расширение файла. Разрешены только ${ALLOWED_EXTENSION} файлы.`)
  }

  // Проверка MIME-type
  if (file.type !== ALLOWED_MIME_TYPE) {
    errors.push(`Недопустимый тип файла: ${file.type}. Ожидается ${ALLOWED_MIME_TYPE}.`)
  }

  // Проверка размера файла
  if (file.size > MAX_FILE_SIZE) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2)
    const maxSizeMB = (MAX_FILE_SIZE / (1024 * 1024)).toFixed(0)
    errors.push(`Файл "${file.name}" слишком большой (${sizeMB} МБ). Максимальный размер: ${maxSizeMB} МБ.`)
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

// Режим A: File System Access API
async function selectFolder() {
  try {
    isLoading.value = true
    errorMessage.value = ''

    // Запрос выбора директории
    const directoryHandle = await window.showDirectoryPicker()

    rootFolder.value = {
      name: directoryHandle.name,
      handle: directoryHandle
    }

    // Сканирование директории
    const tree = await scanDirectory(directoryHandle, directoryHandle.name)
    fileTree.value = tree
  } catch (error) {
    if (error.name === 'AbortError') {
      // Пользователь отменил выбор
      console.log('Выбор папки отменен')
      errorMessage.value = ''
    } else if (error.name === 'NotAllowedError') {
      // Нет разрешения на доступ
      console.error('Доступ запрещен:', error)
      errorMessage.value = 'Доступ к папке запрещен. Предоставьте разрешение в браузере.'
    } else if (error.name === 'NotFoundError') {
      // Файл или папка не найдены
      console.error('Папка не найдена:', error)
      errorMessage.value = 'Выбранная папка не найдена.'
    } else {
      console.error('Ошибка при выборе папки:', error)
      errorMessage.value = `Ошибка при доступе к папке: ${error.message || 'неизвестная ошибка'}`
    }
  } finally {
    isLoading.value = false
  }
}

async function scanDirectory(directoryHandle, path = '') {
  const nodes = []

  try {
    // Итерация по всем entries в директории
    for await (const entry of directoryHandle.values()) {
      const fullPath = path ? `${path}/${entry.name}` : entry.name

      if (entry.kind === 'file') {
        // Проверяем расширение файла
        if (entry.name.toLowerCase().endsWith('.png')) {
          try {
            // Получаем файл для валидации
            const file = await entry.getFile()

            // Валидируем файл
            const validation = await validateFile(file)

            if (validation.isValid) {
              nodes.push({
                name: entry.name,
                type: 'file',
                path: fullPath,
                handle: entry,
                isExpanded: false
              })
            } else {
              // Логируем ошибки валидации
              console.warn(`Файл ${entry.name} не прошел валидацию:`, validation.errors)
            }
          } catch (fileError) {
            console.error(`Ошибка при обработке файла ${entry.name}:`, fileError)
          }
        }
      } else if (entry.kind === 'directory') {
        // Рекурсивно сканируем подпапку
        const children = await scanDirectory(entry, fullPath)

        // Добавляем папку только если в ней есть PNG файлы
        if (children.length > 0) {
          nodes.push({
            name: entry.name,
            type: 'folder',
            path: fullPath,
            handle: entry,
            children,
            isExpanded: false
          })
        }
      }
    }
  } catch (error) {
    if (error.name === 'NotAllowedError') {
      console.error('Доступ к директории запрещен:', error)
      throw error
    } else if (error.name === 'NotFoundError') {
      console.error('Директория не найдена:', error)
      throw error
    } else {
      console.error('Ошибка при сканировании директории:', error)
      throw error
    }
  }

  // Сортировка: сначала папки, потом файлы
  return nodes.sort((a, b) => {
    if (a.type === 'folder' && b.type === 'file') return -1
    if (a.type === 'file' && b.type === 'folder') return 1
    return a.name.localeCompare(b.name)
  })
}

// Режим B: Fallback с input file
const fileInput = ref(null)

function triggerFileInput() {
  fileInput.value?.click()
}

async function handleFilesInput(event) {
  isLoading.value = true
  errorMessage.value = ''

  try {
    const files = Array.from(event.target.files || [])
    await buildFileTree(files)
  } catch (error) {
    console.error('Ошибка при обработке файлов:', error)
    errorMessage.value = `Ошибка при загрузке файлов: ${error.message || 'неизвестная ошибка'}`
  } finally {
    isLoading.value = false
  }
}

async function buildFileTree(files) {
  // Фильтруем только PNG файлы
  const pngFiles = files.filter(file => file.name.toLowerCase().endsWith('.png'))

  if (pngFiles.length === 0) {
    errorMessage.value = 'PNG файлы не найдены'
    return
  }

  // Валидируем все файлы
  const validatedFiles = []
  const invalidFiles = []

  for (const file of pngFiles) {
    const validation = await validateFile(file)

    if (validation.isValid) {
      validatedFiles.push(file)
    } else {
      invalidFiles.push({ file, errors: validation.errors })
      console.warn(`Файл ${file.name} не прошел валидацию:`, validation.errors)
    }
  }

  // Показываем предупреждение о невалидных файлах
  if (invalidFiles.length > 0) {
    const errorMessages = invalidFiles
      .map(({ file, errors }) => `${file.name}: ${errors.join(', ')}`)
      .join('\n')

    errorMessage.value = `Некоторые файлы не прошли валидацию:\n${errorMessages}`

    // Если нет валидных файлов, выходим
    if (validatedFiles.length === 0) {
      return
    }
  }

  // Работаем только с валидными файлами
  const filesToProcess = validatedFiles

  // Строим виртуальное дерево из путей файлов
  const tree = {}

  filesToProcess.forEach(file => {
    const path = file.webkitRelativePath || file.name
    const parts = path.split('/')

    let current = tree

    // Строим структуру папок
    for (let i = 0; i < parts.length - 1; i++) {
      const folderName = parts[i]

      if (!current[folderName]) {
        current[folderName] = {
          name: folderName,
          type: 'folder',
          path: parts.slice(0, i + 1).join('/'),
          children: {},
          isExpanded: false
        }
      }

      current = current[folderName].children
    }

    // Добавляем файл
    const fileName = parts[parts.length - 1]
    current[fileName] = {
      name: fileName,
      type: 'file',
      path: path,
      file: file,
      isExpanded: false
    }
  })

  // Конвертируем объект в массив
  fileTree.value = convertTreeToArray(tree)

  // Устанавливаем корневую папку
  if (filesToProcess.length > 0 && filesToProcess[0].webkitRelativePath) {
    const rootName = filesToProcess[0].webkitRelativePath.split('/')[0]
    rootFolder.value = { name: rootName }
  }
}

function convertTreeToArray(tree) {
  const result = []

  for (const key in tree) {
    const node = tree[key]

    if (node.type === 'folder' && node.children) {
      node.children = convertTreeToArray(node.children)
    }

    result.push(node)
  }

  // Сортировка: сначала папки, потом файлы
  return result.sort((a, b) => {
    if (a.type === 'folder' && b.type === 'file') return -1
    if (a.type === 'file' && b.type === 'folder') return 1
    return a.name.localeCompare(b.name)
  })
}

// Drag & Drop
function onDragOver(event) {
  event.preventDefault()
  isDragging.value = true
}

function onDragLeave() {
  isDragging.value = false
}

async function handleDrop(event) {
  event.preventDefault()
  isDragging.value = false
  isLoading.value = true
  errorMessage.value = ''

  try {
    const files = Array.from(event.dataTransfer.files)
    await buildFileTree(files)
  } catch (error) {
    console.error('Ошибка при обработке перетаскивания:', error)
    errorMessage.value = `Ошибка при загрузке файлов: ${error.message || 'неизвестная ошибка'}`
  } finally {
    isLoading.value = false
  }
}

// Работа с деревом
function toggleFolder(node) {
  node.isExpanded = !node.isExpanded
}

async function selectFile(node) {
  try {
    errorMessage.value = ''
    let file

    // Для режима File System Access API
    if (node.handle && node.handle.getFile) {
      file = await node.handle.getFile()
    }
    // Для fallback режима
    else if (node.file) {
      file = node.file
    }

    if (!file) {
      errorMessage.value = 'Не удалось получить файл'
      console.error('Не удалось получить файл')
      return
    }

    // Валидация файла перед загрузкой
    const validation = await validateFile(file)

    if (!validation.isValid) {
      errorMessage.value = validation.errors.join('; ')
      console.warn('Файл не прошел валидацию:', validation.errors)
      return
    }

    // Читаем файл как Data URL
    const dataUrl = await readFileAsDataURL(file)

    // Получаем размеры изображения
    const dimensions = await getImageDimensions(dataUrl)

    // Отправляем событие с данными файла
    emit('file-selected', {
      name: node.name,
      dataUrl: dataUrl,
      width: dimensions.width,
      height: dimensions.height
    })
  } catch (error) {
    if (error.name === 'NotAllowedError') {
      errorMessage.value = 'Доступ к файлу запрещен. Предоставьте разрешение в браузере.'
      console.error('Доступ к файлу запрещен:', error)
    } else if (error.name === 'NotFoundError') {
      errorMessage.value = 'Файл не найден.'
      console.error('Файл не найден:', error)
    } else {
      errorMessage.value = `Ошибка при загрузке изображения: ${error.message || 'неизвестная ошибка'}`
      console.error('Ошибка при выборе файла:', error)
    }
  }
}

// Вспомогательные функции
function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    try {
      const reader = new FileReader()

      reader.onload = (e) => {
        resolve(e.target.result)
      }

      reader.onerror = (error) => {
        console.error('FileReader error:', error)
        reject(new Error(`Ошибка чтения файла: ${reader.error?.message || 'неизвестная ошибка'}`))
      }

      reader.readAsDataURL(file)
    } catch (error) {
      reject(new Error(`Не удалось прочитать файл: ${error.message}`))
    }
  })
}

function getImageDimensions(dataUrl) {
  return new Promise((resolve, reject) => {
    try {
      const img = new Image()

      img.onload = () => {
        resolve({
          width: img.width,
          height: img.height
        })
      }

      img.onerror = (error) => {
        console.error('Image loading error:', error)
        reject(new Error('Не удалось загрузить изображение. Возможно, файл поврежден или не является корректным PNG изображением.'))
      }

      img.src = dataUrl
    } catch (error) {
      reject(new Error(`Ошибка при обработке изображения: ${error.message}`))
    }
  })
}
</script>

<template>
  <div class="file-browser">
    <!-- Панель управления -->
    <div class="browser-toolbar">
      <button
        v-if="supportsFileSystemAccess"
        class="browser-toolbar__button"
        :disabled="isLoading"
        @click="selectFolder"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" class="button-icon">
          <path d="M2 4C2 2.89543 2.89543 2 4 2H6.17157C6.70201 2 7.21071 2.21071 7.58579 2.58579L8.41421 3.41421C8.78929 3.78929 9.29799 4 9.82843 4H12C13.1046 4 14 4.89543 14 6V12C14 13.1046 13.1046 14 12 14H4C2.89543 14 2 13.1046 2 12V4Z" fill="currentColor"/>
        </svg>
        {{ isLoading ? 'Загрузка...' : 'Выбрать папку' }}
      </button>

      <button
        v-else
        class="browser-toolbar__button"
        :disabled="isLoading"
        @click="triggerFileInput"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" class="button-icon">
          <rect x="2" y="2" width="12" height="12" rx="2" fill="currentColor"/>
        </svg>
        {{ isLoading ? 'Загрузка...' : 'Выбрать файлы' }}
      </button>

      <input
        ref="fileInput"
        type="file"
        accept=".png"
        multiple
        webkitdirectory
        style="display: none;"
        @change="handleFilesInput"
      />
    </div>

    <!-- Breadcrumbs -->
    <div v-if="rootFolder" class="breadcrumbs">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" class="breadcrumbs-icon">
        <path d="M2 4C2 2.89543 2.89543 2 4 2H6.17157C6.70201 2 7.21071 2.21071 7.58579 2.58579L8.41421 3.41421C8.78929 3.78929 9.29799 4 9.82843 4H12C13.1046 4 14 4.89543 14 6V12C14 13.1046 13.1046 14 12 14H4C2.89543 14 2 13.1046 2 12V4Z" fill="currentColor"/>
      </svg>
      <span class="breadcrumbs-text">{{ rootFolder.name }}</span>
    </div>

    <!-- Сообщение об ошибке -->
    <div v-if="errorMessage" class="error-message">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" class="error-icon">
        <circle cx="8" cy="8" r="7" fill="#FEE2E2" stroke="#DC2626" stroke-width="1.5"/>
        <path d="M8 4V8M8 10V10.5" stroke="#DC2626" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
      <span class="error-text">{{ errorMessage }}</span>
    </div>

    <!-- Drag & Drop зона для fallback -->
    <div
      v-if="!supportsFileSystemAccess && !fileTree.length && !isLoading"
      class="drop-zone"
      :class="{ 'drop-zone--dragging': isDragging }"
      @dragover.prevent="onDragOver"
      @dragleave="onDragLeave"
      @drop.prevent="handleDrop"
    >
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" class="drop-zone__icon">
        <rect x="8" y="8" width="32" height="32" rx="4" stroke="currentColor" stroke-width="2" stroke-dasharray="4 4" fill="none"/>
        <path d="M24 16V32M16 24H32" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
      <p class="drop-zone__text">Перетащите сюда файлы или папки</p>
      <p class="drop-zone__hint">Поддерживаются только PNG изображения</p>
    </div>

    <!-- Индикатор загрузки -->
    <div v-if="isLoading" class="loading-indicator">
      <div class="spinner"></div>
      <p>Загрузка файлов...</p>
    </div>

    <!-- Дерево файлов -->
    <div v-if="fileTree.length && !isLoading" class="file-tree">
      <FileTreeNode
        v-for="node in fileTree"
        :key="node.path"
        :node="node"
        @toggle="toggleFolder"
        @select="selectFile"
      />
    </div>

    <!-- Пустое состояние -->
    <div v-if="!fileTree.length && !isLoading && supportsFileSystemAccess" class="empty-state">
      <svg width="64" height="64" viewBox="0 0 64 64" fill="none" class="empty-state__icon">
        <path d="M8 16C8 11.5817 11.5817 8 16 8H24.6863C26.8081 8 28.8428 8.84285 30.3431 10.3431L33.6569 13.6569C35.1571 15.1571 37.1919 16 39.3137 16H48C52.4183 16 56 19.5817 56 24V48C56 52.4183 52.4183 56 48 56H16C11.5817 56 8 52.4183 8 48V16Z" fill="#F3F4F6" stroke="#D1D5DB" stroke-width="2"/>
      </svg>
      <p class="empty-state__text">Выберите папку для просмотра изображений</p>
    </div>
  </div>
</template>

<style scoped>
.file-browser {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 16px;
}

.browser-toolbar {
  margin-bottom: 16px;
}

.browser-toolbar button,
.browser-toolbar__button {
  width: 100%;
  padding: 10px 16px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.browser-toolbar button:hover,
.browser-toolbar__button:hover:not(:disabled) {
  background: #0056b3;
}

.browser-toolbar button:disabled,
.browser-toolbar__button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.button-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.breadcrumbs {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #f5f5f5;
  border-radius: 4px;
  margin-bottom: 12px;
  font-size: 13px;
  color: #666;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.breadcrumbs-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

.breadcrumbs-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.error-message {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 12px;
  padding: 10px 12px;
  border-radius: 6px;
  background: #fee;
  border: 1px solid #fcc;
  color: #c00;
  font-size: 13px;
}

.error-icon {
  flex-shrink: 0;
  margin-top: 2px;
}

.error-text {
  flex: 1;
  white-space: pre-line;
  word-break: break-word;
}

.drop-zone {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 2px dashed #ccc;
  border-radius: 8px;
  padding: 40px 20px;
  text-align: center;
  transition: all 0.3s;
}

.drop-zone.drag-over,
.drop-zone--dragging {
  border-color: #007bff;
  background: #f0f8ff;
}

.drop-zone p,
.drop-zone__text {
  margin: 8px 0;
  color: #666;
}

.drop-zone .hint,
.drop-zone__hint {
  font-size: 12px;
  color: #999;
}

.drop-zone__icon {
  width: 48px;
  height: 48px;
  color: #007bff;
  margin-bottom: 16px;
}

.loading-indicator {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 32px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(0, 123, 255, 0.2);
  border-top-color: #007bff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.loading-indicator p {
  margin: 0;
  font-size: 14px;
  color: #666;
}

.file-tree {
  flex: 1;
  overflow-y: auto;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  padding: 8px 0;
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #999;
  font-size: 14px;
  text-align: center;
  padding: 32px;
}

.empty-state__icon {
  width: 64px;
  height: 64px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-state__text {
  margin: 0;
  font-size: 14px;
  color: #999;
}
</style>
