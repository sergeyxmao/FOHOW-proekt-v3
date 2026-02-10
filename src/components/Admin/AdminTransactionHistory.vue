<template>
  <div class="admin-transactions">
    <div class="transactions-header">
      <h2>История транзакций</h2>
    </div>

    <!-- Фильтры -->
    <div class="filters-panel">
      <div class="filter-group">
        <label>Поиск по Email:</label>
        <input
          v-model="filters.search"
          @input="handleSearch"
          type="text"
          placeholder="Введите email пользователя..."
          class="filter-input"
        />
      </div>

      <div class="filter-group">
        <label>Дата от:</label>
        <input
          v-model="filters.dateFrom"
          @change="loadTransactions"
          type="date"
          class="filter-input"
        />
      </div>

      <div class="filter-group">
        <label>Дата до:</label>
        <input
          v-model="filters.dateTo"
          @change="loadTransactions"
          type="date"
          class="filter-input"
        />
      </div>

      <button @click="resetFilters" class="btn btn-secondary">
        Сбросить фильтры
      </button>
    </div>

    <div v-if="adminStore.isLoading" class="loading">
      Загрузка транзакций...
    </div>

    <div v-else-if="transactions.length > 0" class="transactions-container">
      <div class="table-container">
        <table class="transactions-table">
          <thead>
            <tr>
              <th>ID / Дата</th>
              <th>Пользователь</th>
              <th>Тариф</th>
              <th>Сумма</th>
              <th>Метод / Источник</th>
              <th>Период</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="transaction in transactions" :key="transaction.id">
              <!-- ID / Дата -->
              <td>
                <div class="id-date-cell">
                  <span class="transaction-id">#{{ transaction.id }}</span>
                  <span class="transaction-date">{{ formatDate(transaction.created_at) }}</span>
                </div>
              </td>

              <!-- Пользователь -->
              <td>
                <div v-if="transaction.user_email" class="user-cell">
                  <img
                    v-if="transaction.user_avatar"
                    :src="transaction.user_avatar"
                    :alt="transaction.user_email"
                    class="user-avatar"
                  />
                  <div v-else class="user-avatar-placeholder">
                    {{ getInitials(transaction.user_email) }}
                  </div>
                  <div class="user-info">
                    <a :href="`#user-${transaction.user_id}`" class="user-email">
                      {{ transaction.user_email }}
                    </a>
                    <span v-if="transaction.user_full_name" class="user-name">
                      {{ transaction.user_full_name }}
                    </span>
                  </div>
                </div>
                <div v-else class="deleted-user">
                  <span class="deleted-icon">👤</span>
                  <span class="deleted-text">Удаленный пользователь</span>
                </div>
              </td>

              <!-- Тариф -->
              <td>
                <div class="plan-cell">
                  <span class="plan-name">{{ transaction.plan_name || '-' }}</span>
                  <span v-if="transaction.plan_code" class="plan-code">
                    ({{ transaction.plan_code }})
                  </span>
                </div>
              </td>

              <!-- Сумма -->
              <td>
                <div class="amount-cell">
                  <span class="amount">{{ formatAmount(transaction.amount_paid) }}</span>
                  <span class="currency">{{ transaction.currency || 'RUB' }}</span>
                </div>
              </td>

              <!-- Метод / Источник -->
              <td>
                <div class="payment-info">
                  <span v-if="transaction.payment_method" class="payment-method">
                    {{ transaction.payment_method }}
                  </span>
                  <span class="payment-source">{{ transaction.source || '-' }}</span>
                </div>
              </td>

              <!-- Период -->
              <td>
                <div class="period-cell">
                  <div v-if="transaction.start_date">
                    <span class="period-label">c</span> {{ formatDate(transaction.start_date) }}
                  </div>
                  <div v-if="transaction.end_date">
                    <span class="period-label">до</span> {{ formatDate(transaction.end_date) }}
                  </div>
                  <div v-if="!transaction.start_date && !transaction.end_date">
                    -
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Пагинация -->
      <div class="pagination">
        <button
          @click="goToPage(pagination.page - 1)"
          :disabled="pagination.page === 1"
          class="pagination-btn"
        >
          Назад
        </button>
        <span class="pagination-info">
          Страница {{ pagination.page }} из {{ pagination.totalPages }}
          (Всего: {{ pagination.total }})
        </span>
        <button
          @click="goToPage(pagination.page + 1)"
          :disabled="pagination.page >= pagination.totalPages"
          class="pagination-btn"
        >
          Вперед
        </button>
      </div>
    </div>

    <div v-else class="no-data">
      Транзакции не найдены
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAdminStore } from '../../stores/admin'

const adminStore = useAdminStore()

const filters = ref({
  search: '',
  dateFrom: null,
  dateTo: null
})

const transactions = computed(() => adminStore.transactions)
const pagination = computed(() => adminStore.transactionsPagination)

let searchTimeout = null

