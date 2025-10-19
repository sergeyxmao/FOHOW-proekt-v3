// Простой глобальный стор с историей (undo/redo) и сериализацией
export const coreStore = (() => {
  const initial = () => ({
    version: 1,
    canvas: { x: 0, y: 0, scale: 1, grid: true },
    modes: { selection: "single", hierarchy: false, guides: true },
    cards: [],
    lines: [],
    notes: []
  });

  let state = initial();
  let past = [];
  let future = [];
  const listeners = new Set();

  const clone = (obj) =>
    (typeof structuredClone === "function")
      ? structuredClone(obj)
      : JSON.parse(JSON.stringify(obj));

  const emit = () => listeners.forEach((fn) => fn(state));

  function set(updater) {
    past.push(clone(state));
    if (past.length > 50) past.shift();
    updater(state);
    future = [];
    emit();
  }

  function replace(next) {
    past.push(clone(state));
    state = next;
    future = [];
    emit();
  }

  function undo() {
    if (!past.length) return false;
    future.push(clone(state));
    state = past.pop();
    emit();
    return true;
  }

  function redo() {
    if (!future.length) return false;
    past.push(clone(state));
    state = future.pop();
    emit();
    return true;
  }

  function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  function get() { return state; }
  const hasUndo = () => past.length > 0;
  const hasRedo = () => future.length > 0;

  function serialize() {
    const { version, canvas, modes, cards, lines, notes } = state;
    return JSON.stringify({ version, canvas, modes, cards, lines, notes }, null, 2);
  }

  function loadParsed(obj) {
    const base = initial();
    const merged = {
      version: typeof obj.version === "number" ? obj.version : base.version,
      canvas: { ...base.canvas, ...(obj.canvas || {}) },
      modes: { ...base.modes, ...(obj.modes || {}) },
      cards: Array.isArray(obj.cards) ? obj.cards : [],
      lines: Array.isArray(obj.lines) ? obj.lines : [],
      notes: Array.isArray(obj.notes) ? obj.notes : []
    };
    replace(merged);
  }

  return { get, set, replace, undo, redo, hasUndo, hasRedo, onChange, serialize, loadParsed };
})();
