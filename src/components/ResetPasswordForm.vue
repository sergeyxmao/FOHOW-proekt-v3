<template>
  <div class="reset-password-form">
    <h2>{{ t('auth.resetPasswordTitle') }}</h2>
    
    <form v-if="!success" @submit.prevent="handleSubmit">
      <div class="form-group">
        <label for="password">{{ t('auth.newPassword') }}</label>
        <input
          id="password"
          v-model="password"
          type="password"
          required
          :placeholder="t('auth.minChars')"
          minlength="6"
        />
      </div>
      
      <div class="form-group">
        <label for="confirmPassword">{{ t('auth.repeatPassword') }}</label>
        <input
          id="confirmPassword"
          v-model="confirmPassword"
          type="password"
          required
          :placeholder="t('auth.repeatPassword')"
        />
      </div>
      
      <div v-if="error" class="error">{{ error }}</div>
      
      <button type="submit" :disabled="loading">
        {{ loading ? t('auth.savingPassword') : t('auth.saveNewPassword') }}
      </button>
    </form>
    
    <div v-else class="success-message">
      <div class="success-icon">✓</div>
      <h3>{{ t('auth.passwordChanged') }}</h3>
      <p>{{ t('auth.canLoginNow') }}</p>
      <button @click="$emit('success')">{{ t('auth.done') }}</button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps({
  token: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['success'])

const API_URL = import.meta.env.VITE_API_URL || 'https://interactive.marketingfohow.ru/api'

const password = ref('')
const confirmPassword = ref('')
const error = ref('')
const success = ref(false)
const loading = ref(false)

async function handleSubmit() {
  error.value = ''
  
  if (password.value !== confirmPassword.value) {
    error.value = t('auth.passwordsDoNotMatch')
    return
  }
  
  if (!props.token) {
    error.value = 'Токен не найден'
    return
  }
  
  loading.value = true
  
  try {
    const response = await fetch(`${API_URL}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        token: props.token,
        newPassword: password.value 
      })
    })
    
    const data = await response.json()
    
    if (!response.ok) {
      throw new Error(data.error || 'Ошибка сброса пароля')
    }
    
    success.value = true
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.reset-password-form {
  padding: 30px;
}

h2 {
  margin: 0 0 20px 0;
  text-align: center;
}

.form-group {
  margin-bottom: 15px;
}

label {
  display: block;
  margin-bottom: 5px;
  font-weight: 500;
}

input {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 5px;
  font-size: 14px;
  box-sizing: border-box;
}

button {
  width: 100%;
  padding: 12px;
  background: #4CAF50;
  color: white;
  border: none;
  border-radius: 5px;
  font-size: 16px;
  cursor: pointer;
  margin-top: 10px;
}

button:hover {
  background: #45a049;
}

button:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.error {
  color: red;
  margin: 10px 0;
  font-size: 14px;
}

.success-message {
  text-align: center;
}

.success-icon {
  width: 60px;
  height: 60px;
  line-height: 60px;
  border-radius: 50%;
  background: #4CAF50;
  color: white;
  font-size: 36px;
  margin: 0 auto 20px;
}

.success-message h3 {
  color: #4CAF50;
  margin-bottom: 10px;
}

.success-message p {
  color: #666;
  margin-bottom: 20px;
}
</style>
