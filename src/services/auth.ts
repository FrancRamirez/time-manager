import {
  GoogleSignin,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import { apiFetch } from "@/api/client";
import { saveTokens, clearTokens } from "./secureStorage";
import { clearConversations } from "./conversations";
import type { User } from "@/types";

const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

if (webClientId) {
  GoogleSignin.configure({
    webClientId,
    // Calendar + Gmail. gmail.modify cubre leer, redactar, enviar, archivar y mover a la
    // papelera (no borra definitivamente); reemplaza a gmail.readonly: un solo permiso restringido.
    scopes: [
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/gmail.modify",
    ],
    offlineAccess: true, // necesario para obtener refresh token server-side
    forceCodeForRefreshToken: true, // pide consentimiento de nuevo para que Google reemita el refresh token
  });
} else {
  // Sin webClientId, GoogleSignin.configure() con offlineAccess:true
  // lanza una excepción synchronous al importarse el módulo, lo que
  // rompe toda la app antes de montar. Evitamos eso hasta que
  // EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID esté seteado en el .env.
  console.warn(
    "EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID no está definida. El login con Google va a fallar hasta que la completes."
  );
}

interface BackendAuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export async function signInWithGoogle(): Promise<User> {
  if (!webClientId) {
    throw new Error(
      "Falta configurar EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID en el .env"
    );
  }

  await GoogleSignin.hasPlayServices();
  const { idToken, serverAuthCode } = await GoogleSignin.signIn();

  if (!idToken || !serverAuthCode) {
    throw new Error("Google Sign-In no devolvió los tokens esperados");
  }

  // El backend intercambia el serverAuthCode por tokens de Calendar/Gmail
  // y los guarda cifrados (AES-256-GCM) en TiDB.
  const { user, accessToken, refreshToken } = await apiFetch<BackendAuthResponse>(
    "/api/auth/google",
    {
      method: "POST",
      auth: false,
      body: { idToken, serverAuthCode },
    }
  );

  await saveTokens(accessToken, refreshToken);
  return user;
}

export async function signOut() {
  try {
    await GoogleSignin.signOut();
  } catch {
    // no bloquear el logout local si falla el remoto
  }
  await clearTokens();
  // El historial del asistente puede contener datos de correos y agenda: no queda en el teléfono.
  await clearConversations().catch(() => {});
}

export function isSignInCancelled(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === statusCodes.SIGN_IN_CANCELLED
  );
}
