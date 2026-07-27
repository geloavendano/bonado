import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { NotificationBell } from "@/components/notifications/NotificationBell";

type NativeTopControlsTone = "photo" | "surface";

export function NativeTopControls({
  visible = true,
  backTo = "/",
  settingsTo,
  tone = "surface",
}: {
  visible?: boolean;
  backTo?: string;
  settingsTo: string;
  tone?: NativeTopControlsTone;
}) {
  const navigate = useNavigate();
  const nativeEnabled = Capacitor.getPlatform() === "ios";
  const [blockedByOverlay, setBlockedByOverlay] = useState(false);
  const instanceId = useRef(
    `top-controls-${Math.random().toString(36).slice(2)}`,
  );

  useEffect(() => {
    if (!nativeEnabled) return;

    window.webkit?.messageHandlers?.bonadoNativeTopControls?.postMessage({
      type: "topControls:update",
      id: instanceId.current,
      visible: visible && !blockedByOverlay,
      tone,
    });
  }, [blockedByOverlay, nativeEnabled, tone, visible]);

  useEffect(() => {
    if (!nativeEnabled) return;

    return () => {
      window.webkit?.messageHandlers?.bonadoNativeTopControls?.postMessage({
        type: "topControls:update",
        id: instanceId.current,
        visible: false,
      });
    };
  }, [nativeEnabled]);

  useEffect(() => {
    if (!nativeEnabled) return;

    function updateOverlayBlock() {
      setBlockedByOverlay(
        Boolean(
          document.querySelector(
            '[aria-modal="true"], [data-native-nav-hidden="true"]',
          ),
        ),
      );
    }

    updateOverlayBlock();
    const observer = new MutationObserver(updateOverlayBlock);
    observer.observe(document.body, {
      attributes: true,
      childList: true,
      subtree: true,
      attributeFilter: ["aria-modal", "data-native-nav-hidden"],
    });

    return () => observer.disconnect();
  }, [nativeEnabled]);

  useEffect(() => {
    if (!nativeEnabled) return;

    function onNativeTopControls(event: Event) {
      const detail = (event as CustomEvent).detail as { action?: string } | undefined;

      if (detail?.action === "back") {
        navigate(backTo, { replace: true });
      }

      if (detail?.action === "notifications") {
        window.dispatchEvent(new CustomEvent("bonado:toggle-notifications"));
      }

      if (detail?.action === "settings") {
        navigate(settingsTo);
      }
    }

    window.addEventListener("bonado:native-top-controls", onNativeTopControls);
    return () =>
      window.removeEventListener("bonado:native-top-controls", onNativeTopControls);
  }, [backTo, nativeEnabled, navigate, settingsTo]);

  if (!nativeEnabled) return null;

  return <NotificationBell buttonClassName="hidden" nativeOpenTarget />;
}
