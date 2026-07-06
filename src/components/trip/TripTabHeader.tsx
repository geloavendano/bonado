import { Link } from "react-router-dom";
import { NotificationBell } from "@/components/notifications/NotificationBell";

export function TripTabHeader({
  title,
}: {
  tripId: string;
  title: string;
}) {
  return (
    <div className="trip-top-nav sticky top-0 z-20 -mx-6 flex min-h-[calc(56px+env(safe-area-inset-top))] items-center border-b border-hairline bg-bg/95 px-6 pt-[env(safe-area-inset-top)] backdrop-blur-md">
      <Link
        to="/"
        replace
        aria-label="Back to dashboard"
        className="grid size-9 flex-none place-items-center rounded-full bg-card text-[15px] text-secondary shadow-[var(--shadow-card)]"
      >
        ←
      </Link>
      <div className="min-w-0 flex-1 truncate px-3 text-center text-[16px] font-bold">
        {title}
      </div>
      <div className="flex size-9 flex-none justify-end">
        <NotificationBell />
      </div>
    </div>
  );
}
