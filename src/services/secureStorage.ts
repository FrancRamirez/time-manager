import * as SecureStore from "expo-secure-store";

const ACCESS_TOKEN_KEY = "tm_access_token";
const REFRESH_TOKEN_KEY = "tm_refresh_token";

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

export function getAccessToken() {
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

export function getRefreshToken() {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function clearTokens() {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
  ]);
}
