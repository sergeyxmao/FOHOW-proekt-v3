<template>
  <div class="reset-password-form">
    <h2>Установка нового пароля</h2>
    
    <form v-if="!success" @submit.prevent="handleSubmit">
      <div class="form-group">
        <label for="password">Новый пароль:</label>
        <input
          id="password"
          v-model="password"
          type="password"
          required
          placeholder="Минимум 6 символов"
          minlength="6"
        />
      </div>
      
      <div class="form-group">
        <label for="confirmPassword">Подтвердите пароль:</label>
        <input
          id="confirmPassword"
          v-model="confirmPassword"
          type="password"
          required
          placeholder="Повторите пароль"
        />
      </div>
      
      <div v-if="error" class="error">{{ error }}</div>
      
      <button type="submit" :disabled="loading">
        {{ loading ? 'Сохранение...' : 'Сохранить новый пароль' }}
      </button>
    </form>
    
    <div v-else class="success-message">
      <div class="success-icon">✓</div>
      <h3>Пароль успешно изменен!</h3>
      <p>Теперь вы можете войти с новым паролем.</p>
      <button @click="$emit('go-to-login')">Перейти к входу</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'

const emit = defineEmits(['go-to-login'])

const API_URL = import.meta.env.VITE_API_URL || 'https://interactive.marketingfohow.ru/api'

const password = ref('')
const confirmPassword = ref('')
const error = ref('')
const success = ref(false)
const loading = ref(false)
const token = ref('')

onMounted(() => {
  // Получаем токен из URL
  const urlParams = new URLSearchParams(window.location.search)
  token.value = urlParams.get('token') || ''
  
  if (!token.value) {
    error.value = 'Токен не найден в ссылке'
  }
})

async function handleSubmit() {
  error.value = ''
  
  if (password.value !== confirmPassword.value) {
    error.value = 'Пароли не совпадают'
    return
  }
  
  loading.value = true
  
  try {
    const response = await fetch(`${API_URL}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        token: token.value,
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
  max-width: 400px;
  margin: 50px auto;
  padding: 30px;
  background: white;
  border-radius: 10px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

h2 {
  margin-bottom: 20px;
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
