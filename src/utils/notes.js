const NOTE_DEFAULT_WIDTH = 260
const NOTE_DEFAULT_HEIGHT = 380

export function formatLocalYMD(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return ''
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function normalizeYMD(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  return formatLocalYMD(parsed)
}

export function parseYMDToDate(value) {
  const normalized = normalizeYMD(value)
  if (!normalized) return null
  const parts = normalized.split('-').map(Number)
  if (parts.length !== 3) return null
  const [year, month, day] = parts
  return new Date(year, month - 1, day)
}

export function getNoteEntryInfo(entry) {
  if (!entry) return { text: '', updatedAt: null }
  if (typeof entry === 'string') return { text: entry, updatedAt: null }
  if (typeof entry === 'object') {
    const text = typeof entry.text === 'string' ? entry.text : ''
    const updatedAt = typeof entry.updatedAt === 'string' ? entry.updatedAt : null
    return { text, updatedAt }
  }
  return { text: '', updatedAt: null }
}

export function setNoteEntryValue(note, date, value) {
  if (!note || !date) return
  if (!note.entries || typeof note.entries !== 'object') note.entries = {}
  const key = normalizeYMD(date)
  if (!key) return
  const raw = value ?? ''
  const trimmed = raw.trim()
  if (trimmed) {
    note.entries[key] = { text: raw, updatedAt: new Date().toISOString() }
  } else {
    delete note.entries[key]
  }
}

export function hasAnyEntry(note) {
  if (!note || !note.entries || typeof note.entries !== 'object') return false
  return Object.values(note.entries).some((entry) => {
    const info = getNoteEntryInfo(entry)
    return info.text.trim().length > 0
  })
}

export function ensureNoteStructure(note = null) {
  const normalized = note && typeof note === 'object' ? note : {}
  if (!normalized.entries || typeof normalized.entries !== 'object') normalized.entries = {}
  if (!normalized.colors || typeof normalized.colors !== 'object') normalized.colors = {}

  const today = formatLocalYMD(new Date())
  normalized.selectedDate = normalizeYMD(normalized.selectedDate) || today
  normalized.highlightColor = typeof normalized.highlightColor === 'string' && normalized.highlightColor.trim()
    ? normalized.highlightColor
    : '#f44336'

  Object.entries({ ...normalized.entries }).forEach(([date, entry]) => {
    const normalizedDate = normalizeYMD(date)
    if (!normalizedDate) {
      delete normalized.entries[date]
      return
    }
    const info = getNoteEntryInfo(entry)
    if (!info.text.trim()) {
      delete normalized.entries[date]
      return
    }
    if (normalizedDate !== date) {
      delete normalized.entries[date]
      normalized.entries[normalizedDate] = { text: info.text, updatedAt: info.updatedAt || null }
    } else {
      normalized.entries[date] = { text: info.text, updatedAt: info.updatedAt || null }
    }
  })

  const normalizedColors = {}
  Object.entries(normalized.colors).forEach(([date, color]) => {
    const normalizedDate = normalizeYMD(date)
    if (!normalizedDate) return
    if (typeof color === 'string' && color.trim()) {
      normalizedColors[normalizedDate] = color
    }
  })
  normalized.colors = normalizedColors

  if (typeof normalized.width !== 'number' || Number.isNaN(normalized.width) || normalized.width < 200) {
    normalized.width = NOTE_DEFAULT_WIDTH
  }
  if (typeof normalized.height !== 'number' || Number.isNaN(normalized.height) || normalized.height < 200) {
    normalized.height = NOTE_DEFAULT_HEIGHT
  }
  if (typeof normalized.x !== 'number' || Number.isNaN(normalized.x)) normalized.x = 0
  if (typeof normalized.y !== 'number' || Number.isNaN(normalized.y)) normalized.y = 0
  normalized.visible = Boolean(normalized.visible)

  if (normalized.text && !normalized.entries[normalized.selectedDate]) {
    normalized.entries[normalized.selectedDate] = { text: normalized.text, updatedAt: null }
    delete normalized.text
  }

  return normalized
}

export function serializeNoteForExport(note) {
  if (!note || typeof note !== 'object') return null

  const cloned = JSON.parse(JSON.stringify(note))
  const normalized = ensureNoteStructure(cloned)

  if (!hasAnyEntry(normalized)) {
    return null
  }

  const serializedEntries = {}
  Object.entries(normalized.entries).forEach(([date, entry]) => {
    const normalizedDate = normalizeYMD(date)
    if (!normalizedDate) return
    const info = getNoteEntryInfo(entry)
    if (!info.text.trim()) return
    serializedEntries[normalizedDate] = {
      text: info.text,
      updatedAt: info.updatedAt || null
    }
  })

  const serializedColors = {}
  Object.entries(normalized.colors).forEach(([date, color]) => {
    const normalizedDate = normalizeYMD(date)
    if (!normalizedDate) return
    if (typeof color === 'string' && color.trim()) {
      serializedColors[normalizedDate] = color
    }
  })

  return {
    entries: serializedEntries,
    colors: serializedColors,
    selectedDate: normalized.selectedDate,
    highlightColor: normalized.highlightColor,
    width: normalized.width,
    height: normalized.height,
    x: normalized.x,
    y: normalized.y,
    visible: Boolean(normalized.visible)
  }
}

export function getNoteIndicatorColor(note) {
  if (!note) return ''
  ensureNoteStructure(note)
  if (note.selectedDate) {
    const selectedColor = note.colors?.[note.selectedDate]
    if (selectedColor) return selectedColor
  }
  if (note.highlightColor) return note.highlightColor
  if (note.colors) {
    const firstColor = Object.values(note.colors).find((c) => typeof c === 'string' && c.trim())
    if (firstColor) return firstColor
  }
  return ''
}

export function formatNoteDateTime(dateStr, updatedAt) {
  let datePart = dateStr
  if (typeof dateStr === 'string') {
    const segments = dateStr.split('-')
    if (segments.length === 3) {
      datePart = `${segments[2]}.${segments[1]}.${segments[0]}`
    }
  }
  let timePart = '--:--'
  if (updatedAt) {
    const dt = new Date(updatedAt)
    if (!Number.isNaN(dt.getTime())) {
      const hours = String(dt.getHours()).padStart(2, '0')
      const minutes = String(dt.getMinutes()).padStart(2, '0')
      timePart = `${hours}.${minutes}`
    }
  }
  return { datePart, timePart }
}

export function collectNoteItems(cards = []) {
  const items = []
  cards.forEach((card) => {
    if (!card || !card.note) return
    const note = ensureNoteStructure(card.note)
    Object.entries(note.entries).forEach(([date, entry]) => {
      const info = getNoteEntryInfo(entry)
      const pure = info.text.trim()
      if (!pure) return
      const firstLine = pure.split('\n')[0]
      const color = (note.colors && note.colors[date]) || note.highlightColor || '#f44336'
      items.push({
        cardId: card.id,
        cardTitle: card.text,
        date,
        color,
        firstLine,
        updatedAt: info.updatedAt || null
      })
    })
  })

  items.sort((a, b) => {
    const baseA = parseYMDToDate(a.date)?.getTime() ?? Number.POSITIVE_INFINITY
    const baseB = parseYMDToDate(b.date)?.getTime() ?? Number.POSITIVE_INFINITY
    if (baseA !== baseB) return baseA - baseB
    const updA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0
    const updB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0
    if (!Number.isNaN(updA) && !Number.isNaN(updB) && updA !== updB) return updA - updB
    return a.firstLine.localeCompare(b.firstLine)
  })

  return items
}

export function noteHasAnyText(card) {
  return card && card.note ? hasAnyEntry(card.note) : false
}

export function defaultNotePositionFromRect(rect) {
  if (!rect) return { x: 0, y: 0 }
  return { x: rect.right + 15, y: rect.top }
}

export const NOTE_DEFAULT_SIZE = {
  width: NOTE_DEFAULT_WIDTH,
  height: NOTE_DEFAULT_HEIGHT
}
