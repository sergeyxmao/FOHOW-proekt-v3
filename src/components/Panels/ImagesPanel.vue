<script setup>
import { ref, computed } from 'vue'
import { useSidePanelsStore } from '../../stores/sidePanels.js'
import { useStickersStore } from '../../stores/stickers.js'
import { useSubscriptionStore } from '../../stores/subscription.js'
import MyLibraryTab from '../Images/MyLibraryTab.vue'
import SharedLibraryTab from '../Images/SharedLibraryTab.vue'

const props = defineProps({
  isModernTheme: {
    type: Boolean,
    default: false
  }
})

const sidePanelsStore = useSidePanelsStore()
const stickersStore = useStickersStore()
const subscriptionStore = useSubscriptionStore()

// Активная вкладка: 'my' | 'shared'
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
      'images-panel--no-pointer': stickersStore.isPlacementMode
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

    <!-- Вкладки второго уровня -->
    <div v-else class="images-panel__tabs">
      <button
        type="button"
        class="images-panel__tab"
        :class="{ 'images-panel__tab--active': activeTab === 'my' }"
        @click="setActiveTab('my')"
      >
        Моя библиотека
      </button>
      <button
        type="button"
        class="images-panel__tab"
        :class="{ 'images-panel__tab--active': activeTab === 'shared' }"
        @click="setActiveTab('shared')"
      >
        Общая
      </button>
    </div>

    <div v-if="canUseImages" class="images-panel__content">
      <!-- Содержимое "Моя библиотека" -->
      <div v-if="activeTab === 'my'" class="images-panel__tab-content images-panel__tab-content--full">
        <MyLibraryTab ref="myLibraryRef" />
      </div>

      <!-- Содержимое "Общая" -->
      <div v-if="activeTab === 'shared'" class="images-panel__tab-content images-panel__tab-content--full">
        <SharedLibraryTab ref="sharedLibraryRef" />
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
  padding: 10px 16px;
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
</style>
