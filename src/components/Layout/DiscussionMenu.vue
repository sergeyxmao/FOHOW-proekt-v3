<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useBoardCommentsStore } from '../Panels/boardComments.js'
import { useSidePanelsStore } from '../../stores/sidePanels.js'
import { useStickersStore } from '../../stores/stickers.js'
import { useBoardStore } from '../../stores/board.js'
import { useSubscriptionStore } from '../../stores/subscription.js'
import { useAuthStore } from '../../stores/auth.js'
import { useCardsStore } from '../../stores/cards.js'
import { useNotificationsStore } from '../../stores/notifications'

const API_URL = import.meta.env.VITE_API_URL || 'https://interactive.marketingfohow.ru/api'
const props = defineProps({
  isModernTheme: {
    type: Boolean,
    default: false
  }
})
const emit = defineEmits(['request-close'])
const { t } = useI18n()

const boardCommentsStore = useBoardCommentsStore()
const sidePanelsStore = useSidePanelsStore()
const stickersStore = useStickersStore()
const boardStore = useBoardStore()
const subscriptionStore = useSubscriptionStore()
const authStore = useAuthStore()
const cardsStore = useCardsStore()
const notificationsStore = useNotificationsStore()

const { hasComments: hasBoardComments } = storeToRefs(boardCommentsStore)
const {
  isNotesOpen,
  isCommentsOpen,
  isStickerMessagesOpen,
  isImagesOpen,
  isAnchorsOpen,
  isPartnersOpen
} = storeToRefs(sidePanelsStore)
const { placementMode } = storeToRefs(boardStore)
const { currentBoardId } = storeToRefs(boardStore)
const isUserCardBoard = computed(() => cardsStore.cards.some(card => card.type === 'user_card'))  
const createDefaultCounters = () => ({
  partners: 0,
  notes: 0,
  images: '0/0',
  comments: 0,
  geolocation: 0,
  stickers: 0
})
const counters = ref(createDefaultCounters())
const countersLoading = ref(false)
// Проверка доступа к библиотеке изображений
const canUseImages = computed(() => subscriptionStore.checkFeature('can_use_images'))
const hasPartners = computed(() => Number(counters.value.partners || 0) > 0)
  // Загружает счётчик изображений отдельно (не зависит от доски).
  // Возвращает строку "N/M" или null если не удалось загрузить.
  const loadImageCounters = async () => {
  if (!authStore.token) return null

  try {
    const response = await fetch(
      `${API_URL}/images/my/counters`,
      {
        headers: {
          Authorization: `Bearer ${authStore.token}`
        }
      }
    )

    const data = await response.json()
    if (response.ok && data?.success) {
      return `${data.user_images}/${data.total_images}`
    }
  } catch (error) {
    // Эндпоинт может быть ещё не задеплоен — это не критичная ошибка
  }
  return null
}

  const loadDiscussionCounters = async () => {
  countersLoading.value = true

  try {
    // Счётчик изображений загружаем всегда (не зависит от доски)
    const imageCounterValue = await loadImageCounters()
    if (imageCounterValue) {
      counters.value = { ...counters.value, images: imageCounterValue }
    }

    if (!currentBoardId.value || !authStore.token) {
      countersLoading.value = false
      return
    }

    const response = await fetch(
      `${API_URL}/boards/${currentBoardId.value}/discussion-counters`,
      {
        headers: {
          Authorization: `Bearer ${authStore.token}`
        }
      }
    )

    const data = await response.json()
    if (response.ok && data?.success) {
      counters.value = {
        ...data.counters,
        // Если отдельный эндпоинт сработал — используем его, иначе берём из discussion-counters
        images: imageCounterValue || data.counters.images
      }
    }
  } catch (error) {
    console.error('Failed to load counters:', error)
  } finally {
    countersLoading.value = false
  }
}

onMounted(() => {
  loadDiscussionCounters()
})

