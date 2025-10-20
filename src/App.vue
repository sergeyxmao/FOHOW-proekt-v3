<script setup>
import { ref, watchEffect } from 'vue'
import CanvasBoard from './components/Canvas/CanvasBoard.vue'
import ControlPanel from './components/Panels/ControlPanel.vue'
import RightPanel from './components/Panels/RightPanel.vue'

const isModernTheme = ref(false)
const isLeftPanelCollapsed = ref(false)  

function toggleTheme() {
  isModernTheme.value = !isModernTheme.value
}

function toggleLeftPanel() {
  isLeftPanelCollapsed.value = !isLeftPanelCollapsed.value
}

watchEffect(() => {
  document.body.classList.toggle('theme-modern', isModernTheme.value)
})  
</script>

<template>
  <div id="app" :class="{ 'theme-modern': isModernTheme }">
    <!-- Левая панель -->
    <div
      :class="[
        'ui-panel-left',
        {
          collapsed: isLeftPanelCollapsed,
          'ui-panel-left--modern': isModernTheme,
          'ui-panel-left--classic': !isModernTheme
        }
      ]"
    >
      <ControlPanel
        :is-modern-theme="isModernTheme"
        :is-collapsed="isLeftPanelCollapsed"
        @toggle-theme="toggleTheme"
        @toggle-collapse="toggleLeftPanel"
      />
    </div>

    <!-- Правая панель -->
    <RightPanel :is-modern-theme="isModernTheme" />

    <div id="canvas">
      <CanvasBoard />
    </div>
  </div>
</template>

<style>
:root{
  --card-width: 380px;
  --brand: #0f62fe;
  --ink: #111827;
  --muted: #6b7280;
  --panel: #ffffff;
  --surface: #ffffff;
  --bg: #f5f7fb;
  --radius: 14px;
  --shadow: 0 8px 20px rgba(0,0,0,.12);
}

html,body{
  margin:0; 
  padding:0; 
  width:100%; 
  height:100%;
  overflow:hidden;
  background: var(--bg);
  font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
  color: var(--ink);
  user-select: none;
}

#app {
  position: relative;
  width: 100%;
  height: 100%;
}

/* Левая панель - статичная, не зависит от масштабирования */
.ui-panel-left{
  position: fixed;
  top: 20px;
  left: 0;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px 20px;
  background: var(--panel);
  border-radius: 0 24px 24px 0;
  box-shadow: var(--shadow);
  transition: all .3s ease;
}

.ui-panel-left--classic {
  gap: 16px;
}

/* Классический интерфейс - кнопки увеличены в 2 раза */
.ui-panel-left--classic .ui-btn {
  width: 80px !important;
  height: 80px !important;
  font-size: 36px !important;
}

.ui-panel-left--classic .theme-toggle__icon {
  width: 28px !important;
  height: 28px !important;
}

.ui-panel-left--classic .left-panel-controls__collapse {
  width: 56px !important;
  font-size: 27px !important;
}

/* При свертывании левой панели - показываем только верхние кнопки */
.ui-panel-left.collapsed {
  top: 16px;
  left: 0;
  transform: none !important;
  padding: 16px 20px;
}

.ui-panel-left.collapsed .left-panel-controls__grid {
  display: none !important;
}

/* Кнопка свернуть в классическом интерфейсе - на правом краю панели */
.ui-panel-left--classic .left-panel-controls__top {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.ui-panel-left--classic .left-panel-controls__collapse {
  order: 3;
}

/* Canvas/SVG */
#canvas { 
  position: relative; 
  width: 100%; 
  height: 100%; 
  transform-origin: 0 0; 
  cursor: default;
}
</style>
