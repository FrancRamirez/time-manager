import { useEffect } from "react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useUserStore } from "@/store/userStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useAlarmStore } from "@/store/alarmStore";
import { getAccessToken } from "@/services/secureStorage";
// Define la tarea en segundo plano en el scope global (debe cargarse al arrancar la app).
import "@/services/backgroundTasks";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const setUser = useUserStore((s) => s.setUser);
  const setLoading = useUserStore((s) => s.setLoading);

  useEffect(() => {
    (async () => {
      // Chequeo simple de sesión existente al abrir la app.
      // El detalle del usuario se resuelve en index.tsx contra el backend.
      await useSettingsStore.getState().hydrate();
      await useAlarmStore.getState().hydrate();
      const token = await getAccessToken();
      if (!token) setUser(null);
      setLoading(false);
      await SplashScreen.hideAsync();
    })();
  }, [setUser, setLoading]);

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
