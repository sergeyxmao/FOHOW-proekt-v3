<template>
  <div class="admin-panel">
    <div class="admin-header">
      <h1>Панель администратора</h1>
      <button @click="$router.push('/boards')" class="back-button">
        Вернуться к доскам
      </button>
    </div>

    <div class="admin-tabs">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        :class="['tab', { active: activeTab === tab.id }]"
        @click="activeTab = tab.id"
      >
        {{ tab.label }}
      </button>
    </div>

    <div class="admin-content">
      <!-- Вкладка: Статистика -->
      <div v-if="activeTab === 'stats'" class="tab-content">
        <AdminStats />
      </div>

      <!-- Вкладка: Пользователи -->
      <div v-if="activeTab === 'users'" class="tab-content">
        <AdminUsers />
      </div>

      <!-- Вкладка: Логи -->
      <div v-if="activeTab === 'logs'" class="tab-content">
        <AdminLogs />
      </div>
    </div>

    <!-- Уведомление об ошибках -->
    <div v-if="adminStore.error" class="error-notification">
      <p>{{ adminStore.error }}</p>
      <button @click="adminStore.clearError()">Закрыть</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAdminStore } from '../stores/admin'
import { useAuthStore } from '../stores/auth'
import AdminStats from '../components/Admin/AdminStats.vue'
import AdminUsers from '../components/Admin/AdminUsers.vue'
import AdminLogs from '../components/Admin/AdminLogs.vue'

const router = useRouter()
const adminStore = useAdminStore()
const authStore = useAuthStore()

const activeTab = ref('stats')

const tabs = [
  { id: 'stats', label: 'Статистика' },
  { id: 'users', label: 'Пользователи' },
  { id: 'logs', label: 'Логи' }
]

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
</script>

<style scoped>
.admin-panel {
  max-width: 1400px;
  margin: 0 auto;
  padding: 20px;
  background: #f5f5f5;
  min-height: 100vh;
}

.admin-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  padding: 20px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.admin-header h1 {
  margin: 0;
  font-size: 28px;
  color: #333;
}

.back-button {
  padding: 10px 20px;
  background: #6c63ff;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.3s;
}

.back-button:hover {
  background: #5a52d5;
}

.admin-tabs {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  background: white;
  padding: 10px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.tab {
  flex: 1;
  padding: 12px 20px;
  background: transparent;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 16px;
  color: #666;
  transition: all 0.3s;
}

.tab:hover {
  background: #f0f0f0;
}

.tab.active {
  background: #6c63ff;
  color: white;
}

.admin-content {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  min-height: 500px;
}

.tab-content {
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
</style>
