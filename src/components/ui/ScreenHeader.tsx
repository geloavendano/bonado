import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import clsx from "clsx";
import { NativeScreenBackButton } from "@/components/native/NativeScreenBackButton";

interface ScreenHeaderProps {
  title: string;
  onBack?: () => void;
  right?: ReactNode;
}

export function BackButton({ onClick }: { onClick?: () => void }) {
  const navigate = useNavigate();
  const nativeEnabled = Capacitor.getPlatform() === "ios";
  const handleBack = onClick ?? (() => navigate(-1));
  return (
    <>
      {nativeEnabled && <NativeScreenBackButton onBack={handleBack} />}
      <button
        onClick={handleBack}
        className={clsx(
          "grid flex-none place-items-center rounded-full bg-card text-[15px] text-secondary shadow-[var(--shadow-card)]",
          nativeEnabled ? "size-11" : "size-9",
          nativeEnabled && "pointer-events-none opacity-0",
        )}
        aria-label="Back"
      >
        ←
      </button>
    </>
  );
}

export function ScreenHeader({ title, onBack, right }: ScreenHeaderProps) {
  const nativeEnabled = Capacitor.getPlatform() === "ios";
  return (
    <div
      className={clsx(
        "flex items-center justify-between pt-[max(16px,env(safe-area-inset-top))]",
        nativeEnabled
          ? "min-h-[calc(76px+env(safe-area-inset-top))] pb-5"
          : "pb-2",
      )}
    >
      <BackButton onClick={onBack} />
      <div className="text-[16px] font-bold">{title}</div>
      <div className={clsx("flex justify-end", nativeEnabled ? "w-11" : "w-9")}>
        {right}
      </div>
    </div>
  );
}
