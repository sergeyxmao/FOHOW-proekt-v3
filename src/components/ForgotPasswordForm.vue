<template>
  <div class="forgot-password-form">
    <h2>Восстановление пароля</h2>
    <p class="description">
      Введите email, который вы использовали при регистрации. 
      Мы отправим вам ссылку для сброса пароля.
    </p>
    
    <form @submit.prevent="handleSubmit">
      <div class="form-group">
        <label for="email">Email:</label>
        <input
          id="email"
          v-model="email"
          type="email"
          required
          placeholder="example@email.com"
        />
      </div>
      
      <div v-if="error" class="error">{{ error }}</div>
      <div v-if="success" class="success">{{ success }}</div>
      
      <button type="submit" :disabled="loading">
        {{ loading ? 'Отправка...' : 'Отправить ссылку' }}
      </button>
      
      <p class="back-to-login">
        <a @click="$emit('back-to-login')">← Вернуться к входу</a>
      </p>
    </form>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const emit = defineEmits(['back-to-login'])

const API_URL = import.meta.env.VITE_API_URL || 'https://interactive.marketingfohow.ru/api'

const email = ref('')
const error = ref('')
const success = ref('')
const loading = ref(false)

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
.forgot-password-form {
  max-width: 400px;
  margin: 50px auto;
  padding: 30px;
  background: white;
  border-radius: 10px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

h2 {
  margin-bottom: 10px;
  text-align: center;
}

.description {
  color: #666;
  font-size: 14px;
  margin-bottom: 20px;
  text-align: center;
  line-height: 1.5;
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

.success {
  color: green;
  margin: 10px 0;
  font-size: 14px;
}

.back-to-login {
  text-align: center;
  margin-top: 15px;
}

.back-to-login a {
  color: #4CAF50;
  cursor: pointer;
  text-decoration: none;
}

.back-to-login a:hover {
  text-decoration: underline;
}
</style>
