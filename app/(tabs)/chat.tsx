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
import { sendChatMessage, confirmPendingAction } from "@/api/gemini";
import type { ChatMessage } from "@/types";

export default function ChatScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || sending) return;

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
      const { reply, pendingAction } = await sendChatMessage(trimmed);
      setMessages((prev) => [...prev, reply]);

      if (pendingAction) {
        // Confirmación crítica requerida para acciones destructivas
        // (cancelar/borrar), según la regla de negocio de la spec.
        Alert.alert("Confirmar acción", pendingAction.description, [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Confirmar",
            onPress: () => confirmPendingAction(pendingAction.type, true),
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: "assistant",
          content: "No pude procesar eso ahora. Probá de nuevo en un momento.",
          createdAt: new Date().toISOString(),
        },
      ]);
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
            <Text style={styles.bubbleText}>{item.content}</Text>
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
