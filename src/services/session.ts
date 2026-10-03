import { signOut } from "@/services/auth";
import { clearTokens } from "@/services/secureStorage";
import { useAgendaStore } from "@/store/agendaStore";
import { useUserStore } from "@/store/userStore";
import type { SessionLostReason } from "@/api/client";

const NOTICES: Record<SessionLostReason, string> = {
  expired: "Tu sesión venció. Inicia sesión de nuevo.",
  google_reauth: "Tu conexión con Google venció. Vuelve a iniciar sesión.",
};

function resetLocalState() {
  useAgendaStore.getState().setEvents([]);
  useAgendaStore.getState().setSuggestions([]);
}

/**
 * La sesión terminó sola (venció o Google la invalidó): se borran los tokens y se vuelve al Login
 * con un aviso. El historial del chat se conserva (si entra otra cuenta, signInWithGoogle lo borra).
 */
export async function expireSession(reason: SessionLostReason) {
  if (!useUserStore.getState().user) return; // ya está cerrada; evita avisos repetidos
  await clearTokens();
  resetLocalState();
  useUserStore.getState().setSessionNotice(NOTICES[reason]);
  useUserStore.getState().setUser(null);
}

/** Botón "Cerrar sesión": borra tokens e historial del chat. */
export async function logout() {
  await signOut();
  resetLocalState();
  useUserStore.getState().setSessionNotice(null);
  useUserStore.getState().setUser(null);
}
