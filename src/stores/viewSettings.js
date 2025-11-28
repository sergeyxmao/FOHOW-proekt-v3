import { defineStore } from 'pinia'
import { useCanvasStore } from './canvas'
import { useConnectionsStore } from './connections'
import { useCardsStore } from './cards'
import { HEADER_COLORS, getHeaderColorRgb } from '../utils/constants'

const MIN_LINE_THICKNESS = 1
const MAX_LINE_THICKNESS = 20
const MIN_ANIMATION_SECONDS = 2
const MAX_ANIMATION_SECONDS = 999

function clampThickness(value) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) {
    return MIN_LINE_THICKNESS
  }
  return Math.min(Math.max(Math.round(numericValue), MIN_LINE_THICKNESS), MAX_LINE_THICKNESS)
}

function clampAnimationSeconds(value) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) {
    return MIN_ANIMATION_SECONDS
  }
  return Math.min(Math.max(Math.round(numericValue), MIN_ANIMATION_SECONDS), MAX_ANIMATION_SECONDS)
}

export const useViewSettingsStore = defineStore('viewSettings', {
  state: () => {
    const connectionsStore = useConnectionsStore()
    const canvasStore = useCanvasStore()
    const initialAnimation = connectionsStore.defaultAnimationDuration || (MIN_ANIMATION_SECONDS * 1000)
    const initialBackground = typeof canvasStore.backgroundColor === 'string'
      ? canvasStore.backgroundColor
      : canvasStore.backgroundColor?.value
    const fallbackBackground = typeof initialBackground === 'string' && initialBackground.length > 0
      ? initialBackground
      : '#b9c4da'

    return {
      lineColor: connectionsStore.defaultLineColor || '#0f62fe',
      lineThickness: connectionsStore.defaultLineThickness || 5,
      isGlobalLineMode: false,
      animationSeconds: clampAnimationSeconds(initialAnimation / 1000),
      headerColor: '#5D8BF4',
      headerColorIndex: 0,
      backgroundGradient: fallbackBackground
    }
  },

  getters: {
    sliderTrackStyle(state) {
      const value = clampThickness(state.lineThickness)
      const percent = ((value - MIN_LINE_THICKNESS) / (MAX_LINE_THICKNESS - MIN_LINE_THICKNESS)) * 100
      return `linear-gradient(to right, ${state.lineColor} 0%, ${state.lineColor} ${percent}%, #e5e7eb ${percent}%, #e5e7eb 100%)`
    },
    animationDurationMs(state) {
      return clampAnimationSeconds(state.animationSeconds) * 1000
    }
  },

  actions: {
    setLineColor(color) {
      if (typeof color !== 'string' || color.length === 0) {
        return
      }
      this.lineColor = color
      const connectionsStore = useConnectionsStore()
      if (this.isGlobalLineMode) {
        connectionsStore.updateAllConnectionsColorIncludingAvatars(color)
      }
    },

    setLineThickness(value) {
      const normalized = clampThickness(value)
      this.lineThickness = normalized
      const connectionsStore = useConnectionsStore()
      if (this.isGlobalLineMode) {
        connectionsStore.updateAllConnectionsThicknessIncludingAvatars(normalized)
      }
    },

    toggleGlobalLineMode() {
      this.isGlobalLineMode = !this.isGlobalLineMode
    },

    setAnimationSeconds(value) {
      const seconds = clampAnimationSeconds(value)
      this.animationSeconds = seconds
      const connectionsStore = useConnectionsStore()
      if (this.isGlobalLineMode) {
        connectionsStore.updateAllConnectionsIncludingAvatars({ animationDuration: seconds * 1000 })
      }
      connectionsStore.setDefaultConnectionParameters(this.lineColor, this.lineThickness, seconds * 1000)
    },

    setHeaderColor(color) {
      if (typeof color !== 'string' || color.length === 0) {
        return
      }

      this.headerColor = color
      const colorIndex = HEADER_COLORS.findIndex(c => c.rgb === color)
      this.headerColorIndex = colorIndex !== -1 ? colorIndex : -1

      const cardsStore = useCardsStore()
      const selectedCards = cardsStore.selectedCards
      if (Array.isArray(selectedCards) && selectedCards.length > 0) {
        const cardIds = selectedCards.map(card => card.id)
        cardsStore.updateCardHeaderColor(cardIds, this.headerColorIndex, this.headerColor)
      }
    },

    cycleHeaderColor() {
      const nextIndex = this.headerColorIndex >= 0
        ? (this.headerColorIndex + 1) % HEADER_COLORS.length
        : 0

      this.headerColorIndex = nextIndex
      this.headerColor = getHeaderColorRgb(nextIndex)

      const cardsStore = useCardsStore()
      const selectedCards = cardsStore.selectedCards
      if (Array.isArray(selectedCards) && selectedCards.length > 0) {
        const cardIds = selectedCards.map(card => card.id)
        cardsStore.updateCardHeaderColor(cardIds, nextIndex)
      }
    },

    setBackground(gradient) {
      if (typeof gradient !== 'string' || gradient.length === 0) {
        return
      }
      this.backgroundGradient = gradient
      const canvasStore = useCanvasStore()
      canvasStore.setBackgroundGradient(gradient)
    }
  }
})
