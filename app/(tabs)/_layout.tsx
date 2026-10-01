import { Tabs } from "expo-router";
import { useNotificationPermissions } from "@/hooks/useNotificationPermissions";
import { useDeepLink } from "@/hooks/useDeepLink";

export default function TabsLayout() {
  // Se piden permisos y se registra el dispositivo apenas el usuario
  // entra al área autenticada de la app.
  useNotificationPermissions();
  useDeepLink();

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: "#0F172A" },
        headerTintColor: "#F1F5F9",
        tabBarStyle: { backgroundColor: "#0F172A", borderTopColor: "#1E293B" },
        tabBarActiveTintColor: "#38BDF8",
        tabBarInactiveTintColor: "#64748B",
      }}
    >
      <Tabs.Screen name="agenda" options={{ title: "Agenda" }} />
      <Tabs.Screen name="chat" options={{ title: "Asistente" }} />
      <Tabs.Screen name="settings" options={{ title: "Ajustes" }} />
    </Tabs>
  );
}
