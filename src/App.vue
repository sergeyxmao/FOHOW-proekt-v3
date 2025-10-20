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

watchEffect(() => {

function toggleLeftPanel() {
  isLeftPanelCollapsed.value = !isLeftPanelCollapsed.value
}
  
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
  margin:0; padding:0; width:100%; height:100%;
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

/* Левая панель */
.ui-panel-left{
  position: fixed;
  top: 20px;
  left: 0;
  z-index: 2000;
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  padding: 20px;
  background: var(--panel);
  border-radius: 0 24px 24px 0;
  box-shadow: var(--shadow);
}

.ui-panel-left.collapsed {
  top: 20px;
  padding: 16px 20px;
}

.ui-panel-left--modern {
  background: rgba(28, 38, 58, 0.92);
  box-shadow: 0 24px 44px rgba(8, 12, 22, 0.55);
}

/* Canvas/SVG */
#canvas{ 
  position:relative; 
  width:100%; 
  height:100%; 
  transform-origin:0 0; 
  cursor:default;
}

#svg-layer{
  position:absolute; 
  inset:0; 
  pointer-events:none; 
  overflow:visible;
  z-index:10;
}

.line{
  fill:none; 
  stroke:currentColor; 
  stroke-linecap:round;
  pointer-events:stroke;
  cursor:pointer;
  transition:stroke-width .15s, opacity .15s;
}

.line:hover{
  opacity:.85;
}

.line.selected{
  opacity:.7;
}
</style>
