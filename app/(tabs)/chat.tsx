import { useCallback, useEffect, useRef, useState } from "react";
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
  AppState,
} from "react-native";
import { useNavigation } from "expo-router";
import {
  sendChatMessage,
  confirmPendingAction,
  type PendingAction,
} from "@/api/gemini";
import {
  blockFromError,
  fetchAiUsage,
  formatWait,
  toUsageState,
  type AiBlock,
  type UsageState,
} from "@/api/usage";
import { UsageBanner } from "@/components/UsageBanner";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { handleDeviceAction } from "@/services/deviceActions";
import { apiErrorMessage } from "@/api/client";
import { TypingIndicator } from "@/components/TypingIndicator";
import { OptionPicker } from "@/components/OptionPicker";
import { ConversationHistory } from "@/components/ConversationHistory";
import {
  deleteConversation,
  getActiveConversationId,
  loadConversation,
  newConversationId,
  saveConversation,
  setActiveConversationId,
} from "@/services/conversations";
import type { ChatMessage } from "@/types";

/**
 * true: al soltar el micrófono el mensaje dictado se envía solo (manos libres).
 * false: el texto queda en la caja para revisarlo y enviarlo a mano.
 */
const AUTO_SEND_VOICE = true;

/** Distancia (px) que hay que deslizar hacia la izquierda para cancelar el dictado. */
const CANCEL_DX = 90;

const MIC_ICON = require("../../assets/mic.png");

const DONE_TEXT: Record<PendingAction["type"], string> = {
  create: "Listo, ya lo hice en tu calendario.",
  reschedule: "Listo, ya lo hice en tu calendario.",
  cancel: "Listo, ya lo hice en tu calendario.",
  email_draft: "Listo, dejé el borrador en tu Gmail.",
  email_send: "Listo, el correo fue enviado.",
  email_modify: "Listo, actualicé el correo en tu Gmail.",
  email_trash: "Listo, moví el correo a la papelera de Gmail.",
};

