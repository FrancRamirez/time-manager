import { ApiError, apiFetch } from "./client";

/** Lo que devuelve el backend (los tiempos vienen en segundos, relativos al momento de la respuesta). */
export interface AiUsage {
  used: number;
  /** 0 = sin límite propio. */
  limit: number;
  remaining: number;
  resetsInSeconds: number;
}

/** Igual que AiUsage, pero con el instante de renovación anclado al reloj del teléfono. */
export interface UsageState {
  used: number;
  limit: number;
  remaining: number;
  /** Epoch ms en que se renuevan los mensajes. */
  until: number;
}

/** La IA no se puede usar hasta `until` (epoch ms). */
export interface AiBlock {
  reason: "user_limit" | "ai_quota";
  until: number;
}

export function toUsageState(u: AiUsage, now = Date.now()): UsageState {
  return {
    used: u.used,
    limit: u.limit,
    remaining: u.remaining,
    until: now + u.resetsInSeconds * 1000,
  };
}

/** Pregunta al backend cuántos mensajes quedan hoy (y si la IA ya sabe que no tiene cupo). */
export async function fetchAiUsage(): Promise<{ usage: UsageState; aiBlock: AiBlock | null }> {
  const now = Date.now();
  const data = await apiFetch<{ usage: AiUsage; aiRetryAfterSeconds: number | null }>(
    "/api/ai/usage"
  );
  const wait = data.aiRetryAfterSeconds;
  return {
    usage: toUsageState(data.usage, now),
    aiBlock: wait && wait > 0 ? { reason: "ai_quota", until: now + wait * 1000 } : null,
  };
}

/**
 * Si el error del chat es "sin mensajes" (429 user_limit) o "la IA agotó su cuota" (503 ai_quota),
 * devuelve hasta cuándo esperar; si es otro error, null.
 */
export function blockFromError(err: unknown): AiBlock | null {
  if (!(err instanceof ApiError)) return null;
  try {
    const body = JSON.parse(err.message) as { code?: unknown; retryAfterSeconds?: unknown };
    const wait = Number(body.retryAfterSeconds);
    if ((body.code === "user_limit" || body.code === "ai_quota") && wait > 0) {
      return { reason: body.code, until: Date.now() + wait * 1000 };
    }
  } catch {
    /* el cuerpo no era JSON */
  }
  return null;
}

/** 15096000 ms -> "4 h 11 min 36 s". */
export function formatWait(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (h > 0) return `${h} h ${pad(m)} min ${pad(s)} s`;
  if (m > 0) return `${m} min ${pad(s)} s`;
  return `${s} s`;
}
