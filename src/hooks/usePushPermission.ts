import { useCallback, useEffect, useMemo, useState } from "react";
import {
  checkPushPermission,
  enablePushNotifications,
  hasSavedPushToken,
  openNativeNotificationSettings,
  supportsNativePush,
  type PushPermissionState,
} from "@/lib/pushRegistration";

export function usePushPermission(userId?: string) {
  const supported = supportsNativePush();
  const [permission, setPermission] =
    useState<PushPermissionState>("unsupported");
  const [loading, setLoading] = useState(supported);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenSaved, setTokenSaved] = useState(false);

  const refresh = useCallback(async () => {
    if (!supported) {
      setPermission("unsupported");
      setTokenSaved(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const nextPermission = await checkPushPermission();
      setPermission(nextPermission);
      setTokenSaved(
        nextPermission === "granted" && userId
          ? await hasSavedPushToken(userId)
          : false,
      );
      setError(null);
    } catch (err) {
      console.warn("Could not check push permission", err);
      setError("Could not check notification permission.");
    } finally {
      setLoading(false);
    }
  }, [supported, userId]);

  useEffect(() => {
    void refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener("bonado:push-permission-changed", refresh);
    window.addEventListener("bonado:push-token-saved", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("bonado:push-permission-changed", refresh);
      window.removeEventListener("bonado:push-token-saved", refresh);
    };
  }, [refresh]);

  const label = useMemo(() => {
    if (permission === "granted" && tokenSaved) return "Push notifications enabled";
    if (permission === "granted") return "Finish Push Setup";
    if (permission === "denied") return "Open iOS Settings";
    return "Enable Push Notifications";
  }, [permission, tokenSaved]);

  const description = useMemo(() => {
    if (permission === "granted" && tokenSaved) {
      return "You’ll receive updates for transactions and settlements involving you.";
    }
    if (permission === "granted") {
      return "Notifications are allowed. Tap to finish registering this device.";
    }
    if (permission === "denied") {
      return "Notifications are blocked. Open iOS Settings to allow Bonado notifications.";
    }
    return "Turn this on to get alerts for new or edited trip activity involving you.";
  }, [permission, tokenSaved]);

  const enable = useCallback(async () => {
    if (!supported || !userId || (permission === "granted" && tokenSaved)) return;
    if (permission === "denied") {
      openNativeNotificationSettings();
      return;
    }
    setWorking(true);
    try {
      setPermission(await enablePushNotifications(userId));
      setError(null);
    } catch (err) {
      console.warn("Could not enable push notifications", err);
      setError("Could not enable push notifications.");
    } finally {
      setWorking(false);
    }
  }, [permission, supported, tokenSaved, userId]);

  return {
    supported,
    permission,
    enabled: permission === "granted" && tokenSaved,
    loading,
    working,
    error,
    label,
    description,
    enable,
    refresh,
  };
}
