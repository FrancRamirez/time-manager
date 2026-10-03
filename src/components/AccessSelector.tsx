import { View, Text, Pressable, StyleSheet } from "react-native";
import { LEVEL_LABELS } from "@/constants/apps";
import type { AccessLevel } from "@/types";

interface Props {
  levels: AccessLevel[];
  value: AccessLevel;
  onChange: (level: AccessLevel) => void;
  /** Nombre de la app, para el lector de pantalla. */
  appLabel: string;
}

/** Selector segmentado: Permitido / Solo lectura / Bloqueada (dos niveles si la app no tiene lectura y escritura). */
export function AccessSelector({ levels, value, onChange, appLabel }: Props) {
  return (
    <View style={styles.row}>
      {levels.map((level) => {
        const selected = level === value;
        return (
          <Pressable
            key={level}
            onPress={() => onChange(level)}
            style={[
              styles.segment,
              selected && (level === "blocked" ? styles.segmentBlocked : styles.segmentSelected),
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`${appLabel}: ${LEVEL_LABELS[level]}`}
          >
            <Text
              style={[
                styles.label,
                selected && (level === "blocked" ? styles.labelBlocked : styles.labelSelected),
              ]}
            >
              {LEVEL_LABELS[level]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8 },
  segment: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  segmentSelected: { borderColor: "#38BDF8", backgroundColor: "#0C2536" },
  segmentBlocked: { borderColor: "#F87171", backgroundColor: "#2A1215" },
  label: { color: "#94A3B8", fontSize: 13, fontWeight: "600" },
  labelSelected: { color: "#38BDF8" },
  labelBlocked: { color: "#F87171" },
});
