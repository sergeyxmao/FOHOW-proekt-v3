<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import DiscussionMenu from './DiscussionMenu.vue'

const menuItems = [
  { id: 'project', label: 'Проект' },
  { id: 'tools', label: 'Инструменты' },
  { id: 'view', label: 'Вид' },
  { id: 'discussion', label: 'Обсуждения' }
]

const openMenuId = ref(null)
const menuWrapperRef = ref(null)
const menuComponents = {
  discussion: DiscussionMenu
}

function getMenuComponent(id) {
  return menuComponents[id] || null
}

function toggleMenu(id) {
  openMenuId.value = openMenuId.value === id ? null : id
}

function closeMenu() {
  openMenuId.value = null
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
  <div ref="menuWrapperRef" class="top-menu" role="menubar">
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
            @request-close="closeMenu"
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
  left: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  z-index: 1950;
}

.top-menu__item {
  position: relative;
}

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
