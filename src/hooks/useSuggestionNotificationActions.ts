import { useEffect } from "react";
import { Alert } from "react-native";
import * as Notifications from "expo-notifications";
import { apiErrorMessage } from "@/api/client";
import { fetchUpcomingEvents, respondToSuggestion } from "@/api/calendar";
import { useAgendaStore } from "@/store/agendaStore";

// Evita procesar dos veces la misma pulsación (listener + respuesta de arranque en frío).
const handled = new Set<string>();

/**
 * Responde a los botones "Aceptar cambio" / "Ignorar" de las notificaciones de
 * conflicto. Cubre también la pulsación que abrió la app desde cerrada.
 */
export function useSuggestionNotificationActions() {
  useEffect(() => {
    async function handle(response: Notifications.NotificationResponse) {
      const action = response.actionIdentifier;
      const eventId = response.notification.request.content.data?.eventId;
      if (typeof eventId !== "string" || (action !== "ACCEPT" && action !== "IGNORE")) return;

      const key = `${response.notification.request.identifier}:${action}`;
      if (handled.has(key)) return;
      handled.add(key);

      try {
        await respondToSuggestion(eventId, action === "ACCEPT");
        useAgendaStore.getState().removeSuggestion(eventId);
        if (action === "ACCEPT") {
          fetchUpcomingEvents()
            .then((events) => useAgendaStore.getState().setEvents(events))
            .catch(() => {});
          Alert.alert("Listo", "El evento se movió a su nuevo horario.");
        }
      } catch (err) {
        Alert.alert(
          "No se pudo aplicar",
          apiErrorMessage(err, "No se pudo procesar la sugerencia. Intenta de nuevo.")
        );
      }
    }

    Notifications.getLastNotificationResponseAsync()
      .then((response) => response && handle(response))
      .catch(() => {});
    const subscription = Notifications.addNotificationResponseReceivedListener(handle);
    return () => subscription.remove();
  }, []);
}