watch(currentBoardId, () => {
  loadDiscussionCounters()
})  
const handlePartnersToggle = () => {
  if (!hasPartners.value && !countersLoading.value) {
    alert('На доске нет партнёров')
    return
  }  
  sidePanelsStore.togglePartners()
  emit('request-close')
}

const handleNotesToggle = () => {
  if (isUserCardBoard.value) {
    return
  }  
  sidePanelsStore.toggleNotes()
  emit('request-close')
}

const handleCommentsToggle = () => {
  sidePanelsStore.toggleComments()
  emit('request-close')
}
const handleImagesToggle = () => {
  sidePanelsStore.toggleImages()
  emit('request-close')
}

const handleStickerMessagesToggle = () => {
  if (!currentBoardId.value) {
    notificationsStore.addNotification({ message: 'Сначала откройте доску', type: 'info', duration: 4000 })
    emit('request-close')
    return
  }
  sidePanelsStore.toggleStickerMessages()
  emit('request-close')
}
const handleAnchorsToggle = () => {
  if (isUserCardBoard.value) {
    return
  }
  if (!currentBoardId.value) {
    notificationsStore.addNotification({ message: 'Сначала откройте доску', type: 'info', duration: 4000 })
    emit('request-close')
    return
  }
  // Сбрасываем режим стикера, если был активен
  stickersStore.disablePlacementMode()
  const nextMode = placementMode.value === 'anchor' ? null : 'anchor'
  boardStore.setPlacementMode(nextMode)
  if (nextMode) {
    sidePanelsStore.openAnchors()
  }
  emit('request-close')
}

const handleAnchorsPanelOpen = () => {
  if (isUserCardBoard.value) {
    return
  }
  if (!currentBoardId.value) {
    notificationsStore.addNotification({ message: 'Сначала откройте доску', type: 'info', duration: 4000 })
    emit('request-close')
    return
  }
  sidePanelsStore.openAnchors()
  emit('request-close')
}
watch(isUserCardBoard, (isAvatarMode) => {
  if (!isAvatarMode) {
    return
  }
  if (placementMode.value === 'anchor') {
    boardStore.setPlacementMode(null)
  }
})

const handleAddSticker = () => {
  if (!currentBoardId.value) {
    notificationsStore.addNotification({ message: 'Сначала откройте доску', type: 'info', duration: 4000 })
    emit('request-close')
    return
  }
  // Сбрасываем режим якоря, если был активен
  boardStore.setPlacementMode(null)
  sidePanelsStore.openStickerMessages()
  stickersStore.enablePlacementMode()
  emit('request-close')
}
</script>

