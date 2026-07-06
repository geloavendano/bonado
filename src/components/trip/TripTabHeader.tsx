import { Link } from "react-router-dom";
import { NotificationBell } from "@/components/notifications/NotificationBell";

/**
 * Shared trip header for all three tabs (Entries/Balances/Reports) — same
 * back button, bell, and settings gear in the same position and size
 * everywhere, on mobile and desktop. Also carries the `trip-top-nav` class
 * the view-transition machinery (tripPaneTransition.ts) relies on to keep
 * this chrome from animating during tab switches.
 */
export function TripTabHeader({
  tripId,
  title,
  subtitle,
}: {
  tripId: string;
  title: string;
  subtitle?: string | null;
}) {
  return (
    <div className="trip-top-nav sticky top-0 z-20 flex min-h-[calc(56px+env(safe-area-inset-top))] items-center gap-3 border-b border-hairline bg-bg/95 px-6 pt-[env(safe-area-inset-top)] backdrop-blur-md">
      <Link
        to="/"
        replace
        aria-label="Back to dashboard"
        className="grid size-9 flex-none place-items-center rounded-full bg-card text-[15px] text-secondary shadow-[var(--shadow-card)]"
      >
        ←
      </Link>
      <div className="min-w-0 flex-1 text-center">
        <div className="truncate text-[16px] font-bold">{title}</div>
        {subtitle && (
          <div className="truncate text-[11.5px] font-semibold text-secondary">
            {subtitle}
          </div>
        )}
      </div>
      <div className="flex flex-none items-center gap-2">
        <NotificationBell />
        <Link
          to={`/trips/${tripId}/settings`}
          aria-label="Trip settings"
          className="grid size-9 place-items-center rounded-full bg-card text-secondary shadow-[var(--shadow-card)]"
        >
          ⚙︎
        </Link>
      </div>
    </div>
  );
}
