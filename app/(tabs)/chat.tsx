import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  Image,
  Animated,
  PanResponder,
  Keyboard,
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
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { handleDeviceAction } from "@/services/deviceActions";
import { TypingIndicator } from "@/components/TypingIndicator";
import type { ChatMessage } from "@/types";

/**
 * true: al soltar el micrófono el mensaje dictado se envía solo (manos libres).
 * false: el texto queda en la caja para revisarlo y enviarlo a mano.
 */
const AUTO_SEND_VOICE = true;

/** Distancia (px) que hay que deslizar hacia la izquierda para cancelar el dictado. */
const CANCEL_DX = 90;

const MIC_ICON = require("../../assets/mic.png");

export default function ChatScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [willCancel, setWillCancel] = useState(false);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pulse = useRef(new Animated.Value(1)).current;
  const listRef = useRef<FlatList<ChatMessage>>(null);

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

  function showNotice(message: string) {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    setNotice(message);
    noticeTimer.current = setTimeout(() => setNotice(null), 4500);
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

  async function sendText(raw: string, opts: { viaVoice?: boolean; clearInput?: boolean } = {}) {
    const trimmed = raw.trim();
    if (!trimmed) return;
    if (sending) {
      // Hay otra respuesta en curso: lo dictado no se pierde, queda en la caja.
      if (opts.viaVoice) setInput(trimmed);
      return;
    }

    const history = messages;
    const userMessage: ChatMessage = {
      id: `local-${Date.now()}`,
      role: "user",
      content: trimmed,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);
    if (opts.clearInput) setInput("");
    setSending(true);

    try {
      const { reply, pendingAction, deviceAction } = await sendChatMessage(trimmed, history, {
        viaVoice: opts.viaVoice,
      });
      setMessages((prev) => [...prev, reply]);

      if (deviceAction) {
        // Alarmas y temporizadores los ejecuta la app en el reloj del teléfono.
        handleDeviceAction(deviceAction, (result) =>
          pushAssistant(result.message, result.ok ? "assistant" : "error")
        );
      }

      if (pendingAction) {
        // Toda acción que modifica el calendario requiere confirmación
        // explícita (regla de negocio de la spec).
        Alert.alert(
          "Confirmar acción",
          pendingAction.description,
          [
            { text: "Cancelar", style: "cancel", onPress: () => resolveAction(pendingAction, false) },
            { text: "Confirmar", onPress: () => resolveAction(pendingAction, true) },
          ],
          { cancelable: false }
        );
      }
    } catch {
      pushAssistant("No pude procesar eso ahora. Intenta de nuevo en un momento.", "error");
    } finally {
      setSending(false);
    }
  }

  function handleSend() {
    if (sending) return;
    sendText(input, { clearInput: true });
  }

  // --- Dictado por voz: mantener presionado el micrófono ------------------------
  const voice = useVoiceInput({
    onFinal: (text) => {
      if (AUTO_SEND_VOICE) sendText(text, { viaVoice: true });
      else setInput((prev) => [prev.trim(), text].filter(Boolean).join(" "));
    },
    onNotice: showNotice,
  });

  // El PanResponder se crea una sola vez: accede al estado vigente a través de refs.
  const voiceRef = useRef(voice);
  voiceRef.current = voice;
  const willCancelRef = useRef(false);

  const setCancelling = (value: boolean) => {
    if (willCancelRef.current === value) return;
    willCancelRef.current = value;
    setWillCancel(value);
  };

  const micResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        Keyboard.dismiss();
        setCancelling(false);
        voiceRef.current.startHold();
      },
      onPanResponderMove: (_, gesture) => setCancelling(gesture.dx < -CANCEL_DX),
      onPanResponderRelease: () => {
        if (willCancelRef.current) voiceRef.current.cancelHold();
        else voiceRef.current.releaseHold();
        setCancelling(false);
      },
      // El sistema interrumpió el gesto (llamada, notificación...): se descarta.
      onPanResponderTerminate: () => {
        voiceRef.current.cancelHold();
        setCancelling(false);
      },
    })
  ).current;

  // Punto rojo que parpadea mientras se escucha.
  useEffect(() => {
    if (!voice.listening) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.25, duration: 600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [voice.listening, pulse]);

  useEffect(
    () => () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    },
    []
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <FlatList
        ref={listRef}
        data={messages}
        // Mantiene a la vista el último mensaje y el indicador "escribiendo".
        onContentSizeChange={() => {
          if (messages.length || sending) listRef.current?.scrollToEnd({ animated: true });
        }}
        ListFooterComponent={sending ? <TypingIndicator /> : null}
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
          <View>
            <Text style={styles.empty}>
              Pedime algo como "movete el dentista al viernes a la tarde".
            </Text>
            <Text style={styles.emptySecondary}>
              También puedes mantener presionado el micrófono y hablar.
            </Text>
          </View>
        }
      />

      {voice.listening ? (
        <View style={[styles.voicePanel, willCancel ? styles.voicePanelCancel : styles.voicePanelActive]}>
          <View style={styles.voiceHeader}>
            <Animated.View
              style={[styles.dot, willCancel && styles.dotCancel, { opacity: pulse }]}
            />
            <Text style={[styles.voiceTitle, willCancel && styles.voiceTitleCancel]}>
              {willCancel ? "Suelta para cancelar" : "Escuchando…"}
            </Text>
          </View>
          <Text style={styles.voiceTranscript} numberOfLines={4}>
            {voice.transcript || "Habla ahora…"}
          </Text>
          {!willCancel && (
            <Text style={styles.voiceHint}>Desliza hacia la izquierda para cancelar</Text>
          )}
        </View>
      ) : notice ? (
        <View style={styles.voicePanel}>
          <Text style={styles.voiceNotice}>{notice}</Text>
        </View>
      ) : null}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Escribí un mensaje..."
          placeholderTextColor="#64748B"
          onSubmitEditing={handleSend}
          editable={!sending && !voice.listening}
        />
        <View
          {...micResponder.panHandlers}
          style={[
            styles.micButton,
            voice.listening && (willCancel ? styles.micButtonCancel : styles.micButtonActive),
          ]}
          accessible
          accessibilityRole="button"
          accessibilityLabel="Mantén presionado para hablar"
        >
          <Image
            source={MIC_ICON}
            style={[styles.micIcon, { tintColor: voice.listening ? "#FFFFFF" : "#38BDF8" }]}
            resizeMode="contain"
          />
        </View>
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
  emptySecondary: { color: "#475569", textAlign: "center", marginTop: 8, fontSize: 13 },
  bubble: { maxWidth: "80%", borderRadius: 12, padding: 10, marginBottom: 8 },
  bubbleUser: { backgroundColor: "#38BDF8", alignSelf: "flex-end" },
  bubbleAssistant: { backgroundColor: "#1E293B", alignSelf: "flex-start" },
  bubbleText: { color: "#0F172A", fontSize: 14 },
  bubbleTextAssistant: { color: "#F1F5F9", fontSize: 14 },
  voicePanel: {
    marginHorizontal: 12,
    marginBottom: 4,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#1E293B",
    gap: 6,
  },
  voicePanelActive: { borderWidth: 1, borderColor: "#EF4444" },
  voicePanelCancel: { borderWidth: 1, borderColor: "#64748B" },
  voiceHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#EF4444" },
  dotCancel: { backgroundColor: "#64748B" },
  voiceTitle: { color: "#F1F5F9", fontWeight: "700", fontSize: 14 },
  voiceTitleCancel: { color: "#94A3B8" },
  voiceTranscript: { color: "#E2E8F0", fontSize: 15 },
  voiceHint: { color: "#64748B", fontSize: 12 },
  voiceNotice: { color: "#FCD34D", fontSize: 13 },
  inputRow: {
    flexDirection: "row",
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "#1E293B",
    gap: 8,
    alignItems: "center",
  },
  input: {
    flex: 1,
    backgroundColor: "#1E293B",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: "#F1F5F9",
  },
  micButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#1E293B",
    alignItems: "center",
    justifyContent: "center",
  },
  micButtonActive: { backgroundColor: "#EF4444", borderColor: "#EF4444" },
  micButtonCancel: { backgroundColor: "#475569", borderColor: "#475569" },
  micIcon: { width: 22, height: 22 },
  sendButton: {
    backgroundColor: "#38BDF8",
    borderRadius: 10,
    paddingHorizontal: 16,
    alignSelf: "stretch",
    justifyContent: "center",
  },
  sendButtonText: { color: "#0F172A", fontWeight: "700" },
});
