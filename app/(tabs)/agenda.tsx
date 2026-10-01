import { useCallback, useEffect, useState } from "react";
import { View, Text, FlatList, StyleSheet, RefreshControl, Alert } from "react-native";
import { EventCard } from "@/components/EventCard";
import { useAgendaStore } from "@/store/agendaStore";
import {
  fetchUpcomingEvents,
  fetchPendingSuggestions,
  respondToSuggestion,
} from "@/api/calendar";

export default function AgendaScreen() {
  const { events, suggestions, setEvents, setSuggestions, removeSuggestion } =
    useAgendaStore();
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    const [nextEvents, nextSuggestions] = await Promise.all([
      fetchUpcomingEvents(),
      fetchPendingSuggestions(),
    ]);
    setEvents(nextEvents);
    setSuggestions(nextSuggestions);
  }, [setEvents, setSuggestions]);

  useEffect(() => {
    loadData().catch(() => {
      /* el estado vacío ya cubre el caso de error en esta versión inicial */
    });
  }, [loadData]);

  async function handleRefresh() {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }

  async function handleSuggestion(eventId: string, accepted: boolean) {
    try {
      await respondToSuggestion(eventId, accepted);
      removeSuggestion(eventId);
    } catch {
      Alert.alert("Error", "No se pudo procesar la sugerencia. Probá de nuevo.");
    }
  }

  return (
    <View style={styles.container}>
      {suggestions.length > 0 && (
        <View style={styles.suggestionsBanner}>
          <Text style={styles.suggestionsTitle}>
            Tenés {suggestions.length} sugerencia(s) pendiente(s)
          </Text>
          {suggestions.map((s) => (
            <View key={s.eventId} style={styles.suggestionRow}>
              <Text style={styles.suggestionText}>{s.reason}</Text>
              <View style={styles.suggestionActions}>
                <Text
                  style={styles.acceptText}
                  onPress={() => handleSuggestion(s.eventId, true)}
                >
                  Aceptar
                </Text>
                <Text
                  style={styles.ignoreText}
                  onPress={() => handleSuggestion(s.eventId, false)}
                >
                  Ignorar
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      <FlatList
        data={events}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <EventCard event={item} />}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#38BDF8" />
        }
        ListEmptyComponent={
          <Text style={styles.empty}>No hay eventos próximos.</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A", padding: 16 },
  listContent: { paddingBottom: 24 },
  empty: { color: "#64748B", textAlign: "center", marginTop: 40 },
  suggestionsBanner: {
    backgroundColor: "#0C2536",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  suggestionsTitle: { color: "#38BDF8", fontWeight: "700", marginBottom: 8 },
  suggestionRow: { marginBottom: 8 },
  suggestionText: { color: "#E2E8F0", fontSize: 13 },
  suggestionActions: { flexDirection: "row", gap: 16, marginTop: 4 },
  acceptText: { color: "#4ADE80", fontWeight: "600", fontSize: 13 },
  ignoreText: { color: "#F87171", fontWeight: "600", fontSize: 13 },
});
