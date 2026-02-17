<script setup>
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import PanelSwitchBar from './PanelSwitchBar.vue'
import { useNotesStore } from '../../stores/notes.js'
import { useSidePanelsStore } from '../../stores/sidePanels.js'
import { useBoardStore } from '../../stores/board.js'
import { useStickersStore } from '../../stores/stickers.js'
import { useMobileStore } from '../../stores/mobile.js'

const props = defineProps({
  isModernTheme: {
    type: Boolean,
    default: false
  }
})

const notesStore = useNotesStore()
const sidePanelsStore = useSidePanelsStore()
const stickersStore = useStickersStore()
const mobileStore = useMobileStore()

const { cardsWithEntries } = storeToRefs(notesStore)
const searchQuery = ref('')

const filteredCards = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) {
    return cardsWithEntries.value
  }

  return cardsWithEntries.value
    .map(card => {
      const cardMatch = card.title?.toLowerCase().includes(query)
      const filteredEntries = card.entries.filter(entry => {
        const note = notesStore.getNote(card.id, entry.date)
        const content = note?.content || ''
        return (
          cardMatch ||
          entry.label?.toLowerCase().includes(query) ||
          content.toLowerCase().includes(query)
        )
      })

      if (filteredEntries.length) {
        return { ...card, entries: filteredEntries }
      }
      return null
    })
    .filter(Boolean)
})

const handleClose = () => {
  sidePanelsStore.closePanel()
}

const handleNoteItemClick = (cardId) => {
  notesStore.requestOpen(cardId, { focus: true })
  if (mobileStore.isMobileMode) {
    sidePanelsStore.closePanel()
  }
}

const handleNoteEntryClick = (cardId, date) => {
  notesStore.requestOpen(cardId, { focus: true, date })
  if (mobileStore.isMobileMode) {
    sidePanelsStore.closePanel()
  }
}

const handleNoteEntryDelete = async (cardId, date) => {
  if (!confirm('Вы уверены, что хотите удалить эту заметку?')) return

  console.log('🗑️ Попытка удалить заметку:', { cardId, date })

  try {
    // Синхронизируем с сервером (отправляем пустое содержимое для удаления)
    const boardStore = useBoardStore()
    if (boardStore.currentBoardId) {
      const result = await notesStore.saveNote({
        boardId: boardStore.currentBoardId,
        cardUid: cardId,
        noteDate: date,
        content: '', // Пустое содержимое = удаление на сервере
        color: ''
      })

      // Проверяем, не вернулась ли ошибка
      if (result && result.error) {
        console.error('❌ Ошибка удаления заметки:', result.message)
        return
      }

      console.log('✅ Заметка успешно удалена')
    }
  } catch (err) {
    console.error('❌ Ошибка удаления заметки:', err)
    alert('Ошибка удаления заметки: ' + err.message)
  }
}

const handleCardNotesDelete = async (cardId) => {
  if (!confirm('Вы уверены, что хотите удалить все заметки для этой карточки?')) return

  console.log('🗑️ Попытка удалить все заметки для карточки:', cardId)

  try {
    // Получаем все даты заметок для этой карточки
    const cardNotes = notesStore.getNotesForCard(cardId)
    const dates = Object.keys(cardNotes)

    // Синхронизируем с сервером
    const boardStore = useBoardStore()
    if (boardStore.currentBoardId && dates.length > 0) {
      // Удаляем каждую заметку на сервере
      for (const date of dates) {
        const result = await notesStore.saveNote({
          boardId: boardStore.currentBoardId,
          cardUid: cardId,
          noteDate: date,
          content: '', // Пустое содержимое = удаление
          color: ''
        })

        // Проверяем, не вернулась ли ошибка
        if (result && result.error) {
          console.error('❌ Ошибка удаления заметки:', result.message)
          // Прерываем цикл при первой ошибке
          return
        }
      }
      console.log('✅ Все заметки успешно удалены')
    }
  } catch (err) {
    console.error('❌ Ошибка удаления всех заметок:', err)
    alert('Ошибка удаления заметок: ' + err.message)
  }
}
</script>

