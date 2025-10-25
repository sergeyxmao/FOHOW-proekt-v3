import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useNotesStore = defineStore('notes', () => {
  const notes = ref({});
  const activeNoteId = ref(null);
  
  // Получить заметку по ID карточки
  function getNote(cardId) {
    return notes.value[cardId];
  }
  
  // Создать или обновить заметку
  function setNote(cardId, noteData) {
    if (!notes.value[cardId]) {
      notes.value[cardId] = {
        text: '',
        entries: {},
        colors: {},
        selectedDate: formatLocalYMD(new Date()),
        highlightColor: '#f44336',
        width: 260,
        height: 380,
        visible: false,
        x: 100,
        y: 100,
        ...noteData
      };
    } else {
      notes.value[cardId] = {
        ...notes.value[cardId],
        ...noteData
      };
    }
  }
  
  // Показать окно заметки
  function showNote(cardId, position = {}) {
    if (!notes.value[cardId]) {
      setNote(cardId, {
        visible: true,
        x: position.x || 100,
        y: position.y || 100
      });
    } else {
      notes.value[cardId].visible = true;
      if (position.x !== undefined) notes.value[cardId].x = position.x;
      if (position.y !== undefined) notes.value[cardId].y = position.y;
    }
    activeNoteId.value = cardId;
  }
  
  // Скрыть окно заметки
  function hideNote(cardId) {
    if (notes.value[cardId]) {
      notes.value[cardId].visible = false;
    }
    if (activeNoteId.value === cardId) {
      activeNoteId.value = null;
    }
  }
  
  // Переключить видимость заметки
  function toggleNote(cardId, position = {}) {
    const note = notes.value[cardId];
    if (note && note.visible) {
      hideNote(cardId);
    } else {
      showNote(cardId, position);
    }
  }
  
  // Обновить текст заметки для выбранной даты
  function updateNoteText(cardId, date, text) {
    if (!notes.value[cardId]) {
      setNote(cardId, {});
    }
    
    if (!notes.value[cardId].entries) {
      notes.value[cardId].entries = {};
    }
    
    if (text && text.trim()) {
      notes.value[cardId].entries[date] = {
        text: text,
        updatedAt: new Date().toISOString()
      };
    } else {
      delete notes.value[cardId].entries[date];
    }
  }
  
  // Обновить цвет для даты
  function updateNoteColor(cardId, date, color) {
    if (!notes.value[cardId]) {
      setNote(cardId, {});
    }
    
    if (!notes.value[cardId].colors) {
      notes.value[cardId].colors = {};
    }
    
    notes.value[cardId].colors[date] = color;
  }
  
  // Обновить основной цвет выделения
  function updateHighlightColor(cardId, color) {
    if (!notes.value[cardId]) {
      setNote(cardId, {});
    }
    notes.value[cardId].highlightColor = color;
  }
  
  // Обновить выбранную дату
  function updateSelectedDate(cardId, date) {
    if (!notes.value[cardId]) {
      setNote(cardId, {});
    }
    notes.value[cardId].selectedDate = date;
  }
  
  // Обновить позицию окна заметки
  function updateNotePosition(cardId, x, y) {
    if (notes.value[cardId]) {
      notes.value[cardId].x = x;
      notes.value[cardId].y = y;
    }
  }
  
  // Обновить размер окна заметки
  function updateNoteSize(cardId, width, height) {
    if (notes.value[cardId]) {
      if (width >= 200) notes.value[cardId].width = width;
      if (height >= 200) notes.value[cardId].height = height;
    }
  }
  
  // Удалить заметку
  function removeNote(cardId) {
    delete notes.value[cardId];
    if (activeNoteId.value === cardId) {
      activeNoteId.value = null;
    }
  }
  
  // Закрыть все окна заметок
  function closeAllNotes() {
    Object.keys(notes.value).forEach(cardId => {
      if (notes.value[cardId]) {
        notes.value[cardId].visible = false;
      }
    });
    activeNoteId.value = null;
  }
  
  // Получить все заметки с текстом
  function getAllNotesWithText() {
    const result = [];
    Object.entries(notes.value).forEach(([cardId, note]) => {
      if (note && note.entries) {
        Object.entries(note.entries).forEach(([date, entry]) => {
          if (entry && entry.text && entry.text.trim()) {
            result.push({
              cardId,
              date,
              text: entry.text,
              color: note.colors?.[date] || note.highlightColor,
              updatedAt: entry.updatedAt
            });
          }
        });
      }
    });
    return result.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateA - dateB;
    });
  }
  
  // Вспомогательные функции
  function formatLocalYMD(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  // Computed свойства
  const hasAnyNotes = computed(() => {
    return Object.keys(notes.value).some(cardId => {
      const note = notes.value[cardId];
      return note && note.entries && Object.keys(note.entries).length > 0;
    });
  });
  
  const visibleNotes = computed(() => {
    return Object.entries(notes.value)
      .filter(([_, note]) => note.visible)
      .map(([cardId, note]) => ({ cardId, ...note }));
  });
  
  return {
    notes,
    activeNoteId,
    getNote,
    setNote,
    showNote,
    hideNote,
    toggleNote,
    updateNoteText,
    updateNoteColor,
    updateHighlightColor,
    updateSelectedDate,
    updateNotePosition,
    updateNoteSize,
    removeNote,
    closeAllNotes,
    getAllNotesWithText,
    hasAnyNotes,
    visibleNotes
  };
});
