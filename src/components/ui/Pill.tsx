import clsx from "clsx";
import type { HTMLAttributes } from "react";

interface PillProps extends HTMLAttributes<HTMLDivElement> {
  tone?: "teal" | "neutral" | "danger";
}

const tones: Record<NonNullable<PillProps["tone"]>, string> = {
  teal: "bg-teal-tint text-teal-dark",
  neutral: "bg-card text-secondary shadow-[var(--shadow-card)]",
  danger: "bg-owe-tint text-owe-dark",
};

export function Pill({ tone = "neutral", className, ...props }: PillProps) {
  return (
    <div
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-pill px-3.5 py-2 text-[13px] font-bold",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
