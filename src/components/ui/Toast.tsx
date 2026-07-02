export function Toast({ message }: { message: string | null }) {
  if (!message) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-24 z-40 flex justify-center px-6"
    >
      <div className="motion-reveal rounded-pill bg-ink px-4 py-3 text-[13px] font-bold text-white shadow-[var(--shadow-floating)]">
        <span className="mr-2 text-mint">✓</span>
        {message}
      </div>
    </div>
  );
}
