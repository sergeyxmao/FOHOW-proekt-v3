import { defineStore } from 'pinia'

const createComment = (id, text) => ({
  id,
  text,
  createdAt: new Date().toISOString()
})

export const useBoardCommentsStore = defineStore('boardComments', {
  state: () => ({
    comments: [],
    nextId: 1
  }),

  getters: {
    hasComments: (state) => state.comments.length > 0,
    orderedComments: (state) => [...state.comments].sort((a, b) => b.id - a.id)
  },

  actions: {
    addComment(rawText) {
      const text = typeof rawText === 'string' ? rawText.trim() : ''
      if (!text) {
        return
      }
      const id = this.nextId
      this.nextId += 1
      this.comments.push(createComment(id, text))
    },

    updateComment(id, rawText) {
      const target = this.comments.find(comment => comment.id === id)
      if (!target) {
        return
      }
      const text = typeof rawText === 'string' ? rawText.trim() : ''
      if (!text) {
        this.removeComment(id)
        return
      }
      target.text = text
    },

    removeComment(id) {
      this.comments = this.comments.filter(comment => comment.id !== id)
    },

    clearComments() {
      this.comments = []
      this.nextId = 1
    }
  }
})
