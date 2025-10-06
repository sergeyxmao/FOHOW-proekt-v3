import { authStore } from "./store/authStore.js";
import { showAuthModal, hideAuthModal } from "./auth/AuthModal.js";
import { renderApp } from "./app.js";

function mountApp() {
  hideAuthModal();
  renderApp();
}

authStore.checkFromStorage();

if (authStore.isAuthed) {
  mountApp();
} else {
  showAuthModal(mountApp);
}
