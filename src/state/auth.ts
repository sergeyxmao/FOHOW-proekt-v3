import { create } from "zustand";
import { AUTH_EXPECTED_HASH, AUTH_STORAGE_KEY } from "@/modules/auth/config";
import { sha256Hex } from "@/modules/auth/hash";

type AuthState = {
  isAuthed: boolean;
  error: string | null;
  checking: boolean;
  checkFromStorage: () => void;
  login: (password: string) => Promise<boolean>;
  logout: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  isAuthed: false,
  error: null,
  checking: true,

  checkFromStorage: () => {
    try {
      const ok = sessionStorage.getItem(AUTH_STORAGE_KEY) === "1";
      set({ isAuthed: !!ok, checking: false, error: null });
    } catch {
      set({ isAuthed: false, checking: false, error: null });
    }
  },

  login: async (password: string) => {
    const incoming = (await sha256Hex(password)).toLowerCase();
    const ok = incoming === AUTH_EXPECTED_HASH.toLowerCase();
    if (ok) {
      try {
        sessionStorage.setItem(AUTH_STORAGE_KEY, "1");
      } catch {}
      set({ isAuthed: true, error: null });
      return true;
    } else {
      set({ error: "Неверный пароль" });
      return false;
    }
  },

  logout: () => {
    try {
      sessionStorage.removeItem(AUTH_STORAGE_KEY);
    } catch {}
    set({ isAuthed: false, error: null });
  },
}));
