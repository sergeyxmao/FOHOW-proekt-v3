import { defineStore } from 'pinia'
import { useCanvasStore } from './canvas'
import { useConnectionsStore } from './connections'
import { useCardsStore } from './cards'
import { useAuthStore } from './auth'
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
    const authStore = useAuthStore()
    let cachedUser = null

    try {
      const cachedUserRaw = localStorage.getItem('user')
      cachedUser = cachedUserRaw ? JSON.parse(cachedUserRaw) : null
    } catch (error) {
      console.error('[ViewSettings] Ошибка чтения user из localStorage:', error)
    }

    const uiPreferencesSource = authStore?.user?.ui_preferences || cachedUser?.ui_preferences || {}    
    const initialAnimation = connectionsStore.defaultAnimationDuration || (MIN_ANIMATION_SECONDS * 1000)
    const initialBackground = typeof canvasStore.backgroundColor === 'string'
      ? canvasStore.backgroundColor
      : canvasStore.backgroundColor?.value
    const fallbackBackground = typeof initialBackground === 'string' && initialBackground.length > 0
      ? initialBackground
      : '#b9c4da'
    const animationColorFromProfile = typeof uiPreferencesSource.animationColor === 'string'
      ? uiPreferencesSource.animationColor
      : '#5D8BF4'
    const animationEnabledFromProfile = typeof uiPreferencesSource.isAnimationEnabled === 'boolean'
      ? uiPreferencesSource.isAnimationEnabled
      : true

    const lineColorFromProfile = typeof uiPreferencesSource.lineColor === 'string'
      ? uiPreferencesSource.lineColor
      : connectionsStore.defaultLineColor || '#0f62fe'
    const lineThicknessFromProfile = Number.isFinite(Number(uiPreferencesSource.lineThickness))
      ? clampThickness(uiPreferencesSource.lineThickness)
      : null
    const backgroundFromProfile = typeof uiPreferencesSource.backgroundGradient === 'string'
      ? uiPreferencesSource.backgroundGradient
      : undefined

    return {
      lineColor: lineColorFromProfile,
      lineThickness: lineThicknessFromProfile || connectionsStore.defaultLineThickness || 5,
      isGlobalLineMode: false,
      animationColor: animationColorFromProfile,
      isAnimationEnabled: animationEnabledFromProfile,      
      animationSeconds: clampAnimationSeconds(initialAnimation / 1000),
      headerColor: '#5D8BF4',
      headerColorIndex: 0,
      backgroundGradient: backgroundFromProfile || fallbackBackground
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
    async persistUiPreferences(partialPreferences) {
      const authStore = useAuthStore()

      if (!authStore?.isAuthenticated) {
        return
      }

      try {
        const mergedPreferences = {
          ...(authStore.user?.ui_preferences || {}),
          ...partialPreferences
        }

        await authStore.updateProfile({ ui_preferences: mergedPreferences })
      } catch (error) {
        console.error('[ViewSettings] Не удалось сохранить UI-настройки в профиле:', error)
      }
    },

    async setLineColor(color) {
      if (typeof color !== 'string' || color.length === 0) {
        return
      }
      this.lineColor = color
      const connectionsStore = useConnectionsStore()
      if (this.isGlobalLineMode) {
        connectionsStore.updateAllConnectionsColorIncludingAvatars(color)
      }
      await this.persistUiPreferences({ lineColor: color })      
    },

    async setLineThickness(value) {
      const normalized = clampThickness(value)
      this.lineThickness = normalized
      const connectionsStore = useConnectionsStore()
      if (this.isGlobalLineMode) {
        connectionsStore.updateAllConnectionsThicknessIncludingAvatars(normalized)
      }

      await this.persistUiPreferences({ lineThickness: normalized })      
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
    async setAnimationColor(color) {
      if (typeof color !== 'string' || color.length === 0) {
        return
      }
      this.animationColor = color

      await this.persistUiPreferences({ animationColor: color })
    },

    async toggleAnimation(forceValue) {
      if (typeof forceValue === 'boolean') {
        this.isAnimationEnabled = forceValue
        await this.persistUiPreferences({ isAnimationEnabled: this.isAnimationEnabled })
        return
      }

      this.isAnimationEnabled = !this.isAnimationEnabled
      await this.persistUiPreferences({ isAnimationEnabled: this.isAnimationEnabled })
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

    async setBackground(gradient) {
      if (typeof gradient !== 'string' || gradient.length === 0) {
        return
      }
      this.backgroundGradient = gradient
      const canvasStore = useCanvasStore()
      canvasStore.setBackgroundGradient(gradient)

      await this.persistUiPreferences({ backgroundGradient: gradient })      
    }
  }
})
