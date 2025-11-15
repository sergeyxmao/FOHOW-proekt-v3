<script setup>
import { defineProps, defineEmits } from 'vue'

const props = defineProps({
  node: {
    type: Object,
    required: true
  },
  depth: {
    type: Number,
    default: 0
  }
})

const emit = defineEmits(['toggle', 'select'])

const handleToggle = () => {
  if (props.node.type === 'folder') {
    emit('toggle', props.node)
  }
}

const handleSelect = () => {
  if (props.node.type === 'file') {
    emit('select', props.node)
  }
}

const getPaddingLeft = () => {
  return `${props.depth * 20}px`
}
</script>

<template>
  <div class="file-tree-node">
    <!-- Сам узел -->
    <div
      class="file-tree-node__item"
      :class="{
        'file-tree-node__item--folder': node.type === 'folder',
        'file-tree-node__item--file': node.type === 'file'
      }"
      :style="{ paddingLeft: getPaddingLeft() }"
      @click="node.type === 'folder' ? handleToggle() : handleSelect()"
    >
      <!-- Иконка -->
      <span class="file-tree-node__icon">
        <template v-if="node.type === 'folder'">
          <svg v-if="node.isExpanded" width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 4C2 2.89543 2.89543 2 4 2H6.17157C6.70201 2 7.21071 2.21071 7.58579 2.58579L8.41421 3.41421C8.78929 3.78929 9.29799 4 9.82843 4H12C13.1046 4 14 4.89543 14 6V12C14 13.1046 13.1046 14 12 14H4C2.89543 14 2 13.1046 2 12V4Z" fill="#FCD34D" stroke="#F59E0B" stroke-width="1.5"/>
          </svg>
          <svg v-else width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 4C2 2.89543 2.89543 2 4 2H6.17157C6.70201 2 7.21071 2.21071 7.58579 2.58579L8.41421 3.41421C8.78929 3.78929 9.29799 4 9.82843 4H12C13.1046 4 14 4.89543 14 6V12C14 13.1046 13.1046 14 12 14H4C2.89543 14 2 13.1046 2 12V4Z" fill="#FDE68A" stroke="#F59E0B" stroke-width="1.5"/>
          </svg>
        </template>
        <template v-else>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="2" y="2" width="12" height="12" rx="2" fill="#DBEAFE" stroke="#3B82F6" stroke-width="1.5"/>
            <circle cx="6" cy="6" r="1.5" fill="#3B82F6"/>
            <path d="M2 11L5 8L7 10L11 6L14 9V12C14 13.1046 13.1046 14 12 14H4C2.89543 14 2 13.1046 2 12V11Z" fill="#93C5FD"/>
          </svg>
        </template>
      </span>

      <!-- Название -->
      <span class="file-tree-node__name">{{ node.name }}</span>

      <!-- Количество элементов в папке -->
      <span v-if="node.type === 'folder'" class="file-tree-node__count">({{ node.children?.length || 0 }})</span>

      <!-- Индикатор раскрытия для папок -->
      <span v-if="node.type === 'folder'" class="file-tree-node__expand">
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="currentColor"
          :class="{ 'file-tree-node__expand--open': node.isExpanded }"
        >
          <path d="M4 5L6 7L8 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        </svg>
      </span>
    </div>

    <!-- Вложенные элементы (рекурсия) -->
    <div v-if="node.type === 'folder' && node.isExpanded && node.children" class="file-tree-node__children">
      <FileTreeNode
        v-for="child in node.children"
        :key="child.path"
        :node="child"
        :depth="depth + 1"
        @toggle="emit('toggle', $event)"
        @select="emit('select', $event)"
      />
    </div>
  </div>
</template>

<style scoped>
.file-tree-node {
  user-select: none;
}

.file-tree-node__item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  cursor: pointer;
  border-radius: 6px;
  transition: background 0.15s ease;
  position: relative;
}

.file-tree-node__item:hover {
  background: rgba(59, 130, 246, 0.08);
}

.file-tree-node__item--file:hover {
  background: rgba(59, 130, 246, 0.12);
}

.file-tree-node__icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
}

.file-tree-node__name {
  flex: 1;
  font-size: 14px;
  color: #1f2937;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-tree-node__item--file .file-tree-node__name {
  font-weight: 500;
}

.file-tree-node__count {
  flex-shrink: 0;
  font-size: 12px;
  color: #9ca3af;
  margin-left: 4px;
}

.file-tree-node__expand {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 12px;
  height: 12px;
  color: #6b7280;
  transition: transform 0.2s ease;
}

.file-tree-node__expand--open {
  transform: rotate(0deg);
}

.file-tree-node__children {
  /* Анимация появления дочерних элементов */
  animation: expandChildren 0.2s ease;
}

@keyframes expandChildren {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Темная тема (для modern режима ImageBrowserPanel) */
:global(.image-browser-panel--modern) .file-tree-node__item {
  color: #e5f3ff;
}

:global(.image-browser-panel--modern) .file-tree-node__item:hover {
  background: rgba(96, 164, 255, 0.12);
}

:global(.image-browser-panel--modern) .file-tree-node__item--file:hover {
  background: rgba(96, 164, 255, 0.18);
}

:global(.image-browser-panel--modern) .file-tree-node__name {
  color: #e5f3ff;
}

:global(.image-browser-panel--modern) .file-tree-node__expand {
  color: #94a3b8;
}

:global(.image-browser-panel--modern) .file-tree-node__count {
  color: #94a3b8;
}
</style>
