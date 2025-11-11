import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import PricingPage from '../views/PricingPage.vue'   // ✅ ПРЯМОЙ ИМПОРТ

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
      component: HomeView,
      meta: { requiresAuth: true }
    },

    // ✅ ТВОЙ МАРШРУТ ДОЛЖЕН БЫТЬ ЗДЕСЬ ВНУТРИ МАССИВА
    {
      path: '/pricing',
      name: 'pricing',
      component: PricingPage
    }
  ],
})

router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('token')

  if (to.meta.requiresAuth && !token) {
    return next('/')
  }

  next()
})

export default router
