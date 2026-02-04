<template>
  <div class="verification-page">
    <div class="verification-card">
      <h2>{{ t('verification.title') }}</h2>
      <p>{{ t('verification.codeSent', { email: email }) }}</p>

      <form @submit.prevent="verifyCode">
        <div class="code-input">
          <input
            v-model="code"
            type="text"
            maxlength="6"
            placeholder="000000"
            @input="formatCode"
          />
        </div>

        <div v-if="error" class="error-message">
          {{ error }}
        </div>

        <button type="submit" :disabled="loading || code.length !== 6">
          {{ t('verification.confirm') }}
        </button>
      </form>

      <div class="resend-section">
        <p>{{ t('verification.didntReceive') }}</p>
        <button
          @click="resendCode"
          :disabled="resendDisabled || loading"
        >
          {{ resendButtonText }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';

const router = useRouter();
const { t } = useI18n();

const email = ref(localStorage.getItem('verificationEmail') || '');
const code = ref('');
const error = ref('');
const loading = ref(false);
const resendDisabled = ref(false);
const resendCountdown = ref(0);

const resendButtonText = computed(() => {
  if (resendCountdown.value > 0) {
    return t('verification.resendIn', { seconds: resendCountdown.value });
  }
  return t('verification.resend');
});

function formatCode(event) {
  // Оставлять только цифры
  code.value = event.target.value.replace(/\D/g, '');
}

async function verifyCode() {
  if (code.value.length !== 6) return;

  loading.value = true;
  error.value = '';

  try {
    const response = await fetch('/api/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.value,
        code: code.value
      })
    });

    const data = await response.json();

    if (!response.ok) {
      error.value = data.error;
      return;
    }

    // Сохранить токен
    localStorage.setItem('token', data.token);
    localStorage.removeItem('verificationEmail');

    // Перенаправить в личный кабинет
    alert(t('verification.success'));
    router.push('/');

  } catch (err) {
    error.value = t('verification.serverError');
  } finally {
    loading.value = false;
  }
}

async function resendCode() {
  resendDisabled.value = true;
  resendCountdown.value = 30;

  try {
    const response = await fetch('/api/resend-verification-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.value })
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.error);
      return;
    }

    alert(t('verification.newCodeSent'));

    // Запустить обратный отсчёт
    const interval = setInterval(() => {
      resendCountdown.value--;
      if (resendCountdown.value <= 0) {
        clearInterval(interval);
        resendDisabled.value = false;
      }
    }, 1000);

  } catch (err) {
    alert(t('verification.sendError'));
    resendDisabled.value = false;
  }
}

onMounted(() => {
  if (!email.value) {
    router.push('/');
  }
});
</script>

<style scoped>
.verification-page {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.verification-card {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.1);
  max-width: 400px;
  width: 100%;
}

.code-input input {
  width: 100%;
  padding: 1rem;
  font-size: 2rem;
  letter-spacing: 10px;
  text-align: center;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  margin: 1rem 0;
}

.error-message {
  color: #e53e3e;
  margin: 1rem 0;
}

button {
  width: 100%;
  padding: 1rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.resend-section {
  margin-top: 2rem;
  text-align: center;
}
</style>
