import { ref, computed } from 'vue';
import { defineStore } from 'pinia';
import { useAuthStore } from './auth.js';
import { useBoardStore } from './board.js';
import { useCardsStore } from './cards.js';

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
  const visibleNoteCardId = ref(null); 
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

      // ---> ИЗМЕНЕНИЯ ЗДЕСЬ
      const groupedNotes = {}; // Создаем временный объект для группировки

      // Группируем заметки по card_uid и note_date
      if (data.notes && Array.isArray(data.notes)) {
        data.notes.forEach(note => {
          const cardUid = note.card_uid;
          const noteDate = note.note_date.slice(0, 10); // Обрезаем до "ГГГГ-ММ-ДД"

          if (!groupedNotes[cardUid]) {
            groupedNotes[cardUid] = {};
          }

          groupedNotes[cardUid][noteDate] = {
            content: note.content || '',
            color: note.color || ''
          };
        });
      }
      // Записываем сгруппированные заметки в главный объект под ключом boardId
      notesByBoard.value[boardId] = groupedNotes;
      currentBoardId.value = boardId; // Обновляем ID текущей доски

      // Обновляем cardsWithEntries для UI
      updateCardsWithEntries();
      // <--- КОНЕЦ ИЗМЕНЕНИЙ

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
      // ВОТ ИСПРАВЛЕННЫЙ ЗАПРОС К СЕРВЕРУ
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
        // Читаем детали ошибки из ответа сервера
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || 'Ошибка сохранения заметки';

        // Показываем сообщение об ошибке пользователю
        alert(errorMessage);

        throw new Error(errorMessage);
      }

      const data = await response.json();

      // АРХИТЕКТУРНЫЕ ИЗМЕНЕНИЯ (ОНИ УЖЕ БЫЛИ ПРАВИЛЬНЫМИ)
      // Убеждаемся, что у нас есть объект для текущей доски
      if (!notesByBoard.value[boardId]) {
        notesByBoard.value[boardId] = {};
      }
      const notesForCurrentBoard = notesByBoard.value[boardId];

      // Обновляем локальное состояние
      if (data.deleted) {
        // Заметка была удалена
        if (notesForCurrentBoard[cardUid]) {
          delete notesForCurrentBoard[cardUid][noteDate];
          if (Object.keys(notesForCurrentBoard[cardUid]).length === 0) {
            delete notesForCurrentBoard[cardUid];
          }
        }
      } else {
        // Заметка была создана или обновлена
        if (!notesForCurrentBoard[cardUid]) {
          notesForCurrentBoard[cardUid] = {};
        }
        notesForCurrentBoard[cardUid][noteDate] = {
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
   * Получает срез заметок для текущей активной доски
   * @private
   */
  const notesForCurrentBoard = computed(() => {
    const boardStore = useBoardStore();
    if (!boardStore.currentBoardId) return {};
    return notesByBoard.value[boardStore.currentBoardId] || {};
  });

  /**
   * Получает заметку для конкретной карточки и даты на ТЕКУЩЕЙ доске
   * @param {string} cardUid - ID карточки
   * @param {string} noteDate - Дата в формате YYYY-MM-DD
   * @returns {Object|null} - { content, color } или null
   */
  function getNote(cardUid, noteDate) {
    const notesForCard = notesForCurrentBoard.value[cardUid];
    if (!notesForCard) {
      return null;
    }
    return notesForCard[noteDate] || null;
  }

  /**
   * Получает все заметки для карточки на ТЕКУЩЕЙ доске
   * @param {string} cardUid - ID карточки
   * @returns {Object} - { "2025-11-04": { content, color }, ... }
   */
  function getNotesForCard(cardUid) {
    return notesForCurrentBoard.value[cardUid] || {};
  }

  /**
   * Очищает все заметки
   */
  function clearNotes() {
    notesByBoard.value = {}; // <--- ИЗМЕНЕНИЕ ЗДЕСЬ
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
    const cardsStore = useCardsStore();
    
    // ---> ИЗМЕНЕНИЯ ЗДЕСЬ
    // Используем геттер, который уже знает о текущей доске
    const currentNotes = notesForCurrentBoard.value; 
    // <--- КОНЕЦ ИЗМЕНЕНИЙ

    Object.keys(currentNotes).forEach(cardUid => {
      const notes = currentNotes[cardUid];

      // Фильтруем только заметки с непустым содержимым
      const entries = Object.keys(notes)
        .filter(date => {
          const content = notes[date].content || '';
          return content.trim() !== ''; // Показываем только заметки с текстом
        })
        .map(date => ({
          date,
          day: parseInt(date.split('-')[2], 10),
          label: date,
          color: notes[date].color || '#f44336'
        }))
        .sort((a, b) => a.day - b.day);

      // Добавляем карточку только если есть непустые заметки
      if (entries.length > 0) {
        // Получаем настоящее название карточки из cardsStore
        const card = cardsStore.cards.find(c => c.id === cardUid);
        const cardTitle = card ? card.text : cardUid;

        cards.push({
          id: cardUid,
          title: cardTitle,
          entries
        });
      }
    });

    // Сортируем карточки по названию лицензии
    cards.sort((a, b) => a.title.localeCompare(b.title));

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

    function showNoteForCard(cardId) {
      visibleNoteCardId.value = cardId;
    }

    function hideNoteForCard() {
      visibleNoteCardId.value = null;
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
	visibleNoteCardId,
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
    showNoteForCard, // <--- И СЮДА
    hideNoteForCard, // <--- И СЮДА	
    toggleDropdown,
    closeDropdown,
    requestOpen,
    consumeOpenRequest,
    consumeFocusRequest,
    consumeSelectedDate
  };
});
