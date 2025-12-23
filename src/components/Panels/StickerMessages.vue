<script setup>
import { computed, onMounted, ref } from 'vue'
import { useStickersStore } from '../../stores/stickers.js'

const props = defineProps({
  isModernTheme: {
    type: Boolean,
    default: false
  }
})

const stickersStore = useStickersStore()
const searchQuery = ref('')
  
// Вычисляемое свойство для получения стикеров с непустым содержимым
const messagesStickers = computed(() => {
  return stickersStore.stickers.filter(sticker => sticker.content && sticker.content.trim())
})
const filteredMessages = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) {
    return messagesStickers.value
  }

  return messagesStickers.value.filter(sticker =>
    sticker.content?.toLowerCase().includes(query)
  )
})

const hasMessages = computed(() => messagesStickers.value.length > 0)

// Состояние редактирования
const editingStickerId = ref(null)
const editingContent = ref('')

const handleStickerClick = (sticker, event) => {
  // Проверяем, что клик не по кнопкам действий
  if (event.target.closest('.sticker-message-item__actions')) {
    return
  }

  // Запрашиваем фокусировку через store
  stickersStore.requestFocusOnSticker(sticker.id)
}

const handleEdit = (sticker, event) => {
  event.stopPropagation()
  editingStickerId.value = sticker.id
  editingContent.value = sticker.content || ''
}

const handleSaveEdit = async (stickerId) => {
  if (editingContent.value.trim() === '') {
    alert('Содержимое стикера не может быть пустым')
    return
  }

  try {
    await stickersStore.updateSticker(stickerId, {
      content: editingContent.value
    })
    editingStickerId.value = null
    editingContent.value = ''
  } catch (error) {
    console.error('Ошибка обновления стикера:', error)
    alert('Не удалось обновить стикер')
  }
}

const handleCancelEdit = () => {
  editingStickerId.value = null
  editingContent.value = ''
}

const handleDelete = async (sticker, event) => {
  event.stopPropagation()

  if (!confirm(`Вы уверены, что хотите удалить стикер?`)) {
    return
  }

  try {
    await stickersStore.deleteSticker(sticker.id)
  } catch (error) {
    console.error('Ошибка удаления стикера:', error)
    const errorMessage = error.message || 'Не удалось удалить стикер'
    alert(`Не удалось удалить стикер: ${errorMessage}`)
  }
}

const formatDate = (dateString) => {
  if (!dateString) return ''

  const date = new Date(dateString)
  if (isNaN(date.getTime())) return ''

  return date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Получаем превью текста (первые 100 символов)
const getPreview = (content) => {
  if (!content) return ''
  const text = content.trim()
  if (text.length <= 100) return text
  return text.substring(0, 100) + '...'
}

onMounted(() => {
  // Стикеры уже загружаются в CanvasBoard при открытии доски
  // Здесь просто убеждаемся, что они есть
})
</script>

<template>
  <div class="sticker-messages" :class="{ 'sticker-messages--modern': props.isModernTheme }">
    <div class="sticker-messages__header">
      <h3 class="sticker-messages__title">
        Сообщения
        <span v-if="hasMessages" class="sticker-messages__count">({{ messagesStickers.length }})</span>
      </h3>
    </div>
    <div v-if="hasMessages" class="sticker-messages__search">
      <input
        v-model="searchQuery"
        class="sticker-messages__search-input"
        type="search"
        placeholder="Поиск по сообщениям..."
      />
    </div>

    <div v-if="!hasMessages" class="sticker-messages__empty">
      <div class="sticker-messages__empty-icon">📌</div>
      <p class="sticker-messages__empty-text">
        Нет сообщений в стикерах
      </p>
      <p class="sticker-messages__empty-hint">
        Добавьте текст в стикеры, чтобы увидеть их здесь
      </p>
    </div>

    <div v-else class="sticker-messages__list">
      <div
        v-for="sticker in filteredMessages"
        :key="sticker.id"
        class="sticker-message-item"
        :class="{ 'sticker-message-item--editing': editingStickerId === sticker.id }"
        :style="{
          borderLeftColor: sticker.color || '#FFFF88',
          backgroundColor: (sticker.color || '#FFFF88') + '20'
        }"
        @click="handleStickerClick(sticker, $event)"
      >
        <div class="sticker-message-item__header">
          <span class="sticker-message-item__author">
            {{ sticker.author_username || 'Неизвестный пользователь' }}
          </span>
          <div class="sticker-message-item__actions">
            <button
              type="button"
              class="sticker-message-item__action sticker-message-item__action--edit"
              title="Редактировать"
              @click="handleEdit(sticker, $event)"
            >
              ✏️
            </button>
            <button
              type="button"
              class="sticker-message-item__action sticker-message-item__action--delete"
              title="Удалить"
              @click="handleDelete(sticker, $event)"
            >
              🗑️
            </button>
          </div>
        </div>
        <div v-if="editingStickerId !== sticker.id" class="sticker-message-item__content">
          {{ getPreview(sticker.content) }}
        </div>
        <div v-else class="sticker-message-item__edit">
          <textarea
            v-model="editingContent"
            class="sticker-message-item__textarea"
            placeholder="Введите текст стикера..."
            @click.stop
          ></textarea>
          <div class="sticker-message-item__edit-actions">
            <button
              type="button"
              class="sticker-message-item__edit-btn sticker-message-item__edit-btn--save"
              @click.stop="handleSaveEdit(sticker.id)"
            >
              Сохранить
            </button>
            <button
              type="button"
              class="sticker-message-item__edit-btn sticker-message-item__edit-btn--cancel"
              @click.stop="handleCancelEdit"
            >
              Отмена
            </button>
          </div>
        </div>
        <div v-if="editingStickerId !== sticker.id" class="sticker-message-item__date">
          {{ formatDate(sticker.created_at) }}
        </div>
      </div>

      <p v-if="!filteredMessages.length" class="sticker-messages__empty-text">Ничего не найдено</p>      
    </div>
  </div>
