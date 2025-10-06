import { projectStore } from "./state/projectStore.js";

export function mountCanvas() {
  const app = document.getElementById("app");
  app.innerHTML = "";

  const stage = document.createElement("div");
  stage.className = "stage";

  const canvas = document.createElement("div");
  canvas.id = "canvas";
  canvas.className = projectStore.getState().canvas.grid ? "grid-on" : "";

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("id", "svg-layer");
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");
  svg.setAttribute("viewBox", "0 0 100 100");

  const hint = document.createElement("div");
  hint.className = "canvas-hint";
  hint.innerHTML = `
    <b>M2 — Макет готов.</b><br/>
    Слева — панель (💾 📂 ▦ …). На M3 добавим пан/зум и направляющие.
  `;

  stage.appendChild(canvas);
  stage.appendChild(svg);
  stage.appendChild(hint);
  app.appendChild(stage);

  // Обновление сетки по state
  projectStore.subscribe((topic) => {
    if (topic === "canvas:changed") {
      canvas.classList.toggle("grid-on", projectStore.getState().canvas.grid);
    }
  });
}
