<script setup>
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { truncateFilename } from '../../utils/imageUtils'
import { useImageProxy } from '../../composables/useImageProxy'

const props = defineProps({
  image: {
    type: Object,
    required: true
  },
  isMyLibrary: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['click', 'delete', 'share-request'])

// Используем composable для загрузки изображений с токеном
const { getImageUrl } = useImageProxy()
const imageSrc = ref('')

// Загружаем изображение при монтировании и при изменении ID
const loadImage = async () => {
  if (props.image?.id) {
    imageSrc.value = await getImageUrl(props.image.id)
  }
}

onMounted(loadImage)
watch(() => props.image?.id, loadImage)

// Освобождаем blob URL при размонтировании компонента
onBeforeUnmount(() => {
  if (imageSrc.value && imageSrc.value.startsWith('blob:')) {
    URL.revokeObjectURL(imageSrc.value)
  }
})

// Вычисляем статус изображения
const imageStatus = computed(() => {
  if (props.image.is_shared) {
    return 'shared'
  }
  if (props.image.share_requested_at) {
    return 'pending'
  }
  return 'normal'
})

const statusLabel = computed(() => {
  switch (imageStatus.value) {
    case 'shared':
      return 'В общей библиотеке'
    case 'pending':
      return 'На модерации'
    default:
      return null
  }
})

const displayName = computed(() => {
  return truncateFilename(props.image.original_name || props.image.filename, 25)
})

const handleClick = () => {
  emit('click', props.image)
}

const handleDelete = (e) => {
  e.stopPropagation()
  emit('delete', props.image)
}

const handleShareRequest = (e) => {
  e.stopPropagation()
  emit('share-request', props.image)
}

// Проверяем, можно ли отправить на модерацию
const canShareRequest = computed(() => {
  return props.isMyLibrary && !props.image.is_shared && !props.image.share_requested_at
})
</script>

<template>
  <div
    class="image-card"
    :class="{
      'image-card--shared': imageStatus === 'shared',
      'image-card--pending': imageStatus === 'pending'
    }"
    @click="handleClick"
  >
    <!-- Миниатюра -->
    <div class="image-card__thumbnail">
      <img
        v-if="imageSrc"
        :src="imageSrc"
        :alt="image.original_name"
        class="image-card__img"
        loading="lazy"
      />
      <div v-else class="image-card__loading">Загрузка...</div>

      <!-- Индикатор статуса -->
      <div v-if="statusLabel" class="image-card__status-badge">
        {{ statusLabel }}
      </div>
      
      <div v-if="isMyLibrary" class="image-card__actions">
        <div class="image-card__actions-row image-card__actions-row--top">
          <!-- Кнопка "Предложить для общего доступа" -->
          <button
            v-if="canShareRequest"
            type="button"
            class="image-card__action image-card__action--share"
            title="Предложить для общего доступа"
            @click="handleShareRequest"
          >
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 8C19.6569 8 21 6.65685 21 5C21 3.34315 19.6569 2 18 2C16.3431 2 15 3.34315 15 5C15 5.12549 15.0077 15.291 15.0227 15.3715L8.08261 11.9015C7.54305 11.3453 6.81024 11 6 11C4.34315 11 3 12.3431 3 14C3 15.6569 4.34315 17 6 17C6.81024 17 7.54305 16.6547 8.08261 16.0985L15.0227 19.5685C15.0077 19.6909 15 19.8155 15 19.941C15 21.5979 16.3431 22.941 18 22.941C19.6569 22.941 21 21.5979 21 19.941C21 18.2841 19.6569 16.941 18 16.941C17.1898 16.941 16.457 17.2863 15.9174 17.8425L8.97733 14.3725C8.99229 14.2501 9 14.1255 9 14C9 13.8745 8.99229 13.7499 8.97733 13.6275L15.9174 10.1575C16.457 10.7137 17.1898 11.059 18 11.059C19.6569 11.059 21 9.71585 21 8.059C21 6.40215 19.6569 5.059 18 5.059V8Z" fill="currentColor"/>
            </svg>
          </button>
        </div>

        <div class="image-card__actions-row image-card__actions-row--bottom">
          <!-- Кнопка удаления -->
          <button
            type="button"
            class="image-card__action image-card__action--delete"
            title="Удалить"
            @click="handleDelete"
          >
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 19C6 20.1 6.9 21 8 21H16C17.1 21 18 20.1 18 19V7H6V19ZM19 4H15.5L14.5 3H9.5L8.5 4H5V6H19V4Z" fill="currentColor"/>
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Информация -->
    <div
      v-if="!isMyLibrary && (image.author_full_name || image.author_personal_id)"
      class="image-card__info"
    >
      <!-- Информация об авторе (для общей библиотеки) -->
      <div class="image-card__author">
        <span v-if="image.author_full_name" class="image-card__author-name">
          {{ image.author_full_name }}
        </span>
        <span v-if="image.author_personal_id" class="image-card__author-id">
          ID: {{ image.author_personal_id }}
        </span>
      </div>
    </div>
  </div>    
</template>

<style scoped>
.image-card {
  position: relative;
  display: flex;
  flex-direction: column;
  background: transparent;
  border-radius: 4px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s ease;
  height: 100%;  
}

.image-card:hover {
  box-shadow: none;
  transform: translateY(-2px);
}

.image-card--shared {
  border-color: #4caf50;
}

.image-card--pending {
  border-color: #ff9800;
}

.image-card__thumbnail {
  position: relative;
  flex: 1 1 auto;
  width: 100%;
  height: 100%;
  background: #f5f5f5;
  overflow: hidden;
}

.image-card__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.image-card__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: #94a3b8;
  font-size: 13px;
}

.image-card__status-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 4px 8px;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  color: #0f172a;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.image-card--shared .image-card__status-badge {
  background: rgba(76, 175, 80, 0.95);
  color: white;
}

.image-card--pending .image-card__status-badge {
  background: rgba(255, 152, 0, 0.95);
  color: white;
}

.image-card__info {
  padding: 8px 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.image-card__author {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 11px;
  color: #64748b;
}

.image-card__author-name {
  font-weight: 500;
  color: #475569;
}

.image-card__author-id {
  font-size: 10px;
  color: #94a3b8;
}

.image-card__actions {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;  
  align-items: flex-end;
  gap: 8px;
  padding: 8px;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.25) 0%, rgba(0, 0, 0, 0.55) 100%);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease;
}

.image-card:hover .image-card__actions {
  opacity: 1;
  pointer-events: auto;
}
.image-card__actions-row {
  display: flex;
  justify-content: flex-end;
  width: 100%;
  pointer-events: none;
}

.image-card__actions-row--bottom {
  align-items: flex-end;
}
.image-card__action {
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  background: transparent;
  color: #64748b;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: auto;  
}

.image-card__action svg {
  width: 18px;
  height: 18px;
}

.image-card__action:hover {
  background: rgba(15, 23, 42, 0.06);
  color: #0f172a;
}

.image-card__action--delete:hover {
  background: rgba(244, 67, 54, 0.1);
  color: #f44336;
}

.image-card__action--share:hover {
  background: rgba(33, 150, 243, 0.1);
  color: #2196f3;
}

.image-card__action:active {
  transform: scale(0.95);
}
</style>
