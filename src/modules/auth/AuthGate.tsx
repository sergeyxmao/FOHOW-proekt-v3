import { PropsWithChildren, useEffect } from "react";
import { useAuthStore } from "@/state/auth";
import AuthModal from "./AuthModal";

export default function AuthGate({ children }: PropsWithChildren) {
  const { isAuthed, checking, checkFromStorage } = useAuthStore();

  useEffect(() => {
    checkFromStorage();
  }, [checkFromStorage]);

  if (checking) return null; // можно поставить спиннер, если нужно

  return (
    <>
      {!isAuthed && <AuthModal />}
      {isAuthed && children}
    </>
  );
}
