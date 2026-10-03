import { useCallback, useEffect, useState } from "react";
import { Alert, FlatList, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import {
  MAX_CONVERSATIONS,
  clearConversations,
  deleteConversation,
  formatWhen,
  listConversations,
  type ConversationMeta,
} from "@/services/conversations";

interface Props {
  visible: boolean;
  /** Conversación abierta ahora (se resalta). */
  activeId: string | null;
  onOpen: (id: string) => void;
  /** Se llama tras borrar la conversación abierta, o todo el historial. */
  onDeleted: (id: string | "all") => void;
  onClose: () => void;
}

export function ConversationHistory({ visible, activeId, onOpen, onDeleted, onClose }: Props) {
  const [items, setItems] = useState<ConversationMeta[] | null>(null);

  const refresh = useCallback(async () => setItems(await listConversations()), []);

  useEffect(() => {
    if (visible) refresh();
  }, [visible, refresh]);

  function confirmDelete(item: ConversationMeta) {
    Alert.alert("Borrar conversación", `"${item.title}" se borrará de este teléfono.`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Borrar",
        style: "destructive",
        onPress: async () => {
          await deleteConversation(item.id);
          onDeleted(item.id);
          refresh();
        },
      },
    ]);
  }

  function confirmClearAll() {
    Alert.alert(
      "Borrar todo el historial",
      "Se borrarán todas las conversaciones guardadas en este teléfono.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Borrar todo",
          style: "destructive",
          onPress: async () => {
            await clearConversations();
            onDeleted("all");
            refresh();
          },
        },
      ]
    );
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Historial</Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button">
            <Text style={styles.close}>Cerrar</Text>
          </Pressable>
        </View>

        <FlatList
          data={items ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            items === null ? null : (
              <Text style={styles.empty}>
                Todavía no hay conversaciones guardadas. Las que tengas con Frami aparecerán aquí.
              </Text>
            )
          }
          renderItem={({ item }) => (
            <Pressable
              style={[styles.row, item.id === activeId && styles.rowActive]}
              onPress={() => onOpen(item.id)}
              onLongPress={() => confirmDelete(item)}
              accessibilityRole="button"
              accessibilityLabel={`Abrir conversación ${item.title}`}
            >
              <View style={styles.rowText}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.rowMeta}>
                  {formatWhen(item.updatedAt)} · {item.messageCount} mensajes
                  {item.id === activeId ? " · abierta" : ""}
                </Text>
              </View>
              <Pressable
                onPress={() => confirmDelete(item)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={`Borrar conversación ${item.title}`}
              >
                <Text style={styles.delete}>Borrar</Text>
              </Pressable>
            </Pressable>
          )}
        />

        <Text style={styles.footnote}>
          Se guardan en este teléfono (las últimas {MAX_CONVERSATIONS}); el servidor no las guarda.
          Al retomar una conversación, Frami recuerda solo los últimos mensajes.
        </Text>
        {items && items.length > 0 ? (
          <Pressable style={styles.clearAll} onPress={confirmClearAll} accessibilityRole="button">
            <Text style={styles.clearAllText}>Borrar todo el historial</Text>
          </Pressable>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A", paddingTop: 48, paddingHorizontal: 16 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  title: { color: "#F1F5F9", fontSize: 20, fontWeight: "700" },
  close: { color: "#38BDF8", fontWeight: "700", fontSize: 15 },
  list: { gap: 8, paddingBottom: 12 },
  empty: { color: "#64748B", textAlign: "center", marginTop: 40, lineHeight: 20 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#1E293B",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "transparent",
  },
  rowActive: { borderColor: "#38BDF8" },
  rowText: { flex: 1 },
  rowTitle: { color: "#F1F5F9", fontSize: 15, fontWeight: "600" },
  rowMeta: { color: "#94A3B8", fontSize: 12, marginTop: 4 },
  delete: { color: "#F87171", fontSize: 13, fontWeight: "600" },
  footnote: { color: "#64748B", fontSize: 12, textAlign: "center", marginTop: 8, lineHeight: 17 },
  clearAll: { alignItems: "center", paddingVertical: 14, marginBottom: 16 },
  clearAllText: { color: "#F87171", fontWeight: "700" },
});
