import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";

interface ScreenHeaderProps {
  title: string;
  onBack?: () => void;
  right?: ReactNode;
}

export function BackButton({ onClick }: { onClick?: () => void }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={onClick ?? (() => navigate(-1))}
      className="w-9 h-9 rounded-full bg-card shadow-[var(--shadow-card)] flex items-center justify-center text-secondary text-[15px] flex-none"
      aria-label="Back"
    >
      ←
    </button>
  );
}

export function ScreenHeader({ title, onBack, right }: ScreenHeaderProps) {
  return (
    <div className="flex items-center justify-between pt-[max(16px,env(safe-area-inset-top))] pb-2">
      <BackButton onClick={onBack} />
      <div className="text-[16px] font-bold">{title}</div>
      <div className="w-9 flex justify-end">{right}</div>
    </div>
  );
}
