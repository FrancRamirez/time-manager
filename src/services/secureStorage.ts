import * as SecureStore from "expo-secure-store";
import type { User } from "@/types";

const ACCESS_TOKEN_KEY = "tm_access_token";
const REFRESH_TOKEN_KEY = "tm_refresh_token";
const USER_KEY = "tm_user";
const LAST_USER_ID_KEY = "tm_last_user_id";

/**
 * SecureStore usa Android Keystore por debajo: los valores quedan
 * cifrados en EncryptedSharedPreferences, nunca en texto plano.
 */
export async function saveTokens(accessToken: string, refreshToken: string) {
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken),
    SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken),
  ]);
}

/** Guarda solo el accessToken (lo usa la renovación de sesión; el refreshToken no cambia). */
export function saveAccessToken(accessToken: string) {
  return SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
}

export function getAccessToken() {
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

export function getRefreshToken() {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

/** Copia local del usuario: permite abrir la app al instante y también sin internet. */
export function saveCachedUser(user: User) {
  return SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
}

export async function getCachedUser(): Promise<User | null> {
  const raw = await SecureStore.getItemAsync(USER_KEY);
  if (!raw) return null;
  try {
    const user = JSON.parse(raw) as User;
    return user && typeof user.id === "string" ? user : null;
  } catch {
    return null;
  }
}

/** Id de la última cuenta que inició sesión (para no mezclar el historial entre cuentas). */
export function getLastUserId() {
  return SecureStore.getItemAsync(LAST_USER_ID_KEY);
}

export function setLastUserId(id: string) {
  return SecureStore.setItemAsync(LAST_USER_ID_KEY, id);
}

export async function clearTokens() {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
    SecureStore.deleteItemAsync(USER_KEY),
  ]);
}
