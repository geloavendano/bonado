import clsx from "clsx";
import type { InputHTMLAttributes } from "react";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={clsx(
        "bg-card rounded-input px-4 py-[14px] text-[15px] font-semibold text-ink shadow-card placeholder:text-faint placeholder:font-normal outline-none focus:ring-2 focus:ring-teal/40",
        className,
      )}
      {...props}
    />
  );
}
