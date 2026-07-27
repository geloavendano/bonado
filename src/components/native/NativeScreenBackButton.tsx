import { useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";

export function NativeScreenBackButton({ onBack }: { onBack: () => void }) {
  const nativeEnabled = Capacitor.getPlatform() === "ios";
  const id = useRef(`screen-back-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    if (!nativeEnabled) return;
    window.webkit?.messageHandlers?.bonadoNativeScreenBack?.postMessage({
      type: "screenBack:update",
      id: id.current,
      visible: true,
    });
  }, [nativeEnabled]);

  useEffect(() => {
    if (!nativeEnabled) return;
    return () => {
      window.webkit?.messageHandlers?.bonadoNativeScreenBack?.postMessage({
        type: "screenBack:update",
        id: id.current,
        visible: false,
      });
    };
  }, [nativeEnabled]);

  useEffect(() => {
    if (!nativeEnabled) return;

    function onNativeBack(event: Event) {
      const detail = (event as CustomEvent).detail as { id?: string } | undefined;
      if (detail?.id === id.current) onBack();
    }

    window.addEventListener("bonado:native-screen-back", onNativeBack);
    return () =>
      window.removeEventListener("bonado:native-screen-back", onNativeBack);
  }, [nativeEnabled, onBack]);

  return null;
}
