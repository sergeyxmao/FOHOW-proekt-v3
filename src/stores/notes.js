import { defineStore } from 'pinia';

export const useNotesStore = defineStore('notes', {
  state: () => ({
    dropdownOpen: false,
    cardsWithEntries: [],
    pendingOpenCardId: null,
    pendingFocusCardId: null
  }),

  getters: {
    hasEntries: (state) => state.cardsWithEntries.length > 0
  },

  actions: {
    setCardsWithEntries(list) {
      this.cardsWithEntries = Array.isArray(list) ? list.slice() : [];
      if (!this.cardsWithEntries.length) {
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

    requestOpen(cardId, { focus = true } = {}) {
      this.pendingOpenCardId = cardId;
      if (focus) {
        this.pendingFocusCardId = cardId;
      }
      this.dropdownOpen = false;
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
    }
  }
});
