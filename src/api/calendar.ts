import { apiFetch } from "./client";
import { assistantSettings, deviceTimeZone } from "./preferences";
import type { CalendarEvent, RescheduleSuggestion } from "@/types";

/** Resultado del análisis de conflictos que hace el backend. */
export interface ScanResult {
  /** Sugerencias nuevas (todavía sin avisar al usuario). */
  created: { eventId: string; reason: string }[];
  /** Cambios que el Piloto Automático ya aplicó en el calendario. */
  applied: { eventId: string; title: string; from: string; to: string; description: string }[];
  pending: number;
  unresolved: number;
}

const SCAN_MIN_INTERVAL_MS = 60_000;
let lastScanAt = 0;
let lastScanKey = "";
let scanInFlight: Promise<ScanResult | null> | null = null;

/**
 * Pide al backend que analice la agenda y genere sugerencias de reprogramación.
 * Devuelve null si se omitió por haberse analizado hace menos de un minuto con los
 * mismos ajustes (cambiar buffer, franjas o autonomía fuerza un análisis nuevo).
 */
export function scanForConflicts(options: { force?: boolean } = {}): Promise<ScanResult | null> {
  if (scanInFlight) return scanInFlight;

  const settings = assistantSettings();
  const key = JSON.stringify(settings);
  // Con Calendar restringido el servidor no analiza nada: basta avisarle una vez por cambio de
  // ajustes (así retira las sugerencias pendientes) y no repetir la llamada.
  if (settings.appAccess.calendar !== "allowed" && key === lastScanKey) return Promise.resolve(null);
  const fresh = Date.now() - lastScanAt < SCAN_MIN_INTERVAL_MS && key === lastScanKey;
  if (!options.force && fresh) return Promise.resolve(null);

  scanInFlight = apiFetch<ScanResult>("/api/calendar/scan", {
    method: "POST",
    body: { timeZone: deviceTimeZone(), settings },
  })
    .then((result) => {
      lastScanAt = Date.now();
      lastScanKey = key;
      return result;
    })
    .finally(() => {
      scanInFlight = null;
    });
  return scanInFlight;
}

export function fetchUpcomingEvents(daysAhead = 7) {
  return apiFetch<CalendarEvent[]>(`/api/calendar/events?days=${daysAhead}`);
}

export function fetchPendingSuggestions() {
  return apiFetch<RescheduleSuggestion[]>("/api/calendar/suggestions");
}

export function respondToSuggestion(eventId: string, accepted: boolean) {
  return apiFetch<void>(`/api/calendar/suggestions/${eventId}`, {
    method: "POST",
    // El backend valida el nuevo horario contra el calendario, el buffer y las franjas
    // intocables antes de mover el evento.
    body: { accepted, timeZone: deviceTimeZone(), settings: assistantSettings() },
  });
}

export function cancelEvent(eventId: string) {
  // Acción destructiva: el backend exige un flag explícito de confirmación
  return apiFetch<void>(`/api/calendar/events/${eventId}`, {
    method: "DELETE",
    body: { confirmed: true },
  });
}
