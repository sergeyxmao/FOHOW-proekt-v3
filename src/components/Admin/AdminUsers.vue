<template>
  <div class="admin-users">
    <div class="users-header">
      <h2>Управление пользователями</h2>
      <div class="search-box">
        <input
          v-model="searchQuery"
          @input="handleSearch"
          type="text"
          placeholder="Поиск по email, username или ID..."
          class="search-input"
        />
      </div>
    </div>

    <div v-if="adminStore.isLoading" class="loading">
      Загрузка пользователей...
    </div>

    <div v-else-if="users.length > 0" class="users-container">
      <div class="table-container">
        <table class="users-table">
          <thead>
            <tr>
              <th @click="sort('id')">ID</th>
              <th @click="sort('email')">Email</th>
              <th @click="sort('username')">Username</th>
              <th @click="sort('role')">Роль</th>
              <th @click="sort('plan_name')">Тариф</th>
              <th>Верифицирован</th>
              <th>Досок</th>
              <th>Сессий</th>
              <th @click="sort('created_at')">Создан</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in users" :key="user.id">
              <td>{{ user.id }}</td>
              <td>{{ user.email }}</td>
              <td>{{ user.username || '-' }}</td>
              <td>
                <span :class="['role-badge', user.role]">
                  {{ user.role === 'admin' ? 'Админ' : 'Пользователь' }}
                </span>
              </td>
              <td>{{ user.plan_name || '-' }}</td>
              <td>
                <span v-if="user.is_verified" class="verification-badge verified" title="Верифицирован">
                  ⭐ Да
                </span>
                <span v-else class="verification-badge not-verified">
                  Нет
                </span>
              </td>
              <td>{{ user.boards_count }}</td>
              <td>{{ user.active_sessions }}</td>
              <td>{{ formatDate(user.created_at) }}</td>
              <td>
                <button @click="viewUser(user.id)" class="btn btn-view">
                  Детали
                </button>
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
      Пользователи не найдены
    </div>

    <!-- Модальное окно деталей пользователя -->
    <div v-if="showUserModal" class="modal-overlay" @click="closeUserModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>Детали пользователя</h3>
          <button @click="closeUserModal" class="close-btn">&times;</button>
        </div>

        <div v-if="selectedUser" class="modal-body">
          <div class="user-info">
            <div class="info-row">
              <span class="label">ID:</span>
              <span class="value">{{ selectedUser.id }}</span>
            </div>
            <div class="info-row">
              <span class="label">Email:</span>
              <span class="value">{{ selectedUser.email }}</span>
            </div>
            <div class="info-row">
              <span class="label">Username:</span>
              <span class="value">{{ selectedUser.username || '-' }}</span>
            </div>
            <div class="info-row">
              <span class="label">Полное имя:</span>
              <span class="value">{{ selectedUser.full_name || '-' }}</span>
            </div>
            <div class="info-row">
              <span class="label">Телефон:</span>
              <span class="value">{{ selectedUser.phone || '-' }}</span>
            </div>
            <div class="info-row">
              <span class="label">Роль:</span>
              <span class="value">
                <span :class="['role-badge', selectedUser.role]">
                  {{ selectedUser.role === 'admin' ? 'Админ' : 'Пользователь' }}
                </span>
              </span>
            </div>
            <div class="info-row">
              <span class="label">Тариф:</span>
              <span class="value">{{ selectedUser.plan_name || '-' }}</span>
            </div>
            <div class="info-row">
              <span class="label">Досок:</span>
              <span class="value">{{ selectedUser.boards_count }}</span>
            </div>
            <div class="info-row">
              <span class="label">Активных сессий:</span>
              <span class="value">{{ selectedUser.active_sessions_count }}</span>
            </div>
            <div class="info-row">
              <span class="label">Создан:</span>
              <span class="value">{{ formatDateTime(selectedUser.created_at) }}</span>
            </div>
          </div>

          <div class="action-buttons">
            <button @click="changeRole" class="btn btn-primary">
              Изменить роль
            </button>
            <button @click="changePlan" class="btn btn-primary">
              Изменить тариф
            </button>
            <button @click="terminateSessions" class="btn btn-warning">
              Завершить сессии
            </button>
            <button @click="deleteUser" class="btn btn-danger">
              Удалить пользователя
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Модальное окно изменения роли -->
    <div v-if="showRoleModal" class="modal-overlay" @click="showRoleModal = false">
      <div class="modal-content small" @click.stop>
        <div class="modal-header">
          <h3>Изменить роль</h3>
          <button @click="showRoleModal = false" class="close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <select v-model="selectedRole" class="role-select">
            <option value="user">Пользователь</option>
            <option value="admin">Администратор</option>
          </select>
          <div class="modal-actions">
            <button @click="confirmRoleChange" class="btn btn-primary">
              Сохранить
            </button>
            <button @click="showRoleModal = false" class="btn btn-secondary">
              Отмена
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Модальное окно изменения тарифа -->
    <div v-if="showPlanModal" class="modal-overlay" @click="showPlanModal = false">
      <div class="modal-content small" @click.stop>
        <div class="modal-header">
          <h3>Изменить тариф</h3>
          <button @click="showPlanModal = false" class="close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <label>Выберите план:</label>
          <select v-model="selectedPlanId" class="plan-select">
            <option value="">Выберите тариф</option>
            <option v-for="plan in availablePlans" :key="plan.id" :value="plan.id">
              {{ plan.name }} ({{ plan.code_name }})
            </option>
          </select>
          <label>Длительность (дней):</label>
          <input
            v-model.number="planDuration"
            type="number"
            min="1"
            max="365"
            class="duration-input"
          />
          <div class="modal-actions">
            <button @click="confirmPlanChange" class="btn btn-primary">
              Сохранить
            </button>
            <button @click="showPlanModal = false" class="btn btn-secondary">
              Отмена
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAdminStore } from '../../stores/admin'
import { useSubscriptionStore } from '../../stores/subscription'

