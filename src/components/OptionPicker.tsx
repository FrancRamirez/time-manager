import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

interface Props {
  visible: boolean;
  title: string;
  options: string[];
  onSelect: (index: number) => void;
  onCancel: () => void;
}

/** Lista modal para elegir una opción (Alert en Android admite solo 3 botones). */
export function OptionPicker({ visible, title, options, onSelect, onCancel }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        {/* El Pressable interno evita que tocar la tarjeta cierre el modal. */}
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.title}>{title}</Text>
          <ScrollView style={styles.list}>
            {options.map((label, i) => (
              <Pressable key={`${i}-${label}`} style={styles.option} onPress={() => onSelect(i)}>
                <Text style={styles.optionText}>{label}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Pressable style={styles.cancel} onPress={onCancel}>
            <Text style={styles.cancelText}>Cancelar</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    padding: 24,
  },
  card: { backgroundColor: "#1E293B", borderRadius: 14, padding: 16, maxHeight: "70%" },
  title: { color: "#F1F5F9", fontSize: 15, fontWeight: "700", marginBottom: 12 },
  list: { flexGrow: 0 },
  option: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#0F172A",
    marginBottom: 8,
  },
  optionText: { color: "#E2E8F0", fontSize: 14 },
  cancel: { paddingVertical: 12, alignItems: "center" },
  cancelText: { color: "#94A3B8", fontWeight: "700" },
});
