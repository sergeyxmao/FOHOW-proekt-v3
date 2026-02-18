<script setup>
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useProjectActions } from '../../composables/useProjectActions.js'
import { useAuthStore } from '../../stores/auth.js'
import { useSubscriptionStore } from '../../stores/subscription.js'
import ExportSettingsModal from '../ExportSettingsModal.vue'

const props = defineProps({
  isModernTheme: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['request-close', 'clear-canvas', 'new-structure'])
const { t } = useI18n()
const authStore = useAuthStore()
const subscriptionStore = useSubscriptionStore()
const isAdmin = computed(() => authStore.user?.role === 'admin')
const isGuest = computed(() => subscriptionStore.currentPlan?.code_name === 'guest')
const {
  handleSaveProject,
  handleLoadProject,
  handleExportHTML,
  handleExportSVG,
  handleExportPNG
} = useProjectActions()

const showExportModal = ref(false)
const showClearCanvasDialog = ref(false)
const showNewStructureDialog = ref(false)
const activeSubmenus = ref(new Set())

const openExportModal = () => {
  showExportModal.value = true
}

const closeExportModal = () => {
  showExportModal.value = false
}

const toggleSubmenu = (itemId) => {
  if (activeSubmenus.value.has(itemId)) {
    activeSubmenus.value.delete(itemId)
  } else {
    activeSubmenus.value.add(itemId)
  }
  // Принудительно обновляем reactive ссылку
  activeSubmenus.value = new Set(activeSubmenus.value)
}

const isSubmenuActive = (itemId) => {
  return activeSubmenus.value.has(itemId)
}

const handleExport = async (settings) => {
  try {
    await handleExportPNG(settings)
  } finally {
    closeExportModal()
    emit('request-close')
  }
}

const handleClearCanvas = () => {
  showClearCanvasDialog.value = true
}

const confirmClearCanvas = () => {
  showClearCanvasDialog.value = false
  emit('clear-canvas')
  emit('request-close')
}

const cancelClearCanvas = () => {
  showClearCanvasDialog.value = false
}

const handleNewStructure = () => {
  showNewStructureDialog.value = true
}

const confirmNewStructure = (shouldSave) => {
  showNewStructureDialog.value = false
  emit('new-structure', shouldSave)
  emit('request-close')
}

const cancelNewStructure = () => {
  showNewStructureDialog.value = false
}

const items = computed(() => {
  const result = []

  result.push(
    {
      id: 'export-html',
      icon: '🌐',
      label: t('projectMenu.exportHtml'),
      tooltip: t('projectMenu.tooltips.exportHtml'),
      action: handleExportHTML,
      disabled: isGuest.value,
      hint: isGuest.value ? '(Индивидуальный/Премиум)' : null
    },
    {
      id: 'export-svg',
      icon: '🖨️',
      label: t('projectMenu.exportSvg'),
      tooltip: t('projectMenu.tooltips.exportSvg'),
      action: handleExportSVG,
      disabled: isGuest.value,
      hint: isGuest.value ? '(Индивидуальный/Премиум)' : null
    },
    {
      id: 'export-png',
      icon: '🖼️',
      label: t('projectMenu.saveAsImage'),
      tooltip: t('projectMenu.tooltips.saveAsImage'),
      action: openExportModal
    }
  )

  result.push({ id: 'sep-1', separator: true })

  result.push(
    {
      id: 'clear-canvas',
      icon: '🧹',
      label: t('projectMenu.clearCanvas'),
      tooltip: t('projectMenu.tooltips.clearCanvas'),
      action: handleClearCanvas
    },
    {
      id: 'new-structure',
      icon: '📄',
      label: t('projectMenu.newStructure'),
      tooltip: t('projectMenu.tooltips.newStructure'),
      action: handleNewStructure
    }
  )

  if (isAdmin.value) {
    result.push({ id: 'sep-2', separator: true })
    result.push(
      {
        id: 'save-json',
        icon: '💾',
        label: t('projectMenu.saveJson'),
        tooltip: t('projectMenu.tooltips.saveJson'),
        action: handleSaveProject
      },
      {
        id: 'load-json',
        icon: '📂',
        label: t('projectMenu.loadJson'),
        tooltip: t('projectMenu.tooltips.loadJson'),
        action: handleLoadProject
      }
    )
  }

  return result
})

const handleItemClick = async (item) => {
  // Предотвращаем выполнение для отключенных элементов
  if (item.disabled) {
    return
  }

  if (item.hasSubmenu) {
    toggleSubmenu(item.id)
    return
  }

  if (typeof item.action === 'function') {
    // Для элементов с собственными диалогами не закрываем меню сразу
    const hasOwnDialog = ['export-png', 'clear-canvas', 'new-structure'].includes(item.id)
    if (hasOwnDialog) {
      item.action()
    } else {
      try {
        const result = item.action()
        if (result instanceof Promise) {
          await result
        }
      } finally {
        emit('request-close')
      }
    }
  } else {
    emit('request-close')
  }
}
</script>

<template>
  <div class="project-menu-wrapper">
    <div
      class="project-menu"
      :class="{ 'project-menu--modern': props.isModernTheme }"
      role="menu"
    >
      <template v-for="item in items" :key="item.id">
        <div v-if="item.separator" class="project-menu__separator"></div>
        <div v-else class="project-menu__item-wrapper">
          <button
            type="button"
            class="project-menu__item"
            :class="{
              'project-menu__item--has-submenu': item.hasSubmenu,
              'project-menu__item--active': isSubmenuActive(item.id),
              'project-menu__item--disabled': item.disabled
            }"
            :disabled="item.disabled"
            role="menuitem"
            @click="handleItemClick(item)"
          >
            <span class="project-menu__icon" aria-hidden="true">{{ item.icon }}</span>
            <span class="project-menu__label">
              {{ item.label }}
              <span v-if="item.hint" class="project-menu__hint">{{ item.hint }}</span>
            </span>
            <span v-if="item.hasSubmenu" class="project-menu__arrow">▸</span>
            <span v-if="item.tooltip" class="project-menu__info" @click.stop>
              &#9432;
              <span class="project-menu__tooltip" v-html="item.tooltip"></span>
            </span>
          </button>

          <transition name="submenu-slide">
            <div v-if="item.hasSubmenu && isSubmenuActive(item.id)" class="project-menu__submenu">
              <template v-for="subitem in item.submenu" :key="subitem.id">
                <div class="project-menu__submenu-item-wrapper">
                  <button
                    type="button"
                    class="project-menu__submenu-item"
                    :class="{ 'project-menu__submenu-item--has-submenu': subitem.hasSubmenu, 'project-menu__submenu-item--active': isSubmenuActive(subitem.id) }"
                    @click="handleItemClick(subitem)"
                  >
                    <span class="project-menu__icon" aria-hidden="true">{{ subitem.icon }}</span>
                    <span class="project-menu__label">{{ subitem.label }}</span>
                    <span v-if="subitem.hasSubmenu" class="project-menu__arrow">▸</span>
                  </button>

                  <transition name="submenu-slide">
                    <div v-if="subitem.hasSubmenu && isSubmenuActive(subitem.id)" class="project-menu__submenu project-menu__submenu--nested">
                      <button
                        v-for="nestedItem in subitem.submenu"
                        :key="nestedItem.id"
                        type="button"
                        class="project-menu__submenu-item"
                        @click="handleItemClick(nestedItem)"
                      >
                        <span class="project-menu__icon" aria-hidden="true">{{ nestedItem.icon }}</span>
                        <span class="project-menu__label">{{ nestedItem.label }}</span>
                      </button>
                    </div>
                  </transition>
                </div>
              </template>
            </div>
          </transition>
        </div>
      </template>
    </div>

    <transition name="export-panel-fade">
      <div
        v-if="showExportModal"
        class="export-panel-container"
      >
        <ExportSettingsModal
          @close="closeExportModal"
          @export="handleExport"
        />
      </div>
    </transition>

    <!-- Диалог подтверждения очистки холста -->
    <Teleport to="body">
      <div v-if="showClearCanvasDialog" class="dialog-overlay" @click="cancelClearCanvas">
        <div class="dialog-content" @click.stop>
          <h3 class="dialog-title">{{ t('projectMenu.clearConfirmTitle') }}</h3>
          <p class="dialog-message">{{ t('projectMenu.clearConfirmMessage') }}</p>
          <div class="dialog-actions">
            <button class="dialog-button dialog-button--cancel" @click="cancelClearCanvas">
              {{ t('common.cancel') }}
            </button>
            <button class="dialog-button dialog-button--confirm" @click="confirmClearCanvas">
              {{ t('projectMenu.continueAction') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Диалог новой структуры -->
    <Teleport to="body">
      <div v-if="showNewStructureDialog" class="dialog-overlay" @click="cancelNewStructure">
        <div class="dialog-content" @click.stop>
          <h3 class="dialog-title">{{ t('projectMenu.newStructureTitle') }}</h3>
          <p class="dialog-message">{{ t('projectMenu.newStructureMessage') }}</p>
          <div class="dialog-actions">
            <button class="dialog-button dialog-button--cancel" @click="cancelNewStructure">
              {{ t('common.cancel') }}
            </button>
            <button class="dialog-button dialog-button--secondary" @click="confirmNewStructure(false)">
              {{ t('projectMenu.dontSave') }}
            </button>
            <button class="dialog-button dialog-button--confirm" @click="confirmNewStructure(true)">
              {{ t('projectMenu.saveAndCreate') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.project-menu {
  display: flex;
  flex-direction: column;
  padding: 12px;
  gap: 8px;
}

.project-menu__item-wrapper {
  position: relative;
}

.project-menu__item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-radius: 12px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(255, 255, 255, 0.95);
  color: #0f172a;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
  width: 100%;
}

.project-menu__item:hover {
  transform: translateX(2px);
  background: #ffc107;
  color: #000000;
  border-color: rgba(255, 193, 7, 0.8);
  box-shadow: 0 10px 24px rgba(255, 193, 7, 0.3);
}

.project-menu__item:active {
  transform: translateX(1px);
  background: #e8a900;
  color: #000000;
}

.project-menu__item--active {
  background: #ffc107;
  color: #000000;
  border-color: rgba(255, 193, 7, 0.8);
  box-shadow: 0 10px 24px rgba(255, 193, 7, 0.3);
}

.project-menu--modern .project-menu__item {
  border-color: rgba(96, 164, 255, 0.32);
  background: rgba(24, 34, 58, 0.92);
  color: #e5f3ff;
  box-shadow: 0 16px 32px rgba(6, 11, 21, 0.55);
}

.project-menu--modern .project-menu__item:hover {
  background: #ffc107;
  color: #000000;
  border-color: rgba(255, 193, 7, 0.85);
  box-shadow: 0 22px 40px rgba(255, 193, 7, 0.4);
}

.project-menu--modern .project-menu__item:active {
  background: #e8a900;
  color: #000000;
}

.project-menu__icon {
  font-size: 22px;
  width: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.project-menu__label {
  flex: 1;
  text-align: left;
  white-space: nowrap;
}

.project-menu__arrow {
  font-size: 14px;
  transition: transform 0.2s ease;
  margin-left: auto;
}

.project-menu__item--active .project-menu__arrow {
  transform: rotate(90deg);
}

.project-menu__submenu {
  margin-top: 8px;
  margin-left: 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.project-menu__submenu--nested {
  margin-left: 20px;
}

.project-menu__submenu-item-wrapper {
  position: relative;
}

.project-menu__submenu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 10px;
  border: 1px solid rgba(15, 23, 42, 0.06);
  background: rgba(255, 255, 255, 0.8);
  color: #0f172a;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease, transform 0.2s ease;
  width: 100%;
}

.project-menu__submenu-item:hover {
  transform: translateX(2px);
  background: #ffc107;
  color: #000000;
  border-color: rgba(255, 193, 7, 0.8);
  box-shadow: 0 8px 18px rgba(255, 193, 7, 0.25);
}

.project-menu__submenu-item--active {
  background: #ffc107;
  color: #000000;
  border-color: rgba(255, 193, 7, 0.8);
  box-shadow: 0 8px 18px rgba(255, 193, 7, 0.25);
}

.project-menu--modern .project-menu__submenu-item {
  border-color: rgba(96, 164, 255, 0.2);
  background: rgba(24, 34, 58, 0.85);
  color: #e5f3ff;
}

.project-menu--modern .project-menu__submenu-item:hover {
  background: #ffc107;
  color: #000000;
  border-color: rgba(255, 193, 7, 0.85);
  box-shadow: 0 10px 22px rgba(255, 193, 7, 0.35);
}

.submenu-slide-enter-active,
.submenu-slide-leave-active {
  transition: opacity 0.2s ease, max-height 0.3s ease;
  overflow: hidden;
  max-height: 500px;
}

.submenu-slide-enter-from,
.submenu-slide-leave-to {
  opacity: 0;
  max-height: 0;
}

.project-menu-wrapper {
  position: relative;
  display: flex;
  flex-direction: row;
  align-items: stretch;
}

.export-panel-container {
  position: absolute;
  left: calc(100% + 14px);
  top: 0;
  z-index: 100;
}

.export-panel-fade-enter-active,
.export-panel-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.export-panel-fade-enter-from {
  opacity: 0;
  transform: translateX(-10px);
}

.export-panel-fade-leave-to {
  opacity: 0;
  transform: translateX(-10px);
}

/* Стили для отключенного состояния */
.project-menu__item--disabled {
  opacity: 0.5;
  cursor: not-allowed !important;
  filter: grayscale(0.6);
  pointer-events: auto;
}

.project-menu__item--disabled:hover {
  transform: none !important;
  background: rgba(255, 255, 255, 0.95) !important;
  color: #0f172a !important;
  border-color: rgba(15, 23, 42, 0.08) !important;
  box-shadow: none !important;
}

.project-menu--modern .project-menu__item--disabled {
  opacity: 0.4;
}

.project-menu--modern .project-menu__item--disabled:hover {
  background: rgba(24, 34, 58, 0.92) !important;
  color: #e5f3ff !important;
  box-shadow: 0 16px 32px rgba(6, 11, 21, 0.55) !important;
}

/* Стили для подсказки */
.project-menu__hint {
  display: inline-block;
  margin-left: 6px;
  font-size: 11px;
  font-weight: 500;
  color: #64748b;
  opacity: 0.85;
}

.project-menu--modern .project-menu__hint {
  color: #94a3b8;
}

/* Info icon — скрыт по умолчанию, появляется при наведении на пункт меню */
.project-menu__info {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  font-size: 16px;
  border-radius: 50%;
  color: rgba(15, 23, 42, 0.35);
  opacity: 0;
  transition: opacity 0.2s ease, color 0.15s ease;
  cursor: help;
  flex-shrink: 0;
  margin-left: auto;
}

.project-menu__item:hover .project-menu__info {
  opacity: 1;
  color: rgba(0, 0, 0, 0.45);
}

.project-menu__info:hover {
  color: rgba(0, 0, 0, 0.7) !important;
}

/* Modern theme — info icon */
.project-menu--modern .project-menu__info {
  color: rgba(229, 243, 255, 0.35);
}

.project-menu--modern .project-menu__item:hover .project-menu__info {
  color: rgba(0, 0, 0, 0.45);
}

.project-menu--modern .project-menu__info:hover {
  color: rgba(0, 0, 0, 0.7) !important;
}

/* Tooltip — появляется при наведении на ⓘ */
.project-menu__tooltip {
  position: absolute;
  left: calc(100% + 14px);
  top: 50%;
  transform: translateY(-50%);
  width: 230px;
  padding: 10px 14px;
  background: rgba(15, 23, 42, 0.94);
  color: #f1f5f9;
  font-size: 12.5px;
  font-weight: 400;
  line-height: 1.5;
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.22);
  white-space: normal;
  text-align: left;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.2s ease;
  z-index: 10;
}

/* Стрелка тултипа */
.project-menu__tooltip::before {
  content: '';
  position: absolute;
  right: 100%;
  top: 50%;
  transform: translateY(-50%);
  border: 6px solid transparent;
  border-right-color: rgba(15, 23, 42, 0.94);
}

.project-menu__info:hover .project-menu__tooltip {
  opacity: 1;
}

/* Modern theme — tooltip */
.project-menu--modern .project-menu__tooltip {
  background: rgba(30, 42, 70, 0.96);
  border: 1px solid rgba(96, 164, 255, 0.25);
  box-shadow: 0 8px 24px rgba(6, 11, 21, 0.4);
}

.project-menu--modern .project-menu__tooltip::before {
  border-right-color: rgba(30, 42, 70, 0.96);
}

/* Разделитель */
.project-menu__separator {
  height: 1px;
  background: rgba(15, 23, 42, 0.08);
  margin: 4px 0;
}

.project-menu--modern .project-menu__separator {
  background: rgba(96, 164, 255, 0.15);
}

/* Диалоговые окна */
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  backdrop-filter: blur(4px);
}

.dialog-content {
  background: white;
  border-radius: 16px;
  padding: 24px;
  max-width: 400px;
  width: 90%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.dialog-title {
  margin: 0 0 12px 0;
  font-size: 18px;
  font-weight: 700;
  color: #0f172a;
}

.dialog-message {
  margin: 0 0 24px 0;
  font-size: 14px;
  line-height: 1.5;
  color: #475569;
}

.dialog-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.dialog-button {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.dialog-button--cancel {
  background: #e2e8f0;
  color: #475569;
}

.dialog-button--cancel:hover {
  background: #cbd5e1;
}

.dialog-button--secondary {
  background: #f59e0b;
  color: white;
}

.dialog-button--secondary:hover {
  background: #d97706;
}

.dialog-button--confirm {
  background: #ffc107;
  color: #000000;
}

.dialog-button--confirm:hover {
  background: #e8a900;
  box-shadow: 0 4px 12px rgba(255, 193, 7, 0.3);
}
</style>
