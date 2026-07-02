import clsx from "clsx";
import type { HTMLAttributes } from "react";

/**
 * Mobile-first content column. Fluid on phone widths, capped and centered
 * on wider viewports so the app still reads as a phone screen on desktop
 * until the dedicated desktop layout (design 4i) lands in a later phase.
 */
export function PageShell({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className="min-h-dvh bg-bg">
      <div
        className={clsx("mx-auto max-w-[430px] px-6 pb-10", className)}
        {...props}
      />
    </div>
  );
}
