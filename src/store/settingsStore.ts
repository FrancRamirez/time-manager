import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import type { UserSettings, BlockedHourRange, AccessLevel, AppId } from "@/types";
import { DEFAULT_APP_ACCESS, sanitizeAppAccess } from "@/constants/apps";

const STORAGE_KEY = "tm_settings";

const DEFAULT_SETTINGS: UserSettings = {
  autonomyLevel: "suggestion",
  dailyActionLimit: 100,
  bufferMinutes: 15,
  blockedHours: [],
  appAccess: DEFAULT_APP_ACCESS,
  notificationChannels: {
    sound: true,
    vibration: true,
    highPriority: true,
  },
};

interface SettingsState {
  settings: UserSettings;
  hydrated: boolean;
  /** Carga los ajustes guardados en el dispositivo (se llama una vez al abrir la app). */
  hydrate: () => Promise<void>;
  setSettings: (settings: UserSettings) => void;
  updateAutonomyLevel: (level: UserSettings["autonomyLevel"]) => void;
  setBufferMinutes: (minutes: number) => void;
  setDailyActionLimit: (limit: number) => void;
  addBlockedHour: (range: BlockedHourRange) => void;
  removeBlockedHour: (id: string) => void;
  setAppAccess: (app: AppId, level: AccessLevel) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: DEFAULT_SETTINGS,
  hydrated: false,
  hydrate: async () => {
    try {
      const raw = await SecureStore.getItemAsync(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<UserSettings>;
        set({
          settings: {
            ...DEFAULT_SETTINGS,
            ...saved,
            notificationChannels: {
              ...DEFAULT_SETTINGS.notificationChannels,
              ...saved.notificationChannels,
            },
            blockedHours: Array.isArray(saved.blockedHours) ? saved.blockedHours : [],
            appAccess: sanitizeAppAccess(saved.appAccess),
          },
        });
      }
    } catch {
      /* si el JSON está corrupto o no se puede leer, se usan los valores por defecto */
    } finally {
      set({ hydrated: true });
    }
  },
  setSettings: (settings) => set({ settings }),
  updateAutonomyLevel: (autonomyLevel) =>
    set((state) => ({ settings: { ...state.settings, autonomyLevel } })),
  setBufferMinutes: (bufferMinutes) =>
    set((state) => ({ settings: { ...state.settings, bufferMinutes } })),
  setDailyActionLimit: (dailyActionLimit) =>
    set((state) => ({ settings: { ...state.settings, dailyActionLimit } })),
  addBlockedHour: (range) =>
    set((state) => ({
      settings: {
        ...state.settings,
        blockedHours: [...state.settings.blockedHours, range],
      },
    })),
  removeBlockedHour: (id) =>
    set((state) => ({
      settings: {
        ...state.settings,
        blockedHours: state.settings.blockedHours.filter((b) => b.id !== id),
      },
    })),
  setAppAccess: (app, level) =>
    set((state) => ({
      settings: {
        ...state.settings,
        appAccess: { ...state.settings.appAccess, [app]: level },
      },
    })),
}));

// Guarda en el dispositivo cada vez que cambian los ajustes (una vez hidratado,
// para no pisar lo guardado con los valores por defecto).
useSettingsStore.subscribe((state, prev) => {
  if (!state.hydrated || state.settings === prev.settings) return;
  SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(state.settings)).catch(() => {});
});
