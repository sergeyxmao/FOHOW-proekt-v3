<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { useSidePanelsStore } from '../../stores/sidePanels.js'
import { useBoardStore } from '../../stores/board.js'
import { useAuthStore } from '../../stores/auth.js'
import { useCardsStore } from '../../stores/cards.js'

const props = defineProps({
  isModernTheme: {
    type: Boolean,
    default: false
  }
})

const sidePanelsStore = useSidePanelsStore()
const boardStore = useBoardStore()
const authStore = useAuthStore()
const cardsStore = useCardsStore()

const API_URL = import.meta.env.VITE_API_URL || '/api'
// Подготовка ссылок на VK/Telegram/Instagram
const normalizeHandle = (handle) => handle?.toString().trim().replace(/^@/, '') || ''

const buildVkLink = (profileUrl) => {
  if (!profileUrl) return ''

  const trimmed = profileUrl.trim()
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed
  }

  if (/^www\./i.test(trimmed)) {
    return `https://${trimmed}`
  }

  if (/^vk\.com/i.test(trimmed)) {
    return `https://${trimmed}`
  }

  const username = normalizeHandle(trimmed)
  return `https://vk.com/${username}`
}

// Телефонные утилиты
const normalizePhone = (phone) => phone?.toString().replace(/[^+\d]/g, '').trim() || ''

const isMobileDevice = () => /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)

const copyPhoneToClipboard = async (phone) => {
  try {
    await navigator.clipboard?.writeText(phone)
  } catch (err) {
    console.warn('Не удалось скопировать номер телефона', err)
  }
}

const handlePhoneClick = async (phone) => {
  const normalized = normalizePhone(phone)
  if (!normalized) return

  const telLink = `tel:${normalized}`
  window.location.href = telLink

  if (isMobileDevice()) {
    setTimeout(() => {
      copyPhoneToClipboard(phone)
    }, 120)
  }
}

const buildTelegramAppLink = (handle) => {
  const username = normalizeHandle(handle)
  return `tg://resolve?domain=${username}`
}

const buildTelegramWebLink = (handle) => {
  const username = normalizeHandle(handle)
  return `https://t.me/${username}`
}

const buildInstagramAppLink = (handle) => {
  const username = normalizeHandle(handle)
  return `instagram://user?username=${username}`
}

const buildInstagramWebLink = (handle) => {
  const username = normalizeHandle(handle)
  return `https://instagram.com/${username}`
}

const openTelegram = (handle) => {
  const username = handle || '@sergeyxmao'
  const appLink = buildTelegramAppLink(username)
  const webLink = buildTelegramWebLink(username)

  const appWindow = window.open(appLink, '_blank')
  setTimeout(() => {
    if (!appWindow || appWindow.closed) {
      window.open(webLink, '_blank')
    }
  }, 150)
}

const openInstagram = (handle) => {
  if (!handle) return

  const appLink = buildInstagramAppLink(handle)
  const webLink = buildInstagramWebLink(handle)

  const appWindow = window.open(appLink, '_blank')
  setTimeout(() => {
    if (!appWindow || appWindow.closed) {
      window.open(webLink, '_blank')
    }
  }, 150)
}

