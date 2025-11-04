<template>
  <div class="avatar-wrapper" :style="{ width: `${displaySize}px`, height: `${displaySize}px` }">
    <picture v-if="avatarMeta && avatarMeta.rev" class="avatar-picture">
      <source
        v-for="format in ['avif', 'webp']"
        :key="format"
        :type="`image/${format}`"
        :srcset="buildSrcSet(format)"
        :sizes="sizesAttr"
      />
      <img
        :src="getFallbackUrl()"
        :alt="alt"
        :width="displaySize"
        :height="displaySize"
        class="avatar-img"
        loading="lazy"
        @error="handleImageError"
      />
    </picture>
    <div v-else class="avatar-placeholder">
      {{ getInitials() }}
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  avatarMeta: {
    type: Object,
    default: null
  },
  username: {
    type: String,
    default: ''
  },
  email: {
    type: String,
    default: ''
  },
  size: {
    type: Number,
    default: 128 // размер по умолчанию
  },
  alt: {
    type: String,
    default: 'Avatar'
  }
});

// API base URL
const API_URL = import.meta.env.VITE_API_URL || 'https://interactive.marketingfohow.ru';

// Определяем наилучший размер на основе DPR и запрошенного размера
const displaySize = computed(() => props.size);

const bestSize = computed(() => {
  if (!props.avatarMeta || !props.avatarMeta.sizes) return 128;

  const dpr = window.devicePixelRatio || 1;
  const targetSize = props.size * dpr;

  // Находим ближайший больший размер
  const sizes = props.avatarMeta.sizes.sort((a, b) => a - b);
  const best = sizes.find(s => s >= targetSize) || sizes[sizes.length - 1];

  return best;
});

// Строим srcset для адаптивной загрузки
function buildSrcSet(format) {
  if (!props.avatarMeta || !props.avatarMeta.sizes) return '';

  const ext = format === 'jpg' ? 'jpg' : format;
  const srcset = props.avatarMeta.sizes
    .map(size => {
      const url = `${API_URL}${props.avatarMeta.baseUrl}${size}/${props.avatarMeta.rev}.${ext}`;
      return `${url} ${size}w`;
    })
    .join(', ');

  return srcset;
}

// Атрибут sizes для браузера
const sizesAttr = computed(() => {
  return `${props.size}px`;
});

// Fallback URL для браузеров без поддержки AVIF/WebP
function getFallbackUrl() {
  if (!props.avatarMeta) return '';

  const size = bestSize.value;
  return `${API_URL}${props.avatarMeta.baseUrl}${size}/${props.avatarMeta.rev}.jpg`;
}

// Получаем инициалы для placeholder
function getInitials() {
  if (props.username) {
    return props.username.substring(0, 2).toUpperCase();
  }

  if (props.email) {
    return props.email.substring(0, 2).toUpperCase();
  }

  return '??';
}

// Обработка ошибок загрузки
function handleImageError(event) {
  console.warn('Failed to load avatar image:', event.target.src);
}
</script>

<style scoped>
.avatar-wrapper {
  position: relative;
  display: inline-block;
  border-radius: 50%;
  overflow: hidden;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.avatar-picture {
  display: block;
  width: 100%;
  height: 100%;
}

.avatar-img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
}

.avatar-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  font-size: 1em;
  font-weight: 600;
  color: white;
  user-select: none;
}
</style>
