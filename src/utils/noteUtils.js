import { reactive } from 'vue';

export const NOTE_COLORS = ['#f44336', '#4caf50', '#42a5f5'];
export const DEFAULT_NOTE_WIDTH = 260;
export const DEFAULT_NOTE_HEIGHT = 380;
const MIN_NOTE_WIDTH = 200;
const MIN_NOTE_HEIGHT = 200;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function normalizeYMD(value) {
  if (!value) {
    return '';
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return '';
    }
    if (DATE_PATTERN.test(trimmed)) {
      return trimmed;
    }
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return formatLocalYMD(parsed);
    }
    return '';
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatLocalYMD(value);
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return formatLocalYMD(parsed);
    }
  }

  return '';
}

export function formatLocalYMD(date) {
  if (!(date instanceof Date)) {
    return '';
  }
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseYMDToDate(value) {
  const normalized = normalizeYMD(value);
  if (!normalized) {
    return null;
  }
  const [year, month, day] = normalized.split('-').map(part => Number.parseInt(part, 10));
  const parsed = new Date(year, month - 1, day);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  parsed.setHours(0, 0, 0, 0);
  return parsed;
}

export function getNoteEntryInfo(entry) {
  if (!entry || typeof entry !== 'object') {
    return { text: '', updatedAt: null };
  }
  const text = typeof entry.text === 'string' ? entry.text : '';
  const updatedAt = typeof entry.updatedAt === 'string' ? entry.updatedAt : null;
  return { text, updatedAt };
}

export function hasAnyEntry(note) {
  if (!note || typeof note !== 'object') {
    return false;
  }
  if (!note.entries || typeof note.entries !== 'object') {
    return false;
  }
  return Object.values(note.entries).some(entry => {
    const info = getNoteEntryInfo(entry);
    return info.text.trim().length > 0;
  });
}

export function setNoteEntryValue(note, date, value) {
  if (!note || typeof note !== 'object') {
    return;
  }

  const targetDate = normalizeYMD(date);
  if (!targetDate) {
    return;
  }

  if (!note.entries || typeof note.entries !== 'object') {
    note.entries = {};
  }

  const trimmed = typeof value === 'string' ? value.trimEnd() : '';
  if (!trimmed.trim()) {
    delete note.entries[targetDate];
    if (note.colors && note.colors[targetDate]) {
      delete note.colors[targetDate];
    }
    return;
  }

  const now = new Date();
  note.entries[targetDate] = {
    text: trimmed,
    updatedAt: now.toISOString()
  };
}

function migrateLegacyText(note) {
  if (!note || typeof note !== 'object') {
    return;
  }
  const legacyText = typeof note.text === 'string' ? note.text.trim() : '';
  if (!legacyText) {
    return;
  }
  const date = normalizeYMD(note.selectedDate) || formatLocalYMD(new Date());
  if (!note.entries || typeof note.entries !== 'object') {
    note.entries = {};
  }
  if (!note.entries[date] || !note.entries[date].text) {
    note.entries[date] = {
      text: legacyText,
      updatedAt: new Date().toISOString()
    };
  }
  note.text = '';
}

function sanitizeEntries(note) {
  if (!note.entries || typeof note.entries !== 'object') {
    note.entries = {};
    return;
  }
  const sanitized = {};
  Object.keys(note.entries).forEach(key => {
    const normalizedKey = normalizeYMD(key);
    const info = getNoteEntryInfo(note.entries[key]);
    if (normalizedKey && info.text.trim()) {
      sanitized[normalizedKey] = {
        text: info.text,
        updatedAt: info.updatedAt || new Date().toISOString()
      };
    }
  });
  note.entries = sanitized;
}

function sanitizeColors(note) {
  if (!note.colors || typeof note.colors !== 'object') {
    note.colors = {};
    return;
  }
  const sanitized = {};
  Object.keys(note.colors).forEach(key => {
    const normalizedKey = normalizeYMD(key);
    const color = note.colors[key];
    if (!normalizedKey) {
      return;
    }
    if (typeof color === 'string' && color.trim()) {
      sanitized[normalizedKey] = color.trim();
    }
  });
  note.colors = sanitized;
}

function clampSize(value, minValue, fallback) {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(minValue, value);
}

export function ensureNoteStructure(note) {
  const now = new Date();
  const today = formatLocalYMD(now);
  const base = note && typeof note === 'object' ? note : {};

  if (!base.entries) {
    base.entries = {};
  }
  if (!base.colors) {
    base.colors = {};
  }

  migrateLegacyText(base);
  sanitizeEntries(base);
  sanitizeColors(base);

  const selected = normalizeYMD(base.selectedDate) || today;
  base.selectedDate = selected;

  const highlight = typeof base.highlightColor === 'string' && base.highlightColor.trim()
    ? base.highlightColor.trim()
    : (NOTE_COLORS.includes(base.highlightColor) ? base.highlightColor : NOTE_COLORS[0]);
  base.highlightColor = highlight;

  const width = clampSize(base.width, MIN_NOTE_WIDTH, DEFAULT_NOTE_WIDTH);
  const height = clampSize(base.height, MIN_NOTE_HEIGHT, DEFAULT_NOTE_HEIGHT);

  const viewDate = normalizeYMD(base.viewDate)
    || `${selected.slice(0, 7)}-01`;

  const normalized = reactive({
    ...base,
    entries: { ...base.entries },
    colors: { ...base.colors },
    selectedDate: selected,
    highlightColor: highlight,
    width,
    height,
    visible: Boolean(base.visible),
    window: null,
    x: Number.isFinite(base.x) ? base.x : 0,
    y: Number.isFinite(base.y) ? base.y : 0,
    viewDate,
    offsetX: Number.isFinite(base.offsetX) ? base.offsetX : null,
    offsetY: Number.isFinite(base.offsetY) ? base.offsetY : null
  });

  return normalized;
}

export function createDefaultNoteState() {
  const today = formatLocalYMD(new Date());
  return ensureNoteStructure({
    entries: {},
    colors: {},
    selectedDate: today,
    highlightColor: NOTE_COLORS[0],
    width: DEFAULT_NOTE_WIDTH,
    height: DEFAULT_NOTE_HEIGHT,
    visible: false,
    window: null,
    x: 0,
    y: 0,
    viewDate: `${today.slice(0, 7)}-01`,
    offsetX: null,
    offsetY: null
  });
}

export function normalizeNoteForExport(note) {
  if (!note || typeof note !== 'object') {
    return null;
  }
  const prepared = ensureNoteStructure(note);
  const serializedEntries = {};
  Object.keys(prepared.entries).forEach(key => {
    const info = getNoteEntryInfo(prepared.entries[key]);
    if (info.text.trim()) {
      serializedEntries[key] = {
        text: info.text,
        updatedAt: info.updatedAt || new Date().toISOString()
      };
    }
  });
  const serializedColors = {};
  Object.keys(prepared.colors).forEach(key => {
    const color = prepared.colors[key];
    if (typeof color === 'string' && color.trim()) {
      serializedColors[key] = color.trim();
    }
  });
  return {
    text: '',
    entries: serializedEntries,
    colors: serializedColors,
    selectedDate: prepared.selectedDate,
    highlightColor: prepared.highlightColor,
    width: clampSize(prepared.width, MIN_NOTE_WIDTH, DEFAULT_NOTE_WIDTH),
    height: clampSize(prepared.height, MIN_NOTE_HEIGHT, DEFAULT_NOTE_HEIGHT),
    visible: false,
    window: null,
    x: Number.isFinite(prepared.x) ? prepared.x : 0,
    y: Number.isFinite(prepared.y) ? prepared.y : 0,
    viewDate: normalizeYMD(prepared.viewDate) || `${prepared.selectedDate.slice(0, 7)}-01`,
    offsetX: Number.isFinite(prepared.offsetX) ? prepared.offsetX : null,
    offsetY: Number.isFinite(prepared.offsetY) ? prepared.offsetY : null
  };
}

export function getMonthMatrix(viewDate) {
  const baseDate = parseYMDToDate(viewDate) || new Date();
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const firstWeekday = (firstDay.getDay() + 6) % 7; // convert to Monday=0
  const startDate = new Date(year, month, 1 - firstWeekday);

  const days = [];
  for (let i = 0; i < 42; i += 1) {
    const current = new Date(startDate);
    current.setDate(startDate.getDate() + i);
    const dateStr = formatLocalYMD(current);
    const inCurrentMonth = current.getMonth() === month;
    days.push({
      date: dateStr,
      inMonth: inCurrentMonth,
      label: current.getDate(),
      weekday: (current.getDay() + 6) % 7
    });
  }

  const titleFormatter = new Intl.DateTimeFormat('ru-RU', {
    month: 'long',
    year: 'numeric'
  });
  const title = titleFormatter.format(firstDay);

  return {
    days,
    title,
    month,
    year,
    firstDay
  };
}

export function adjustViewDate(viewDate, offset) {
  const base = parseYMDToDate(viewDate) || new Date();
  const year = base.getFullYear();
  const month = base.getMonth();
  const next = new Date(year, month + offset, 1);
  next.setHours(0, 0, 0, 0);
  return `${next.getFullYear()}-${`${next.getMonth() + 1}`.padStart(2, '0')}-01`;
}

export function updateNoteOffsets(note, cardRect) {
  if (!note || !cardRect) {
    return;
  }
  note.offsetX = note.x - cardRect.left;
  note.offsetY = note.y - cardRect.top;
}

export function applyCardRectToNote(note, cardRect) {
  if (!note || !cardRect) {
    return;
  }
  const offsetX = Number.isFinite(note.offsetX) ? note.offsetX : 15 + (cardRect.width || 0);
  const offsetY = Number.isFinite(note.offsetY) ? note.offsetY : 0;
  note.x = cardRect.left + offsetX;
  note.y = cardRect.top + offsetY;
}

export function ensureSelectedDate(note, fallbackDate) {
  const selected = normalizeYMD(note?.selectedDate) || normalizeYMD(fallbackDate);
  if (!selected) {
    const today = formatLocalYMD(new Date());
    note.selectedDate = today;
    return today;
  }
  note.selectedDate = selected;
  return selected;
}

export function getSelectedColor(note) {
  const date = normalizeYMD(note?.selectedDate);
  if (!date) {
    return note?.highlightColor || NOTE_COLORS[0];
  }
  if (note?.colors && typeof note.colors[date] === 'string') {
    return note.colors[date];
  }
  return note?.highlightColor || NOTE_COLORS[0];
}

export function getCardNotesSummary(cards) {
  if (!Array.isArray(cards)) {
    return [];
  }
  return cards
    .filter(card => hasAnyEntry(card.note))
    .map(card => ({
      id: card.id,
      title: card.text || 'Без названия'
    }));
}

export function pruneEmptyNote(note) {
  if (!note || typeof note !== 'object') {
    return;
  }
  sanitizeEntries(note);
  sanitizeColors(note);
}
