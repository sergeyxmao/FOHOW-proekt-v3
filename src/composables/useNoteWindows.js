import { computed } from 'vue'
import {
  ensureNoteStructure,
  applyCardRectToNote,
  updateNoteOffsets,
  DEFAULT_NOTE_WIDTH,
  DEFAULT_NOTE_HEIGHT
} from '../utils/noteUtils'

/**
 * Composable для управления окнами заметок карточек
 */
export function useNoteWindows(options) {
  const {
    cardsStore,
    historyStore,
    cards,
    zoomScale,
    findCardById,
    getCardElementRect
  } = options

  // === State ===
  const noteWindowRefs = new Map()

  // === Computed ===
  const cardsWithVisibleNotes = computed(() =>
    cards.value.filter(card => card.note && card.note.visible)
  )

  // === Вспомогательные функции ===

  /**
   * Получение текущего масштаба
   */
  const getCurrentZoom = () => {
    const value = Number(zoomScale.value)
    return Number.isFinite(value) && value > 0 ? value : 1
  }

  // === Основные методы ===

  /**
   * Обеспечение структуры заметки для карточки
   */
  const ensureCardNote = (card) => {
    if (!card) {
      return null
    }
    card.note = ensureNoteStructure(card.note)
    if (!card.note.viewDate) {
      const selected = card.note.selectedDate || card.note.viewDate || ''
      if (selected) {
        card.note.viewDate = `${selected.slice(0, 7)}-01`
      }
    }
    return card.note
  }

  /**
   * Регистрация ref окна заметки
   */
  const handleNoteWindowRegister = (cardId, instance) => {
    if (instance) {
      noteWindowRefs.set(cardId, instance)
    } else {
      noteWindowRefs.delete(cardId)
    }
  }

  /**
   * Синхронизация позиции окна заметки с карточкой
   */
  const syncNoteWindowWithCard = (cardId, syncOptions = {}) => {
    const card = findCardById(cardId)
    if (!card || !card.note || !card.note.visible) {
      return
    }
    const scale = getCurrentZoom()
    const alignSide = syncOptions.align === 'left' ? 'left' : 'right'
    const shouldForceAlign = Boolean(syncOptions.forceAlign)
      || !Number.isFinite(card.note.offsetX)
      || !Number.isFinite(card.note.offsetY)

    const ref = noteWindowRefs.get(cardId)
    if (ref && typeof ref.syncWithCardPosition === 'function') {
      ref.syncWithCardPosition({ scale, forceAlign: shouldForceAlign })
      return
    }
    const rect = getCardElementRect(cardId)
    if (rect) {
      applyCardRectToNote(card.note, rect, {
        scale,
        align: alignSide,
        forceAlign: shouldForceAlign
      })
      updateNoteOffsets(card.note, rect, { scale })
    }
  }

  /**
   * Открытие заметки для карточки
   */
  const openNoteForCard = (card, openOptions = {}) => {
    const note = ensureCardNote(card)
    if (!note) {
      return
    }

    // Закрыть все другие открытые заметки перед открытием новой
    cards.value.forEach(c => {
      if (c.id !== card.id && c.note && c.note.visible) {
        c.note.visible = false
      }
    })

    note.width = Number.isFinite(note.width) ? note.width : DEFAULT_NOTE_WIDTH
    note.height = Number.isFinite(note.height) ? note.height : DEFAULT_NOTE_HEIGHT
    const rect = getCardElementRect(card.id)
    if (rect) {
      const scale = getCurrentZoom()
      applyCardRectToNote(note, rect, {
        scale,
        align: 'right',
        forceAlign: Boolean(openOptions?.forceAlign)
      })
      updateNoteOffsets(note, rect, { scale })
    }
    if (!note.viewDate && note.selectedDate) {
      note.viewDate = `${note.selectedDate.slice(0, 7)}-01`
    }
    note.visible = true
    syncNoteWindowWithCard(card.id, { forceAlign: Boolean(openOptions?.forceAlign), align: 'right' })
  }

  /**
   * Закрытие заметки для карточки
   */
  const closeNoteForCard = (card, closeOptions = { saveToHistory: false }) => {
    const note = ensureCardNote(card)
    if (!note) {
      return
    }
    note.visible = false
    if (closeOptions.saveToHistory) {
      historyStore.setActionMetadata('update', `Закрыта заметка для карточки "${card.text}"`)
      historyStore.saveState()
    }
  }

  /**
   * Обработчик закрытия окна заметки
   */
  const handleNoteWindowClose = (cardId) => {
    const card = findCardById(cardId)
    if (!card) {
      return
    }
    closeNoteForCard(card)
  }

  /**
   * Синхронизация всех видимых окон заметок
   */
  const syncAllNoteWindows = () => {
    cardsWithVisibleNotes.value.forEach(card => {
      syncNoteWindowWithCard(card.id)
    })
  }

  return {
    // State
    noteWindowRefs,

    // Computed
    cardsWithVisibleNotes,

    // Методы
    ensureCardNote,
    handleNoteWindowRegister,
    syncNoteWindowWithCard,
    openNoteForCard,
    closeNoteForCard,
    handleNoteWindowClose,
    syncAllNoteWindows
  }
}
