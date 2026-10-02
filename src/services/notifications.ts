import messaging from "@react-native-firebase/messaging";
import * as Notifications from "expo-notifications";
import { apiFetch } from "@/api/client";

export const RESCHEDULE_CATEGORY = "RESCHEDULE_SUGGESTION";
export const SUGGESTION_CHANNEL_ID = "suggestions";

/** Canal de Android (obligatorio desde Android 8) para avisos de conflictos. */
export async function ensureSuggestionChannel() {
  await Notifications.setNotificationChannelAsync(SUGGESTION_CHANNEL_ID, {
    name: "Sugerencias de agenda",
    importance: Notifications.AndroidImportance.HIGH,
  });
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Define los botones de acción ("Aceptar cambio" / "Ignorar") que
 * aparecen directo en la notificación de Android, sin abrir la app.
 */
export async function registerNotificationCategories() {
  await ensureSuggestionChannel();
  // Los botones abren la app: con la app cerrada, es la única forma fiable de que
  // el código que responde a la acción llegue a ejecutarse.
  await Notifications.setNotificationCategoryAsync(RESCHEDULE_CATEGORY, [
    {
      identifier: "ACCEPT",
      buttonTitle: "Aceptar cambio",
      options: { opensAppToForeground: true },
    },
    {
      identifier: "IGNORE",
      buttonTitle: "Ignorar",
      options: { opensAppToForeground: true },
    },
  ]);
}

export async function requestNotificationPermissions() {
  const settings = await messaging().requestPermission();
  return (
    settings === messaging.AuthorizationStatus.AUTHORIZED ||
    settings === messaging.AuthorizationStatus.PROVISIONAL
  );
}

/**
 * Obtiene el device token de FCM y lo registra en el backend para
 * que pueda enviar pushes dirigidos a este dispositivo.
 */
export async function registerDeviceForPush() {
  const token = await messaging().getToken();
  await apiFetch("/api/devices/register", {
    method: "POST",
    body: { fcmToken: token, platform: "android" },
  });
  return token;
}

/**
 * Maneja la respuesta del usuario a los botones de acción de la
 * notificación (funciona incluso con la app cerrada/en background).
 */
export function attachNotificationResponseListener(
  onAction: (eventId: string, action: "ACCEPT" | "IGNORE") => void
) {
  const subscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      const eventId = response.notification.request.content.data
        ?.eventId as string | undefined;
      const actionId = response.actionIdentifier as "ACCEPT" | "IGNORE" | string;

      if (eventId && (actionId === "ACCEPT" || actionId === "IGNORE")) {
        onAction(eventId, actionId);
      }
    }
  );
  return () => subscription.remove();
}
