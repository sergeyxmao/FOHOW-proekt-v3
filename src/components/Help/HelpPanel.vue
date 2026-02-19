<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useAuthStore } from '../../stores/auth'
import HelpImageLightbox from './HelpImageLightbox.vue'

const props = defineProps({
  isModernTheme: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close'])

const authStore = useAuthStore()
const isAdmin = computed(() => authStore.user?.role === 'admin')

const API_URL = import.meta.env.VITE_API_URL || '/api'

// --- Данные ---
const categories = ref([])
const isLoading = ref(false)
const isLoaded = ref(false)

// --- Навигация ---
const currentCategoryId = ref(null)
const currentArticleId = ref(null)
const searchQuery = ref('')

// --- Режим редактирования ---
const isEditMode = ref(false)
const isSavingArticle = ref(false)

// --- Создание категории ---
const showNewCategoryForm = ref(false)
const newCategoryTitle = ref('')
const newCategoryIcon = ref('📌')
const emojiOptions = ['📌', '🚀', '🗂️', '🎨', '👁️', '📤', '🔍', '📋', '⚙️', '💡']

// --- Создание статьи ---
const showNewArticleForm = ref(false)
const newArticleTitle = ref('')

// --- Lightbox ---
const lightboxSrc = ref(null)

// --- Refs ---
const contentEditableRef = ref(null)
const fileInputRef = ref(null)

// --- Computed ---
const currentCategory = computed(() => {
  if (!currentCategoryId.value) return null
  return categories.value.find(c => c.id === currentCategoryId.value) || null
})

const currentArticle = computed(() => {
  if (!currentCategory.value || !currentArticleId.value) return null
  return currentCategory.value.articles.find(a => a.id === currentArticleId.value) || null
})

const panelTitle = computed(() => {
  if (currentArticle.value) return currentArticle.value.title
  if (currentCategory.value) return currentCategory.value.title
  return 'Помощь'
})

const filteredCategories = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return categories.value

  return categories.value
    .map(cat => {
      const matchedArticles = cat.articles.filter(a =>
        a.title.toLowerCase().includes(q)
      )
      if (matchedArticles.length === 0) return null
      return { ...cat, articles: matchedArticles }
    })
    .filter(Boolean)
})

const isSearchActive = computed(() => searchQuery.value.trim().length > 0)

// --- Загрузка данных ---
function getAuthHeaders() {
  const token = localStorage.getItem('token') || authStore.token
  return { 'Authorization': `Bearer ${token}` }
}

async function loadCategories() {
  isLoading.value = true
  try {
    const res = await fetch(`${API_URL}/help/categories`, {
      headers: getAuthHeaders()
    })
    if (res.ok) {
      const data = await res.json()
      categories.value = data.categories || []
      isLoaded.value = true
    }
  } catch (err) {
    console.error('[HelpPanel] Ошибка загрузки категорий:', err)
  } finally {
    isLoading.value = false
  }
}

// Загружаем при первом монтировании
onMounted(() => {
  if (!isLoaded.value) {
    loadCategories()
  }
})

// --- Навигация ---
function openCategory(categoryId) {
  currentCategoryId.value = categoryId
  currentArticleId.value = null
  showNewArticleForm.value = false
}

function openArticle(categoryId, articleId) {
  currentCategoryId.value = categoryId
  currentArticleId.value = articleId
}

function goBack() {
  if (currentArticleId.value) {
    currentArticleId.value = null
  } else if (currentCategoryId.value) {
    currentCategoryId.value = null
    showNewArticleForm.value = false
  }
}

function handleClose() {
  currentCategoryId.value = null
  currentArticleId.value = null
  searchQuery.value = ''
  showNewCategoryForm.value = false
  showNewArticleForm.value = false
  emit('close')
}

// --- Режим редактирования ---
function toggleEditMode() {
  if (isEditMode.value) {
    // Выходим из режима — перезагружаем данные
    isEditMode.value = false
    showNewCategoryForm.value = false
    showNewArticleForm.value = false
    loadCategories()
  } else {
    isEditMode.value = true
  }
}

// --- CRUD: Категории ---
async function createCategory() {
  const title = newCategoryTitle.value.trim()
  if (!title) return

  try {
    const res = await fetch(`${API_URL}/help/categories`, {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, icon: newCategoryIcon.value })
    })
    if (res.ok) {
      const data = await res.json()
      categories.value.push({ ...data.category, articles: [] })
      newCategoryTitle.value = ''
      newCategoryIcon.value = '📌'
      showNewCategoryForm.value = false
    }
  } catch (err) {
    console.error('[HelpPanel] Ошибка создания категории:', err)
  }
}

