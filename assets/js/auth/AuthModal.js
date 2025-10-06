import { authStore } from "../store/authStore.js";

let overlayEl = null;
let inputEl = null;

function focusTrap(e) {
  if (e.key !== "Tab") return;
  const modal = document.querySelector(".auth-modal");
  if (!modal) return;
  const focusables = modal.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  if (!focusables.length) return;

  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  const active = document.activeElement;

  if (e.shiftKey) {
    if (active === first || !modal.contains(active)) {
      e.preventDefault();
      last.focus();
    }
  } else {
    if (active === last) {
      e.preventDefault();
      first.focus();
    }
  }
}

export function showAuthModal(onAuthed) {
  if (overlayEl) return;

  overlayEl = document.createElement("div");
  overlayEl.className = "auth-overlay";
  overlayEl.addEventListener("mousedown", (e) => e.preventDefault());

  const modal = document.createElement("div");
  modal.className = "auth-modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-labelledby", "auth-title");
  modal.addEventListener("mousedown", (e) => e.stopPropagation());

  modal.innerHTML = `
    <h2 id="auth-title" class="auth-title">Доступ к проекту</h2>
    <p class="auth-subtitle">Введите пароль для продолжения.</p>
    <form class="auth-form">
      <label class="auth-label">
        Пароль
        <input class="auth-input" type="password" placeholder="••••••••" required />
      </label>
      <div class="auth-error" style="display:none"></div>
      <div class="auth-actions">
        <button type="submit" class="auth-btn">Войти</button>
      </div>
    </form>
    <p class="auth-hint">SHA-256 проверка, сессия до закрытия вкладки.</p>
  `;

  const form = modal.querySelector("form");
  inputEl = modal.querySelector(".auth-input");
  const errorEl = modal.querySelector(".auth-error");
  const btn = modal.querySelector(".auth-btn");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    btn.disabled = true;
    btn.textContent = "Проверяю…";
    const ok = await authStore.login(inputEl.value);
    if (ok) {
      hideAuthModal();
      onAuthed?.();
    } else {
      errorEl.textContent = authStore.error || "Ошибка";
      errorEl.style.display = "";
      inputEl.select();
      btn.disabled = false;
      btn.textContent = "Войти";
    }
  });

  overlayEl.appendChild(modal);
  document.body.appendChild(overlayEl);

  // блокировка прокрутки
  const prevOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  overlayEl.dataset.prevOverflow = prevOverflow;

  // фокус
  setTimeout(() => inputEl?.focus(), 0);

  document.addEventListener("keydown", focusTrap);
}

export function hideAuthModal() {
  if (!overlayEl) return;
  document.removeEventListener("keydown", focusTrap);
  const prev = overlayEl.dataset.prevOverflow || "";
  document.body.style.overflow = prev;
  overlayEl.remove();
  overlayEl = null;
  inputEl = null;
}
