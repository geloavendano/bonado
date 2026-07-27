import clsx from "clsx";

/**
 * Crossed strokes rather than a "×" character: the multiplication glyph sits on
 * the font's math axis, not the optical centre of its line box, so it reads as
 * hanging low inside a round button no matter how the box is centred.
 */
export function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={clsx("size-[10px]", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 5 19 19M19 5 5 19" />
    </svg>
  );
}
