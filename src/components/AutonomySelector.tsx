import { View, Text, Pressable, StyleSheet } from "react-native";
import type { AutonomyLevel } from "@/types";

const OPTIONS: { value: AutonomyLevel; label: string; description: string }[] = [
  {
    value: "suggestion",
    label: "Modo Sugerencia",
    description: 'Te pregunta antes: "¿Mover médico al jueves? [Sí] [No]"',
  },
  {
    value: "autopilot",
    label: "Piloto Automático",
    description: "Resuelve el conflicto solo y te avisa después",
  },
];

interface Props {
  value: AutonomyLevel;
  onChange: (value: AutonomyLevel) => void;
}

export function AutonomySelector({ value, onChange }: Props) {
  return (
    <View style={styles.container}>
      {OPTIONS.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.option, selected && styles.optionSelected]}
          >
            <Text style={[styles.label, selected && styles.labelSelected]}>
              {option.label}
            </Text>
            <Text style={styles.description}>{option.description}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10 },
  option: {
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 12,
    padding: 14,
  },
  optionSelected: {
    borderColor: "#38BDF8",
    backgroundColor: "#0C2536",
  },
  label: { color: "#F1F5F9", fontWeight: "600", fontSize: 15 },
  labelSelected: { color: "#38BDF8" },
  description: { color: "#94A3B8", fontSize: 12, marginTop: 4 },
});
