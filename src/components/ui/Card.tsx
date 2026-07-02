import clsx from "clsx";
import type { HTMLAttributes } from "react";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx("bg-card rounded-[18px] shadow-[var(--shadow-card)]", className)}
      {...props}
    />
  );
}
