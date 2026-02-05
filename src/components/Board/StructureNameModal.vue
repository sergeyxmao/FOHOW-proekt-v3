<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="isOpen" class="modal-overlay" @click="handleCancel">
        <div class="modal-content" @click.stop>
          <button class="modal-close" @click="handleCancel">✕</button>

          <div class="modal-body">
            <h2 class="modal-title">{{ t('structureModal.title') }}</h2>
            <p class="modal-description">
              {{ t('structureModal.description') }}
            </p>

            <input
              ref="inputRef"
              v-model="structureName"
              type="text"
              class="modal-input"
              :placeholder="t('structureModal.placeholder')"
              maxlength="100"
              @keyup.enter="handleConfirm"
              @keyup.escape="handleCancel"
            >

            <div class="modal-actions">
              <button
                type="button"
                class="modal-btn modal-btn--cancel"
                @click="handleCancel"
              >
                {{ t('common.cancel') }}
              </button>
              <button
                type="button"
                class="modal-btn modal-btn--confirm"
                :disabled="!structureName.trim()"
                @click="handleConfirm"
              >
                {{ t('common.create') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps({
  isOpen: {
    type: Boolean,
    required: true
  }
})

const emit = defineEmits(['close', 'confirm'])

const structureName = ref('')
const inputRef = ref(null)

watch(() => props.isOpen, async (newVal) => {
  if (newVal) {
    structureName.value = ''
    await nextTick()
    inputRef.value?.focus()
  }
})

function handleCancel() {
  emit('close')
}

function handleConfirm() {
  const name = structureName.value.trim()
  if (name) {
    emit('confirm', name)
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.modal-content {
  background: white;
  border-radius: 20px;
  max-width: 500px;
  width: 90%;
  position: relative;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
}

.modal-close {
  position: absolute;
  top: 20px;
  right: 20px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background: #f5f5f5;
  font-size: 20px;
  cursor: pointer;
  transition: all 0.2s;
  z-index: 1;
}

.modal-close:hover {
  background: #e0e0e0;
  transform: rotate(90deg);
}

.modal-body {
  padding: 40px;
}

.modal-title {
  font-size: 24px;
  font-weight: 700;
  margin: 0 0 12px 0;
  color: #111827;
  text-align: center;
}

.modal-description {
  font-size: 15px;
  color: #6b7280;
  margin: 0 0 24px 0;
  text-align: center;
  line-height: 1.5;
}

.modal-input {
  width: 100%;
  padding: 14px 18px;
  border: 2px solid #e5e7eb;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 500;
  color: #111827;
  transition: all 0.2s;
  box-sizing: border-box;
}

.modal-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.modal-input::placeholder {
  color: #9ca3af;
}

.modal-actions {
  display: flex;
  gap: 12px;
  margin-top: 24px;
}

.modal-btn {
  flex: 1;
  padding: 14px 24px;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.modal-btn--cancel {
  background: #f3f4f6;
  color: #374151;
}

.modal-btn--cancel:hover {
  background: #e5e7eb;
}

.modal-btn--confirm {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.modal-btn--confirm:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
}

.modal-btn--confirm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
