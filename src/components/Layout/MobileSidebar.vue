<script setup>
import { computed } from 'vue'
import { useCanvasStore } from '@/stores/canvas'

const props = defineProps({
  isModernTheme: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits([
  'export-html',
  'load-json'
])

const canvasStore = useCanvasStore()

const isHierarchyMode = computed(() => canvasStore.isHierarchicalDragMode)

const handleExportHTML = () => {
  emit('export-html')
}

const handleLoadJSON = () => {
  emit('load-json')
}

const toggleHierarchyMode = () => {
  canvasStore.toggleHierarchicalDragMode()
}
</script>

<template>
  <div class="mobile-sidebar" :class="{ 'mobile-sidebar--dark': isModernTheme }">
    <!-- Экспорт HTML -->
    <button
      class="mobile-sidebar-button"
      type="button"
      @click="handleExportHTML"
      title="Экспортировать HTML"
    >
      <span class="sidebar-icon">📤</span>
    </button>

    <!-- Загрузить JSON -->
    <button
      class="mobile-sidebar-button"
      type="button"
      @click="handleLoadJSON"
      title="Загрузить JSON"
    >
      <span class="sidebar-icon">📥</span>
    </button>

    <!-- Режим иерархии -->
    <button
      class="mobile-sidebar-button hierarchy-button"
      :class="{ 'hierarchy-button--active': isHierarchyMode }"
      type="button"
      @click="toggleHierarchyMode"
      title="Режим иерархии"
    >
      <span class="sidebar-icon">🔗</span>
    </button>
  </div>
</template>

<style scoped>
.mobile-sidebar {
  position: fixed;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  gap: 12px;
  z-index: 900;
}

.mobile-sidebar-button {
  width: 52px;
  height: 52px;
  border: none;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  color: #111827;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  user-select: none;
  border: 1px solid rgba(0, 0, 0, 0.08);
}

.mobile-sidebar--dark .mobile-sidebar-button {
  background: rgba(28, 38, 58, 0.95);
  color: #e5f3ff;
  border-color: rgba(255, 255, 255, 0.1);
}

.mobile-sidebar-button:active {
  transform: scale(0.95);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
}

.sidebar-icon {
  font-size: 26px;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1));
}

/* Активное состояние для кнопки иерархии */
.hierarchy-button--active {
  background: linear-gradient(135deg, #0f62fe 0%, #0353e9 100%);
  color: #ffffff;
  box-shadow: 0 4px 12px rgba(15, 98, 254, 0.4);
}

.mobile-sidebar--dark .hierarchy-button--active {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
}

.hierarchy-button--active .sidebar-icon {
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
}

/* Адаптация для маленьких экранов */
@media (max-width: 480px) {
  .mobile-sidebar {
    right: 8px;
  }

  .mobile-sidebar-button {
    width: 48px;
    height: 48px;
  }

  .sidebar-icon {
    font-size: 24px;
  }
}

/* Адаптация для очень маленьких экранов */
@media (max-width: 360px) {
  .mobile-sidebar {
    right: 6px;
    gap: 10px;
  }

  .mobile-sidebar-button {
    width: 44px;
    height: 44px;
  }

  .sidebar-icon {
    font-size: 22px;
  }
}
</style>
