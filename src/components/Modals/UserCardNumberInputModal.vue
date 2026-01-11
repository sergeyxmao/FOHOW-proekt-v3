<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="isOpen" class="modal-overlay" @click="handleCancel">
        <div class="modal-content" @click.stop>
          <button class="modal-close" @click="handleCancel">✕</button>

          <div class="modal-body">
            <h2 class="modal-title">Введите компьютерный номер</h2>

            <div class="input-wrapper">
              <input
                ref="inputRef"
                v-model="personalId"
                type="text"
                class="modal-input"
                :class="{ 'modal-input--error': errorMessage }"
                placeholder="RUY00000000001"
                maxlength="50"
                @keyup.enter="handleConfirm"
                @keyup.escape="handleCancel"
                @input="clearError"
              >

              <div v-if="errorMessage" class="error-message">
                {{ errorMessage }}
              </div>
            </div>

            <div v-if="isLoading" class="loading-indicator">
              Проверка номера...
            </div>

            <div class="modal-actions">
              <button
                type="button"
                class="modal-btn modal-btn--cancel"
                @click="handleCancel"
                :disabled="isLoading"
              >
                Отмена
              </button>
              <button
                type="button"
                class="modal-btn modal-btn--confirm"
                @click="handleConfirm"
                :disabled="isLoading"
              >
                Применить
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, watch, nextTick, computed } from 'vue'
import { useAuthStore } from '../../stores/auth'

const props = defineProps({
  isOpen: {
    type: Boolean,
    required: true
  },
  userCardId: {
    type: String,
    default: null
  },
  currentPersonalId: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['close', 'apply'])

const personalId = ref('')
const inputRef = ref(null)
const isLoading = ref(false)
const errorMessage = ref('')

const authStore = useAuthStore()
const API_URL = import.meta.env.VITE_API_URL || 'https://interactive.marketingfohow.ru/api'

watch(() => props.isOpen, async (newVal) => {
  if (newVal) {
    personalId.value = props.currentPersonalId || ''
    errorMessage.value = ''
    isLoading.value = false
    await nextTick()
    inputRef.value?.focus()
  }
})

function clearError() {
  errorMessage.value = ''
}

function handleCancel() {
  if (!isLoading.value) {
    emit('close')
  }
}

async function handleConfirm() {
  if (isLoading.value) {
    return
  }

  const trimmedId = personalId.value.trim()

  // Если номер пустой, сбрасываем данные карточки
  if (!trimmedId) {
    emit('apply', {
      userCardId: props.userCardId,
      userData: null
    })
    emit('close')
    return
  }

  // Проверяем номер на сервере
  isLoading.value = true
  errorMessage.value = ''

  try {
    const response = await fetch(`${API_URL}/users/by-personal-id/${encodeURIComponent(trimmedId)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authStore.token}`,
        'Content-Type': 'application/json'
      }
    })

    const data = await response.json()

    if (!response.ok || !data.success) {
      // Обработка ошибок
      switch (data.error) {
        case 'NOT_FOUND':
          errorMessage.value = 'Пользователь с таким номером не найден'
          break
        case 'NOT_VERIFIED':
          errorMessage.value = 'Пользователь не верифицирован'
          break
        case 'SEARCH_DISABLED':
          errorMessage.value = 'Пользователь запретил поиск по компьютерному номеру'
          break
        default:
          errorMessage.value = 'Ошибка при проверке номера'
      }
      isLoading.value = false
      return
    }

    // Успешная валидация - применяем данные
    emit('apply', {
      userCardId: props.userCardId,
      userData: {
        personalId: trimmedId,
        id: data.user.id,
        username: data.user.username,
        avatarUrl: data.user.avatarUrl
      }
    })
    emit('close')
  } catch (error) {
    console.error('Ошибка при проверке номера:', error)
    errorMessage.value = 'Ошибка соединения. Попробуйте позже'
  } finally {
    isLoading.value = false
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.modal-content {
  background: white;
  border-radius: 12px;
  width: 400px;
  max-width: 90%;
  position: relative;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
}

.modal-close {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: #f5f5f5;
  font-size: 18px;
  cursor: pointer;
  transition: all 0.2s;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-close:hover {
  background: #e0e0e0;
  transform: rotate(90deg);
}

.modal-body {
  padding: 24px;
}

.modal-title {
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 20px 0;
  color: #111827;
  text-align: center;
}

.input-wrapper {
  margin-bottom: 16px;
}

.modal-input {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  font-size: 15px;
  color: #111827;
  transition: all 0.2s;
  box-sizing: border-box;
}

.modal-input:focus {
  outline: none;
  border-color: #5D8BF4;
  box-shadow: 0 0 0 3px rgba(93, 139, 244, 0.1);
}

.modal-input--error {
  border-color: #ef4444;
}

.modal-input--error:focus {
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
}

.modal-input::placeholder {
  color: #9ca3af;
}

.error-message {
  margin-top: 8px;
  font-size: 14px;
  color: #ef4444;
  text-align: left;
}

.loading-indicator {
  text-align: center;
  color: #6b7280;
  font-size: 14px;
  margin-bottom: 16px;
  padding: 8px;
}

.modal-actions {
  display: flex;
  gap: 12px;
  margin-top: 20px;
}

.modal-btn {
  flex: 1;
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.modal-btn--cancel {
  background: #f3f4f6;
  color: #374151;
}

.modal-btn--cancel:hover:not(:disabled) {
  background: #e5e7eb;
}

.modal-btn--confirm {
  background: #5D8BF4;
  color: white;
}

.modal-btn--confirm:hover:not(:disabled) {
  background: #4c7de7;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(93, 139, 244, 0.3);
}

.modal-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
