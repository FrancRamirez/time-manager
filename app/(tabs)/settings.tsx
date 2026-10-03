import { Alert, Pressable, ScrollView, View, Text, Switch, StyleSheet } from "react-native";
import { AutonomySelector } from "@/components/AutonomySelector";
import { BlockedHoursPicker } from "@/components/BlockedHoursPicker";
import { Stepper } from "@/components/Stepper";
import { useSettingsStore } from "@/store/settingsStore";
import { useUserStore } from "@/store/userStore";
import { logout } from "@/services/session";

export default function SettingsScreen() {
  const {
    settings,
    updateAutonomyLevel,
    setBufferMinutes,
    setDailyActionLimit,
    addBlockedHour,
    removeBlockedHour,
  } = useSettingsStore();
  const user = useUserStore((s) => s.user);

  function confirmLogout() {
    Alert.alert(
      "Cerrar sesión",
      "Se borrarán de este teléfono la sesión y el historial del chat. Tus ajustes se conservan.",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Cerrar sesión", style: "destructive", onPress: () => void logout() },
      ]
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Section title="Nivel de autonomía">
        <AutonomySelector
          value={settings.autonomyLevel}
          onChange={updateAutonomyLevel}
        />
      </Section>

      {settings.autonomyLevel === "autopilot" && (
        <Section title="Límite diario de acciones automáticas">
          <Text style={styles.hint}>
            Al llegar al límite, el asistente vuelve a pedirte confirmación hasta el día siguiente.
            Cancelar eventos siempre te pide confirmación.
          </Text>
          <Stepper
            value={settings.dailyActionLimit}
            onChange={setDailyActionLimit}
            min={5}
            max={200}
            step={5}
          />
        </Section>
      )}

      <Section title="Notificaciones">
        <ToggleRow label="Sonido" value={settings.notificationChannels.sound} />
        <ToggleRow label="Vibración" value={settings.notificationChannels.vibration} />
        <ToggleRow
          label="Prioridad alta"
          value={settings.notificationChannels.highPriority}
        />
      </Section>

      <Section title="Buffer entre citas">
        <Text style={styles.hint}>
          Tiempo libre mínimo que el asistente deja antes y después de cada evento.
        </Text>
        <Stepper
          value={settings.bufferMinutes}
          onChange={setBufferMinutes}
          min={0}
          max={120}
          step={5}
          suffix=" min"
        />
      </Section>

      <Section title="">
        <BlockedHoursPicker
          ranges={settings.blockedHours}
          onAdd={(ranges) =>
            ranges.forEach((r) =>
              addBlockedHour({ ...r, id: `local-${Date.now()}-${r.dayOfWeek}-${r.startTime}` })
            )
          }
          onRemove={removeBlockedHour}
        />
      </Section>

      <Section title="Cuenta">
        {user?.email ? <Text style={styles.value}>{user.email}</Text> : null}
        <Pressable
          style={styles.logoutButton}
          onPress={confirmLogout}
          accessibilityRole="button"
        >
          <Text style={styles.logoutText}>Cerrar sesión</Text>
        </Pressable>
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
  hint: { color: "#94A3B8", fontSize: 12 },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  toggleLabel: { color: "#E2E8F0", fontSize: 14 },
  logoutButton: {
    borderWidth: 1,
    borderColor: "#F87171",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  logoutText: { color: "#F87171", fontWeight: "700", fontSize: 14 },
});
