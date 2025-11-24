<template>
  <div :class="['auth-card', props.isModernTheme ? 'auth-card--modern' : 'auth-card--classic']">
    <h2 class="auth-card__title">Регистрация</h2>
    <form class="auth-card__form" @submit.prevent="handleRegister">
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
          placeholder="Минимум 6 символов"
          minlength="6"
        />
      </div>

      <div class="auth-card__group">
        <label for="confirmPassword">Подтвердите пароль:</label>
        <input
          id="confirmPassword"
          v-model="confirmPassword"
          type="password"
          required
          placeholder="Повторите пароль"
        />
      </div>
      <div class="auth-card__group">
        <label for="registerVerification">Проверочный код:</label>
        <div class="auth-card__verification-row">
          <input
            id="registerVerification"
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
        </div>
        <button
          type="button"
          class="auth-card__verification-refresh"
          @click="regenerateVerificationCode"
          :disabled="verificationLoading"
        >
          Обновить код
        </button>
      </div>

      <div v-if="error" class="auth-card__message auth-card__message--error">{{ error }}</div>
      <div v-if="success" class="auth-card__message auth-card__message--success">{{ success }}</div>

      <button class="auth-card__submit" type="submit" :disabled="loading">
        {{ loading ? 'Регистрация...' : 'Зарегистрироваться' }}
      </button>

      <p class="auth-card__switch">
        Уже есть аккаунт?
        <a class="auth-card__link" @click="$emit('switch-to-login')">Войти</a>
      </p>
    </form>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'

const emit = defineEmits(['switch-to-login'])
const props = defineProps({
  isModernTheme: {
    type: Boolean,
    default: false
  }
})
const API_URL = import.meta.env.VITE_API_URL || 'https://interactive.marketingfohow.ru/api'

const authStore = useAuthStore()
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const error = ref('')
const success = ref('')
const loading = ref(false)
const verificationCode = ref('')
const verificationToken = ref('')
const verificationInput = ref('')
const verificationLoading = ref(false)

async function fetchVerificationCode(showError = true) {
  try {
    verificationLoading.value = true

    const response = await fetch(`${API_URL}/verification-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ previousToken: verificationToken.value || undefined })
    })

    if (!response.ok) {
      throw new Error('Не удалось получить проверочный код')
    }

    const data = await response.json()
    verificationCode.value = data.code
    verificationToken.value = data.token
    verificationInput.value = ''
  } catch (err) {
    if (showError) {
      error.value = err.message || 'Не удалось получить проверочный код'
    }
  } finally {
    verificationLoading.value = false
  }
}

function regenerateVerificationCode() {
  fetchVerificationCode()
}

onMounted(() => {
  fetchVerificationCode()
})
async function handleRegister() {
  error.value = ''
  success.value = ''
  
  if (password.value !== confirmPassword.value) {
    error.value = 'Пароли не совпадают'
    return
  }

  loading.value = true
  
  try {
    if (!verificationToken.value) {
      await fetchVerificationCode(false)
      throw new Error('Проверочный код недоступен. Попробуйте обновить код и повторить попытку.')
    }

    await authStore.register(
      email.value,
      password.value,
      verificationInput.value,
      verificationToken.value
    )
    success.value = 'Регистрация успешна! Теперь вы можете войти в систему.'

    // Перенаправление на форму входа после успешной регистрации
    setTimeout(() => {
      emit('switch-to-login')
    }, 2000)
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

.auth-card__message--success {
  color: var(--auth-success);
  background: var(--auth-success-bg);
  border-color: var(--auth-success-border);  
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

.auth-card__verification-row {
  display: flex;
  gap: 12px;
  align-items: center;
}

.auth-card__verification-code {
  min-width: 96px;
  padding: 12px 16px;
  text-align: center;
  font-weight: 700;
  letter-spacing: 0.4em;
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

.auth-card__checkbox {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  user-select: none;
}

.auth-card__checkbox input[type="checkbox"] {
  width: auto;
  margin: 0;
  cursor: pointer;
}

.auth-card__checkbox-text {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: var(--auth-text);
}

.auth-card__checkbox-icon {
  width: 18px;
  height: 18px;
  color: #0088cc;
}

.auth-card__hint {
  margin: 8px 0 0 0;
  font-size: 12px;
  color: var(--auth-muted);
  font-style: italic;
}
</style>
