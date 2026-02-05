<template>
  <div class="auth-card">
    <h2 class="auth-card__title">Восстановление пароля</h2>
    <p class="auth-card__description">
      Введите email, который вы использовали при регистрации. 
      Мы отправим вам ссылку для сброса пароля.
    </p>
    
    <form class="auth-card__form" @submit.prevent="handleSubmit">
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
      
      <div v-if="error" class="auth-card__message auth-card__message--error">{{ error }}</div>
      <div v-if="success" class="auth-card__message auth-card__message--success">{{ success }}</div>
      
      <button class="auth-card__submit" type="submit" :disabled="loading || isOnCooldown">
        {{ buttonText }}
      </button>
      
      <p class="auth-card__switch">
        <a class="auth-card__link" @click="$emit('back-to-login')">← Вернуться к входу</a>
      </p>
    </form>
  </div>
</template>

<script setup>
import { ref, computed, onUnmounted } from 'vue'

const emit = defineEmits(['back-to-login'])
const props = defineProps({
  isModernTheme: {
    type: Boolean,
    default: false
  }
})

const API_URL = import.meta.env.VITE_API_URL || 'https://interactive.marketingfohow.ru/api'

const email = ref('')
const error = ref('')
const success = ref('')
const loading = ref(false)

// Countdown timer для cooldown
const cooldownSeconds = ref(0)
let cooldownInterval = null

const isOnCooldown = computed(() => cooldownSeconds.value > 0)

const buttonText = computed(() => {
  if (loading.value) return 'Отправка...'
  if (isOnCooldown.value) return `Подождите ${cooldownSeconds.value} сек`
  return 'Отправить ссылку'
})

function startCooldown(seconds) {
  cooldownSeconds.value = seconds

  if (cooldownInterval) clearInterval(cooldownInterval)

  cooldownInterval = setInterval(() => {
    cooldownSeconds.value--
    if (cooldownSeconds.value <= 0) {
      clearInterval(cooldownInterval)
      cooldownInterval = null
      error.value = '' // Очистить сообщение об ошибке
    }
  }, 1000)
}

// Очистка интервала при уничтожении компонента
onUnmounted(() => {
  if (cooldownInterval) {
    clearInterval(cooldownInterval)
    cooldownInterval = null
  }
})

async function handleSubmit() {
  error.value = ''
  success.value = ''
  loading.value = true

  try {
    const response = await fetch(`${API_URL}/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.value })
    })

    const data = await response.json()

    if (!response.ok) {
      // Если 429 с waitTime — запустить countdown (без сообщения об ошибке)
      if (response.status === 429 && data.waitTime) {
        startCooldown(data.waitTime)
        return
      }
      throw new Error(data.error || 'Ошибка отправки')
    }

    success.value = 'Инструкции отправлены на ваш email'
    email.value = ''
  } catch (err) {
    error.value = err.message
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
}

.auth-card__description {
  color: var(--auth-muted);
  font-size: 14px;
  text-align: center;
  line-height: 1.5;
  margin: 0;
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
  transition: all 0.2s ease;
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
  transition: all 0.2s ease;
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
  transition: color 0.2s ease;
}

.auth-card__link:hover {
  color: var(--auth-link-hover);
  text-decoration: underline;
}
</style>
