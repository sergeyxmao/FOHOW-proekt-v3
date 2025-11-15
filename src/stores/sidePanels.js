import { defineStore } from 'pinia'

export const useSidePanelsStore = defineStore('sidePanels', {
  state: () => ({
    activePanel: null // 'notes' | 'comments' | 'stickerMessages' | 'imageBrowser' | null
  }),

  getters: {
    isNotesOpen: (state) => state.activePanel === 'notes',
    isCommentsOpen: (state) => state.activePanel === 'comments',
    isStickerMessagesOpen: (state) => state.activePanel === 'stickerMessages',
    isImageBrowserOpen: (state) => state.activePanel === 'imageBrowser',
    isPanelOpen: (state) => state.activePanel !== null
  },

  actions: {
    openNotes() {
      this.activePanel = 'notes'
    },

    openComments() {
      this.activePanel = 'comments'
    },

    openStickerMessages() {
      this.activePanel = 'stickerMessages'
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
    },

    toggleStickerMessages() {
      if (this.activePanel === 'stickerMessages') {
        this.activePanel = null
      } else {
        this.activePanel = 'stickerMessages'
      }
    },

    openImageBrowser() {
      this.activePanel = 'imageBrowser'
    },

    toggleImageBrowser() {
      if (this.activePanel === 'imageBrowser') {
        this.activePanel = null
      } else {
        this.activePanel = 'imageBrowser'
      }
    }
  }
})