async function deleteCategory(catId) {
  if (!confirm('Удалить категорию и все её статьи? Это действие необратимо.')) return

  try {
    const res = await fetch(`${API_URL}/help/categories/${catId}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    })
    if (res.ok) {
      categories.value = categories.value.filter(c => c.id !== catId)
    }
  } catch (err) {
    console.error('[HelpPanel] Ошибка удаления категории:', err)
  }
}

// --- CRUD: Статьи ---
async function createArticle() {
  const title = newArticleTitle.value.trim()
  if (!title || !currentCategoryId.value) return

  try {
    const res = await fetch(`${API_URL}/help/articles`, {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ category_id: currentCategoryId.value, title })
    })
    if (res.ok) {
      const data = await res.json()
      const cat = categories.value.find(c => c.id === currentCategoryId.value)
      if (cat) {
        cat.articles.push(data.article)
      }
      newArticleTitle.value = ''
      showNewArticleForm.value = false
    }
  } catch (err) {
    console.error('[HelpPanel] Ошибка создания статьи:', err)
  }
}

async function deleteArticle(articleId) {
  if (!confirm('Удалить статью? Это действие необратимо.')) return

  try {
    const res = await fetch(`${API_URL}/help/articles/${articleId}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    })
    if (res.ok) {
      const cat = categories.value.find(c => c.id === currentCategoryId.value)
      if (cat) {
        cat.articles = cat.articles.filter(a => a.id !== articleId)
      }
      if (currentArticleId.value === articleId) {
        currentArticleId.value = null
      }
    }
  } catch (err) {
    console.error('[HelpPanel] Ошибка удаления статьи:', err)
  }
}

// --- Сохранение контента статьи ---
async function saveArticleContent() {
  if (!currentArticle.value || !contentEditableRef.value) return
  isSavingArticle.value = true

  try {
    let html = contentEditableRef.value.innerHTML

    // Post-processing: заменяем <font size="N"> на <span style="font-size: Xpx">
    html = normalizeFontSizes(html)

    const res = await fetch(`${API_URL}/help/articles/${currentArticle.value.id}`, {
      method: 'PUT',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: html })
    })
    if (res.ok) {
      const data = await res.json()
      // Обновляем в локальных данных
      const cat = categories.value.find(c => c.id === currentCategoryId.value)
      if (cat) {
        const art = cat.articles.find(a => a.id === currentArticle.value.id)
        if (art) {
          art.content = data.article.content
        }
      }
    }
  } catch (err) {
    console.error('[HelpPanel] Ошибка сохранения статьи:', err)
  } finally {
    isSavingArticle.value = false
  }
}

// --- Сохранение заголовка статьи ---
async function saveArticleTitle(articleId, newTitle) {
  const title = newTitle.trim()
  if (!title) return

  try {
    await fetch(`${API_URL}/help/articles/${articleId}`, {
      method: 'PUT',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ title })
    })
    // Обновляем локально
    const cat = categories.value.find(c => c.id === currentCategoryId.value)
    if (cat) {
      const art = cat.articles.find(a => a.id === articleId)
      if (art) art.title = title
    }
  } catch (err) {
    console.error('[HelpPanel] Ошибка сохранения заголовка:', err)
  }
}

// --- Сохранение/восстановление выделения ---
let savedRange = null
const isBoldActive = ref(false)
const isItalicActive = ref(false)

function onSelectionChange() {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return
  const range = sel.getRangeAt(0)
  // Сохраняем только если выделение внутри нашего contenteditable
  if (contentEditableRef.value && contentEditableRef.value.contains(range.commonAncestorContainer)) {
    savedRange = range.cloneRange()
    updateFormatButtons()
  }
}

function restoreSelectionForSelect() {
  // Используется ТОЛЬКО для <select> (шрифт/размер), которые реально крадут фокус
  if (!savedRange || !contentEditableRef.value) return
  contentEditableRef.value.focus()
  const sel = window.getSelection()
  if (sel) {
    sel.removeAllRanges()
    sel.addRange(savedRange.cloneRange())
  }
}

onMounted(() => {
  document.addEventListener('selectionchange', onSelectionChange)
})

onBeforeUnmount(() => {
  document.removeEventListener('selectionchange', onSelectionChange)
})

// --- Форматирование ---
function execCmd(command, value) {
  // НЕ вызываем restoreSelection — @mousedown.prevent на кнопках сохраняет
  // живое выделение в contenteditable. restoreSelection ЛОМАЕТ его,
  // заменяя клоном, из-за чего execCommand работает неправильно.
  document.execCommand(command, false, value || null)
  // Обновляем savedRange после применения команды
  const sel = window.getSelection()
  if (sel && sel.rangeCount > 0) {
    savedRange = sel.getRangeAt(0).cloneRange()
  }
  // Обновляем состояние кнопок
  updateFormatButtons()
}

