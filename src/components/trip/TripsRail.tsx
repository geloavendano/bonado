import { Link } from "react-router-dom";
import clsx from "clsx";
import { useTrips } from "@/hooks/useTrips";

export function TripsRail({ activeTripId }: { activeTripId: string }) {
  const { trips, hasMore, loadingMore, loadMore } = useTrips();

  return (
    <div className="sticky top-0 hidden h-dvh w-[220px] flex-none flex-col gap-1 overflow-y-auto border-r border-hairline px-4 py-6 lg:flex">
      <Link to="/" className="mb-5 px-2 text-[19px] font-extrabold tracking-[-0.4px]">
        bonado<span className="text-teal">.</span>
      </Link>
      <div className="mb-1 px-2 text-[10.5px] font-bold uppercase tracking-[0.09em] text-secondary">
        Trips
      </div>
      {trips.map((trip) => (
        <Link
          key={trip.id}
          to={`/trips/${trip.id}`}
          className={clsx(
            "truncate rounded-xl px-3 py-2.5 text-[13.5px] font-bold transition-colors",
            trip.id === activeTripId
              ? "bg-teal-tint text-teal-dark"
              : "text-secondary hover:bg-tile",
          )}
        >
          {trip.name}
        </Link>
      ))}
      {hasMore && (
        <button
          onClick={() => void loadMore()}
          disabled={loadingMore}
          className="px-3 py-2 text-left text-[11.5px] font-bold text-teal disabled:opacity-50"
        >
          {loadingMore ? "Loading…" : "Load more"}
        </button>
      )}
      <Link
        to="/trips/new"
        className="mt-auto rounded-pill border-[1.5px] border-faint-2 py-2.5 text-center text-[13px] font-bold text-secondary transition-colors hover:border-teal hover:text-teal-dark"
      >
        + New trip
      </Link>
    </div>
  );
}
