import { View, Text, StyleSheet } from "react-native";
import type { CalendarEvent } from "@/types";

function formatRange(startsAt: string, endsAt: string) {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const fmt = (d: Date) =>
    d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  return `${fmt(start)} – ${fmt(end)}`;
}

export function EventCard({ event }: { event: CalendarEvent }) {
  return (
    <View style={styles.card}>
      <View style={styles.timeColumn}>
        <Text style={styles.time}>{formatRange(event.startsAt, event.endsAt)}</Text>
      </View>
      <View style={styles.infoColumn}>
        <Text style={styles.title}>{event.title}</Text>
        {event.location ? (
          <Text style={styles.location}>{event.location}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    backgroundColor: "#1E293B",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    gap: 12,
  },
  timeColumn: {
    minWidth: 90,
  },
  time: {
    color: "#94A3B8",
    fontSize: 13,
    fontWeight: "500",
  },
  infoColumn: {
    flex: 1,
  },
  title: {
    color: "#F1F5F9",
    fontSize: 15,
    fontWeight: "600",
  },
  location: {
    color: "#64748B",
    fontSize: 12,
    marginTop: 2,
  },
});
