<script setup>
import StickerMessages from './StickerMessages.vue'
import { useSidePanelsStore } from '../../stores/sidePanels.js'
import { useStickersStore } from '../../stores/stickers.js'

const props = defineProps({
  isModernTheme: {
    type: Boolean,
    default: false
  }
})

const sidePanelsStore = useSidePanelsStore()
const stickersStore = useStickersStore()

const handleClose = () => {
  sidePanelsStore.closePanel()
}
</script>

<template>
  <div
    class="sticker-messages-panel"
    :class="{
      'sticker-messages-panel--modern': props.isModernTheme,
      'sticker-messages-panel--no-pointer': stickersStore.isPlacementMode
    }"
  >
    <div class="sticker-messages-panel__header">
      <h2 class="sticker-messages-panel__title">Сообщения стикеров</h2>
      <button
        type="button"
        class="sticker-messages-panel__close"
        title="Закрыть"
        @click="handleClose"
      >
        ×
      </button>
    </div>

    <div class="sticker-messages-panel__content">
      <StickerMessages :isModernTheme="props.isModernTheme" />
    </div>
  </div>
</template>

<style scoped>
.sticker-messages-panel {
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

.sticker-messages-panel--no-pointer {
  pointer-events: none;
  opacity: 0.3;
}

.sticker-messages-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px 24px 16px;
  border-bottom: 1px solid rgba(15, 23, 42, 0.08);
}

.sticker-messages-panel__title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: #1f2937;
}

.sticker-messages-panel__close {
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

.sticker-messages-panel__close:hover {
  background: rgba(239, 68, 68, 0.12);
  color: #dc2626;
  box-shadow: 0 8px 16px rgba(15, 23, 42, 0.12);
  transform: translateY(-1px);
}

.sticker-messages-panel__content {
  flex: 1;
  overflow-y: auto;
  padding: 16px 24px;
}

/* Modern Theme */
.sticker-messages-panel--modern {
  background: rgba(18, 28, 48, 0.96);
  border-right-color: rgba(96, 164, 255, 0.28);
  box-shadow: 4px 0 28px rgba(6, 11, 21, 0.65);
}

.sticker-messages-panel--modern .sticker-messages-panel__header {
  border-bottom-color: rgba(96, 164, 255, 0.22);
}

.sticker-messages-panel--modern .sticker-messages-panel__title {
  color: #e5f3ff;
}

.sticker-messages-panel--modern .sticker-messages-panel__close {
  border-color: rgba(96, 164, 255, 0.35);
  background: rgba(24, 34, 58, 0.92);
  color: #e5f3ff;
  box-shadow: 0 16px 30px rgba(6, 11, 21, 0.6);
}

.sticker-messages-panel--modern .sticker-messages-panel__close:hover {
  background: rgba(248, 113, 113, 0.22);
  color: #fca5a5;
  box-shadow: 0 20px 36px rgba(6, 11, 21, 0.7);
}
</style>
