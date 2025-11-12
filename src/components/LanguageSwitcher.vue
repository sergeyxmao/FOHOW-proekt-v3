<template>
  <div class="language-switcher">
    <button
      v-for="lang in languages"
      :key="lang.code"
      :class="['lang-btn', { active: currentLocale === lang.code }]"
      @click="changeLanguage(lang.code)"
      :title="lang.name"
    >
      {{ lang.flag }} {{ lang.short }}
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { locale } = useI18n()

const languages = [
  { code: 'ru', name: 'Русский', short: 'RU', flag: '🇷🇺' },
  { code: 'en', name: 'English', short: 'EN', flag: '🇬🇧' },
  { code: 'zh', name: '中文', short: 'CN', flag: '🇨🇳' }
]

const currentLocale = computed(() => locale.value)

function changeLanguage(langCode) {
  locale.value = langCode
  localStorage.setItem('locale', langCode)
}
</script>

<style scoped>
.language-switcher {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.lang-btn {
  padding: 0.5rem 0.75rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: white;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.lang-btn:hover {
  background: #f5f5f5;
  border-color: #999;
}

.lang-btn.active {
  background: #4CAF50;
  color: white;
  border-color: #4CAF50;
}

.lang-btn.active:hover {
  background: #45a049;
}

/* Темная тема */
:root.dark .lang-btn {
  background: #333;
  border-color: #555;
  color: #ddd;
}

:root.dark .lang-btn:hover {
  background: #444;
  border-color: #777;
}

:root.dark .lang-btn.active {
  background: #4CAF50;
  color: white;
  border-color: #4CAF50;
}
</style>
