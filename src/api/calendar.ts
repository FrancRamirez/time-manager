import { apiFetch } from "./client";
import type { CalendarEvent, RescheduleSuggestion } from "@/types";

export function fetchUpcomingEvents(daysAhead = 7) {
  return apiFetch<CalendarEvent[]>(`/api/calendar/events?days=${daysAhead}`);
}

export function fetchPendingSuggestions() {
  return apiFetch<RescheduleSuggestion[]>("/api/calendar/suggestions");
}

export function respondToSuggestion(eventId: string, accepted: boolean) {
  return apiFetch<void>(`/api/calendar/suggestions/${eventId}`, {
    method: "POST",
    body: { accepted },
  });
}

export function cancelEvent(eventId: string) {
  // Acción destructiva: el backend exige un flag explícito de confirmación
  return apiFetch<void>(`/api/calendar/events/${eventId}`, {
    method: "DELETE",
    body: { confirmed: true },
  });
}
