<script setup>
import { ref } from 'vue'
import CanvasBoard from './components/Canvas/CanvasBoard.vue'
import ControlPanel from './components/Panels/ControlPanel.vue'
import RightPanel from './components/Panels/RightPanel.vue'
</script>

<template>
  <div id="app">
    <!-- Левая панель -->
    <div class="ui-panel-left">
      <ControlPanel />
    </div>

    <!-- Правая панель -->
    <RightPanel />

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
</style>
