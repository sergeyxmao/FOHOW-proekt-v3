<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import UserComments from './UserComments.vue'
import PanelSwitchBar from './PanelSwitchBar.vue'
import { useSidePanelsStore } from '../../stores/sidePanels.js'
import { useStickersStore } from '../../stores/stickers.js'

const { t } = useI18n()

const props = defineProps({
  isModernTheme: {
    type: Boolean,
    default: false
  }
})

const sidePanelsStore = useSidePanelsStore()
const stickersStore = useStickersStore()
const userCommentsRef = ref(null)

const handleClose = () => {
  sidePanelsStore.closePanel()
}
</script>

<template>
  <div
    class="comments-side-panel"
    :class="{
      'comments-side-panel--modern': props.isModernTheme,
      'comments-side-panel--no-pointer': stickersStore.isPlacementMode
    }"
  >
    <div class="comments-side-panel__header">
      <h2 class="comments-side-panel__title">{{ t('elementsMenu.boardComments') }}</h2>
      <div v-if="userCommentsRef" class="comments-side-panel__colors">
        <button
          v-for="color in userCommentsRef.colorPalette"
          :key="color"
          type="button"
          class="comments-side-panel__color-btn"
          :class="{ 'comments-side-panel__color-btn--active': userCommentsRef.newCommentColor === color }"
          :style="{ backgroundColor: color }"
          @click="userCommentsRef.newCommentColor = color"
        />
      </div>
      <button
        type="button"
        class="comments-side-panel__close"
        :title="t('common.close')"
        @click="handleClose"
      >
        ×
      </button>
    </div>

    <PanelSwitchBar :is-modern-theme="isModernTheme" />

    <div class="comments-side-panel__content">
      <UserComments ref="userCommentsRef" />
    </div>
  </div>
</template>

<style scoped>
.comments-side-panel {
  position: fixed;
  left: 0;
  top: 0;
  bottom: 0;
  width: 380px;
  background: rgba(255, 255, 255, 0.98);
  border-right: 1px solid rgba(15, 23, 42, 0.12);
  box-shadow: 4px 0 24px rgba(15, 23, 42, 0.18);
  z-index: 2000;
  display: flex;
  flex-direction: column;
  backdrop-filter: blur(8px);
}

.comments-side-panel--no-pointer {
  pointer-events: none;
  opacity: 0.3;
}

.comments-side-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px 24px 16px;
  border-bottom: 1px solid rgba(15, 23, 42, 0.08);
}

.comments-side-panel__title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: #1f2937;
}

.comments-side-panel__colors {
  display: flex;
  gap: 6px;
  margin-left: auto;
  margin-right: 12px;
}

.comments-side-panel__color-btn {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: 2px solid transparent;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.comments-side-panel__color-btn:hover {
  transform: scale(1.1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.comments-side-panel__color-btn--active {
  border-color: #1f2937;
  box-shadow: 0 0 0 2px rgba(31, 41, 55, 0.2);
}

.comments-side-panel__close {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  border: 1px solid rgba(15, 23, 42, 0.12);
  background: rgba(248, 250, 252, 0.92);
  color: #0f172a;
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: background 0.2s ease, color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
}

.comments-side-panel__close:hover {
  background: rgba(239, 68, 68, 0.12);
  color: #dc2626;
  box-shadow: 0 8px 16px rgba(15, 23, 42, 0.12);
  transform: translateY(-1px);
}

.comments-side-panel__content {
  flex: 1;
  overflow-y: auto;
  padding: 16px 24px;
}

/* Modern Theme */
.comments-side-panel--modern {
  background: rgba(18, 28, 48, 0.96);
  border-right-color: rgba(96, 164, 255, 0.28);
  box-shadow: 4px 0 28px rgba(6, 11, 21, 0.65);
}

.comments-side-panel--modern .comments-side-panel__header {
  border-bottom-color: rgba(96, 164, 255, 0.22);
}

.comments-side-panel--modern .comments-side-panel__title {
  color: #e5f3ff;
}

.comments-side-panel--modern .comments-side-panel__close {
  border-color: rgba(96, 164, 255, 0.35);
  background: rgba(24, 34, 58, 0.92);
  color: #e5f3ff;
  box-shadow: 0 16px 30px rgba(6, 11, 21, 0.6);
}

.comments-side-panel--modern .comments-side-panel__close:hover {
  background: rgba(248, 113, 113, 0.22);
  color: #fca5a5;
  box-shadow: 0 20px 36px rgba(6, 11, 21, 0.7);
}
</style>
