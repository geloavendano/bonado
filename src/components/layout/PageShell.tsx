import clsx from "clsx";
import type { HTMLAttributes } from "react";

interface PageShellProps extends HTMLAttributes<HTMLDivElement> {
  /** Set false for screens with a full-bleed cover photo; add px-6 manually where needed. */
  padded?: boolean;
  /** Fills the available trip column; standalone pages keep a readable maximum width. */
  wide?: boolean;
}

/**
 * Fluid content column: use the available phone/tablet width, with a readable
 * maximum for standalone forms. Trip tabs fill their desktop center column.
 */
export function PageShell({ className, padded = true, wide = false, ...props }: PageShellProps) {
  return (
    <div className="min-h-dvh bg-bg">
      <div
        className={clsx(
          "motion-page mx-auto w-full min-w-0 pb-10",
          wide ? "max-w-none" : "max-w-[960px]",
          padded && "px-6",
          className,
        )}
        {...props}
      />
    </div>
  );
}
