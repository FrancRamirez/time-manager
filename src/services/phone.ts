/**
 * Número en formato internacional -> solo dígitos (sin "+"), que es lo que
 * piden los enlaces de WhatsApp. Exige "+" o "00" al inicio: un número sin
 * código de país no se puede asignar con certeza. Devuelve null si no sirve.
 */
export function toInternational(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const s = raw.trim();
  let digits: string;
  if (s.startsWith("+")) digits = s.replace(/\D/g, "");
  else if (s.startsWith("00")) digits = s.replace(/\D/g, "").slice(2);
  else return null;
  return /^[1-9]\d{7,14}$/.test(digits) ? digits : null;
}

/**
 * Número para SMS o llamada: acepta formato local o internacional con separadores y devuelve solo
 * dígitos (con "+" inicial si lo tenía). Rechaza letras, "*" y "#" (códigos USSD del operador).
 * Misma regla que el servidor (lib/phoneActions.ts).
 */
export function toDialable(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!/^\+?[\d\s().-]+$/.test(s)) return null;
  const digits = s.replace(/\D/g, "");
  if (digits.length < 3 || digits.length > 15) return null;
  return (s.startsWith("+") ? "+" : "") + digits;
}
