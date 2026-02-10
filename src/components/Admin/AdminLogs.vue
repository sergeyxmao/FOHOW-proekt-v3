<template>
  <div class="admin-logs">
    <div class="logs-header">
      <h2>Системные логи</h2>
      <div class="filters">
        <select v-model="selectedLevel" @change="loadLogs" class="level-filter">
          <option value="">Все уровни</option>
          <option value="info">Info</option>
          <option value="warning">Warning</option>
          <option value="error">Error</option>
        </select>
        <button @click="refreshLogs" class="refresh-btn">
          Обновить
        </button>
      </div>
    </div>

    <div v-if="adminStore.isLoading" class="loading">
      Загрузка логов...
    </div>

    <div v-else-if="logs.length > 0" class="logs-container">
      <div class="logs-list">
        <div
          v-for="log in logs"
          :key="log.id"
          :class="['log-entry', log.level]"
        >
          <div class="log-header">
            <span :class="['log-level', log.level]">
              {{ log.level.toUpperCase() }}
            </span>
            <span class="log-time">
              {{ formatDateTime(log.created_at) }}
            </span>
          </div>
          <div class="log-message">
            {{ log.message }}
          </div>
          <div v-if="log.context" class="log-context">
            <details>
              <summary>Контекст</summary>
              <pre>{{ formatContext(log.context) }}</pre>
            </details>
          </div>
        </div>
      </div>

      <!-- Пагинация -->
      <div class="pagination">
        <button
          @click="goToPage(currentPage - 1)"
          :disabled="currentPage === 1"
          class="pagination-btn"
        >
          Назад
        </button>
        <span class="pagination-info">
          Страница {{ currentPage }} из {{ totalPages }}
        </span>
        <button
          @click="goToPage(currentPage + 1)"
          :disabled="currentPage >= totalPages"
          class="pagination-btn"
        >
          Вперед
        </button>
      </div>
    </div>

    <div v-else class="no-data">
      Логи не найдены
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAdminStore } from '../../stores/admin'

const adminStore = useAdminStore()

const selectedLevel = ref('')
const currentPage = ref(1)
const totalPages = ref(1)
const limit = ref(100)

const logs = computed(() => adminStore.logs)

onMounted(() => {
  loadLogs()
})

const loadLogs = async () => {
  try {
    const result = await adminStore.fetchLogs({
      page: currentPage.value,
      limit: limit.value,
      level: selectedLevel.value || null
    })
    if (result.pagination) {
      totalPages.value = result.pagination.totalPages
    }
  } catch (err) {
    console.error('[ADMIN] Ошибка загрузки логов:', err)
  }
}

const refreshLogs = () => {
  currentPage.value = 1
  loadLogs()
}

const goToPage = async (page) => {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page
    await loadLogs()
  }
}

const formatDateTime = (dateString) => {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleString('ru-RU', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

const formatContext = (context) => {
  if (typeof context === 'string') {
    try {
      return JSON.stringify(JSON.parse(context), null, 2)
    } catch {
      return context
    }
  }
  return JSON.stringify(context, null, 2)
}
</script>

<style scoped>
.admin-logs {
  padding: 20px;
}

.logs-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

h2 {
  margin: 0;
  font-size: 24px;
  color: #333;
}

.filters {
  display: flex;
  gap: 10px;
}

.level-filter {
  padding: 8px 15px;
  border: 1px solid #ddd;
  border-radius: 5px;
  font-size: 14px;
  cursor: pointer;
}

.refresh-btn {
  padding: 8px 20px;
  background: #6c63ff;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.3s;
}

.refresh-btn:hover {
  background: #5a52d5;
}

.loading, .no-data {
  text-align: center;
  padding: 40px;
  color: #666;
  font-size: 16px;
}

.logs-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 20px;
}

.log-entry {
  background: white;
  border-left: 4px solid #ccc;
  border-radius: 5px;
  padding: 15px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s;
}

.log-entry:hover {
  transform: translateX(2px);
}

.log-entry.info {
  border-left-color: #51cf66;
}

.log-entry.warning {
  border-left-color: #ffd43b;
}

.log-entry.error {
  border-left-color: #ff6b6b;
}

.log-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.log-level {
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: bold;
  text-transform: uppercase;
}

.log-level.info {
  background: #51cf66;
  color: white;
}

.log-level.warning {
  background: #ffd43b;
  color: #333;
}

.log-level.error {
  background: #ff6b6b;
  color: white;
}

.log-time {
  font-size: 12px;
  color: #999;
}

.log-message {
  font-size: 14px;
  color: #333;
  line-height: 1.6;
}

.log-context {
  margin-top: 10px;
}

.log-context details {
  cursor: pointer;
}

.log-context summary {
  font-size: 12px;
  color: #6c63ff;
  font-weight: bold;
  padding: 5px 0;
}

.log-context pre {
  background: #f5f5f5;
  padding: 10px;
  border-radius: 4px;
  font-size: 11px;
  overflow-x: auto;
  margin-top: 5px;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 15px;
  padding: 20px 0;
}

.pagination-btn {
  padding: 8px 16px;
  background: #6c63ff;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  transition: background 0.3s;
}

.pagination-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.pagination-btn:not(:disabled):hover {
  background: #5a52d5;
}

.pagination-info {
  color: #666;
  font-size: 14px;
}

@media (max-width: 768px) {
  .admin-logs {
    padding: 10px;
  }

  .logs-header {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }

  h2 {
    font-size: 20px;
  }

  .filters {
    width: 100%;
  }

  .level-filter {
    flex: 1;
  }

  .refresh-btn {
    flex: 1;
  }

  .log-entry {
    padding: 10px;
  }

  .log-header {
    flex-wrap: wrap;
    gap: 8px;
  }

  .log-message {
    font-size: 13px;
  }

  .log-context pre {
    font-size: 10px;
  }

  .pagination {
    gap: 10px;
  }

  .pagination-btn {
    padding: 8px 12px;
    font-size: 13px;
  }

  .pagination-info {
    font-size: 12px;
  }
}
</style>
