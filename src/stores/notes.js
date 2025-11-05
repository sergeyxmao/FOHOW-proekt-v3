import { ref, computed } from 'vue';
import { defineStore } from 'pinia';
import { useAuthStore } from './auth.js';
import { useBoardStore } from './board.js';

export const useNotesStore = defineStore('notes', () => {
  // ============================================
  // STATE - Данные заметок
  // ============================================

  // Хранилище заметок: { "card-id-1": { "2025-11-04": { content: "...", color: "..." } } }
  const notesByBoard = ref({});

  // Текущая доска, для которой загружены заметки
  const currentBoardId = ref(null);

  // ============================================
  // STATE - UI состояние (сохранено из старого store)
  // ============================================

  const dropdownOpen = ref(false);
  const cardsWithEntries = ref([]);
  const pendingOpenCardId = ref(null);
  const pendingFocusCardId = ref(null);
  const pendingSelectedDate = ref(null);

  // ============================================
  // GETTERS
  // ============================================

  const hasEntries = computed(() => cardsWithEntries.value.length > 0);

  const API_URL = import.meta.env.VITE_API_URL || 'https://interactive.marketingfohow.ru/api';

  // ============================================
  // ACTIONS - Работа с API
  // ============================================

  /**
   * Загружает все заметки для указанной доски
   * @param {number|string} boardId - ID доски
   */
  async function fetchNotesForBoard(boardId) {
    const authStore = useAuthStore();

    if (!authStore.isAuthenticated || !authStore.token) {
      console.warn('Пользователь не авторизован');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/boards/${boardId}/notes`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authStore.token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Ошибка загрузки заметок');
      }

      const data = await response.json();

      // Очищаем текущее состояние
      notesByBoard.value = {};
      currentBoardId.value = boardId;

      // Группируем заметки по card_uid и note_date
      if (data.notes && Array.isArray(data.notes)) {
        data.notes.forEach(note => {
          const cardUid = note.card_uid;
          const noteDate = note.note_date;

          if (!notesByBoard.value[cardUid]) {
            notesByBoard.value[cardUid] = {};
          }

          notesByBoard.value[cardUid][noteDate] = {
            content: note.content || '',
            color: note.color || ''
          };
        });
      }

      // Обновляем cardsWithEntries для UI
      updateCardsWithEntries();

    } catch (error) {
      console.error('Ошибка загрузки заметок:', error);
      throw error;
    }
  }

  /**
   * Сохраняет заметку (создание/обновление/удаление)
   * @param {Object} noteData - { boardId, cardUid, noteDate, content, color }
   */
  async function saveNote(noteData) {
    const authStore = useAuthStore();
    const boardStore = useBoardStore();

    if (!authStore.isAuthenticated || !authStore.token) {
      console.warn('Пользователь не авторизован');
      return;
    }

    if (!boardStore.currentBoardId) {
      console.warn('Структура еще не создана');
      return { error: 'no_structure', message: 'Необходимо создать структуру перед созданием заметки' };
    }

    const { boardId, cardUid, noteDate, content, color } = noteData;

    if (!boardId || !cardUid || !noteDate) {
      console.error('Отсутствуют обязательные поля:', noteData);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/notes`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authStore.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          boardId,
          cardUid,
          noteDate,
          content: content || '',
          color: color || ''
        })
      });

      if (!response.ok) {
        throw new Error('Ошибка сохранения заметки');
      }

      const data = await response.json();

      // Обновляем локальное состояние
      if (data.deleted) {
        // Заметка была удалена
        if (notesByBoard.value[cardUid]) {
          delete notesByBoard.value[cardUid][noteDate];

          // Если у карточки не осталось заметок, удаляем её из объекта
          if (Object.keys(notesByBoard.value[cardUid]).length === 0) {
            delete notesByBoard.value[cardUid];
          }
        }
      } else {
        // Заметка была создана или обновлена
        if (!notesByBoard.value[cardUid]) {
          notesByBoard.value[cardUid] = {};
        }

        notesByBoard.value[cardUid][noteDate] = {
          content: content || '',
          color: color || ''
        };
      }

      // Обновляем cardsWithEntries для UI
      updateCardsWithEntries();

      return data;
    } catch (error) {
      console.error('Ошибка сохранения заметки:', error);
      throw error;
    }
  }

  /**
   * Получает заметку для конкретной карточки и даты
   * @param {string} cardUid - ID карточки
   * @param {string} noteDate - Дата в формате YYYY-MM-DD
   * @returns {Object|null} - { content, color } или null
   */
  function getNote(cardUid, noteDate) {
    if (!notesByBoard.value[cardUid]) {
      return null;
    }

    return notesByBoard.value[cardUid][noteDate] || null;
  }

  /**
   * Получает все заметки для карточки
   * @param {string} cardUid - ID карточки
   * @returns {Object} - { "2025-11-04": { content, color }, ... }
   */
  function getNotesForCard(cardUid) {
    return notesByBoard.value[cardUid] || {};
  }

  /**
   * Очищает все заметки
   */
  function clearNotes() {
    notesByBoard.value = {};
    currentBoardId.value = null;
    cardsWithEntries.value = [];
    dropdownOpen.value = false;
  }

  /**
   * Очищает все заметки для конкретной карточки
   * @param {string} cardUid - ID карточки
   */
  function clearNotesForCard(cardUid) {
    if (notesByBoard.value[cardUid]) {
      delete notesByBoard.value[cardUid];
      updateCardsWithEntries();
    }
  }

  /**
   * Обновляет список карточек с заметками для UI
   * @private
   */
  function updateCardsWithEntries() {
    const cards = [];

    Object.keys(notesByBoard.value).forEach(cardUid => {
      const notes = notesByBoard.value[cardUid];
      const entries = Object.keys(notes).map(date => ({
        date,
        day: parseInt(date.split('-')[2], 10),
        label: date,
        color: notes[date].color || '#f44336'
      })).sort((a, b) => a.day - b.day);

      if (entries.length > 0) {
        cards.push({
          id: cardUid,
          title: cardUid,
          entries
        });
      }
    });

    cardsWithEntries.value = cards;
  }

  // ============================================
  // ACTIONS - UI состояние (сохранено из старого store)
  // ============================================

  function setCardsWithEntries(list) {
    if (Array.isArray(list)) {
      cardsWithEntries.value = list.map(item => ({
        ...item,
        entries: Array.isArray(item?.entries) ? item.entries.slice() : []
      }));
    } else {
      cardsWithEntries.value = [];
    }

    if (!cardsWithEntries.value.length) {
      dropdownOpen.value = false;
    }
  }

  function toggleDropdown() {
    if (!hasEntries.value) {
      dropdownOpen.value = false;
      return;
    }
    dropdownOpen.value = !dropdownOpen.value;
  }

  function closeDropdown() {
    dropdownOpen.value = false;
  }

  function requestOpen(cardId, { focus = true, date = null } = {}) {
    pendingOpenCardId.value = cardId;
    pendingSelectedDate.value = typeof date === 'string' ? date : null;
    if (focus) {
      pendingFocusCardId.value = cardId;
    }
  }

  function consumeOpenRequest() {
    const id = pendingOpenCardId.value;
    pendingOpenCardId.value = null;
    return id;
  }

  function consumeFocusRequest() {
    const id = pendingFocusCardId.value;
    pendingFocusCardId.value = null;
    return id;
  }

  function consumeSelectedDate() {
    const date = pendingSelectedDate.value;
    pendingSelectedDate.value = null;
    return date;
  }

  // ============================================
  // RETURN
  // ============================================

  return {
    // State - данные заметок
    notesByBoard,
    currentBoardId,

    // State - UI
    dropdownOpen,
    cardsWithEntries,
    pendingOpenCardId,
    pendingFocusCardId,
    pendingSelectedDate,

    // Getters
    hasEntries,

    // Actions - работа с API
    fetchNotesForBoard,
    saveNote,
    getNote,
    getNotesForCard,
    clearNotes,
    clearNotesForCard,

    // Actions - UI
    setCardsWithEntries,
    toggleDropdown,
    closeDropdown,
    requestOpen,
    consumeOpenRequest,
    consumeFocusRequest,
    consumeSelectedDate
  };
});
