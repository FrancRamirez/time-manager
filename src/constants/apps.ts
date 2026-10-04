import type { AccessLevel, AppAccess, AppId } from "@/types";

export interface RestrictableApp {
  id: AppId;
  name: string;
  /** Niveles disponibles: "Solo lectura" solo existe donde la app tiene lectura Y escritura. */
  levels: AccessLevel[];
  /** Qué significa cada nivel para esta app (se muestra bajo el selector). */
  explain: Partial<Record<AccessLevel, string>>;
}

/** Listado FIJO: el asistente solo toca sus integraciones, no cualquier app instalada. */
export const RESTRICTABLE_APPS: RestrictableApp[] = [
  {
    id: "calendar",
    name: "Google Calendar",
    levels: ["allowed", "read_only", "blocked"],
    explain: {
      allowed: "Frami consulta tu agenda y puede crear, mover y cancelar eventos (según tu nivel de autonomía).",
      read_only:
        "Frami consulta tu agenda, pero no crea, mueve ni cancela eventos. Se desactivan el análisis de conflictos y el Piloto Automático.",
      blocked:
        "Frami no puede ver ni tocar tu calendario. Se desactivan el análisis de conflictos y el Piloto Automático. La pestaña Agenda sigue mostrando tus eventos.",
    },
  },
  {
    id: "gmail",
    name: "Gmail",
    levels: ["allowed", "read_only", "blocked"],
    explain: {
      allowed: "Frami busca y lee correos, y puede redactar borradores, enviar, archivar y mover a la papelera.",
      read_only: "Frami busca y lee correos, pero no hace borradores, no envía, no archiva ni usa la papelera.",
      blocked: "Frami no puede leer ni tocar tu correo.",
    },
  },
  {
    id: "clock",
    name: "Reloj",
    levels: ["allowed", "read_only", "blocked"],
    explain: {
      allowed: "Frami puede crear, cambiar y cancelar alarmas, y poner temporizadores.",
      read_only:
        "Frami solo consulta las alarmas que creó desde esta app; no crea, cambia ni cancela alarmas ni temporizadores.",
      blocked: "Frami no puede usar las alarmas ni los temporizadores.",
    },
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    levels: ["allowed", "blocked"],
    explain: {
      allowed: "Frami prepara mensajes y abre WhatsApp para que tú los envíes.",
      blocked: "Frami no prepara mensajes de WhatsApp.",
    },
  },
  {
    id: "sms",
    name: "SMS",
    levels: ["allowed", "blocked"],
    explain: {
      allowed: "Frami prepara SMS y abre tu app de mensajes para que tú los envíes. No lee tus mensajes.",
      blocked: "Frami no prepara SMS.",
    },
  },
  {
    id: "calls",
    name: "Llamadas",
    levels: ["allowed", "blocked"],
    explain: {
      allowed: "Frami abre el marcador con el número listo y tú pulsas Llamar. No ve tu historial de llamadas.",
      blocked: "Frami no abre el marcador.",
    },
  },
  {
    id: "forecast",
    name: "Pronóstico",
    levels: ["allowed", "blocked"],
    explain: {
      allowed:
        "Frami consulta el clima. Usa tu ubicación aproximada solo en ese momento (te pide permiso la primera vez) o la ciudad que le digas.",
      blocked: "Frami no consulta el clima ni usa tu ubicación.",
    },
  },
];

export const LEVEL_LABELS: Record<AccessLevel, string> = {
  allowed: "Permitido",
  read_only: "Solo lectura",
  blocked: "Bloqueada",
};

/** Por defecto todo permitido (el comportamiento anterior). */
export const DEFAULT_APP_ACCESS: AppAccess = {
  calendar: "allowed",
  gmail: "allowed",
  clock: "allowed",
  whatsapp: "allowed",
  sms: "allowed",
  calls: "allowed",
  forecast: "allowed",
};

export function appName(app: AppId): string {
  return RESTRICTABLE_APPS.find((a) => a.id === app)?.name ?? app;
}

/** ¿Puede el asistente usar la app para esa operación? (write = crear, cambiar, enviar o borrar). */
export function appAllows(access: AppAccess, app: AppId, write: boolean): boolean {
  const level = access[app];
  if (level === "allowed") return true;
  if (level === "read_only") return !write;
  return false;
}

/** Valida lo guardado en el teléfono: lo desconocido o inválido vuelve al valor por defecto. */
export function sanitizeAppAccess(raw: unknown): AppAccess {
  const out: AppAccess = { ...DEFAULT_APP_ACCESS };
  if (typeof raw !== "object" || raw === null) return out;
  const r = raw as Record<string, unknown>;
  for (const app of RESTRICTABLE_APPS) {
    const v = r[app.id];
    if (typeof v === "string" && app.levels.includes(v as AccessLevel)) out[app.id] = v as AccessLevel;
  }
  return out;
}

export function restrictedMessage(app: AppId, level: AccessLevel): string {
  const state = level === "blocked" ? "bloqueada" : "en solo lectura";
  return `${appName(app)} está ${state} en Ajustes > Restringir aplicaciones, así que no hice cambios. Puedes cambiarlo allí cuando quieras.`;
}

export function restrictedCount(access: AppAccess): number {
  return RESTRICTABLE_APPS.filter((a) => access[a.id] !== "allowed").length;
}
