import { defineStore } from 'pinia';

export const useNotesStore = defineStore('notes', {
  state: () => ({
    dropdownOpen: false,
    cardsWithEntries: [],
    pendingOpenCardId: null,
    pendingFocusCardId: null,
    pendingSelectedDate: null
  }),

  getters: {
    hasEntries: (state) => state.cardsWithEntries.length > 0
  },

  actions: {
    setCardsWithEntries(list) {
      if (Array.isArray(list)) {
        this.cardsWithEntries = list.map(item => ({
          ...item,
          entries: Array.isArray(item?.entries) ? item.entries.slice() : []
        }));
      } else {
        this.cardsWithEntries = [];
      }      if (!this.cardsWithEntries.length) {
        this.dropdownOpen = false;
      }
    },

    toggleDropdown() {
      if (!this.hasEntries) {
        this.dropdownOpen = false;
        return;
      }
      this.dropdownOpen = !this.dropdownOpen;
    },

    closeDropdown() {
      this.dropdownOpen = false;
    },

    requestOpen(cardId, { focus = true, date = null } = {}) {
      this.pendingOpenCardId = cardId;
      this.pendingSelectedDate = typeof date === 'string' ? date : null;
      if (focus) {
        this.pendingFocusCardId = cardId;
      }
    },

    consumeOpenRequest() {
      const id = this.pendingOpenCardId;
      this.pendingOpenCardId = null;
      return id;
    },

    consumeFocusRequest() {
      const id = this.pendingFocusCardId;
      this.pendingFocusCardId = null;
      return id;
    },

    consumeSelectedDate() {
      const date = this.pendingSelectedDate;
      this.pendingSelectedDate = null;
      return date;      
    }
  }
});