onMounted(async () => {
  await loadTransactions()
})

const loadTransactions = async () => {
  try {
    await adminStore.fetchTransactions({
      page: pagination.value.page,
      limit: pagination.value.limit,
      search: filters.value.search,
      dateFrom: filters.value.dateFrom,
      dateTo: filters.value.dateTo
    })
  } catch (err) {
    console.error('[ADMIN] Ошибка загрузки транзакций:', err)
  }
}

const handleSearch = () => {
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    loadTransactions()
  }, 500)
}

const resetFilters = () => {
  filters.value = {
    search: '',
    dateFrom: null,
    dateTo: null
  }
  loadTransactions()
}

const goToPage = async (page) => {
  if (page >= 1 && page <= pagination.value.totalPages) {
    try {
      await adminStore.fetchTransactions({
        page,
        limit: pagination.value.limit,
        search: filters.value.search,
        dateFrom: filters.value.dateFrom,
        dateTo: filters.value.dateTo
      })
    } catch (err) {
      console.error('[ADMIN] Ошибка пагинации:', err)
    }
  }
}

const formatDate = (dateString) => {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
}

const formatAmount = (amount) => {
  if (!amount && amount !== 0) return '0.00'
  return parseFloat(amount).toFixed(2)
}

const getInitials = (email) => {
  if (!email) return '?'
  return email.substring(0, 2).toUpperCase()
}
</script>

<style scoped>
.admin-transactions {
  padding: 20px;
}

.transactions-header {
  margin-bottom: 20px;
}

h2 {
  margin: 0;
  font-size: 24px;
  color: #333;
}

.filters-panel {
  display: flex;
  gap: 15px;
  align-items: flex-end;
  margin-bottom: 20px;
  padding: 20px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
  flex: 1;
}

.filter-group label {
  font-size: 13px;
  font-weight: 600;
  color: #666;
}

.filter-input {
  padding: 10px 15px;
  border: 1px solid #ddd;
  border-radius: 5px;
  font-size: 14px;
}

.loading, .no-data {
  text-align: center;
  padding: 40px;
  color: #666;
  font-size: 16px;
}

.table-container {
  overflow-x: auto;
  margin-bottom: 20px;
}

.transactions-table {
  width: 100%;
  border-collapse: collapse;
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.transactions-table thead {
  background: #6c63ff;
  color: white;
}

.transactions-table th {
  padding: 12px 15px;
  text-align: left;
  font-weight: 600;
}

.transactions-table td {
  padding: 12px 15px;
  border-top: 1px solid #eee;
}

.transactions-table tbody tr:hover {
  background: #f5f5f5;
}

.id-date-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.transaction-id {
  font-weight: bold;
  color: #333;
}

.transaction-date {
  font-size: 12px;
  color: #999;
}

.user-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.user-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
}

.user-avatar-placeholder {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #6c63ff;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 14px;
}

.user-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.user-email {
  color: #6c63ff;
  text-decoration: none;
  font-weight: 600;
}

.user-email:hover {
  text-decoration: underline;
}

.user-name {
  font-size: 12px;
  color: #999;
}

.deleted-user {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #999;
  font-style: italic;
}

.deleted-icon {
  font-size: 20px;
  opacity: 0.5;
}

.deleted-text {
  font-size: 14px;
}

.plan-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.plan-name {
  font-weight: 600;
  color: #333;
}

.plan-code {
  font-size: 12px;
  color: #999;
}

.amount-cell {
  display: flex;
  align-items: baseline;
  gap: 5px;
}

.amount {
  font-weight: bold;
  font-size: 16px;
  color: #2ecc71;
}

.currency {
  font-size: 12px;
  color: #999;
}

.payment-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.payment-method {
  font-weight: 600;
  color: #333;
  font-size: 13px;
}

.payment-source {
  font-size: 12px;
  color: #999;
  padding: 2px 8px;
  background: #f0f0f0;
  border-radius: 3px;
  display: inline-block;
  width: fit-content;
}

.period-cell {
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 13px;
}

.period-label {
  font-size: 11px;
  color: #999;
  margin-right: 3px;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.3s;
}

.btn-secondary {
  background: #868e96;
  color: white;
}

.btn-secondary:hover {
  background: #6c757d;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 15px;
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
  .admin-transactions {
    padding: 10px;
  }

  h2 {
    font-size: 20px;
  }

  .filters-panel {
    flex-direction: column;
    padding: 14px;
    gap: 10px;
  }

  .btn {
    width: 100%;
  }

  .table-container {
    overflow-x: scroll;
    -webkit-overflow-scrolling: touch;
  }

  .transactions-table {
    min-width: 600px;
  }

  .transactions-table th,
  .transactions-table td {
    padding: 8px 10px;
    font-size: 13px;
    white-space: nowrap;
  }

  .pagination {
    gap: 10px;
  }

  .pagination-btn {
    padding: 8px 12px;
    font-size: 13px;
  }
}
</style>
