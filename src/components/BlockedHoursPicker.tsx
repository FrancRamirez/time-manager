import { View, Text, Pressable, StyleSheet, FlatList } from "react-native";
import type { BlockedHourRange } from "@/types";

const DAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

interface Props {
  ranges: BlockedHourRange[];
  onAdd: () => void;
  onRemove: (id: string) => void;
}

export function BlockedHoursPicker({ ranges, onAdd, onRemove }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Horarios intocables</Text>
      <Text style={styles.subheading}>
        La IA nunca va a reprogramar ni agendar eventos en estas franjas.
      </Text>

      <FlatList
        data={ranges}
        keyExtractor={(item) => item.id}
        scrollEnabled={false}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.rowText}>
              {DAY_LABELS[item.dayOfWeek]} · {item.startTime}–{item.endTime}
              {item.label ? ` · ${item.label}` : ""}
            </Text>
            <Pressable onPress={() => onRemove(item.id)}>
              <Text style={styles.remove}>Quitar</Text>
            </Pressable>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>No configuraste ninguna franja todavía.</Text>
        }
      />

      <Pressable style={styles.addButton} onPress={onAdd}>
        <Text style={styles.addButtonText}>+ Agregar franja</Text>
      </Pressable>
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
});
