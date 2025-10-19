<script setup>
import { ref, watchEffect } from 'vue'
import CanvasBoard from './components/Canvas/CanvasBoard.vue'
import ControlPanel from './components/Panels/ControlPanel.vue'
import RightPanel from './components/Panels/RightPanel.vue'

const isModernTheme = ref(false)

function toggleTheme() {
  isModernTheme.value = !isModernTheme.value
}

watchEffect(() => {
  document.body.classList.toggle('theme-modern', isModernTheme.value)
})  
</script>

<template>
  <div id="app" :class="{ 'theme-modern': isModernTheme }">
    <!-- Левая панель -->
    <div class="ui-panel-left">
      <ControlPanel :is-modern-theme="isModernTheme" @toggle-theme="toggleTheme" />
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

/* Панели */
.ui-panel-left{
  position:fixed; top:20px; left:20px; z-index:2000;
  display:flex; align-items:center; gap:8px;
  background: var(--panel);
  padding:6px 8px; border-radius: var(--radius); box-shadow: var(--shadow);
}
.ui-panel-left.collapsed{
  padding-right:6px;
}
.ui-panel-left.collapsed .ui-btn:not(#undo-btn):not(#redo-btn):not(.ui-panel-toggle){
  display:none;
}
/* Canvas/SVG */
#canvas{ position:relative; width:100%; height:100%; transform-origin:0 0; cursor:default; }

#app.theme-modern {
  --card-width: 400px;
  --bg: #efe4d1;
  --panel: rgba(18, 24, 34, 0.88);
  --surface: rgba(24, 32, 46, 0.92);
  --ink: #f4f7fb;
  --muted: #9ba5b7;
  --brand: #59d0ff;
  --radius: 18px;
  --shadow: 0 16px 34px rgba(8, 11, 18, 0.45);
}

body.theme-modern {
  background: linear-gradient(145deg, #f3e9d6 0%, #efe3ce 48%, #f8efe0 100%);
  color: #f4f7fb;
}

.theme-modern .ui-panel-left{
  top:50%;
  left:32px;
  transform: translateY(-50%);
  flex-direction: column;
  align-items: stretch;
  padding: 24px 16px;
  gap: 18px;
  width: 88px;
  min-height: 400px;
  border-radius: 26px;
  background: linear-gradient(190deg, rgba(19,25,38,0.95) 0%, rgba(9,14,24,0.96) 100%);
  box-shadow: 0 20px 40px rgba(5, 8, 14, 0.65);
}

.theme-modern .ui-panel-left.collapsed{
  padding-right: 16px;
}

.theme-modern #canvas{
  position: absolute;
  top: 32px;
  right: 32px;
  bottom: 32px;
  left: 128px;  
  background: rgba(255,255,255,0.45);
  border-radius: 28px;
  box-shadow: 0 28px 48px rgba(6, 11, 21, 0.22);
}
</style>
