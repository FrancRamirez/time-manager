import { useEffect } from "react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useUserStore } from "@/store/userStore";
import { getAccessToken } from "@/services/secureStorage";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const setUser = useUserStore((s) => s.setUser);
  const setLoading = useUserStore((s) => s.setLoading);

  useEffect(() => {
    (async () => {
      // Chequeo simple de sesión existente al abrir la app.
      // El detalle del usuario se resuelve en index.tsx contra el backend.
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
