<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import PanelSwitchBar from './PanelSwitchBar.vue'
import { useBoardStore } from '../../stores/board.js'
import { useSidePanelsStore } from '../../stores/sidePanels.js'
import { useAnchorsStore } from '../../stores/anchors.js'
import { useMobileStore } from '../../stores/mobile.js'

const props = defineProps({
  isModernTheme: {
    type: Boolean,
    default: false
  }
})

const { t } = useI18n()
const boardStore = useBoardStore()
const sidePanelsStore = useSidePanelsStore()
const anchorsStore = useAnchorsStore()
const mobileStore = useMobileStore()  

const { selectedAnchorId, pendingEditAnchorId } = storeToRefs(boardStore)
const { anchors } = storeToRefs(anchorsStore)
  
const editingAnchorId = ref(null)
const editText = ref('')
const textareaRef = ref(null)
const searchQuery = ref('')
  
const sortedAnchors = computed(() => {
  return [...anchors.value].sort((a, b) => {
    const dateA = a.created_at ? new Date(a.created_at).getTime() : 0
    const dateB = b.created_at ? new Date(b.created_at).getTime() : 0
    return dateB - dateA
  })
})
const filteredAnchors = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) {
    return sortedAnchors.value
  }

  return sortedAnchors.value.filter(anchor =>
    anchor.description?.toLowerCase().includes(query)
  )
})

const handleClose = () => {
  sidePanelsStore.closePanel()
}

const formatDateTime = (value) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  return date.toLocaleString()
}

const handleSelect = (anchorId) => {
  boardStore.focusAnchor(anchorId)
  if (mobileStore.isMobileMode) {
    sidePanelsStore.closePanel()
  }
}

const handleStartEdit = (anchor) => {
  editingAnchorId.value = anchor.id
  editText.value = anchor.description || ''
  boardStore.requestAnchorEdit(anchor.id)
  nextTick(() => {
    textareaRef.value?.focus()
  })
}

const handleSave = async (anchorId) => {
  await anchorsStore.updateAnchorDescription(anchorId, editText.value)
  editingAnchorId.value = null
  boardStore.clearPendingAnchorEdit()
}

const handleDelete = async (anchorId) => {
  await anchorsStore.deleteAnchor(anchorId)
  if (selectedAnchorId.value === anchorId) {
    boardStore.selectAnchor(null)
  }
  boardStore.clearPendingAnchorEdit()  
}

watch(pendingEditAnchorId, (anchorId) => {
  if (!anchorId) {
    return
  }
  const anchor = anchors.value.find(item => item.id === anchorId)
  if (!anchor) {
    return
  }
  handleStartEdit(anchor)
})

watch(anchors, () => {
  if (editingAnchorId.value && !anchors.value.some(item => item.id === editingAnchorId.value)) {
    editingAnchorId.value = null
  }
})
</script>

<template>
  <div
    class="anchors-panel"
    :class="{ 'anchors-panel--modern': props.isModernTheme }"
  >
    <div class="anchors-panel__header">
      <h2 class="anchors-panel__title">{{ t('panels.anchors') }}</h2>
      <button
        type="button"
        class="anchors-panel__close"
        :title="t('common.close')"
        @click="handleClose"
      >
        ×
      </button>
    </div>
    <PanelSwitchBar :is-modern-theme="isModernTheme" />
    <div class="anchors-panel__search">
      <input
        v-model="searchQuery"
        class="anchors-panel__search-input"
        type="search"
        :placeholder="t('panels.searchAnchors')"
      />
    </div>

    <div class="anchors-panel__content">
      <div
        v-for="anchor in filteredAnchors"
        :key="anchor.id"
        class="anchors-panel__item"
        :class="{ 'anchors-panel__item--active': selectedAnchorId === anchor.id }"
        @click="handleSelect(anchor.id)"
      >
        <div class="anchors-panel__meta">{{ formatDateTime(anchor.created_at) }}</div>
        <div v-if="editingAnchorId === anchor.id" class="anchors-panel__editor" @click.stop>
          <textarea
            ref="textareaRef"
            v-model="editText"
            class="anchors-panel__textarea"
            rows="3"
            :placeholder="t('panels.pointDescription')"
            @keydown.enter.prevent="handleSave(anchor.id)"
          ></textarea>
          <div class="anchors-panel__actions">
            <button type="button" class="anchors-panel__action" @click.stop="handleSave(anchor.id)">
              {{ t('common.save') }}
            </button>
          </div>
        </div>
        <div v-else class="anchors-panel__text">{{ anchor.description || t('panels.noDescription') }}</div>
        <div class="anchors-panel__toolbar" @click.stop>
          <button type="button" class="anchors-panel__icon" :title="t('common.edit')" @click="handleStartEdit(anchor)">
            ✏️
          </button>
          <button type="button" class="anchors-panel__icon anchors-panel__icon--danger" :title="t('common.delete')" @click="handleDelete(anchor.id)">
            🗑
          </button>
        </div>
      </div>
      <p v-if="!sortedAnchors.length && !searchQuery.trim()" class="anchors-panel__empty">{{ t('panels.noPointsYet') }}</p>
      <p v-else-if="!filteredAnchors.length" class="anchors-panel__empty">{{ t('panels.nothingFound') }}</p>
    </div>
  </div>
