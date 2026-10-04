import * as Contacts from "expo-contacts";

/** Pregunta al usuario cuál opción elegir; null = canceló. La ofrece la pantalla del chat. */
export type ChooseOption = (title: string, options: string[]) => Promise<number | null>;

export interface Candidate {
  /** Texto para mostrar en la lista de opciones. */
  label: string;
  /** Número ya normalizado al formato que necesita el destino (WhatsApp, SMS o llamada). */
  value: string;
}

export type Lookup =
  | { status: "found"; candidates: Candidate[] }
  /** denied: sin permiso. none: no está en los contactos. unusable: está, pero ningún número sirve. */
  | { status: "denied" | "none" | "unusable" };

/**
 * Busca un contacto por nombre SOLO en el teléfono (nada sale del dispositivo). `normalize` convierte
 * cada número al formato del destino y devuelve null si no sirve (p. ej. WhatsApp exige código de país;
 * SMS y llamadas aceptan el formato local).
 */
export async function lookupContact(
  name: string,
  normalize: (raw: string | undefined | null) => string | null
): Promise<Lookup> {
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
      const value = normalize(p.number ?? p.digits);
      if (!value || seen.has(value)) continue;
      seen.add(value);
      candidates.push({
        value,
        label: `${c.name} · ${p.number ?? value}${p.label ? ` (${p.label})` : ""}`,
      });
    }
  }
  return candidates.length ? { status: "found", candidates } : { status: "unusable" };
}
