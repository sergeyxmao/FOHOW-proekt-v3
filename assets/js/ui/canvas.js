import { projectStore } from "../state/projectStore.js";

export function mountCanvas() {
  const app = document.getElementById("app");
  app.innerHTML = ""; // очищаем всё (раньше там была стартовая карточка)

  const stage = document.createElement("div");
  stage.className = "stage";

  const canvas = document.createElement("div");
  canvas.id = "canvas";
  canvas.className = projectStore.getState().canvas.grid ? "grid-on" : "";

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("id", "svg-layer");
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");
  svg.setAttribute("viewBox", "0 0 100 100"); // пока заглушка

  const hint = document.createElement("div");
  hint.className = "canvas-hint";
  hint.innerHTML = `
    <b>M2 — Макет готов.</b><br/>
    Слева — рабочая панель (Сохранить/Загрузить, сетка, режимы).<br/>
    На M3 добавим панорамирование, зум к курсору, направляющие.<br/>
    На M4+ появятся карточки, связи и расчёты.
  `;

  stage.appendChild(canvas);
  stage.appendChild(svg);
  stage.appendChild(hint);
  app.appendChild(stage);

  // Подписка на изменения холста (сетка)
  projectStore.subscribe((topic) => {
    if (topic === "canvas:changed") {
      canvas.classList.toggle("grid-on", projectStore.getState().canvas.grid);
    }
  });
}
