import { defineStore } from 'pinia'

export const useSidePanelsStore = defineStore('sidePanels', {
  state: () => ({
    activePanel: null // 'notes' | 'comments' | 'stickerMessages' | 'images' | 'anchors' | 'partners' | null
  }),

  getters: {
    isNotesOpen: (state) => state.activePanel === 'notes',
    isCommentsOpen: (state) => state.activePanel === 'comments',
    isStickerMessagesOpen: (state) => state.activePanel === 'stickerMessages',
    isAnchorsOpen: (state) => state.activePanel === 'anchors',
    isImagesOpen: (state) => state.activePanel === 'images',
    isPartnersOpen: (state) => state.activePanel === 'partners',
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
    toggleAnchors() {
      if (this.activePanel === 'anchors') {
        this.activePanel = null
      } else {
        this.activePanel = 'anchors'
      }
    },

    openAnchors() {
      this.activePanel = 'anchors'
    },

    openImages() {
      this.activePanel = 'images'
    },

    toggleImages() {
      if (this.activePanel === 'images') {
        this.activePanel = null
      } else {
        this.activePanel = 'images'
      }
    },

    openPartners() {
      this.activePanel = 'partners'
    },

    togglePartners() {
      if (this.activePanel === 'partners') {
        this.activePanel = null
      } else {
        this.activePanel = 'partners'
      }
    }
  }
})
