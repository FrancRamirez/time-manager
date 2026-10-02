import { Alert } from "react-native";
import * as clock from "@/services/clock";
import { composeWhatsapp, type ChooseOption } from "@/services/whatsapp";
import { activeAlarms, newAlarmId, nextFireAt, useAlarmStore } from "@/store/alarmStore";
import type { DeviceAction } from "@/api/gemini";

/** Interfaz que la pantalla ofrece para las acciones que necesitan elegir algo. */
export interface DeviceUi {
  chooseOption: ChooseOption;
}

export interface DeviceActionResult {
  ok: boolean;
  /** Mensaje para mostrar en el chat. */
  message: string;
}

const CLOCK_APP_HINT = "Revisa que la app Reloj de tu teléfono esté habilitada.";

function failure(what: string, error?: string): DeviceActionResult {
  if (error) console.warn(`[reloj] ${what}:`, error);
  return { ok: false, message: `No pude ${what}. ${CLOCK_APP_HINT}` };
}

/** Ejecuta en el dispositivo una acción que propuso el asistente y actualiza el registro de alarmas. */
export async function executeDeviceAction(
  action: DeviceAction,
  ui: DeviceUi
): Promise<DeviceActionResult> {
  const store = useAlarmStore.getState();

  switch (action.kind) {
    case "alarm_set": {
      const res = await clock.setAlarm(action);
      if (!res.ok) return failure("crear la alarma", res.error);
      store.add({
        id: newAlarmId(),
        hour: action.hour,
        minute: action.minute,
        days: action.days,
        label: action.label,
        fireAt: action.days.length ? undefined : nextFireAt(action.hour, action.minute),
      });
      return { ok: true, message: "Listo, la alarma quedó programada en el Reloj." };
    }

    case "alarm_update": {
      // Primero se descarta la anterior; si eso falla no se crea la nueva (evita duplicados).
      const dismissed = await clock.dismissAlarm(action.old);
      if (!dismissed.ok) return failure("modificar la alarma", dismissed.error);
      const created = await clock.setAlarm(action.new);
      if (!created.ok) {
        store.remove(action.alarmId);
        return {
          ok: false,
          message:
            "Descarté la alarma anterior pero no pude crear la nueva. Pídemela de nuevo. " +
            CLOCK_APP_HINT,
        };
      }
      store.replace(action.alarmId, {
        id: action.alarmId,
        hour: action.new.hour,
        minute: action.new.minute,
        days: action.new.days,
        label: action.new.label,
        fireAt: action.new.days.length ? undefined : nextFireAt(action.new.hour, action.new.minute),
      });
      return { ok: true, message: "Listo, modifiqué la alarma en el Reloj." };
    }

    case "alarm_cancel": {
      const res = await clock.dismissAlarm(action);
      if (!res.ok) {
        // Sin app de reloj compatible: se abre la lista para que la borre a mano.
        await clock.showAlarms();
        return failure("cancelar la alarma automáticamente (te abrí la lista de alarmas para borrarla)", res.error);
      }
      // Android no confirma si se borró: se saca del registro y se avisa.
      store.remove(action.alarmId);
      return {
        ok: true,
        message:
          "Le pedí al Reloj que cancelara la alarma. Si todavía aparece allí, bórrala desde la app Reloj: no hay forma de comprobarlo desde aquí.",
      };
    }

    case "whatsapp_send":
      return composeWhatsapp(action, ui.chooseOption);

    case "timer_set": {
      const res = await clock.setTimer(action);
      if (!res.ok) return failure("iniciar el temporizador", res.error);
      return { ok: true, message: "Listo, el temporizador está en marcha." };
    }
  }
}

/**
 * Aplica la acción según corresponda: con confirmación (Alert) o de inmediato
 * (Piloto Automático). `report` recibe el resultado para mostrarlo en el chat.
 */
export function handleDeviceAction(
  action: DeviceAction,
  report: (result: DeviceActionResult) => void,
  ui: DeviceUi
) {
  const run = async () => report(await executeDeviceAction(action, ui));

  if (!action.requiresConfirmation) {
    void run();
    return;
  }
  const isWhatsapp = action.kind === "whatsapp_send";
  Alert.alert(
    isWhatsapp ? "Preparar mensaje de WhatsApp" : "Confirmar acción",
    action.description,
    [
      { text: "Cancelar", style: "cancel", onPress: () => report({ ok: true, message: "Entendido, no hice cambios." }) },
      { text: isWhatsapp ? "Abrir WhatsApp" : "Confirmar", onPress: () => void run() },
    ],
    { cancelable: false }
  );
}

/** Registro de alarmas en el formato que espera el backend. */
export function registeredAlarms() {
  return activeAlarms().map(({ id, hour, minute, days, label }) => ({ id, hour, minute, days, label }));
}
