import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import PricingPage from '../views/PricingPage.vue'
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
    component: PricingPage,
    meta: { layout: 'public' } // Публичная страница без интерфейса приложения
  },
  {
    path: '/admin',
    name: 'admin',
    component: () => import('../views/AdminPanel.vue'),
    meta: { requiresAuth: true, requiresAdmin: true }
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

// Защита авторизации
router.beforeEach((to, from, next) => {
  console.log('Навигация из:', from.path, '-> в:', to.path);
  const token = localStorage.getItem('token')

  // Проверка авторизации
  if (to.meta.requiresAuth && !token) {
    next('/')     // возвращаем на главную если нет токена
    return
  }

  // Проверка роли администратора
  if (to.meta.requiresAdmin) {
    const authStore = useAuthStore()
    if (!authStore.user || authStore.user.role !== 'admin') {
      console.warn('[ROUTER] Доступ запрещен: требуются права администратора')
      next('/boards')   // редирект на доски если не админ
      return
    }
  }

  next()
})

export default router
