<script setup>
import { computed } from 'vue'
import { useProjectActions } from '../../composables/useProjectActions.js'
const props = defineProps({
  isModernTheme: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['request-close'])

const {
  handleSaveProject,
  handleLoadProject,
  handleExportHTML,
  handleExportSVG,
  handlePrint
} = useProjectActions()

const items = computed(() => [
  {
    id: 'save-json',
    icon: '💾',
    label: 'Сохранить проект JSON',
    action: handleSaveProject
  },
  {
    id: 'load-json',
    icon: '📂',
    label: 'Загрузить проект JSON',
    action: handleLoadProject
  },
  {
    id: 'export-html',
    icon: '📄',
    label: 'Экспорт в HTML',
    action: handleExportHTML
  },
  {
    id: 'export-svg',
    icon: '🖋️',
    label: 'Экспорт в SVG',
    action: handleExportSVG
  },
  {
    id: 'print',
    icon: '🖨️',
    label: 'Печать',
    action: handlePrint
  }
])

const handleItemClick = async (item) => {
  if (typeof item.action === 'function') {
    try {
      const result = item.action()
      if (result instanceof Promise) {
        await result
      }
    } finally {
      emit('request-close')
    }
  } else {
    emit('request-close')
  }
}
</script>

<template>
  <div
    class="project-menu"
    :class="{ 'project-menu--modern': props.isModernTheme }"
    role="menu"
  >
    <button
      v-for="item in items"
      :key="item.id"
      type="button"
      class="project-menu__item"
      role="menuitem"
      @click="handleItemClick(item)"
    >
      <span class="project-menu__icon" aria-hidden="true">{{ item.icon }}</span>
      <span class="project-menu__label">{{ item.label }}</span>
    </button>
  </div>
</template>

<style scoped>
.project-menu {
  display: flex;
  flex-direction: column;
  padding: 12px;
  gap: 8px;
}

.project-menu__item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-radius: 12px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(255, 255, 255, 0.95);
  color: #0f172a;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
}

.project-menu__item:hover {
  transform: translateX(2px);
  background: rgba(59, 130, 246, 0.12);
  color: #1d4ed8;
  box-shadow: 0 10px 24px rgba(37, 99, 235, 0.15);
}

.project-menu__item:active {
  transform: translateX(1px);
  background: rgba(37, 99, 235, 0.16);
  color: #1e3a8a;
}
.project-menu--modern .project-menu__item {  
  border-color: rgba(96, 164, 255, 0.32);
  background: rgba(24, 34, 58, 0.92);
  color: #e5f3ff;
  box-shadow: 0 16px 32px rgba(6, 11, 21, 0.55);
}

.project-menu--modern .project-menu__item:hover {
  background: rgba(96, 164, 255, 0.28);
  color: #0b1324;
  box-shadow: 0 22px 40px rgba(6, 11, 21, 0.65);
}

.project-menu--modern .project-menu__item:active {
  background: rgba(114, 182, 255, 0.35);
  color: #051125;
}

.project-menu__icon {
  font-size: 22px;
  width: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.project-menu__label {
  flex: 1;
  text-align: left;
  white-space: nowrap;
}
</style>
