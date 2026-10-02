import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { View, Text, FlatList, StyleSheet, RefreshControl, Alert } from "react-native";
import { EventCard } from "@/components/EventCard";
import { ApiError, apiErrorMessage } from "@/api/client";
import { useAgendaStore } from "@/store/agendaStore";
import {
  fetchUpcomingEvents,
  fetchPendingSuggestions,
  respondToSuggestion,
  scanForConflicts,
  type ScanResult,
} from "@/api/calendar";

export default function AgendaScreen() {
  const { events, suggestions, setEvents, setSuggestions, removeSuggestion } =
    useAgendaStore();
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(
    async (opts: { force?: boolean } = {}) => {
      // Primero se analiza la agenda (detecta conflictos y genera sugerencias);
      // si el análisis falla, igual se muestran los eventos.
      let scan: ScanResult | null = null;
      try {
        scan = await scanForConflicts({ force: opts.force });
      } catch {
        /* se sigue con lo que ya hay guardado */
      }

      const [nextEvents, nextSuggestions] = await Promise.all([
        fetchUpcomingEvents(),
        fetchPendingSuggestions(),
      ]);
      setEvents(nextEvents);
      setSuggestions(nextSuggestions);

      if (scan && scan.applied.length > 0) {
        Alert.alert(
          "Piloto Automático",
          scan.applied.map((a) => `• ${a.description}`).join("\n")
        );
      }
    },
    [setEvents, setSuggestions]
  );

  // Se recarga cada vez que la pestaña recibe el foco: así aparecen los eventos
  // que el asistente acaba de crear o mover.
  useFocusEffect(
    useCallback(() => {
      loadData().catch(() => {
        /* el estado vacío ya cubre el caso de error en esta versión inicial */
      });
    }, [loadData])
  );

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await loadData({ force: true });
    } catch {
      /* se mantiene lo que había */
    } finally {
      setRefreshing(false);
    }
  }

  async function handleSuggestion(eventId: string, accepted: boolean) {
    try {
      await respondToSuggestion(eventId, accepted);
      removeSuggestion(eventId);
      // Al aceptar, el evento cambió de horario: se recarga la agenda.
      if (accepted) loadData().catch(() => {});
    } catch (err) {
      // 404: el evento ya no existe o la sugerencia ya se resolvió.
      if (err instanceof ApiError && err.status === 404) {
        removeSuggestion(eventId);
        loadData().catch(() => {});
      }
      Alert.alert(
        "No se pudo aplicar",
        apiErrorMessage(err, "No se pudo procesar la sugerencia. Intenta de nuevo.")
      );
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
