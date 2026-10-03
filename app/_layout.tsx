import { useEffect } from "react";
import { Stack, useRootNavigationState, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useUserStore } from "@/store/userStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useAlarmStore } from "@/store/alarmStore";
import { getAccessToken, getCachedUser } from "@/services/secureStorage";
import { apiFetch, setSessionLostHandler } from "@/api/client";
import { expireSession } from "@/services/session";
import type { User } from "@/types";
// Define la tarea en segundo plano en el scope global (debe cargarse al arrancar la app).
import "@/services/backgroundTasks";

SplashScreen.preventAutoHideAsync();

/**
 * Pide el usuario al backend y actualiza el store. Si la sesión ya no sirve, apiFetch avisa a
 * expireSession; si no hay internet se sigue con el usuario guardado en el teléfono.
 */
async function refreshUserFromBackend() {
  try {
    const { user } = await apiFetch<{ user: User }>("/api/auth/me");
    useUserStore.getState().setUser(user);
  } catch {
    /* sin red o servidor caído: se conserva la sesión local */
  }
}

export default function RootLayout() {
  const user = useUserStore((s) => s.user);
  const isLoading = useUserStore((s) => s.isLoading);
  const router = useRouter();
  const segments = useSegments();
  const navigationState = useRootNavigationState();

  // Restaurar la sesión al abrir la app.
  useEffect(() => {
    setSessionLostHandler((reason) => {
      void expireSession(reason);
    });
    (async () => {
      const { setUser, setLoading } = useUserStore.getState();
      await useSettingsStore.getState().hydrate();
      await useAlarmStore.getState().hydrate();

      const token = await getAccessToken();
      if (!token) {
        setUser(null);
      } else {
        const cached = await getCachedUser();
        if (cached) {
          // Entra directo a la app y valida en segundo plano (actualiza datos o cierra si venció).
          setUser(cached);
          void refreshUserFromBackend();
        } else {
          await refreshUserFromBackend();
        }
      }
      setLoading(false);
      await SplashScreen.hideAsync();
    })();
    return () => setSessionLostHandler(null);
  }, []);

  // Si la sesión termina mientras se usa la app (venció, Google la invalidó, cerrar sesión), al Login.
  useEffect(() => {
    if (isLoading || !navigationState?.key) return;
    const section = segments[0];
    // En "/" (sin segmentos) ya redirige index.tsx.
    if (!user && section !== undefined && section !== "(auth)") {
      router.replace("/(auth)/login");
    }
  }, [user, isLoading, segments, navigationState?.key, router]);

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
