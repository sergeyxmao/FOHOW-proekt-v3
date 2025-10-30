<template>
  <div v-if="isOpen" class="modal-overlay" @click.self="close">
    <div class="modal-content">
      <button class="close-btn" @click="close">×</button>
      
      <LoginForm 
        v-if="currentView === 'login'"
        @login-success="handleSuccess"
        @switch-to-register="currentView = 'register'"
      />
      
      <RegisterForm
        v-else
        @register-success="handleSuccess"
        @switch-to-login="currentView = 'login'"
      />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import LoginForm from './LoginForm.vue'
import RegisterForm from './RegisterForm.vue'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  initialView: {
    type: String,
    default: 'login' // 'login' или 'register'
  }
})

const emit = defineEmits(['close', 'success'])

const currentView = ref(props.initialView)

function close() {
  emit('close')
}

function handleSuccess() {
  emit('success')
  close()
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.modal-content {
  position: relative;
  background: white;
  border-radius: 10px;
  max-width: 500px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
}

.close-btn {
  position: absolute;
  top: 10px;
  right: 15px;
  background: none;
  border: none;
  font-size: 30px;
  cursor: pointer;
  color: #999;
  z-index: 1;
}

.close-btn:hover {
  color: #333;
}
</style>
