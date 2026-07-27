import {
  isValidElement,
  useEffect,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import clsx from "clsx";
import { Capacitor } from "@capacitor/core";
import { NativeActionButton } from "@/components/native/NativeActionButton";

function textFromNode(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textFromNode).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) {
    return textFromNode(node.props.children);
  }
  return "";
}

/** Pins a screen's primary CTA to the bottom of the viewport, matching TripNav's floating pattern. */
export function StickyActionBar({
  children,
  fade = false,
  bottomOffset = 0,
}: {
  children: ReactNode;
  fade?: boolean;
  bottomOffset?: number;
}) {
  const navigate = useNavigate();
  const nativeEnabled = Capacitor.getPlatform() === "ios";
  const [blockedByOverlay, setBlockedByOverlay] = useState(false);
  // Floating above the keyboard the bar must not paint a background — the
  // opaque band covered the content directly above the button.
  const floating = bottomOffset > 0;

  useEffect(() => {
    if (!nativeEnabled || typeof document === "undefined") return;

    const overlaySelector =
      '[aria-modal="true"], [data-native-nav-hidden="true"]';
    const update = () => {
      setBlockedByOverlay(Boolean(document.querySelector(overlaySelector)));
    };

    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, {
      attributes: true,
      childList: true,
      subtree: true,
    });
    return () => observer.disconnect();
  }, [nativeEnabled]);

  if (nativeEnabled && isValidElement(children)) {
    const action = children as ReactElement<{
      children?: ReactNode;
      disabled?: boolean;
      onClick?: (event?: unknown) => void;
      to?: string;
      state?: unknown;
      replace?: boolean;
    }>;
    const label = textFromNode(action.props.children).trim();
    const disabled = Boolean(action.props.disabled);
    const keyboardNext = floating && /^next\b/i.test(label);

    if (label && (blockedByOverlay || keyboardNext)) {
      return null;
    }

    if (label) {
      return (
        <NativeActionButton
          label={label}
          disabled={disabled}
          bottomOffset={bottomOffset}
          onClick={() => {
            if (disabled) return;
            if (action.props.onClick) {
              action.props.onClick();
              return;
            }
            if (typeof action.props.to === "string") {
              navigate(action.props.to, {
                replace: action.props.replace,
                state: action.props.state,
              });
            }
          }}
        />
      );
    }
  }

  return (
    <div
      className={clsx(
        "motion-dock fixed inset-x-0 z-10 transition-[bottom] duration-200",
        floating
          ? "bg-transparent"
          : fade
            ? "bg-gradient-to-b from-transparent via-bg/90 to-bg"
            : "bg-bg",
      )}
      style={{ bottom: bottomOffset }}
    >
      <div
        className={clsx(
          "mx-auto w-full max-w-[430px] px-6 landscape:max-w-[min(720px,calc(100vw-48px))] landscape:px-0",
          floating ? "pt-0" : fade ? "pt-8" : "pt-3",
        )}
        style={{
          paddingBottom: floating ? 10 : "max(16px, env(safe-area-inset-bottom))",
        }}
      >
        {children}
      </div>
    </div>
  );
}
