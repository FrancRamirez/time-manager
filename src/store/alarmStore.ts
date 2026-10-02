import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Day } from "@/services/clock";

const STORAGE_KEY = "tm_alarms";
const MAX_ALARMS = 50;

/**
 * Registro de las alarmas que creó el asistente. Android no permite leer las
 * alarmas del Reloj, así que esta es la única lista que existe. Si el usuario
 * borra una alarma a mano en el Reloj, el registro no se entera.
 */
export interface TrackedAlarm {
  id: string;
  hour: number;
  minute: number;
  /** Vacío = alarma de una sola vez. */
  days: Day[];
  label?: string;
  /** Solo alarmas de una sola vez: instante (ms) en que suena; luego se descarta del registro. */
  fireAt?: number;
}

/** Próxima vez (ms) que el reloj local del dispositivo marca hour:minute. */
export function nextFireAt(hour: number, minute: number, now = Date.now()): number {
  const d = new Date(now);
  d.setHours(hour, minute, 0, 0);
  if (d.getTime() <= now) d.setDate(d.getDate() + 1);
  return d.getTime();
}

export function newAlarmId(): string {
  return `al-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

interface AlarmState {
  alarms: TrackedAlarm[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  add: (alarm: TrackedAlarm) => void;
  replace: (id: string, alarm: TrackedAlarm) => void;
  remove: (id: string) => void;
}

function pruneExpired(list: TrackedAlarm[], now = Date.now()): TrackedAlarm[] {
  return list.filter((a) => a.fireAt === undefined || a.fireAt > now);
}

export const useAlarmStore = create<AlarmState>((set) => ({
  alarms: [],
  hydrated: false,
  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (Array.isArray(saved)) set({ alarms: pruneExpired(saved as TrackedAlarm[]) });
      }
    } catch {
      /* JSON corrupto o sin acceso: se empieza con el registro vacío */
    } finally {
      set({ hydrated: true });
    }
  },
  add: (alarm) => set((s) => ({ alarms: [...pruneExpired(s.alarms), alarm].slice(-MAX_ALARMS) })),
  replace: (id, alarm) =>
    set((s) => ({ alarms: pruneExpired(s.alarms).map((a) => (a.id === id ? alarm : a)) })),
  remove: (id) => set((s) => ({ alarms: s.alarms.filter((a) => a.id !== id) })),
}));

/** Alarmas vigentes (descarta las de una sola vez que ya sonaron). */
export function activeAlarms(): TrackedAlarm[] {
  return pruneExpired(useAlarmStore.getState().alarms);
}

useAlarmStore.subscribe((state, prev) => {
  if (!state.hydrated || state.alarms === prev.alarms) return;
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state.alarms)).catch(() => {});
});