export default function ChatScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [willCancel, setWillCancel] = useState(false);
  const [usage, setUsage] = useState<UsageState | null>(null);
  const [aiBlock, setAiBlock] = useState<AiBlock | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pulse = useRef(new Animated.Value(1)).current;
  const listRef = useRef<FlatList<ChatMessage>>(null);

  // --- Historial de conversaciones (guardado solo en el teléfono) -------------
  const navigation = useNavigation();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const messagesRef = useRef<ChatMessage[]>([]);
  const idRef = useRef<string | null>(null);
  const restoredRef = useRef(false);
  /** Mensajes recién cargados del historial: no se vuelven a guardar (no cambian el orden por fecha). */
  const loadedRef = useRef<ChatMessage[] | null>(null);
  const [picker, setPicker] = useState<{
    title: string;
    options: string[];
    resolve: (index: number | null) => void;
  } | null>(null);
  // Las acciones del dispositivo piden elegir (p. ej. entre varios números) mediante esta lista.
  const deviceUi = useRef({
    chooseOption: (title: string, options: string[]) =>
      new Promise<number | null>((resolve) => setPicker({ title, options, resolve })),
  }).current;
  const closePicker = (index: number | null) => {
    picker?.resolve(index);
    setPicker(null);
  };

  // Sin mensajes propios o sin cupo de IA: no se puede enviar hasta que termine la espera.
  const blocked =
    aiBlock !== null ||
    (usage !== null && usage.limit > 0 && usage.remaining <= 0 && Date.now() < usage.until);
  const blockedRef = useRef(blocked);
  blockedRef.current = blocked;

  const loadUsage = useCallback(async () => {
    try {
      const { usage: u, aiBlock: b } = await fetchAiUsage();
      setUsage(u);
      setAiBlock(b);
    } catch {
      // Sin contador no se bloquea nada: el servidor igual rechaza lo que corresponda.
      setAiBlock(null);
    }
  }, []);

  useEffect(() => {
    loadUsage();
  }, [loadUsage]);

  messagesRef.current = messages;
  idRef.current = conversationId;
  restoredRef.current = restored;

  // Al abrir el chat se retoma la última conversación.
  useEffect(() => {
    (async () => {
      try {
        const id = await getActiveConversationId();
        if (id) {
          const loaded = await loadConversation(id);
          if (loaded.length) {
            loadedRef.current = loaded;
            setMessages(loaded);
            setConversationId(id);
          } else {
            await setActiveConversationId(null);
          }
        }
      } finally {
        setRestored(true);
      }
    })();
  }, []);

  // Guarda con una pequeña espera para no escribir en cada tecla de la respuesta.
  useEffect(() => {
    if (!restored || messages.length === 0) return;
    if (messages === loadedRef.current) return;
    if (!conversationId) {
      const id = newConversationId();
      setConversationId(id);
      void setActiveConversationId(id);
      return;
    }
    const timer = setTimeout(() => void saveConversation(conversationId, messages), 400);
    return () => clearTimeout(timer);
  }, [messages, conversationId, restored]);

  // Si la app pasa a segundo plano se guarda de inmediato.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      const id = idRef.current;
      if (state !== "active" && id && messagesRef.current !== loadedRef.current) {
        void saveConversation(id, messagesRef.current);
      }
    });
    return () => sub.remove();
  }, []);

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
      pushAssistant(approve ? DONE_TEXT[action.type] : "Entendido, no hice cambios.");
    } catch (err) {
      // Si el servidor explica el motivo (p. ej. falta el permiso de Gmail), se muestra.
      pushAssistant(
        apiErrorMessage(
          err,
          "No pude completar la acción. Puede que haya vencido; pídemela de nuevo."
        ),
        "error"
      );
    }
  }

  async function sendText(raw: string, opts: { viaVoice?: boolean; clearInput?: boolean } = {}) {
    const trimmed = raw.trim();
    if (!trimmed) return;
    if (!restoredRef.current) return;
    if (sending || blockedRef.current) {
      // Hay otra respuesta en curso o no quedan mensajes: lo dictado no se pierde, queda en la caja.
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
      const { reply, pendingAction, deviceAction, usage: newUsage } = await sendChatMessage(
        trimmed,
        history,
        { viaVoice: opts.viaVoice }
      );
      setMessages((prev) => [...prev, reply]);
      if (newUsage) setUsage(toUsageState(newUsage));

      if (deviceAction) {
        // Alarmas y temporizadores los ejecuta la app en el reloj del teléfono.
        handleDeviceAction(
          deviceAction,
          (result) => pushAssistant(result.message, result.ok ? "assistant" : "error"),
          deviceUi
        );
      }

      if (pendingAction) {
        // Toda acción que modifica el calendario requiere confirmación
        // explícita (regla de negocio de la spec).
        Alert.alert(
          pendingAction.type === "email_send" ? "¿Enviar este correo?" : "Confirmar acción",
          pendingAction.description,
          [
            { text: "Cancelar", style: "cancel", onPress: () => resolveAction(pendingAction, false) },
            { text: "Confirmar", onPress: () => resolveAction(pendingAction, true) },
          ],
          { cancelable: false }
        );
      }
    } catch (err) {
      const block = blockFromError(err);
      if (block) {
        // No se envió nada: el mensaje vuelve a la caja y se informa la espera exacta.
        setAiBlock(block);
        setMessages((prev) => prev.filter((m) => m.id !== userMessage.id));
        setInput(trimmed);
        pushAssistant(
          block.reason === "ai_quota"
            ? `Frami alcanzó su límite diario. Podrás volver a hablar con Frami en ${formatWait(block.until - Date.now())}.`
            : `Ya usaste todos tus mensajes de hoy. Se renuevan en ${formatWait(block.until - Date.now())}.`,
          "error"
        );
        if (block.reason === "user_limit") loadUsage();
      } else {
        pushAssistant("No pude procesar eso ahora. Intenta de nuevo en un momento.", "error");
      }
    } finally {
      setSending(false);
    }
  }

  function handleSend() {
    if (sending) return;
    sendText(input, { clearInput: true });
  }

  // --- Historial: nuevo chat / abrir / borrar ---------------------------------
  /** Guarda lo pendiente antes de cambiar de conversación. */
  async function flushCurrent() {
    const id = idRef.current;
    if (id && messagesRef.current.length && messagesRef.current !== loadedRef.current) {
      await saveConversation(id, messagesRef.current);
    }
  }

  /** No se cambia de conversación con una respuesta en curso o dictando. */
  function busyForSwitch(): boolean {
    if (!restoredRef.current) return true;
    if (sending || voice.listening) {
      showNotice("Espera a que termine la respuesta para cambiar de conversación.");
      return true;
    }
    return false;
  }

  async function startNewConversation() {
    if (busyForSwitch()) return;
    if (messagesRef.current.length === 0) return;
    await flushCurrent();
    loadedRef.current = null;
    setMessages([]);
    setConversationId(null);
    setInput("");
    await setActiveConversationId(null);
  }

  async function openConversation(id: string) {
    if (busyForSwitch()) return;
    if (id === idRef.current) {
      setHistoryOpen(false);
      return;
    }
    await flushCurrent();
    const loaded = await loadConversation(id);
    if (loaded.length === 0) {
      await deleteConversation(id);
      showNotice("Esa conversación ya no está disponible.");
      return;
    }
    loadedRef.current = loaded;
    setMessages(loaded);
    setConversationId(id);
    setInput("");
    await setActiveConversationId(id);
    setHistoryOpen(false);
  }

  function handleDeleted(id: string | "all") {
    if (id === "all" || id === idRef.current) {
      loadedRef.current = null;
      setMessages([]);
      setConversationId(null);
    }
  }

  function openHistory() {
    if (busyForSwitch()) return;
    void flushCurrent().then(() => setHistoryOpen(true));
  }

  // Botones del encabezado (el efecto se registra una vez; llama siempre a la versión vigente).
  const headerActions = useRef({ openHistory, startNewConversation });
  headerActions.current = { openHistory, startNewConversation };
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => headerActions.current.openHistory()}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Historial de conversaciones"
          >
            <Text style={styles.headerButton}>Historial</Text>
          </Pressable>
          <Pressable
            onPress={() => void headerActions.current.startNewConversation()}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Nueva conversación"
          >
            <Text style={styles.headerButton}>Nuevo</Text>
          </Pressable>
        </View>
      ),
    });
  }, [navigation]);

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
        if (blockedRef.current) {
          showNotice("No hay mensajes disponibles por ahora.");
          return;
        }
        Keyboard.dismiss();
        setCancelling(false);
        voiceRef.current.startHold();
      },
      onPanResponderMove: (_, gesture) => setCancelling(gesture.dx < -CANCEL_DX),
      onPanResponderRelease: () => {
        if (blockedRef.current && !voiceRef.current.listening) return;
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
            <Text style={styles.emptyTitle}>Hola, soy Frami, tu asistente de agenda.</Text>
            <Text style={styles.empty}>
              Pídeme algo como "mueve el dentista al viernes por la tarde".
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

      <UsageBanner usage={usage} block={aiBlock} onExpire={loadUsage} />

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Escribe un mensaje..."
          placeholderTextColor="#64748B"
          onSubmitEditing={handleSend}
          editable={!sending && !voice.listening && !blocked}
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
        <Pressable
          style={[styles.sendButton, blocked && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={sending || blocked}
        >
          <Text style={styles.sendButtonText}>Enviar</Text>
        </Pressable>
      </View>
      <ConversationHistory
        visible={historyOpen}
        activeId={conversationId}
        onOpen={(id) => void openConversation(id)}
        onDeleted={handleDeleted}
        onClose={() => setHistoryOpen(false)}
      />
      <OptionPicker
        visible={picker !== null}
        title={picker?.title ?? ""}
        options={picker?.options ?? []}
        onSelect={(i) => closePicker(i)}
        onCancel={() => closePicker(null)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A" },
  headerActions: { flexDirection: "row", gap: 16, marginRight: 14 },
  headerButton: { color: "#38BDF8", fontWeight: "700", fontSize: 14 },
  listContent: { padding: 16, gap: 8 },
  emptyTitle: { color: "#CBD5E1", textAlign: "center", marginTop: 40, fontSize: 16, fontWeight: "600" },
  empty: { color: "#64748B", textAlign: "center", marginTop: 12 },
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
  sendButtonDisabled: { opacity: 0.4 },
  sendButtonText: { color: "#0F172A", fontWeight: "700" },
});
