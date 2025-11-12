import './assets/main.css'
import './assets/animations.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import i18n from './i18n'
import { useAuthStore } from './stores/auth'

// Эта функция будет запускать наше приложение
async function startApp() {
  const app = createApp(App)
  const pinia = createPinia()

  // Принудительно включить Vue Devtools для production-сборки
  app.config.devtools = true

  app.use(pinia)
  app.use(router)
  app.use(i18n)

  // --- Логика инициализации ДО монтирования ---
  // Получаем доступ к store ДО того, как приложение отрисуется
  const authStore = useAuthStore(pinia) 
  
  try {
    // Выполняем и ПОЛНОСТЬЮ ДОЖИДАЕМСЯ завершения init()
    await authStore.init()
  } catch (error) {
    console.error("Критическая ошибка при инициализации auth store:", error)
    // Здесь можно показать пользователю сообщение об ошибке, если что-то пошло не так
  }

  // --- Монтируем приложение ПОСЛЕ инициализации ---
  // Теперь, когда мы точно знаем, залогинен пользователь или нет, можно безопасно отрисовывать интерфейс
  app.mount('#app')
}

// Запускаем асинхронную функцию
startApp()