<template>
  <div
    class="notes-side-panel"
    :class="{
      'notes-side-panel--modern': props.isModernTheme,
      'notes-side-panel--no-pointer': stickersStore.isPlacementMode
    }"
      >
    <div class="notes-side-panel__header">
      <h2 class="notes-side-panel__title">Календарь</h2>
      <button
        type="button"
        class="notes-side-panel__close"
        title="Закрыть"
        @click="handleClose"
      >
        ×
      </button>
    </div>
    <PanelSwitchBar :is-modern-theme="isModernTheme" />
    <div class="notes-side-panel__search">
      <input
        v-model="searchQuery"
        class="notes-side-panel__search-input"
        type="search"
        placeholder="Поиск по заметкам..."
      />
    </div>

    <div class="notes-side-panel__content">
      <div
        v-for="item in filteredCards"
        :key="item.id"
        class="notes-side-panel__group"
      >
        <div class="notes-side-panel__card-row">
          <button
            type="button"
            class="notes-side-panel__card-button"
            @click="handleNoteItemClick(item.id)"
          >
            📝 {{ item.title }}
          </button>
          <button
            type="button"
            class="notes-side-panel__icon-button notes-side-panel__icon-button--danger"
            title="Удалить все заметки"
            @click="handleCardNotesDelete(item.id)"
          >
            🗑️
          </button>
        </div>
        <div class="notes-side-panel__entries">
          <div
            v-for="entry in item.entries"
            :key="entry.date"
            class="notes-side-panel__entry"
          >
            <button
              type="button"
              class="notes-side-panel__entry-button"
              @click="handleNoteEntryClick(item.id, entry.date)"
            >
              <span
                class="notes-side-panel__entry-color"
                :style="{ backgroundColor: entry.color }"
              ></span>
              <span class="notes-side-panel__entry-label">{{ entry.label }}</span>
            </button>
            <button
              type="button"
              class="notes-side-panel__icon-button"
              title="Удалить заметку"
              @click="handleNoteEntryDelete(item.id, entry.date)"
            >
              🗑️
            </button>
          </div>
        </div>
      </div>

      <p v-if="!filteredCards.length && searchQuery.trim()" class="notes-side-panel__empty">
        Ничего не найдено
      </p>      
    </div>
  </div>
</template>

<style scoped>
.notes-side-panel {
  position: fixed;
  left: 0;
  top: 0;
  bottom: 0;
  width: 380px;
  background: rgba(255, 255, 255, 0.98);
  border-right: 1px solid rgba(15, 23, 42, 0.12);
  box-shadow: 4px 0 24px rgba(15, 23, 42, 0.18);
  z-index: 2000;
}

.notes-side-panel--no-pointer {
  pointer-events: none;
  opacity: 0.3;
  display: flex;
  flex-direction: column;
  backdrop-filter: blur(8px);
}

.notes-side-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px 24px 16px;
  border-bottom: 1px solid rgba(15, 23, 42, 0.08);
}

.notes-side-panel__title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: #1f2937;
}

