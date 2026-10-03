import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { ASSISTANT_NAME } from "@/constants/brand";

const DOTS = 3;
const STEP_MS = 160; // desfase entre puntos
const HALF_MS = 320; // subida o bajada de cada punto

/**
 * Burbuja del asistente con tres puntos que laten: indica que el mensaje se
 * recibió y se está preparando la respuesta.
 */
export function TypingIndicator() {
  const dots = useRef(Array.from({ length: DOTS }, () => new Animated.Value(0))).current;

  useEffect(() => {
    const loops = dots.map((value, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * STEP_MS),
          Animated.timing(value, {
            toValue: 1,
            duration: HALF_MS,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration: HALF_MS,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
          // Pausa para que el ciclo completo dure igual en todos los puntos.
          Animated.delay((DOTS - 1 - i) * STEP_MS),
        ])
      )
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [dots]);

  return (
    <View
      style={styles.bubble}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`${ASSISTANT_NAME} está escribiendo`}
    >
      {dots.map((value, i) => (
        <Animated.View
          key={i}
          style={[
            styles.dot,
            {
              opacity: value.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
              transform: [
                { translateY: value.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) },
              ],
            },
          ]}
        />
      ))}
      <Text style={styles.caption}>{ASSISTANT_NAME} está escribiendo…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 5,
    backgroundColor: "#1E293B",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 8,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#94A3B8" },
  caption: { color: "#94A3B8", fontSize: 12, marginLeft: 6 },
});
