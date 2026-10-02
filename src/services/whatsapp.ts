import { Linking } from "react-native";
import * as Contacts from "expo-contacts";
import { toInternational } from "@/services/phone";

/**
 * WhatsApp por enlaces: NO existe API para enviar ni leer chats personales.
 * Solo se abre WhatsApp con el contacto y el texto ya escritos; el usuario
 * decide si pulsa Enviar. Los contactos se consultan solo en el teléfono.
 */

export type ChooseOption = (title: string, options: string[]) => Promise<number | null>;

export interface WhatsappRequest {
  contactName?: string;
  /** Solo dígitos con código de país (ya validado por el servidor). */
  phone?: string;
  message: string;
}

export interface WhatsappResult {
  ok: boolean;
  message: string;
}

const MAX_OPTIONS = 8;

interface Candidate {
  label: string;
  digits: string;
}

type Lookup =
  | { status: "found"; candidates: Candidate[] }
  | { status: "denied" | "none" | "no_international" };

async function lookupContact(name: string): Promise<Lookup> {
  const perm = await Contacts.requestPermissionsAsync();
  if (!perm.granted) return { status: "denied" };

  const { data } = await Contacts.getContactsAsync({
    name,
    fields: [Contacts.Fields.PhoneNumbers],
    pageSize: 25,
  });
  const withPhones = data.filter((c) => c.phoneNumbers?.length);
  if (withPhones.length === 0) return { status: "none" };

  const seen = new Set<string>();
  const candidates: Candidate[] = [];
  for (const c of withPhones) {
    for (const p of c.phoneNumbers ?? []) {
      const digits = toInternational(p.number ?? p.digits);
      if (!digits || seen.has(digits)) continue;
      seen.add(digits);
      candidates.push({
        digits,
        label: `${c.name} · ${p.number ?? `+${digits}`}${p.label ? ` (${p.label})` : ""}`,
      });
    }
  }
  return candidates.length ? { status: "found", candidates } : { status: "no_international" };
}

async function openWhatsapp(digits: string | undefined, message: string): Promise<boolean> {
  const text = encodeURIComponent(message);
  const urls = [
    digits ? `whatsapp://send?phone=${digits}&text=${text}` : `whatsapp://send?text=${text}`,
    // Si el esquema nativo no resuelve, el enlace web abre WhatsApp (o su página de descarga).
    digits ? `https://wa.me/${digits}?text=${text}` : `https://wa.me/?text=${text}`,
  ];
  for (const url of urls) {
    try {
      await Linking.openURL(url);
      return true;
    } catch {
      /* se prueba el siguiente */
    }
  }
  return false;
}

const READY = "Abrí WhatsApp con el mensaje listo. Revísalo y pulsa Enviar: no se envía solo.";

export async function composeWhatsapp(
  req: WhatsappRequest,
  chooseOption: ChooseOption
): Promise<WhatsappResult> {
  let digits = req.phone;
  let fallbackReason: string | null = null;

  if (!digits && req.contactName) {
    let lookup: Lookup;
    try {
      lookup = await lookupContact(req.contactName);
    } catch (err) {
      console.warn("[whatsapp] contactos:", err);
      lookup = { status: "denied" };
    }

    if (lookup.status === "found") {
      if (lookup.candidates.length === 1) {
        digits = lookup.candidates[0].digits;
      } else {
        const shown = lookup.candidates.slice(0, MAX_OPTIONS);
        const index = await chooseOption(
          `Hay varios números para "${req.contactName}". ¿A cuál lo envío?`,
          shown.map((c) => c.label)
        );
        if (index === null) return { ok: true, message: "Entendido, no abrí WhatsApp." };
        digits = shown[index].digits;
      }
    } else if (lookup.status === "denied") {
      fallbackReason = "No tengo permiso para ver tus contactos";
    } else if (lookup.status === "none") {
      fallbackReason = `No encontré a "${req.contactName}" en tus contactos`;
    } else {
      fallbackReason = `El contacto "${req.contactName}" no tiene el número con código de país (+54, +34…)`;
    }
  }

  const opened = await openWhatsapp(digits, req.message);
  if (!opened) {
    return { ok: false, message: "No pude abrir WhatsApp. ¿Está instalado en el teléfono?" };
  }
  return {
    ok: true,
    message: fallbackReason
      ? `${fallbackReason}. Abrí WhatsApp con el mensaje listo para que elijas el contacto.`
      : READY,
  };
}
