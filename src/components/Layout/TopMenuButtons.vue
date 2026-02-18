<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import DiscussionMenu from './DiscussionMenu.vue'
import ViewMenu from './ViewMenu.vue'
import ProjectMenu from './ProjectMenu.vue'
import { useHistoryStore } from '../../stores/history.js'

const props = defineProps({
  isModernTheme: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['activate-pencil', 'toggle-theme', 'clear-canvas', 'new-structure'])

const { t, locale } = useI18n()
const historyStore = useHistoryStore()
const { canUndo, canRedo } = storeToRefs(historyStore)

const menuItems = computed(() => [
  { id: 'project', label: t('topMenu.project') },
  { id: 'view', label: t('topMenu.view') },
  { id: 'elements', label: t('topMenu.elements') }
])

const openMenuId = ref(null)
const showLangDropdown = ref(false)
const menuWrapperRef = ref(null)
const menuComponents = {
  project: ProjectMenu,
  elements: DiscussionMenu,
  view: ViewMenu
}

const availableLocales = [
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'zh', name: '中文', flag: '🇨🇳' }
]

function getMenuComponent(id) {
  return menuComponents[id] || null
}

function toggleMenu(id) {
  showLangDropdown.value = false
  openMenuId.value = openMenuId.value === id ? null : id
}

function closeMenu() {
  openMenuId.value = null
}

function toggleLangDropdown() {
  openMenuId.value = null
  showLangDropdown.value = !showLangDropdown.value
}

function changeLocale(newLocale) {
  locale.value = newLocale
  localStorage.setItem('locale', newLocale)
  showLangDropdown.value = false
}

function handleActivatePencil() {
  emit('activate-pencil')
  closeMenu()
}
function handleToggleTheme() {
  emit('toggle-theme')
  closeMenu()
}
function handleClearCanvas() {
  emit('clear-canvas')
  closeMenu()
}
function handleNewStructure(shouldSave) {
  emit('new-structure', shouldSave)
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
    showLangDropdown.value = false
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
    <button
      class="top-menu__action-button"
      type="button"
      :title="t('topMenu.undo')"
      :disabled="!canUndo"
      @click.stop="handleUndo"
    >
      ↶
    </button>
    <button
      class="top-menu__action-button"
      type="button"
      :title="t('topMenu.redo')"
      :disabled="!canRedo"
      @click.stop="handleRedo"
    >
      ↷
    </button>

    <!-- Кнопка языка -->
    <div class="top-menu__item">
      <button
        type="button"
        class="top-menu__action-button top-menu__lang-button"
        :title="t('topMenu.language')"
        @click.stop="toggleLangDropdown"
      >
        🌐
      </button>
      <transition name="top-menu-fade">
        <div v-if="showLangDropdown" class="top-menu__dropdown top-menu__dropdown--lang">
          <button
            v-for="lang in availableLocales"
            :key="lang.code"
            type="button"
            class="lang-option"
            :class="{ 'lang-option--active': locale === lang.code }"
            @click="changeLocale(lang.code)"
          >
            <span>{{ lang.flag }}</span>
            <span>{{ lang.name }}</span>
          </button>
        </div>
      </transition>
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
            @toggle-theme="handleToggleTheme"
            @clear-canvas="handleClearCanvas"
            @new-structure="handleNewStructure"
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
  align-items: center;
  justify-content: flex-start;
  flex-wrap: wrap;
  gap: 12px;
  z-index: 1950;
  max-width: calc(100% - 48px);
}

.top-menu__item {
  position: relative;
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
  box-shadow: 0 20px 36px rgba(255, 193, 7, 0.35);
  background: #ffc107;
  color: #000000;
  border-color: rgba(255, 193, 7, 0.8);
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
  background: #ffc107;
  color: #000000;
  box-shadow: 0 24px 42px rgba(255, 193, 7, 0.45);
  border-color: rgba(255, 193, 7, 0.85);
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
  background: #ffc107;
  color: #000000;
  border-color: rgba(255, 193, 7, 0.8);
  box-shadow: 0 12px 24px rgba(255, 193, 7, 0.35);
}

.top-menu__button--active {
  background: #ffc107;
  color: #000000;
  border-color: rgba(255, 193, 7, 0.8);
  box-shadow: 0 10px 24px rgba(255, 193, 7, 0.35);
}
.top-menu--modern .top-menu__button {
  border-color: rgba(96, 164, 255, 0.32);
  background: rgba(28, 38, 62, 0.88);
  color: #e5f3ff;
  box-shadow: 0 12px 28px rgba(6, 11, 21, 0.45);
}

.top-menu--modern .top-menu__button:hover {
  background: #ffc107;
  color: #000000;
  border-color: rgba(255, 193, 7, 0.85);
  box-shadow: 0 18px 34px rgba(255, 193, 7, 0.45);
}

.top-menu--modern .top-menu__button--active {
  background: #ffc107;
  color: #000000;
  border-color: rgba(255, 193, 7, 0.85);
  box-shadow: 0 16px 36px rgba(255, 193, 7, 0.45);
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
  z-index: 5;
}
.top-menu--modern .top-menu__dropdown {
  background: rgba(20, 30, 52, 0.96);
  border-color: rgba(96, 164, 255, 0.35);
  box-shadow: 0 22px 38px rgba(6, 11, 21, 0.6);
}

/* Language dropdown */
.top-menu__dropdown--lang {
  min-width: 150px;
  min-height: auto;
  padding: 8px;
}

.top-menu__lang-button {
  border-radius: 50%;
  font-size: 20px;
}

.lang-option {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 14px;
  border: none;
  border-radius: 10px;
  background: transparent;
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
  cursor: pointer;
  transition: background 0.15s ease;
}

.lang-option:hover {
  background: rgba(255, 193, 7, 0.15);
}

.lang-option--active {
  background: #ffc107;
  color: #000000;
}

.top-menu--modern .lang-option {
  color: #e5f3ff;
}

.top-menu--modern .lang-option:hover {
  background: rgba(255, 193, 7, 0.15);
}

.top-menu--modern .lang-option--active {
  background: #ffc107;
  color: #000000;
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