<template>
  <div
    class="discussion-menu"
    :class="{ 'discussion-menu--modern': props.isModernTheme }"
  >
    <div class="discussion-menu__title">{{ t('elementsMenu.title') }}</div>

    <div class="discussion-menu__item">
      <div class="discussion-menu__avatar-wrapper">
        <img
          v-if="authStore.user?.avatar_url"
          :src="authStore.user.avatar_url"
          alt="Avatar"
          class="discussion-menu__avatar"
        >
        <div v-else class="discussion-menu__avatar-placeholder">
          {{ (authStore.user?.username || authStore.user?.email || 'U').charAt(0).toUpperCase() }}
        </div>
      </div>
      <button
        type="button"
        class="discussion-menu__action"
        :class="{ 'discussion-menu__action--active': isPartnersOpen }"
        @click="handlePartnersToggle"
      >
        Партнеры
        <span class="discussion-menu__info" @click.stop>&#9432;<span class="discussion-menu__tooltip" v-html="t('elementsMenu.tooltips.partners')"></span></span>
      </button>
      <span class="discussion-menu__counter">
        <template v-if="countersLoading">...</template>
        <template v-else>{{ counters.partners }}</template>
      </span>
    </div>

    <div class="discussion-menu__item">
      <span class="discussion-menu__icon" aria-hidden="true">📅</span>
      <button
        type="button"
        class="discussion-menu__action"
        :class="{ 'discussion-menu__action--active': isNotesOpen }"
        :disabled="isUserCardBoard"        
        @click="handleNotesToggle"
      >
        {{ t('elementsMenu.notesList') }}
        <span class="discussion-menu__info" @click.stop>&#9432;<span class="discussion-menu__tooltip" v-html="t('elementsMenu.tooltips.notesList')"></span></span>
      </button>
      <span class="discussion-menu__counter">
        <template v-if="countersLoading">...</template>
        <template v-else>{{ counters.notes }}</template>
      </span>      
    </div>

    <div v-if="canUseImages" class="discussion-menu__item">
      <span class="discussion-menu__icon" aria-hidden="true">🖼️</span>
      <button
        type="button"
        class="discussion-menu__action"
        :class="{ 'discussion-menu__action--active': isImagesOpen }"
        @click="handleImagesToggle"
      >
        Изображения
        <span class="discussion-menu__info" @click.stop>&#9432;<span class="discussion-menu__tooltip" v-html="t('elementsMenu.tooltips.images')"></span></span>
      </button>
      <span class="discussion-menu__counter">
        <template v-if="countersLoading">...</template>
        <template v-else>{{ counters.images }}</template>
      </span>
    </div>

    <div class="discussion-menu__item">
      <span class="discussion-menu__icon" aria-hidden="true">💬</span>
      <button
        type="button"
        class="discussion-menu__action"
        :class="{ 'discussion-menu__action--active': isCommentsOpen }"
        @click="handleCommentsToggle"
      >
        {{ t('elementsMenu.boardComments') }}
        <span class="discussion-menu__info" @click.stop>&#9432;<span class="discussion-menu__tooltip" v-html="t('elementsMenu.tooltips.boardComments')"></span></span>
      </button>
      <span class="discussion-menu__counter">
        <template v-if="countersLoading">...</template>
        <template v-else>{{ counters.comments }}</template>
      </span>      
      <span
        v-if="hasBoardComments"
        class="discussion-menu__badge"
        aria-hidden="true"
      ></span>
    </div>
    <div class="discussion-menu__item">
      <span class="discussion-menu__icon" aria-hidden="true">🧭</span>
      <button
        type="button"
        class="discussion-menu__action"
        :class="{ 'discussion-menu__action--active': isAnchorsOpen }"
        :disabled="isUserCardBoard"
        @click="handleAnchorsPanelOpen"
      >
        {{ t('elementsMenu.geolocation') }}
        <span class="discussion-menu__info" @click.stop>&#9432;<span class="discussion-menu__tooltip" v-html="t('elementsMenu.tooltips.geolocation')"></span></span>
      </button>
      <button
        type="button"
        class="discussion-menu__add-btn"
        :class="{ 'discussion-menu__add-btn--active': placementMode === 'anchor' }"
        :disabled="isUserCardBoard"
        @click="handleAnchorsToggle"
        :title="t('elementsMenu.setAnchor')"
      >
        +
      </button>
      <span class="discussion-menu__counter">
        <template v-if="countersLoading">...</template>
        <template v-else>{{ counters.geolocation }}</template>
      </span>
    </div>

    <div class="discussion-menu__item">
      <span class="discussion-menu__icon" aria-hidden="true">📌</span>
      <button
        type="button"
        class="discussion-menu__action"
        :class="{ 'discussion-menu__action--active': isStickerMessagesOpen }"
        @click="handleStickerMessagesToggle"
      >
        {{ t('elementsMenu.stickerMessages') }}
        <span class="discussion-menu__info" @click.stop>&#9432;<span class="discussion-menu__tooltip" v-html="t('elementsMenu.tooltips.stickerMessages')"></span></span>
      </button>
      <button
        type="button"
        class="discussion-menu__add-btn"
        @click="handleAddSticker"
        :title="t('elementsMenu.addSticker')"
      >
        +
      </button>
      <span class="discussion-menu__counter">
        <template v-if="countersLoading">...</template>
        <template v-else>{{ counters.stickers }}</template>
      </span>
    </div>
  </div>