.notes-side-panel__close {
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

.notes-side-panel__close:hover {
  background: rgba(239, 68, 68, 0.12);
  color: #dc2626;
  box-shadow: 0 8px 16px rgba(15, 23, 42, 0.12);
  transform: translateY(-1px);
}

.notes-side-panel__content {
  flex: 1;
  overflow-y: auto;
  padding: 16px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.notes-side-panel__search {
  padding: 0 24px 12px;
}

.notes-side-panel__search-input {
  width: 100%;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid rgba(15, 23, 42, 0.15);
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.notes-side-panel__search-input:focus {
  border-color: #5d8bf4;
  box-shadow: 0 0 0 3px rgba(93, 139, 244, 0.1);
}

.notes-side-panel__group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.notes-side-panel__group + .notes-side-panel__group {
  border-top: 1px solid rgba(15, 23, 42, 0.12);
  padding-top: 16px;
}

.notes-side-panel__card-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.notes-side-panel__card-button {
  flex: 1;
  padding: 12px 16px;
  border-radius: 14px;
  border: 1px solid rgba(15, 23, 42, 0.16);
  background: rgba(255, 255, 255, 0.92);
  color: #0f172a;
  font-weight: 600;
  font-size: 15px;
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  transition: background 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
}

.notes-side-panel__card-button:hover {
  background: rgba(59, 130, 246, 0.15);
  box-shadow: 0 12px 22px rgba(37, 99, 235, 0.2);
  transform: translateY(-1px);
}

.notes-side-panel__entries {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-left: 8px;
}

.notes-side-panel__entry {
  display: flex;
  align-items: center;
  gap: 8px;
}

.notes-side-panel__entry-button {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-radius: 12px;
  border: 1px solid rgba(15, 23, 42, 0.12);
  background: rgba(255, 255, 255, 0.92);
  color: #0f172a;
  cursor: pointer;
  transition: background 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
}

.notes-side-panel__entry-button:hover {
  background: rgba(59, 130, 246, 0.15);
  box-shadow: 0 10px 20px rgba(15, 23, 42, 0.16);
  transform: translateY(-1px);
}

.notes-side-panel__entry-color {
  width: 16px;
  height: 16px;
  border-radius: 6px;
  box-shadow: inset 0 1px 1px rgba(15, 23, 42, 0.12);
  flex-shrink: 0;
}

.notes-side-panel__entry-label {
  font-size: 14px;
  font-weight: 500;
}

.notes-side-panel__icon-button {
  width: 38px;
  height: 38px;
  border-radius: 12px;
  border: 1px solid rgba(15, 23, 42, 0.12);
  background: rgba(248, 250, 252, 0.92);
  color: #475569;
  font-size: 18px;
  display: grid;
  place-items: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.2s ease, color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
}

.notes-side-panel__icon-button:hover {
  background: rgba(59, 130, 246, 0.12);
  color: #1d4ed8;
  box-shadow: 0 12px 20px rgba(15, 23, 42, 0.14);
  transform: translateY(-1px);
}

.notes-side-panel__icon-button--danger {
  color: #dc2626;
}

.notes-side-panel__icon-button--danger:hover {
  background: rgba(248, 113, 113, 0.16);
  color: #b91c1c;
}

/* Modern Theme */
.notes-side-panel--modern {
  background: rgba(18, 28, 48, 0.96);
  border-right-color: rgba(96, 164, 255, 0.28);
  box-shadow: 4px 0 28px rgba(6, 11, 21, 0.65);
}

.notes-side-panel--modern .notes-side-panel__header {
  border-bottom-color: rgba(96, 164, 255, 0.22);
}

.notes-side-panel--modern .notes-side-panel__title {
  color: #e5f3ff;
}

.notes-side-panel--modern .notes-side-panel__close {
  border-color: rgba(96, 164, 255, 0.35);
  background: rgba(24, 34, 58, 0.92);
  color: #e5f3ff;
  box-shadow: 0 16px 30px rgba(6, 11, 21, 0.6);
}

.notes-side-panel--modern .notes-side-panel__close:hover {
  background: rgba(248, 113, 113, 0.22);
  color: #fca5a5;
  box-shadow: 0 20px 36px rgba(6, 11, 21, 0.7);
}

.notes-side-panel--modern .notes-side-panel__group + .notes-side-panel__group {
  border-top-color: rgba(96, 164, 255, 0.22);
}

.notes-side-panel--modern .notes-side-panel__card-button,
.notes-side-panel--modern .notes-side-panel__entry-button {
  border-color: rgba(96, 164, 255, 0.35);
  background: rgba(24, 34, 58, 0.92);
  color: #e5f3ff;
  box-shadow: 0 16px 30px rgba(6, 11, 21, 0.6);
}

.notes-side-panel--modern .notes-side-panel__card-button:hover,
.notes-side-panel--modern .notes-side-panel__entry-button:hover {
  background: rgba(96, 164, 255, 0.22);
  color: #0b1324;
  box-shadow: 0 24px 40px rgba(6, 11, 21, 0.72);
}

.notes-side-panel--modern .notes-side-panel__entry-color {
  box-shadow: inset 0 1px 1px rgba(6, 11, 21, 0.4);
}

.notes-side-panel--modern .notes-side-panel__icon-button {
  border-color: rgba(96, 164, 255, 0.35);
  background: rgba(24, 34, 58, 0.92);
  color: #e5f3ff;
  box-shadow: 0 16px 30px rgba(6, 11, 21, 0.6);
}

.notes-side-panel--modern .notes-side-panel__icon-button:hover {
  background: rgba(96, 164, 255, 0.24);
  color: #0b1324;
  box-shadow: 0 24px 40px rgba(6, 11, 21, 0.74);
}

.notes-side-panel--modern .notes-side-panel__icon-button--danger:hover {
  background: rgba(248, 113, 113, 0.22);
  color: #fca5a5;
}
</style>