function updateFormatButtons() {
  try {
    isBoldActive.value = document.queryCommandState('bold')
  } catch (e) { isBoldActive.value = false }
  try {
    isItalicActive.value = document.queryCommandState('italic')
  } catch (e) { isItalicActive.value = false }
}

function setFont(e) {
  restoreSelectionForSelect()
  document.execCommand('fontName', false, e.target.value)
}

function setFontSize(e) {
  restoreSelectionForSelect()
  document.execCommand('fontSize', false, e.target.value)
}

function normalizeFontSizes(html) {
  // Заменяем <font size="N"> на <span style="font-size: Xpx">
  const sizeMap = { '1': '10', '2': '12', '3': '14', '4': '16', '5': '18', '6': '20', '7': '24' }
  return html.replace(/<font\s+size="(\d)">([\s\S]*?)<\/font>/gi, (match, size, content) => {
    const px = sizeMap[size] || '14'
    return `<span style="font-size: ${px}px">${content}</span>`
  })
}

// --- Загрузка изображений ---
async function uploadImage(file) {
  if (!currentArticle.value) return null

  const formData = new FormData()
  formData.append('file', file)

  try {
    const res = await fetch(`${API_URL}/help/articles/${currentArticle.value.id}/images`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: formData
    })
    if (res.ok) {
      const data = await res.json()
      return data.url
    }
  } catch (err) {
    console.error('[HelpPanel] Ошибка загрузки изображения:', err)
  }
  return null
}

function insertImageAtCursor(url) {
  if (!contentEditableRef.value) return
  contentEditableRef.value.focus()

  const img = `<img src="${url}" style="max-width: 100%; border-radius: 8px; cursor: pointer; margin: 8px 0; display: block;" />`
  document.execCommand('insertHTML', false, img)
}

async function handlePaste(e) {
  if (!isEditMode.value || !currentArticle.value) return

  const items = e.clipboardData?.items
  if (!items) return

  for (const item of items) {
    if (item.type.startsWith('image/')) {
      e.preventDefault()
      const file = item.getAsFile()
      if (file) {
        const url = await uploadImage(file)
        if (url) insertImageAtCursor(url)
      }
      return
    }
  }
}

function triggerFileUpload() {
  if (fileInputRef.value) {
    fileInputRef.value.click()
  }
}

async function handleFileSelect(e) {
  const file = e.target.files?.[0]
  if (!file) return

  const url = await uploadImage(file)
  if (url) insertImageAtCursor(url)

  // Сбрасываем input
  if (fileInputRef.value) fileInputRef.value.value = ''
}

// --- Удаление изображения в edit mode ---
async function handleContentClick(e) {
  const img = e.target.closest('img')
  if (!img) return

  if (isEditMode.value) {
    // В edit mode — удаление по клику с Alt
    // Простой клик — ничего не делаем (обрабатывается кнопкой удаления через overlay)
    return
  }

  // В обычном режиме — lightbox
  lightboxSrc.value = img.src
}

