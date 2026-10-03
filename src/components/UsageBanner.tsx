import { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { formatWait, type AiBlock, type UsageState } from "@/api/usage";

interface Props {
  usage: UsageState | null;
  block: AiBlock | null;
  /** Se llama una vez cuando termina la cuenta regresiva (conviene volver a consultar el cupo). */
  onExpire: () => void;
}

/**
 * Muestra cuántos mensajes quedan y cuánto falta para que se renueven. Tiene su propio
 * reloj de 1 s para no volver a dibujar toda la pantalla del chat en cada segundo.
 */
export function UsageBanner({ usage, block, onExpire }: Props) {
  const [now, setNow] = useState(Date.now());
  const firedFor = useRef<number | null>(null);

  const target = block ? block.until : usage && usage.limit > 0 && usage.used > 0 ? usage.until : null;

  useEffect(() => {
    if (target === null) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [target]);

  useEffect(() => {
    if (target !== null && now >= target && firedFor.current !== target) {
      firedFor.current = target;
      onExpire();
    }
  }, [now, target, onExpire]);

  if (!block && (!usage || usage.limit <= 0)) return null;

  const wait = target !== null ? formatWait(target - now) : null;
  let text: string;
  let warn = true;
  if (block?.reason === "ai_quota") {
    text = `Frami alcanzó su límite diario. Se restablece en ${wait}.`;
  } else if (block || (usage && usage.remaining <= 0)) {
    text = `Se acabaron tus mensajes de hoy. Se renuevan en ${wait}.`;
  } else if (usage) {
    warn = usage.remaining <= 2;
    text =
      `Mensajes disponibles hoy: ${usage.remaining} de ${usage.limit}` +
      (wait ? ` · se renuevan en ${wait}` : "");
  } else {
    return null;
  }

  return (
    <View style={styles.box}>
      <Text style={[styles.text, warn && styles.warn]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { marginHorizontal: 12, marginBottom: 4 },
  text: { color: "#64748B", fontSize: 12, textAlign: "center" },
  warn: { color: "#FCD34D" },
});
