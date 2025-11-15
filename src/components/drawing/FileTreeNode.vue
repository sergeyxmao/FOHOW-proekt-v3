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
  <div class="tree-node">
    <!-- Папка -->
    <div
      v-if="node.type === 'folder'"
      class="folder-node"
      :style="{ paddingLeft: getPaddingLeft() }"
      @click="handleToggle"
    >
      <span class="icon">
        <svg v-if="node.isExpanded" width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M2 4C2 2.89543 2.89543 2 4 2H6.17157C6.70201 2 7.21071 2.21071 7.58579 2.58579L8.41421 3.41421C8.78929 3.78929 9.29799 4 9.82843 4H12C13.1046 4 14 4.89543 14 6V12C14 13.1046 13.1046 14 12 14H4C2.89543 14 2 13.1046 2 12V4Z" fill="#FCD34D" stroke="#F59E0B" stroke-width="1.5"/>
        </svg>
        <svg v-else width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M2 4C2 2.89543 2.89543 2 4 2H6.17157C6.70201 2 7.21071 2.21071 7.58579 2.58579L8.41421 3.41421C8.78929 3.78929 9.29799 4 9.82843 4H12C13.1046 4 14 4.89543 14 6V12C14 13.1046 13.1046 14 12 14H4C2.89543 14 2 13.1046 2 12V4Z" fill="#FDE68A" stroke="#F59E0B" stroke-width="1.5"/>
        </svg>
      </span>
      <span class="name">{{ node.name }}</span>
      <span class="count">({{ node.children?.length || 0 }})</span>
    </div>

    <!-- Файл -->
    <div
      v-else
      class="file-node"
      :style="{ paddingLeft: getPaddingLeft() }"
      @click="handleSelect"
    >
      <span class="icon">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect x="2" y="2" width="12" height="12" rx="2" fill="#DBEAFE" stroke="#3B82F6" stroke-width="1.5"/>
          <circle cx="6" cy="6" r="1.5" fill="#3B82F6"/>
          <path d="M2 11L5 8L7 10L11 6L14 9V12C14 13.1046 13.1046 14 12 14H4C2.89543 14 2 13.1046 2 12V11Z" fill="#93C5FD"/>
        </svg>
      </span>
      <span class="name">{{ node.name }}</span>
    </div>

    <!-- Вложенные элементы (рекурсия) -->
    <div v-if="node.type === 'folder' && node.isExpanded && node.children" class="children">
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
.tree-node {
  user-select: none;
}

.folder-node,
.file-node {
  display: flex;
  align-items: center;
  padding: 6px 8px;
  cursor: pointer;
  transition: background 0.2s;
  border-radius: 4px;
  margin: 2px 4px;
}

.folder-node:hover,
.file-node:hover {
  background: #f5f5f5;
}

.file-node:hover {
  background: #e3f2fd;
}

.icon {
  margin-right: 8px;
  font-size: 16px;
  display: inline-flex;
  align-items: center;
}

.name {
  flex: 1;
  font-size: 14px;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.count {
  font-size: 12px;
  color: #999;
  margin-left: 8px;
}

.children {
  /* отступ для вложенных элементов контролируется через :style в template */
}
</style>
