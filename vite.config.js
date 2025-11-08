import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

export default defineConfig({
  base: '/',
  plugins: [
    vue(),
    vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },

  // --- ДОБАВЛЕННЫЙ БЛОК ДЛЯ ПРОКСИРОВАНИЯ API-ЗАПРОСОВ ---
  // Эта настройка решает проблему CORS в режиме разработки.
  // Все запросы из вашего Vue-приложения, которые начинаются с "/api",
  // будут автоматически перенаправлены на ваш бэкенд-сервер,
  // запущенный на порту 4000.
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4000', // Адрес вашего бэкенд-сервера
        changeOrigin: true, // Необходимо для корректной работы прокси
      }
    }
  }
})
