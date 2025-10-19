import { AUTH_EXPECTED_HASH, AUTH_STORAGE_KEY } from "../auth/config.js";
import { sha256Hex } from "../auth/hash.js";

export const authStore = {
  isAuthed: false,
  error: null,

  checkFromStorage() {
    try {
      this.isAuthed = sessionStorage.getItem(AUTH_STORAGE_KEY) === "1";
    } catch { this.isAuthed = false; }
  },

  async login(password) {
    const incoming = (await sha256Hex(password)).toLowerCase();
    const ok = incoming === AUTH_EXPECTED_HASH.toLowerCase();
    if (ok) {
      try { sessionStorage.setItem(AUTH_STORAGE_KEY, "1"); } catch {}
      this.isAuthed = true;
      this.error = null;
      return true;
    } else {
      this.error = "Неверный пароль";
      return false;
    }
  },

  logout() {
    try { sessionStorage.removeItem(AUTH_STORAGE_KEY); } catch {}
    this.isAuthed = false;
    this.error = null;
  }
};
