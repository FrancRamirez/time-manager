import { Platform } from "react-native";
import * as IntentLauncher from "expo-intent-launcher";

/**
 * Reloj del dispositivo mediante intents de Android (AlarmClock).
 * Android solo permite CREAR alarmas/temporizadores y DESCARTAR alarmas; no
 * permite leer ni editar las existentes. Requiere el permiso
 * com.android.alarm.permission.SET_ALARM (declarado en app.json).
 */

export type Day = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

// Calendar.SUNDAY = 1 ... Calendar.SATURDAY = 7 (lo que espera EXTRA_DAYS).
const CALENDAR_DAY: Record<Day, number> = {
  sun: 1,
  mon: 2,
  tue: 3,
  wed: 4,
  thu: 5,
  fri: 6,
  sat: 7,
};

const ACTION_SET_ALARM = "android.intent.action.SET_ALARM";
const ACTION_DISMISS_ALARM = "android.intent.action.DISMISS_ALARM";
const ACTION_SET_TIMER = "android.intent.action.SET_TIMER";

const EXTRA_HOUR = "android.intent.extra.alarm.HOUR";
const EXTRA_MINUTES = "android.intent.extra.alarm.MINUTES";
const EXTRA_MESSAGE = "android.intent.extra.alarm.MESSAGE";
const EXTRA_DAYS = "android.intent.extra.alarm.DAYS";
const EXTRA_SKIP_UI = "android.intent.extra.alarm.SKIP_UI";
const EXTRA_LENGTH = "android.intent.extra.alarm.LENGTH";
const EXTRA_SEARCH_MODE = "android.intent.extra.alarm.SEARCH_MODE";
const SEARCH_MODE_TIME = "android.time";

export interface ClockResult {
  ok: boolean;
  /** Motivo técnico cuando falla (para logs / mensaje al usuario). */
  error?: string;
}

async function launch(action: string, extra: Record<string, unknown>): Promise<ClockResult> {
  if (Platform.OS !== "android") {
    return { ok: false, error: "El reloj solo está disponible en Android." };
  }
  try {
    await IntentLauncher.startActivityAsync(action, { extra });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export function setAlarm(opts: {
  hour: number;
  minute: number;
  days: Day[];
  label?: string;
}): Promise<ClockResult> {
  const extra: Record<string, unknown> = {
    [EXTRA_HOUR]: opts.hour,
    [EXTRA_MINUTES]: opts.minute,
    [EXTRA_SKIP_UI]: true,
  };
  if (opts.label) extra[EXTRA_MESSAGE] = opts.label;
  if (opts.days.length) extra[EXTRA_DAYS] = opts.days.map((d) => CALENDAR_DAY[d]);
  return launch(ACTION_SET_ALARM, extra);
}

/**
 * Pide al Reloj descartar la alarma que coincide con esa hora. Cómo lo
 * interpreta cada app de reloj depende del fabricante: no hay forma de
 * comprobar el resultado, así que el éxito solo significa "el Reloj aceptó
 * el pedido".
 */
export function dismissAlarm(opts: { hour: number; minute: number }): Promise<ClockResult> {
  return launch(ACTION_DISMISS_ALARM, {
    [EXTRA_SEARCH_MODE]: SEARCH_MODE_TIME,
    [EXTRA_HOUR]: opts.hour,
    [EXTRA_MINUTES]: opts.minute,
    [EXTRA_SKIP_UI]: true,
  });
}

export function setTimer(opts: { seconds: number; label?: string }): Promise<ClockResult> {
  const extra: Record<string, unknown> = {
    [EXTRA_LENGTH]: opts.seconds,
    [EXTRA_SKIP_UI]: true,
  };
  if (opts.label) extra[EXTRA_MESSAGE] = opts.label;
  return launch(ACTION_SET_TIMER, extra);
}

/** Abre la lista de alarmas del Reloj (para que el usuario borre a mano si hace falta). */
export function showAlarms(): Promise<ClockResult> {
  return launch("android.intent.action.SHOW_ALARMS", {});
}
