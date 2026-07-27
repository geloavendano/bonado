import { useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";

export function NativeActionButton({
  label,
  disabled = false,
  bottomOffset = 0,
  onClick,
}: {
  label: string;
  disabled?: boolean;
  bottomOffset?: number;
  onClick: () => void;
}) {
  const nativeEnabled = Capacitor.getPlatform() === "ios";
  const id = useRef(`action-button-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    if (!nativeEnabled) return;

    window.webkit?.messageHandlers?.bonadoNativeActionButton?.postMessage({
      type: "actionButton:update",
      id: id.current,
      visible: true,
      label,
      disabled,
      bottomOffset,
    });
  }, [bottomOffset, disabled, label, nativeEnabled]);

  useEffect(() => {
    if (!nativeEnabled) return;
    return () => {
      window.webkit?.messageHandlers?.bonadoNativeActionButton?.postMessage({
        type: "actionButton:update",
        id: id.current,
        visible: false,
      });
    };
  }, [nativeEnabled]);

  useEffect(() => {
    if (!nativeEnabled) return;

    function onNativeAction(event: Event) {
      const detail = (event as CustomEvent).detail as { id?: string } | undefined;
      if (detail?.id === id.current && !disabled) onClick();
    }

    window.addEventListener("bonado:native-action-button", onNativeAction);
    return () =>
      window.removeEventListener("bonado:native-action-button", onNativeAction);
  }, [disabled, nativeEnabled, onClick]);

  return null;
}
