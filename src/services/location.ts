import * as Location from "expo-location";

export type ApproxLocation =
  | { status: "ok"; lat: number; lon: number }
  | { status: "unavailable" };

const UNAVAILABLE: ApproxLocation = { status: "unavailable" };
/** Una posición de hace menos de 30 min alcanza para el clima y evita encender el GPS. */
const MAX_AGE_MS = 30 * 60 * 1000;
const FIX_TIMEOUT_MS = 12_000;

/** ~1 km: suficiente para el clima. El servidor vuelve a redondear por su cuenta. */
const round2 = (n: number) => Math.round(n * 100) / 100;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}

/**
 * Ubicación APROXIMADA del teléfono, solo en primer plano y solo cuando el asistente la pide para
 * consultar el clima. El permiso se pregunta la primera vez que hace falta (no al abrir la app).
 * Nunca se guarda ni se pide en segundo plano. Si falla por cualquier motivo (permiso denegado,
 * ubicación apagada, sin señal) devuelve "unavailable" y el asistente pregunta la ciudad.
 */
export async function getApproxLocation(): Promise<ApproxLocation> {
  try {
    let permission = await Location.getForegroundPermissionsAsync();
    if (!permission.granted) {
      if (!permission.canAskAgain) return UNAVAILABLE;
      permission = await Location.requestForegroundPermissionsAsync();
    }
    if (!permission.granted) return UNAVAILABLE;
    if (!(await Location.hasServicesEnabledAsync())) return UNAVAILABLE;

    const position =
      (await Location.getLastKnownPositionAsync({ maxAge: MAX_AGE_MS })) ??
      (await withTimeout(
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }),
        FIX_TIMEOUT_MS
      ));
    return {
      status: "ok",
      lat: round2(position.coords.latitude),
      lon: round2(position.coords.longitude),
    };
  } catch {
    return UNAVAILABLE;
  }
}
