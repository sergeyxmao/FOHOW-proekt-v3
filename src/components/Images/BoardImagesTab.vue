<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useImagesStore } from '../../stores/images.js'
import { useBoardStore } from '../../stores/board.js'
import { useImageProxy } from '../../composables/useImageProxy'

const imagesStore = useImagesStore()
const boardStore = useBoardStore()
const { getImageUrl } = useImageProxy()

const searchQuery = ref('')

// Кэш загруженных превью: imageId (из библиотеки) -> blob URL
const thumbCache = ref(new Map())

// Изображения текущей доски из canvas store
const boardImages = computed(() => {
  return imagesStore.images || []
})

// Фильтрация по поиску
const filteredImages = computed(() => {
  if (!searchQuery.value.trim()) {
    return boardImages.value
  }
  const query = searchQuery.value.toLowerCase()
  return boardImages.value.filter(img => {
    const name = (img.name || '').toLowerCase()
    return name.includes(query)
  })
})

const hasBoard = computed(() => !!boardStore.currentBoardId)

/**
 * Загрузить превью для всех изображений на доске.
 * Приоритет: прокси по imageId > валидный blob из dataUrl > previewDataUrl
 */
async function loadThumbnails() {
  const images = boardImages.value
  for (const image of images) {
    // Пропускаем если уже загружено в кэш
    if (thumbCache.value.has(image.id)) continue

    // Приоритет 1: загрузка через прокси по imageId
    if (image.imageId) {
      try {
        const url = await getImageUrl(image.imageId)
        if (url) {
          thumbCache.value.set(image.id, url)
          thumbCache.value = new Map(thumbCache.value)
          continue
        }
      } catch (e) {
        console.error(`[BoardImagesTab] Proxy load error for ${image.id}:`, e)
      }
    }

    // Приоритет 2: blob из dataUrl (фоллбэк, если нет imageId)
    if (image.dataUrl && image.dataUrl.startsWith('blob:')) {
      try {
        const response = await fetch(image.dataUrl, { method: 'HEAD' })
        if (response.ok) {
          thumbCache.value.set(image.id, image.dataUrl)
          thumbCache.value = new Map(thumbCache.value)
        }
      } catch {
        // blob невалидный (протух после перезагрузки), игнорируем
        console.warn(`[BoardImagesTab] Stale blob URL for ${image.id}`)
      }
    }
  }
}

/**
 * Получить URL для миниатюры.
 * Не используем blob dataUrl напрямую — они протухают после перезагрузки.
 */
const getThumbUrl = (image) => {
  if (thumbCache.value.has(image.id)) {
    return thumbCache.value.get(image.id)
  }
  // Фоллбэк на previewDataUrl (base64, не протухает)
  return image.previewDataUrl || ''
}

/**
 * Клик по изображению — фокус на нём на доске
 */
const handleImageClick = (image) => {
  imagesStore.requestFocusOnImage(image.id)
}

// Загружаем превью при монтировании и при смене списка изображений
onMounted(loadThumbnails)

watch(boardImages, () => {
  loadThumbnails()
}, { deep: false })
</script>

<template>
  <div class="board-images-tab">
    <!-- Нет доски -->
    <div v-if="!hasBoard" class="board-images-tab__empty">
      <p class="board-images-tab__empty-text">Сначала откройте доску</p>
      <p class="board-images-tab__empty-hint">
        Здесь будут показаны изображения, размещённые на текущей доске
      </p>
    </div>

    <template v-else>
      <!-- Поиск -->
      <div class="board-images-tab__search">
        <input
          v-model="searchQuery"
          type="text"
          class="board-images-tab__search-input"
          placeholder="Поиск по имени..."
        />
      </div>

      <!-- Нет изображений на доске -->
      <div v-if="boardImages.length === 0" class="board-images-tab__empty">
        <p class="board-images-tab__empty-text">Нет изображений на доске</p>
        <p class="board-images-tab__empty-hint">
          Добавьте изображения из библиотеки на доску
        </p>
      </div>

      <!-- Нет результатов поиска -->
      <div v-else-if="filteredImages.length === 0" class="board-images-tab__empty">
        <p class="board-images-tab__empty-text">Ничего не найдено</p>
      </div>

      <!-- Сетка изображений -->
      <div v-else class="board-images-tab__grid">
        <div
          v-for="image in filteredImages"
          :key="image.id"
          class="board-images-tab__item"
          :title="image.name || 'Изображение'"
          @click="handleImageClick(image)"
        >
          <div class="board-images-tab__thumb">
            <img
              v-if="getThumbUrl(image)"
              :src="getThumbUrl(image)"
              :alt="image.name"
              class="board-images-tab__img"
              loading="lazy"
            />
            <div v-else class="board-images-tab__placeholder">
              <div class="board-images-tab__spinner"></div>
            </div>
          </div>
          <p class="board-images-tab__name">{{ image.name || 'Без имени' }}</p>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.board-images-tab {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 0;
}

/* Search */
.board-images-tab__search {
  padding: 16px 16px 12px;
}

.board-images-tab__search-input {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid rgba(15, 23, 42, 0.15);
  border-radius: 8px;
  font-size: 14px;
  color: #0f172a;
  background: #ffffff;
  outline: none;
  transition: border-color 0.2s ease;
  box-sizing: border-box;
}

.board-images-tab__search-input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.board-images-tab__search-input::placeholder {
  color: #94a3b8;
}

/* Grid */
.board-images-tab__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  padding: 0 16px 16px;
  overflow-y: auto;
  flex: 1;
}

.board-images-tab__item {
  display: flex;
  flex-direction: column;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.2s ease;
  overflow: hidden;
}

.board-images-tab__item:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.12);
}

.board-images-tab__thumb {
  width: 100%;
  aspect-ratio: 1;
  background: #f1f5f9;
  overflow: hidden;
  border-radius: 6px;
}

.board-images-tab__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.board-images-tab__placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
}

.board-images-tab__spinner {
  width: 24px;
  height: 24px;
  border: 2px solid rgba(15, 23, 42, 0.1);
  border-top-color: #94a3b8;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.board-images-tab__name {
  margin: 4px 0 0;
  font-size: 11px;
  color: #64748b;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 0 2px;
}

/* Empty state */
.board-images-tab__empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
}

.board-images-tab__empty-text {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 600;
  color: #0f172a;
}

.board-images-tab__empty-hint {
  margin: 0;
  font-size: 14px;
  color: #64748b;
  line-height: 1.5;
}

/* Scrollbar */
.board-images-tab__grid::-webkit-scrollbar {
  width: 6px;
}

.board-images-tab__grid::-webkit-scrollbar-track {
  background: transparent;
}

.board-images-tab__grid::-webkit-scrollbar-thumb {
  background: rgba(15, 23, 42, 0.15);
  border-radius: 3px;
}
</style>
