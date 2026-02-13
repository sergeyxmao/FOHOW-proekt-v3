<script setup>
import { ref, computed, inject } from 'vue'
import { useSidePanelsStore } from '../../stores/sidePanels.js'
import { useStickersStore } from '../../stores/stickers.js'
import { useSubscriptionStore } from '../../stores/subscription.js'
import MyLibraryTab from '../Images/MyLibraryTab.vue'
import SharedLibraryTab from '../Images/SharedLibraryTab.vue'
import FavoritesTab from '../Images/FavoritesTab.vue'
import BoardImagesTab from '../Images/BoardImagesTab.vue'

const props = defineProps({
  isModernTheme: {
    type: Boolean,
    default: false
  },
  placementTarget: {
    type: String,
    default: 'board'
  }
})

const sidePanelsStore = useSidePanelsStore()
const stickersStore = useStickersStore()
const subscriptionStore = useSubscriptionStore()

// Получаем состояние режима рисования из родительского компонента
const isPencilMode = inject('isPencilMode', ref(false))

// Активная вкладка: 'my' | 'shared' | 'favorites' | 'board'
const activeTab = ref('my')

// Проверка доступа к библиотеке изображений
const canUseImages = computed(() => subscriptionStore.checkFeature('can_use_images'))
const myLibraryRef = ref(null)
const sharedLibraryRef = ref(null)

const handleClose = () => {
  myLibraryRef.value?.resetState?.()
  sharedLibraryRef.value?.resetState?.()
  sidePanelsStore.closePanel()
}

const setActiveTab = (tab) => {
  activeTab.value = tab
}
</script>

<template>
  <div
    class="images-panel"
    :class="{
      'images-panel--modern': props.isModernTheme,
      'images-panel--no-pointer': stickersStore.isPlacementMode,
      'images-panel--above-pencil': isPencilMode
    }"
  >
    <div class="images-panel__header">
      <h2 class="images-panel__title">Изображения</h2>
      <button
        type="button"
        class="images-panel__close"
        title="Закрыть"
        @click="handleClose"
      >
        ×
      </button>
    </div>

    <!-- Сообщение об ограничении доступа -->
    <div v-if="!canUseImages" class="images-panel__access-denied">
      <div class="images-panel__access-denied-icon">
        🔒
      </div>
      <p class="images-panel__access-denied-title">
        Библиотека изображений недоступна на текущем тарифе
      </p>
      <p class="images-panel__access-denied-hint">
        Обновите тариф для получения доступа к библиотеке изображений.
      </p>
    </div>

    <!-- Вкладки: Личные | Общая | ♥ | 🖼 -->
    <div v-else class="images-panel__tabs">
      <button
        type="button"
        class="images-panel__tab"
        :class="{ 'images-panel__tab--active': activeTab === 'my' }"
        @click="setActiveTab('my')"
      >
        Личные
      </button>
      <button
        type="button"
        class="images-panel__tab"
        :class="{ 'images-panel__tab--active': activeTab === 'shared' }"
        @click="setActiveTab('shared')"
      >
        Общая
      </button>
      <button
        type="button"
        class="images-panel__tab images-panel__tab--icon"
        :class="{ 'images-panel__tab--active': activeTab === 'favorites' }"
        title="Избранное"
        @click="setActiveTab('favorites')"
      >
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="images-panel__tab-icon">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="currentColor"/>
        </svg>
      </button>
      <button
        type="button"
        class="images-panel__tab images-panel__tab--icon"
        :class="{ 'images-panel__tab--active': activeTab === 'board' }"
        title="На доске"
        @click="setActiveTab('board')"
      >
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="images-panel__tab-icon">
          <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" fill="currentColor"/>
        </svg>
      </button>
    </div>

    <div v-if="canUseImages" class="images-panel__content">
      <!-- Содержимое "Личные" -->
      <div v-if="activeTab === 'my'" class="images-panel__tab-content images-panel__tab-content--full">
        <MyLibraryTab
          ref="myLibraryRef"
          :placement-target="props.placementTarget"
        />
      </div>

      <!-- Содержимое "Общая" -->
      <div v-if="activeTab === 'shared'" class="images-panel__tab-content images-panel__tab-content--full">
        <SharedLibraryTab
          ref="sharedLibraryRef"
          :placement-target="props.placementTarget"
        />
      </div>

      <!-- Содержимое "Избранное" -->
      <div v-if="activeTab === 'favorites'" class="images-panel__tab-content images-panel__tab-content--full">
        <FavoritesTab
          :placement-target="props.placementTarget"
        />
      </div>

      <!-- Содержимое "На доске" -->
      <div v-if="activeTab === 'board'" class="images-panel__tab-content images-panel__tab-content--full">
        <BoardImagesTab />
      </div>
    </div>
  </div>
