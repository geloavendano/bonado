import { Navigate, Outlet, useLocation, useParams } from "react-router-dom";
import { PageShell } from "@/components/layout/PageShell";
import { TripNav } from "@/components/trip/TripNav";
import { TripsRail } from "@/components/trip/TripsRail";
import { BalanceRail } from "@/components/trip/BalanceRail";
import { TripPageSkeleton } from "@/components/ui/Skeleton";
import { useTrip } from "@/hooks/useTrip";

export function TripLayout() {
  const { tripId } = useParams<{ tripId: string }>();
  const location = useLocation();
  const { trip, loading } = useTrip(tripId);
  const activeTrip = trip?.id === tripId ? trip : null;

  const showTabChrome =
    !location.pathname.includes("/expenses/") &&
    !location.pathname.includes("/settlements/");

  if (!loading && !trip) return <Navigate to="/" replace />;

  return (
    <>
      <div className="lg:mx-auto lg:flex lg:max-w-[1180px] lg:items-start">
        {showTabChrome && <TripsRail activeTripId={tripId ?? ""} />}
        <div className="lg:min-w-0 lg:flex-1">
          {loading || !activeTrip ? (
            <PageShell padded={false}>
              <TripPageSkeleton cover />
            </PageShell>
          ) : (
            <Outlet context={activeTrip} />
          )}
        </div>
        {showTabChrome &&
          (loading || !activeTrip ? (
            <div
              aria-label="Loading trip balance"
              className="sticky top-0 hidden h-dvh w-[260px] flex-none flex-col gap-3 border-l border-hairline px-5 py-6 lg:flex"
            >
              <div className="skeleton h-3 w-24 rounded-pill" />
              <div className="skeleton h-[82px] w-full rounded-[16px]" />
              <div className="skeleton mt-2 h-3 w-16 rounded-pill" />
              <div className="skeleton h-10 w-full rounded-[14px]" />
              <div className="skeleton h-10 w-full rounded-[14px]" />
            </div>
          ) : (
            <BalanceRail trip={activeTrip} />
          ))}
      </div>
      {showTabChrome && <TripNav tripId={tripId ?? ""} />}
    </>
  );
}
