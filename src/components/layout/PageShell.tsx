import clsx from "clsx";
import type { HTMLAttributes } from "react";

interface PageShellProps extends HTMLAttributes<HTMLDivElement> {
  /** Set false for screens with a full-bleed cover photo; add px-6 manually where needed. */
  padded?: boolean;
  /** Drops the phone-width cap at desktop sizes, for pages nested in the trip 3-column desktop shell. */
  wide?: boolean;
}

/**
 * Mobile-first content column. Fluid on phone widths, capped and centered
 * on wider viewports so the app reads as a phone screen on desktop, unless
 * `wide` opts into filling the center column of the desktop trip shell
 * (see TripLayout).
 */
export function PageShell({ className, padded = true, wide = false, ...props }: PageShellProps) {
  return (
    <div className="min-h-dvh bg-bg">
      <div
        className={clsx(
          "motion-page mx-auto max-w-[430px] pb-10",
          wide && "lg:max-w-none",
          padded && "px-6",
          className,
        )}
        {...props}
      />
    </div>
  );
}