async function deleteImage(imgEl) {
  if (!imgEl) return

  // Извлекаем filename из src
  const src = imgEl.getAttribute('src')
  const match = src?.match(/\/api\/help\/images\/(.+)$/)
  if (match) {
    const filename = match[1]
    try {
      await fetch(`${API_URL}/help/images/${filename}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      })
    } catch (err) {
      console.error('[HelpPanel] Ошибка удаления изображения:', err)
    }
  }

  // Удаляем из DOM
  imgEl.remove()
  // Автосохранение
  saveArticleContent()
}

// --- Обработка кликов по изображениям в v-html (readonly mode) ---
function handleReadonlyContentClick(e) {
  const img = e.target.closest('img')
  if (img) {
    lightboxSrc.value = img.src
  }
}

// --- Hover overlay для удаления изображений ---
const hoveredImg = ref(null)
const hoverPos = ref({ top: 0, right: 0 })

function handleContentMouseOver(e) {
  if (!isEditMode.value) return
  const img = e.target.closest('img')
  if (img && contentEditableRef.value) {
    hoveredImg.value = img
    const rect = img.getBoundingClientRect()
    const panelRect = contentEditableRef.value.closest('.help-panel__content')?.getBoundingClientRect()
    if (panelRect) {
      hoverPos.value = {
        top: rect.top - panelRect.top + 4,
        right: panelRect.right - rect.right + 4
      }
    }
  }
}

function handleContentMouseOut(e) {
  if (!isEditMode.value) return
  const img = e.target.closest('img')
  if (img) {
    // Проверяем, не ушли ли мы на кнопку удаления
    const related = e.relatedTarget
    if (related && related.closest('.help-img-delete-btn')) return
    hoveredImg.value = null
  }
}
</script>

<template>
  <Teleport to="body">
    <!-- Overlay -->
    <div
      class="help-overlay"
      @click="handleClose"
    />

    <!-- Panel -->
    <div
      class="help-panel"
      :class="{ 'help-panel--modern': isModernTheme }"
    >
      <!-- Header -->
      <div class="help-panel__header">
        <button
          v-if="currentCategoryId"
          class="help-panel__back"
          type="button"
          title="Назад"
          @click="goBack"
        >
          ←
        </button>
        <h2 class="help-panel__title">{{ panelTitle }}</h2>

        <!-- Кнопка режима редактирования (только admin) -->
        <button
          v-if="isAdmin && !currentArticleId"
          class="help-panel__edit-toggle"
          :class="{ 'help-panel__edit-toggle--active': isEditMode }"
          type="button"
          :title="isEditMode ? 'Готово' : 'Редактировать'"
          @click="toggleEditMode"
        >
          {{ isEditMode ? '✓ Готово' : '✏️' }}
        </button>

        <button
          class="help-panel__close"
          type="button"
          title="Закрыть"
          @click="handleClose"
        >
          ✕
        </button>
      </div>

      <!-- Search (only on main screen, not in edit mode) -->
      <div v-if="!currentCategoryId && !isEditMode" class="help-panel__search">
        <span class="help-panel__search-icon">🔍</span>
        <input
          v-model="searchQuery"
          class="help-panel__search-input"
          :class="{ 'help-panel__search-input--modern': isModernTheme }"
          type="text"
          placeholder="Поиск..."
        />
      </div>

      <!-- Loading spinner -->
      <div v-if="isLoading" class="help-panel__loading">
        <div class="help-panel__spinner" />
        <span>Загрузка...</span>
      </div>

      <!-- Content -->
      <div v-else class="help-panel__content">

        <!-- ============================== -->
        <!-- Level 1: Categories list       -->
        <!-- ============================== -->
        <template v-if="!currentCategoryId && !isSearchActive">
          <div
            v-for="cat in filteredCategories"
            :key="cat.id"
            class="help-category-row"
          >
            <button
              class="help-category-card"
              :class="{ 'help-category-card--modern': isModernTheme }"
              type="button"
              @click="openCategory(cat.id)"
            >
              <span class="help-category-card__icon">{{ cat.icon }}</span>
              <span class="help-category-card__title">{{ cat.title }}</span>
              <span class="help-category-card__arrow">›</span>
            </button>
            <!-- Кнопка удаления категории (edit mode) -->
            <button
              v-if="isEditMode"
              class="help-delete-btn"
              :class="{ 'help-delete-btn--modern': isModernTheme }"
              type="button"
              title="Удалить категорию"
              @click.stop="deleteCategory(cat.id)"
            >
              🗑
            </button>
          </div>

          <!-- Форма добавления категории (edit mode) -->
          <div v-if="isEditMode" class="help-add-section">
            <button
              v-if="!showNewCategoryForm"
              class="help-add-btn"
              :class="{ 'help-add-btn--modern': isModernTheme }"
              type="button"
              @click="showNewCategoryForm = true"
            >
              + Добавить категорию
            </button>
            <div v-else class="help-add-form" :class="{ 'help-add-form--modern': isModernTheme }">
              <div class="help-add-form__row">
                <select
                  v-model="newCategoryIcon"
                  class="help-add-form__emoji-select"
                  :class="{ 'help-add-form__emoji-select--modern': isModernTheme }"
                >
                  <option v-for="em in emojiOptions" :key="em" :value="em">{{ em }}</option>
                </select>
                <input
                  v-model="newCategoryTitle"
                  class="help-add-form__input"
                  :class="{ 'help-add-form__input--modern': isModernTheme }"
                  type="text"
                  placeholder="Название категории"
                  @keydown.enter="createCategory"
                />
              </div>
              <div class="help-add-form__actions">
                <button class="help-add-form__submit" type="button" @click="createCategory">Создать</button>
                <button class="help-add-form__cancel" type="button" @click="showNewCategoryForm = false">Отмена</button>
              </div>
            </div>
          </div>
        </template>

        <!-- ============================== -->
        <!-- Search results                 -->
        <!-- ============================== -->
        <template v-if="!currentCategoryId && isSearchActive">
          <div v-if="filteredCategories.length === 0" class="help-panel__empty">
            Ничего не найдено
          </div>
          <div
            v-for="cat in filteredCategories"
            :key="cat.id"
            class="help-search-group"
          >
            <div class="help-search-group__title">
              {{ cat.icon }} {{ cat.title }}
            </div>
            <button
              v-for="article in cat.articles"
              :key="article.id"
              class="help-article-item"
              :class="{ 'help-article-item--modern': isModernTheme }"
              type="button"
              @click="openArticle(cat.id, article.id)"
            >
              {{ article.title }}
            </button>
          </div>
        </template>

        <!-- ============================== -->
        <!-- Level 2: Articles in category  -->
        <!-- ============================== -->
        <template v-if="currentCategoryId && !currentArticleId">
          <div
            v-for="article in currentCategory?.articles"
            :key="article.id"
            class="help-article-row"
          >
            <button
              class="help-article-item"
              :class="{ 'help-article-item--modern': isModernTheme }"
              type="button"
              @click="openArticle(currentCategoryId, article.id)"
            >
              {{ article.title }}
            </button>
            <!-- Кнопка удаления статьи (edit mode) -->
            <button
              v-if="isEditMode"
              class="help-delete-btn help-delete-btn--small"
              :class="{ 'help-delete-btn--modern': isModernTheme }"
              type="button"
              title="Удалить статью"
              @click.stop="deleteArticle(article.id)"
            >
              🗑
            </button>
          </div>

          <!-- Форма добавления статьи (edit mode) -->
          <div v-if="isEditMode" class="help-add-section">
            <button
              v-if="!showNewArticleForm"
              class="help-add-btn"
              :class="{ 'help-add-btn--modern': isModernTheme }"
              type="button"
              @click="showNewArticleForm = true"
            >
              + Добавить статью
            </button>
            <div v-else class="help-add-form" :class="{ 'help-add-form--modern': isModernTheme }">
              <input
                v-model="newArticleTitle"
                class="help-add-form__input"
                :class="{ 'help-add-form__input--modern': isModernTheme }"
                type="text"
                placeholder="Название статьи"
                @keydown.enter="createArticle"
              />
              <div class="help-add-form__actions">
                <button class="help-add-form__submit" type="button" @click="createArticle">Создать</button>
                <button class="help-add-form__cancel" type="button" @click="showNewArticleForm = false">Отмена</button>
              </div>
            </div>
          </div>
        </template>

        <!-- ============================== -->
        <!-- Level 3: Article content       -->
        <!-- ============================== -->
        <template v-if="currentArticle">
          <div class="help-article">

            <!-- Edit mode: toolbar + contenteditable -->
            <template v-if="isEditMode && isAdmin">
              <!-- Toolbar -->
              <div class="help-toolbar" :class="{ 'help-toolbar--modern': isModernTheme }">
                <select
                  class="help-toolbar__select"
                  :class="{ 'help-toolbar__select--modern': isModernTheme }"
                  @change="setFont"
                >
                  <option value="Arial">Arial</option>
                  <option value="Times New Roman">Times New Roman</option>
                  <option value="Georgia">Georgia</option>
                  <option value="Verdana">Verdana</option>
                  <option value="Courier New">Courier New</option>
                </select>
                <select
                  class="help-toolbar__select help-toolbar__select--small"
                  :class="{ 'help-toolbar__select--modern': isModernTheme }"
                  @change="setFontSize"
                >
                  <option value="1">11</option>
                  <option value="2">12</option>
                  <option value="3" selected>14</option>
                  <option value="4">16</option>
                  <option value="5">18</option>
                  <option value="6">20</option>
                  <option value="7">24</option>
                </select>
                <button
                  class="help-toolbar__btn"
                  :class="[
                    { 'help-toolbar__btn--modern': isModernTheme },
                    { 'help-toolbar__btn--active': isBoldActive }
                  ]"
                  type="button"
                  title="Жирный"
                  @mousedown.prevent="execCmd('bold')"
                >
                  <span style="font-weight: 700">Ж</span>
                </button>
                <button
                  class="help-toolbar__btn"
                  :class="[
                    { 'help-toolbar__btn--modern': isModernTheme },
                    { 'help-toolbar__btn--active': isItalicActive }
                  ]"
                  type="button"
                  title="Курсив"
                  @mousedown.prevent="execCmd('italic')"
                >
                  <span style="font-style: italic">К</span>
                </button>
                <button
                  class="help-toolbar__btn"
                  :class="{ 'help-toolbar__btn--modern': isModernTheme }"
                  type="button"
                  title="Вставить изображение"
                  @mousedown.prevent
                  @click="triggerFileUpload"
                >
                  🖼
                </button>
                <input
                  ref="fileInputRef"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  style="display: none"
                  @change="handleFileSelect"
                />
                <button
                  class="help-toolbar__save"
                  :class="{ 'help-toolbar__save--modern': isModernTheme }"
                  type="button"
                  :disabled="isSavingArticle"
                  @mousedown.prevent
                  @click="saveArticleContent"
                >
                  {{ isSavingArticle ? '...' : '💾' }}
                </button>
              </div>

              <!-- Contenteditable area -->
              <div
                ref="contentEditableRef"
                class="help-article__editable"
                :class="{ 'help-article__editable--modern': isModernTheme }"
                contenteditable="true"
                v-html="currentArticle.content"
                @blur="saveArticleContent"
                @paste="handlePaste"
                @click="handleContentClick"
                @mouseover="handleContentMouseOver"
                @mouseout="handleContentMouseOut"
              />

              <!-- Кнопка удаления при наведении на изображение -->
              <button
                v-if="hoveredImg"
                class="help-img-delete-btn"
                :style="{ top: hoverPos.top + 'px', right: hoverPos.right + 'px' }"
                type="button"
                title="Удалить изображение"
                @click="deleteImage(hoveredImg)"
                @mouseleave="hoveredImg = null"
              >
                ✕
              </button>
            </template>

            <!-- Read-only mode -->
            <template v-else>
              <div
                v-if="currentArticle.content"
                class="help-article__text"
                :class="{ 'help-article__text--modern': isModernTheme }"
                v-html="currentArticle.content"
                @click="handleReadonlyContentClick"
              />
              <p v-else class="help-panel__empty">
                Содержимое статьи пока не заполнено.
              </p>
            </template>
          </div>
        </template>
      </div>
    </div>

    <!-- Lightbox -->
    <HelpImageLightbox
      v-if="lightboxSrc"
      :src="lightboxSrc"
      @close="lightboxSrc = null"
    />
  </Teleport>
</template>

<style scoped>
/* Overlay */
.help-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.3);
  z-index: 2099;
}

/* Panel */
.help-panel {
  position: fixed;
  top: 0;
  right: 0;
  width: 380px;
  height: 100vh;
  z-index: 2100;
  background: rgba(255, 255, 255, 0.97);
  backdrop-filter: blur(12px);
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.12);
  display: flex;
  flex-direction: column;
  animation: help-slide-in 0.3s ease;
}

.help-panel--modern {
  background: rgba(28, 38, 58, 0.95);
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.4);
  color: #e5f3ff;
}

@keyframes help-slide-in {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}

/* Header */
.help-panel__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  flex-shrink: 0;
}

.help-panel--modern .help-panel__header {
  border-bottom-color: rgba(255, 255, 255, 0.08);
}

.help-panel__title {
  flex: 1;
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.help-panel__back,
.help-panel__close {
  width: 36px;
  height: 36px;
  border: none;
  background: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: inherit;
  flex-shrink: 0;
  transition: background 0.15s ease;
}

.help-panel__back:hover,
.help-panel__close:hover {
  background: rgba(0, 0, 0, 0.06);
}

.help-panel--modern .help-panel__back:hover,
.help-panel--modern .help-panel__close:hover {
  background: rgba(255, 255, 255, 0.08);
}

/* Edit toggle button */
.help-panel__edit-toggle {
  padding: 4px 10px;
  border: 1.5px solid rgba(0, 0, 0, 0.12);
  border-radius: 8px;
  background: none;
  cursor: pointer;
  font-size: 14px;
  font-family: inherit;
  color: inherit;
  flex-shrink: 0;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.help-panel__edit-toggle:hover {
  background: rgba(0, 0, 0, 0.06);
}

.help-panel__edit-toggle--active {
  background: #ffc107;
  color: #000;
  border-color: #ffc107;
}

.help-panel--modern .help-panel__edit-toggle {
  border-color: rgba(255, 255, 255, 0.15);
}

.help-panel--modern .help-panel__edit-toggle:hover {
  background: rgba(255, 255, 255, 0.08);
}

.help-panel--modern .help-panel__edit-toggle--active {
  background: #ffc107;
  color: #000;
  border-color: #ffc107;
}

/* Search */
.help-panel__search {
  padding: 12px 20px;
  position: relative;
  flex-shrink: 0;
}

.help-panel__search-icon {
  position: absolute;
  left: 32px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 14px;
  pointer-events: none;
}

.help-panel__search-input {
  width: 100%;
  padding: 10px 12px 10px 36px;
  border: 1.5px solid rgba(0, 0, 0, 0.12);
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.03);
  font-size: 14px;
  font-family: inherit;
  color: inherit;
  outline: none;
  transition: border-color 0.2s ease;
  box-sizing: border-box;
}

.help-panel__search-input:focus {
  border-color: rgba(15, 98, 254, 0.5);
}

.help-panel__search-input--modern {
  border-color: rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.05);
  color: #e5f3ff;
}

.help-panel__search-input--modern:focus {
  border-color: rgba(104, 171, 255, 0.5);
}

/* Loading */
.help-panel__loading {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #6b7280;
  font-size: 14px;
}

.help-panel--modern .help-panel__loading {
  color: #8899b4;
}

.help-panel__spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(0, 0, 0, 0.1);
  border-top-color: #0f62fe;
  border-radius: 50%;
  animation: help-spin 0.8s linear infinite;
}

.help-panel--modern .help-panel__spinner {
  border-color: rgba(255, 255, 255, 0.1);
  border-top-color: #68abff;
}

@keyframes help-spin {
  to { transform: rotate(360deg); }
}

/* Content area */
.help-panel__content {
  flex: 1;
  overflow-y: auto;
  padding: 12px 20px;
  position: relative;
}

.help-panel__empty {
  text-align: center;
  padding: 32px 0;
  color: #6b7280;
  font-size: 14px;
}

.help-panel--modern .help-panel__empty {
  color: #8899b4;
}

/* Category row (card + delete btn) */
.help-category-row {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 8px;
}

.help-category-row .help-category-card {
  margin-bottom: 0;
}

/* Category cards */
.help-category-card {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  padding: 14px 16px;
  margin-bottom: 8px;
  border: 1.5px solid rgba(0, 0, 0, 0.06);
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.02);
  cursor: pointer;
  font-size: 15px;
  font-family: inherit;
  color: inherit;
  text-align: left;
  transition: background 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
}

.help-category-card:hover {
  background: rgba(0, 0, 0, 0.05);
  border-color: rgba(0, 0, 0, 0.12);
  transform: translateX(2px);
}

.help-category-card--modern {
  border-color: rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.03);
}

.help-category-card--modern:hover {
  background: rgba(255, 255, 255, 0.07);
  border-color: rgba(255, 255, 255, 0.12);
}

.help-category-card__icon {
  font-size: 22px;
  flex-shrink: 0;
  width: 32px;
  text-align: center;
}

.help-category-card__title {
  flex: 1;
  font-weight: 600;
}

.help-category-card__arrow {
  font-size: 20px;
  color: #9ca3af;
  flex-shrink: 0;
}

.help-panel--modern .help-category-card__arrow {
  color: #6b7fa0;
}

/* Article row */
.help-article-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

/* Article items */
.help-article-item {
  display: block;
  flex: 1;
  padding: 12px 16px;
  border: none;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  background: none;
  cursor: pointer;
  font-size: 14px;
  font-family: inherit;
  color: inherit;
  text-align: left;
  transition: background 0.15s ease;
}

.help-article-item:last-child {
  border-bottom: none;
}

.help-article-item:hover {
  background: rgba(0, 0, 0, 0.04);
}

.help-article-item--modern {
  border-bottom-color: rgba(255, 255, 255, 0.06);
}

.help-article-item--modern:hover {
  background: rgba(255, 255, 255, 0.06);
}

/* Delete buttons */
.help-delete-btn {
  width: 36px;
  height: 36px;
  border: none;
  background: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  opacity: 0.5;
  transition: opacity 0.15s ease, background 0.15s ease;
}

.help-delete-btn:hover {
  opacity: 1;
  background: rgba(239, 68, 68, 0.1);
}

.help-delete-btn--small {
  width: 32px;
  height: 32px;
  font-size: 14px;
}

.help-delete-btn--modern:hover {
  background: rgba(239, 68, 68, 0.2);
}

/* Add section */
.help-add-section {
  margin-top: 12px;
}

.help-add-btn {
  width: 100%;
  padding: 12px 16px;
  border: 2px dashed rgba(0, 0, 0, 0.15);
  border-radius: 12px;
  background: none;
  cursor: pointer;
  font-size: 14px;
  font-family: inherit;
  color: #6b7280;
  text-align: center;
  transition: border-color 0.15s ease, color 0.15s ease;
}

.help-add-btn:hover {
  border-color: rgba(0, 0, 0, 0.3);
  color: #374151;
}

.help-add-btn--modern {
  border-color: rgba(255, 255, 255, 0.15);
  color: #8899b4;
}

.help-add-btn--modern:hover {
  border-color: rgba(255, 255, 255, 0.3);
  color: #c8d8f0;
}

/* Add form */
.help-add-form {
  padding: 12px;
  border: 1.5px solid rgba(0, 0, 0, 0.08);
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.02);
}

.help-add-form--modern {
  border-color: rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
}

.help-add-form__row {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.help-add-form__emoji-select {
  width: 52px;
  padding: 6px 4px;
  border: 1.5px solid rgba(0, 0, 0, 0.12);
  border-radius: 8px;
  background: #fff;
  font-size: 18px;
  cursor: pointer;
}

.help-add-form__emoji-select--modern {
  background: rgba(32, 44, 68, 0.9);
  border-color: rgba(255, 255, 255, 0.15);
  color: #e5f3ff;
}

.help-add-form__input {
  flex: 1;
  padding: 8px 12px;
  border: 1.5px solid rgba(0, 0, 0, 0.12);
  border-radius: 8px;
  background: #fff;
  font-size: 14px;
  font-family: inherit;
  color: inherit;
  outline: none;
  box-sizing: border-box;
}

.help-add-form__input--modern {
  background: rgba(32, 44, 68, 0.9);
  border-color: rgba(255, 255, 255, 0.15);
  color: #e5f3ff;
}

.help-add-form__actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.help-add-form__submit {
  padding: 6px 16px;
  border: none;
  border-radius: 8px;
  background: #0f62fe;
  color: #fff;
  font-size: 13px;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.15s ease;
}

.help-add-form__submit:hover {
  background: #0043ce;
}

.help-add-form__cancel {
  padding: 6px 16px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 8px;
  background: none;
  color: inherit;
  font-size: 13px;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.15s ease;
}

.help-add-form__cancel:hover {
  background: rgba(0, 0, 0, 0.04);
}

/* Search groups */
.help-search-group {
  margin-bottom: 16px;
}

.help-search-group__title {
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  color: #6b7280;
  padding: 8px 16px 4px;
}

.help-panel--modern .help-search-group__title {
  color: #8899b4;
}

/* Article content */
.help-article {
  padding: 4px 0;
  position: relative;
}

.help-article__text {
  font-size: 15px;
  line-height: 1.65;
  color: #374151;
}

.help-article__text--modern {
  color: #c8d8f0;
}

/* Make images in v-html clickable */
.help-article__text :deep(img) {
  max-width: 100%;
  border-radius: 8px;
  cursor: pointer;
  margin: 8px 0;
  display: block;
}

/* Toolbar */
.help-toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px;
  margin-bottom: 8px;
  border: 1.5px solid rgba(0, 0, 0, 0.08);
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.02);
  flex-wrap: wrap;
}

.help-toolbar--modern {
  border-color: rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
}

.help-toolbar__select {
  padding: 4px 6px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 6px;
  background: #fff;
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
  color: inherit;
}

.help-toolbar__select--small {
  width: 52px;
}

.help-toolbar__select--modern {
  background: rgba(32, 44, 68, 0.9);
  border-color: rgba(255, 255, 255, 0.15);
  color: #e5f3ff;
}

.help-toolbar__btn {
  width: 32px;
  height: 32px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 6px;
  background: none;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: inherit;
  transition: background 0.15s ease;
}

.help-toolbar__btn:hover {
  background: rgba(0, 0, 0, 0.06);
}

.help-toolbar__btn--active {
  background: rgba(15, 98, 254, 0.15);
  border-color: rgba(15, 98, 254, 0.4);
  color: #0f62fe;
}

.help-toolbar__btn--modern.help-toolbar__btn--active {
  background: rgba(96, 165, 250, 0.25);
  border-color: rgba(96, 165, 250, 0.5);
  color: #60a5fa;
}

.help-toolbar__btn--modern {
  border-color: rgba(255, 255, 255, 0.15);
}

.help-toolbar__btn--modern:hover {
  background: rgba(255, 255, 255, 0.08);
}

.help-toolbar__save {
  margin-left: auto;
  padding: 4px 12px;
  border: none;
  border-radius: 6px;
  background: #0f62fe;
  color: #fff;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.15s ease;
}

.help-toolbar__save:hover {
  background: #0043ce;
}

.help-toolbar__save:disabled {
  opacity: 0.6;
  cursor: default;
}

.help-toolbar__save--modern {
  background: #3b82f6;
}

.help-toolbar__save--modern:hover {
  background: #2563eb;
}

/* Contenteditable area */
.help-article__editable {
  min-height: 200px;
  padding: 12px;
  border: 1.5px solid rgba(0, 0, 0, 0.12);
  border-radius: 10px;
  background: #fff;
  font-size: 15px;
  line-height: 1.65;
  color: #374151;
  outline: none;
  overflow-y: auto;
  word-break: break-word;
}

.help-article__editable:focus {
  border-color: rgba(15, 98, 254, 0.5);
}

.help-article__editable--modern {
  background: rgba(20, 30, 48, 0.9);
  border-color: rgba(255, 255, 255, 0.12);
  color: #c8d8f0;
}

.help-article__editable--modern:focus {
  border-color: rgba(104, 171, 255, 0.5);
}

.help-article__editable :deep(img) {
  max-width: 100%;
  border-radius: 8px;
  cursor: pointer;
  margin: 8px 0;
  display: block;
}

/* Image delete button overlay */
.help-img-delete-btn {
  position: absolute;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 50%;
  background: rgba(239, 68, 68, 0.9);
  color: #fff;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  transition: background 0.15s ease;
}

.help-img-delete-btn:hover {
  background: rgba(220, 38, 38, 1);
}

/* Mobile: fullscreen panel */
@media (max-width: 768px) {
  .help-panel {
    width: 100vw;
  }
}
</style>
