import clsx from "clsx";
import type { HTMLAttributes } from "react";

interface PageShellProps extends HTMLAttributes<HTMLDivElement> {
  /** Set false for screens with a full-bleed cover photo; add px-6 manually where needed. */
  padded?: boolean;
}

/**
 * Mobile-first content column. Fluid on phone widths, capped and centered
 * on wider viewports so the app still reads as a phone screen on desktop
 * until the dedicated desktop layout (design 4i) lands in a later phase.
 */
export function PageShell({ className, padded = true, ...props }: PageShellProps) {
  return (
    <div className="min-h-dvh bg-bg">
      <div
        className={clsx("motion-page mx-auto max-w-[430px] pb-10", padded && "px-6", className)}
        {...props}
      />
    </div>
  );
}
