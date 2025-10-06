import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "@/state/auth";
import "./auth.css";

export default function AuthModal() {
  const { login, error } = useAuthStore();
  const [pwd, setPwd] = useState("");
  const [busy, setBusy] = useState(false);

  const overlayRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Фокус на поле ввода
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Блокируем прокрутку фона
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  // Focus trap по Tab внутри модалки
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const focusables = modalRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusables || focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (active === first || !modalRef.current?.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Запрет кликов по подложке (закрывать нельзя до успешного логина)
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const ok = await login(pwd);
    if (!ok) {
      setBusy(false);
      inputRef.current?.select();
    }
    // При успехе модалка скрывается автоматически (isAuthed=true в сторе)
  };

  return (
    <div className="auth-overlay" ref={overlayRef} onMouseDown={(e)=>e.preventDefault()}>
      <div className="auth-modal" ref={modalRef} onMouseDown={stop} role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <h2 id="auth-title" className="auth-title">Доступ к проекту</h2>
        <p className="auth-subtitle">Введите пароль для продолжения.</p>

        <form onSubmit={onSubmit} className="auth-form">
          <label className="auth-label">
            Пароль
            <input
              ref={inputRef}
              className="auth-input"
              type="password"
              autoComplete="current-password"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              placeholder="••••••••"
              required
            />
          </label>

          {error && <div className="auth-error" role="alert">{error}</div>}

          <div className="auth-actions">
            <button type="submit" className="auth-btn" disabled={busy}>
              {busy ? "Проверяю…" : "Войти"}
            </button>
          </div>
        </form>

        <p className="auth-hint">Поддерживается SHA-256, сессия запоминается до закрытия вкладки.</p>
      </div>
    </div>
  );
}
