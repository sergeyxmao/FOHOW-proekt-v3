import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import PricingPage from '../views/PricingPage.vue'
import EmailVerification from '../views/EmailVerification.vue'
import BoardsList from '../components/Board/BoardsList.vue'
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
    component: BoardsList,
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
    component: PricingPage,
    meta: { layout: 'public' } // Публичная страница без интерфейса приложения
  },
  {
    path: '/verify-email',
    name: 'verify-email',
    component: EmailVerification,
    meta: { layout: 'public' } // Публичная страница для подтверждения email
  },
  {
    path: '/admin',
    name: 'admin',
    component: () => import('../views/AdminPanel.vue'),
    meta: { requiresAuth: true, requiresAdmin: true, layout: 'admin' }
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

// Защита авторизации
router.beforeEach(async (to, from, next) => {
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

    // ОБЯЗАТЕЛЬНО вызвать loadUser и дождаться загрузки!
    await authStore.loadUser()

    console.log('[ROUTER] User after loadUser:', authStore.user)
    console.log('[ROUTER] User role:', authStore.user?.role)

    // Проверяем роль
    if (authStore.user?.role !== 'admin') {
      console.error('[ROUTER] Access denied. Role:', authStore.user?.role)
      next('/boards')   // редирект на доски если не админ
      return
    }

    console.log('[ROUTER] Admin access granted!')
  }

  next()
})

export default router
