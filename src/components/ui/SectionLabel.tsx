import clsx from "clsx";
import type { HTMLAttributes } from "react";

export function SectionLabel({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        "text-xs font-bold uppercase tracking-[0.09em] text-secondary",
        className,
      )}
      {...props}
    />
  );
}
