<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { useSidePanelsStore } from '../../stores/sidePanels.js'
import { useBoardStore } from '../../stores/board.js'
import { useAuthStore } from '../../stores/auth.js'

const props = defineProps({
  isModernTheme: {
    type: Boolean,
    default: false
  }
})

const sidePanelsStore = useSidePanelsStore()
const boardStore = useBoardStore()
const authStore = useAuthStore()

const API_URL = import.meta.env.VITE_API_URL || '/api'

const partners = ref([])
const searchQuery = ref('')
const loading = ref(false)
let searchTimeout = null

const handleClose = () => {
  sidePanelsStore.closePanel()
}

// Получить URL аватара
const getAvatarUrl = (avatarUrl) => {
  if (!avatarUrl || avatarUrl === '/Avatar.png') {
    return '/Avatar.png'
  }
  // Если URL относительный, возвращаем как есть
  if (avatarUrl.startsWith('/')) {
    return avatarUrl
  }
  return avatarUrl
}

// Загрузка партнёров
const loadPartners = async () => {
  const boardId = boardStore.currentBoardId
  if (!boardId) {
    console.warn('Нет активной доски')
    return
  }

  loading.value = true

  try {
    const token = authStore.token
    if (!token) {
      throw new Error('Не авторизован')
    }

    let url = `${API_URL}/boards/${boardId}/partners`
    if (searchQuery.value.trim()) {
      url += `?search=${encodeURIComponent(searchQuery.value.trim())}`
    }

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    if (!response.ok) {
      throw new Error('Ошибка загрузки партнёров')
    }

    const data = await response.json()
    partners.value = data.partners || []
  } catch (error) {
    console.error('Ошибка загрузки партнёров:', error)
    partners.value = []
  } finally {
    loading.value = false
  }
}

// Обработка поиска с debounce
const handleSearch = () => {
  if (searchTimeout) {
    clearTimeout(searchTimeout)
  }
  searchTimeout = setTimeout(() => {
    loadPartners()
  }, 300) // 300ms debounce
}

// При монтировании загрузить партнёров
onMounted(() => {
  if (boardStore.currentBoardId) {
    loadPartners()
  }
})

// Следить за изменениями boardId
watch(() => boardStore.currentBoardId, (newBoardId) => {
  if (newBoardId) {
    loadPartners()
  }
})

// Проверка на пустое состояние
const isEmpty = computed(() => !loading.value && partners.value.length === 0)
</script>

<template>
  <div
    class="partners-panel"
    :class="{ 'partners-panel--modern': props.isModernTheme }"
  >
    <div class="partners-panel__header">
      <h2 class="partners-panel__title">Партнеры</h2>
      <button
        type="button"
        class="partners-panel__close"
        title="Закрыть"
        @click="handleClose"
      >
        ×
      </button>
    </div>

    <!-- Строка поиска -->
    <div class="panel-search">
      <input
        v-model="searchQuery"
        @input="handleSearch"
        type="text"
        placeholder="Поиск по имени, городу, номеру..."
        class="search-input"
        :class="{ 'search-input--modern': props.isModernTheme }"
      />
    </div>

    <div class="partners-panel__content">
      <!-- Загрузка -->
      <div v-if="loading" class="loading-state">
        <p>Загрузка партнёров...</p>
      </div>

      <!-- Пустое состояние -->
      <div v-else-if="isEmpty" class="empty-state">
        <p v-if="searchQuery">Партнёры не найдены</p>
        <p v-else>На этой доске нет добавленных партнёров</p>
      </div>

      <!-- Список партнёров -->
      <div v-else class="partners-list">
        <div
          v-for="partner in partners"
          :key="partner.id"
          class="partner-card"
          :class="{ 'partner-card--modern': props.isModernTheme }"
        >
          <img
            :src="getAvatarUrl(partner.avatar_url)"
            :alt="partner.full_name || partner.username"
            class="partner-avatar"
          />
          <div class="partner-info">
            <h4 class="partner-name">{{ partner.full_name || partner.username }}</h4>
            <p class="partner-id">{{ partner.personal_id }}</p>
            <div v-if="partner.city || partner.country" class="partner-location">
              <span v-if="partner.city">{{ partner.city }}</span>
              <span v-if="partner.city && partner.country">, </span>
              <span v-if="partner.country">{{ partner.country }}</span>
            </div>
            <div v-if="partner.office" class="partner-office">
              {{ partner.office }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.partners-panel {
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
  backdrop-filter: blur(8px);
}

.partners-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px 24px 16px;
  border-bottom: 1px solid rgba(15, 23, 42, 0.08);
}

