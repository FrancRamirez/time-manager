import { create } from "zustand";
import type { CalendarEvent, RescheduleSuggestion } from "@/types";

interface AgendaState {
  events: CalendarEvent[];
  suggestions: RescheduleSuggestion[];
  setEvents: (events: CalendarEvent[]) => void;
  setSuggestions: (suggestions: RescheduleSuggestion[]) => void;
  removeSuggestion: (eventId: string) => void;
}

export const useAgendaStore = create<AgendaState>((set) => ({
  events: [],
  suggestions: [],
  setEvents: (events) => set({ events }),
  setSuggestions: (suggestions) => set({ suggestions }),
  removeSuggestion: (eventId) =>
    set((state) => ({
      suggestions: state.suggestions.filter((s) => s.eventId !== eventId),
    })),
}));
