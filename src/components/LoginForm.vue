<template>
  <div :class="['auth-card', props.isModernTheme ? 'auth-card--modern' : 'auth-card--classic']">
    <h2 class="auth-card__title">Вход</h2>
    <form class="auth-card__form" @submit.prevent="handleLogin">
      <div class="auth-card__group">
        <label for="email">Email:</label>
        <input
          id="email"
          v-model="email"
          type="email"
          required
          placeholder="example@email.com"
        />
      </div>

      <div class="auth-card__group">
        <label for="password">Пароль:</label>
        <input
          id="password"
          v-model="password"
          type="password"
          required
          placeholder="••••••••"
        />
      </div>
      <div class="auth-card__group">
        <label for="verification">Проверочный код:</label>
        <input
          id="verification"
          v-model="verificationInput"
          type="text"
          inputmode="numeric"
          maxlength="4"
          required
          placeholder="Введите код"
        />
        <div class="auth-card__verification-code" @click="regenerateVerificationCode">
          {{ verificationLoading ? '••••' : verificationCode }}
        </div>
        <button
          type="button"
          class="auth-card__verification-refresh"
          @click="regenerateVerificationCode"
          :disabled="verificationLoading || refreshCooldown > 0"
        >
          {{ refreshCooldown > 0 ? `Обновить код (${refreshCooldown}с)` : 'Обновить код' }}
        </button>
      </div>
      <div v-if="error" class="auth-card__message auth-card__message--error">{{ error }}</div>

      <button class="auth-card__submit" type="submit" :disabled="loading">
        {{ loading ? 'Вход...' : 'Войти' }}
      </button>

<p class="forgot-password-link">
  <a @click="$emit('switch-to-forgot')">Забыли пароль?</a>
</p>

<p class="switch-form">
  Нет аккаунта? <a @click="$emit('switch-to-register')">Зарегистрироваться</a>
</p>
    </form>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const emit = defineEmits(['login-success', 'switch-to-register', 'switch-to-forgot'])
const props = defineProps({
  isModernTheme: {
    type: Boolean,
    default: false
  }
})
const router = useRouter()
const API_URL = import.meta.env.VITE_API_URL || 'https://interactive.marketingfohow.ru/api'

const authStore = useAuthStore()
const email = ref('')
const password = ref('')
const verificationCode = ref('')
const verificationToken = ref('')
const verificationInput = ref('')
const error = ref('')
const loading = ref(false)
const verificationLoading = ref(false)
const refreshCooldown = ref(0)
const refreshCooldownTimer = ref(null)

