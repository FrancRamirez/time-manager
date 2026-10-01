import { useState } from "react";
import { View, Text, Pressable, StyleSheet, TextInput } from "react-native";
import type { BlockedHourRange } from "@/types";

const DAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
// Orden de los chips: empieza en lunes.
const DAY_ORDER: BlockedHourRange["dayOfWeek"][] = [1, 2, 3, 4, 5, 6, 0];
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export type NewBlockedRange = Omit<BlockedHourRange, "id">;

interface Props {
  ranges: BlockedHourRange[];
  onAdd: (ranges: NewBlockedRange[]) => void;
  onRemove: (id: string) => void;
}

/** "9:00" -> "09:00" */
function normalizeTime(value: string) {
  const v = value.trim();
  return /^\d:\d{2}$/.test(v) ? `0${v}` : v;
}

function sortKey(r: BlockedHourRange) {
  return `${(r.dayOfWeek + 6) % 7}${r.startTime}`; // lunes primero
}

export function BlockedHoursPicker({ ranges, onAdd, onRemove }: Props) {
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState<number[]>([]);
  const [start, setStart] = useState("12:00");
  const [end, setEnd] = useState("14:00");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);

  function toggleDay(day: number) {
    setDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  }

  function reset() {
    setOpen(false);
    setDays([]);
    setStart("12:00");
    setEnd("14:00");
    setLabel("");
    setError(null);
  }

  function handleSave() {
    const startTime = normalizeTime(start);
    const endTime = normalizeTime(end);
    if (days.length === 0) return setError("Elige al menos un día.");
    if (!TIME_RE.test(startTime) || !TIME_RE.test(endTime)) {
      return setError("Usa el formato HH:mm, por ejemplo 09:30.");
    }
    if (startTime === endTime) return setError("El inicio y el fin no pueden ser iguales.");

    onAdd(
      days.map((d) => ({
        dayOfWeek: d as BlockedHourRange["dayOfWeek"],
        startTime,
        endTime,
        label: label.trim() || undefined,
      }))
    );
    reset();
  }

  const sorted = [...ranges].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Horarios intocables</Text>
      <Text style={styles.subheading}>
        La IA nunca va a reprogramar ni agendar eventos en estas franjas. Si el fin es
        menor que el inicio, la franja cruza la medianoche.
      </Text>

      {sorted.length === 0 ? (
        <Text style={styles.empty}>No configuraste ninguna franja todavía.</Text>
      ) : (
        sorted.map((item) => (
          <View key={item.id} style={styles.row}>
            <Text style={styles.rowText}>
              {DAY_LABELS[item.dayOfWeek]} · {item.startTime}–{item.endTime}
              {item.label ? ` · ${item.label}` : ""}
            </Text>
            <Pressable onPress={() => onRemove(item.id)}>
              <Text style={styles.remove}>Quitar</Text>
            </Pressable>
          </View>
        ))
      )}

      {open ? (
        <View style={styles.form}>
          <View style={styles.chips}>
            {DAY_ORDER.map((d) => {
              const selected = days.includes(d);
              return (
                <Pressable
                  key={d}
                  onPress={() => toggleDay(d)}
                  style={[styles.chip, selected && styles.chipSelected]}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                    {DAY_LABELS[d]}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.timeRow}>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Desde</Text>
              <TextInput
                style={styles.input}
                value={start}
                onChangeText={setStart}
                placeholder="12:00"
                placeholderTextColor="#64748B"
                keyboardType="numbers-and-punctuation"
                maxLength={5}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Hasta</Text>
              <TextInput
                style={styles.input}
                value={end}
                onChangeText={setEnd}
                placeholder="14:00"
                placeholderTextColor="#64748B"
                keyboardType="numbers-and-punctuation"
                maxLength={5}
              />
            </View>
          </View>

          <TextInput
            style={styles.input}
            value={label}
            onChangeText={setLabel}
            placeholder="Nombre (opcional), ej. Almuerzo"
            placeholderTextColor="#64748B"
            maxLength={40}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.formActions}>
            <Pressable onPress={handleSave}>
              <Text style={styles.addButtonText}>Guardar</Text>
            </Pressable>
            <Pressable onPress={reset}>
              <Text style={styles.cancel}>Cancelar</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable style={styles.addButton} onPress={() => setOpen(true)}>
          <Text style={styles.addButtonText}>+ Agregar franja</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  heading: { color: "#F1F5F9", fontWeight: "600", fontSize: 15 },
  subheading: { color: "#94A3B8", fontSize: 12, marginBottom: 8 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#1E293B",
  },
  rowText: { color: "#E2E8F0", fontSize: 13 },
  remove: { color: "#F87171", fontSize: 12, fontWeight: "600" },
  empty: { color: "#64748B", fontSize: 12, fontStyle: "italic", paddingVertical: 8 },
  addButton: { marginTop: 8, alignSelf: "flex-start" },
  addButtonText: { color: "#38BDF8", fontWeight: "600", fontSize: 13 },
  form: {
    marginTop: 8,
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#334155",
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#334155",
  },
  chipSelected: { borderColor: "#38BDF8", backgroundColor: "#0C2536" },
  chipText: { color: "#94A3B8", fontSize: 13 },
  chipTextSelected: { color: "#38BDF8", fontWeight: "600" },
  timeRow: { flexDirection: "row", gap: 12 },
  field: { flex: 1, gap: 4 },
  fieldLabel: { color: "#94A3B8", fontSize: 12 },
  input: {
    backgroundColor: "#1E293B",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: "#F1F5F9",
  },
  error: { color: "#F87171", fontSize: 12 },
  formActions: { flexDirection: "row", gap: 20 },
  cancel: { color: "#94A3B8", fontWeight: "600", fontSize: 13 },
});
