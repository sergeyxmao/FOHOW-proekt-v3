<template>
  <div class="payment-result">
    <div class="payment-result__icon payment-result__icon--fail">&#10007;</div>
    <h1 class="payment-result__title">Оплата не удалась</h1>
    <p class="payment-result__text">Попробуйте ещё раз или выберите другой способ оплаты.</p>
    <div class="payment-result__actions">
      <router-link to="/pricing" class="payment-result__link">Попробовать снова</router-link>
      <a href="https://t.me/MarketingFohow" target="_blank" rel="noopener noreferrer" class="payment-result__link payment-result__link--secondary">Связаться с поддержкой</a>
    </div>
  </div>
</template>

<script setup>
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

.payment-result__icon--fail {
  background-color: #ea4335;
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

.payment-result__actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
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

.payment-result__link--secondary {
  background-color: transparent;
  color: #1a73e8;
  border: 1px solid #1a73e8;
}

.payment-result__link--secondary:hover {
  background-color: #f0f4ff;
}
</style>
