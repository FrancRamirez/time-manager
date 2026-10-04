import { Linking } from "react-native";
import { lookupContact, type ChooseOption } from "@/services/contacts";
import { toInternational } from "@/services/phone";

/**
 * WhatsApp por enlaces: NO existe API para enviar ni leer chats personales.
 * Solo se abre WhatsApp con el contacto y el texto ya escritos; el usuario
 * decide si pulsa Enviar. Los contactos se consultan solo en el teléfono.
 */

export type { ChooseOption };

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
    let lookup: Awaited<ReturnType<typeof lookupContact>>;
    try {
      lookup = await lookupContact(req.contactName, toInternational);
    } catch (err) {
      console.warn("[whatsapp] contactos:", err);
      lookup = { status: "denied" };
    }

    if (lookup.status === "found") {
      if (lookup.candidates.length === 1) {
        digits = lookup.candidates[0].value;
      } else {
        const shown = lookup.candidates.slice(0, MAX_OPTIONS);
        const index = await chooseOption(
          `Hay varios números para "${req.contactName}". ¿A cuál lo envío?`,
          shown.map((c) => c.label)
        );
        if (index === null) return { ok: true, message: "Entendido, no abrí WhatsApp." };
        digits = shown[index].value;
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
