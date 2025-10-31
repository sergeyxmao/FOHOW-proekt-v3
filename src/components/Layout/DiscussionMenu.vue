 (cd "$(git rev-parse --show-toplevel)" && git apply --3way <<'EOF' 
diff --git a/src/components/Layout/DiscussionMenu.vue b/src/components/Layout/DiscussionMenu.vue
new file mode 100644
index 0000000000000000000000000000000000000000..22b7c165a9f27fd7e8991fd1f5c582811df242bf
--- /dev/null
+++ b/src/components/Layout/DiscussionMenu.vue
@@ -0,0 +1,398 @@
+<script setup>
+import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
+import { storeToRefs } from 'pinia'
+import { useNotesStore } from '../../stores/notes.js'
+import { useCardsStore } from '../../stores/cards.js'
+import { useBoardCommentsStore } from '../Panels/boardComments.js'
+import BoardComments from '../Panels/BoardComments.vue'
+
+const emit = defineEmits(['request-close'])
+
+const notesStore = useNotesStore()
+const cardsStore = useCardsStore()
+const boardCommentsStore = useBoardCommentsStore()
+
+const { dropdownOpen, cardsWithEntries } = storeToRefs(notesStore)
+const { hasComments: hasBoardComments } = storeToRefs(boardCommentsStore)
+
+const hasNoteEntries = computed(() => notesStore.hasEntries)
+const showComments = ref(false)
+
+const closePanels = () => {
+  notesStore.closeDropdown()
+  showComments.value = false
+}
+
+const handleNotesToggle = () => {
+  if (!hasNoteEntries.value) {
+    notesStore.closeDropdown()
+    return
+  }
+  showComments.value = false
+  notesStore.toggleDropdown()
+}
+
+const handleCommentsToggle = () => {
+  if (showComments.value) {
+    showComments.value = false
+  } else {
+    notesStore.closeDropdown()
+    showComments.value = true
+  }
+}
+
+const handleNoteItemClick = (cardId) => {
+  notesStore.requestOpen(cardId, { focus: true })
+  emit('request-close')
+}
+
+const handleNoteEntryClick = (cardId, date) => {
+  notesStore.requestOpen(cardId, { focus: true, date })
+  emit('request-close')
+}
+
+const handleNoteEntryDelete = (cardId, date) => {
+  cardsStore.removeCardNoteEntry(cardId, date)
+}
+
+const handleCardNotesDelete = (cardId) => {
+  cardsStore.clearCardNotes(cardId)
+}
+
+const handleEscape = (event) => {
+  if (event.key === 'Escape') {
+    if (dropdownOpen.value || showComments.value) {
+      closePanels()
+      emit('request-close')
+    }
+  }
+}
+
+onMounted(() => {
+  window.addEventListener('keydown', handleEscape)
+})
+
+onBeforeUnmount(() => {
+  window.removeEventListener('keydown', handleEscape)
+  closePanels()
+})
+</script>
+
+<template>
+  <div class="discussion-menu">
+    <div class="discussion-menu__title">Обсуждение</div>
+
+    <div class="discussion-menu__item">
+      <span class="discussion-menu__icon" aria-hidden="true">🗒️</span>
+      <button
+        type="button"
+        class="discussion-menu__action"
+        :class="{ 'discussion-menu__action--active': dropdownOpen }"
+        :disabled="!hasNoteEntries"
+        @click="handleNotesToggle"
+      >
+        Список заметок
+      </button>
+    </div>
+
+    <transition name="discussion-menu-panel">
+      <div
+        v-if="dropdownOpen"
+        class="discussion-menu__panel discussion-menu__panel--notes"
+      >
+        <div
+          v-for="item in cardsWithEntries"
+          :key="item.id"
+          class="discussion-menu__group"
+        >
+          <div class="discussion-menu__card-row">
+            <button
+              type="button"
+              class="discussion-menu__card-button"
+              @click="handleNoteItemClick(item.id)"
+            >
+              📝 {{ item.title }}
+            </button>
+            <button
+              type="button"
+              class="discussion-menu__icon-button discussion-menu__icon-button--danger"
+              title="Удалить все заметки"
+              @click="handleCardNotesDelete(item.id)"
+            >
+              🗑️
+            </button>
+          </div>
+          <div class="discussion-menu__entries">
+            <div
+              v-for="entry in item.entries"
+              :key="entry.date"
+              class="discussion-menu__entry"
+            >
+              <button
+                type="button"
+                class="discussion-menu__entry-button"
+                @click="handleNoteEntryClick(item.id, entry.date)"
+              >
+                <span
+                  class="discussion-menu__entry-color"
+                  :style="{ backgroundColor: entry.color }"
+                ></span>
+                <span class="discussion-menu__entry-label">{{ entry.label }}</span>
+              </button>
+              <button
+                type="button"
+                class="discussion-menu__icon-button"
+                title="Удалить заметку"
+                @click="handleNoteEntryDelete(item.id, entry.date)"
+              >
+                🗑️
+              </button>
+            </div>
+          </div>
+        </div>
+      </div>
+    </transition>
+
+    <div class="discussion-menu__item">
+      <span class="discussion-menu__icon" aria-hidden="true">💬</span>
+      <button
+        type="button"
+        class="discussion-menu__action"
+        :class="{ 'discussion-menu__action--active': showComments }"
+        @click="handleCommentsToggle"
+      >
+        Комментарии доски
+      </button>
+      <span
+        v-if="hasBoardComments"
+        class="discussion-menu__badge"
+        aria-hidden="true"
+      ></span>
+    </div>
+
+    <transition name="discussion-menu-panel">
+      <div
+        v-if="showComments"
+        class="discussion-menu__panel discussion-menu__panel--comments"
+      >
+        <BoardComments />
+      </div>
+    </transition>
+  </div>
+</template>
+
+<style scoped>
+.discussion-menu {
+  display: flex;
+  flex-direction: column;
+  gap: 12px;
+  padding: 16px;
+  min-width: 280px;
+}
+
+.discussion-menu__title {
+  font-size: 15px;
+  font-weight: 700;
+  color: #1f2937;
+}
+
+.discussion-menu__item {
+  display: flex;
+  align-items: center;
+  gap: 12px;
+  position: relative;
+}
+
+.discussion-menu__icon {
+  display: grid;
+  place-items: center;
+  width: 38px;
+  height: 38px;
+  border-radius: 14px;
+  background: rgba(59, 130, 246, 0.12);
+  font-size: 20px;
+}
+
+.discussion-menu__action {
+  flex: 1;
+  text-align: left;
+  padding: 12px 16px;
+  border-radius: 14px;
+  border: 1px solid rgba(15, 23, 42, 0.12);
+  background: rgba(255, 255, 255, 0.92);
+  color: #0f172a;
+  font-size: 14px;
+  font-weight: 600;
+  cursor: pointer;
+  transition: background 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
+}
+
+.discussion-menu__action:disabled {
+  opacity: 0.5;
+  cursor: not-allowed;
+}
+
+.discussion-menu__action:not(:disabled):hover {
+  background: rgba(59, 130, 246, 0.16);
+  transform: translateY(-1px);
+  box-shadow: 0 12px 20px rgba(15, 23, 42, 0.12);
+}
+
+.discussion-menu__action--active {
+  background: linear-gradient(120deg, #3b82f6 0%, #2563eb 100%);
+  color: #fff;
+  box-shadow: 0 16px 28px rgba(37, 99, 235, 0.32);
+}
+
+.discussion-menu__badge {
+  position: absolute;
+  top: 6px;
+  right: 6px;
+  width: 10px;
+  height: 10px;
+  border-radius: 50%;
+  background: #3b82f6;
+  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.18);
+}
+
+.discussion-menu__panel {
+  display: flex;
+  flex-direction: column;
+  gap: 12px;
+  padding: 14px;
+  margin-left: 50px;
+  border: 1px solid rgba(15, 23, 42, 0.12);
+  border-radius: 16px;
+  background: rgba(248, 250, 252, 0.96);
+  box-shadow: 0 18px 32px rgba(15, 23, 42, 0.18);
+}
+
+.discussion-menu__panel--comments {
+  max-height: 360px;
+  overflow: auto;
+}
+
+.discussion-menu__group {
+  display: flex;
+  flex-direction: column;
+  gap: 10px;
+}
+
+.discussion-menu__group + .discussion-menu__group {
+  border-top: 1px solid rgba(15, 23, 42, 0.12);
+  padding-top: 12px;
+}
+
+.discussion-menu__card-row {
+  display: flex;
+  align-items: center;
+  gap: 8px;
+}
+
+.discussion-menu__card-button {
+  flex: 1;
+  padding: 10px 14px;
+  border-radius: 14px;
+  border: 1px solid rgba(15, 23, 42, 0.16);
+  background: rgba(255, 255, 255, 0.92);
+  color: #0f172a;
+  font-weight: 600;
+  font-size: 14px;
+  display: flex;
+  align-items: center;
+  gap: 8px;
+  cursor: pointer;
+  transition: background 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
+}
+
+.discussion-menu__card-button:hover {
+  background: rgba(59, 130, 246, 0.15);
+  box-shadow: 0 12px 22px rgba(37, 99, 235, 0.2);
+  transform: translateY(-1px);
+}
+
+.discussion-menu__entries {
+  display: flex;
+  flex-direction: column;
+  gap: 8px;
+}
+
+.discussion-menu__entry {
+  display: flex;
+  align-items: center;
+  gap: 6px;
+}
+
+.discussion-menu__entry-button {
+  flex: 1;
+  display: flex;
+  align-items: center;
+  gap: 10px;
+  padding: 8px 12px;
+  border-radius: 12px;
+  border: 1px solid rgba(15, 23, 42, 0.12);
+  background: rgba(255, 255, 255, 0.92);
+  color: #0f172a;
+  cursor: pointer;
+  transition: background 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
+}
+
+.discussion-menu__entry-button:hover {
+  background: rgba(59, 130, 246, 0.15);
+  box-shadow: 0 10px 20px rgba(15, 23, 42, 0.16);
+  transform: translateY(-1px);
+}
+
+.discussion-menu__entry-color {
+  width: 14px;
+  height: 14px;
+  border-radius: 6px;
+  box-shadow: inset 0 1px 1px rgba(15, 23, 42, 0.12);
+}
+
+.discussion-menu__entry-label {
+  font-size: 13px;
+  font-weight: 500;
+}
+
+.discussion-menu__icon-button {
+  width: 38px;
+  height: 38px;
+  border-radius: 12px;
+  border: 1px solid rgba(15, 23, 42, 0.12);
+  background: rgba(248, 250, 252, 0.92);
+  color: #475569;
+  font-size: 18px;
+  display: grid;
+  place-items: center;
+  cursor: pointer;
+  transition: background 0.2s ease, color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
+}
+
+.discussion-menu__icon-button:hover {
+  background: rgba(59, 130, 246, 0.12);
+  color: #1d4ed8;
+  box-shadow: 0 12px 20px rgba(15, 23, 42, 0.14);
+  transform: translateY(-1px);
+}
+
+.discussion-menu__icon-button--danger {
+  color: #dc2626;
+}
+
+.discussion-menu__icon-button--danger:hover {
+  background: rgba(248, 113, 113, 0.16);
+  color: #b91c1c;
+}
+
+.discussion-menu-panel-enter-active,
+.discussion-menu-panel-leave-active {
+  transition: opacity 0.18s ease, transform 0.18s ease;
+}
+
+.discussion-menu-panel-enter-from,
+.discussion-menu-panel-leave-to {
+  opacity: 0;
+  transform: translateY(-6px);
+}
+</style>
 
EOF
)
