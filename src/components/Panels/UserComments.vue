<script setup>
import { ref, computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useUserCommentsStore } from '../../stores/userComments.js'

const commentsStore = useUserCommentsStore()
const { comments, hasComments, loading } = storeToRefs(commentsStore)

// Форма добавления нового комментария
const newCommentContent = ref('')
const newCommentColor = ref('#FFEB3B')
const editingId = ref(null)
const editContent = ref('')
const editColor = ref('')

// Палитра цветов
const colorPalette = [
  '#FFEB3B', // Желтый
  '#FFC107', // Оранжевый
  '#FF9800', // Темно-оранжевый
  '#FF5722', // Красно-оранжевый
  '#F44336', // Красный
  '#E91E63', // Розовый
  '#9C27B0', // Фиолетовый
  '#673AB7', // Темно-фиолетовый
  '#3F51B5', // Индиго
  '#2196F3', // Синий
  '#03A9F4', // Светло-синий
  '#00BCD4', // Циан
  '#009688', // Бирюзовый
  '#4CAF50', // Зеленый
  '#8BC34A', // Светло-зеленый
  '#CDDC39', // Лаймовый
  '#FFF9C4', // Светло-желтый
  '#F5F5F5', // Серый
]

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
})

const submitDisabled = computed(() => !newCommentContent.value.trim())

// Загрузка комментариев при монтировании компонента
onMounted(async () => {
  try {
    await commentsStore.fetchComments()
  } catch (err) {
    console.error('Ошибка загрузки комментариев:', err)
  }
})

// Добавление нового комментария
const handleSubmit = async () => {
  if (!newCommentContent.value.trim()) return

  try {
    await commentsStore.addComment({
      content: newCommentContent.value.trim(),
      color: newCommentColor.value
    })
    newCommentContent.value = ''
    newCommentColor.value = '#FFEB3B'
  } catch (err) {
    alert('Ошибка создания комментария: ' + err.message)
  }
}

// Начать редактирование комментария
const handleEditStart = (comment) => {
  editingId.value = comment.id
  editContent.value = comment.content
  editColor.value = comment.color || '#FFEB3B'
}

// Сохранить изменения
const handleEditSave = async () => {
  if (editingId.value === null || !editContent.value.trim()) return

  try {
    await commentsStore.updateComment(editingId.value, {
      content: editContent.value.trim(),
      color: editColor.value
    })
    resetEditingState()
  } catch (err) {
    alert('Ошибка обновления комментария: ' + err.message)
  }
}

// Отменить редактирование
const handleEditCancel = () => {
  resetEditingState()
}

// Сбросить состояние редактирования
const resetEditingState = () => {
  editingId.value = null
  editContent.value = ''
  editColor.value = ''
}

// Удалить комментарий
const handleDelete = async (id) => {
  console.log('🗑️ Попытка удалить комментарий с ID:', id, 'Тип:', typeof id)

  // Валидация ID перед показом диалога подтверждения
  if (!id || id === 'undefined' || id === 'null') {
    console.error('❌ Некорректный ID комментария:', id)
    alert('Ошибка: некорректный ID комментария. Попробуйте обновить страницу.')
    return
  }

  const idNum = Number(id)
  if (!Number.isInteger(idNum) || idNum <= 0) {
    console.error('❌ ID комментария не является положительным числом:', id)
    alert('Ошибка: некорректный ID комментария. Попробуйте обновить страницу.')
    return
  }

  if (!confirm('Вы уверены, что хотите удалить этот комментарий?')) return

  try {
    await commentsStore.deleteComment(id)
    if (editingId.value === id) {
      resetEditingState()
    }
  } catch (err) {
    console.error('❌ Полная ошибка удаления комментария:', err)
    alert('Ошибка удаления комментария: ' + err.message)
  }
}

