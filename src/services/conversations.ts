import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ChatMessage } from "@/types";

/**
 * Historial de conversaciones del asistente, guardado SOLO en el teléfono
 * (AsyncStorage). El servidor sigue sin guardar ningún mensaje.
 *
 * Disposición: un índice liviano (`tm_conv_index`) con título y fechas, y los
 * mensajes de cada conversación en su propia clave (`tm_conv_<id>`), para no
 * reescribir todo el historial con cada mensaje.
 */

const INDEX_KEY = "tm_conv_index";
const ACTIVE_KEY = "tm_conv_active";
const msgKey = (id: string) => `tm_conv_${id}`;

export const MAX_CONVERSATIONS = 50; // al pasarse, se descartan las más antiguas
export const MAX_MESSAGES = 100; // por conversación (los más recientes)
const MAX_CONTENT = 4000;
const TITLE_LENGTH = 48;

export interface ConversationMeta {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

// Las escrituras al índice se encadenan para que dos guardados seguidos no se pisen.
let queue: Promise<unknown> = Promise.resolve();
function serialized<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

export function newConversationId(): string {
  return `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Título = primer mensaje del usuario, recortado (no gasta peticiones a la IA). */
export function titleFrom(messages: ChatMessage[]): string {
  const first = messages.find((m) => m.role === "user")?.content ?? "";
  const clean = first.replace(/\s+/g, " ").trim();
  if (!clean) return "Conversación";
  return clean.length > TITLE_LENGTH ? `${clean.slice(0, TITLE_LENGTH - 1)}…` : clean;
}

async function readIndex(): Promise<ConversationMeta[]> {
  try {
    const raw = await AsyncStorage.getItem(INDEX_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (m): m is ConversationMeta =>
        m && typeof m.id === "string" && typeof m.title === "string" && typeof m.updatedAt === "string"
    );
  } catch {
    return []; // JSON corrupto: se empieza de cero antes que fallar
  }
}

function sanitize(messages: ChatMessage[]): ChatMessage[] {
  return messages
    .filter((m) => m && typeof m.id === "string" && typeof m.content === "string")
    .slice(-MAX_MESSAGES)
    .map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content.slice(0, MAX_CONTENT),
      createdAt: m.createdAt,
    }));
}

/** Conversaciones guardadas, la más reciente primero. */
export async function listConversations(): Promise<ConversationMeta[]> {
  const index = await readIndex();
  return index.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function loadConversation(id: string): Promise<ChatMessage[]> {
  try {
    const raw = await AsyncStorage.getItem(msgKey(id));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? sanitize(parsed as ChatMessage[]) : [];
  } catch {
    return [];
  }
}

/** Guarda (o crea) la conversación. Sin mensajes no guarda nada. */
export function saveConversation(id: string, messages: ChatMessage[]): Promise<void> {
  const clean = sanitize(messages);
  if (clean.length === 0) return Promise.resolve();

  return serialized(async () => {
    const index = await readIndex();
    const now = new Date().toISOString();
    const existing = index.find((m) => m.id === id);
    const meta: ConversationMeta = {
      id,
      title: existing?.title ?? titleFrom(clean),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      messageCount: clean.length,
    };
    let next = [meta, ...index.filter((m) => m.id !== id)].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt)
    );
    const dropped = next.slice(MAX_CONVERSATIONS);
    next = next.slice(0, MAX_CONVERSATIONS);

    await AsyncStorage.setItem(msgKey(id), JSON.stringify(clean));
    await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(next));
    if (dropped.length) await AsyncStorage.multiRemove(dropped.map((m) => msgKey(m.id)));
  });
}

export function deleteConversation(id: string): Promise<void> {
  return serialized(async () => {
    const index = await readIndex();
    await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(index.filter((m) => m.id !== id)));
    await AsyncStorage.removeItem(msgKey(id));
    if ((await AsyncStorage.getItem(ACTIVE_KEY)) === id) await AsyncStorage.removeItem(ACTIVE_KEY);
  });
}

/** Borra todo el historial (también al cerrar sesión). */
export function clearConversations(): Promise<void> {
  return serialized(async () => {
    // Por prefijo y no por índice: si el índice se corrompió, igual no quedan mensajes huérfanos.
    const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith("tm_conv_"));
    if (keys.length) await AsyncStorage.multiRemove(keys);
  });
}

/** Conversación abierta la última vez: al abrir la app se retoma sola. */
export async function getActiveConversationId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

export async function setActiveConversationId(id: string | null): Promise<void> {
  try {
    if (id) await AsyncStorage.setItem(ACTIVE_KEY, id);
    else await AsyncStorage.removeItem(ACTIVE_KEY);
  } catch {
    /* no crítico */
  }
}

/** "hace 5 min", "ayer", "12 oct". */
export function formatWhen(iso: string, now = Date.now()): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const mins = Math.floor((now - t) / 60_000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "ayer";
  if (days < 7) return `hace ${days} días`;
  return new Date(t).toLocaleDateString("es", { day: "numeric", month: "short" });
}
