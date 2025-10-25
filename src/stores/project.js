import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

const sanitizeFileName = (value) => {
  if (typeof value !== 'string') {
    return ''
  }
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\u0400-\u04FF\s_-]+/g, '')
    .trim()
}

export const useProjectStore = defineStore('project', () => {
  const projectName = ref('')
  const openFileName = ref('')

  const normalizedProjectName = computed(() => sanitizeFileName(projectName.value))

  const setProjectName = (value) => {
    projectName.value = typeof value === 'string' ? value : ''
  }

  const setOpenFileName = (value) => {
    openFileName.value = typeof value === 'string' ? value : ''
  }

  const applyLoadedFileName = (value) => {
    if (!value) {
      return
    }
    setOpenFileName(value)
    if (!projectName.value) {
      setProjectName(value)
    }
  }

  return {
    projectName,
    openFileName,
    normalizedProjectName,
    setProjectName,
    setOpenFileName,
    applyLoadedFileName
  }
})

export const formatProjectFileName = (projectName, fallback = '') => {
  const sanitized = sanitizeFileName(projectName)
    .replace(/\s+/g, '-').toLowerCase()
    .replace(/-+/g, '-').replace(/^-|-$/g, '')
  if (sanitized) {
    return sanitized
  }
  const base = fallback || 'fohow-project'
  return `${base}-${Date.now()}`
}