const adminStore = useAdminStore()
const subscriptionStore = useSubscriptionStore()

const searchQuery = ref('')
const sortBy = ref('created_at')
const sortOrder = ref('DESC')
const showUserModal = ref(false)
const showRoleModal = ref(false)
const showPlanModal = ref(false)
const selectedRole = ref('user')
const selectedPlanId = ref('')
const planDuration = ref(30)

const users = computed(() => adminStore.users)
const pagination = computed(() => adminStore.pagination)
const selectedUser = computed(() => adminStore.selectedUser)
const availablePlans = computed(() => subscriptionStore.plans)

let searchTimeout = null

onMounted(async () => {
  await loadUsers()
  await subscriptionStore.fetchPlans()
})

const loadUsers = async () => {
  try {
    await adminStore.fetchUsers({
      page: pagination.value.page,
      limit: pagination.value.limit,
      search: searchQuery.value,
      sortBy: sortBy.value,
      sortOrder: sortOrder.value
    })
  } catch (err) {
    console.error('[ADMIN] Ошибка загрузки пользователей:', err)
  }
}

const handleSearch = () => {
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    loadUsers()
  }, 500)
}

const sort = (field) => {
  if (sortBy.value === field) {
    sortOrder.value = sortOrder.value === 'ASC' ? 'DESC' : 'ASC'
  } else {
    sortBy.value = field
    sortOrder.value = 'ASC'
  }
  loadUsers()
}

const goToPage = async (page) => {
  if (page >= 1 && page <= pagination.value.totalPages) {
    try {
      await adminStore.fetchUsers({
        page,
        limit: pagination.value.limit,
        search: searchQuery.value,
        sortBy: sortBy.value,
        sortOrder: sortOrder.value
      })
    } catch (err) {
      console.error('[ADMIN] Ошибка пагинации:', err)
    }
  }
}

const viewUser = async (userId) => {
  try {
    await adminStore.fetchUserDetails(userId)
    showUserModal.value = true
  } catch (err) {
    console.error('[ADMIN] Ошибка загрузки деталей пользователя:', err)
  }
}

const closeUserModal = () => {
  showUserModal.value = false
  adminStore.clearSelectedUser()
}

const changeRole = () => {
  selectedRole.value = selectedUser.value.role
  showRoleModal.value = true
}

const confirmRoleChange = async () => {
  try {
    await adminStore.changeUserRole(selectedUser.value.id, selectedRole.value)
    showRoleModal.value = false
    await adminStore.fetchUserDetails(selectedUser.value.id)
    await loadUsers()
  } catch (err) {
    console.error('[ADMIN] Ошибка изменения роли:', err)
    alert('Ошибка изменения роли: ' + err.message)
  }
}

const changePlan = () => {
  selectedPlanId.value = selectedUser.value.plan_id || ''
  planDuration.value = 30
  showPlanModal.value = true
}

const confirmPlanChange = async () => {
  if (!selectedPlanId.value) {
    alert('Выберите тариф')
    return
  }
  try {
    await adminStore.changeUserPlan(selectedUser.value.id, selectedPlanId.value, planDuration.value)
    showPlanModal.value = false
    await adminStore.fetchUserDetails(selectedUser.value.id)
    await loadUsers()
  } catch (err) {
    console.error('[ADMIN] Ошибка изменения тарифа:', err)
    alert('Ошибка изменения тарифа: ' + err.message)
  }
}

const terminateSessions = async () => {
  if (!confirm(`Завершить все сессии пользователя ${selectedUser.value.email}?`)) {
    return
  }
  try {
    await adminStore.terminateUserSessions(selectedUser.value.id)
    await adminStore.fetchUserDetails(selectedUser.value.id)
    alert('Все сессии завершены')
  } catch (err) {
    console.error('[ADMIN] Ошибка завершения сессий:', err)
    alert('Ошибка завершения сессий: ' + err.message)
  }
}

