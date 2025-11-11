import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
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
      component: HomeView, // Временно, позже создадим отдельный компонент
      meta: { requiresAuth: true }
    },
    {
      path: '/pricing',
      name: 'pricing',
      component: () => import('../views/PricingPage.vue'),
      meta: { layout: 'public' }
    }
  ],
})

// Защита маршрутов - требуется авторизация
router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('token')
  
  if (to.meta.requiresAuth && !token) {
    // Если нужна авторизация, но токена нет - на главную
    next('/')
  } else {
    next()
  }
})

export default router