async function fetchVerificationCode(showError = true) {
  try {
    verificationLoading.value = true

    const response = await fetch(`${API_URL}/verification-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ previousToken: verificationToken.value || undefined })
    })

    if (response.status === 429) {
      const data = await response.json().catch(() => null)
      const retryAfter = data?.retryAfter || 60
      error.value = `Слишком много запросов. Подождите ${retryAfter} сек.`
      refreshCooldown.value = retryAfter
      if (refreshCooldownTimer.value) clearInterval(refreshCooldownTimer.value)
      refreshCooldownTimer.value = setInterval(() => {
        refreshCooldown.value--
        if (refreshCooldown.value <= 0) {
          clearInterval(refreshCooldownTimer.value)
          refreshCooldownTimer.value = null
          error.value = ''
        }
      }, 1000)
      return
    }

    const data = await response.json().catch(() => null)

    if (!response.ok) {
      throw new Error(data?.message || 'Не удалось получить проверочный код')
    }

    if (!data?.code || !data?.token) {
      throw new Error('Некорректный ответ сервера. Попробуйте обновить код.')
    }

    verificationCode.value = data.code
    verificationToken.value = data.token
    verificationInput.value = ''
    error.value = ''
  } catch (err) {
    verificationCode.value = ''
    verificationToken.value = ''
    verificationInput.value = ''
    if (showError) {
      error.value = err.message || 'Не удалось получить проверочный код'
    }
  } finally {
    verificationLoading.value = false
  }
}

function regenerateVerificationCode() {
  if (verificationLoading.value || refreshCooldown.value > 0) return
  fetchVerificationCode()
  startRefreshCooldown()
}

function startRefreshCooldown() {
  refreshCooldown.value = 10
  if (refreshCooldownTimer.value) clearInterval(refreshCooldownTimer.value)
  refreshCooldownTimer.value = setInterval(() => {
    refreshCooldown.value--
    if (refreshCooldown.value <= 0) {
      clearInterval(refreshCooldownTimer.value)
      refreshCooldownTimer.value = null
    }
  }, 1000)
}

onMounted(() => {
  fetchVerificationCode()
})

onUnmounted(() => {
  if (refreshCooldownTimer.value) {
    clearInterval(refreshCooldownTimer.value)
  }
})
async function handleLogin() {
  error.value = ''
  loading.value = true

  try {
    if (!verificationToken.value) {
      await fetchVerificationCode(false)
      throw new Error('Проверочный код недоступен. Попробуйте обновить код и повторить попытку.')
    }

    const result = await authStore.login(
      email.value,
      password.value,
      verificationInput.value,
      verificationToken.value
    )

    // Проверить, требуется ли верификация email
    if (result && result.requiresVerification) {
      // Перенаправить на страницу верификации
      router.push('/verify-email')
      return
    }

    // Обычный вход - emit успешного входа
    emit('login-success')
  } catch (err) {
    error.value = err.message
    await fetchVerificationCode(false)
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.auth-card {
  width: 100%;
  max-width: 420px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  color: var(--auth-text);
}

.auth-card__title {
  margin: 0;
  text-align: center;
  font-size: 26px;
  font-weight: 700;
  color: var(--auth-heading);
  letter-spacing: -0.01em;
}

.auth-card__form {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.auth-card__group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

label {
  font-size: 14px;
  font-weight: 600;
  color: var(--auth-muted);
}

input {
  width: 100%;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid var(--auth-input-border);
  background: var(--auth-input-bg);
  color: var(--auth-text);
  font-size: 15px;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease,
    color 0.2s ease;
}

input::placeholder {
  color: var(--auth-input-placeholder);
}

input:focus {
  outline: none;
  border-color: var(--auth-input-focus-border);
  box-shadow: 0 0 0 3px var(--auth-input-focus-ring);
}

.auth-card__message {
  font-size: 14px;
  font-weight: 500;
  padding: 10px 12px;
  border-radius: 12px;
  text-align: center;
  background: transparent;
  border: 1px solid transparent;  
}

.auth-card__message--error {
  color: var(--auth-error);
  background: var(--auth-error-bg);
  border-color: var(--auth-error-border);
}

.auth-card__submit {
  width: 100%;
  padding: 14px;
  background: var(--auth-primary);
  color: #fff;
  border: none;
  border-radius: 14px;
  font-size: 16px;
  font-weight: 700;  
  cursor: pointer;
  transition: background 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
  box-shadow: 0 18px 34px var(--auth-primary-shadow);
}

.auth-card__submit:hover:not(:disabled) {
  background: var(--auth-primary-hover);
  transform: translateY(-1px);
}

.auth-card__submit:disabled {
  cursor: not-allowed;
  background: var(--auth-primary-disabled);
  box-shadow: none;  
}

.auth-card__switch {
  margin: 0;
  text-align: center;
  font-size: 14px;
  color: var(--auth-muted);  
}

.auth-card__link {
  color: var(--auth-link);
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
  margin-left: 6px;
  transition: color 0.2s ease;
}

.auth-card__link:hover {
  color: var(--auth-link-hover);
  text-decoration: underline;
}

.auth-card__verification-code {
  width: 100%;
  padding: 16px;
  text-align: center;
  font-size: 26px;
  font-weight: 700;
  letter-spacing: 0.8em;
  background: var(--auth-input-bg);
  border: 1px solid var(--auth-input-border);
  border-radius: 12px;
  cursor: pointer;
  user-select: none;
}

.auth-card__verification-code:hover {
  border-color: var(--auth-input-focus-border);
}

.auth-card__verification-refresh {
  margin-top: 8px;
  align-self: flex-start;
  background: none;
  border: none;
  color: var(--auth-link);
  font-weight: 600;
  cursor: pointer;
  padding: 0;
  transition: color 0.2s ease, opacity 0.2s ease;  
}

.auth-card__verification-refresh:hover:not(:disabled) {
  text-decoration: underline;
}

.auth-card__verification-refresh:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
.forgot-password-link {
  text-align: center;
  margin-top: 10px;
  font-size: 14px;
}

.forgot-password-link a {
  color: #666;
  cursor: pointer;
  text-decoration: underline;
}

.forgot-password-link a:hover {
  color: #4CAF50;
}
.switch-form {
  text-align: center;
  margin-top: 5px;
  font-size: 14px;
  color: var(--auth-muted, #666);
}

.switch-form a {
  color: var(--auth-link, #2196F3);
  cursor: pointer;
  text-decoration: underline;
  font-weight: 600;
}

.switch-form a:hover {
  color: var(--auth-link-hover, #0b7dda);
}  
</style>
