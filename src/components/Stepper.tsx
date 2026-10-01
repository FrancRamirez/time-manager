import { View, Text, Pressable, StyleSheet } from "react-native";

interface Props {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  suffix?: string;
}

export function Stepper({ value, onChange, min, max, step, suffix = "" }: Props) {
  const dec = () => onChange(Math.max(min, value - step));
  const inc = () => onChange(Math.min(max, value + step));

  return (
    <View style={styles.row}>
      <Pressable
        style={[styles.button, value <= min && styles.disabled]}
        onPress={dec}
        disabled={value <= min}
        accessibilityLabel="Disminuir"
      >
        <Text style={styles.buttonText}>−</Text>
      </Pressable>
      <Text style={styles.value}>
        {value}
        {suffix}
      </Text>
      <Pressable
        style={[styles.button, value >= max && styles.disabled]}
        onPress={inc}
        disabled={value >= max}
        accessibilityLabel="Aumentar"
      >
        <Text style={styles.buttonText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 16 },
  button: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#334155",
    alignItems: "center",
    justifyContent: "center",
  },
  disabled: { opacity: 0.35 },
  buttonText: { color: "#38BDF8", fontSize: 22, fontWeight: "700", lineHeight: 24 },
  value: { color: "#E2E8F0", fontSize: 16, minWidth: 90, textAlign: "center" },
});
