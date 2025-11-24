<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content">
      <div class="modal-header">
        <h3>Переименовать папку</h3>
        <button class="btn-close" @click="$emit('close')">×</button>
      </div>

      <div class="modal-body">
        <div class="form-group">
          <label for="folder-name">Название папки</label>
          <input
            id="folder-name"
            v-model="folderName"
            type="text"
            maxlength="255"
            @keyup.enter="renameFolder"
            ref="nameInput"
          />
          <div v-if="error" class="error-message">{{ error }}</div>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn-secondary" @click="$emit('close')">
          Отмена
        </button>
        <button
          class="btn-primary"
          @click="renameFolder"
          :disabled="!folderName.trim() || loading"
        >
          {{ loading ? 'Сохранение...' : 'Сохранить' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useBoardFoldersStore } from '@/stores/boardFolders'

const props = defineProps({
  folder: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['close', 'renamed'])

const boardFoldersStore = useBoardFoldersStore()
const folderName = ref(props.folder.name)
const loading = ref(false)
const error = ref(null)
const nameInput = ref(null)

onMounted(() => {
  nameInput.value?.focus()
  nameInput.value?.select()
})

const renameFolder = async () => {
  if (!folderName.value.trim()) {
    error.value = 'Введите название папки'
    return
  }

  // Проверить изменилось ли имя
  if (folderName.value.trim() === props.folder.name) {
    emit('close')
    return
  }

  // Проверить дубликат
  const duplicate = boardFoldersStore.folders.find(
    f => f.id !== props.folder.id &&
         f.name.toLowerCase() === folderName.value.trim().toLowerCase()
  )

  if (duplicate) {
    error.value = 'Папка с таким именем уже существует'
    return
  }

  loading.value = true
  error.value = null

  try {
    await boardFoldersStore.renameFolder(props.folder.id, folderName.value.trim())
    emit('renamed')
  } catch (err) {
    if (err.response?.status === 409) {
      error.value = 'Папка с таким именем уже существует'
    } else {
      error.value = 'Не удалось переименовать папку. Попробуйте позже'
    }
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
  max-width: 400px;
  width: 90%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
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

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  font-size: 14px;
  font-weight: 500;
  color: #374151;
}

.form-group input {
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.form-group input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.error-message {
  color: #ef4444;
  font-size: 13px;
  margin-top: 4px;
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

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
