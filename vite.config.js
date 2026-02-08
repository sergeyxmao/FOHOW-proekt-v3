import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import dotenv from 'dotenv'

// Загружаем переменные окружения из .env.local
dotenv.config({ path: '.env.local' })

export default defineConfig({
  base: '/',
  plugins: [
    vue(),
    vueDevTools({
      // Принудительно включить devtools для всех режимов (включая production)
      enabled: true,
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },

  // Глобальные переменные для включения Vue Devtools в production
  define: {
    '__VUE_PROD_DEVTOOLS__': true,
    '__VUE_OPTIONS_API__': true,
    '__VUE_PROD_HYDRATION_MISMATCH_DETAILS__': false,
  },

  // --- ДОБАВЛЕННЫЙ БЛОК ДЛЯ ПРОКСИРОВАНИЯ API-ЗАПРОСОВ ---
  // Эта настройка решает проблему CORS в режиме разработки.
  // Все запросы из вашего Vue-приложения, которые начинаются с "/api",
  // будут автоматически перенаправлены на ваш бэкенд-сервер.
  // Адрес бэкенда можно настроить через переменную окружения API_PROXY_TARGET
  // в файле .env.local (по умолчанию: http://127.0.0.1:4000)
  server: {
    proxy: {
      '/api': {
        target: process.env.API_PROXY_TARGET || 'http://127.0.0.1:4000',
        changeOrigin: true,
        secure: false, // Для HTTPS прокси
      }
    }
  }
})
