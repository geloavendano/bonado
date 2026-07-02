import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

const FIELD_SELECTOR = [
  "input:not([type='hidden']):not([type='file']):not([disabled]):not([readonly])",
  "textarea:not([disabled]):not([readonly])",
  "select:not([disabled])",
].join(",");

function opensKeyboard(element: HTMLElement) {
  if (element instanceof HTMLTextAreaElement) return true;
  if (!(element instanceof HTMLInputElement)) return false;
  return ["", "text", "number", "email", "tel", "search", "url", "password"].includes(
    element.type,
  );
}

export function useMobileFormFlow(containerRef: RefObject<HTMLElement | null>) {
  const baselineHeight = useRef(0);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const [viewport, setViewport] = useState({ top: 0, height: 0 });

  useEffect(() => {
    const visualViewport = window.visualViewport;

    function measure() {
      const height = visualViewport?.height ?? window.innerHeight;
      const top = visualViewport?.offsetTop ?? 0;
      baselineHeight.current = Math.max(
        baselineHeight.current,
        window.innerHeight,
        document.documentElement.clientHeight,
        height + top,
      );
      const obscured = Math.max(0, baselineHeight.current - height - top);
      setKeyboardOffset(obscured > 120 ? obscured : 0);
      setViewport({ top, height });
    }

    measure();
    visualViewport?.addEventListener("resize", measure);
    visualViewport?.addEventListener("scroll", measure);
    window.addEventListener("resize", measure);
    return () => {
      visualViewport?.removeEventListener("resize", measure);
      visualViewport?.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, []);

  const advance = useCallback(() => {
    const root = containerRef.current;
    const active = document.activeElement as HTMLElement | null;
    if (!root || !active) return;

    const fields = Array.from(root.querySelectorAll<HTMLElement>(FIELD_SELECTOR)).filter(
      (field) =>
        field.getAttribute("aria-hidden") !== "true" &&
        field.offsetParent !== null &&
        !field.closest("[data-form-skip]"),
    );
    const next = fields[fields.indexOf(active) + 1];

    if (next && opensKeyboard(next)) {
      next.focus({ preventScroll: true });
      next.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      active.blur();
    }
  }, [containerRef]);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      if (
        event.key === "Enter" &&
        !event.shiftKey &&
        event.target instanceof HTMLElement &&
        opensKeyboard(event.target)
      ) {
        event.preventDefault();
        advance();
      }
    },
    [advance],
  );

  const onFocus = useCallback((event: React.FocusEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (!opensKeyboard(target)) return;
    window.setTimeout(
      () => target.scrollIntoView({ behavior: "smooth", block: "center" }),
      180,
    );
  }, []);

  return {
    advance,
    keyboardOpen: keyboardOffset > 0,
    keyboardOffset,
    viewport,
    formProps: { onKeyDown, onFocus },
  };
}
