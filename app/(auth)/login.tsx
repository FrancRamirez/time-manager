import { useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { signInWithGoogle, isSignInCancelled } from "@/services/auth";
import { useUserStore } from "@/store/userStore";

export default function LoginScreen() {
  const router = useRouter();
  const setUser = useUserStore((s) => s.setUser);
  const sessionNotice = useUserStore((s) => s.sessionNotice);
  const setSessionNotice = useUserStore((s) => s.setSessionNotice);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignIn() {
    setLoading(true);
    setError(null);
    try {
      const user = await signInWithGoogle();
      setSessionNotice(null);
      setUser(user);
      router.replace(
        user.onboardingCompleted ? "/(tabs)/agenda" : "/(auth)/onboarding"
      );
    } catch (err: any) {
      console.log(
        "GOOGLE_LOGIN_ERROR",
        JSON.stringify({
          code: err?.code,
          status: err?.status,
          name: err?.name,
          message: err?.message,
        })
      );
      if (!isSignInCancelled(err)) {
        setError(
          `No se pudo iniciar sesión: ${
            err?.code ?? err?.status ?? err?.message ?? "error desconocido"
          }`
        );
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Time Manager</Text>
      <Text style={styles.subtitle}>
        Tu asistente de agenda multicanal, con foco en privacidad.
      </Text>

      {sessionNotice ? <Text style={styles.notice}>{sessionNotice}</Text> : null}

      <Pressable style={styles.button} onPress={handleSignIn} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#0F172A" />
        ) : (
          <Text style={styles.buttonText}>Continuar con Google</Text>
        )}
      </Pressable>

      {error ? <Text style={styles.error}>{error}</Text> : null}
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
  title: { color: "#F1F5F9", fontSize: 28, fontWeight: "700" },
  subtitle: {
    color: "#94A3B8",
    fontSize: 14,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 32,
  },
  button: {
    backgroundColor: "#38BDF8",
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 10,
    minWidth: 220,
    alignItems: "center",
  },
  buttonText: { color: "#0F172A", fontWeight: "700", fontSize: 15 },
  error: { color: "#F87171", marginTop: 16, fontSize: 13 },
  notice: {
    color: "#FBBF24",
    fontSize: 13,
    textAlign: "center",
    marginBottom: 20,
    maxWidth: 300,
  },
});
