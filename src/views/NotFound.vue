<template>
  <div class="not-found">
    <h1 class="not-found__code">404</h1>
    <p class="not-found__text">Страница не найдена</p>
    <router-link to="/" class="not-found__link">Вернуться на главную</router-link>
  </div>
</template>

<script setup>
</script>

<style scoped>
.not-found {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  text-align: center;
  padding: 20px;
}

.not-found__code {
  font-size: 96px;
  font-weight: 700;
  margin: 0 0 16px;
  color: #333;
}

.not-found__text {
  font-size: 20px;
  color: #666;
  margin: 0 0 32px;
}

.not-found__link {
  font-size: 16px;
  color: #1a73e8;
  text-decoration: none;
}

.not-found__link:hover {
  text-decoration: underline;
}
</style>