</template>

<style scoped>
.discussion-menu {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  min-width: 280px;
}

.discussion-menu__title {
  font-size: 15px;
  font-weight: 700;
  color: #1f2937;
}

.discussion-menu__item {
  display: flex;
  align-items: center;
  gap: 12px;
  position: relative;
}

.discussion-menu__icon {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 14px;
  background: rgba(59, 130, 246, 0.12);
  font-size: 20px;
}

.discussion-menu__avatar-wrapper {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  flex-shrink: 0;
}

.discussion-menu__avatar {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid rgba(59, 130, 246, 0.3);
}

.discussion-menu__avatar-placeholder {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: #ffffff;
  display: grid;
  place-items: center;
  font-size: 16px;
  font-weight: 700;
  border: 2px solid rgba(59, 130, 246, 0.3);
}

.discussion-menu__action {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  text-align: left;
  padding: 12px 16px;
  border-radius: 14px;
  border: 1px solid rgba(15, 23, 42, 0.12);
  background: rgba(255, 255, 255, 0.92);
  color: #0f172a;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
}

.discussion-menu__action:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.discussion-menu__action:not(:disabled):hover {
  background: #ffc107;
  color: #000000;
  border-color: rgba(255, 193, 7, 0.8);
  transform: translateY(-1px);
  box-shadow: 0 12px 20px rgba(255, 193, 7, 0.3);
}

.discussion-menu__action--active {
  background: #ffc107;
  color: #000000;
  border-color: rgba(255, 193, 7, 0.8);
  box-shadow: 0 16px 28px rgba(255, 193, 7, 0.35);
}
.discussion-menu__add-btn {
  width: 38px;
  height: 38px;
  flex-shrink: 0;
  border-radius: 12px;
  border: 1px solid rgba(15, 23, 42, 0.12);
  background: rgba(255, 255, 255, 0.92);
  color: #0f172a;
  font-size: 20px;
  font-weight: 700;
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: background 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
}

.discussion-menu__add-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.discussion-menu__add-btn:not(:disabled):hover {
  background: #ffc107;
  color: #000000;
  border-color: rgba(255, 193, 7, 0.8);
  transform: translateY(-1px);
  box-shadow: 0 8px 16px rgba(255, 193, 7, 0.25);
}

.discussion-menu__add-btn--active {
  background: #ffc107;
  color: #000000;
  border-color: rgba(255, 193, 7, 0.8);
  box-shadow: 0 8px 16px rgba(255, 193, 7, 0.25);
}

.discussion-menu__counter {
  margin-left: auto;
  padding: 4px 10px;
  min-width: 44px;
  text-align: center;
  background-color: #e5e7eb;
  color: #111827;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.2px;
  border: 1px solid rgba(15, 23, 42, 0.12);
}

.discussion-menu__counter:empty {
  display: none;
}

.discussion-menu__badge {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.18);
}
.discussion-menu--modern .discussion-menu__title {
  color: #e5f3ff;
}

.discussion-menu--modern .discussion-menu__icon {
  background: rgba(114, 182, 255, 0.18);
  color: #e5f3ff;
}

.discussion-menu--modern .discussion-menu__avatar {
  border-color: rgba(114, 182, 255, 0.5);
}

