import { Linking } from "react-native";
import { lookupContact, type ChooseOption } from "@/services/contacts";
import { toDialable } from "@/services/phone";

/**
 * SMS y llamadas "por intents": NO se envía ni se llama por cuenta propia (eso exigiría permisos
 * restringidos por Google Play). Se abre la app de mensajes con el número y el texto escritos, o el
 * marcador con el número listo, y el usuario pulsa Enviar o Llamar. Los contactos se consultan solo
 * en el teléfono. SMS y llamadas aceptan números en formato local (no necesitan código de país).
 */

export interface PhoneRequest {
  contactName?: string;
  /** Ya validado por el servidor (dígitos con "+" inicial opcional). */
  phone?: string;
}

export interface SmsRequest extends PhoneRequest {
  message: string;
}

export interface PhoneResult {
  ok: boolean;
  message: string;
}

const MAX_OPTIONS = 8;

type Target =
  | { kind: "number"; number: string }
  /** No se pudo resolver el número; `note` explica por qué. */
  | { kind: "none"; note: string }
  | { kind: "cancelled" };

async function resolveTarget(req: PhoneRequest, chooseOption: ChooseOption): Promise<Target> {
  if (req.phone) {
    const number = toDialable(req.phone);
    return number ? { kind: "number", number } : { kind: "none", note: "El número no es válido" };
  }
  if (!req.contactName) return { kind: "none", note: "No me dijiste a quién" };

  let lookup;
  try {
    lookup = await lookupContact(req.contactName, toDialable);
  } catch (err) {
    console.warn("[contactos]", err);
    lookup = { status: "denied" as const };
  }

  switch (lookup.status) {
    case "found": {
      if (lookup.candidates.length === 1) return { kind: "number", number: lookup.candidates[0].value };
      const shown = lookup.candidates.slice(0, MAX_OPTIONS);
      const index = await chooseOption(
        `Hay varios números para "${req.contactName}". ¿Cuál uso?`,
        shown.map((c) => c.label)
      );
      return index === null ? { kind: "cancelled" } : { kind: "number", number: shown[index].value };
    }
    case "denied":
      return { kind: "none", note: "No tengo permiso para ver tus contactos" };
    case "none":
      return { kind: "none", note: `No encontré a "${req.contactName}" en tus contactos` };
    default:
      return { kind: "none", note: `Ningún número de "${req.contactName}" se puede usar` };
  }
}

async function open(url: string): Promise<boolean> {
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

export async function composeSms(req: SmsRequest, chooseOption: ChooseOption): Promise<PhoneResult> {
  const target = await resolveTarget(req, chooseOption);
  if (target.kind === "cancelled") return { ok: true, message: "Entendido, no abrí los mensajes." };

  const body = encodeURIComponent(req.message);
  const url = target.kind === "number" ? `sms:${target.number}?body=${body}` : `sms:?body=${body}`;
  if (!(await open(url))) {
    return { ok: false, message: "No pude abrir la app de mensajes de tu teléfono." };
  }
  return {
    ok: true,
    message:
      target.kind === "number"
        ? "Abrí tu app de mensajes con el SMS listo. Revísalo y pulsa Enviar: no se envía solo."
        : `${target.note}. Abrí tu app de mensajes con el SMS listo para que elijas el contacto.`,
  };
}

export async function composeCall(req: PhoneRequest, chooseOption: ChooseOption): Promise<PhoneResult> {
  const target = await resolveTarget(req, chooseOption);
  if (target.kind === "cancelled") return { ok: true, message: "Entendido, no abrí el marcador." };
  if (target.kind === "none") {
    return { ok: false, message: `${target.note}, así que no abrí el marcador. Dime el número y lo abro.` };
  }
  if (!(await open(`tel:${target.number}`))) {
    return { ok: false, message: "No pude abrir el marcador de tu teléfono." };
  }
  return { ok: true, message: "Abrí el marcador con el número listo. Pulsa Llamar cuando quieras: no se llama solo." };
}
