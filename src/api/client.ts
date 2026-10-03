import {
  getAccessToken,
  getRefreshToken,
  saveAccessToken,
} from "@/services/secureStorage";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

if (!API_URL) {
  console.warn(
    "EXPO_PUBLIC_API_URL no está definida. Configurá tu .env antes de compilar."
  );
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

/** Extrae el texto de `{ "error": "..." }` que devuelve el backend. */
export function apiErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    try {
      const parsed = JSON.parse(err.message) as { error?: unknown };
      if (typeof parsed.error === "string" && parsed.error) return parsed.error;
    } catch {
      /* el cuerpo no era JSON */
    }
  }
  return fallback;
}

export type SessionLostReason = "expired" | "google_reauth";

let onSessionLost: ((reason: SessionLostReason) => void) | null = null;

/** La app registra acá qué hacer cuando la sesión ya no sirve (la tarea en segundo plano no lo registra). */
export function setSessionLostHandler(handler: ((reason: SessionLostReason) => void) | null) {
  onSessionLost = handler;
}

function errorCode(text: string): string | undefined {
  try {
    const code = (JSON.parse(text) as { code?: unknown }).code;
    return typeof code === "string" ? code : undefined;
  } catch {
    return undefined;
  }
}

/** ok = access renovado; invalid = el refresh ya no vale (login); unavailable = sin red o servidor caído (NO cerrar sesión). */
type RefreshResult = "ok" | "invalid" | "unavailable";

let refreshInFlight: Promise<RefreshResult> | null = null;

/** Una sola renovación a la vez, aunque varias requests reciban 401 al mismo tiempo. */
function refreshSession(): Promise<RefreshResult> {
  if (!refreshInFlight) {
    refreshInFlight = doRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

async function doRefresh(): Promise<RefreshResult> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return "invalid";
  try {
    const res = await fetch(`${API_URL}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (res.status === 401) return "invalid";
    if (!res.ok) return "unavailable";
    const data = (await res.json()) as { accessToken?: string };
    if (!data.accessToken) return "unavailable";
    await saveAccessToken(data.accessToken);
    return "ok";
  } catch {
    return "unavailable";
  }
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  auth?: boolean; // default true
}

/**
 * Wrapper único para todas las llamadas al backend.
 * Toda la lógica de Calendar, Gmail y Gemini vive server-side;
 * la app nunca llama directo a esas APIs externas.
 *
 * Ante un 401 con sesión: si Google invalidó la conexión (code "google_reauth") avisa para ir
 * al Login; si no, renueva el accessToken una vez y reintenta.
 */
export async function apiFetch<T>(
  path: string,
  { body, auth = true, headers, ...rest }: RequestOptions = {}
): Promise<T> {
  const attempt = async (): Promise<Response | null> => {
    const finalHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      ...(headers as Record<string, string>),
    };
    if (auth) {
      const token = await getAccessToken();
      if (!token) return null;
      finalHeaders.Authorization = `Bearer ${token}`;
    }
    return fetch(`${API_URL}${path}`, {
      ...rest,
      headers: finalHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  };

  let renewed = false;
  for (;;) {
    const response = await attempt();

    if (response?.ok) {
      // Algunas respuestas (ej. DELETE) pueden no traer body
      const contentType = response.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        return (await response.json()) as T;
      }
      return undefined as T;
    }

    // response === null: no hay accessToken guardado.
    const status = response ? response.status : 401;
    const text = response
      ? (await response.text().catch(() => "")) || response.statusText
      : "No hay sesión activa";

    if (auth && status === 401) {
      if (errorCode(text) === "google_reauth") {
        onSessionLost?.("google_reauth");
        throw new ApiError(401, text);
      }
      if (!renewed) {
        renewed = true;
        const result = await refreshSession();
        if (result === "ok") continue; // reintenta con el access nuevo
        if (result === "invalid") onSessionLost?.("expired");
        // "unavailable": sin red o servidor caído; se informa el error pero la sesión se conserva.
      } else {
        onSessionLost?.("expired"); // ya renovado y sigue dando 401
      }
    }
    throw new ApiError(status, text);
  }
}