.discussion-menu--modern .discussion-menu__avatar-placeholder {
  background: linear-gradient(135deg, #73c8ff 0%, #2563eb 100%);
  border-color: rgba(114, 182, 255, 0.5);
}

.discussion-menu--modern .discussion-menu__action {
  border-color: rgba(96, 164, 255, 0.35);
  background: rgba(24, 34, 58, 0.94);
  color: #e5f3ff;
  box-shadow: 0 18px 32px rgba(6, 11, 21, 0.58);
}
.discussion-menu--modern .discussion-menu__counter {
  background: rgba(114, 182, 255, 0.14);
  color: #e5f3ff;
  border-color: rgba(96, 164, 255, 0.35);
}
.discussion-menu--modern .discussion-menu__action:not(:disabled):hover {
  background: #ffc107;
  color: #000000;
  border-color: rgba(255, 193, 7, 0.85);
  box-shadow: 0 24px 40px rgba(255, 193, 7, 0.4);
}

.discussion-menu--modern .discussion-menu__action--active {
  background: #ffc107;
  color: #000000;
  border-color: rgba(255, 193, 7, 0.85);
  box-shadow: 0 26px 44px rgba(255, 193, 7, 0.4);
}

.discussion-menu--modern .discussion-menu__badge {
  background: #73c8ff;
  box-shadow: 0 0 0 3px rgba(114, 182, 255, 0.3);
}

.discussion-menu--modern .discussion-menu__add-btn {
  border-color: rgba(96, 164, 255, 0.35);
  background: rgba(24, 34, 58, 0.94);
  color: #e5f3ff;
}

.discussion-menu--modern .discussion-menu__add-btn:not(:disabled):hover,
.discussion-menu--modern .discussion-menu__add-btn--active {
  background: #ffc107;
  color: #000000;
  border-color: rgba(255, 193, 7, 0.85);
  box-shadow: 0 18px 30px rgba(255, 193, 7, 0.35);
}

/* Info icon — скрыт по умолчанию, появляется при наведении на кнопку */
.discussion-menu__info {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  font-size: 16px;
  border-radius: 50%;
  color: rgba(15, 23, 42, 0.35);
  opacity: 0;
  transition: opacity 0.2s ease, color 0.15s ease;
  cursor: help;
  flex-shrink: 0;
  margin-left: auto;
}

.discussion-menu__action:hover .discussion-menu__info {
  opacity: 1;
  color: rgba(0, 0, 0, 0.45);
}

.discussion-menu__info:hover {
  color: rgba(0, 0, 0, 0.7) !important;
}

/* Modern theme — info icon */
.discussion-menu--modern .discussion-menu__info {
  color: rgba(229, 243, 255, 0.35);
}

.discussion-menu--modern .discussion-menu__action:hover .discussion-menu__info {
  color: rgba(0, 0, 0, 0.45);
}

.discussion-menu--modern .discussion-menu__info:hover {
  color: rgba(0, 0, 0, 0.7) !important;
}

/* Tooltip — появляется при наведении на ⓘ */
.discussion-menu__tooltip {
  position: absolute;
  left: calc(100% + 14px);
  top: 50%;
  transform: translateY(-50%);
  width: 230px;
  padding: 10px 14px;
  background: rgba(15, 23, 42, 0.94);
  color: #f1f5f9;
  font-size: 12.5px;
  font-weight: 400;
  line-height: 1.5;
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.22);
  white-space: normal;
  text-align: left;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.2s ease;
  z-index: 10;
}

.discussion-menu__tooltip::before {
  content: '';
  position: absolute;
  right: 100%;
  top: 50%;
  transform: translateY(-50%);
  border: 6px solid transparent;
  border-right-color: rgba(15, 23, 42, 0.94);
}

.discussion-menu__info:hover .discussion-menu__tooltip {
  opacity: 1;
}

/* Modern theme — tooltip */
.discussion-menu--modern .discussion-menu__tooltip {
  background: rgba(30, 42, 70, 0.96);
  border: 1px solid rgba(96, 164, 255, 0.25);
  box-shadow: 0 8px 24px rgba(6, 11, 21, 0.4);
}

.discussion-menu--modern .discussion-menu__tooltip::before {
  border-right-color: rgba(30, 42, 70, 0.96);
}
</style>
