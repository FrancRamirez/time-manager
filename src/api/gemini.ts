import { apiFetch } from "./client";
import type { ChatMessage } from "@/types";
import { useSettingsStore } from "@/store/settingsStore";

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
}

const MAX_HISTORY = 10;

/** Preferencias que el asistente debe respetar (el servidor las valida y las hace cumplir). */
function assistantSettings() {
  const { autonomyLevel, bufferMinutes, dailyActionLimit, blockedHours } =
    useSettingsStore.getState().settings;
  return {
    autonomyLevel,
    bufferMinutes,
    dailyActionLimit,
    blockedHours: blockedHours.map(({ dayOfWeek, startTime, endTime, label }) => ({
      dayOfWeek,
      startTime,
      endTime,
      label,
    })),
  };
}

/**
 * Envía el mensaje al backend, que lo reenvía a Gemini con function calling.
 * El servidor no guarda conversaciones (procesamiento efímero), así que la
 * app manda los últimos mensajes como contexto en cada request.
 */
export function sendChatMessage(message: string, history: ChatMessage[] = []) {
  return apiFetch<SendMessageResponse>("/api/ai/chat", {
    method: "POST",
    body: {
      message,
      history: history
        .filter((m) => !m.id.startsWith("error-"))
        .slice(-MAX_HISTORY)
        .map(({ role, content }) => ({ role, content })),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      settings: assistantSettings(),
    },
  });
}

export function confirmPendingAction(actionId: string, approve: boolean) {
  return apiFetch<{ ok: boolean; executed: boolean }>(
    `/api/ai/actions/${actionId}/confirm`,
    { method: "POST", body: { approve } }
  );
}
