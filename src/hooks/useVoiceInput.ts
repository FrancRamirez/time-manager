import { useCallback, useEffect, useRef, useState } from "react";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";

const MAX_RESTARTS = 40; // reinicios del reconocedor mientras se mantiene presionado
const RESTART_DELAY_MS = 250;
const STOP_TIMEOUT_MS = 2500; // si "end" no llega tras soltar, se entrega lo que haya

// Errores tras los cuales no tiene sentido seguir intentando.
const FATAL_MESSAGES: Record<string, string> = {
  "not-allowed":
    "No hay permiso para usar el micrófono o el reconocimiento de voz. Revísalo en los ajustes del sistema.",
  "service-not-allowed":
    "El servicio de reconocimiento de voz del teléfono no está disponible. Verifica que los servicios de voz de Google estén activados.",
  "audio-capture": "No se pudo acceder al micrófono.",
  "language-not-supported": "El idioma de voz no está disponible en este dispositivo.",
};

function recognitionLocale() {
  const locale = Intl.DateTimeFormat().resolvedOptions().locale;
  return locale.toLowerCase().startsWith("es") ? locale : "es-ES";
}

interface Options {
  /** Se llama una sola vez al soltar el micrófono, con todo lo dictado. */
  onFinal: (text: string) => void;
  /** Avisos para el usuario (permisos, "no se escuchó nada", errores). */
  onNotice: (message: string) => void;
}

/**
 * Dictado "mantener para hablar": transcribe mientras el dedo siga sobre el
 * micrófono y entrega el texto completo al soltar.
 *
 * En Android 12 o anterior el reconocedor no tiene modo continuo y se corta
 * solo con los silencios; por eso, mientras se mantiene presionado, se reinicia
 * y se van acumulando los fragmentos.
 */
export function useVoiceInput({ onFinal, onNotice }: Options) {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");

  const holding = useRef(false); // el dedo sigue presionando
  const active = useRef(false); // hay una sesión de dictado en curso
  const running = useRef(false); // el reconocedor nativo está corriendo
  const committed = useRef(""); // fragmentos ya finalizados
  const interim = useRef(""); // fragmento parcial actual
  const restarts = useRef(0);
  const lastError = useRef<string | null>(null);
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Siempre se usan los callbacks más recientes (evita cierres con estado viejo).
  const callbacks = useRef({ onFinal, onNotice });
  callbacks.current = { onFinal, onNotice };

  const compose = () => [committed.current, interim.current].filter(Boolean).join(" ").trim();

  const clearStopTimer = () => {
    if (stopTimer.current) {
      clearTimeout(stopTimer.current);
      stopTimer.current = null;
    }
  };

  const reset = () => {
    clearStopTimer();
    active.current = false;
    holding.current = false;
    committed.current = "";
    interim.current = "";
    setListening(false);
    setTranscript("");
  };

  const begin = () => {
    ExpoSpeechRecognitionModule.start({
      lang: recognitionLocale(),
      interimResults: true,
      continuous: true,
      androidIntentOptions: {
        // Tolera pausas largas al hablar (algunos motores las ignoran).
        EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 15000,
        EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS: 15000,
      },
    });
  };

  /** Entrega el texto una única vez y cierra la sesión. */
  const finish = useCallback(() => {
    if (!active.current) return;
    const text = compose();
    const error = lastError.current;
    reset();
    if (text) {
      callbacks.current.onFinal(text);
    } else if (error === "network") {
      callbacks.current.onNotice(
        "Sin conexión: el reconocimiento de voz de este teléfono necesita internet."
      );
    } else {
      callbacks.current.onNotice("No se escuchó nada. Mantén presionado el micrófono mientras hablas.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fail = (message: string) => {
    reset();
    try {
      ExpoSpeechRecognitionModule.abort();
    } catch {
      /* ya estaba detenido */
    }
    callbacks.current.onNotice(message);
  };

  useSpeechRecognitionEvent("start", () => {
    running.current = true;
  });

  useSpeechRecognitionEvent("result", (event) => {
    if (!active.current) return;
    const text = event.results[0]?.transcript?.trim() ?? "";
    if (event.isFinal) {
      if (text) committed.current = [committed.current, text].filter(Boolean).join(" ");
      interim.current = "";
    } else {
      interim.current = text;
    }
    setTranscript(compose());
  });

  useSpeechRecognitionEvent("error", (event) => {
    if (!active.current) return;
    lastError.current = event.error;
    const fatal = FATAL_MESSAGES[event.error];
    if (fatal) fail(fatal);
    // Los demás (no-speech, speech-timeout, network, busy...) van seguidos de "end".
  });

  useSpeechRecognitionEvent("end", () => {
    running.current = false;
    if (!active.current) return;

    // Si quedó un parcial sin finalizar, se conserva para no perder palabras.
    if (interim.current) {
      committed.current = [committed.current, interim.current].filter(Boolean).join(" ");
      interim.current = "";
      setTranscript(compose());
    }

    if (holding.current) {
      // El reconocedor se cortó solo (silencio) pero el usuario sigue hablando.
      if (restarts.current >= MAX_RESTARTS) return finish();
      restarts.current += 1;
      setTimeout(() => {
        if (!active.current || !holding.current) return;
        try {
          begin();
        } catch {
          finish();
        }
      }, RESTART_DELAY_MS);
      return;
    }
    finish();
  });

  const startHold = useCallback(async () => {
    if (active.current || holding.current) return;
    holding.current = true; // si suelta mientras se pide el permiso, se cancela

    try {
      if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
        holding.current = false;
        callbacks.current.onNotice("Este dispositivo no tiene reconocimiento de voz disponible.");
        return;
      }
      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!permission.granted) {
        holding.current = false;
        callbacks.current.onNotice(
          permission.canAskAgain
            ? "Necesito permiso para usar el micrófono y dictar."
            : "El permiso del micrófono está desactivado. Actívalo en los ajustes del sistema."
        );
        return;
      }
    } catch {
      holding.current = false;
      callbacks.current.onNotice("No se pudo iniciar el micrófono.");
      return;
    }

    if (!holding.current) {
      // Soltó el botón durante el diálogo de permiso (primera vez).
      callbacks.current.onNotice("Listo. Ahora mantén presionado el micrófono para hablar.");
      return;
    }

    active.current = true;
    committed.current = "";
    interim.current = "";
    restarts.current = 0;
    lastError.current = null;
    setTranscript("");
    setListening(true);
    try {
      begin();
    } catch {
      fail("No se pudo iniciar el reconocimiento de voz.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const releaseHold = useCallback(() => {
    holding.current = false;
    if (!active.current) return;
    setListening(false);

    // Entre dos reinicios no hay reconocedor activo: no habrá "end", se cierra ya.
    if (!running.current) return finish();

    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {
      return finish();
    }
    clearStopTimer();
    stopTimer.current = setTimeout(finish, STOP_TIMEOUT_MS);
  }, [finish]);

  /** Descarta lo dictado: corta el micrófono sin entregar el texto. */
  const cancelHold = useCallback(() => {
    const wasActive = active.current;
    reset();
    if (!wasActive) return;
    try {
      ExpoSpeechRecognitionModule.abort();
    } catch {
      /* ya estaba detenido */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Si la pantalla se cierra a mitad del dictado, se corta el micrófono.
  useEffect(() => {
    return () => {
      clearStopTimer();
      if (active.current) {
        active.current = false;
        holding.current = false;
        try {
          ExpoSpeechRecognitionModule.abort();
        } catch {
          /* nada que hacer */
        }
      }
    };
  }, []);

  return { listening, transcript, startHold, releaseHold, cancelHold };
}
