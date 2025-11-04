import { defineStore } from 'pinia'

export const useSidePanelsStore = defineStore('sidePanels', {
  state: () => ({
    activePanel: null // 'notes' | 'comments' | null
  }),

  getters: {
    isNotesOpen: (state) => state.activePanel === 'notes',
    isCommentsOpen: (state) => state.activePanel === 'comments',
    isPanelOpen: (state) => state.activePanel !== null
  },

  actions: {
    openNotes() {
      this.activePanel = 'notes'
    },

    openComments() {
      this.activePanel = 'comments'
    },

    closePanel() {
      this.activePanel = null
    },

    toggleNotes() {
      if (this.activePanel === 'notes') {
        this.activePanel = null
      } else {
        this.activePanel = 'notes'
      }
    },

    toggleComments() {
      if (this.activePanel === 'comments') {
        this.activePanel = null
      } else {
        this.activePanel = 'comments'
      }
    }
  }
})
