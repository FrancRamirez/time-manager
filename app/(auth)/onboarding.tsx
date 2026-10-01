import { useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { apiFetch } from "@/api/client";
import { useUserStore } from "@/store/userStore";

/**
 * Placeholder de la pantalla de onboarding. La integración real de
 * cobro (Google Play Billing / Stripe) se resuelve en un módulo aparte;
 * acá solo se orquesta el flujo y se confirma contra el backend.
 */
export default function OnboardingScreen() {
  const router = useRouter();
  const setUser = useUserStore((s) => s.setUser);
  const [loading, setLoading] = useState(false);

  async function handlePurchase() {
    setLoading(true);
    try {
      // TODO: reemplazar por la llamada real al SDK de Google Play Billing.
      // Acá se asume que el pago ya se completó del lado nativo y solo
      // se confirma el estado en el backend.
      const updatedUser = await apiFetch<{ onboardingCompleted: boolean }>(
        "/api/billing/confirm-onboarding",
        { method: "POST" }
      );
      setUser((prev) => (prev ? { ...prev, ...updatedUser } : prev));
      router.replace("/(tabs)/agenda");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Empezá con Time Manager</Text>
      <Text style={styles.description}>
        Pago único de $5 USD para activar tu cuenta. Después, suscripción
        mensual para mantener el servicio activo.
      </Text>

      <Pressable style={styles.button} onPress={handlePurchase} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#0F172A" />
        ) : (
          <Text style={styles.buttonText}>Pagar $5 USD y continuar</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  title: { color: "#F1F5F9", fontSize: 22, fontWeight: "700", textAlign: "center" },
  description: {
    color: "#94A3B8",
    fontSize: 14,
    textAlign: "center",
    marginTop: 12,
    marginBottom: 32,
  },
  button: {
    backgroundColor: "#38BDF8",
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 10,
    minWidth: 240,
    alignItems: "center",
  },
  buttonText: { color: "#0F172A", fontWeight: "700", fontSize: 15 },
});