.partners-panel__title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: #1f2937;
}

.partners-panel__close {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  border: 1px solid rgba(15, 23, 42, 0.12);
  background: rgba(248, 250, 252, 0.92);
  color: #0f172a;
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: background 0.2s ease, color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
}

.partners-panel__close:hover {
  background: rgba(239, 68, 68, 0.12);
  color: #dc2626;
  box-shadow: 0 8px 16px rgba(15, 23, 42, 0.12);
  transform: translateY(-1px);
}

.panel-search {
  padding: 12px 20px;
  border-bottom: 1px solid rgba(15, 23, 42, 0.08);
}

.search-input {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid #d0d0d0;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
  background: white;
  color: #1f2937;
}

.search-input:focus {
  border-color: #5D8BF4;
}

.partners-panel__content {
  flex: 1;
  overflow-y: auto;
  padding: 12px 20px;
}

.loading-state,
.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #999;
  font-size: 14px;
}

.partners-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.partner-card {
  display: flex;
  gap: 12px;
  padding: 12px;
  background: #f9f9f9;
  border-radius: 8px;
  transition: background 0.2s;
  cursor: pointer;
}

.partner-card:hover {
  background: #f0f0f0;
}

.partner-avatar {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.partner-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.partner-name {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #333;
}

.partner-id {
  margin: 0;
  font-size: 12px;
  color: #666;
  font-family: monospace;
}

.partner-location,
.partner-office {
  margin: 0;
  font-size: 13px;
  color: #777;
}

/* Modern Theme */
.partners-panel--modern {
  background: rgba(18, 28, 48, 0.96);
  border-right-color: rgba(96, 164, 255, 0.28);
  box-shadow: 4px 0 28px rgba(6, 11, 21, 0.65);
}

.partners-panel--modern .partners-panel__header {
  border-bottom-color: rgba(96, 164, 255, 0.22);
}

.partners-panel--modern .partners-panel__title {
  color: #e5f3ff;
}

.partners-panel--modern .partners-panel__close {
  border-color: rgba(96, 164, 255, 0.35);
  background: rgba(24, 34, 58, 0.92);
  color: #e5f3ff;
  box-shadow: 0 16px 30px rgba(6, 11, 21, 0.6);
}

.partners-panel--modern .partners-panel__close:hover {
  background: rgba(248, 113, 113, 0.22);
  color: #fca5a5;
  box-shadow: 0 20px 36px rgba(6, 11, 21, 0.7);
}

.partners-panel--modern .panel-search {
  border-bottom-color: rgba(96, 164, 255, 0.22);
}

.search-input--modern {
  background: rgba(24, 34, 58, 0.92);
  border-color: rgba(96, 164, 255, 0.35);
  color: #e5f3ff;
}

.search-input--modern::placeholder {
  color: rgba(229, 243, 255, 0.5);
}

.search-input--modern:focus {
  border-color: rgba(96, 164, 255, 0.6);
}

.partners-panel--modern .loading-state,
.partners-panel--modern .empty-state {
  color: rgba(229, 243, 255, 0.6);
}

.partner-card--modern {
  background: rgba(24, 34, 58, 0.92);
  border: 1px solid rgba(96, 164, 255, 0.25);
}

.partner-card--modern:hover {
  background: rgba(30, 41, 66, 0.95);
  border-color: rgba(96, 164, 255, 0.4);
}

.partner-card--modern .partner-name {
  color: #e5f3ff;
}

.partner-card--modern .partner-id {
  color: rgba(229, 243, 255, 0.7);
}

.partner-card--modern .partner-location,
.partner-card--modern .partner-office {
  color: rgba(229, 243, 255, 0.6);
}
</style>
