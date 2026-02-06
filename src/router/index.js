import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import { useAuthStore } from '../stores/auth'

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
    alias: '/board',
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
    component: () => import('../views/PricingPage.vue'),
    meta: { layout: 'public' } // Публичная страница без интерфейса приложения
  },
  {
    path: '/verify-email',
    name: 'verify-email',
    component: () => import('../views/EmailVerification.vue'),
    meta: { layout: 'public' } // Публичная страница для подтверждения email
  },
  {
    path: '/admin',
    name: 'admin',
    component: () => import('../views/AdminPanel.vue'),
    meta: { requiresAuth: true, requiresAdmin: true, layout: 'admin' }
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('../views/NotFound.vue'),
    meta: { layout: 'public' }
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

// Защита авторизации
router.beforeEach(async (to, from, next) => {
  const token = localStorage.getItem('token')

  // Проверка авторизации
  if (to.meta.requiresAuth && !token) {
    next('/')     // возвращаем на главную если нет токена
    return
  }

  // Проверка роли администратора
  if (to.meta.requiresAdmin) {
    const authStore = useAuthStore()

    // ОБЯЗАТЕЛЬНО вызвать loadUser и дождаться загрузки!
    await authStore.loadUser()

    // Проверяем роль
    if (authStore.user?.role !== 'admin') {
      next('/boards')   // редирект на доски если не админ
      return
    }
  }

  next()
})

export default router
