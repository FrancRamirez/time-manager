import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import {
  sendChatMessage,
  confirmPendingAction,
  type PendingAction,
} from "@/api/gemini";
import type { ChatMessage } from "@/types";

export default function ChatScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  function pushAssistant(content: string, prefix = "assistant") {
    setMessages((prev) => [
      ...prev,
      {
        id: `${prefix}-${Date.now()}`,
        role: "assistant",
        content,
        createdAt: new Date().toISOString(),
      },
    ]);
  }

  async function resolveAction(action: PendingAction, approve: boolean) {
    try {
      await confirmPendingAction(action.id, approve);
      pushAssistant(approve ? "Listo, ya lo hice en tu calendario." : "Entendido, no hice cambios.");
    } catch {
      pushAssistant(
        "No pude completar la acción. Puede que haya vencido; pídemela de nuevo.",
        "error"
      );
    }
  }

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || sending) return;

    const history = messages;
    const userMessage: ChatMessage = {
      id: `local-${Date.now()}`,
      role: "user",
      content: trimmed,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setSending(true);

    try {
      const { reply, pendingAction } = await sendChatMessage(trimmed, history);
      setMessages((prev) => [...prev, reply]);

      if (pendingAction) {
        // Toda acción que modifica el calendario requiere confirmación
        // explícita (regla de negocio de la spec).
        Alert.alert("Confirmar acción", pendingAction.description, [
          { text: "Cancelar", style: "cancel", onPress: () => resolveAction(pendingAction, false) },
          { text: "Confirmar", onPress: () => resolveAction(pendingAction, true) },
        ], { cancelable: false });
      }
    } catch {
      pushAssistant("No pude procesar eso ahora. Intenta de nuevo en un momento.", "error");
    } finally {
      setSending(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View
            style={[
              styles.bubble,
              item.role === "user" ? styles.bubbleUser : styles.bubbleAssistant,
            ]}
          >
            <Text
              style={item.role === "user" ? styles.bubbleText : styles.bubbleTextAssistant}
            >
              {item.content}
            </Text>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>
            Pedime algo como "movete el dentista al viernes a la tarde".
          </Text>
        }
      />

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Escribí un mensaje..."
          placeholderTextColor="#64748B"
          onSubmitEditing={handleSend}
          editable={!sending}
        />
        <Pressable style={styles.sendButton} onPress={handleSend} disabled={sending}>
          <Text style={styles.sendButtonText}>Enviar</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A" },
  listContent: { padding: 16, gap: 8 },
  empty: { color: "#64748B", textAlign: "center", marginTop: 40 },
  bubble: { maxWidth: "80%", borderRadius: 12, padding: 10, marginBottom: 8 },
  bubbleUser: { backgroundColor: "#38BDF8", alignSelf: "flex-end" },
  bubbleAssistant: { backgroundColor: "#1E293B", alignSelf: "flex-start" },
  bubbleText: { color: "#0F172A", fontSize: 14 },
  bubbleTextAssistant: { color: "#F1F5F9", fontSize: 14 },
  inputRow: {
    flexDirection: "row",
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "#1E293B",
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: "#1E293B",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: "#F1F5F9",
  },
  sendButton: {
    backgroundColor: "#38BDF8",
    borderRadius: 10,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  sendButtonText: { color: "#0F172A", fontWeight: "700" },
});
