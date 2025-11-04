<template>
  <div class="avatar-uploader">
    <div class="avatar-preview">
      <AvatarImg
        :avatarMeta="previewMeta || avatarMeta"
        :username="username"
        :email="email"
        :size="120"
      />

      <div v-if="uploading" class="upload-overlay">
        <div class="upload-progress">
          <div class="spinner"></div>
          <p>{{ uploadProgress }}%</p>
        </div>
      </div>
    </div>

    <div class="upload-controls">
      <label class="upload-button">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          @change="handleFileSelect"
          :disabled="uploading"
          ref="fileInput"
        />
        <span>{{ avatarMeta ? 'Изменить' : 'Загрузить' }}</span>
      </label>

      <button
        v-if="avatarMeta"
        class="delete-button"
        @click="handleDelete"
        :disabled="uploading"
      >
        Удалить
      </button>
    </div>

    <p v-if="error" class="error-message">{{ error }}</p>
    <p v-if="success" class="success-message">{{ success }}</p>

    <p class="upload-hint">
      Разрешены: JPEG, PNG, WebP, AVIF. Максимум 10 МБ.
    </p>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useAuthStore } from '../stores/auth';
import AvatarImg from './AvatarImg.vue';

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
  }
});

const emit = defineEmits(['upload-success', 'delete-success']);

const authStore = useAuthStore();
const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:4000';

const uploading = ref(false);
const uploadProgress = ref(0);
const error = ref('');
const success = ref('');
const previewMeta = ref(null);
const fileInput = ref(null);

async function handleFileSelect(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  // Валидация размера
  const MAX_SIZE = 10 * 1024 * 1024; // 10 МБ
  if (file.size > MAX_SIZE) {
    error.value = 'Файл слишком большой. Максимум 10 МБ';
    return;
  }

  // Валидация типа
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
  if (!allowedTypes.includes(file.type)) {
    error.value = 'Неподдерживаемый формат. Используйте JPEG, PNG, WebP или AVIF';
    return;
  }

  // Очистка сообщений
  error.value = '';
  success.value = '';

  // Создаём превью
  const reader = new FileReader();
  reader.onload = (e) => {
    // Временно показываем превью (будет заменено после загрузки)
    previewMeta.value = null; // сбросим, чтобы показать placeholder с загрузкой
  };
  reader.readAsDataURL(file);

  // Загружаем файл
  await uploadAvatar(file);
}

async function uploadAvatar(file) {
  uploading.value = true;
  uploadProgress.value = 0;

  try {
    const formData = new FormData();
    formData.append('file', file);

    const xhr = new XMLHttpRequest();

    // Отслеживание прогресса
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        uploadProgress.value = Math.round((e.loaded / e.total) * 100);
      }
    });

    // Обработка ответа
    const uploadPromise = new Promise((resolve, reject) => {
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.responseText));
        } else {
          reject(new Error(JSON.parse(xhr.responseText).error || 'Ошибка загрузки'));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Ошибка сети'));
      });
    });

    // Отправка запроса
    xhr.open('POST', `${API_URL}/api/me/avatar`);
    xhr.setRequestHeader('Authorization', `Bearer ${authStore.token}`);
    xhr.send(formData);

    const response = await uploadPromise;

    // Обновляем профиль
    await authStore.fetchProfile();

    success.value = 'Аватар успешно загружен!';
    previewMeta.value = null;

    emit('upload-success', response.avatarMeta);

    // Очищаем input
    if (fileInput.value) {
      fileInput.value.value = '';
    }

    // Очищаем сообщение через 3 секунды
    setTimeout(() => {
      success.value = '';
    }, 3000);
  } catch (err) {
    console.error('Upload error:', err);
    error.value = err.message || 'Ошибка загрузки аватара';
    previewMeta.value = null;
  } finally {
    uploading.value = false;
    uploadProgress.value = 0;
  }
}

async function handleDelete() {
  if (!confirm('Вы уверены, что хотите удалить аватар?')) {
    return;
  }

  uploading.value = true;
  error.value = '';
  success.value = '';

  try {
    const response = await fetch(`${API_URL}/api/me/avatar`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Ошибка удаления');
    }

    // Обновляем профиль
    await authStore.fetchProfile();

    success.value = 'Аватар успешно удалён!';
    emit('delete-success');

    // Очищаем сообщение через 3 секунды
    setTimeout(() => {
      success.value = '';
    }, 3000);
  } catch (err) {
    console.error('Delete error:', err);
    error.value = err.message || 'Ошибка удаления аватара';
  } finally {
    uploading.value = false;
  }
}
</script>

<style scoped>
.avatar-uploader {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.avatar-preview {
  position: relative;
  width: 120px;
  height: 120px;
}

.upload-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.upload-progress {
  text-align: center;
  color: white;
}

.spinner {
  width: 30px;
  height: 30px;
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 0.5rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.upload-controls {
  display: flex;
  gap: 0.5rem;
}

.upload-button {
  position: relative;
  display: inline-block;
  padding: 0.5rem 1rem;
  background: #667eea;
  color: white;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
  font-size: 0.9rem;
  font-weight: 500;
}

.upload-button:hover {
  background: #5568d3;
}

.upload-button input[type="file"] {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  overflow: hidden;
}

.upload-button:has(input:disabled) {
  opacity: 0.5;
  cursor: not-allowed;
}

.delete-button {
  padding: 0.5rem 1rem;
  background: #ef4444;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
  font-size: 0.9rem;
  font-weight: 500;
}

.delete-button:hover {
  background: #dc2626;
}

.delete-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.error-message {
  color: #ef4444;
  font-size: 0.85rem;
  margin: 0;
}

.success-message {
  color: #10b981;
  font-size: 0.85rem;
  margin: 0;
}

.upload-hint {
  font-size: 0.75rem;
  color: #6b7280;
  margin: 0;
  text-align: center;
}
</style>
