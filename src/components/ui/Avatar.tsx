import clsx from "clsx";
import type { CSSProperties } from "react";
import { avatarColorClass, initial } from "@/lib/avatar";

interface AvatarProps {
  name: string;
  /** Stable identifier (e.g. user id) used to pick the palette color; falls back to name. */
  seed?: string;
  avatarUrl?: string | null;
  size?: number;
  ring?: "none" | "white" | "teal";
  className?: string;
  style?: CSSProperties;
}

export function Avatar({
  name,
  seed,
  avatarUrl,
  size = 32,
  ring = "none",
  className,
  style,
}: AvatarProps) {
  const ringClass =
    ring === "white"
      ? "border-2 border-card"
      : ring === "teal"
        ? "border-2 border-teal"
        : "border-0";

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={clsx("rounded-full object-cover flex-none", ringClass, className)}
        style={{ width: size, height: size, ...style }}
      />
    );
  }

  return (
    <div
      className={clsx(
        "rounded-full flex items-center justify-center flex-none font-bold text-white",
        avatarColorClass(seed ?? name),
        ringClass,
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.36), ...style }}
    >
      {initial(name)}
    </div>
  );
}
