import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import PricingPage from '../views/PricingPage.vue'

const routes = [
  {
    path: '/',
    name: 'home',
    component: HomeView,
  },
  {
    path: '/boards',
    name: 'boards',
    component: () => import('../components/Board/BoardsList.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/board/:id',
    name: 'board',
    component: HomeView, // Временно
    meta: { requiresAuth: true }
  },
  {
    path: '/pricing',
    name: 'pricing',
    component: PricingPage // Можно также через () => import('../views/PricingPage.vue')
    // публичная
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

// Защита авторизации
router.beforeEach((to, from, next) => {
  console.log('Навигация из:', from.path, '-> в:', to.path);
  // debugger; // Только для отладки! На проде убирай!
  const token = localStorage.getItem('token')
  if (to.meta.requiresAuth && !token) {
    next('/')     // возвращаем на главную если нет токена
  } else {
    next()
  }
})

export default router
