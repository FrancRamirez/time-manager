import { apiFetch } from "./client";
import type { ChatMessage } from "@/types";

interface SendMessageResponse {
  reply: ChatMessage;
  /** Si Gemini disparó una function call que requiere confirmación del usuario */
  pendingAction?: {
    type: "reschedule" | "cancel" | "create";
    description: string;
    payload: Record<string, unknown>;
  };
}

/**
 * Envía un mensaje del usuario al backend, que lo reenvía a Gemini con
 * function calling habilitado. El mensaje NO se persiste (procesamiento
 * efímero, según la spec de privacidad).
 */
export function sendChatMessage(message: string) {
  return apiFetch<SendMessageResponse>("/api/ai/chat", {
    method: "POST",
    body: { message },
  });
}

export function confirmPendingAction(actionId: string, approve: boolean) {
  return apiFetch<void>(`/api/ai/actions/${actionId}/confirm`, {
    method: "POST",
    body: { approve },
  });
}
