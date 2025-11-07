<script setup>
import { computed, onMounted, inject } from 'vue'
import { useStickersStore } from '../../stores/stickers.js'

const stickersStore = useStickersStore()

// Получаем функцию фокусировки из CanvasBoard
const focusStickerOnCanvas = inject('focusStickerOnCanvas', null)

// Вычисляемое свойство для получения стикеров с непустым содержимым
const messagesStickers = computed(() => {
  return stickersStore.stickers.filter(sticker => sticker.content && sticker.content.trim())
})

const hasMessages = computed(() => messagesStickers.value.length > 0)

const handleStickerClick = (sticker) => {
  if (focusStickerOnCanvas) {
    focusStickerOnCanvas(sticker.id)
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
  <div class="sticker-messages">
    <div class="sticker-messages__header">
      <h3 class="sticker-messages__title">
        Сообщения
        <span v-if="hasMessages" class="sticker-messages__count">({{ messagesStickers.length }})</span>
      </h3>
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
        v-for="sticker in messagesStickers"
        :key="sticker.id"
        class="sticker-message-item"
        :style="{ borderLeftColor: sticker.color || '#FFFF88' }"
        @click="handleStickerClick(sticker)"
      >
        <div class="sticker-message-item__header">
          <span class="sticker-message-item__author">
            {{ sticker.author_username || 'Неизвестный пользователь' }}
          </span>
          <span class="sticker-message-item__date">
            {{ formatDate(sticker.created_at) }}
          </span>
        </div>
        <div class="sticker-message-item__content">
          {{ getPreview(sticker.content) }}
        </div>
      </div>
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
  background: rgba(248, 250, 252, 0.8);
  border-left: 4px solid #FFFF88;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.sticker-message-item:hover {
  background: rgba(241, 245, 249, 1);
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.1);
  transform: translateX(4px);
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

.sticker-message-item__date {
  font-size: 11px;
  color: #9ca3af;
  white-space: nowrap;
}

.sticker-message-item__content {
  font-size: 14px;
  line-height: 1.5;
  color: #1f2937;
  word-wrap: break-word;
  overflow-wrap: break-word;
}

/* Темная тема */
@media (prefers-color-scheme: dark) {
  .sticker-messages__title {
    color: #e5f3ff;
  }

  .sticker-messages__count {
    color: #94a3b8;
  }

  .sticker-messages__empty-text {
    color: #94a3b8;
  }

  .sticker-messages__empty-hint {
    color: #64748b;
  }

  .sticker-message-item {
    background: rgba(24, 34, 58, 0.6);
  }

  .sticker-message-item:hover {
    background: rgba(30, 41, 68, 0.8);
  }

  .sticker-message-item__author {
    color: #e5f3ff;
  }

  .sticker-message-item__date {
    color: #64748b;
  }

  .sticker-message-item__content {
    color: #cbd5e1;
  }
}
</style>
