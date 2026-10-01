import { Image } from "react-native";
import { Tabs } from "expo-router";
import { useNotificationPermissions } from "@/hooks/useNotificationPermissions";
import { useDeepLink } from "@/hooks/useDeepLink";

// Íconos en blanco con transparencia: `tintColor` los pinta con el color activo/inactivo.
const ICONS = {
  agenda: require("../../assets/tabs/agenda.png"),
  chat: require("../../assets/tabs/chat.png"),
  settings: require("../../assets/tabs/settings.png"),
};

function tabIcon(source: number) {
  return ({ color, size }: { color: string; size: number }) => (
    <Image
      source={source}
      style={{ width: size, height: size, tintColor: color }}
      resizeMode="contain"
    />
  );
}

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
      <Tabs.Screen name="agenda" options={{ title: "Agenda", tabBarIcon: tabIcon(ICONS.agenda) }} />
      <Tabs.Screen name="chat" options={{ title: "Asistente", tabBarIcon: tabIcon(ICONS.chat) }} />
      <Tabs.Screen name="settings" options={{ title: "Ajustes", tabBarIcon: tabIcon(ICONS.settings) }} />
    </Tabs>
  );
}
