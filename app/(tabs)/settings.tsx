import { ScrollView, View, Text, Switch, StyleSheet } from "react-native";
import { AutonomySelector } from "@/components/AutonomySelector";
import { BlockedHoursPicker } from "@/components/BlockedHoursPicker";
import { useSettingsStore } from "@/store/settingsStore";

export default function SettingsScreen() {
  const {
    settings,
    updateAutonomyLevel,
    addBlockedHour,
    removeBlockedHour,
  } = useSettingsStore();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Section title="Nivel de autonomía">
        <AutonomySelector
          value={settings.autonomyLevel}
          onChange={updateAutonomyLevel}
        />
      </Section>

      <Section title="Notificaciones">
        <ToggleRow label="Sonido" value={settings.notificationChannels.sound} />
        <ToggleRow label="Vibración" value={settings.notificationChannels.vibration} />
        <ToggleRow
          label="Prioridad alta"
          value={settings.notificationChannels.highPriority}
        />
      </Section>

      <Section title="Buffer entre citas">
        <Text style={styles.value}>{settings.bufferMinutes} minutos</Text>
      </Section>

      <Section title="">
        <BlockedHoursPicker
          ranges={settings.blockedHours}
          onAdd={() =>
            addBlockedHour({
              id: `local-${Date.now()}`,
              dayOfWeek: 1,
              startTime: "12:00",
              endTime: "14:00",
              label: "Almuerzo",
            })
          }
          onRemove={removeBlockedHour}
        />
      </Section>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      {title ? <Text style={styles.sectionTitle}>{title}</Text> : null}
      {children}
    </View>
  );
}

function ToggleRow({ label, value }: { label: string; value: boolean }) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch value={value} disabled trackColor={{ true: "#38BDF8" }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A" },
  content: { padding: 16, gap: 24 },
  section: { gap: 10 },
  sectionTitle: { color: "#F1F5F9", fontWeight: "700", fontSize: 16 },
  value: { color: "#E2E8F0", fontSize: 14 },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  toggleLabel: { color: "#E2E8F0", fontSize: 14 },
});
