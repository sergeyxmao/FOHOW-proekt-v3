<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content modal-danger">
      <div class="modal-header">
        <h3>Удалить папку</h3>
        <button class="btn-close" @click="$emit('close')">×</button>
      </div>

      <div class="modal-body">
        <div class="warning-box">
          <i class="icon-warning"></i>
          <p>
            Вы уверены, что хотите удалить папку
            <strong>"{{ folder.name }}"</strong>?
          </p>
          <p v-if="folder.board_count > 0" class="danger-text">
            Все доски внутри ({{ folder.board_count }} шт.) будут удалены.
          </p>
          <p v-else>
            В папке нет досок.
          </p>
        </div>

        <div class="form-group">
          <label class="checkbox-label">
            <input
              v-model="confirmed"
              type="checkbox"
            />
            <span>Я понимаю, что это действие необратимо</span>
          </label>
        </div>

        <div v-if="error" class="error-message">{{ error }}</div>
      </div>

      <div class="modal-footer">
        <button class="btn-secondary" @click="$emit('close')">
          Отмена
        </button>
        <button
          class="btn-danger"
          @click="deleteFolder"
          :disabled="!confirmed || loading"
        >
          {{ loading ? 'Удаление...' : 'Удалить' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useBoardFoldersStore } from '@/stores/boardFolders'

const props = defineProps({
  folder: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['close', 'deleted'])

const boardFoldersStore = useBoardFoldersStore()
const confirmed = ref(false)
const loading = ref(false)
const error = ref(null)

const deleteFolder = async () => {
  if (!confirmed.value) return

  loading.value = true
  error.value = null

  try {
    const result = await boardFoldersStore.deleteFolder(props.folder.id)
    console.log(`Удалено досок: ${result.deleted_boards_count}`)
    emit('deleted')
  } catch (err) {
    error.value = 'Не удалось удалить папку. Попробуйте позже'
  } finally {
    loading.value = false
  }
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
  max-width: 450px;
  width: 90%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
}

.modal-danger {
  border-top: 4px solid #ef4444;
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
}

.btn-close {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #6b7280;
  padding: 0;
  line-height: 1;
}

.btn-close:hover {
  color: #111827;
}

.modal-body {
  padding: 24px;
}

.warning-box {
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 20px;
}

.warning-box p {
  margin: 0 0 8px 0;
  color: #374151;
  font-size: 14px;
}

.warning-box p:last-child {
  margin-bottom: 0;
}

.warning-box strong {
  color: #111827;
}

.danger-text {
  color: #dc2626 !important;
  font-weight: 500;
}

.icon-warning {
  display: inline-block;
  width: 20px;
  height: 20px;
  margin-right: 8px;
  vertical-align: middle;
}

.icon-warning::before {
  content: '⚠️';
}

.form-group {
  margin-top: 16px;
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

.btn-secondary {
  padding: 10px 20px;
  border: 1px solid #d1d5db;
  background: #fff;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  color: #374151;
  transition: background-color 0.2s;
}

.btn-secondary:hover {
  background: #f3f4f6;
}

.btn-danger {
  padding: 10px 20px;
  border: none;
  background: #ef4444;
  color: #fff;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.btn-danger:hover:not(:disabled) {
  background: #dc2626;
}

.btn-danger:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
