<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '../../stores/auth'
import { useBoardStore } from '../../stores/board'
import { useHistoryStore } from '../../stores/history'
import { useCanvasStore } from '../../stores/canvas'
import { useCardsStore } from '../../stores/cards'
import { useConnectionsStore } from '../../stores/connections'
import { useViewSettingsStore } from '../../stores/viewSettings'
import { useProjectActions } from '../../composables/useProjectActions'
import AuthModal from '../AuthModal.vue'
import UserProfile from '../UserProfile.vue'
import BoardsModal from '../Board/BoardsModal.vue'

const props = defineProps({
  isModernTheme: {
    type: Boolean,
    default: false
  },
  isSaving: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['toggle-theme', 'open-board'])

const authStore = useAuthStore()
const boardStore = useBoardStore()
const historyStore = useHistoryStore()
const canvasStore = useCanvasStore()
const cardsStore = useCardsStore()
const connectionsStore = useConnectionsStore()
const viewSettingsStore = useViewSettingsStore()

const { isAuthenticated, user } = storeToRefs(authStore)
const { currentBoardName, lastSaved } = storeToRefs(boardStore)
const { canUndo, canRedo } = storeToRefs(historyStore)
const { isHierarchicalDragMode } = storeToRefs(canvasStore)
const { headerColor, headerColorIndex, lineColor, lineThickness, animationSeconds } = storeToRefs(viewSettingsStore)

const showAuthModal = ref(false)
const authModalView = ref('login')
const showProfile = ref(false)
const showBoards = ref(false)
const showUserMenu = ref(false)
const userMenuRef = ref(null)
const userTriggerRef = ref(null)
const templateAnchorRef = ref(null)
const templateMenuRef = ref(null)
const isTemplateMenuOpen = ref(false)

const API_URL = import.meta.env.VITE_API_URL || 'https://interactive.marketingfohow.ru/api'

const { handleExportHTML, handleLoadProject } = useProjectActions()

const templateModules = import.meta.glob('@/templates/*.json', {
  eager: true,
  import: 'default'
})

function buildTemplateLabel(fileName, templateData) {
  const baseName = fileName.replace(/\.json$/i, '')
  if (templateData && typeof templateData === 'object') {
    const title = templateData.meta?.title || templateData.title || templateData.name
    if (typeof title === 'string' && title.trim().length > 0) {
      return title.trim()
    }
  }
  return baseName
}

const templatesRegistry = Object.entries(templateModules).reduce((map, [path, templateData]) => {
  const fileName = path.split('/').pop()
  if (!fileName) {
    return map
  }
  const id = fileName.replace(/\.json$/i, '')
  map[id] = {
    id,
    label: buildTemplateLabel(fileName, templateData),
    fileName,
    data: templateData
  }
  return map
}, {})

const templateOptions = computed(() =>
  Object.values(templatesRegistry)
    .sort((a, b) => a.label.localeCompare(b.label, 'ru'))
    .map(template => ({
      id: template.id,
      label: template.label,
      fileName: template.fileName,
      displayText: template.label
    }))
)

const themeTitle = computed(() =>
  props.isModernTheme ? 'Вернуть светлое меню' : 'Включить тёмное меню'
)

const hierarchyTitle = computed(() =>
  isHierarchicalDragMode.value ? 'Отключить режим иерархии' : 'Включить режим иерархии'
)

const saveStatus = computed(() => {
  if (props.isSaving) {
    return 'Сохранение...'
  }
  if (lastSaved.value) {
    return 'Сохранено'
  }
  return 'Нет сохранений'
})

function getAvatarUrl(url) {
  if (!url) return ''
  return `${API_URL.replace('/api', '')}${url}`
}

function getInitials(name) {
  if (!name) return '?'
  const parts = name.split(' ')
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return name.substring(0, 2).toUpperCase()
}

function openLogin() {
  authModalView.value = 'login'
  showAuthModal.value = true
}

function openRegister() {
  authModalView.value = 'register'
  showAuthModal.value = true
}

function handleLogout() {
  showUserMenu.value = false
  if (confirm('Вы уверены, что хотите выйти?')) {
    authStore.logout()
  }
}

function toggleUserMenu() {
  if (!isAuthenticated.value) {
    openLogin()
    return
  }
  showUserMenu.value = !showUserMenu.value
}

function closeUserMenu() {
  showUserMenu.value = false
}

function openBoards() {
  showBoards.value = true
  closeUserMenu()
}

function handleOpenBoard(boardId) {
  showBoards.value = false
  emit('open-board', boardId)
}

function handleProfileClick() {
  showProfile.value = true
  closeUserMenu()
}

function handleUndo() {
  if (!canUndo.value) {
    return
  }
  historyStore.undo()
}

function handleRedo() {
  if (!canRedo.value) {
    return
  }
  historyStore.redo()
}

function handleHierarchyToggle() {
  canvasStore.toggleHierarchicalDragMode()
}

function handleToggleTheme() {
  emit('toggle-theme')
}

function addCard() {
  cardsStore.addCard({
    type: 'small',
    headerBg: headerColor.value,
    colorIndex: headerColorIndex.value
  })
}

function addLargeCard() {
  cardsStore.addCard({
    type: 'large',
    headerBg: headerColor.value,
    colorIndex: headerColorIndex.value
  })
}

function addGoldCard() {
  cardsStore.addCard({
    type: 'gold'
  })
}

function closeTemplateMenu() {
  isTemplateMenuOpen.value = false
}

function toggleTemplateMenu() {
  if (!templateOptions.value.length) {
    return
  }
  isTemplateMenuOpen.value = !isTemplateMenuOpen.value
}

function handleTemplateButtonClick(event) {
  event?.preventDefault?.()
  event?.stopPropagation?.()
  toggleTemplateMenu()
}

function insertTemplate(templateData) {
  if (!templateData || !Array.isArray(templateData.cards)) {
    return
  }
  const createdCardsMap = new Map()
  const createdCardIds = []
  templateData.cards.forEach(cardDef => {
    if (!cardDef) {
      return
    }
    const templateKey = cardDef.key || cardDef.id
    if (!templateKey) {
      return
    }
    const { key: _legacyKey, id: _legacyId, type = 'large', ...cardPayload } = cardDef
    const cardData = cardsStore.addCard({
      type,
      ...cardPayload,
      headerBg: headerColor.value,
      colorIndex: headerColorIndex.value
    })
    createdCardsMap.set(templateKey, cardData)
    createdCardIds.push(cardData.id)
  })
  const templateLines = Array.isArray(templateData.connections) ? templateData.connections : []
  templateLines.forEach(lineDef => {
    if (!lineDef) {
      return
    }
    const startKey = lineDef.startKey || lineDef.from || lineDef.sourceKey
    const endKey = lineDef.endKey || lineDef.to || lineDef.targetKey
    const startCard = startKey ? createdCardsMap.get(startKey) : null
    const endCard = endKey ? createdCardsMap.get(endKey) : null
    if (!startCard || !endCard) {
      return
    }
    const thicknessValue = Number.isFinite(lineDef.thickness)
      ? lineDef.thickness
      : Number.isFinite(lineDef.lineWidth)
        ? lineDef.lineWidth
        : lineThickness.value
    const animationMs = Number.isFinite(lineDef.animationDurationMs)
      ? lineDef.animationDurationMs
      : Number.isFinite(lineDef.animationDuration)
        ? lineDef.animationDuration
        : animationSeconds.value * 1000
    connectionsStore.addConnection(startCard.id, endCard.id, {
      color: lineDef.color || lineDef.stroke || lineColor.value,
      thickness: thicknessValue,
      fromSide: lineDef.startSide || lineDef.fromSide || 'bottom',
      toSide: lineDef.endSide || lineDef.toSide || 'top',
      animationDuration: animationMs
    })
  })
  cardsStore.deselectAllCards()
  createdCardIds.forEach(id => cardsStore.selectCard(id))
}

function selectTemplate(templateId) {
  const template = templatesRegistry[templateId]
  if (!template) {
    return
  }
  insertTemplate(template.data)
  closeTemplateMenu()
}

function handleDocumentClick(event) {
  const menuEl = userMenuRef.value
  const triggerEl = userTriggerRef.value
  if (menuEl && !menuEl.contains(event.target) && triggerEl && !triggerEl.contains(event.target)) {
    closeUserMenu()
  }
  const anchor = templateAnchorRef.value
  if (anchor && anchor.contains(event.target)) {
    return
  }
  const templateMenuEl = templateMenuRef.value
  if (templateMenuEl && templateMenuEl.contains(event.target)) {
    return
  }
  if (isTemplateMenuOpen.value && (!templateMenuEl || !templateMenuEl.contains(event.target))) {
    closeTemplateMenu()
  }
}

function handleKeydown(event) {
  if (event.key === 'Escape') {
    closeUserMenu()
    closeTemplateMenu()
  }
}

onMounted(() => {
  document.addEventListener('click', handleDocumentClick)
  document.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleDocumentClick)
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div
    :class="[
      'mobile-toolbar',
      { 'mobile-toolbar--modern': props.isModernTheme }
    ]"
  >
    <button
      class="mobile-toolbar__theme"
      type="button"
      :title="themeTitle"
      @click="handleToggleTheme"
    >
      <span class="mobile-toolbar__theme-icon" aria-hidden="true"></span>
      <span class="visually-hidden">{{ themeTitle }}</span>
    </button>

    <div class="mobile-toolbar__history">
      <button
        class="mobile-toolbar__history-btn"
        type="button"
        title="Отменить"
        :disabled="!canUndo"
        @click="handleUndo"
      >
        ↶
      </button>
      <button
        class="mobile-toolbar__history-btn"
        type="button"
        title="Повторить"
        :disabled="!canRedo"
        @click="handleRedo"
      >
        ↷
      </button>
    </div>

    <div class="mobile-toolbar__auth">
      <button
        ref="userTriggerRef"
        type="button"
        class="mobile-toolbar__avatar"
        :title="isAuthenticated ? 'Личный кабинет' : 'Войти'"
        @click.stop="toggleUserMenu"
      >
        <span class="mobile-toolbar__avatar-circle">
          <img
            v-if="isAuthenticated && user?.avatar_url"
            :src="getAvatarUrl(user.avatar_url)"
            alt="Аватар"
          >
          <span v-else aria-hidden="true">
            {{ isAuthenticated ? getInitials(user?.username || user?.email) : '👤' }}
          </span>
        </span>
        <span class="mobile-toolbar__avatar-text">
          {{ isAuthenticated ? (user?.username || user?.email) : 'Войти' }}
        </span>
      </button>
      <transition name="mobile-toolbar-fade">
        <div
          v-if="showUserMenu"
          ref="userMenuRef"
          class="mobile-toolbar__user-menu"
        >
          <div class="mobile-toolbar__user-header">
            <span class="mobile-toolbar__board-name">{{ currentBoardName || 'Проект' }}</span>
            <span class="mobile-toolbar__save-status">{{ saveStatus }}</span>
          </div>
          <div class="mobile-toolbar__user-actions">
            <button type="button" @click="openBoards">📁 Мои проекты</button>
            <button type="button" @click="handleProfileClick">👤 Профиль</button>
            <button type="button" @click="handleLogout">🚪 Выйти</button>
          </div>
        </div>
      </transition>
    </div>

    <div class="mobile-toolbar__side">
      <button
        type="button"
        class="mobile-toolbar__side-btn"
        title="Экспортировать HTML"
        @click="handleExportHTML"
      >
        📄
      </button>
      <button
        type="button"
        class="mobile-toolbar__side-btn"
        title="Загрузить JSON"
        @click="handleLoadProject"
      >
        📂
      </button>
      <button
        type="button"
        class="mobile-toolbar__side-btn"
        :class="{ 'mobile-toolbar__side-btn--active': isHierarchicalDragMode }"
        :title="hierarchyTitle"
        @click="handleHierarchyToggle"
      >
        🌳
      </button>
    </div>

    <div class="mobile-toolbar__bottom">
      <div class="mobile-toolbar__licenses">
        <button
          type="button"
          class="mobile-toolbar__license-btn"
          title="Добавить лицензию"
          @click="addCard"
        >
          □
        </button>
        <button
          type="button"
          class="mobile-toolbar__license-btn mobile-toolbar__license-btn--large"
          title="Добавить большую лицензию"
          @click="addLargeCard"
        >
          ⧠
        </button>
        <button
          type="button"
          class="mobile-toolbar__license-btn mobile-toolbar__license-btn--gold"
          title="Добавить Gold лицензию"
          @click="addGoldCard"
        >
          ★
        </button>
      </div>
      <div ref="templateAnchorRef" class="mobile-toolbar__templates">
        <button
          type="button"
          class="mobile-toolbar__license-btn"
          title="Добавить шаблон"
          :disabled="!templateOptions.length"
          aria-haspopup="true"
          :aria-expanded="isTemplateMenuOpen"
          @click="handleTemplateButtonClick"
        >
          ⧉
        </button>
        <transition name="mobile-toolbar-fade">
          <div
            v-if="isTemplateMenuOpen && templateOptions.length"
            ref="templateMenuRef"
            class="mobile-toolbar__templates-menu"
            role="menu"
            aria-label="Выбор шаблона"
          >
            <button
              v-for="option in templateOptions"
              :key="option.id"
              type="button"
              role="menuitem"
              @click.stop="selectTemplate(option.id)"
            >
              {{ option.displayText }}
            </button>
          </div>
        </transition>
      </div>
    </div>

    <AuthModal
      v-if="showAuthModal"
      :initial-view="authModalView"
      @close="showAuthModal = false"
      @switch-view="authModalView = $event"
      @open-register="openRegister"
      @open-login="openLogin"
    />

    <UserProfile v-if="showProfile" @close="showProfile = false" />

    <BoardsModal
      v-if="showBoards"
      @close="showBoards = false"
      @open-board="handleOpenBoard"
    />
  </div>
</template>

<style scoped>
.mobile-toolbar {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 2100;
  font-family: inherit;
  color: #0f172a;
}

.mobile-toolbar--modern {
  color: #e5f3ff;
}

.mobile-toolbar__theme {
  pointer-events: auto;
  position: fixed;
  top: 16px;
  left: 16px;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  border: 1px solid rgba(15, 23, 42, 0.12);
  background: rgba(255, 255, 255, 0.9);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 16px 34px rgba(15, 23, 42, 0.25);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.mobile-toolbar--modern .mobile-toolbar__theme {
  border-color: rgba(114, 182, 255, 0.45);
  background: rgba(24, 34, 58, 0.92);
  box-shadow: 0 18px 40px rgba(6, 11, 21, 0.6);
}

.mobile-toolbar__theme:hover {
  transform: translateY(-2px);
  box-shadow: 0 24px 44px rgba(15, 23, 42, 0.28);
}

.mobile-toolbar__theme-icon {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: linear-gradient(135deg, #0f172a 0%, #2563eb 100%);
}

.mobile-toolbar--modern .mobile-toolbar__theme-icon {
  background: linear-gradient(135deg, #e5f3ff 0%, #73c8ff 100%);
}

.mobile-toolbar__history {
  pointer-events: auto;
  position: fixed;
  top: 24px;
  left: 50%;
  transform: translateX(-130px);
  display: inline-flex;
  gap: 12px;
}

.mobile-toolbar__history-btn {
  width: 48px;
  height: 48px;
  border-radius: 16px;
  border: 1px solid rgba(15, 23, 42, 0.12);
  background: rgba(255, 255, 255, 0.92);
  font-size: 20px;
  font-weight: 600;
  color: #0f172a;
  cursor: pointer;
  box-shadow: 0 14px 30px rgba(15, 23, 42, 0.22);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.mobile-toolbar__history-btn:disabled {
  opacity: 0.5;
  cursor: default;
  box-shadow: none;
}

.mobile-toolbar__history-btn:not(:disabled):hover {
  transform: translateY(-2px);
  box-shadow: 0 20px 40px rgba(15, 23, 42, 0.28);
}

.mobile-toolbar--modern .mobile-toolbar__history-btn {
  border-color: rgba(114, 182, 255, 0.35);
  background: rgba(24, 34, 58, 0.9);
  color: #e5f3ff;
}

.mobile-toolbar__auth {
  pointer-events: auto;
  position: fixed;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
}

.mobile-toolbar__avatar {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  padding: 10px 18px;
  border-radius: 999px;
  border: 1px solid rgba(15, 23, 42, 0.12);
  background: rgba(255, 255, 255, 0.9);
  color: inherit;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.2);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.mobile-toolbar__avatar:hover {
  transform: translateY(-2px);
  box-shadow: 0 24px 48px rgba(15, 23, 42, 0.28);
}

.mobile-toolbar--modern .mobile-toolbar__avatar {
  border-color: rgba(114, 182, 255, 0.35);
  background: rgba(24, 34, 58, 0.92);
  box-shadow: 0 20px 44px rgba(6, 11, 21, 0.6);
}

.mobile-toolbar__avatar-circle {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: rgba(37, 99, 235, 0.12);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  overflow: hidden;
}

.mobile-toolbar__avatar-circle img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.mobile-toolbar--modern .mobile-toolbar__avatar-circle {
  background: rgba(114, 182, 255, 0.24);
}

.mobile-toolbar__avatar-text {
  font-size: 15px;
  white-space: nowrap;
}

.mobile-toolbar__user-menu {
  position: absolute;
  top: 68px;
  left: 50%;
  transform: translateX(-50%);
  min-width: 220px;
  border-radius: 18px;
  border: 1px solid rgba(15, 23, 42, 0.12);
  background: rgba(255, 255, 255, 0.95);
  color: #0f172a;
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.22);
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.mobile-toolbar--modern .mobile-toolbar__user-menu {
  border-color: rgba(114, 182, 255, 0.35);
  background: rgba(24, 34, 58, 0.92);
  color: #e5f3ff;
  box-shadow: 0 22px 44px rgba(6, 11, 21, 0.62);
}

.mobile-toolbar__user-header {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.mobile-toolbar__board-name {
  font-weight: 700;
  font-size: 15px;
}

.mobile-toolbar__save-status {
  font-size: 13px;
  color: rgba(15, 23, 42, 0.65);
}

.mobile-toolbar--modern .mobile-toolbar__save-status {
  color: rgba(229, 243, 255, 0.72);
}

.mobile-toolbar__user-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.mobile-toolbar__user-actions button {
  border: none;
  border-radius: 12px;
  padding: 10px 12px;
  text-align: left;
  background: rgba(59, 130, 246, 0.12);
  color: inherit;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s ease, background 0.2s ease;
}

.mobile-toolbar__user-actions button:hover {
  transform: translateX(2px);
  background: rgba(37, 99, 235, 0.18);
}

.mobile-toolbar--modern .mobile-toolbar__user-actions button {
  background: rgba(114, 182, 255, 0.18);
}

.mobile-toolbar__side {
  pointer-events: auto;
  position: fixed;
  top: 50%;
  right: 16px;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.mobile-toolbar__side-btn {
  width: 56px;
  height: 56px;
  border-radius: 18px;
  border: 1px solid rgba(15, 23, 42, 0.12);
  background: rgba(255, 255, 255, 0.92);
  font-size: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #0f172a;
  cursor: pointer;
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.24);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.mobile-toolbar__side-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 24px 48px rgba(15, 23, 42, 0.3);
}

.mobile-toolbar__side-btn--active {
  background: #0f62fe;
  color: #ffffff;
}

.mobile-toolbar--modern .mobile-toolbar__side-btn {
  border-color: rgba(114, 182, 255, 0.35);
  background: rgba(24, 34, 58, 0.92);
  color: #e5f3ff;
  box-shadow: 0 22px 48px rgba(6, 11, 21, 0.62);
}

.mobile-toolbar__bottom {
  pointer-events: auto;
  position: fixed;
  left: 50%;
  bottom: 92px;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.mobile-toolbar__licenses {
  display: flex;
  gap: 14px;
}

.mobile-toolbar__license-btn {
  width: 60px;
  height: 60px;
  border-radius: 18px;
  border: 1px solid rgba(15, 23, 42, 0.12);
  background: rgba(255, 255, 255, 0.92);
  font-size: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #0f172a;
  cursor: pointer;
  box-shadow: 0 18px 42px rgba(15, 23, 42, 0.25);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.mobile-toolbar__license-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 26px 50px rgba(15, 23, 42, 0.32);
}

.mobile-toolbar--modern .mobile-toolbar__license-btn {
  border-color: rgba(114, 182, 255, 0.35);
  background: rgba(24, 34, 58, 0.92);
  color: #e5f3ff;
  box-shadow: 0 22px 52px rgba(6, 11, 21, 0.65);
}

.mobile-toolbar__license-btn--gold {
  color: #facc15;
}

.mobile-toolbar__templates {
  position: relative;
  display: flex;
  justify-content: center;
}

.mobile-toolbar__templates-menu {
  position: absolute;
  bottom: 74px;
  left: 50%;
  transform: translateX(-50%);
  min-width: 220px;
  padding: 12px;
  border-radius: 16px;
  border: 1px solid rgba(15, 23, 42, 0.12);
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 18px 44px rgba(15, 23, 42, 0.25);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.mobile-toolbar--modern .mobile-toolbar__templates-menu {
  border-color: rgba(114, 182, 255, 0.35);
  background: rgba(24, 34, 58, 0.92);
  color: #e5f3ff;
  box-shadow: 0 22px 48px rgba(6, 11, 21, 0.65);
}

.mobile-toolbar__templates-menu button {
  border: none;
  border-radius: 12px;
  padding: 8px 10px;
  background: rgba(59, 130, 246, 0.12);
  color: inherit;
  font-weight: 600;
  cursor: pointer;
  text-align: center;
  transition: transform 0.2s ease, background 0.2s ease;
}

.mobile-toolbar__templates-menu button:hover {
  transform: translateY(-1px);
  background: rgba(37, 99, 235, 0.18);
}

.mobile-toolbar--modern .mobile-toolbar__templates-menu button {
  background: rgba(114, 182, 255, 0.18);
}

.mobile-toolbar-fade-enter-active,
.mobile-toolbar-fade-leave-active {
  transition: opacity 0.2s ease;
}

.mobile-toolbar-fade-enter-from,
.mobile-toolbar-fade-leave-to {
  opacity: 0;
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
</style>
