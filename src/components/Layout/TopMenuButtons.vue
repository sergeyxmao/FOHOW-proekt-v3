<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import DiscussionMenu from './DiscussionMenu.vue'
import ToolsMenu from './ToolsMenu.vue'
import ViewMenu from './ViewMenu.vue'
import ProjectMenu from './ProjectMenu.vue'
import { useHistoryStore } from '../../stores/history.js'

const props = defineProps({
  isModernTheme: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['activate-pencil', 'toggle-theme'])

const historyStore = useHistoryStore()
const { canUndo, canRedo } = storeToRefs(historyStore)
  
const menuItems = [
  { id: 'project', label: 'Проект' },
  { id: 'tools', label: 'Инструменты' },
  { id: 'view', label: 'Вид' },
  { id: 'discussion', label: 'Обсуждения' }
]

const openMenuId = ref(null)
const menuWrapperRef = ref(null)
const menuComponents = {
  project: ProjectMenu,
  discussion: DiscussionMenu,
  tools: ToolsMenu,
  view: ViewMenu
}
const themeTitle = computed(() =>
  props.isModernTheme ? 'Вернуть светлое меню' : 'Включить тёмное меню'
)
function getMenuComponent(id) {
  return menuComponents[id] || null
}

function toggleMenu(id) {
  openMenuId.value = openMenuId.value === id ? null : id
}

function closeMenu() {
  openMenuId.value = null
}
function handleActivatePencil() {
  emit('activate-pencil')
  closeMenu()
}
function handleToggleTheme() {
  emit('toggle-theme')
  closeMenu()
}

function handleUndo() {
  if (!canUndo.value) return
  historyStore.undo()
}

function handleRedo() {
  if (!canRedo.value) return
  historyStore.redo()
}

function handleClickOutside(event) {
  if (!menuWrapperRef.value) return
  if (!menuWrapperRef.value.contains(event.target)) {
    closeMenu()
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div
    ref="menuWrapperRef"
    class="top-menu"
    :class="{ 'top-menu--modern': props.isModernTheme }"
    role="menubar"
  >
    <div class="top-menu__controls">
      <button
        class="top-menu__theme-button"
        type="button"
        :title="themeTitle"
        @click.stop="handleToggleTheme"
      >
        <span class="top-menu__theme-icon" aria-hidden="true"></span>
        <span class="visually-hidden">{{ themeTitle }}</span>
      </button>
      <button
        class="top-menu__action-button"
        type="button"
        title="Отменить (Ctrl+Z)"
        :disabled="!canUndo"
        @click.stop="handleUndo"
      >
        ↶
      </button>
      <button
        class="top-menu__action-button"
        type="button"
        title="Повторить (Ctrl+Shift+Z)"
        :disabled="!canRedo"
        @click.stop="handleRedo"
      >
        ↷
      </button>
    </div>
    <div v-for="item in menuItems" :key="item.id" class="top-menu__item">
      <button
        type="button"
        class="top-menu__button"
        :class="{ 'top-menu__button--active': openMenuId === item.id }"
        :aria-expanded="openMenuId === item.id"
        @click.stop="toggleMenu(item.id)"
      >
        {{ item.label }}
      </button>
      <transition name="top-menu-fade">
        <div
          v-if="openMenuId === item.id"
          class="top-menu__dropdown"
          role="menu"
          aria-hidden="false"
        >
          <component
            :is="getMenuComponent(item.id)"
            v-if="getMenuComponent(item.id)"
            :is-modern-theme="props.isModernTheme"            
            @request-close="closeMenu"
            @activate-pencil="handleActivatePencil"
          />
        </div>
      </transition>
    </div>
  </div>
</template>

<style scoped>
.top-menu {
  position: fixed;
  top: 16px;
  left: 24px;
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  flex-wrap: wrap;
  gap: 12px;
  z-index: 1950;
  max-width: calc(100% - 48px);
}

.top-menu__controls {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.top-menu__item {
  position: relative;
}
.top-menu__theme-button {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 1px solid rgba(15, 23, 42, 0.12);
  background: linear-gradient(145deg, rgba(59, 130, 246, 0.18), rgba(59, 130, 246, 0));
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 14px 28px rgba(15, 23, 42, 0.2);
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease, background 0.2s ease;
  backdrop-filter: blur(6px);
}

.top-menu__theme-button:hover,
.top-menu__theme-button:focus-visible {
  transform: translateY(-2px);
  box-shadow: 0 20px 36px rgba(15, 23, 42, 0.24);
  border-color: rgba(59, 130, 246, 0.45);
  background: linear-gradient(145deg, rgba(59, 130, 246, 0.28), rgba(59, 130, 246, 0.08));
}

.top-menu__theme-icon {
  position: relative;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: linear-gradient(135deg, #0f172a 0%, #2563eb 100%);
  box-shadow: inset -4px -4px 10px rgba(255, 255, 255, 0.22), 0 6px 12px rgba(15, 23, 42, 0.18);
}

.top-menu__theme-icon::before,
.top-menu__theme-icon::after {
  content: '';
  position: absolute;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.85);
  transition: opacity 0.2s ease;
}

.top-menu__theme-icon::before {
  inset: 4px;
  opacity: 0.4;
}

.top-menu__theme-icon::after {
  inset: 7px;
  opacity: 0.2;
}

.top-menu__action-button {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  border: 1px solid rgba(15, 23, 42, 0.12);
  background: rgba(255, 255, 255, 0.92);
  color: #1d4ed8;
  font-size: 20px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 14px 28px rgba(15, 23, 42, 0.2);
  transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease, border-color 0.2s ease;
  backdrop-filter: blur(6px);
}

.top-menu__action-button:hover:enabled {
  transform: translateY(-2px);
  box-shadow: 0 20px 36px rgba(15, 23, 42, 0.24);
  background: rgba(255, 255, 255, 1);
  border-color: rgba(59, 130, 246, 0.45);
}

.top-menu__action-button:disabled {
  opacity: 0.5;
  cursor: default;
  box-shadow: 0 10px 20px rgba(15, 23, 42, 0.12);
}

.top-menu--modern .top-menu__action-button {
  border-color: rgba(96, 164, 255, 0.32);
  background: rgba(28, 38, 62, 0.88);
  color: #bcdcff;
  box-shadow: 0 18px 34px rgba(6, 11, 21, 0.55);
}

.top-menu--modern .top-menu__action-button:hover:enabled {
  background: rgba(48, 68, 102, 0.92);
  box-shadow: 0 24px 42px rgba(6, 11, 21, 0.65);
  border-color: rgba(114, 182, 255, 0.55);
}

.top-menu--modern .top-menu__theme-button {
  border-color: rgba(96, 164, 255, 0.42);
  background: linear-gradient(145deg, rgba(114, 182, 255, 0.32), rgba(114, 182, 255, 0));
  box-shadow: 0 18px 34px rgba(6, 11, 21, 0.55);
}

.top-menu--modern .top-menu__theme-button:hover,
.top-menu--modern .top-menu__theme-button:focus-visible {
  box-shadow: 0 24px 42px rgba(6, 11, 21, 0.65);
  border-color: rgba(114, 182, 255, 0.55);
  background: linear-gradient(145deg, rgba(114, 182, 255, 0.48), rgba(114, 182, 255, 0.16));
}

.top-menu--modern .top-menu__theme-icon {
  background: linear-gradient(135deg, #e5f3ff 0%, #73c8ff 100%);
  box-shadow: inset -4px -4px 10px rgba(6, 11, 21, 0.35), 0 6px 12px rgba(6, 11, 21, 0.3);}

.top-menu__button {
  padding: 10px 18px;
  border-radius: 18px;
  border: 1px solid rgba(15, 23, 42, 0.12);
  background: rgba(255, 255, 255, 0.88);
  color: #0f172a;
  font-size: 14px;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08);
  transition: background 0.2s ease, color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
  backdrop-filter: blur(4px);
}

.top-menu__button:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.12);
}

.top-menu__button--active {
  background: linear-gradient(120deg, #3b82f6 0%, #2563eb 100%);
  color: #ffffff;
  box-shadow: 0 10px 24px rgba(37, 99, 235, 0.35);
}
.top-menu--modern .top-menu__button {
  border-color: rgba(96, 164, 255, 0.32);
  background: rgba(28, 38, 62, 0.88);
  color: #e5f3ff;
  box-shadow: 0 12px 28px rgba(6, 11, 21, 0.45);
}

.top-menu--modern .top-menu__button:hover {
  background: rgba(48, 68, 102, 0.92);
  box-shadow: 0 18px 34px rgba(6, 11, 21, 0.55);
}

.top-menu--modern .top-menu__button--active {
  background: linear-gradient(120deg, #73c8ff 0%, #2563eb 100%);
  color: #0b1324;
  box-shadow: 0 16px 36px rgba(16, 68, 140, 0.5);
}
.top-menu__dropdown {
  position: absolute;
  top: calc(100% + 10px);
  left: 0;
  min-width: 220px;
  min-height: 120px;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 16px;
  box-shadow: 0 18px 32px rgba(15, 23, 42, 0.16);
  border: 1px solid rgba(15, 23, 42, 0.08);
  backdrop-filter: blur(6px);
}
.top-menu--modern .top-menu__dropdown {
  background: rgba(20, 30, 52, 0.96);
  border-color: rgba(96, 164, 255, 0.35);
  box-shadow: 0 22px 38px rgba(6, 11, 21, 0.6);
}
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.top-menu-fade-enter-active,
.top-menu-fade-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.top-menu-fade-enter-from,
.top-menu-fade-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