</template>

<style scoped>
.sticker-messages {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.sticker-messages__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.sticker-messages__search {
  margin-bottom: -4px;
}

.sticker-messages__search-input {
  width: 100%;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid rgba(15, 23, 42, 0.15);
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.sticker-messages__search-input:focus {
  border-color: #5d8bf4;
  box-shadow: 0 0 0 3px rgba(93, 139, 244, 0.1);
}
.sticker-messages__title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
  display: flex;
  align-items: center;
  gap: 8px;
}

.sticker-messages__count {
  font-size: 14px;
  font-weight: 400;
  color: #6b7280;
}

.sticker-messages__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
}

.sticker-messages__empty-icon {
  font-size: 64px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.sticker-messages__empty-text {
  margin: 0 0 8px 0;
  font-size: 16px;
  font-weight: 600;
  color: #6b7280;
}

.sticker-messages__empty-hint {
  margin: 0;
  font-size: 14px;
  color: #9ca3af;
}

.sticker-messages__list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sticker-message-item {
  padding: 12px;
  /* Фон переопределяется через inline-стиль с цветом стикера */
  border-left: 4px solid #FFFF88;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.sticker-message-item:hover {
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.1);
  transform: translateX(4px);
  filter: brightness(0.95);
}

.sticker-message-item__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  gap: 8px;
}

.sticker-message-item__author {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  flex-shrink: 0;
}

.sticker-message-item__actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.sticker-message-item__action {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: rgba(248, 250, 252, 0.8);
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.sticker-message-item__action:hover {
  transform: scale(1.1);
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.15);
}

.sticker-message-item__action--edit:hover {
  background: rgba(59, 130, 246, 0.15);
}

.sticker-message-item__action--delete:hover {
  background: rgba(239, 68, 68, 0.15);
}

.sticker-message-item__date {
  font-size: 11px;
  color: #9ca3af;
  margin-top: 4px;
}

.sticker-message-item__content {
  font-size: 14px;
  line-height: 1.5;
  color: #1f2937;
  word-wrap: break-word;
  overflow-wrap: break-word;
  margin-bottom: 4px;
}

.sticker-message-item--editing {
  background: rgba(59, 130, 246, 0.08);
}

.sticker-message-item__edit {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sticker-message-item__textarea {
  width: 100%;
  min-height: 80px;
  padding: 8px;
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 6px;
  font-size: 14px;
  line-height: 1.5;
  color: #1f2937;
  font-family: inherit;
  resize: vertical;
  outline: none;
  transition: border-color 0.2s ease;
}

.sticker-message-item__textarea:focus {
  border-color: rgba(59, 130, 246, 0.6);
}

.sticker-message-item__edit-actions {
  display: flex;
  gap: 8px;
}

.sticker-message-item__edit-btn {
  flex: 1;
  padding: 8px 12px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.sticker-message-item__edit-btn--save {
  background: #3b82f6;
  color: white;
}

.sticker-message-item__edit-btn--save:hover {
  background: #2563eb;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.sticker-message-item__edit-btn--cancel {
  background: rgba(107, 114, 128, 0.1);
  color: #4b5563;
}

.sticker-message-item__edit-btn--cancel:hover {
  background: rgba(107, 114, 128, 0.2);
  transform: translateY(-1px);
}

/* Темная тема (Modern Theme) */
.sticker-messages--modern .sticker-messages__title {
  color: #e5f3ff;
}

.sticker-messages--modern .sticker-messages__count {
  color: #94a3b8;
}

.sticker-messages--modern .sticker-messages__empty-text {
  color: #94a3b8;
}

.sticker-messages--modern .sticker-messages__empty-hint {
  color: #64748b;
}

.sticker-messages--modern .sticker-message-item {
  /* Фон переопределяется через inline-стиль с цветом стикера */
  /* Добавляем небольшую темную подложку для читаемости */
  box-shadow: inset 0 0 0 1000px rgba(24, 34, 58, 0.3);
}

.sticker-messages--modern .sticker-message-item:hover {
  box-shadow: inset 0 0 0 1000px rgba(24, 34, 58, 0.4), 0 4px 12px rgba(6, 11, 21, 0.3);
}

.sticker-messages--modern .sticker-message-item__author {
  color: #e5f3ff;
}

.sticker-messages--modern .sticker-message-item__date {
  color: #64748b;
}

.sticker-messages--modern .sticker-message-item__content {
  color: #cbd5e1;
}

.sticker-messages--modern .sticker-message-item__action {
  background: rgba(24, 34, 58, 0.8);
}

.sticker-messages--modern .sticker-message-item__textarea {
  background: rgba(24, 34, 58, 0.8);
  color: #e5f3ff;
  border-color: rgba(59, 130, 246, 0.4);
}

.sticker-messages--modern .sticker-message-item__edit-btn--cancel {
  background: rgba(148, 163, 184, 0.2);
  color: #cbd5e1;
}
</style>
