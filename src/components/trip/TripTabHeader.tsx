import { Link } from "react-router-dom";

export function TripTabHeader({
  tripId,
  title,
}: {
  tripId: string;
  title: string;
}) {
  return (
    <div className="sticky top-0 z-20 -mx-6 flex h-14 items-center border-b border-black/5 bg-bg/95 px-6 backdrop-blur-md">
      <Link
        to={`/trips/${tripId}`}
        aria-label="Back to entries"
        className="grid size-9 flex-none place-items-center rounded-full bg-card text-[15px] text-secondary shadow-card"
      >
        ←
      </Link>
      <div className="min-w-0 flex-1 truncate px-3 text-center text-[16px] font-bold">
        {title}
      </div>
      <div className="size-9 flex-none" />
    </div>
  );
}
