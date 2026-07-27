export type ToastTone = "success" | "info";

export function Toast({
  message,
  tone = "success",
}: {
  message: string | null;
  /** "info" drops the ✓, which would misread a hint or a blocked action as a confirmation. */
  tone?: ToastTone;
}) {
  if (!message) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-24 z-40 flex justify-center px-6"
    >
      <div className="motion-reveal rounded-pill bg-ink px-4 py-3 text-[13px] font-bold text-bg shadow-[var(--shadow-floating)]">
        {tone === "success" && <span className="mr-2 text-mint">✓</span>}
        {message}
      </div>
    </div>
  );
}
