<template>
  <div class="admin-panel">
    <!-- Overlay при открытом sidebar на мобильных -->
    <div v-if="sidebarOpen" class="sidebar-overlay" @click="sidebarOpen = false"></div>

    <!-- Боковая панель слева -->
    <aside :class="['sidebar', { open: sidebarOpen }]">
      <div class="sidebar-header">
        <h2>Админ панель</h2>
        <button class="sidebar-close" @click="sidebarOpen = false">✕</button>
      </div>

      <nav class="sidebar-nav">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          :class="['sidebar-tab', { active: activeTab === tab.id }]"
          @click="setActiveTab(tab.id); sidebarOpen = false"
        >
          {{ tab.label }}
        </button>
      </nav>

      <div class="sidebar-footer">
        <button @click="$router.push('/boards')" class="back-button">
          Вернуться к доскам
        </button>
      </div>
    </aside>

    <!-- Основной контент -->
    <main class="main-content">
      <div class="content-header">
        <button class="hamburger-btn" @click="sidebarOpen = true">☰</button>
        <h1>{{ tabs.find(t => t.id === activeTab)?.label || 'Панель администратора' }}</h1>
      </div>

      <div class="content-body">
        <!-- Вкладка: Статистика -->
        <div v-if="activeTab === 'stats'" class="tab-content">
          <AdminStats />
        </div>

        <!-- Вкладка: Пользователи -->
        <div v-if="activeTab === 'users'" class="tab-content">
          <AdminUsers />
        </div>

        <!-- Вкладка: История транзакций -->
        <div v-if="activeTab === 'transactions'" class="tab-content">
          <AdminTransactionHistory />
        </div>

        <!-- Вкладка: Верификация -->
        <div v-if="activeTab === 'verification'" class="tab-content">
          <AdminVerification />
        </div>

        <!-- Вкладка: Логи -->
        <div v-if="activeTab === 'logs'" class="tab-content">
          <AdminLogs />
        </div>

        <!-- Вкладка: Модерация изображений -->
        <div v-if="activeTab === 'moderation'" class="tab-content">
          <AdminImagesModeration />
        </div>

        <!-- Вкладка: Общая библиотека -->
        <div v-if="activeTab === 'library'" class="tab-content">
          <AdminSharedLibrary />
        </div>

        <!-- Вкладка: Swagger API -->
        <div v-if="activeTab === 'swagger'" class="tab-content swagger-tab">
          <iframe :src="swaggerUrl" class="swagger-iframe"></iframe>
        </div>

        <!-- Вкладка: ER-диаграмма -->
        <div v-if="activeTab === 'er-diagram'" class="tab-content er-diagram-tab">
          <iframe src="/er-diagram.html" class="er-diagram-iframe"></iframe>
        </div>
      </div>
    </main>

    <!-- Уведомление об ошибках -->
    <div v-if="adminStore.error" class="error-notification">
      <p>{{ adminStore.error }}</p>
      <button @click="adminStore.clearError()">Закрыть</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAdminStore } from '../stores/admin'
import { useAuthStore } from '../stores/auth'
import AdminStats from '../components/Admin/AdminStats.vue'
import AdminUsers from '../components/Admin/AdminUsers.vue'
import AdminVerification from '../components/Admin/AdminVerification.vue'
import AdminLogs from '../components/Admin/AdminLogs.vue'
import AdminImagesModeration from '../components/Admin/AdminImagesModeration.vue'
import AdminSharedLibrary from '../components/Admin/AdminSharedLibrary.vue'
import AdminTransactionHistory from '../components/Admin/AdminTransactionHistory.vue'

const router = useRouter()
const route = useRoute()  
const adminStore = useAdminStore()
const authStore = useAuthStore()

const sidebarOpen = ref(false)

const swaggerUrl = computed(() => {
  const token = authStore.token
  return token ? `/api/docs?token=${token}` : '/api/docs'
})

const tabs = [
  { id: 'stats', label: 'Статистика' },
  { id: 'users', label: 'Пользователи' },
  { id: 'transactions', label: 'История транзакций' },
  { id: 'verification', label: 'Верификация' },
  { id: 'moderation', label: 'Модерация изображений' },
  { id: 'library', label: 'Общая библиотека' },
  { id: 'logs', label: 'Логи' },
  { id: 'swagger', label: 'Swagger API' },
  { id: 'er-diagram', label: 'ER-диаграмма' }
]
const tabIds = tabs.map((tab) => tab.id)
const activeTab = ref(tabs[0].id)

const setActiveTab = (tabId) => {
  if (!tabIds.includes(tabId)) return

  activeTab.value = tabId
  router.replace({ query: { ...route.query, tab: tabId } })
}
onMounted(async () => {
  // Проверяем, что пользователь является администратором
  if (!authStore.user?.role || authStore.user.role !== 'admin') {
    console.warn('[ADMIN] Доступ запрещен: пользователь не является администратором')
    router.push('/boards')
    return
  }

  // Загружаем начальную статистику
  try {
    await adminStore.fetchStats()
  } catch (err) {
    console.error('[ADMIN] Ошибка загрузки статистики:', err)
  }
})


