import { useEffect, useState } from "react";
import {
  registerNotificationCategories,
  requestNotificationPermissions,
  registerDeviceForPush,
} from "@/services/notifications";

export function useNotificationPermissions() {
  const [granted, setGranted] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      await registerNotificationCategories();
      const hasPermission = await requestNotificationPermissions();
      if (!mounted) return;
      setGranted(hasPermission);

      if (hasPermission) {
        await registerDeviceForPush();
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  return granted;
}
