import * as TaskManager from "expo-task-manager";
import * as BackgroundFetch from "expo-background-fetch";
import { fetchPendingSuggestions } from "@/api/calendar";

export const SYNC_TASK_NAME = "TIME_MANAGER_AGENDA_SYNC";

// El cuerpo de la tarea debe registrarse en el scope global, fuera de
// cualquier componente, para que WorkManager pueda invocarlo aunque
// la app esté cerrada.
TaskManager.defineTask(SYNC_TASK_NAME, async () => {
  try {
    const suggestions = await fetchPendingSuggestions();
    // Si hay sugerencias nuevas, el backend ya disparó el push por FCM;
    // acá solo refrescamos el estado local si la app está en foreground.
    return suggestions.length > 0
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
