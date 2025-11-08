    import './assets/main.css'

    import { createApp } from 'vue'
    import { createPinia } from 'pinia'
    import App from './App.vue'
    import { useAuthStore } from './stores/auth' // <-- 1. Импортируем authStore

    // Эта функция будет запускать наше приложение
    async function startApp() {
      const app = createApp(App)
      const pinia = createPinia()

      app.use(pinia)

      // --- 2. Логика инициализации ДО монтирования ---
      // Получаем доступ к store ДО того, как приложение отрисуется
      const authStore = useAuthStore(pinia) 
      
      try {
        // Выполняем и ПОЛНОСТЬЮ ДОЖИДАЕМСЯ завершения init()
        await authStore.init()
      } catch (error) {
        console.error("Критическая ошибка при инициализации auth store:", error)
        // Здесь можно показать пользователю сообщение об ошибке, если что-то пошло не так
      }

      // --- 3. Монтируем приложение ПОСЛЕ инициализации ---
      // Теперь, когда мы точно знаем, залогинен пользователь или нет, можно безопасно отрисовывать интерфейс
      app.mount('#app')
    }

    // Запускаем асинхронную функцию
    startApp()
