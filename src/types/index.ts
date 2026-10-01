export type AutonomyLevel = "suggestion" | "autopilot";

export interface User {
  id: string;
  email: string;
  name: string;
  photoUrl?: string;
  onboardingCompleted: boolean;
  subscriptionActive: boolean;
}

export interface CalendarEvent {
  id: string;
  title: string;
  startsAt: string; // ISO 8601
  endsAt: string; // ISO 8601
  location?: string;
  source: "google_calendar" | "gmail_detected" | "manual";
  status: "confirmed" | "tentative" | "cancelled";
}

export interface BlockedHourRange {
  id: string;
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = domingo
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
  label?: string;
}

export interface UserSettings {
  autonomyLevel: AutonomyLevel;
  dailyActionLimit: number;
  bufferMinutes: number;
  blockedHours: BlockedHourRange[];
  notificationChannels: {
    sound: boolean;
    vibration: boolean;
    highPriority: boolean;
  };
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface RescheduleSuggestion {
  eventId: string;
  currentSlot: { startsAt: string; endsAt: string };
  proposedSlot: { startsAt: string; endsAt: string };
  reason: string;
}
