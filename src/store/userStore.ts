import { create } from "zustand";
import type { User } from "@/types";
import { saveCachedUser } from "@/services/secureStorage";

interface UserState {
  user: User | null;
  isLoading: boolean;
  /** Aviso para el Login cuando la sesión terminó sola (venció, o Google la invalidó). */
  sessionNotice: string | null;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setSessionNotice: (notice: string | null) => void;
}

export const useUserStore = create<UserState>((set) => ({
  user: null,
  isLoading: true,
  sessionNotice: null,
  setUser: (user) => {
    set({ user });
    // La copia local siempre refleja al usuario actual (login, onboarding, /me). Al cerrar la
    // sesión la borra clearTokens().
    if (user) saveCachedUser(user).catch(() => {});
  },
  setLoading: (isLoading) => set({ isLoading }),
  setSessionNotice: (sessionNotice) => set({ sessionNotice }),
}));