const partners = ref([])
const searchQuery = ref('')
const loading = ref(false)
const selectedPartner = ref(null)
let searchTimeout = null
const boardType = computed(() => {
  const hasLicenses = cardsStore.cards.some(card => ['large', 'gold'].includes(card.type))
  const hasUserCards = cardsStore.cards.some(card => card.type === 'user_card')

  if (hasLicenses) return 'licenses'
  if (hasUserCards) return 'avatars'
  return null
})

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
  if (!boardType.value) {
    partners.value = []
    return
  }

  loading.value = true

  try {
    const token = authStore.token
    if (!token) {
      throw new Error('Не авторизован')
    }

    let url = boardType.value === 'avatars'
      ? `${API_URL}/boards/${boardId}/avatar-partners`
      : `${API_URL}/boards/${boardId}/partners`
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

// Навигация к карточке партнёра на доске
const navigateToPartnerCard = (partner) => {
  if (boardType.value === 'avatars') {
    navigateToUserCardPartner(partner)
    return
  }  
  // Нормализация personal_id (убрать пробелы, верхний регистр)
  const normalizeId = (id) => id?.toString().replace(/\s+/g, '').toUpperCase()
  const targetPersonalId = normalizeId(partner.personal_id)

  // Найти карточку с этим personal_id
  const targetCard = cardsStore.cards.find(card => {
    if (card.type !== 'large' && card.type !== 'gold') return false
    return normalizeId(card.text) === targetPersonalId
  })

  if (!targetCard) {
    console.warn('Карточка для партнёра не найдена:', partner.personal_id)
    return
  }

  // Вычислить центр карточки
  const centerX = targetCard.x + (targetCard.width / 2)
  const centerY = targetCard.y + (targetCard.height / 2)

  // Центрировать камеру на карточке
  boardStore.centerViewOnPoint(centerX, centerY)

  // Подсветить карточку
  cardsStore.highlightCard(targetCard.id)
}
const navigateToUserCardPartner = (partner) => {
  const userCard = cardsStore.cards.find(card => card.id === partner.avatarObjectId)

  if (!userCard) {
    console.warn('Карточка партнёра не найдена на доске:', partner.avatarObjectId)
    return
  }

  const diameter = userCard.diameter || 418
  const centerX = userCard.x + diameter / 2
  const centerY = userCard.y + diameter / 2

  boardStore.centerViewOnPoint(centerX, centerY)
  cardsStore.highlightUserCard(userCard.id)
}

// Открытие модального окна с деталями (БЕЗ фокусировки на карточке)
const openPartnerDetails = (partner) => {
  if (selectedPartner.value?.id === partner.id) {
    // Повторный клик - закрываем модалку
    selectedPartner.value = null
  } else {
    // Открываем модалку
    selectedPartner.value = partner
  }
}

// Закрытие окна с деталями партнера
const closeDetails = () => {
  selectedPartner.value = null
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
watch(boardType, () => {
  if (boardStore.currentBoardId) {
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

    <!-- Модальное окно с данными партнера -->
    <div
      v-if="selectedPartner"
      class="partner-details-card"
      :class="{ 'partner-details-card--modern': props.isModernTheme }"
    >
      <img
        :src="getAvatarUrl(selectedPartner.avatar_url)"
        :alt="selectedPartner.username"
        class="partner-details-avatar partner-details-avatar--clickable"
        @click="navigateToPartnerCard(selectedPartner)"
        title="Нажмите, чтобы перейти к лицензии"
      />
      <div class="partner-details-info">
        <!-- Полное имя - если разрешено -->
        <h4 v-if="selectedPartner.full_name" class="partner-details-name">
          {{ selectedPartner.full_name }}
        </h4>
        <h4 v-else class="partner-details-name partner-details-hidden">
          🔒 Скрыто
        </h4>

        <p class="partner-details-number">{{ selectedPartner.personal_id }}</p>

        <!-- Представительство -->
        <div class="partner-details-field">
          <span class="partner-details-icon" aria-hidden="true">🏢</span>          
          <span class="partner-details-label">Представительство:</span>
          <span v-if="selectedPartner.office">{{ selectedPartner.office }}</span>
          <span v-else class="partner-details-hidden">🔒 Скрыто</span>
        </div>
        <!-- Страна -->
        <div class="partner-details-field">
          <span class="partner-details-icon" aria-hidden="true">🌍</span>
          <span class="partner-details-label">Страна:</span>
          <span v-if="selectedPartner.country">{{ selectedPartner.country }}</span>
          <span v-else class="partner-details-hidden">🔒 Скрыто</span>
        </div>

        <!-- Город -->
        <div class="partner-details-field">
          <span class="partner-details-icon" aria-hidden="true">🏙️</span>
          <span class="partner-details-label">Город:</span>
          <span v-if="selectedPartner.city">{{ selectedPartner.city }}</span>
          <span v-else class="partner-details-hidden">🔒 Скрыто</span>
        </div>
        <!-- Телефон -->
        <div class="partner-details-field">
          <span class="partner-details-icon" aria-hidden="true">📞</span>          
          <span class="partner-details-label">Телефон:</span>
          <span v-if="selectedPartner.phone">
            <a
              :href="`tel:${normalizePhone(selectedPartner.phone)}`"
              class="partner-details-link"
              @click.prevent="handlePhoneClick(selectedPartner.phone)"
            >
              {{ selectedPartner.phone }}
            </a>
          </span>
          <span v-else class="partner-details-hidden">🔒 Скрыто</span>
        </div>

        <!-- VK -->
        <div class="partner-details-field">
          <span class="partner-details-icon" aria-hidden="true">🟦</span>
          <span class="partner-details-label">VK:</span>
          <span v-if="selectedPartner.vk_profile">
            <a
              :href="buildVkLink(selectedPartner.vk_profile)"
              class="partner-details-link"
              target="_blank"
              rel="noopener"
            >
              Профиль
            </a>
          </span>
          <span v-else class="partner-details-hidden">🔒 Скрыто</span>
        </div>

        <!-- Telegram -->
        <div class="partner-details-field">
          <span class="partner-details-icon" aria-hidden="true">✈️</span>
          <span class="partner-details-label">Telegram:</span>
          <span v-if="selectedPartner.telegram_user">
            <a
              :href="buildTelegramWebLink(selectedPartner.telegram_user)"
              class="partner-details-link"
              target="_blank"
              rel="noopener"
              @click.prevent="openTelegram(selectedPartner.telegram_user)"
            >
              Профиль
            </a>
          </span>
          <span v-else class="partner-details-hidden">🔒 Скрыто</span>
        </div>

        <!-- Instagram -->
        <div class="partner-details-field">
          <span class="partner-details-icon" aria-hidden="true">📸</span>
          <span class="partner-details-label">Instagram:</span>
          <span v-if="selectedPartner.instagram_profile">
            <a
              :href="buildInstagramWebLink(selectedPartner.instagram_profile)"
              class="partner-details-link"
              target="_blank"
              rel="noopener"
              @click.prevent="openInstagram(selectedPartner.instagram_profile)"
            >
              Профиль
            </a>
          </span>
          <span v-else class="partner-details-hidden">🔒 Скрыто</span>
        </div>

        <!-- Сайт -->
        <div class="partner-details-field">
          <span class="partner-details-icon" aria-hidden="true">🌐</span>
          <span class="partner-details-label">Сайт:</span>
          <span v-if="selectedPartner.website">
            <a
              :href="selectedPartner.website.startsWith('http') ? selectedPartner.website : 'https://' + selectedPartner.website"
              class="partner-details-link"
              target="_blank"
              rel="noopener"
            >
              Профиль
            </a>
          </span>
          <span v-else class="partner-details-hidden">🔒 Скрыто</span>
        </div>
      </div>
      <button @click="closeDetails" class="partner-details-close">×</button>
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

      <!-- Список партнёров (сетка аватаров) -->
      <div v-else class="partners-list">
        <div
          v-for="partner in partners"
          :key="partner.id"
          class="partner-item"
          :class="{ 'partner-item--selected': selectedPartner?.id === partner.id }"
          @click="openPartnerDetails(partner)"
        >
          <img
            :src="getAvatarUrl(partner.avatar_url)"
            :alt="partner.username"
            class="partner-avatar"
          />
          <span class="partner-name">{{ partner.username }}</span>
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

/* Сетка аватаров партнеров */
.partners-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
  gap: 16px;
  padding: 0;
}

.partner-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  transition: transform 0.2s ease;
}

.partner-item:hover {
  transform: scale(1.05);
}

.partner-item--selected .partner-avatar {
  border-color: #5D8BF4;
  box-shadow: 0 0 0 3px rgba(93, 139, 244, 0.2);
}

.partner-avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid #e0e0e0;
  margin-bottom: 8px;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.partner-name {
  font-size: 12px;
  color: #333;
  text-align: center;
  max-width: 90px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Модальное окно с деталями партнера */
.partner-details-card {
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 16px;
  margin: 0 20px 12px 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  display: flex;
  gap: 12px;
  position: relative;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.partner-details-avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  border: 2px solid #e0e0e0;
}

.partner-details-avatar--clickable {
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.partner-details-avatar--clickable:hover {
  transform: scale(1.05);
  box-shadow: 0 0 0 3px rgba(93, 139, 244, 0.3);
}

.partner-details-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.partner-details-name {
  font-size: 16px;
  font-weight: 600;
  color: #333;
  margin: 0;
}
.partner-details-number {
  font-size: 16px;
  font-weight: 600;
  color: #333;
  margin: 0;
  text-align: center;
}
.partner-details-field {
  font-size: 13px;
  color: #666;
  display: flex;
  gap: 6px;
}
.partner-details-link {
  color: #2563eb;
  text-decoration: none;
}

.partner-details-link:hover {
  text-decoration: underline;
}

.partner-details-label {
  font-weight: 500;
  color: #888;
  min-width: 120px;
}

.partner-details-hidden {
  color: #999;
  font-style: italic;
  font-size: 12px;
}
.partner-details-icon {
  width: 18px;
  display: inline-flex;
  justify-content: center;
  align-items: center;
  font-size: 14px;
}
.partner-details-close {
  position: absolute;
  top: 12px;
  right: 12px;
  background: none;
  border: none;
  font-size: 24px;
  color: #666;
  cursor: pointer;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s;
}

.partner-details-close:hover {
  color: #000;
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

/* Modern Theme - Partner Item */
.partners-panel--modern .partner-avatar {
  border-color: rgba(96, 164, 255, 0.35);
}

.partners-panel--modern .partner-item--selected .partner-avatar {
  border-color: rgba(96, 164, 255, 0.8);
  box-shadow: 0 0 0 3px rgba(96, 164, 255, 0.3);
}

.partners-panel--modern .partner-name {
  color: #e5f3ff;
}

/* Modern Theme - Details Card */
.partner-details-card--modern {
  background: rgba(24, 34, 58, 0.92);
  border-color: rgba(96, 164, 255, 0.35);
  box-shadow: 0 2px 8px rgba(6, 11, 21, 0.4);
}

.partner-details-card--modern .partner-details-avatar {
  border-color: rgba(96, 164, 255, 0.35);
}

.partner-details-card--modern .partner-details-name {
  color: #e5f3ff;
}
.partner-details-card--modern .partner-details-number {
  color: #e5f3ff;
}
.partner-details-card--modern .partner-details-field {
  color: rgba(229, 243, 255, 0.8);
}

.partner-details-card--modern .partner-details-label {
  color: rgba(229, 243, 255, 0.6);
}

.partner-details-card--modern .partner-details-close {
  color: rgba(229, 243, 255, 0.7);
}

.partner-details-card--modern .partner-details-close:hover {
  color: #fca5a5;
}
</style>