</template>

<style scoped>
.images-panel {
  position: fixed;
  left: 0;
  top: 0;
  bottom: 0;
  width: 380px;
  background: rgba(255, 255, 255, 0.98);
  border-right: 1px solid rgba(15, 23, 42, 0.12);
  box-shadow: 4px 0 24px rgba(15, 23, 42, 0.18);
  z-index: 2000;
  display: flex;
  flex-direction: column;
  transition: transform 0.3s ease;
}

.images-panel--no-pointer {
  pointer-events: none;
  opacity: 0.3;
  backdrop-filter: blur(8px);
}

/* Header */
.images-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px 24px 16px;
  border-bottom: 1px solid rgba(15, 23, 42, 0.08);
}

.images-panel__title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #0f172a;
  letter-spacing: -0.01em;
}

.images-panel__close {
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  background: transparent;
  color: #64748b;
  font-size: 28px;
  line-height: 1;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.images-panel__close:hover {
  background: rgba(15, 23, 42, 0.06);
  color: #0f172a;
}

.images-panel__close:active {
  background: rgba(15, 23, 42, 0.12);
}

/* Tabs */
.images-panel__tabs {
  display: flex;
  gap: 4px;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(248, 250, 252, 0.6);
}

.images-panel__tab {
  flex: 1;
  padding: 10px 12px;
  border: none;
  background: transparent;
  color: #64748b;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.images-panel__tab--icon {
  flex: 0 0 auto;
  width: 40px;
  padding: 10px 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.images-panel__tab-icon {
  width: 18px;
  height: 18px;
}

.images-panel__tab:hover {
  background: rgba(15, 23, 42, 0.06);
  color: #475569;
}

.images-panel__tab--active {
  background: #ffffff;
  color: #0f172a;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
}

/* Content */
.images-panel__content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}

.images-panel__tab-content {
  padding: 24px;
}

.images-panel__tab-content--full {
  padding: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
}

/* Empty state */
.images-panel__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
}

.images-panel__empty-text {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 600;
  color: #0f172a;
}

.images-panel__empty-hint {
  margin: 0;
  font-size: 14px;
  color: #64748b;
  line-height: 1.5;
}

/* Access Denied State */
.images-panel__access-denied {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
}

.images-panel__access-denied-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.images-panel__access-denied-title {
  margin: 0 0 12px;
  font-size: 18px;
  font-weight: 600;
  color: #0f172a;
  line-height: 1.4;
}

.images-panel__access-denied-hint {
  margin: 0;
  font-size: 14px;
  color: #64748b;
  line-height: 1.5;
}

/* Modern theme */
.images-panel--modern {
  background: rgba(248, 250, 252, 0.98);
}

.images-panel--modern .images-panel__header {
  border-bottom-color: rgba(15, 23, 42, 0.06);
}

.images-panel--modern .images-panel__tabs {
  background: rgba(255, 255, 255, 0.8);
  border-bottom-color: rgba(15, 23, 42, 0.06);
}

/* Scrollbar */
.images-panel__content::-webkit-scrollbar {
  width: 8px;
}

.images-panel__content::-webkit-scrollbar-track {
  background: transparent;
}

.images-panel__content::-webkit-scrollbar-thumb {
  background: rgba(15, 23, 42, 0.2);
  border-radius: 4px;
}

.images-panel__content::-webkit-scrollbar-thumb:hover {
  background: rgba(15, 23, 42, 0.3);
}

/* Повышенный z-index для отображения поверх режима рисования */
.images-panel--above-pencil {
  z-index: 4100;
}
</style>
