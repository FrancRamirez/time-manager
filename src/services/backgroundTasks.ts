import * as TaskManager from "expo-task-manager";
import * as BackgroundFetch from "expo-background-fetch";
import * as Notifications from "expo-notifications";
import { scanForConflicts, type ScanResult } from "@/api/calendar";
import { useSettingsStore } from "@/store/settingsStore";
import {
  RESCHEDULE_CATEGORY,
  SUGGESTION_CHANNEL_ID,
  ensureSuggestionChannel,
} from "@/services/notifications";

export const SYNC_TASK_NAME = "TIME_MANAGER_AGENDA_SYNC";

/**
 * Avisa con una notificación local de lo que encontró el análisis. El backend solo
 * informa como "nuevas" las sugerencias que todavía no existían, así que cada
 * conflicto se notifica una única vez aunque la tarea corra cada 15 minutos.
 */
async function notifyScan(scan: ScanResult): Promise<boolean> {
  if (scan.applied.length === 0 && scan.created.length === 0) return false;
  await ensureSuggestionChannel();
  const trigger = { channelId: SUGGESTION_CHANNEL_ID };

  if (scan.applied.length > 0) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Piloto Automático",
        body: scan.applied
          .slice(0, 3)
          .map((a) => a.description)
          .join("\n"),
      },
      trigger,
    });
  }

  if (scan.created.length === 1) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Conflicto en tu agenda",
        body: scan.created[0].reason,
        data: { eventId: scan.created[0].eventId },
        categoryIdentifier: RESCHEDULE_CATEGORY,
      },
      trigger,
    });
  } else if (scan.created.length > 1) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `Hay ${scan.created.length} conflictos en tu agenda`,
        body: "Abre Time Manager para revisar las sugerencias.",
      },
      trigger,
    });
  }
  return true;
}

// El cuerpo de la tarea debe registrarse en el scope global, fuera de
// cualquier componente, para que WorkManager pueda invocarlo aunque
// la app esté cerrada.
TaskManager.defineTask(SYNC_TASK_NAME, async () => {
  try {
    // Con la app cerrada, los ajustes (buffer, franjas, autonomía) aún no se cargaron.
    if (!useSettingsStore.getState().hydrated) {
      await useSettingsStore.getState().hydrate();
    }
    const scan = await scanForConflicts({ force: true });
    if (!scan) return BackgroundFetch.BackgroundFetchResult.NoData;
    const notified = await notifyScan(scan);
    return notified
      ? BackgroundFetch.BackgroundFetchResult.NewData
      : BackgroundFetch.BackgroundFetchResult.NoData;
  } catch (error) {
    console.warn("Fallo la sincronización en background", error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

/**
 * Registra la tarea periódica. El intervalo mínimo real en Android
 * depende del Doze Mode del dispositivo; 15 min es el piso razonable
 * para no agotar batería.
 */
export async function registerBackgroundSync() {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(SYNC_TASK_NAME);
  if (isRegistered) return;

  await BackgroundFetch.registerTaskAsync(SYNC_TASK_NAME, {
    minimumInterval: 15 * 60, // segundos
    stopOnTerminate: false,
    startOnBoot: true,
  });
}

export async function unregisterBackgroundSync() {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(SYNC_TASK_NAME);
  if (isRegistered) {
    await BackgroundFetch.unregisterTaskAsync(SYNC_TASK_NAME);
  }
}
