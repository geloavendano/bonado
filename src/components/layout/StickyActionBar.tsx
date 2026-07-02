import type { ReactNode } from "react";

/** Pins a screen's primary CTA to the bottom of the viewport, matching TripNav's floating pattern. */
export function StickyActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-10 bg-bg">
      <div
        className="mx-auto max-w-[430px] px-6 pt-3"
        style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
      >
        {children}
      </div>
    </div>
  );
}
