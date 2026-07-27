import { useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";

export function NativeDashboardControls({
  avatarUrl,
  name,
}: {
  avatarUrl?: string | null;
  name?: string | null;
}) {
  const nativeEnabled = Capacitor.getPlatform() === "ios";
  const id = useRef(`dashboard-controls-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    if (!nativeEnabled) return;
    window.webkit?.messageHandlers?.bonadoNativeDashboardControls?.postMessage({
      type: "dashboardControls:update",
      id: id.current,
      visible: true,
      avatarUrl,
      name,
    });
  }, [avatarUrl, name, nativeEnabled]);

  useEffect(() => {
    if (!nativeEnabled) return;
    return () => {
      window.webkit?.messageHandlers?.bonadoNativeDashboardControls?.postMessage({
        type: "dashboardControls:update",
        id: id.current,
        visible: false,
      });
    };
  }, [nativeEnabled]);

  useEffect(() => {
    if (!nativeEnabled) return;

    function onNativeControls(event: Event) {
      const detail = (event as CustomEvent).detail as
        | { action?: string; id?: string }
        | undefined;
      if (detail?.id !== id.current) return;
      if (detail.action === "notifications") {
        window.dispatchEvent(new CustomEvent("bonado:toggle-notifications"));
      }
      if (detail.action === "account") {
        window.dispatchEvent(new CustomEvent("bonado:toggle-account-menu"));
      }
    }

    window.addEventListener("bonado:native-dashboard-controls", onNativeControls);
    return () =>
      window.removeEventListener(
        "bonado:native-dashboard-controls",
        onNativeControls,
      );
  }, [nativeEnabled]);

  return null;
}