// Форматирование даты
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
  <div class="user-comments">
    <!-- Форма добавления нового комментария -->
    <div class="user-comments__header">
      <h3 class="user-comments__title">Личные комментарии</h3>
    </div>

    <form class="user-comments__form" @submit.prevent="handleSubmit">
      <textarea
        v-model="newCommentContent"
        class="user-comments__textarea"
        placeholder="Добавьте личный комментарий..."
        rows="3"
      ></textarea>

      <!-- Палитра цветов -->
      <div class="user-comments__color-palette">
        <label class="user-comments__color-label">Цвет:</label>
        <div class="user-comments__colors">
          <button
            v-for="color in colorPalette"
            :key="color"
            type="button"
            class="user-comments__color-btn"
            :class="{ 'user-comments__color-btn--active': newCommentColor === color }"
            :style="{ backgroundColor: color }"
            :title="color"
            @click="newCommentColor = color"
          />
        </div>
      </div>

      <button
        class="user-comments__submit"
        type="submit"
        :disabled="submitDisabled || loading"
      >
        Добавить
      </button>
    </form>

    <!-- Список комментариев -->
    <div v-if="loading && !hasComments" class="user-comments__loading">
      Загрузка...
    </div>

    <div v-else-if="hasComments" class="user-comments__list" role="list">
      <div
        v-for="comment in comments"
        :key="comment.id"
        class="user-comments__item"
        :style="{ backgroundColor: comment.color || '#F5F5F5' }"
        role="listitem"
      >
        <div class="user-comments__meta">
          <span class="user-comments__date">{{ formatDate(comment.created_at) }}</span>
          <div class="user-comments__actions">
            <button
              class="user-comments__action"
              type="button"
              title="Редактировать"
              @click="handleEditStart(comment)"
            >
              ✏️
            </button>
            <button
              class="user-comments__action user-comments__action--danger"
              type="button"
              title="Удалить"
              @click="handleDelete(comment.id)"
            >
              🗑️
            </button>
          </div>
        </div>

        <!-- Режим редактирования -->
        <div v-if="editingId === comment.id" class="user-comments__edit">
          <textarea
            v-model="editContent"
            class="user-comments__textarea"
            rows="3"
          ></textarea>

          <!-- Палитра цветов для редактирования -->
          <div class="user-comments__color-palette">
            <label class="user-comments__color-label">Цвет:</label>
            <div class="user-comments__colors">
              <button
                v-for="color in colorPalette"
                :key="color"
                type="button"
                class="user-comments__color-btn"
                :class="{ 'user-comments__color-btn--active': editColor === color }"
                :style="{ backgroundColor: color }"
                :title="color"
                @click="editColor = color"
              />
            </div>
          </div>

          <div class="user-comments__edit-actions">
            <button
              class="user-comments__submit"
              type="button"
              :disabled="loading"
              @click="handleEditSave"
            >
              Сохранить
            </button>
            <button
              class="user-comments__cancel"
              type="button"
              :disabled="loading"
              @click="handleEditCancel"
            >
              Отменить
            </button>
          </div>
        </div>

        <!-- Режим просмотра -->
        <p v-else class="user-comments__text">{{ comment.content }}</p>
      </div>
    </div>

    <p v-else class="user-comments__empty">Комментарии ещё не добавлены.</p>
  </div>
</template>

<style scoped>
.user-comments {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
}

.user-comments__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.user-comments__title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
}

.user-comments__form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.user-comments__textarea {
  width: 100%;
  resize: vertical;
  min-height: 80px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid rgba(0, 0, 0, 0.15);
  font-size: 14px;
  font-family: inherit;
  line-height: 1.5;
}

.user-comments__textarea:focus {
  outline: none;
  border-color: #5d8bf4;
  box-shadow: 0 0 0 3px rgba(93, 139, 244, 0.1);
}

.user-comments__color-palette {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.user-comments__color-label {
  font-size: 13px;
  font-weight: 500;
  color: #4b5563;
}

.user-comments__colors {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.user-comments__color-btn {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: 2px solid transparent;
  cursor: pointer;
  transition: all 0.2s ease;
}

.user-comments__color-btn:hover {
  transform: scale(1.1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.user-comments__color-btn--active {
  border-color: #1f2937;
  box-shadow: 0 0 0 2px rgba(31, 41, 55, 0.2);
}

.user-comments__submit {
  align-self: flex-end;
  padding: 8px 20px;
  border: none;
  border-radius: 6px;
  background-color: #5d8bf4;
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.user-comments__submit:disabled {
  background-color: rgba(93, 139, 244, 0.5);
  cursor: not-allowed;
}

.user-comments__submit:not(:disabled):hover {
  background-color: #4a78e0;
}

.user-comments__loading {
  text-align: center;
  padding: 20px;
  color: #6b7280;
  font-size: 14px;
}

.user-comments__list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.user-comments__item {
  padding: 12px;
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  border: 1px solid rgba(0, 0, 0, 0.08);
  transition: box-shadow 0.2s ease;
}

.user-comments__item:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
}

.user-comments__meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.user-comments__date {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.6);
  font-weight: 500;
}

.user-comments__actions {
  display: flex;
  gap: 6px;
}

.user-comments__action {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: none;
  background-color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  transition: all 0.2s ease;
}

.user-comments__action:hover {
  background-color: rgba(255, 255, 255, 0.95);
  transform: scale(1.1);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
}

.user-comments__action--danger:hover {
  background-color: rgba(244, 67, 54, 0.1);
}

.user-comments__text {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-wrap: break-word;
  color: #1f2937;
}

.user-comments__empty {
  margin: 0;
  padding: 40px 20px;
  font-size: 14px;
  color: rgba(0, 0, 0, 0.5);
  text-align: center;
}

.user-comments__edit {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.user-comments__edit-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.user-comments__cancel {
  padding: 8px 20px;
  border-radius: 6px;
  border: 1px solid rgba(0, 0, 0, 0.2);
  background-color: transparent;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: background-color 0.2s ease;
}

.user-comments__cancel:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.user-comments__cancel:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
