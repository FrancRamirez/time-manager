import { create } from "zustand";
import type { UserSettings, BlockedHourRange } from "@/types";

const DEFAULT_SETTINGS: UserSettings = {
  autonomyLevel: "suggestion",
  dailyActionLimit: 100,
  bufferMinutes: 15,
  blockedHours: [],
  notificationChannels: {
    sound: true,
    vibration: true,
    highPriority: true,
  },
};

interface SettingsState {
  settings: UserSettings;
  setSettings: (settings: UserSettings) => void;
  updateAutonomyLevel: (level: UserSettings["autonomyLevel"]) => void;
  addBlockedHour: (range: BlockedHourRange) => void;
  removeBlockedHour: (id: string) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: DEFAULT_SETTINGS,
  setSettings: (settings) => set({ settings }),
  updateAutonomyLevel: (autonomyLevel) =>
    set((state) => ({ settings: { ...state.settings, autonomyLevel } })),
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
}));
