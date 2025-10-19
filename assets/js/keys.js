import { projectStore } from "./state/projectStore.js";

// Кросс-раскладочные хоткеи
const mod = (e) => e.ctrlKey || e.metaKey;

function isKey(e, latin, ru) {
  return e.code === `Key${latin.toUpperCase()}` ||
    e.key?.toLowerCase() === latin.toLowerCase() ||
    e.key === ru;
}

export function attachHotkeys() {
  window.addEventListener("keydown", (e) => {
    // Сохранить
    if (mod(e) && isKey(e, "s", "ы")) {
      e.preventDefault();
      projectStore.saveToFile();
      return;
    }
    // Открыть
    if (mod(e) && isKey(e, "o", "щ")) {
      e.preventDefault();
      projectStore.openFromFileDialog();
      return;
    }
    // Undo / Redo (заглушки до истории)
    if (mod(e) && isKey(e, "z", "я") && !e.shiftKey) {
      e.preventDefault();
      console.log("Undo (будет в M12)");
      return;
    }
    if ((mod(e) && e.shiftKey && isKey(e, "z", "я")) || (mod(e) && isKey(e, "y", "н"))) {
      e.preventDefault();
      console.log("Redo (будет в M12)");
      return;
    }
    // Delete — удаление выделенного (появится в M12)
    if (e.key === "Delete" || e.key === "Backspace") {
      // пока пропускаем
    }
    // Help
    if (e.key === "?") {
      // позже подключим DOCX/MD
    }
  });
}
