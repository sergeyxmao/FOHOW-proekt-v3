<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content modal-large">
      <div class="modal-header">
        <h3>Папки для "{{ board.name }}"</h3>
        <button class="btn-close" @click="$emit('close')">×</button>
      </div>

      <div class="modal-body">
        <div v-if="loading" class="loading-spinner">Загрузка...</div>

        <div v-else class="folders-list">
          <div
            v-for="folder in folders"
            :key="folder.id"
            class="folder-item"
          >
            <label class="checkbox-label">
              <input
                type="checkbox"
                :checked="isBoardInFolder(folder.id)"
                @change="toggleBoardInFolder(folder.id, $event.target.checked)"
              />
              <span>{{ folder.name }}</span>
              <span class="board-count">({{ folder.board_count }})</span>
            </label>
          </div>

          <div v-if="folders.length === 0" class="empty-state">
            У вас пока нет папок
          </div>
        </div>

        <button
          v-if="canCreateFolder"
          class="btn-create-folder-inline"
          @click="showCreateFolderModal = true"
        >
          <i class="icon-plus"></i>
          Создать новую папку
        </button>

        <div v-if="error" class="error-message">{{ error }}</div>
      </div>

      <div class="modal-footer">
        <button class="btn-primary" @click="$emit('close')">
          Закрыть
        </button>
      </div>
    </div>

    <CreateFolderModal
      v-if="showCreateFolderModal"
      @close="showCreateFolderModal = false"
      @created="handleFolderCreated"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useBoardFoldersStore } from '@/stores/boardFolders'
import CreateFolderModal from './CreateFolderModal.vue'

const props = defineProps({
  board: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['close', 'updated'])

const boardFoldersStore = useBoardFoldersStore()
const loading = ref(false)
const error = ref(null)
const showCreateFolderModal = ref(false)

const folders = computed(() => boardFoldersStore.folders)
const canCreateFolder = computed(() => boardFoldersStore.canCreateFolder)

const boardFolderIds = ref(new Set(
  (props.board.folders || []).map(f => f.id)
))

onMounted(async () => {
  loading.value = true
  try {
    await boardFoldersStore.fetchFolders()
  } catch (err) {
    error.value = 'Не удалось загрузить папки'
  } finally {
    loading.value = false
  }
})

const isBoardInFolder = (folderId) => {
  return boardFolderIds.value.has(folderId)
}

const toggleBoardInFolder = async (folderId, checked) => {
  error.value = null

  try {
    if (checked) {
      await boardFoldersStore.addBoardToFolder(folderId, props.board.id)
      boardFolderIds.value.add(folderId)
    } else {
      await boardFoldersStore.removeBoardFromFolder(folderId, props.board.id)
      boardFolderIds.value.delete(folderId)
    }

    emit('updated')
  } catch (err) {
    if (err.response?.status === 409) {
      // Доска уже в папке - просто обновить локальное состояние
      boardFolderIds.value.add(folderId)
    } else {
      error.value = 'Не удалось обновить папки. Попробуйте позже'
    }
  }
}

const handleFolderCreated = async () => {
  showCreateFolderModal.value = false
  await boardFoldersStore.fetchFolders()
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.modal-content {
  background: #fff;
  border-radius: 12px;
  max-width: 500px;
  width: 90%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
}

.modal-large {
  max-width: 500px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #e5e7eb;
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #111827;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: calc(100% - 40px);
}

.btn-close {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #6b7280;
  padding: 0;
  line-height: 1;
  flex-shrink: 0;
}

.btn-close:hover {
  color: #111827;
}

.modal-body {
  padding: 24px;
  max-height: 400px;
  overflow-y: auto;
}

.loading-spinner {
  text-align: center;
  color: #6b7280;
  padding: 20px;
}

.folders-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.folder-item {
  padding: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  transition: background-color 0.2s;
}

.folder-item:hover {
  background: #f9fafb;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  font-size: 14px;
  color: #374151;
}

.checkbox-label input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.board-count {
  color: #9ca3af;
  font-size: 13px;
  margin-left: auto;
}

.empty-state {
  text-align: center;
  color: #9ca3af;
  padding: 20px;
  font-size: 14px;
}

.btn-create-folder-inline {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 16px;
  padding: 12px 16px;
  width: 100%;
  border: 2px dashed #d1d5db;
  background: transparent;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  color: #6b7280;
  cursor: pointer;
  transition: border-color 0.2s, color 0.2s;
}

.btn-create-folder-inline:hover {
  border-color: #3b82f6;
  color: #3b82f6;
}

.icon-plus::before {
  content: '+';
  font-size: 18px;
  font-weight: bold;
}

.error-message {
  color: #ef4444;
  font-size: 13px;
  margin-top: 12px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid #e5e7eb;
}

.btn-primary {
  padding: 10px 20px;
  border: none;
  background: #3b82f6;
  color: #fff;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.btn-primary:hover {
  background: #2563eb;
}
</style>
