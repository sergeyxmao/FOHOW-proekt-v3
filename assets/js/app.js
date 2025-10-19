import { mountLeftPanel } from "./ui/panels.js";
import { mountCanvas } from "./canvas.js"; // <-- у вас canvas.js в корне js/
import { attachHotkeys } from "./keys.js";

export function renderApp() {
  // Монтируем левую панель и хоткеи один раз
  if (!document.getElementById("panel-left")) {
    mountLeftPanel();
    attachHotkeys();
  }
  // Рисуем холст (можно вызывать повторно при загрузке проекта)
  mountCanvas();
}
