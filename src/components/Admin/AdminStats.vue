<template>
  <div class="admin-stats">
    <h2>Статистика системы</h2>

    <div v-if="adminStore.isLoading" class="loading">
      Загрузка статистики...
    </div>

    <div v-else-if="stats" class="stats-container">
      <!-- Общая статистика -->
      <div class="stats-section">
        <h3>Общая статистика</h3>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">{{ stats.stats.total_users }}</div>
            <div class="stat-label">Всего пользователей</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ stats.stats.admin_users }}</div>
            <div class="stat-label">Администраторов</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ stats.stats.new_users_week }}</div>
            <div class="stat-label">Новых за неделю</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ stats.stats.new_users_month }}</div>
            <div class="stat-label">Новых за месяц</div>
          </div>
          <div class="stat-card stat-card--verification">
            <div class="stat-value">
              <span class="verification-icon">⭐</span>
              {{ stats.stats.verified_users || 0 }}
            </div>
            <div class="stat-label">Верифицированных</div>
          </div>
        </div>
      </div>

      <!-- Статистика контента -->
      <div class="stats-section">
        <h3>Контент</h3>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">{{ stats.stats.total_boards }}</div>
            <div class="stat-label">Досок</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ stats.stats.total_notes }}</div>
            <div class="stat-label">Заметок</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ stats.stats.total_stickers }}</div>
            <div class="stat-label">Стикеров</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ stats.stats.total_comments }}</div>
            <div class="stat-label">Комментариев</div>
          </div>
        </div>
      </div>

      <!-- Активность -->
      <div class="stats-section">
        <h3>Активность</h3>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">{{ stats.stats.active_sessions_count }}</div>
            <div class="stat-label">Активных сессий</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ stats.stats.active_users_hour }}</div>
            <div class="stat-label">Активных за час</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ stats.stats.active_users_day }}</div>
            <div class="stat-label">Активных за сутки</div>
          </div>
        </div>
      </div>

      <!-- Тарифные планы -->
      <div class="stats-section">
        <h3>Распределение по тарифам</h3>
        <div class="plans-table">
          <table>
            <thead>
              <tr>
                <th>Тариф</th>
                <th>Код</th>
                <th>Пользователей</th>
                <th>Процент</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="plan in stats.planStats" :key="plan.id">
                <td>{{ plan.name }}</td>
                <td><code>{{ plan.code_name }}</code></td>
                <td>{{ plan.users_count }}</td>
                <td>{{ calculatePercentage(plan.users_count) }}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- График регистраций -->
      <div class="stats-section">
        <h3>Регистрации за последние 30 дней</h3>
        <div class="registrations-chart">
          <div
            v-for="day in stats.registrationStats"
            :key="day.date"
            class="chart-bar"
            :style="{ height: calculateBarHeight(day.count) + 'px' }"
            :title="`${formatDate(day.date)}: ${day.count} регистраций`"
          >
            <span class="bar-label">{{ day.count }}</span>
          </div>
        </div>
      </div>

      <button @click="refreshStats" class="refresh-button">
        Обновить статистику
      </button>
    </div>

    <div v-else class="no-data">
      Нет данных для отображения
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useAdminStore } from '../../stores/admin'

const adminStore = useAdminStore()

const stats = computed(() => adminStore.stats)

const calculatePercentage = (count) => {
  if (!stats.value?.stats?.total_users) return 0
  return ((count / stats.value.stats.total_users) * 100).toFixed(1)
}

const calculateBarHeight = (count) => {
  if (!stats.value?.registrationStats) return 0
  const maxCount = Math.max(...stats.value.registrationStats.map(d => d.count))
  return maxCount > 0 ? (count / maxCount) * 150 : 0
}

const formatDate = (dateString) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

const refreshStats = async () => {
  try {
    await adminStore.fetchStats()
  } catch (err) {
    console.error('[ADMIN] Ошибка обновления статистики:', err)
  }
}
</script>

<style scoped>
.admin-stats {
  padding: 20px;
}

h2 {
  margin: 0 0 30px 0;
  color: #333;
  font-size: 24px;
}

h3 {
  margin: 0 0 20px 0;
  color: #555;
  font-size: 18px;
}

.loading {
  text-align: center;
  padding: 40px;
  color: #666;
  font-size: 16px;
}

.no-data {
  text-align: center;
  padding: 40px;
  color: #999;
  font-size: 16px;
}

.stats-container {
  display: flex;
  flex-direction: column;
  gap: 30px;
}

.stats-section {
  background: #f9f9f9;
  padding: 20px;
  border-radius: 8px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
}

.stat-card {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  text-align: center;
  transition: transform 0.2s;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

.stat-card--verification {
  background: linear-gradient(135deg, rgba(255, 215, 0, 0.1) 0%, rgba(255, 165, 0, 0.1) 100%);
  border: 2px solid rgba(255, 215, 0, 0.3);
}

.stat-card--verification .stat-value {
  color: #FF8C00;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.verification-icon {
  font-size: 32px;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
}

.stat-value {
  font-size: 32px;
  font-weight: bold;
  color: #6c63ff;
  margin-bottom: 10px;
}

.stat-label {
  font-size: 14px;
  color: #666;
}

.plans-table {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  background: white;
  border-radius: 8px;
  overflow: hidden;
}

thead {
  background: #6c63ff;
  color: white;
}

th, td {
  padding: 12px 15px;
  text-align: left;
}

tbody tr:nth-child(even) {
  background: #f5f5f5;
}

tbody tr:hover {
  background: #e8e8e8;
}

code {
  background: #e8e8e8;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: monospace;
  font-size: 12px;
}

.registrations-chart {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  height: 180px;
  background: white;
  padding: 20px;
  border-radius: 8px;
  gap: 2px;
}

.chart-bar {
  flex: 1;
  background: linear-gradient(to top, #6c63ff, #8b84ff);
  border-radius: 4px 4px 0 0;
  position: relative;
  cursor: pointer;
  transition: all 0.3s;
  min-width: 10px;
}

.chart-bar:hover {
  background: linear-gradient(to top, #5a52d5, #7a73e5);
}

.bar-label {
  position: absolute;
  top: -20px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 10px;
  color: #666;
  white-space: nowrap;
}

.refresh-button {
  width: 100%;
  padding: 12px;
  background: #6c63ff;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  cursor: pointer;
  transition: background 0.3s;
}

.refresh-button:hover {
  background: #5a52d5;
}

@media (max-width: 768px) {
  .admin-stats {
    padding: 10px;
  }

  h2 {
    font-size: 20px;
    margin-bottom: 20px;
  }

  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }

  .stat-card {
    padding: 14px;
  }

  .stat-value {
    font-size: 24px;
  }

  .stat-label {
    font-size: 12px;
  }

  .stats-section {
    padding: 14px;
  }

  .registrations-chart {
    height: 140px;
    padding: 14px;
  }
}

@media (max-width: 420px) {
  .stats-grid {
    grid-template-columns: 1fr;
    max-width: 280px;
    margin: 0 auto;
  }
}
</style>
