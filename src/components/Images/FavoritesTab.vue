<script setup>
import { ref, computed, onMounted } from 'vue'
import { useStickersStore } from '../../stores/stickers.js'
import { useBoardStore } from '../../stores/board.js'
import { useNotificationsStore } from '../../stores/notifications.js'
import { useSidePanelsStore } from '../../stores/sidePanels.js'
import { getFavoriteImages, removeImageFromFavorites } from '../../services/imageService'
import ImageCard from './ImageCard.vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps({
  placementTarget: {
    type: String,
    default: 'board'
  }
})

const stickersStore = useStickersStore()
const boardStore = useBoardStore()
const notificationsStore = useNotificationsStore()
const sidePanelsStore = useSidePanelsStore()

const images = ref([])
const isLoading = ref(false)
const error = ref(null)
const searchQuery = ref('')

// Фильтрация по поиску
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

/**
 * Загрузить избранные изображения
 */
async function loadFavorites() {
  isLoading.value = true
  error.value = null
  try {
    const result = await getFavoriteImages()
    images.value = result.items || []
  } catch (e) {
    console.error('[FavoritesTab] Load error:', e)
    error.value = 'Не удалось загрузить избранное'
  } finally {
    isLoading.value = false
  }
}

/**
 * Клик по изображению — добавить на доску (placement mode)
 */
async function handleImageClick(image) {
  const boardId = stickersStore.currentBoardId || boardStore.currentBoardId

  if (!boardId && props.placementTarget !== 'drawing') {
    notificationsStore.addNotification({
      message: 'Сначала откройте доску',
      type: 'info',
      duration: 4000
    })
    return
  }

  stickersStore.enablePlacementMode(props.placementTarget || 'board')
  stickersStore.pendingImageData = {
    type: 'image',
    imageId: image.id,
    width: image.width || 200,
    height: image.height || 150,
    dataUrl: image.preview_url || image.public_url
  }

  if (props.placementTarget === 'drawing') {
    sidePanelsStore.closePanel()
  }
}

/**
 * Убрать из избранного
 */
async function handleToggleFavorite(image) {
  try {
    await removeImageFromFavorites(image.id)
    // Убираем из локального списка
    images.value = images.value.filter(img => img.id !== image.id)
  } catch (e) {
    console.error('[FavoritesTab] Remove favorite error:', e)
    notificationsStore.addNotification({
      message: 'Не удалось убрать из избранного',
      type: 'error',
      duration: 3000
    })
  }
}

onMounted(loadFavorites)
</script>

<template>
  <div class="favorites-tab">
    <!-- Поиск -->
    <div class="favorites-tab__search">
      <input
        v-model="searchQuery"
        type="text"
        class="favorites-tab__search-input"
        :placeholder="t('imageLibrary.searchByName')"
      />
    </div>

    <!-- Загрузка -->
    <div v-if="isLoading" class="favorites-tab__empty">
      <p class="favorites-tab__empty-text">{{ t('common.loading') }}</p>
    </div>

    <!-- Ошибка -->
    <div v-else-if="error" class="favorites-tab__empty">
      <p class="favorites-tab__empty-text">{{ error }}</p>
      <button type="button" class="favorites-tab__retry" @click="loadFavorites">
        {{ t('imageLibrary.retry') }}
      </button>
    </div>

    <!-- Пусто -->
    <div v-else-if="images.length === 0" class="favorites-tab__empty">
      <p class="favorites-tab__empty-text">{{ t('imageLibrary.noFavorites') }}</p>
      <p class="favorites-tab__empty-hint">
        {{ t('imageLibrary.addToFavorites') }}
      </p>
    </div>

    <!-- Нет результатов поиска -->
    <div v-else-if="filteredImages.length === 0" class="favorites-tab__empty">
      <p class="favorites-tab__empty-text">{{ t('imageLibrary.nothingFound') }}</p>
    </div>

    <!-- Сетка изображений -->
    <div v-else class="favorites-tab__grid" @wheel.stop>
      <ImageCard
        v-for="image in filteredImages"
        :key="image.id"
        :image="image"
        :is-favorite="true"
        :show-favorite-button="true"
        @click="handleImageClick"
        @toggle-favorite="handleToggleFavorite"
      />
    </div>
  </div>
</template>

<style scoped>
.favorites-tab {
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* Search */
.favorites-tab__search {
  padding: 16px 16px 12px;
}

.favorites-tab__search-input {
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

.favorites-tab__search-input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.favorites-tab__search-input::placeholder {
  color: #94a3b8;
}

/* Grid */
.favorites-tab__grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  padding: 0 16px 16px;
  overflow-y: auto;
  flex: 1;
}

/* Empty state */
.favorites-tab__empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
}

.favorites-tab__empty-text {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 600;
  color: #0f172a;
}

.favorites-tab__empty-hint {
  margin: 0;
  font-size: 14px;
  color: #64748b;
  line-height: 1.5;
}

.favorites-tab__retry {
  margin-top: 12px;
  padding: 8px 20px;
  border: 1px solid rgba(15, 23, 42, 0.15);
  border-radius: 6px;
  background: #ffffff;
  color: #0f172a;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.favorites-tab__retry:hover {
  background: #f1f5f9;
}

/* Scrollbar */
.favorites-tab__grid::-webkit-scrollbar {
  width: 6px;
}

.favorites-tab__grid::-webkit-scrollbar-track {
  background: transparent;
}

.favorites-tab__grid::-webkit-scrollbar-thumb {
  background: rgba(15, 23, 42, 0.15);
  border-radius: 3px;
}
</style>
