<script setup>
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useProjectStore } from '../../stores/project.js'
import { useAuthStore } from '../../stores/auth.js'
import AuthModal from '../AuthModal.vue'
import UserProfile from '../UserProfile.vue'
  
const props = defineProps({
  isModernTheme: {
    type: Boolean,
    default: false
  }
})
  
const projectStore = useProjectStore()
const authStore = useAuthStore()
const { projectName } = storeToRefs(projectStore)
const { isAuthenticated, user } = storeToRefs(authStore)
const projectPlaceholder = 'Введите название проекта'

const showAuthModal = ref(false)
const authModalView = ref('login')
const showProfile = ref(false)

function openLogin() {
  authModalView.value = 'login'
  showAuthModal.value = true
}

function openRegister() {
  authModalView.value = 'register'
  showAuthModal.value = true
}

function handleLogout() {
  if (confirm('Вы уверены, что хотите выйти?')) {
    authStore.logout()
  }
}
</script>

<template>
  <div
    :class="[
      'app-header',
      { 'app-header--modern': props.isModernTheme }
    ]"
  >
    <label class="app-header__project" for="project-name-input">
      <span class="app-header__label">Название проекта:</span>
      <input
        id="project-name-input"
        v-model="projectName"
        class="app-header__input"
        type="text"
        :placeholder="projectPlaceholder"
      >
    </label>

    <!-- Блок авторизации -->
    <div class="app-header__auth">
      <template v-if="isAuthenticated">
        <span class="app-header__user">👤 {{ user?.username || user?.email }}</span>
        <button class="app-header__btn app-header__btn--profile" @click="showProfile = true">
          Профиль
        </button>
        <button class="app-header__btn app-header__btn--logout" @click="handleLogout">
          Выйти
        </button>
      </template>
      <template v-else>
        <button class="app-header__btn app-header__btn--login" @click="openLogin">
          Войти
        </button>
        <button class="app-header__btn app-header__btn--register" @click="openRegister">
          Регистрация
        </button>
      </template>
    </div>

    <!-- Модальное окно авторизации -->
    <AuthModal
      :is-open="showAuthModal"
      :initial-view="authModalView"
      :is-modern-theme="props.isModernTheme"      
      @close="showAuthModal = false"
      @success="showAuthModal = false"
    />

    <!-- Модальное окно профиля -->
    <Teleport to="body">
      <div
        v-if="showProfile"
        :class="[
          'profile-modal-overlay',
          { 'profile-modal-overlay--modern': props.isModernTheme }
        ]"
        @click.self="showProfile = false"
      >
        <UserProfile
          :is-modern-theme="props.isModernTheme"
          @close="showProfile = false"
        />
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.app-header {
  --header-surface: rgba(255, 255, 255, 0.92);
  --header-shadow: 0 12px 28px rgba(15, 23, 42, 0.14);
  --header-text: #111827;
  --header-label-bg: rgba(15, 23, 42, 0.06);
  --header-input-bg: rgba(255, 255, 255, 0.98);
  --header-input-border: rgba(15, 23, 42, 0.15);
  --header-input-color: #111827;
  --header-input-placeholder: rgba(17, 24, 39, 0.55);
  --header-focus-border: #0f62fe;
  --header-focus-shadow: rgba(15, 98, 254, 0.15);  
  position: fixed;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 12px 24px;
  background: var(--header-surface);
  border-radius: 20px;
  box-shadow: var(--header-shadow);
  backdrop-filter: blur(6px);
  z-index: 1900;
  font-size: 16px;
  line-height: 1.3;
  color: var(--header-text);
}

.app-header--modern {
  --header-surface: rgba(28, 38, 58, 0.9);
  --header-shadow: 0 18px 34px rgba(6, 11, 21, 0.45);
  --header-text: #e5f3ff;
  --header-label-bg: rgba(44, 58, 82, 0.72);
  --header-input-bg: rgba(17, 24, 39, 0.92);
  --header-input-border: rgba(96, 164, 255, 0.35);
  --header-input-color: #e5f3ff;
  --header-input-placeholder: rgba(229, 243, 255, 0.5);
  --header-focus-border: rgba(89, 208, 255, 0.85);
  --header-focus-shadow: rgba(17, 203, 255, 0.2);  
}

.app-header__project {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--header-text);
  font-weight: 700;
  font-size: 18px;
  padding: 12px 20px;
  border-radius: 16px;
  background: var(--header-label-bg);
  transition: background 0.2s ease, color 0.2s ease;
}

.app-header__label {
  white-space: nowrap;
}

.app-header__input {
  min-width: 240px;
  padding: 10px 16px;
  border-radius: 14px;
  border: 1px solid var(--header-input-border);
  font-size: 16px;
  font-weight: 600;
  color: var(--header-input-color);
  background: var(--header-input-bg);
  outline: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease, color 0.2s ease;
}

.app-header__input::placeholder {
  color: var(--header-input-placeholder);
}

.app-header__input:focus {
  border-color: var(--header-focus-border);
  box-shadow: 0 0 0 3px var(--header-focus-shadow);
}

/* Блок авторизации */
.app-header__auth {
  display: flex;
  align-items: center;
  gap: 12px;
}

.app-header__user {
  padding: 8px 16px;
  background: var(--header-label-bg);
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
}

.app-header__btn {
  padding: 8px 20px;
  border-radius: 12px;
  border: none;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.app-header__btn--login {
  background: #4CAF50;
  color: white;
}

.app-header__btn--login:hover {
  background: #45a049;
  transform: translateY(-1px);
}

.app-header__btn--register {
  background: #2196F3;
  color: white;
}

.app-header__btn--register:hover {
  background: #0b7dda;
  transform: translateY(-1px);
}

.app-header__btn--profile {
  background: #2196F3;
  color: white;
}

.app-header__btn--profile:hover {
  background: #1976D2;
  transform: translateY(-1px);
}

.app-header__btn--logout {
  background: #f44336;
  color: white;
}

.app-header__btn--logout:hover {
  background: #da190b;
  transform: translateY(-1px);
}

.profile-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  z-index: 10000;
}
.profile-modal-overlay--modern {
  background: rgba(5, 12, 24, 0.8);
}

@media (max-width: 900px) {
  .app-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  
  .app-header__project {
    width: 100%;
    flex-direction: column;
    align-items: stretch;
  }
  
  .app-header__input {
    width: 100%;
    min-width: 0;
  }
  
  .app-header__auth {
    width: 100%;
    justify-content: center;
  }
}
</style>
