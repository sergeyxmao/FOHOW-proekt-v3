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
const isGeolocationMenuOpen = ref(false)
const isStickersMenuOpen = ref(false)
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
  const loadDiscussionCounters = async () => {
  countersLoading.value = true

  try {
    if (!currentBoardId.value || !authStore.token) {
      counters.value = createDefaultCounters()
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
      counters.value = data.counters
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

const toggleGeolocationMenu = () => {
  if (isUserCardBoard.value) {
    return
  }  
  isGeolocationMenuOpen.value = !isGeolocationMenuOpen.value
  if (isGeolocationMenuOpen.value) {
    isStickersMenuOpen.value = false
  }
}

const toggleStickersMenu = () => {
  isStickersMenuOpen.value = !isStickersMenuOpen.value
  if (isStickersMenuOpen.value) {
    isGeolocationMenuOpen.value = false
  }
}

const handleStickerMessagesToggle = () => {
  sidePanelsStore.toggleStickerMessages()
  isStickersMenuOpen.value = false  
  emit('request-close')
}
const handleAnchorsToggle = () => {
  if (isUserCardBoard.value) {
    return
  }  
  const nextMode = placementMode.value === 'anchor' ? null : 'anchor'
  boardStore.setPlacementMode(nextMode)
  if (nextMode) {
    sidePanelsStore.openAnchors()
  }
  isGeolocationMenuOpen.value = false  
  emit('request-close')
}

const handleAnchorsPanelOpen = () => {
  if (isUserCardBoard.value) {
    return
  }  
  sidePanelsStore.openAnchors()
  isGeolocationMenuOpen.value = false
  emit('request-close')
}
watch(isUserCardBoard, (isAvatarMode) => {
  if (!isAvatarMode) {
    return
  }

  isGeolocationMenuOpen.value = false
  isStickersMenuOpen.value = false
  if (placementMode.value === 'anchor') {
    boardStore.setPlacementMode(null)
  }
})

const handleAddSticker = () => {
  if (!currentBoardId.value) {
    alert(t('discussionMenu.createStructureAlert'))
    emit('request-close')
    return
  }
  sidePanelsStore.openStickerMessages()  
  stickersStore.enablePlacementMode()
  isStickersMenuOpen.value = false  
  emit('request-close')
}
</script>

<template>
  <div
    class="discussion-menu"
    :class="{ 'discussion-menu--modern': props.isModernTheme }"
  >
    <div class="discussion-menu__title">{{ t('discussionMenu.title') }}</div>

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
      </button>
      <span class="discussion-menu__counter">
        <template v-if="countersLoading">...</template>
        <template v-else>{{ counters.partners }}</template>
      </span>
    </div>

    <div class="discussion-menu__item">
      <span class="discussion-menu__icon" aria-hidden="true">🗒️</span>
      <button
        type="button"
        class="discussion-menu__action"
        :class="{ 'discussion-menu__action--active': isNotesOpen }"
        :disabled="isUserCardBoard"        
        @click="handleNotesToggle"
      >
        {{ t('discussionMenu.notesList') }}
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
        {{ t('discussionMenu.boardComments') }}
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
    <div class="discussion-menu__item discussion-menu__item--has-children">
      <span class="discussion-menu__icon" aria-hidden="true">🧭</span>
      <div class="discussion-menu__item-content">
        <div class="discussion-menu__item-header">
          <button
            type="button"
            class="discussion-menu__action"
            :disabled="isUserCardBoard"          
            :class="{ 'discussion-menu__action--active': isAnchorsOpen || placementMode === 'anchor' }"
            @click="toggleGeolocationMenu"
          >
            {{ t('discussionMenu.geolocation') }}
          </button>
          <span class="discussion-menu__counter">
            <template v-if="countersLoading">...</template>
            <template v-else>{{ counters.geolocation }}</template>
          </span>
        </div>
        <transition name="top-menu-fade">
          <div v-if="isGeolocationMenuOpen" class="discussion-menu__submenu">
            <button
              type="button"
              class="discussion-menu__subaction"
              :class="{ 'discussion-menu__subaction--active': placementMode === 'anchor' }"
               :disabled="isUserCardBoard"            
              @click="handleAnchorsToggle"
            >
              {{ t('discussionMenu.setAnchor') }}
            </button>
            <button
              type="button"
              class="discussion-menu__subaction"
              :class="{ 'discussion-menu__subaction--active': isAnchorsOpen }"
               :disabled="isUserCardBoard"             
              @click="handleAnchorsPanelOpen"
            >
              {{ t('discussionMenu.boardAnchors') }}
            </button>
          </div>
        </transition>
      </div>
    </div>

    <div class="discussion-menu__item discussion-menu__item--has-children">
      <span class="discussion-menu__icon" aria-hidden="true">📌</span>
      <div class="discussion-menu__item-content">
        <div class="discussion-menu__item-header">
          <button
            type="button"
            class="discussion-menu__action"
            :class="{ 'discussion-menu__action--active': isStickerMessagesOpen }"
            @click="toggleStickersMenu"
          >
            {{ t('discussionMenu.stickerMessages') }}
          </button>
          <span class="discussion-menu__counter">
            <template v-if="countersLoading">...</template>
            <template v-else>{{ counters.stickers }}</template>
          </span>
        </div>
        <transition name="top-menu-fade">
          <div v-if="isStickersMenuOpen" class="discussion-menu__submenu">
            <button
              type="button"
              class="discussion-menu__subaction"
              :class="{ 'discussion-menu__subaction--active': isStickerMessagesOpen }"
              @click="handleStickerMessagesToggle"
            >
              {{ t('discussionMenu.allStickers') }}
            </button>
            <button
              type="button"
              class="discussion-menu__subaction"
              @click="handleAddSticker"
            >
              {{ t('discussionMenu.addSticker') }}
            </button>
          </div>
        </transition>
      </div>
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
.discussion-menu__item-header {
  display: flex;
  align-items: center;
  gap: 10px;
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
  background: rgba(59, 130, 246, 0.16);
  transform: translateY(-1px);
  box-shadow: 0 12px 20px rgba(15, 23, 42, 0.12);
}

.discussion-menu__action--active {
  background: linear-gradient(120deg, #3b82f6 0%, #2563eb 100%);
  color: #fff;
  box-shadow: 0 16px 28px rgba(37, 99, 235, 0.32);
}
.discussion-menu__item-content {
  flex: 1;
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

.discussion-menu__submenu {
  margin-top: 8px;
  display: grid;
  gap: 8px;
}

.discussion-menu__subaction {
  width: 100%;
  text-align: left;
  padding: 10px 14px;
  border-radius: 12px;
  border: 1px solid rgba(15, 23, 42, 0.12);
  background: rgba(248, 250, 252, 0.92);
  color: #0f172a;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
}

.discussion-menu__subaction:not(:disabled):hover {
  background: rgba(59, 130, 246, 0.12);
  transform: translateY(-1px);
  box-shadow: 0 8px 16px rgba(15, 23, 42, 0.12);
}

.discussion-menu__subaction--active {
  background: linear-gradient(120deg, #93c5fd 0%, #3b82f6 100%);
  color: #0b1324;
  box-shadow: 0 14px 26px rgba(37, 99, 235, 0.24);
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
  background: rgba(96, 164, 255, 0.22);
  color: #0b1324;
  box-shadow: 0 24px 40px rgba(6, 11, 21, 0.7);
}

.discussion-menu--modern .discussion-menu__action--active {
  background: linear-gradient(120deg, #73c8ff 0%, #2563eb 100%);
  color: #051125;
  box-shadow: 0 26px 44px rgba(6, 11, 21, 0.78);
}

.discussion-menu--modern .discussion-menu__badge {
  background: #73c8ff;
  box-shadow: 0 0 0 3px rgba(114, 182, 255, 0.3);
}

.discussion-menu--modern .discussion-menu__subaction {
  border-color: rgba(96, 164, 255, 0.35);
  background: rgba(24, 34, 58, 0.94);
  color: #e5f3ff;
  box-shadow: 0 14px 26px rgba(6, 11, 21, 0.58);
}

.discussion-menu--modern .discussion-menu__subaction:not(:disabled):hover {
  background: rgba(96, 164, 255, 0.22);
  color: #0b1324;
  box-shadow: 0 18px 30px rgba(6, 11, 21, 0.7);
}

.discussion-menu--modern .discussion-menu__subaction--active {
  background: linear-gradient(120deg, #73c8ff 0%, #2563eb 100%);
  color: #051125;
  box-shadow: 0 22px 36px rgba(6, 11, 21, 0.78);
}  
</style>