const deleteUser = async () => {
  const email = selectedUser.value.email
  if (!confirm(`Вы уверены, что хотите удалить пользователя ${email}? Это действие нельзя отменить!`)) {
    return
  }
  if (!confirm(`Повторное подтверждение: удалить ${email}?`)) {
    return
  }
  try {
    await adminStore.deleteUser(selectedUser.value.id)
    closeUserModal()
    await loadUsers()
    alert('Пользователь удален')
  } catch (err) {
    console.error('[ADMIN] Ошибка удаления пользователя:', err)
    alert('Ошибка удаления пользователя: ' + err.message)
  }
}

const formatDate = (dateString) => {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleDateString('ru-RU')
}

const formatDateTime = (dateString) => {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleString('ru-RU')
}
</script>

<style scoped>
.admin-users {
  padding: 20px;
}

.users-header {
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

.search-box {
  flex: 1;
  max-width: 400px;
  margin-left: 20px;
}

.search-input {
  width: 100%;
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

.users-table {
  width: 100%;
  border-collapse: collapse;
  background: white;
  border-radius: 8px;
  overflow: hidden;
}

.users-table thead {
  background: #6c63ff;
  color: white;
}

.users-table th {
  padding: 12px 15px;
  text-align: left;
  cursor: pointer;
  user-select: none;
}

.users-table th:hover {
  background: #5a52d5;
}

.users-table td {
  padding: 12px 15px;
  border-top: 1px solid #eee;
}

.users-table tbody tr:hover {
  background: #f5f5f5;
}

.role-badge {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: bold;
}

.verification-badge {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}

.verification-badge.verified {
  background: linear-gradient(135deg, rgba(255, 215, 0, 0.2) 0%, rgba(255, 165, 0, 0.2) 100%);
  color: #FF8C00;
  border: 1px solid rgba(255, 215, 0, 0.5);
}

.verification-badge.not-verified {
  background: #f5f5f5;
  color: #999;
  border: 1px solid #e0e0e0;
}

.role-badge.admin {
  background: #ff6b6b;
  color: white;
}

.role-badge.user {
  background: #51cf66;
  color: white;
}

.btn {
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.3s;
}

.btn-view {
  background: #6c63ff;
  color: white;
}

.btn-view:hover {
  background: #5a52d5;
}

.btn-primary {
  background: #6c63ff;
  color: white;
}

.btn-primary:hover {
  background: #5a52d5;
}

.btn-secondary {
  background: #868e96;
  color: white;
}

.btn-secondary:hover {
  background: #6c757d;
}

.btn-warning {
  background: #ffd43b;
  color: #333;
}

.btn-warning:hover {
  background: #fcc419;
}

.btn-danger {
  background: #ff6b6b;
  color: white;
}

.btn-danger:hover {
  background: #fa5252;
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

/* Модальные окна */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 12px;
  max-width: 700px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
}

.modal-content.small {
  max-width: 400px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #eee;
}

.modal-header h3 {
  margin: 0;
  font-size: 20px;
}

.close-btn {
  background: none;
  border: none;
  font-size: 30px;
  cursor: pointer;
  color: #999;
  line-height: 1;
}

.close-btn:hover {
  color: #333;
}

.modal-body {
  padding: 20px;
}

.user-info {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 20px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid #f0f0f0;
}

.info-row .label {
  font-weight: bold;
  color: #666;
}

.info-row .value {
  color: #333;
}

.action-buttons {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 20px;
}

.action-buttons .btn {
  padding: 10px;
}

.role-select,
.plan-select,
.duration-input {
  width: 100%;
  padding: 10px;
  margin: 10px 0;
  border: 1px solid #ddd;
  border-radius: 5px;
  font-size: 14px;
}

.modal-actions {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

.modal-actions .btn {
  flex: 1;
  padding: 10px;
}

label {
  display: block;
  margin-top: 15px;
  margin-bottom: 5px;
  font-weight: bold;
  color: #666;
}

@media (max-width: 768px) {
  .admin-users {
    padding: 10px;
  }

  .users-header {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }

  h2 {
    font-size: 20px;
  }

  .search-box {
    max-width: 100%;
    margin-left: 0;
  }

  .table-container {
    overflow-x: scroll;
    -webkit-overflow-scrolling: touch;
  }

  .users-table {
    min-width: 700px;
  }

  .users-table th,
  .users-table td {
    padding: 8px 10px;
    font-size: 13px;
    white-space: nowrap;
  }

  .action-buttons {
    grid-template-columns: 1fr;
  }

  .modal-content {
    width: 95%;
    max-height: 95vh;
  }

  .modal-header {
    padding: 16px;
  }

  .modal-body {
    padding: 16px;
  }

  .info-row {
    flex-direction: column;
    gap: 4px;
  }
}
</style>
