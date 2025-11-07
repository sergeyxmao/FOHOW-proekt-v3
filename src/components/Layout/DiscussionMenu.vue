<script setup>
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useNotesStore } from '../../stores/notes.js'
import { useBoardCommentsStore } from '../Panels/boardComments.js'
import { useSidePanelsStore } from '../../stores/sidePanels.js'
import { useStickersStore } from '../../stores/stickers.js'

const props = defineProps({
  isModernTheme: {
    type: Boolean,
    default: false
  }
})
const emit = defineEmits(['request-close'])

const notesStore = useNotesStore()
const boardCommentsStore = useBoardCommentsStore()
const sidePanelsStore = useSidePanelsStore()
const stickersStore = useStickersStore()

const { hasComments: hasBoardComments } = storeToRefs(boardCommentsStore)
const { isNotesOpen, isCommentsOpen, isStickerMessagesOpen } = storeToRefs(sidePanelsStore)
const { currentBoardId } = storeToRefs(stickersStore)

const hasNoteEntries = computed(() => notesStore.hasEntries)

const handleNotesToggle = () => {
  if (!hasNoteEntries.value) {
    return
  }
  sidePanelsStore.toggleNotes()
  emit('request-close')
}

const handleCommentsToggle = () => {
  sidePanelsStore.toggleComments()
  emit('request-close')
}

const handleStickerMessagesToggle = () => {
  sidePanelsStore.toggleStickerMessages()
  emit('request-close')
}

const handleAddSticker = () => {
  if (!currentBoardId.value) {
    alert('Пожалуйста, создайте новую структуру или войдите в существующую, чтобы добавить стикер.')
    emit('request-close')
    return
  }
  stickersStore.enablePlacementMode()
  emit('request-close')
}
</script>

<template>
  <div
    class="discussion-menu"
    :class="{ 'discussion-menu--modern': props.isModernTheme }"
  >
    <div class="discussion-menu__title">Обсуждение</div>

    <div class="discussion-menu__item">
      <span class="discussion-menu__icon" aria-hidden="true">🗒️</span>
      <button
        type="button"
        class="discussion-menu__action"
        :class="{ 'discussion-menu__action--active': isNotesOpen }"
        :disabled="!hasNoteEntries"
        @click="handleNotesToggle"
      >
        Список заметок
      </button>
    </div>

    <div class="discussion-menu__item">
      <span class="discussion-menu__icon" aria-hidden="true">💬</span>
      <button
        type="button"
        class="discussion-menu__action"
        :class="{ 'discussion-menu__action--active': isCommentsOpen }"
        @click="handleCommentsToggle"
      >
        Комментарии доски
      </button>
      <span
        v-if="hasBoardComments"
        class="discussion-menu__badge"
        aria-hidden="true"
      ></span>
    </div>

    <div class="discussion-menu__item">
      <span class="discussion-menu__icon" aria-hidden="true">📌</span>
      <button
        type="button"
        class="discussion-menu__action"
        :class="{ 'discussion-menu__action--active': isStickerMessagesOpen }"
        @click="handleStickerMessagesToggle"
      >
        Сообщения стикеров
      </button>
    </div>

    <div class="discussion-menu__item">
      <span class="discussion-menu__icon" aria-hidden="true">📝</span>
      <button
        type="button"
        class="discussion-menu__action"
        @click="handleAddSticker"
      >
        Добавить стикер
      </button>
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

.discussion-menu--modern .discussion-menu__action {
  border-color: rgba(96, 164, 255, 0.35);
  background: rgba(24, 34, 58, 0.94);
  color: #e5f3ff;
  box-shadow: 0 18px 32px rgba(6, 11, 21, 0.58);
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
</style>
