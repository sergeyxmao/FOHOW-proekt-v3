import { createRouter, createWebHistory } from 'vue-router'

const HomeView = { template: '<h1>HOME PAGE</h1>' }
const PricingTest = { template: '<h1>ПРИЦИНГ ПУБЛИК ✅</h1>' }
const TestPage = { template: '<h1>ТЕСТ СТРАНИЦА ✅</h1>' }

const routes = [
  { path: '/', name: 'home', component: HomeView },
  { path: '/pricing', name: 'pricing', component: PricingTest },
  { path: '/test', name: 'test', component: TestPage }
]

export default createRouter({
  history: createWebHistory('/'),
  routes
})
