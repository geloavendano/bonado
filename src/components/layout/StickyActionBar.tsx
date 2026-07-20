import type { ReactNode } from "react";
import clsx from "clsx";

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
  // Floating above the keyboard the bar must not paint a background — the
  // opaque band covered the content directly above the button.
  const floating = bottomOffset > 0;
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
