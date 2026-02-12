<template>
  <div class="payment-result">
    <div class="payment-result__icon payment-result__icon--success">&#10003;</div>
    <h1 class="payment-result__title">Оплата прошла успешно!</h1>
    <p class="payment-result__text">Ваша подписка активирована. Спасибо за оплату.</p>
    <router-link to="/boards" class="payment-result__link">Перейти к доскам</router-link>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()

onMounted(async () => {
  // Обновляем данные профиля, чтобы подписка отобразилась
  try {
    await authStore.fetchProfile()
  } catch (error) {
    console.error('Ошибка обновления профиля:', error)
  }
})
</script>

<style scoped>
.payment-result {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  text-align: center;
  padding: 20px;
}

.payment-result__icon {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40px;
  margin-bottom: 24px;
  color: #fff;
}

.payment-result__icon--success {
  background-color: #34a853;
}

.payment-result__title {
  font-size: 28px;
  font-weight: 700;
  margin: 0 0 12px;
  color: #333;
}

.payment-result__text {
  font-size: 18px;
  color: #666;
  margin: 0 0 32px;
}

.payment-result__link {
  display: inline-block;
  font-size: 16px;
  color: #fff;
  background-color: #1a73e8;
  padding: 12px 32px;
  border-radius: 8px;
  text-decoration: none;
  transition: background-color 0.2s;
}

.payment-result__link:hover {
  background-color: #1557b0;
}
</style>
