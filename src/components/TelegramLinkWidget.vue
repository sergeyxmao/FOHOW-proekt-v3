<template>
  <div class="telegram-widget">
    <div class="telegram-widget__header">
      <h3 class="telegram-widget__title">
        <svg class="telegram-widget__icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161c-.18.717-3.146 14.338-3.146 14.338s-.194.764-.897.764c-.36 0-.668-.234-.668-.234l-3.478-2.702L6.3 18.918l-.6-2.04-2.897-1.11s-.896-.36-.896-1.08c0-.54.717-.897.717-.897l13.778-5.378s.897-.36.897 0z"/>
        </svg>
        Telegram Уведомления
      </h3>
      <p class="telegram-widget__description">
        Получайте уведомления о подписке и новостях через Telegram
      </p>
    </div>

    <!-- Если Telegram уже подключен -->
    <div v-if="isLinked" class="telegram-widget__linked">
      <div class="telegram-widget__status telegram-widget__status--success">
        <svg class="telegram-widget__status-icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
        </svg>
        <span>Telegram подключен</span>
      </div>
      <p class="telegram-widget__info">
        Username: <strong>@{{ displayUsername }}</strong>
      </p>
      <button class="telegram-widget__button telegram-widget__button--secondary" @click="unlinkTelegram">
        Отключить
      </button>
    </div>

    <!-- Если Telegram не подключен -->
    <div v-else class="telegram-widget__unlinked">
      <!-- Шаг 1: Генерация кода -->
      <div v-if="!linkCode" class="telegram-widget__step">
        <p class="telegram-widget__text">
          Нажмите кнопку ниже, чтобы получить код для привязки
        </p>
        <button
          class="telegram-widget__button telegram-widget__button--primary"
          @click="generateCode"
          :disabled="loading"
        >
          {{ loading ? 'Загрузка...' : 'Получить код' }}
        </button>
      </div>

      <!-- Шаг 2: Показ кода и инструкций -->
      <div v-else class="telegram-widget__step">
        <div class="telegram-widget__code-container">
          <div class="telegram-widget__code">
            {{ linkCode }}
          </div>
          <button
            class="telegram-widget__copy-button"
            @click="copyCode"
            :title="copied ? 'Скопировано!' : 'Копировать код'"
          >
            <svg v-if="!copied" viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
              <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
            </svg>
            <svg v-else viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
            </svg>
          </button>
        </div>

<div class="telegram-widget__instructions">
  <p class="telegram-widget__instructions-title">Как подключить:</p>
  <ol class="telegram-widget__instructions-list">
    <li>Откройте Telegram</li>
    <li>
      Найдите бота 
      <a href="https://t.me/fohow_Interactive_bot" target="_blank" style="color: #0088cc; text-decoration: none; font-weight: bold;">
        @fohow_Interactive_bot
      </a>
    </li>
    <li>Отправьте команду: <code>/start {{ linkCode }}</code></li>
  </ol>
  
  <div style="text-align: center; margin-top: 16px; padding: 12px; background: #f0f9ff; border-radius: 8px; border: 1px solid #0088cc;">
    <p style="margin: 0 0 8px 0; color: #666; font-size: 13px;">💡 Быстрый переход (только для первого запуска бота)</p>
    <a 
      :href="`https://t.me/fohow_Interactive_bot?start=${linkCode}`" 
      target="_blank"
      class="telegram-widget__connect-button"
      style="font-size: 14px; padding: 10px 24px;"
    >
      🚀 Открыть бота
    </a>
    <p style="margin: 8px 0 0 0; color: #999; font-size: 12px;">Если бот уже был запущен ранее, отправьте код вручную</p>
  </div>
</div>


        <div class="telegram-widget__status telegram-widget__status--waiting">
          <div class="telegram-widget__spinner"></div>
          <span>Ожидаем подключения...</span>
        </div>

        <button class="telegram-widget__button telegram-widget__button--secondary" @click="cancelLink">
          Отменить
        </button>
      </div>
    </div>

    <!-- Сообщение об ошибке -->
    <div v-if="error" class="telegram-widget__error">
      {{ error }}
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
const API_URL = import.meta.env.VITE_API_URL || 'https://interactive.marketingfohow.ru/api'

const isLinked = ref(false)
const telegramUsername = ref(null)
const linkCode = ref(null)
const botUsername = ref('fohow_Interactive_bot')
const loading = ref(false)
const error = ref(null)
const copied = ref(false)
let pollInterval = null

// Вычисляемое свойство для отображения username
// Приоритет: данные из API > данные из профиля > 'не указан'
const displayUsername = computed(() => {
  if (telegramUsername.value) {
    return telegramUsername.value
  }
  if (authStore.user?.telegram_user) {
    return authStore.user.telegram_user.replace(/^@/, '') // Убираем @ в начале, если есть
  }
  return 'не указан'
})

// Проверка статуса при загрузке
onMounted(async () => {
  await checkLinkStatus()
})

onUnmounted(() => {
  stopPolling()
})

// Проверка статуса подключения
async function checkLinkStatus() {
  try {
    const response = await fetch(`${API_URL}/user/telegram/check-link-status`, {
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    })

    if (response.ok) {
      const data = await response.json()
      isLinked.value = data.linked
      if (data.telegram) {
        telegramUsername.value = data.telegram.username
      }
    }
  } catch (err) {
    console.error('Ошибка проверки статуса Telegram:', err)
  }
}

