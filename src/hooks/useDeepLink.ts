import { useEffect } from "react";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";

/**
 * Soporta enlaces del tipo timemanager://reschedule/<eventId>
 * disparados desde una notificación o desde un link externo.
 */
export function useDeepLink() {
  const router = useRouter();

  useEffect(() => {
    function handleUrl(url: string) {
      const { hostname, path } = Linking.parse(url);
      if (hostname === "reschedule" && path) {
        router.push({ pathname: "/(tabs)/agenda", params: { eventId: path } });
      }
    }

    const subscription = Linking.addEventListener("url", ({ url }) =>
      handleUrl(url)
    );

    Linking.getInitialURL().then((url) => {
      if (url) handleUrl(url);
    });

    return () => subscription.remove();
  }, [router]);
}
