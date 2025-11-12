import { createI18n } from 'vue-i18n'
import ru from './locales/ru.js'
import en from './locales/en.js'
import zh from './locales/zh.js'

// Получаем сохраненный язык из localStorage или используем браузерный по умолчанию
function getDefaultLocale() {
  const savedLocale = localStorage.getItem('locale')
  if (savedLocale && ['ru', 'en', 'zh'].includes(savedLocale)) {
    return savedLocale
  }

  // Определяем язык браузера
  const browserLang = navigator.language.toLowerCase()
  if (browserLang.startsWith('zh')) return 'zh'
  if (browserLang.startsWith('en')) return 'en'
  return 'ru' // русский по умолчанию
}

const i18n = createI18n({
  legacy: false, // Composition API mode
  locale: getDefaultLocale(),
  fallbackLocale: 'ru',
  messages: {
    ru,
    en,
    zh
  },
  globalInjection: true // Позволяет использовать $t в шаблонах
})

export default i18n
