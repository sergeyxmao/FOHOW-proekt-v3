<script setup>
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useProjectStore } from '../../stores/project.js'

const projectStore = useProjectStore()
const { projectName, openFileName } = storeToRefs(projectStore)

const projectPlaceholder = 'Введите название проекта'

const openFileLabel = computed(() => {
  return openFileName.value ? `Открыт файл: ${openFileName.value}` : 'Файл не загружен'
})
</script>

<template>
  <div class="app-header">
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
    <div class="app-header__file" :class="{ 'app-header__file--empty': !openFileName }">
      {{ openFileLabel }}
    </div>
  </div>
</template>

<style scoped>
.app-header {
  position: fixed;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 12px 24px;
  background: rgba(255, 255, 255, 0.92);
  border-radius: 20px;
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.14);
  backdrop-filter: blur(6px);
  z-index: 1900;
  font-size: 16px;
  line-height: 1.3;
}

.app-header__project {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #111827;
  font-weight: 600;
}

.app-header__label {
  white-space: nowrap;
}

.app-header__input {
  min-width: 240px;
  padding: 8px 14px;
  border-radius: 14px;
  border: 1px solid rgba(15, 23, 42, 0.15);
  font-size: 15px;
  font-weight: 500;
  color: #111827;
  background: rgba(255, 255, 255, 0.98);
  outline: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.app-header__input:focus {
  border-color: #0f62fe;
  box-shadow: 0 0 0 3px rgba(15, 98, 254, 0.15);
}

.app-header__file {
  font-weight: 500;
  color: #1f2937;
}

.app-header__file--empty {
  color: #9ca3af;
  font-style: italic;
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
}
</style>
