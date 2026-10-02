import { apiFetch } from "./client";
import { assistantSettings, deviceTimeZone } from "./preferences";
import { registeredAlarms } from "@/services/deviceActions";
import type { Day } from "@/services/clock";
import type { ChatMessage } from "@/types";

interface AlarmFields {
  hour: number;
  minute: number;
  days: Day[];
  label?: string;
}

/** Acción sobre el reloj del dispositivo: la ejecuta la app (el servidor no puede). */
export type DeviceAction = (
  | ({ kind: "alarm_set" } & AlarmFields)
  | ({ kind: "alarm_cancel"; alarmId: string } & AlarmFields)
  | { kind: "alarm_update"; alarmId: string; old: AlarmFields; new: AlarmFields }
  | { kind: "timer_set"; seconds: number; label?: string }
  | { kind: "whatsapp_send"; contactName?: string; phone?: string; message: string }
) & {
  description: string;
  /** true: pedir confirmación antes de ejecutar. false: ejecutar de inmediato. */
  requiresConfirmation: boolean;
};

export interface PendingAction {
  /** Id de la fila en pending_actions; se usa para confirmar o rechazar. */
  id: string;
  type: "reschedule" | "cancel" | "create";
  /** Texto armado por el servidor con los datos validados de la acción. */
  description: string;
  payload: Record<string, unknown>;
}

interface SendMessageResponse {
  reply: ChatMessage;
  pendingAction?: PendingAction;
  /** Acción aplicada de inmediato (modo Piloto Automático). */
  executedAction?: { type: PendingAction["type"]; description: string };
  deviceAction?: DeviceAction;
}

const MAX_HISTORY = 10;

/**
 * Envía el mensaje al backend, que lo reenvía a Gemini con function calling.
 * El servidor no guarda conversaciones (procesamiento efímero), así que la
 * app manda los últimos mensajes como contexto en cada request.
 *
 * `viaVoice` avisa que el texto viene del dictado y puede traer errores de
 * transcripción: el asistente pregunta si algo clave no queda claro.
 */
export function sendChatMessage(
  message: string,
  history: ChatMessage[] = [],
  options: { viaVoice?: boolean } = {}
) {
  return apiFetch<SendMessageResponse>("/api/ai/chat", {
    method: "POST",
    body: {
      message,
      history: history
        .filter((m) => !m.id.startsWith("error-"))
        .slice(-MAX_HISTORY)
        .map(({ role, content }) => ({ role, content })),
      timeZone: deviceTimeZone(),
      settings: assistantSettings(),
      viaVoice: options.viaVoice === true,
      alarms: registeredAlarms(),
    },
  });
}

export function confirmPendingAction(actionId: string, approve: boolean) {
  return apiFetch<{ ok: boolean; executed: boolean }>(
    `/api/ai/actions/${actionId}/confirm`,
    { method: "POST", body: { approve } }
  );
}
