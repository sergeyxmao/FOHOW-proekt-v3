import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

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
  // будут автоматически перенаправлены на ваш бэкенд-сервер,
  // запущенный на порту 4000.
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4000', // Адрес вашего бэкенд-сервера
        changeOrigin: true, // Необходимо для корректной работы прокси
      }
    }
  },

  // Явный формат имён — исправляет двойной хеш в lazy-loaded модулях (JS + CSS)
  build: {
    rollupOptions: {
      output: {
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
        entryFileNames: 'assets/[name]-[hash].js'
      }
    }
  }
})