</template>

<style scoped>
.anchors-panel {
  position: fixed;
  left: 0;
  top: 0;
  bottom: 0;
  width: 360px;
  background: rgba(255, 255, 255, 0.98);
  border-right: 1px solid rgba(15, 23, 42, 0.12);
  box-shadow: 4px 0 24px rgba(15, 23, 42, 0.18);
  z-index: 2000;
  display: flex;
  flex-direction: column;
}

.anchors-panel--modern {
  background: rgba(18, 27, 45, 0.96);
  border-color: rgba(114, 182, 255, 0.22);
  color: #e5f3ff;
}

.anchors-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 20px 12px;
  border-bottom: 1px solid rgba(15, 23, 42, 0.08);
}

.anchors-panel--modern .anchors-panel__header {
  border-color: rgba(114, 182, 255, 0.22);
}

.anchors-panel__title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
}

.anchors-panel__close {
  background: transparent;
  border: none;
  font-size: 22px;
  cursor: pointer;
  color: inherit;
}

.anchors-panel__content {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.anchors-panel__search {
  padding: 0 16px 8px;
}

.anchors-panel__search-input {
  width: 100%;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid rgba(15, 23, 42, 0.2);
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.anchors-panel__search-input:focus {
  border-color: #5d8bf4;
  box-shadow: 0 0 0 3px rgba(93, 139, 244, 0.1);
}
.anchors-panel__item {
  background: #fff9c4;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 12px;
  padding: 12px;
  box-shadow: 0 6px 14px rgba(15, 23, 42, 0.12);
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
}

.anchors-panel__item:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 20px rgba(15, 23, 42, 0.16);
}

.anchors-panel__item--active {
  border-color: #f59e0b;
  box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.25);
}

.anchors-panel--modern .anchors-panel__item {
  background: #243654;
  border-color: rgba(114, 182, 255, 0.28);
  color: #e5f3ff;
}

.anchors-panel__meta {
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 6px;
}

.anchors-panel--modern .anchors-panel__meta {
  color: #9fb4d3;
}

.anchors-panel__text {
  font-size: 14px;
  margin-bottom: 8px;
  white-space: pre-wrap;
  word-break: break-word;
}

.anchors-panel__toolbar {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.anchors-panel__icon {
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 10px;
  padding: 6px 10px;
  cursor: pointer;
  transition: background 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
}

.anchors-panel__icon:hover {
  background: #fef3c7;
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(15, 23, 42, 0.12);
}

.anchors-panel__icon--danger:hover {
  background: #fee2e2;
  border-color: #ef4444;
}

.anchors-panel--modern .anchors-panel__icon {
  background: #162236;
  border-color: rgba(114, 182, 255, 0.3);
  color: #e5f3ff;
}

.anchors-panel__editor {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 8px;
}

.anchors-panel__textarea {
  width: 100%;
  border-radius: 10px;
  border: 1px solid rgba(0, 0, 0, 0.2);
  padding: 10px;
  resize: vertical;
  font-family: inherit;
  font-size: 14px;
  box-sizing: border-box;
}

.anchors-panel--modern .anchors-panel__textarea {
  background: #162236;
  border-color: rgba(114, 182, 255, 0.3);
  color: #e5f3ff;
}

.anchors-panel__actions {
  display: flex;
  justify-content: flex-end;
}

.anchors-panel__action {
  background: #f59e0b;
  color: #0f172a;
  border: none;
  border-radius: 10px;
  padding: 8px 12px;
  cursor: pointer;
  font-weight: 700;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.anchors-panel__action:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 18px rgba(245, 158, 11, 0.35);
}

.anchors-panel__empty {
  margin: 0;
  color: #6b7280;
  text-align: center;
  font-size: 14px;
}

.anchors-panel--modern .anchors-panel__empty {
  color: #9fb4d3;
}
</style>
