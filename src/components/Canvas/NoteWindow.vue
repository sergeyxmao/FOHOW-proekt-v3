<script setup>
import { computed, ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { storeToRefs } from 'pinia'  
import { useHistoryStore } from '../../stores/history'
import { useCardsStore } from '../../stores/cards'
import {
  ensureNoteStructure,
  formatLocalYMD,
  getNoteEntryInfo,
  getNoteIndicatorColor,
  normalizeYMD,
  parseYMDToDate,
  setNoteEntryValue
} from '../../utils/notes'

const NOTE_COLORS = ['#f44336', '#4caf50', '#42a5f5']
const MIN_SIZE = 200

const props = defineProps({
  card: {
    type: Object,
    required: true
  }
})

const cardsStore = useCardsStore()
const historyStore = useHistoryStore()
const { cards } = storeToRefs(cardsStore)

const ensuredNote = cardsStore.ensureCardNote(props.card.id)
const windowRef = ref(null)
const headerRef = ref(null)
const resizeHandleRef = ref(null)
const textareaRef = ref(null)
const textareaValue = ref('')
const viewDate = ref(new Date())
const textareaFocused = ref(false)

const note = computed(() => {
  const card = cards.value.find(cardItem => cardItem.id === props.card.id)
  return card?.note || ensuredNote
})

const windowStyle = computed(() => {
  const style = {
    left: `${note.value.x}px`,
    top: `${note.value.y}px`,
    width: `${Math.max(note.value.width || MIN_SIZE, MIN_SIZE)}px`,
    height: `${Math.max(note.value.height || MIN_SIZE, MIN_SIZE)}px`
  }
  const accent = getNoteIndicatorColor(note.value)
  if (accent) {
    style['--note-accent'] = accent
  }
  return style
})

const monthLabel = computed(() => {
  return viewDate.value.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
})

const daysOfWeek = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

const calendarCells = computed(() => {
  const base = viewDate.value
  const year = base.getFullYear()
  const month = base.getMonth()

  const firstDay = new Date(year, month, 1)
  const startIndex = (firstDay.getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrev = new Date(year, month, 0).getDate()

  const cells = []

  const makeCell = (dateObj, outMonth) => {
    const dateStr = formatLocalYMD(dateObj)
    const entryInfo = getNoteEntryInfo(note.value.entries?.[dateStr])
    const hasEntry = entryInfo.text.trim().length > 0
    const color = hasEntry ? (note.value.colors?.[dateStr] || note.value.highlightColor) : ''
    return {
      key: `${dateStr}-${outMonth ? 'out' : 'in'}`,
      date: dateStr,
      display: dateObj.getDate(),
      outMonth,
      hasEntry,
      color,
      isSelected: dateStr === note.value.selectedDate
    }
  }

  for (let i = 0; i < startIndex; i += 1) {
    const dateObj = new Date(year, month - 1, daysInPrev - startIndex + 1 + i)
    cells.push(makeCell(dateObj, true))
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateObj = new Date(year, month, day)
    cells.push(makeCell(dateObj, false))
  }

  while (cells.length < 42) {
    const nextIndex = cells.length - startIndex - daysInMonth + 1
    const dateObj = new Date(year, month + 1, nextIndex)
    cells.push(makeCell(dateObj, true))
  }

  return cells
})

const currentColor = computed(() => {
  return note.value.colors?.[note.value.selectedDate] || note.value.highlightColor || '#f44336'
})

function syncTextareaFromNote() {
  const entryInfo = getNoteEntryInfo(note.value.entries?.[note.value.selectedDate])
  textareaValue.value = entryInfo.text
}

watch(() => note.value.selectedDate, (newValue) => {
  const parsed = parseYMDToDate(newValue)
  if (parsed) {
    viewDate.value = new Date(parsed.getTime())
  }
  syncTextareaFromNote()
  nextTick(() => {
    if (textareaFocused.value && textareaRef.value) {
      textareaRef.value.focus()
    }
  })
})

watch(
  () => note.value.entries?.[note.value.selectedDate],
  (entry) => {
    const entryInfo = getNoteEntryInfo(entry)
    if (entryInfo.text !== textareaValue.value) {
      textareaValue.value = entryInfo.text
    }
  }
)

watch(textareaValue, (value) => {
  cardsStore.updateCardNote(props.card.id, (mutableNote) => {
    setNoteEntryValue(mutableNote, mutableNote.selectedDate, value)
  })
})

function shiftMonth(delta) {
  const nextDate = new Date(viewDate.value.getFullYear(), viewDate.value.getMonth() + delta, 1)
  viewDate.value = nextDate
}

function selectDate(dateStr) {
  cardsStore.updateCardNote(props.card.id, (mutableNote) => {
    const normalized = normalizeYMD(dateStr) || mutableNote.selectedDate
    mutableNote.selectedDate = normalized
  })
}

function setColor(color) {
  if (!color) return
  if (currentColor.value === color) return
  cardsStore.updateCardNote(props.card.id, (mutableNote) => {
    mutableNote.colors[mutableNote.selectedDate] = color
    mutableNote.highlightColor = color
  })
  historyStore.setActionMetadata('update', `Изменён цвет заметки карточки "${props.card.text}"`)
  historyStore.saveStateSoon()
}

function handleTextareaBlur() {
  textareaFocused.value = false
  historyStore.setActionMetadata('update', `Обновлена заметка карточки "${props.card.text}"`)
  historyStore.saveStateSoon()
}

function handleTextareaFocus() {
  textareaFocused.value = true
}

function closeNote() {
  cardsStore.updateCardNote(props.card.id, (mutableNote) => {
    mutableNote.visible = false
  })
  historyStore.setActionMetadata('update', `Закрыта заметка карточки "${props.card.text}"`)
  historyStore.saveStateSoon()
}

function setupDrag() {
  const header = headerRef.value
  if (!header) return

  const onPointerDown = (event) => {
    if (event.button !== 0) return
    if (event.target.closest('.note-close-btn')) return
    if (event.target.closest('.note-tools')) return

    event.preventDefault()
    const pointerId = event.pointerId
    const startX = event.clientX
    const startY = event.clientY
    const startNoteX = note.value.x
    const startNoteY = note.value.y

    if (header.setPointerCapture) {
      try { header.setPointerCapture(pointerId) } catch (err) { /* noop */ }
    }

    const onMove = (moveEvent) => {
      if (moveEvent.pointerId !== pointerId) return
      const dx = moveEvent.clientX - startX
      const dy = moveEvent.clientY - startY
      cardsStore.updateCardNote(props.card.id, (mutableNote) => {
        mutableNote.x = startNoteX + dx
        mutableNote.y = startNoteY + dy
      })
    }

    const finish = (endEvent) => {
      if (endEvent.pointerId !== pointerId) return
      if (header.releasePointerCapture) {
        try { header.releasePointerCapture(pointerId) } catch (err) { /* noop */ }
      }
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', finish)
      document.removeEventListener('pointercancel', cancel)
      historyStore.setActionMetadata('update', `Перемещено окно заметки карточки "${props.card.text}"`)
      historyStore.saveStateSoon()
    }

    const cancel = (cancelEvent) => {
      if (cancelEvent.pointerId !== pointerId) return
      if (header.releasePointerCapture) {
        try { header.releasePointerCapture(pointerId) } catch (err) { /* noop */ }
      }
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', finish)
      document.removeEventListener('pointercancel', cancel)
    }

    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', finish)
    document.addEventListener('pointercancel', cancel)
  }

  header.addEventListener('pointerdown', onPointerDown)

  return () => {
    header.removeEventListener('pointerdown', onPointerDown)
  }
}

function setupResize() {
  const handle = resizeHandleRef.value
  if (!handle) return

  const onPointerDown = (event) => {
    if (event.button !== 0) return
    event.preventDefault()
    const pointerId = event.pointerId
    const startX = event.clientX
    const startY = event.clientY
    const startWidth = note.value.width
    const startHeight = note.value.height

    if (handle.setPointerCapture) {
      try { handle.setPointerCapture(pointerId) } catch (err) { /* noop */ }
    }

    const onMove = (moveEvent) => {
      if (moveEvent.pointerId !== pointerId) return
      const dx = moveEvent.clientX - startX
      const dy = moveEvent.clientY - startY
      cardsStore.updateCardNote(props.card.id, (mutableNote) => {
        const nextWidth = Math.max(MIN_SIZE, startWidth + dx)
        const nextHeight = Math.max(MIN_SIZE, startHeight + dy)
        mutableNote.width = nextWidth
        mutableNote.height = nextHeight
      })
    }

    const finish = (endEvent) => {
      if (endEvent.pointerId !== pointerId) return
      if (handle.releasePointerCapture) {
        try { handle.releasePointerCapture(pointerId) } catch (err) { /* noop */ }
      }
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', finish)
      document.removeEventListener('pointercancel', cancel)
      historyStore.setActionMetadata('update', `Изменён размер заметки карточки "${props.card.text}"`)
      historyStore.saveStateSoon()
    }

    const cancel = (cancelEvent) => {
      if (cancelEvent.pointerId !== pointerId) return
      if (handle.releasePointerCapture) {
        try { handle.releasePointerCapture(pointerId) } catch (err) { /* noop */ }
      }
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', finish)
      document.removeEventListener('pointercancel', cancel)
    }

    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', finish)
    document.addEventListener('pointercancel', cancel)
  }

  handle.addEventListener('pointerdown', onPointerDown)

  return () => {
    handle.removeEventListener('pointerdown', onPointerDown)
  }
}

let cleanupDrag = null
let cleanupResize = null

onMounted(() => {
  const ensured = cardsStore.ensureCardNote(props.card.id)
  ensured.visible = true
  ensureNoteStructure(ensured)
  if (!ensured.width || ensured.width < MIN_SIZE) ensured.width = MIN_SIZE
  if (!ensured.height || ensured.height < MIN_SIZE) ensured.height = MIN_SIZE
  if (!ensured.selectedDate) ensured.selectedDate = formatLocalYMD(new Date())
  cardsStore.updateCardNote(props.card.id, ensured)

  const parsed = parseYMDToDate(ensured.selectedDate)
  if (parsed) viewDate.value = parsed
  syncTextareaFromNote()
  cleanupDrag = setupDrag()
  cleanupResize = setupResize()
  nextTick(() => {
    if (textareaRef.value) {
      textareaRef.value.focus()
      textareaFocused.value = true
    }
  })
})

onBeforeUnmount(() => {
  if (cleanupDrag) cleanupDrag()
  if (cleanupResize) cleanupResize()
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="note.visible"
      ref="windowRef"
      class="note-window"
      :style="windowStyle"
    >
      <div class="note-header" ref="headerRef">
        <button class="note-close-btn" type="button" title="Закрыть" @click="closeNote">×</button>
        <div class="note-tools">
          <button
            v-for="color in NOTE_COLORS"
            :key="color"
            class="clr-dot"
            type="button"
            :class="{ active: color === currentColor }"
            :style="{ background: color }"
            @click="setColor(color)"
          ></button>
        </div>
      </div>
      <div class="note-content-scroller">
        <div class="note-cal-wrap">
          <div class="cal-head">
            <button class="cal-btn prev" type="button" @click="shiftMonth(-1)">‹</button>
            <div class="cal-month">{{ monthLabel }}</div>
            <button class="cal-btn next" type="button" @click="shiftMonth(1)">›</button>
          </div>
          <div class="cal-grid">
            <div v-for="dow in daysOfWeek" :key="dow" class="cal-dow">{{ dow }}</div>
            <button
              v-for="cell in calendarCells"
              :key="cell.key"
              type="button"
              class="cal-cell"
              :class="{
                out: cell.outMonth,
                selected: cell.isSelected,
                'has-entry': cell.hasEntry
              }"
              :style="cell.hasEntry ? { background: cell.color, color: '#fff' } : {}"
              @click="selectDate(cell.date)"
            >
              {{ cell.display }}
            </button>
          </div>
        </div>
        <textarea
          ref="textareaRef"
          class="note-textarea"
          placeholder="Введите текст заметки..."
          v-model="textareaValue"
          @focus="handleTextareaFocus"
          @blur="handleTextareaBlur"
        ></textarea>
      </div>
      <div ref="resizeHandleRef" class="note-resize-handle"></div>
    </div>
  </Teleport>
</template>

<style scoped>
.note-window {
  position: fixed;
  z-index: 1000;
  background: #fff;
  border: 1px solid var(--note-accent, #e5e7eb);
  border-radius: 12px;
  box-shadow: 0 20px 40px rgba(15, 23, 42, 0.28);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 200px;
  min-height: 200px;
  transition: box-shadow 0.2s ease;
}

.note-window:focus-within {
  box-shadow: 0 24px 50px rgba(15, 23, 42, 0.32);
}

.note-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  background: linear-gradient(135deg, var(--note-accent, #f87171), #fef2f2);
  color: #111827;
  user-select: none;
  cursor: grab;
}

.note-close-btn {
  font-size: 20px;
  cursor: pointer;
  padding: 0 8px;
  border: none;
  background: transparent;
  line-height: 1;
}

.note-tools {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-left: auto;
}

.clr-dot {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid #333;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  padding: 0;
}

.clr-dot.active {
  box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.25), inset 0 0 0 2px #fff;
}

.note-content-scroller {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.note-cal-wrap {
  padding: 6px 8px 0 8px;
}

.cal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
  font-weight: 700;
  font-size: 12px;
}

.cal-btn {
  border: none;
  border-radius: 6px;
  padding: 2px 6px;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  background: #fff;
}

.cal-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
  font-size: 11px;
}

.cal-dow {
  opacity: 0.7;
  text-align: center;
}

.cal-cell {
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  cursor: pointer;
  background: #fff;
  border: none;
  font: inherit;
}

.cal-cell.out {
  opacity: 0.35;
}

.cal-cell.selected {
  outline: 2px solid #4caf50;
}

.cal-cell.has-entry {
  box-shadow: inset 0 0 0 2px rgba(0, 0, 0, 0.08);
}

.note-textarea {
  margin: 8px;
  flex: 1;
  resize: none;
  border-radius: 10px;
  border: 1px solid var(--note-accent, rgba(17, 24, 39, 0.12));
  padding: 10px 12px;
  font-size: 14px;
  line-height: 1.4;
  color: #111827;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.08);
}

.note-resize-handle {
  height: 14px;
  background: linear-gradient(135deg, rgba(15, 23, 42, 0.08), rgba(15, 23, 42, 0.02));
  cursor: nwse-resize;
}
</style>
