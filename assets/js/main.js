import { authStore } from "./store/authStore.js";
import { showAuthModal, hideAuthModal } from "./auth/AuthModal.js";
import { renderApp } from "./app.js";

function mountApp() {
  hideAuthModal();
  const boot = document.getElementById("boot-hint");
  if (boot) boot.remove();
  renderApp();
}

console.info("[main] стартую…");
authStore.checkFromStorage();

if (authStore.isAuthed) {
  mountApp();
} else {
  showAuthModal(mountApp);
}
