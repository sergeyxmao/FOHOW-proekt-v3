<script setup>
import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useBoardCommentsStore } from './boardComments.js'

const { t } = useI18n()

const commentsStore = useBoardCommentsStore()
const { orderedComments, hasComments } = storeToRefs(commentsStore)

const newComment = ref('')
const editingId = ref(null)
const editText = ref('')

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
})

const submitDisabled = computed(() => !newComment.value.trim())

const resetEditingState = () => {
  editingId.value = null
  editText.value = ''
}

const handleSubmit = () => {
  commentsStore.addComment(newComment.value)
  newComment.value = ''
}

const handleEditStart = (comment) => {
  editingId.value = comment.id
  editText.value = comment.text
}

const handleEditSave = () => {
  if (editingId.value === null) {
    return
  }
  commentsStore.updateComment(editingId.value, editText.value)
  resetEditingState()
}

const handleEditCancel = () => {
  resetEditingState()
}

const handleDelete = (id) => {
  commentsStore.removeComment(id)
  if (editingId.value === id) {
    resetEditingState()
  }
}

const formatDate = (isoString) => {
  try {
    const date = new Date(isoString)
    if (Number.isNaN(date.getTime())) {
      return ''
    }
    return dateFormatter.format(date)
  } catch (error) {
    return ''
  }
}
</script>

<template>
  <div class="board-comments">
    <div class="board-comments__header">
      <h3 class="board-comments__title">{{ t('discussionMenu.boardComments') }}</h3>
    </div>
    <form class="board-comments__form" @submit.prevent="handleSubmit">
      <textarea
        v-model="newComment"
        class="board-comments__textarea"
        placeholder="Добавьте комментарий..."
        rows="3"
      ></textarea>
      <button class="board-comments__submit" type="submit" :disabled="submitDisabled">
        Добавить
      </button>
    </form>
    <div v-if="hasComments" class="board-comments__list" role="list">
      <div
        v-for="comment in orderedComments"
        :key="comment.id"
        class="board-comments__item"
        role="listitem"
      >
        <div class="board-comments__meta">
          <span class="board-comments__date">{{ formatDate(comment.createdAt) }}</span>
          <div class="board-comments__actions">
            <button
              class="board-comments__action"
              type="button"
              @click="handleEditStart(comment)"
            >
              ✏️
            </button>
            <button
              class="board-comments__action board-comments__action--danger"
              type="button"
              @click="handleDelete(comment.id)"
            >
              🗑️
            </button>
          </div>
        </div>
        <div v-if="editingId === comment.id" class="board-comments__edit">
          <textarea
            v-model="editText"
            class="board-comments__textarea"
            rows="3"
          ></textarea>
          <div class="board-comments__edit-actions">
            <button class="board-comments__submit" type="button" @click="handleEditSave">
              Сохранить
            </button>
            <button class="board-comments__cancel" type="button" @click="handleEditCancel">
              Отменить
            </button>
          </div>
        </div>
        <p v-else class="board-comments__text">{{ comment.text }}</p>
      </div>
    </div>
    <p v-else class="board-comments__empty">Комментарии ещё не добавлены.</p>
  </div>
</template>

<style scoped>
.board-comments {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 260px;
  max-width: 320px;
}

.board-comments__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.board-comments__title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.board-comments__form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.board-comments__textarea {
  width: 100%;
  resize: vertical;
  min-height: 80px;
  padding: 8px;
  border-radius: 8px;
  border: 1px solid rgba(0, 0, 0, 0.15);
  font-size: 14px;
}

.board-comments__textarea:focus {
  outline: none;
  border-color: #5d8bf4;
  box-shadow: 0 0 0 2px rgba(93, 139, 244, 0.15);
}

.board-comments__submit {
  align-self: flex-end;
  padding: 6px 16px;
  border: none;
  border-radius: 6px;
  background-color: #5d8bf4;
  color: #fff;
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.board-comments__submit:disabled {
  background-color: rgba(93, 139, 244, 0.5);
  cursor: not-allowed;
}

.board-comments__submit:not(:disabled):hover {
  background-color: #4a78e0;
}

.board-comments__list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.board-comments__item {
  padding: 10px;
  border-radius: 10px;
  background-color: rgba(255, 255, 255, 0.85);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  border: 1px solid rgba(0, 0, 0, 0.08);
}

.board-comments__meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.board-comments__date {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.55);
}

.board-comments__actions {
  display: flex;
  gap: 4px;
}

.board-comments__action {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: none;
  background-color: rgba(0, 0, 0, 0.05);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s ease;
}

.board-comments__action:hover {
  background-color: rgba(0, 0, 0, 0.12);
}

.board-comments__action--danger {
  color: #f44336;
}

.board-comments__text {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  white-space: pre-wrap;
}

.board-comments__empty {
  margin: 0;
  font-size: 14px;
  color: rgba(0, 0, 0, 0.5);
  text-align: center;
}

.board-comments__edit {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.board-comments__edit-actions {
  display: flex;
  gap: 8px;
}

.board-comments__cancel {
  padding: 6px 16px;
  border-radius: 6px;
  border: 1px solid rgba(0, 0, 0, 0.2);
  background-color: transparent;
  cursor: pointer;
  font-size: 14px;
}

.board-comments__cancel:hover {
  background-color: rgba(0, 0, 0, 0.05);
}
</style>
