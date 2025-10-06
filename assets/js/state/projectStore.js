// Мини-хранилище состояния проекта + подписки + сериализация
const initialState = {
  canvas: { x: 0, y: 0, scale: 1, grid: true, guides: false },
  modes: { selection: true, tree: false },
  cards: [],
  lines: [],
  notes: []
};

const listeners = new Set();

const state = structuredClone(initialState);

function notify(topic = "state:changed") {
  for (const fn of listeners) fn(topic, state);
}

export const projectStore = {
  getState() { return state; },

  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },

  setCanvas(patch) {
    Object.assign(state.canvas, patch);
    notify("canvas:changed");
  },

  setMode(key, value) {
    if (key in state.modes) {
      state.modes[key] = !!value;
      notify("modes:changed");
    }
  },

  // ==== СЕРИАЛИЗАЦИЯ ====
  toJSON() {
    // На M2 сохраняем только базу; далее структура расширится по ТЗ
    return JSON.stringify(state, null, 2);
  },

  async saveToFile() {
    const blob = new Blob([this.toJSON()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "project.fohow.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 0);
  },

  ensureHiddenFileInput() {
    let input = document.getElementById("hidden-file-input");
    if (!input) {
      input = document.createElement("input");
      input.type = "file";
      input.accept = ".json,application/json";
      input.id = "hidden-file-input";
      input.style.display = "none";
      input.addEventListener("change", async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
          const text = await file.text();
          const obj = JSON.parse(text);
          // Простейшая валидация для M2
          Object.assign(state.canvas, obj.canvas ?? {});
          if (obj.modes) Object.assign(state.modes, obj.modes);
          state.cards = Array.isArray(obj.cards) ? obj.cards : [];
          state.lines = Array.isArray(obj.lines) ? obj.lines : [];
          state.notes = Array.isArray(obj.notes) ? obj.notes : [];
          notify("state:loaded");
        } catch (err) {
          alert("Ошибка загрузки JSON: " + (err?.message ?? err));
        } finally {
          e.target.value = "";
        }
      });
      document.body.appendChild(input);
    }
    return input;
  },

  openFromFileDialog() {
    const input = this.ensureHiddenFileInput();
    input.click();
  }
};