watch(
  () => route.query.tab,
  (tabFromRoute) => {
    if (typeof tabFromRoute !== 'string') {
      setActiveTab(activeTab.value)
      return
    }

    if (tabIds.includes(tabFromRoute)) {
      activeTab.value = tabFromRoute
      return
    }

    setActiveTab(tabs[0].id)
  },
  { immediate: true }
)  
</script>

<style scoped>
.admin-panel {
  display: flex;
  min-height: 100vh;
  background: #f5f5f5;
  overflow-x: hidden;
}

/* Боковая панель */
.sidebar {
  width: 280px;
  background: white;
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  position: fixed;
  left: 0;
  top: 0;
  bottom: 0;
  z-index: 100;
}

.sidebar-header {
  padding: 30px 20px;
  border-bottom: 1px solid #e5e5e5;
}

.sidebar-header h2 {
  margin: 0;
  font-size: 22px;
  color: #333;
  font-weight: 600;
}

.sidebar-nav {
  flex: 1;
  padding: 20px 0;
  overflow-y: auto;
}

.sidebar-tab {
  width: 100%;
  padding: 14px 24px;
  background: transparent;
  border: none;
  text-align: left;
  cursor: pointer;
  font-size: 15px;
  color: #666;
  transition: all 0.3s;
  border-left: 3px solid transparent;
}

.sidebar-tab:hover {
  background: #f8f8f8;
  color: #333;
}

.sidebar-tab.active {
  background: #f0edff;
  color: #6c63ff;
  border-left-color: #6c63ff;
  font-weight: 500;
}

.sidebar-footer {
  padding: 20px;
  border-top: 1px solid #e5e5e5;
}

.back-button {
  width: 100%;
  padding: 12px 20px;
  background: #6c63ff;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.3s;
}

.back-button:hover {
  background: #5a52d5;
}

/* Основной контент */
.main-content {
  flex: 1;
  margin-left: 280px;
  display: flex;
  flex-direction: column;
}

.content-header {
  padding: 30px 40px;
  background: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.content-header h1 {
  margin: 0;
  font-size: 28px;
  color: #333;
  font-weight: 600;
}

.content-body {
  flex: 1;
  padding: 30px 40px;
}

.tab-content {
  background: white;
  border-radius: 8px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  min-height: 600px;
  animation: fadeIn 0.3s;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Уведомление об ошибках */
.error-notification {
  position: fixed;
  bottom: 20px;
  right: 20px;
  background: #ff4444;
  color: white;
  padding: 15px 20px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  display: flex;
  align-items: center;
  gap: 15px;
  animation: slideIn 0.3s;
  z-index: 200;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
}

.error-notification p {
  margin: 0;
}

.error-notification button {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  padding: 5px 15px;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.3s;
}

.error-notification button:hover {
  background: rgba(255, 255, 255, 0.3);
}

.er-diagram-tab {
  padding: 0 !important;
  margin: -20px;
}

.er-diagram-iframe {
  width: 100%;
  height: calc(100vh - 160px);
  border: none;
  border-radius: 0 0 8px 8px;
}

.swagger-tab {
  padding: 0 !important;
  margin: -20px;
}

.swagger-iframe {
  width: 100%;
  height: calc(100vh - 160px);
  border: none;
  border-radius: 0 0 8px 8px;
}

/* Hamburger — скрыта на десктопе */
.hamburger-btn {
  display: none;
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #333;
  padding: 0;
  line-height: 1;
}

/* Крестик закрытия — скрыт на десктопе */
.sidebar-close {
  display: none;
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: #666;
  padding: 0;
  line-height: 1;
}

/* Overlay — скрыт на десктопе */
.sidebar-overlay {
  display: none;
}

/* Адаптивность */
@media (max-width: 768px) {
  .sidebar {
    transform: translateX(-100%);
    transition: transform 0.3s ease;
    width: 280px;
    z-index: 1000;
  }

  .sidebar.open {
    transform: translateX(0);
  }

  .sidebar-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px 16px;
  }

  .sidebar-close {
    display: block;
  }

  .sidebar-overlay {
    display: block;
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    z-index: 999;
  }

  .main-content {
    margin-left: 0;
  }

  .content-header {
    padding: 16px 20px;
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .content-header h1 {
    font-size: 20px;
  }

  .hamburger-btn {
    display: block;
  }

  .content-body {
    padding: 12px;
  }

  .tab-content {
    padding: 16px;
    min-height: auto;
  }

  .sidebar-tab {
    padding: 12px 16px;
    font-size: 14px;
  }

  .error-notification {
    left: 12px;
    right: 12px;
    bottom: 12px;
  }

  .swagger-iframe,
  .er-diagram-iframe {
    height: calc(100vh - 120px);
  }
}
</style>
