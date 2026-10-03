import { useSettingsStore } from "@/store/settingsStore";

/**
 * Preferencias que el backend debe respetar al crear o mover eventos (el servidor
 * las valida y las hace cumplir). Se mandan junto con cada request relevante.
 */
export function assistantSettings() {
  const { autonomyLevel, bufferMinutes, dailyActionLimit, blockedHours, appAccess } =
    useSettingsStore.getState().settings;
  return {
    autonomyLevel,
    bufferMinutes,
    dailyActionLimit,
    appAccess: { ...appAccess },
    blockedHours: blockedHours.map(({ dayOfWeek, startTime, endTime, label }) => ({
      dayOfWeek,
      startTime,
      endTime,
      label,
    })),
  };
}

export function deviceTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
