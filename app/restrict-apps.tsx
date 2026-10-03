import { ScrollView, View, Text, StyleSheet } from "react-native";
import { AccessSelector } from "@/components/AccessSelector";
import { RESTRICTABLE_APPS } from "@/constants/apps";
import { useSettingsStore } from "@/store/settingsStore";

export default function RestrictAppsScreen() {
  const appAccess = useSettingsStore((s) => s.settings.appAccess);
  const setAppAccess = useSettingsStore((s) => s.setAppAccess);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.intro}>
        Elige qué puede hacer Frami en cada app. Esto limita al asistente: no cambia los permisos de
        Android ni el acceso de tu cuenta de Google.
      </Text>

      {RESTRICTABLE_APPS.map((app) => {
        const level = appAccess[app.id];
        return (
          <View key={app.id} style={styles.card}>
            <Text style={styles.name}>{app.name}</Text>
            <AccessSelector
              levels={app.levels}
              value={level}
              onChange={(next) => setAppAccess(app.id, next)}
              appLabel={app.name}
            />
            <Text style={styles.explain}>{app.explain[level]}</Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A" },
  content: { padding: 16, gap: 16 },
  intro: { color: "#94A3B8", fontSize: 13 },
  card: { borderWidth: 1, borderColor: "#1E293B", borderRadius: 12, padding: 14, gap: 12 },
  name: { color: "#F1F5F9", fontWeight: "700", fontSize: 16 },
  explain: { color: "#94A3B8", fontSize: 12 },
});