// Генерация кода для привязки
async function generateCode() {
  loading.value = true
  error.value = null

  try {
    const response = await fetch(`${API_URL}/user/telegram/generate-code`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    })

    if (!response.ok) {
      throw new Error('Не удалось сгенерировать код')
    }

    const data = await response.json()
    linkCode.value = data.code
    botUsername.value = data.botUsername || 'fohow_Interactive_bot'

    // Начинаем polling для проверки статуса
    startPolling()
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

// Копирование кода
function copyCode() {
  if (linkCode.value) {
    navigator.clipboard.writeText(linkCode.value)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  }
}

// Отмена привязки
function cancelLink() {
  linkCode.value = null
  stopPolling()
}

// Отключение Telegram
async function unlinkTelegram() {
  if (!confirm('Вы уверены, что хотите отключить Telegram уведомления?')) {
    return
  }

  loading.value = true
  error.value = null

  try {
    const response = await fetch(`${API_URL}/user/telegram/unlink`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    })

    if (!response.ok) {
      throw new Error('Не удалось отключить Telegram')
    }

    // Успешно отключено
    isLinked.value = false
    telegramUsername.value = null
    alert('✅ Telegram успешно отключен')
    
  } catch (err) {
    error.value = err.message
    console.error('Ошибка отключения Telegram:', err)
  } finally {
    loading.value = false
  }
}

// Polling для проверки статуса подключения
function startPolling() {
  stopPolling()
  pollInterval = setInterval(async () => {
    await checkLinkStatus()
    if (isLinked.value) {
      stopPolling()
      linkCode.value = null
    }
  }, 3000) // Проверяем каждые 3 секунды
}

function stopPolling() {
  if (pollInterval) {
    clearInterval(pollInterval)
    pollInterval = null
  }
}
</script>

<style scoped>
.telegram-widget {
  background: var(--color-background-soft);
  border-radius: 12px;
  padding: 24px;
  max-width: 500px;
}

.telegram-widget__header {
  margin-bottom: 20px;
}

.telegram-widget__title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 8px 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--color-heading);
}

.telegram-widget__icon {
  width: 24px;
  height: 24px;
  color: #0088cc;
}

.telegram-widget__description {
  margin: 0;
  font-size: 14px;
  color: var(--color-text-muted);
}

.telegram-widget__linked,
.telegram-widget__unlinked {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.telegram-widget__status {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
}

.telegram-widget__status--success {
  background: #d4edda;
  color: #155724;
}

.telegram-widget__status--waiting {
  background: #fff3cd;
  color: #856404;
}

.telegram-widget__status-icon {
  width: 20px;
  height: 20px;
}

.telegram-widget__info {
  margin: 0;
  font-size: 14px;
  color: var(--color-text);
}

.telegram-widget__text {
  margin: 0 0 16px 0;
  font-size: 14px;
  color: var(--color-text);
}

.telegram-widget__code-container {
  display: flex;
  align-items: center;
  gap: 12px;
}

.telegram-widget__code {
  flex: 1;
  padding: 16px;
  background: var(--color-background);
  border: 2px dashed #0088cc;
  border-radius: 8px;
  font-size: 24px;
  font-weight: 700;
  text-align: center;
  letter-spacing: 0.2em;
  color: #0088cc;
  user-select: all;
}

.telegram-widget__copy-button {
  padding: 12px;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
}

.telegram-widget__copy-button:hover {
  background: var(--color-background-mute);
}

.telegram-widget__instructions {
  padding: 16px;
  background: var(--color-background);
  border-radius: 8px;
}

.telegram-widget__instructions-title {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-heading);
}

.telegram-widget__instructions-list {
  margin: 0;
  padding-left: 20px;
  font-size: 14px;
  color: var(--color-text);
}

.telegram-widget__instructions-list li {
  margin-bottom: 8px;
}

.telegram-widget__instructions-list code {
  padding: 2px 6px;
  background: var(--color-background-soft);
  border-radius: 4px;
  font-family: monospace;
}

.telegram-widget__button {
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.telegram-widget__button--primary {
  background: #0088cc;
  color: white;
}

.telegram-widget__button--primary:hover:not(:disabled) {
  background: #006ba1;
}

.telegram-widget__button--primary:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.telegram-widget__button--secondary {
  background: var(--color-background);
  color: var(--color-text);
  border: 1px solid var(--color-border);
}

.telegram-widget__button--secondary:hover {
  background: var(--color-background-mute);
}

.telegram-widget__connect-button {
  display: inline-block;
  padding: 12px 32px;
  background: linear-gradient(135deg, #0088cc 0%, #005580 100%);
  color: white;
  text-decoration: none;
  border-radius: 8px;
  font-weight: bold;
  font-size: 16px;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(0, 136, 204, 0.3);
}

.telegram-widget__connect-button:hover {
  background: linear-gradient(135deg, #0099dd 0%, #006690 100%);
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 136, 204, 0.4);
}

.telegram-widget__error {
  padding: 12px;
  background: #f8d7da;
  color: #721c24;
  border-radius: 8px;
  font-size: 14px;
  margin-top: 16px;
}

.telegram-widget__spinner {
  width: 16px;
  height: 16px;
  border: 2px solid transparent;
  border-top-color: currentColor;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
