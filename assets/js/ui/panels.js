import { projectStore } from "../state/projectStore.js";

function btn({ title, text, id, disabled }) {
  const b = document.createElement("button");
  b.className = "tool";
  b.title = title;
  b.textContent = text; // эмодзи/иконка/буква
  if (id) b.id = id;
  if (disabled) b.disabled = true;
  return b;
}

export function mountLeftPanel() {
  const panel = document.createElement("div");
  panel.className = "panel-left";
  panel.id = "panel-left";

  // Группа: Undo/Redo
  const undo = btn({ title: "Отменить (Ctrl/Cmd+Z)", text: "↶", id: "btn-undo", disabled: true });
  const redo = btn({ title: "Повторить (Ctrl+Y или Shift+Ctrl/Cmd+Z)", text: "↷", id: "btn-redo", disabled: true });
  panel.append(undo, redo);

  panel.appendChild(divSep());

  // Группа: Сохранить/Загрузить
  const save = btn({ title: "Сохранить проект (Ctrl/Cmd+S)", text: "💾", id: "btn-save" });
  save.addEventListener("click", () => projectStore.saveToFile());
  const load = btn({ title: "Загрузить проект (Ctrl/Cmd+O)", text: "📂", id: "btn-load" });
  load.addEventListener("click", () => projectStore.openFromFileDialog());
  panel.append(save, load);

  panel.appendChild(divSep());

  // Группа: Экспорт
  const expHtml = btn({ title: "Экспорт HTML (M10)", text: "🧩", id: "btn-exp-html", disabled: true });
  const expSvg  = btn({ title: "Экспорт SVG (M10)",  text: "🖼️", id: "btn-exp-svg", disabled: true });
  panel.append(expHtml, expSvg);

  panel.appendChild(divSep());

  // Группа: Печать
  const printPng = btn({ title: "Печать PNG (M10)", text: "🖨️", id: "btn-print-png", disabled: true });
  const printPdf = btn({ title: "Печать PDF (M10)", text: "📄", id: "btn-print-pdf", disabled: true });
  panel.append(printPng, printPdf);

  panel.appendChild(divSep());

  // Группа: Заметки / Выделение / Иерархия
  const notes = btn({ title: "Список заметок (появится при их наличии)", text: "📝", id: "btn-notes", disabled: true });
  panel.append(notes);

  const selection = btn({ title: "Режим выделения (вкл/выкл)", text: "⬚", id: "btn-selection" });
  selection.classList.toggle("active", projectStore.getState().modes.selection);
  selection.addEventListener("click", () => {
    const v = !projectStore.getState().modes.selection;
    projectStore.setMode("selection", v);
    selection.classList.toggle("active", v);
  });
  panel.append(selection);

  const tree = btn({ title: "Иерархический режим (движение поддерева) — макет", text: "🌳", id: "btn-tree" });
  tree.classList.toggle("active", projectStore.getState().modes.tree);
  tree.addEventListener("click", () => {
    const v = !projectStore.getState().modes.tree;
    projectStore.setMode("tree", v);
    tree.classList.toggle("active", v);
  });
  panel.append(tree);

  panel.appendChild(divSep());

  // Группа: Сетка/Направляющие/Справка
  const grid = btn({ title: "Показать/скрыть сетку", text: "▦", id: "btn-grid" });
  grid.classList.toggle("active", projectStore.getState().canvas.grid);
  grid.addEventListener("click", () => {
    const v = !projectStore.getState().canvas.grid;
    projectStore.setCanvas({ grid: v });
  });
  panel.append(grid);

  const guides = btn({ title: "Вкл/выкл направляющие (макет)", text: "📐", id: "btn-guides" });
  guides.classList.toggle("active", projectStore.getState().canvas.guides);
  guides.addEventListener("click", () => {
    const v = !projectStore.getState().canvas.guides;
    projectStore.setCanvas({ guides: v });
  });
  panel.append(guides);

  const help = btn({ title: "Справка (DOCX) — подключим позже", text: "❔", id: "btn-help", disabled: true });
  panel.append(help);

  // Реакция на изменение состояния (для сетки/направляющих)
  projectStore.subscribe((topic) => {
    if (topic === "canvas:changed") {
      grid.classList.toggle("active", projectStore.getState().canvas.grid);
      guides.classList.toggle("active", projectStore.getState().canvas.guides);
      const canvas = document.getElementById("canvas");
      if (canvas) canvas.classList.toggle("grid-on", projectStore.getState().canvas.grid);
    }
  });

  document.body.appendChild(panel);
}

function divSep() {
  const d = document.createElement("div");
  d.className = "sep";
  return d;
}
