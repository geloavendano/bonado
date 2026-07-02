import type { ReactNode } from "react";
import clsx from "clsx";

/** Pins a screen's primary CTA to the bottom of the viewport, matching TripNav's floating pattern. */
export function StickyActionBar({
  children,
  fade = false,
}: {
  children: ReactNode;
  fade?: boolean;
}) {
  return (
    <div
      className={clsx(
        "motion-dock fixed inset-x-0 bottom-0 z-10",
        fade
          ? "bg-gradient-to-b from-transparent via-bg/90 to-bg"
          : "bg-bg",
      )}
    >
      <div
        className={clsx("mx-auto max-w-[430px] px-6", fade ? "pt-8" : "pt-3")}
        style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
      >
        {children}
      </div>
    </div>
  );
}
