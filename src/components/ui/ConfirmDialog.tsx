interface ConfirmDialogProps {
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  children?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Centered modal, not an inline button swap — a destructive action's confirm
 * button must never land where the user's finger already is, or a reflexive
 * second tap (e.g. a mis-registered first tap) fires it immediately.
 */
export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  destructive,
  busy,
  children,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const close = useCallback(onCancel, [onCancel]);
  const dialogRef = useOverlayA11y<HTMLDivElement>(true, close);
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-6"
      onClick={onCancel}
      role="presentation"
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="motion-reveal w-full max-w-[340px] rounded-[22px] bg-card p-5 shadow-[var(--shadow-floating)]"
        onClick={(event) => event.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="text-[16px] font-extrabold">{title}</div>
        {description && (
          <p className="mt-1.5 text-[13px] text-secondary">{description}</p>
        )}
        {children}
        <div className="mt-5 flex flex-col gap-2">
          <button
            onClick={onConfirm}
            disabled={busy}
            className={
              "w-full rounded-pill py-3 text-[14px] font-bold disabled:opacity-50 " +
              (destructive ? "bg-owe text-white" : "bg-teal text-white")
            }
          >
            {confirmLabel}
          </button>
          <button
            onClick={onCancel}
            disabled={busy}
            className="w-full rounded-pill py-3 text-[14px] font-bold text-secondary disabled:opacity-50"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
import { useCallback, type ReactNode } from "react";
import { useOverlayA11y } from "@/hooks/useOverlayA11y";
