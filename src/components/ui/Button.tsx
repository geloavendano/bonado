import clsx from "clsx";
import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "outline" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  fullWidth?: boolean;
}

export const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-pill font-bold text-[15.5px] px-6 py-[15px] disabled:opacity-50 disabled:pointer-events-none active:opacity-90";

export const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-teal text-white shadow-primary",
  outline: "bg-card text-teal border-[1.5px] border-teal",
  ghost: "bg-card text-secondary shadow-card",
};

export function buttonClasses(
  variant: ButtonVariant = "primary",
  fullWidth?: boolean,
  className?: string,
) {
  return clsx(buttonBase, buttonVariants[variant], fullWidth && "w-full", className);
}

export function Button({
  variant = "primary",
  fullWidth,
  className,
  ...props
}: ButtonProps) {
  return <button className={buttonClasses(variant, fullWidth, className)} {...props} />;
}
